import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { spawn } from "node:child_process";
import path from "node:path";
import { DataSource, In, type EntityManager } from "typeorm";
import { Contract, type ApprovalPolicy } from "../models/contract.entity";
import { Event } from "../models/event.entity";
import { EventType } from "../models/event-type.entity";
import { MilestoneEvaluation, type EvaluationFacts } from "../models/milestone-evaluation.entity";
import { Milestone } from "../models/milestone.entity";
import { Party } from "../models/party.entity";
import { PaymentRule } from "../models/payment-rule.entity";
import { AuditService } from "./audit.service";
import { PaymentService } from "./payment.service";
import { percentOf } from "../utils/money";

/** Where the Python engine lives (apps/engine) and which interpreter runs it. */
const ENGINE_DIR = process.env.ENGINE_DIR ?? path.resolve(process.cwd(), "..", "engine");
const PYTHON = process.env.PYTHON ?? "python3";
const TIMEOUT_MS = 20_000;

/**
 * The engine's policy names the organiser's event codes (DISPUTE_OPENED, REJECTION...). The 16 types the
 * first migration created keep those codes; types people add on the web get ET<id> and are sent to the
 * engine with their category, side and status.
 */
const DATA_PACK_CODES: Record<string, string> = {
  "Ký hợp đồng": "CONTRACT_SIGNED", "Xác nhận khởi động": "KICKOFF_CONFIRMED", "Duyệt yêu cầu": "REQUIREMENTS_APPROVED",
  "Đạt kiểm thử người dùng (UAT)": "UAT_PASSED", "Nghiệm thu": "ACCEPTANCE", "Giao hàng": "DELIVERY", "Hóa đơn": "INVOICE",
  "Đưa vào vận hành": "GO_LIVE", "Kích hoạt dịch vụ": "SERVICE_ACTIVATED", "Hoàn thành dịch vụ": "SERVICE_COMPLETED",
  "Hết bảo hành": "WARRANTY_COMPLETED", "Phê duyệt": "APPROVAL", "Từ chối": "REJECTION",
  "Mở tranh chấp": "DISPUTE_OPENED", "Đóng tranh chấp": "DISPUTE_RESOLVED", "Đề nghị đóng hợp đồng": "CONTRACT_CLOSE_REQUEST",
};

/** Who must approve, per approval policy: the columns the organiser's data repeats on every milestone. */
const APPROVALS: Record<ApprovalPolicy, { required: boolean; quorum: number; roles: string[] }> = {
  AUTO_IF_ALL_CONDITIONS: { required: false, quorum: 0, roles: [] },
  SINGLE_BUYER_APPROVAL: { required: true, quorum: 1, roles: ["CONTRACT_OWNER"] },
  DUAL_APPROVAL: { required: true, quorum: 2, roles: ["CONTRACT_OWNER", "SECONDARY_APPROVER"] },
  FINANCE_PLUS_OWNER: { required: true, quorum: 2, roles: ["CONTRACT_OWNER", "FINANCE_APPROVER"] },
};

type Row = Record<string, string>;
interface EngineRequest {
  contracts: Row[]; parties: Row[]; milestones: Row[]; events: Row[]; rules: Row[];
  event_types: Record<string, { category: string; side?: string; valid_status: string }>;
  milestone_ids: string[];
}
interface EngineResult {
  milestone_id: string; decision: MilestoneEvaluation["decision"]; reason_code: MilestoneEvaluation["reasonCode"];
  rule_id: string; status: MilestoneEvaluation["milestoneStatus"]; payable: string; penalty: string;
  missing: string[]; unauthorized: string[]; duplicates: string[]; unrelated: string[]; open_dispute_ids: string[];
  valid_approval_count: number; quorum: number; days_late: number | null; completion_ts: string | null;
  warnings: string[]; issues: string[]; variables: Record<string, unknown>; trail: [string, [string, ...unknown[]] | string][];
}

const bool = (value: boolean): string => (value ? "TRUE" : "FALSE");

