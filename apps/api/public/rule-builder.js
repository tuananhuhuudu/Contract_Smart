// Shared rule picker: turns a rule condition ("days_late_after_grace > 10 AND ...") into Vietnamese
// drop-downs and back. Used by app.html. The variable list mirrors the engine's rule_language.json;
// the API checks the words again when a rule is saved (src/utils/rule-language.ts).
const esc = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const DECISION_VI = { RELEASE: "Trả tiền", HOLD: "Giữ tiền", REJECT: "Từ chối", PENALTY: "Trả có trừ phạt" };
// Variables the engine can evaluate (its rule_language.json), with Vietnamese labels for the pickers.
const VARS = [
  ["open_dispute", "Có tranh chấp đang mở", "bool"], ["valid_rejection_event_count", "Số lần từ chối hợp lệ", "num"],
  ["unauthorized_required_event_count", "Số chứng từ sai thẩm quyền", "num"], ["required_event_completion_rate", "Tỷ lệ đủ chứng từ (0 đến 1)", "num"],
  ["all_required_conditions_met", "Đủ mọi điều kiện bắt buộc", "bool"], ["approval_required", "Mốc cần phê duyệt", "bool"],
  ["valid_approval_count", "Số vai trò đã duyệt", "num"], ["required_approval_quorum", "Số vai trò cần duyệt", "num"],
  ["invoice_required", "Mốc cần hóa đơn", "bool"], ["late_penalty_applicable", "Mốc có phạt trễ", "bool"],
  ["hold_on_open_dispute", "Giữ tiền khi có tranh chấp", "bool"], ["auto_release_allowed", "Cho phép tự giải ngân", "bool"],
  ["days_late_after_grace", "Số ngày trễ sau ân hạn", "num"], ["grace_period_days", "Số ngày ân hạn", "num"],
  ["actual_completion_date", "Ngày hoàn thành thực tế", "date"], ["due_date", "Ngày đến hạn", "date"],
  ["due_date + grace_period_days", "Ngày đến hạn + số ngày ân hạn", "date"],
  ["planned_payment_vnd_mn", "Tiền của mốc (triệu)", "num"], ["contract_value_vnd_mn", "Giá trị hợp đồng (triệu)", "num"],
  ["payment_percent", "% thanh toán của mốc", "num"], ["penalty_rate_pct_per_day", "Tỷ lệ phạt mỗi ngày (%)", "num"], ["max_penalty_pct", "Trần phạt (%)", "num"],
];
const varOf = (name) => VARS.find((v) => v[0] === name);
const OPS = [["==", "bằng"], ["!=", "khác"], [">", "lớn hơn"], [">=", "lớn hơn hoặc bằng"], ["<", "nhỏ hơn"], ["<=", "nhỏ hơn hoặc bằng"]];
// Reason codes the engine knows (policy/case4_btc.json) and the milestone status each one leads to.
const REASONS = [
  ["OPEN_DISPUTE", "Đang tranh chấp", "Đang giữ"], ["REJECTION_PRESENT", "Bên mua từ chối", "Bị từ chối"],
  ["UNAUTHORIZED_EVENT", "Chứng từ sai thẩm quyền", "Đang giữ"], ["MISSING_REQUIRED_EVENT", "Thiếu sự kiện bắt buộc", "Chờ chứng từ"],
  ["APPROVAL_QUORUM_NOT_MET", "Chưa đủ người duyệt", "Chờ duyệt"], ["LATE_COMPLETION", "Hoàn thành trễ hạn", "Trả có trừ phạt"],
  ["ALL_CONDITIONS_MET", "Đủ mọi điều kiện", "Đủ điều kiện trả"], ["UNRESOLVED_CONDITION", "Chưa xác định được", "Đang giữ"],
];

