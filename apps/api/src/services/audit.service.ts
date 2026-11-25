import { Injectable } from "@nestjs/common";
import { DataSource, type EntityManager } from "typeorm";
import { organizationOf } from "../core/security/access";
import type { AuthUser } from "../core/security/decorators";
import { AuditLog, type AuditAction } from "../models/audit-log.entity";
import type { AuditListQuery } from "../schemas/audit.schema";
import { Paginated, pageMeta, toSkipTake } from "../utils/paging";

/** One entry to write. The database numbers, links and seals it (trigger seal_audit_entry). */
export interface AuditEntry {
  action: AuditAction;
  resource: string;
  resourceId: string | number;
  contractId?: number | null;
  /** The company the entry is about (an account change, a locked company), for its administrator. */
  organizationId?: number | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string;
}

export interface ChainReport {
  ok: boolean;
  /** Entries checked before the first problem (all of them when ok). */
  checked: number;
  brokenId: number | null;
  problem: string | null;
  /** Hash of the last good entry: written down elsewhere, it also proves nothing was cut off the end. */
  headHash: string | null;
}

/**
 * Audit log. Every action writes its entry with `record`, inside the action's own transaction, so the
 * entry exists exactly when the action happened. Reading is scoped by role:
 *  - AUDITOR (platform, independent): everything, and checks the chain;
 *  - SYSTEM_ADMIN: platform entries (companies, accounts), not the contracts;
 *  - ADMIN_AUDITOR of a company: its contracts and what its own staff did;
 *  - ORG_ADMIN: the entries about its own company's accounts;
 *  - other staff: the history of the contracts their company is a party to.
 * Nobody changes or deletes an entry (triggers).
 */
@Injectable()
export class AuditService {
  constructor(private readonly dataSource: DataSource) {}

  /** Writes one entry. `actor` null: the system did it (engine, payment orders). */
  async record(db: EntityManager, actor: AuthUser | null, entry: AuditEntry): Promise<void> {
    const actorOrganizationId = actor ? await organizationOf(actor, db) : null;
    await db.query(
      `INSERT INTO audit_log (actor_id, actor_email, actor_role, actor_organization_id, action, resource, resource_id,
         contract_id, organization_id, before, after, reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [actor?.id ?? null, actor?.email ?? null, actor?.role ?? null, actorOrganizationId, entry.action, entry.resource,
        String(entry.resourceId), entry.contractId ?? null, entry.organizationId ?? null,
        entry.before ? JSON.stringify(entry.before) : null, entry.after ? JSON.stringify(entry.after) : null, entry.reason ?? ""],
    );
  }

  /** Entries the user may read, newest first. */
  async list(query: AuditListQuery, user: AuthUser): Promise<Paginated<AuditLog>> {
    const qb = this.dataSource.getRepository(AuditLog).createQueryBuilder("a");
    if (query.contractId) qb.andWhere("a.contract_id = :cid", { cid: query.contractId });
    if (query.action) qb.andWhere("a.action = :action", { action: query.action });
    if (query.resource) qb.andWhere("a.resource = :resource", { resource: query.resource });
    if (query.actorId) qb.andWhere("a.actor_id = :actor", { actor: query.actorId });

    const ownContracts = "a.contract_id IN (SELECT c.id FROM contracts c WHERE c.buyer_id = :org OR c.supplier_id = :org)";
    if (user.role === "SYSTEM_ADMIN") qb.andWhere("a.contract_id IS NULL");
    else if (user.role !== "AUDITOR") {
      const org = (await organizationOf(user, this.dataSource.manager)) ?? -1;
      if (user.role === "ADMIN_AUDITOR") qb.andWhere(`(${ownContracts} OR a.actor_organization_id = :org OR a.organization_id = :org)`, { org });
      else if (user.role === "ORG_ADMIN") qb.andWhere("a.organization_id = :org", { org });
      else qb.andWhere(ownContracts, { org });
    }
    const { skip, take } = toSkipTake(query);
    const total = await qb.getCount();
    const rows = await qb.orderBy("a.id", "DESC").offset(skip).limit(take).getMany();
    return new Paginated(rows, pageMeta(query, total));
  }

  /** Recomputes the whole chain in the database (audit_verify). */
  async verify(): Promise<ChainReport> {
    const [r] = await this.dataSource.query(`SELECT checked, broken_id, problem, head_hash FROM audit_verify()`);
    return {
      ok: r.broken_id === null, checked: Number(r.checked), brokenId: r.broken_id === null ? null : Number(r.broken_id),
      problem: r.problem, headHash: r.head_hash,
    };
  }
}