/**
 * Runs the decision engine on the milestones of one contract. The PostgreSQL rows are turned into the
 * organiser's Data Pack layout (the only input the engine knows), the engine runs as a separate Python
 * process, and each answer is stored as a new milestone_evaluations row. Database ids travel as text;
 * the engine's event codes are translated back to event type names in the stored explanation.
 */
@Injectable()
export class EngineService {
  private readonly logger = new Logger(EngineService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly payments: PaymentService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Judges `milestoneIds` (default: every milestone) of an ACTIVE contract and stores the results.
   * `triggerEventId` records which event caused the run.
   */
  async evaluateContract(contractId: number, options: { milestoneIds?: number[]; triggerEventId?: number | null } = {}, db?: EntityManager): Promise<MilestoneEvaluation[]> {
    const manager = db ?? this.dataSource.manager;
    const { request, codeToName } = await this.buildRequest(contractId, options.milestoneIds, manager);
    if (!request.milestone_ids.length) return [];
    const { results } = await this.run(request);
    const rows = results.map((r) => manager.getRepository(MilestoneEvaluation).create({
      milestoneId: Number(r.milestone_id), triggerEventId: options.triggerEventId ?? null,
      ruleId: r.rule_id ? Number(r.rule_id) : null, decision: r.decision, reasonCode: r.reason_code, milestoneStatus: r.status,
      payableVndMn: r.payable, penaltyVndMn: r.penalty, facts: this.facts(r, codeToName),
    }));
    const saved = await manager.getRepository(MilestoneEvaluation).save(rows);
    for (const e of saved)
      await this.audit.record(manager, null, {
        action: "MILESTONE_EVALUATED", resource: "evaluation", resourceId: e.id, contractId,
        after: { milestoneId: e.milestoneId, decision: e.decision, reasonCode: e.reasonCode, payableVndMn: e.payableVndMn, penaltyVndMn: e.penaltyVndMn, ruleId: e.ruleId, triggerEventId: e.triggerEventId },
      });
    // Open, keep or cancel the payment order of each milestone according to the new decision.
    await this.payments.sync(saved, manager, contractId);
    return saved;
  }

  /** Same, but an engine failure is logged instead of failing the action that triggered it (the event stays recorded). */
  async evaluateQuietly(contractId: number, options: { milestoneIds?: number[]; triggerEventId?: number | null }, db: EntityManager): Promise<void> {
    try {
      await this.evaluateContract(contractId, options, db);
    } catch (error) {
      this.logger.warn(`Engine run for contract ${contractId} failed: ${(error as Error).message}`);
    }
  }

  /** The newest evaluation of each milestone (current decision). */
  async latest(milestoneIds: number[], db?: EntityManager): Promise<Map<number, MilestoneEvaluation>> {
    if (!milestoneIds.length) return new Map();
    const rows: MilestoneEvaluation[] = await (db ?? this.dataSource.manager).getRepository(MilestoneEvaluation)
      .createQueryBuilder("e").distinctOn(["e.milestone_id"]).where("e.milestone_id IN (:...ids)", { ids: milestoneIds })
      .orderBy("e.milestone_id").addOrderBy("e.evaluated_at", "DESC").addOrderBy("e.id", "DESC").getMany();
    return new Map(rows.map((r) => [r.milestoneId, r]));
  }

  /** Every evaluation of a milestone, newest first. */
  history(milestoneId: number): Promise<MilestoneEvaluation[]> {
    return this.dataSource.getRepository(MilestoneEvaluation).find({ where: { milestoneId }, order: { evaluatedAt: "DESC", id: "DESC" } });
  }

  // ---------------- Building the engine's input ----------------

  private async buildRequest(contractId: number, only: number[] | undefined, db: EntityManager) {
    const contract = await db.getRepository(Contract).findOneOrFail({ where: { id: contractId } });
    const milestones = await db.getRepository(Milestone).find({
      where: { contractId }, relations: { milestoneVersion: true }, order: { position: "ASC" },
    });
    const events = await db.getRepository(Event).find({ where: { milestoneId: In(milestones.map((m) => m.id)) }, order: { happenedAt: "ASC", id: "ASC" } });
    const paid = await this.payments.paidMilestoneIds(milestones.map((m) => m.id), db);
    const versionIds = [...new Set(milestones.map((m) => m.milestoneVersionId))];
    const rules = await db.getRepository(PaymentRule).find({ where: { milestoneVersionId: In(versionIds) }, order: { priority: "ASC" } });
    const parties = await db.getRepository(Party).find();
    const types = await db.getRepository(EventType).find();

    const codeOf = new Map(types.map((t) => [t.id, DATA_PACK_CODES[t.name] ?? `ET${t.id}`]));
    const codeToName = new Map(types.map((t) => [codeOf.get(t.id)!, t.name]));
    const disputeCodes = types.filter((t) => t.category === "DISPUTE_OPEN" || t.category === "DISPUTE_RESOLVE").map((t) => codeOf.get(t.id)!);
    const partyById = new Map(parties.map((p) => [p.id, p]));
    const approvals = APPROVALS[contract.approvalPolicy];

    const partyRow = (p: Party): Row => {
      let allowed = p.allowedEventTypeIds.map((id) => codeOf.get(id)).filter((c): c is string => !!c);
      // The policy reads "DISPUTE" for the right to open and close disputes.
      if (disputeCodes.length && disputeCodes.every((c) => allowed.includes(c))) allowed = [...allowed.filter((c) => !disputeCodes.includes(c)), "DISPUTE"];
      return {
        party_id: String(p.id), party_name: p.name, party_type: p.type, parent_party_id: p.parentId ? String(p.parentId) : "",
        approval_role: p.approvalRole ?? "NONE", approval_level: p.type === "APPROVER" ? "1" : "0",
        approval_limit_vnd_mn: p.approvalLimitVndMn ?? "", allowed_event_types: allowed.join(";"),
        can_approve_payment: bool(p.type === "APPROVER"), can_raise_dispute: "TRUE", status: p.active ? "ACTIVE" : "INACTIVE",
      };
    };

    const milestoneRows: Row[] = milestones.map((m) => {
      const v = m.milestoneVersion;
      const required = v.requiredEventTypeIds.map((id) => codeOf.get(id)).filter((c): c is string => !!c);
      const condition = [...required.map((c) => `EVENT:${c}`), ...(approvals.quorum ? [`APPROVAL_QUORUM:${approvals.quorum}`] : []), "NO_OPEN_DISPUTE"].join(" AND ");
      return {
        milestone_id: String(m.id), contract_id: String(contract.id), milestone_sequence: String(m.position),
        milestone_type: `M${v.milestoneId}`, milestone_name: `M${v.milestoneId}`, due_date: m.dueOn,
        payment_percent: percentOf(m.amountVndMn, contract.valueVndMn), planned_payment_vnd_mn: m.amountVndMn,
        condition_logic: "ALL", required_event_types: required.join(";"), required_condition: condition,
        invoice_required: bool(required.includes("INVOICE")), approval_required: bool(approvals.required),
        required_approval_quorum: String(approvals.quorum), required_approval_roles: approvals.roles.join(";"),
        hold_on_open_dispute: "TRUE", late_penalty_applicable: bool(v.latePenalty), grace_period_days: String(contract.graceDays),
        penalty_rate_pct_per_day: v.latePenalty ? contract.penaltyPctPerDay : "0.00", max_penalty_pct: v.latePenalty ? contract.maxPenaltyPct : "0.00",
        release_rule_code: `V${v.id}`, initial_milestone_status: "PLANNED",
      };
    });

    const eventRows: Row[] = events.map((e, i) => {
      const actor = partyById.get(e.partyId);
      return {
        event_id: String(e.id), contract_id: String(contract.id), milestone_id: String(e.milestoneId), contract_event_sequence: String(i + 1),
        event_timestamp: e.happenedAt, event_type: codeOf.get(e.eventTypeId) ?? `ET${e.eventTypeId}`, event_status: e.status,
        actor_party_id: String(e.partyId), actor_party_type: actor?.type ?? "", actor_role: actor?.approvalRole ?? actor?.type ?? "",
        event_source: "PORTAL", document_id: e.documentNo ?? "", amount_vnd_mn: "",
        reference_event_id: e.resolvesEventId ? String(e.resolvesEventId) : "", event_note: e.note,
      };
    });

    const ruleRows: Row[] = rules.map((r) => ({
      rule_id: String(r.id), release_rule_code: `V${r.milestoneVersionId}`, priority: String(r.priority), rule_name: r.name,
      condition_expression: r.condition, decision: r.decision, reason_code: r.reasonCode,
      payable_amount_formula: r.payableFormula, penalty_amount_formula: r.penaltyFormula, active: "TRUE",
    }));

    const request: EngineRequest = {
      contracts: [{
        contract_id: String(contract.id), contract_title: contract.title, contract_type: String(contract.contractTypeId),
        buyer_id: String(contract.buyerId), supplier_id: String(contract.supplierId), contract_value_vnd_mn: contract.valueVndMn,
        currency: "VND", start_date: contract.startOn, end_date: contract.endOn, approval_policy: contract.approvalPolicy,
        approval_quorum: String(approvals.quorum), auto_release_allowed: bool(contract.approvalPolicy === "AUTO_IF_ALL_CONDITIONS"),
        grace_period_days: String(contract.graceDays), penalty_rate_pct_per_day: contract.penaltyPctPerDay,
        max_penalty_pct: contract.maxPenaltyPct, initial_contract_status: contract.status,
      }],
      parties: parties.map(partyRow), milestones: milestoneRows, events: eventRows, rules: ruleRows,
      event_types: Object.fromEntries(types.filter((t) => !DATA_PACK_CODES[t.name]).map((t) => [codeOf.get(t.id)!, {
        category: t.category, valid_status: t.validStatus, ...(t.actorSide ? { side: t.actorSide } : {}),
      }])),
      // A paid milestone is settled: it keeps the decision it was paid on.
      milestone_ids: milestones.filter((m) => (!only || only.includes(m.id)) && !paid.has(m.id)).map((m) => String(m.id)),
    };
    return { request, codeToName };
  }

  /** The engine's answer, with event codes turned back into the names people see. */
  private facts(r: EngineResult, codeToName: Map<string, string>): EvaluationFacts {
    const name = (code: string) => codeToName.get(code) ?? code;
    return {
      variables: r.variables,
      trail: r.trail.map(([ruleId, outcome]) => [ruleId, Array.isArray(outcome) ? String(outcome[0]) : String(outcome)]),
      missing: r.missing.map(name), unauthorized: r.unauthorized, duplicates: r.duplicates, unrelated: r.unrelated,
      openDisputeIds: r.open_dispute_ids, validApprovalCount: r.valid_approval_count, quorum: r.quorum,
      daysLate: r.days_late, completedAt: r.completion_ts, warnings: r.warnings, issues: r.issues,
    };
  }

  // ---------------- Running the Python process ----------------

  private run(request: EngineRequest): Promise<{ results: EngineResult[] }> {
    return new Promise((resolve, reject) => {
      const child = spawn(PYTHON, ["run_json.py"], { cwd: ENGINE_DIR, stdio: ["pipe", "pipe", "pipe"] });
      let out = "", err = "";
      const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new ServiceUnavailableException("ENGINE_TIMEOUT")); }, TIMEOUT_MS);
      child.stdout.on("data", (chunk) => (out += chunk));
      child.stderr.on("data", (chunk) => (err += chunk));
      child.on("error", (error) => { clearTimeout(timer); reject(new ServiceUnavailableException(`ENGINE_UNAVAILABLE: ${error.message}`)); });
      child.on("close", (code) => {
        clearTimeout(timer);
        if (code !== 0) return reject(new ServiceUnavailableException(`ENGINE_FAILED: ${err.trim().split("\n").at(-1) ?? code}`));
        try { resolve(JSON.parse(out)); } catch { reject(new ServiceUnavailableException("ENGINE_BAD_OUTPUT")); }
      });
      child.stdin.end(JSON.stringify(request));
    });
  }
}