// Condition text <-> list of clauses { v: variable, op, val }. The engine language only joins clauses with AND.
function parseCondition(text) {
  if (text.trim() === "ELSE") return "ELSE";
  return text.split(" AND ").filter((x) => x.trim()).map((part) => {
    const m = part.trim().match(/^([a-z_]+)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);
    return m ? { v: m[1], op: m[2], val: m[3].trim() } : { v: "", op: "==", val: part.trim() };
  });
}
const buildCondition = (clauses) => clauses === "ELSE" ? "ELSE" : clauses.map((c) => `${c.v} ${c.op} ${c.val}`).join(" AND ");
function valueLabel(val) {
  if (val === "TRUE") return "đúng"; if (val === "FALSE") return "sai";
  return varOf(val)?.[1].toLowerCase() ?? val;
}
function sentence(clauses) {
  if (clauses === "ELSE") return "Mọi trường hợp còn lại";
  return "Nếu " + clauses.map((c) => `${(varOf(c.v)?.[1] ?? c.v).toLowerCase()} ${OPS.find((o) => o[0] === c.op)?.[1] ?? c.op} ${valueLabel(c.val)}`).join(" và ");
}
function clauseHtml(c, i, dis) {
  const type = varOf(c.v)?.[2] ?? "num";
  const ops = type === "bool" ? OPS.slice(0, 2) : OPS;
  // Value picker: TRUE/FALSE for yes/no variables; a typed number or another variable of the same kind otherwise.
  const same = VARS.filter((x) => x[2] === type && x[0] !== c.v);
  const isNum = /^-?\d+(\.\d+)?$/.test(c.val);
  const kind = type === "bool" ? c.val : isNum ? "num" : varOf(c.val) ? "var:" + c.val : "num";
  const valueSelect = type === "bool"
    ? `<select data-c="val" ${dis}><option value="TRUE" ${c.val === "TRUE" ? "selected" : ""}>đúng</option><option value="FALSE" ${c.val === "FALSE" ? "selected" : ""}>sai</option></select>`
    : `<select data-c="kind" ${dis}>${type === "num" ? `<option value="num" ${kind === "num" ? "selected" : ""}>số…</option>` : ""}
        ${same.map((x) => `<option value="var:${x[0]}" ${kind === "var:" + x[0] ? "selected" : ""}>${esc(x[1])}</option>`).join("")}</select>
       ${kind === "num" ? `<input data-c="num" type="number" step="any" style="width:80px" value="${isNum ? c.val : 0}" ${dis}>` : ""}`;
  return `<div class="clause" data-k="${i}"><span class="and">${i ? "VÀ" : "NẾU"}</span>
    <select data-c="v" ${dis}>${VARS.filter((x) => !x[0].includes(" ")).map((x) => `<option value="${x[0]}" ${x[0] === c.v ? "selected" : ""}>${esc(x[1])}</option>`).join("")}</select>
    <select data-c="op" ${dis}>${ops.map((o) => `<option value="${esc(o[0])}" ${o[0] === c.op ? "selected" : ""}>${o[1]}</option>`).join("")}</select>
    ${valueSelect}${dis ? "" : ` <button class="btn sec small" data-c="rm" title="Bỏ điều kiện">×</button>`}</div>`;
}
function condEditor(r, dis) {
  const clauses = parseCondition(r.condition);
  return `<div class="cond">${clauses === "ELSE" ? "" : clauses.map((c, i) => clauseHtml(c, i, dis)).join("")}
    ${dis ? "" : `<div class="tools">${clauses === "ELSE" ? "" : `<button class="btn sec small" data-c="add">+ VÀ điều kiện</button>`}
      <label><input type="checkbox" data-c="else" ${clauses === "ELSE" ? "checked" : ""}>Còn lại (ELSE)</label></div>`}
    <div class="sentence">${esc(sentence(clauses))}</div></div>`;
}
// Reads the clause pickers of one rule row back into its condition text.
function readCondition(row, action, k) {
  if (row.querySelector('[data-c="else"]')?.checked) return "ELSE";
  let clauses = [...row.querySelectorAll(".clause")].map((el) => {
    const v = el.querySelector('[data-c="v"]').value, type = varOf(v)?.[2];
    const op = el.querySelector('[data-c="op"]').value;
    let val;
    if (type === "bool") val = el.querySelector('[data-c="val"]')?.value ?? "TRUE";
    else {
      const fallback = type === "date" ? "var:" + VARS.find((x) => x[2] === "date" && x[0] !== v)[0] : "num";
      const kind = el.querySelector('[data-c="kind"]')?.value ?? fallback;
      val = kind.startsWith("var:") ? kind.slice(4) : (el.querySelector('[data-c="num"]')?.value || "0");
    }
    return { v, op: type === "bool" && !["==", "!="].includes(op) ? "==" : op, val };
  });
  if (action === "add") clauses.push({ v: "open_dispute", op: "==", val: "TRUE" });
  if (action === "rm") clauses.splice(k, 1);
  return clauses.length ? buildCondition(clauses) : "ELSE";
}
