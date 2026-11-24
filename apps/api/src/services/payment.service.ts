import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { DataSource, In, type EntityManager } from "typeorm";
import { SEES_ALL, assertBuyerStaff, assertCanSee, organizationOf } from "../core/security/access";
import type { AuthUser } from "../core/security/decorators";
import { Contract } from "../models/contract.entity";
import { MilestoneEvaluation } from "../models/milestone-evaluation.entity";
import { Milestone } from "../models/milestone.entity";
import { Payment } from "../models/payment.entity";
import type { PaymentListQuery } from "../schemas/payment.schema";
import { Paginated, pageMeta, toSkipTake } from "../utils/paging";

/** Decisions that pay the supplier. */
const PAYING = new Set(["RELEASE", "PENALTY"]);

/**
 * Payment orders. The engine decides whether a milestone may be paid; this service turns that decision
 * into an order (sync), lets only the buyer's finance approver approve it, sends it to the payment
 * gateway (simulated here) and closes the contract when every milestone is settled.
 */
@Injectable()
export class PaymentService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Called after every engine run, in the same transaction. For each new evaluation:
   *  - pays and no open order: open one (PENDING) for the payable amount;
   *  - pays the same amount as the open order: keep it;
   *  - pays another amount, or no longer pays: cancel the pending order (and open a new one if it pays).
   * A PAID order is never touched (the engine does not evaluate paid milestones).
   */
  async sync(evaluations: MilestoneEvaluation[], db: EntityManager): Promise<void> {
    const repo = db.getRepository(Payment);
    for (const e of evaluations) {
      const open = await repo.findOne({ where: { milestoneId: e.milestoneId, status: In(["PENDING", "PAID"]) } });
      if (open?.status === "PAID") continue;
      const pays = PAYING.has(e.decision) && Number(e.payableVndMn) > 0;
      const same = open && pays && Number(open.amountVndMn) === Number(e.payableVndMn) && Number(open.penaltyVndMn) === Number(e.penaltyVndMn);
      if (same) continue;
      if (open) {
        const why = pays ? `engine chấm lại ra số tiền khác (${e.payableVndMn} tr)` : `engine chấm lại: ${e.decision} ${e.reasonCode}`;
        await repo.update({ id: open.id, status: "PENDING" }, { status: "CANCELLED", note: `Hủy vì ${why}, lần chấm #${e.id}` });
      }
      if (pays)
        await repo.save(repo.create({ milestoneId: e.milestoneId, evaluationId: e.id, amountVndMn: e.payableVndMn, penaltyVndMn: e.penaltyVndMn }));
    }
  }

  /** The current order (pending or paid) of each milestone. */
  async current(milestoneIds: number[], db?: EntityManager): Promise<Map<number, Payment>> {
    if (!milestoneIds.length) return new Map();
    const rows = await (db ?? this.dataSource.manager).getRepository(Payment)
      .find({ where: { milestoneId: In(milestoneIds), status: In(["PENDING", "PAID"]) } });
    return new Map(rows.map((p) => [p.milestoneId, p]));
  }

  /** Milestones already paid: the engine no longer evaluates them and no event can be added to them. */
  async paidMilestoneIds(milestoneIds: number[], db?: EntityManager): Promise<Set<number>> {
    const current = await this.current(milestoneIds, db);
    return new Set([...current.values()].filter((p) => p.status === "PAID").map((p) => p.milestoneId));
  }

  /** Orders the user may see (their organisation's contracts; admin and auditor see all), newest first. */
  async list(query: PaymentListQuery, user: AuthUser): Promise<Paginated<Payment & { contractId: number }>> {
    const qb = this.dataSource.getRepository(Payment).createQueryBuilder("p")
      .innerJoin(Milestone, "m", "m.id = p.milestone_id").innerJoin(Contract, "c", "c.id = m.contract_id")
      .addSelect("m.contract_id", "contract_id");
    if (query.contractId) qb.andWhere("c.id = :cid", { cid: query.contractId });
    if (query.status) qb.andWhere("p.status = :status", { status: query.status });
    if (!SEES_ALL.includes(user.role)) {
      const org = await organizationOf(user, this.dataSource.manager);
      qb.andWhere("(c.buyer_id = :org OR c.supplier_id = :org)", { org: org ?? -1 });
    }
    const { skip, take } = toSkipTake(query);
    const total = await qb.getCount();
    const { entities, raw } = await qb.orderBy("p.id", "DESC").offset(skip).limit(take).getRawAndEntities();
    const items = entities.map((p, i) => ({ ...p, contractId: Number((raw[i] as { contract_id: number }).contract_id) }));
    return new Paginated(items, pageMeta(query, total));
  }

  async get(id: number, user: AuthUser): Promise<Payment> {
    const { payment, contract } = await this.load(id, this.dataSource.manager);
    await assertCanSee(user, contract, this.dataSource.manager);
    return payment;
  }

  /**
   * The buyer's finance approver approves a pending order: it is checked against the milestone's latest
   * evaluation, sent to the gateway and marked PAID. When every milestone is then paid or rejected, the
   * contract is CLOSED.
   */
  approve(id: number, version: number, user: AuthUser): Promise<Payment> {
    return this.dataSource.transaction(async (db) => {
      const { payment, contract } = await this.load(id, db);
      await assertBuyerStaff(user, contract, ["FINANCE_APPROVER"], db);
      if (payment.version !== version)
        throw new ConflictException(`VERSION_CONFLICT: payment ${id} changed (version ${payment.version}, you sent ${version}); reload it`);
      if (payment.status !== "PENDING") throw new ConflictException(`PAYMENT_STATUS: payment ${id} is ${payment.status}, only a pending order can be approved`);
      if (contract.status !== "ACTIVE") throw new ConflictException(`CONTRACT_NOT_ACTIVE: contract ${contract.id} is ${contract.status}`);

      // The order must still match what the engine says now.
      const latest = await db.getRepository(MilestoneEvaluation).findOne({ where: { milestoneId: payment.milestoneId }, order: { evaluatedAt: "DESC", id: "DESC" } });
      if (!latest || !PAYING.has(latest.decision) || Number(latest.payableVndMn) !== Number(payment.amountVndMn))
        throw new ConflictException(`PAYMENT_STALE: the latest evaluation of milestone ${payment.milestoneId} no longer pays ${payment.amountVndMn}; reload`);

      const gatewayRef = await this.sendToGateway(payment);
      await db.getRepository(Payment).update({ id, version }, { status: "PAID", approvedBy: user.id, paidAt: new Date(), gatewayRef });
      await this.closeIfSettled(contract.id, db);
      return db.getRepository(Payment).findOneOrFail({ where: { id } });
    });
  }

  /**
   * Payment gateway. This project has none, so the transfer is simulated and always accepted; a real
   * gateway would be called here with the order id as idempotency key.
   */
  private async sendToGateway(payment: Payment): Promise<string> {
    return `SIM-${payment.id}-${Date.now()}`;
  }

  /** ACTIVE -> CLOSED once every milestone is paid or rejected by the engine. */
  private async closeIfSettled(contractId: number, db: EntityManager): Promise<void> {
    const milestones = await db.getRepository(Milestone).find({ where: { contractId } });
    const ids = milestones.map((m) => m.id);
    const paid = await this.paidMilestoneIds(ids, db);
    const latest = await db.getRepository(MilestoneEvaluation).createQueryBuilder("e").distinctOn(["e.milestone_id"])
      .where("e.milestone_id IN (:...ids)", { ids }).orderBy("e.milestone_id").addOrderBy("e.evaluated_at", "DESC").addOrderBy("e.id", "DESC").getMany();
    const rejected = new Set(latest.filter((e) => e.decision === "REJECT").map((e) => e.milestoneId));
    if (ids.every((m) => paid.has(m) || rejected.has(m)))
      await db.getRepository(Contract).update({ id: contractId, status: "ACTIVE" }, { status: "CLOSED" });
  }

  private async load(id: number, db: EntityManager): Promise<{ payment: Payment; contract: Contract }> {
    const payment = await db.getRepository(Payment).findOne({ where: { id } });
    if (!payment) throw new NotFoundException(`Payment ${id} not found`);
    const milestone = await db.getRepository(Milestone).findOneOrFail({ where: { id: payment.milestoneId } });
    const contract = await db.getRepository(Contract).findOneOrFail({ where: { id: milestone.contractId } });
    return { payment, contract };
  }
}
