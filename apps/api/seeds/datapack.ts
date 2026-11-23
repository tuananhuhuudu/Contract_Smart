/**
 * Loads the organiser's sample data (data/datapack/*.csv) into the database as an example workflow.
 * Run from apps/api: pnpm db:seed. It empties the tables it fills, then reloads them, so it can be
 * run again at any time on a development database. The CSV business codes (B009, S021...) are only
 * used here to link rows; the database keeps generated ids.
 */
import "../src/core/load-env";
import "reflect-metadata";
import { readFileSync } from "node:fs";
import path from "node:path";
import dataSource from "../src/core/data-source";

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

    // ---------- Group 1: parties (buyers and suppliers first, approvers point at their buyer) ----------
    await db.query(`TRUNCATE parties RESTART IDENTITY CASCADE`);
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
  });
  await dataSource.destroy();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
