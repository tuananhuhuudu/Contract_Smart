/**
 * Loads the organiser's sample data (data/datapack/*.csv) into the database as an example workflow.
 * Run from apps/api: pnpm db:seed. It empties every data table (all but event_types), then reloads,
 * so it can be run again at any time on a development database; never run it on real data. The CSV business codes (B009, S021...) are only
 * used here to link rows; the database keeps generated ids.
 */
import "../src/core/load-env";
import "reflect-metadata";
import { readFileSync } from "node:fs";
import path from "node:path";
import dataSource from "../src/core/data-source";
import { hashPassword } from "../src/core/security/password";

const DATA_DIR = path.join(__dirname, "..", "..", "..", "data", "datapack");

/** Minimal CSV reader: header row, quoted fields with "" escapes, UTF-8 with or without BOM. */
function readCsv(file: string): Record<string, string>[] {
  const text = readFileSync(path.join(DATA_DIR, file), "utf8").replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows;
  return body.map((values) => Object.fromEntries(header.map((h, i) => [h, values[i] ?? ""])));
}

/** Event type codes used in the CSV files, mapped to the names the migration created. */
const EVENT_TYPE_NAMES: Record<string, string[]> = {
  CONTRACT_SIGNED: ["Ký hợp đồng"], KICKOFF_CONFIRMED: ["Xác nhận khởi động"], REQUIREMENTS_APPROVED: ["Duyệt yêu cầu"],
  UAT_PASSED: ["Đạt kiểm thử người dùng (UAT)"], ACCEPTANCE: ["Nghiệm thu"], DELIVERY: ["Giao hàng"], INVOICE: ["Hóa đơn"],
  GO_LIVE: ["Đưa vào vận hành"], SERVICE_ACTIVATED: ["Kích hoạt dịch vụ"], SERVICE_COMPLETED: ["Hoàn thành dịch vụ"],
  WARRANTY_COMPLETED: ["Hết bảo hành"], APPROVAL: ["Phê duyệt"], REJECTION: ["Từ chối"],
  DISPUTE_OPENED: ["Mở tranh chấp"], DISPUTE_RESOLVED: ["Đóng tranh chấp"], CONTRACT_CLOSE_REQUEST: ["Đề nghị đóng hợp đồng"],
  // parties.csv grants "DISPUTE": both opening and closing a dispute.
  DISPUTE: ["Mở tranh chấp", "Đóng tranh chấp"],
};

