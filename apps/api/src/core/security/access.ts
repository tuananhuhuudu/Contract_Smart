import { ForbiddenException } from "@nestjs/common";
import type { EntityManager } from "typeorm";
import type { Contract } from "../../models/contract.entity";
import { Party } from "../../models/party.entity";
import type { UserRole } from "../../models/user.entity";
import type { AuthUser } from "./decorators";

/** Roles that see every contract: the platform administrator and the read-only auditor. */
export const SEES_ALL: readonly UserRole[] = ["SYSTEM_ADMIN", "AUDITOR"];
/** Buyer staff who negotiate contracts (create, edit drafts, custom rules). */
export const NEGOTIATORS: readonly UserRole[] = ["CONTRACT_OWNER", "LEGAL_REVIEWER"];
/** Roles that record events; the event is recorded for the user's own party. */
export const EVENT_RECORDERS: readonly UserRole[] = ["SUPPLIER", "LEGAL_REVIEWER", "CONTRACT_OWNER", "FINANCE_APPROVER", "SECONDARY_APPROVER"];

/**
 * The organisation a user works for: their buyer or supplier, or for an approver the buyer it belongs
 * to. Null for platform roles. A user only reaches contracts where this organisation is a party.
 */
export async function organizationOf(user: AuthUser, db: EntityManager): Promise<number | null> {
  if (user.partyId === null) return null;
  const party = await db.getRepository(Party).findOneOrFail({ where: { id: user.partyId } });
  return party.type === "APPROVER" ? party.parentId : party.id;
}

/** 403 unless the user may read this contract (and everything under it). */
export async function assertCanSee(user: AuthUser, contract: Contract, db: EntityManager): Promise<void> {
  if (SEES_ALL.includes(user.role)) return;
  const org = await organizationOf(user, db);
  if (org === null || (org !== contract.buyerId && org !== contract.supplierId))
    throw new ForbiddenException(`CONTRACT_ACCESS_DENIED: contract ${contract.id} is not one of your organisation's`);
}

/** 403 unless the user has one of `roles` and works for the contract's buyer. */
export async function assertBuyerStaff(user: AuthUser, contract: Contract, roles: readonly UserRole[], db: EntityManager): Promise<void> {
  if (!roles.includes(user.role)) throw new ForbiddenException(`ROLE_NOT_ALLOWED: needs one of ${roles.join(", ")}`);
  if ((await organizationOf(user, db)) !== contract.buyerId)
    throw new ForbiddenException(`CONTRACT_ACCESS_DENIED: only the buyer's staff can do this on contract ${contract.id}`);
}
