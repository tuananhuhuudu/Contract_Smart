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
  });
  await dataSource.destroy();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