async function main(): Promise<void> {
  await dataSource.initialize();
  await dataSource.transaction(async (db) => {
    const types: { id: number; name: string }[] = await db.query(`SELECT id, name FROM event_types`);
    const typeId = new Map(types.map((t) => [t.name, t.id]));
    const eventTypeIds = (codes: string): number[] => [...new Set(codes.split(";").filter(Boolean).flatMap((code) => {
      const names = EVENT_TYPE_NAMES[code];
      if (!names) throw new Error(`Unknown event type code in CSV: ${code}`);
      return names.map((name) => typeId.get(name)!);
    }))].sort((a, b) => a - b);

    // Empty every table the seed fills. The lock triggers (append-only events, published versions,
    // active contracts) are switched off for this statement only, inside the same transaction.
    const guarded = ["events", "milestones", "contracts", "payment_rules", "milestone_versions"];
    for (const t of guarded) await db.query(`ALTER TABLE ${t} DISABLE TRIGGER USER`);
    await db.query(`TRUNCATE parties, users, milestone_library, milestone_versions, payment_rules,
      contract_types, contract_type_milestones, contracts, milestones, events RESTART IDENTITY`);
    for (const t of guarded) await db.query(`ALTER TABLE ${t} ENABLE TRIGGER USER`);

    // ---------- Group 1: parties (buyers and suppliers first, approvers point at their buyer) ----------
    const parties = readCsv("parties.csv");
    const partyId = new Map<string, number>();
    for (const p of [...parties.filter((x) => x.party_type !== "APPROVER"), ...parties.filter((x) => x.party_type === "APPROVER")]) {
      const [{ id }] = await db.query(
        `INSERT INTO parties (name, type, parent_id, approval_role, approval_limit_vnd_mn, allowed_event_type_ids, active)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [p.party_name, p.party_type, p.parent_party_id ? partyId.get(p.parent_party_id) : null,
         p.approval_role === "NONE" ? null : p.approval_role, p.approval_limit_vnd_mn || null,
         eventTypeIds(p.allowed_event_types), p.status === "ACTIVE"],
      );
      partyId.set(p.party_id, id);
    }
    console.log(`parties: ${partyId.size}`);

    // ---------- Demo accounts: one per role, on real parties of the sample data ----------
    // Nova An Business JSC (B010) is the buyer; Phú Minh Technology JSC (S015) supplies it (contract CT0019 in the CSV).
    // Development password: SEED_PASSWORD from apps/api/.env, or Passw0rd! when it is empty.
    const passwordHash = await hashPassword(process.env.SEED_PASSWORD || "Passw0rd!");
    const nameOf = new Map(parties.map((p) => [p.party_id, p.party_name]));
    const approverOf = (buyer: string, role: string) => parties.find((p) => p.parent_party_id === buyer && p.approval_role === role)!.party_id;
    const accounts: [string, string, string, string | null][] = [
      ["admin@contract-smart.vn", "Quản trị hệ thống", "SYSTEM_ADMIN", null],
      ["auditor@contract-smart.vn", "Kiểm toán", "AUDITOR", null],
      ["legal@novaan.vn", "Trần Thị Mai", "LEGAL_REVIEWER", "B010"],
      ["owner@novaan.vn", "Nguyễn Văn An", "CONTRACT_OWNER", approverOf("B010", "CONTRACT_OWNER")],
      ["finance@novaan.vn", "Lê Quốc Dũng", "FINANCE_APPROVER", approverOf("B010", "FINANCE_APPROVER")],
      ["secondary@novaan.vn", "Phạm Minh Đức", "SECONDARY_APPROVER", approverOf("B010", "SECONDARY_APPROVER")],
      ["controller@novaan.vn", "Đỗ Minh Khoa", "ADMIN_AUDITOR", "B010"],
      ["supplier@phuminh.vn", "Hoàng Văn Phú", "SUPPLIER", "S015"],
      ["controller@phuminh.vn", "Vũ Thị Lan", "ADMIN_AUDITOR", "S015"],
    ];
    for (const [email, fullName, role, code] of accounts)
      await db.query(`INSERT INTO users (email, password_hash, full_name, role, party_id) VALUES ($1, $2, $3, $4, $5)`,
        [email, passwordHash, fullName, role, code ? partyId.get(code) : null]);
    console.log(`users: ${accounts.length} (${accounts.map(([e, , , c]) => `${e}${c ? " → " + nameOf.get(c) : ""}`).join("; ")})`);

    // ---------- A small example workflow: the goods supply type and two contracts ----------
    // Contract CT0019 of the CSV (Nova An buys from Phú Minh, matching the demo accounts) with its real
    // events, and one new DRAFT contract made from the same template to try editing and activation.
    const SAMPLE_CONTRACT = "CT0019";
    const MILESTONE_NAMES: Record<string, string> = {
      "R_GOODS_STD:SIGNING": "Ký hợp đồng", "R_GOODS_STD:DELIVERY": "Giao hàng",
      "R_GOODS_STD:ACCEPTANCE": "Nghiệm thu", "R_GOODS_STD:WARRANTY": "Hết bảo hành",
    };
    const RULE_NAMES: Record<string, string> = {
      OPEN_DISPUTE: "Đang tranh chấp thì giữ tiền", REJECTION_PRESENT: "Bên mua từ chối thì không trả",
      UNAUTHORIZED_EVENT: "Chứng từ do bên không có quyền ghi thì giữ tiền", MISSING_REQUIRED_EVENT: "Thiếu sự kiện bắt buộc thì giữ tiền",
      APPROVAL_QUORUM_NOT_MET: "Chưa đủ người duyệt thì giữ tiền", LATE_COMPLETION: "Xong trễ hạn thì trừ tiền phạt",
      ALL_CONDITIONS_MET: "Đủ mọi điều kiện thì trả tiền", UNRESOLVED_CONDITION: "Còn lại: giữ tiền để kiểm tra",
    };
    const NOTES: Record<string, string> = { "Business event recorded.": "Đã ghi nhận.", "Payment approval recorded.": "Đã phê duyệt thanh toán." };
    const contractRow = readCsv("contracts.csv").find((c) => c.contract_id === SAMPLE_CONTRACT)!;
    const msRows = readCsv("milestones.csv").filter((m) => m.contract_id === SAMPLE_CONTRACT).sort((x, y) => +x.milestone_sequence - +y.milestone_sequence);
    const ruleRows = readCsv("payment_rules.csv");

    // Library: one milestone per rule set, version 1 published with the CSV settings and rules.
    const versionOf = new Map<string, number>(), libraryOf = new Map<string, number>();
    for (const m of msRows) {
      const [{ id: libId }] = await db.query(`INSERT INTO milestone_library (name) VALUES ($1) RETURNING id`, [MILESTONE_NAMES[m.release_rule_code]]);
      const [{ id: verId }] = await db.query(
        `INSERT INTO milestone_versions (milestone_id, version_no, status, required_event_type_ids, late_penalty, note, published_at)
         VALUES ($1, 1, 'DRAFT', $2, $3, 'Dữ liệu mẫu của BTC', NULL) RETURNING id`,
        [libId, eventTypeIds(m.required_event_types), m.late_penalty_applicable === "TRUE"]);
      for (const r of ruleRows.filter((x) => x.release_rule_code === m.release_rule_code && x.active === "TRUE"))
        await db.query(
          `INSERT INTO payment_rules (milestone_version_id, priority, name, condition, decision, reason_code, payable_formula, penalty_formula)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [verId, +r.priority, RULE_NAMES[r.reason_code] ?? r.rule_name, r.condition_expression, r.decision, r.reason_code, r.payable_amount_formula, r.penalty_amount_formula]);
      await db.query(`UPDATE milestone_versions SET status = 'PUBLISHED', published_at = now() WHERE id = $1`, [verId]);
      versionOf.set(m.release_rule_code, verId); libraryOf.set(m.release_rule_code, libId);
    }

    // Contract type: its template is the shares and due offsets of the sample contract.
    const daysAfterStart = (date: string) => Math.round((Date.parse(date) - Date.parse(contractRow.start_date)) / 86_400_000);
    const [{ id: contractTypeId }] = await db.query(`INSERT INTO contract_types (name) VALUES ('Cung cấp hàng hóa') RETURNING id`);
    for (const m of msRows)
      await db.query(
        `INSERT INTO contract_type_milestones (contract_type_id, position, milestone_id, payment_percent, due_after_days) VALUES ($1, $2, $3, $4, $5)`,
        [contractTypeId, +m.milestone_sequence, libraryOf.get(m.release_rule_code), m.payment_percent, daysAfterStart(m.due_date)]);

    // Contract 1: the sample contract, activated, with its events (a contract must be ACTIVE to record events).
    const insertContract = async (title: string, value: string, start: string, end: string) => (await db.query(
      `INSERT INTO contracts (title, contract_type_id, buyer_id, supplier_id, value_vnd_mn, start_on, end_on, approval_policy, grace_days, penalty_pct_per_day, max_penalty_pct)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
      [title, contractTypeId, partyId.get(contractRow.buyer_id), partyId.get(contractRow.supplier_id), value, start, end,
       contractRow.approval_policy, +contractRow.grace_period_days, contractRow.penalty_rate_pct_per_day, contractRow.max_penalty_pct]))[0].id as number;
    const c1 = await insertContract(contractRow.contract_title, contractRow.contract_value_vnd_mn, contractRow.start_date, contractRow.end_date);
    const milestoneId = new Map<string, number>();
    for (const m of msRows) {
      const [{ id }] = await db.query(
        `INSERT INTO milestones (contract_id, position, milestone_version_id, amount_vnd_mn, due_on) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [c1, +m.milestone_sequence, versionOf.get(m.release_rule_code), m.planned_payment_vnd_mn, m.due_date]);
      milestoneId.set(m.milestone_id, id);
    }
    await db.query(`UPDATE contracts SET status = 'ACTIVE' WHERE id = $1`, [c1]);
    const eventRows = readCsv("events.csv").filter((e) => e.contract_id === SAMPLE_CONTRACT).sort((x, y) => x.event_timestamp.localeCompare(y.event_timestamp));
    const eventId = new Map<string, number>();
    for (const e of eventRows) {
      const [{ id }] = await db.query(
        `INSERT INTO events (milestone_id, event_type_id, status, party_id, happened_at, document_no, resolves_event_id, note)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [milestoneId.get(e.milestone_id), eventTypeIds(e.event_type)[0], e.event_status, partyId.get(e.actor_party_id), e.event_timestamp,
         e.document_id || null, e.reference_event_id ? eventId.get(e.reference_event_id) : null, NOTES[e.event_note] ?? e.event_note]);
      eventId.set(e.event_id, id);
    }

    // Contract 2: a new DRAFT from the template, starting today, to try the negotiation steps.
    const today = new Date().toISOString().slice(0, 10);
    const addDays = (d: string, n: number) => new Date(Date.parse(d) + n * 86_400_000).toISOString().slice(0, 10);
    const c2 = await insertContract("Cung cấp thiết bị mạng (bản nháp để thử)", "1000.00", today, addDays(today, 180));
    const shares = [200, 400, 300, 100]; // the template shares 20/40/30/10 % of 1 000
    for (const [i, m] of msRows.entries())
      await db.query(
        `INSERT INTO milestones (contract_id, position, milestone_version_id, amount_vnd_mn, due_on) VALUES ($1, $2, $3, $4, $5)`,
        [c2, i + 1, versionOf.get(m.release_rule_code), shares[i], addDays(today, daysAfterStart(m.due_date))]);
    console.log(`sample: ${msRows.length} milestones in the library (${ruleRows.filter((r) => versionOf.has(r.release_rule_code)).length} rules), 1 contract type, contract ${c1} ACTIVE with ${eventRows.length} events, contract ${c2} DRAFT`);
  });
  await dataSource.destroy();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
