import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { DataSource, In, type EntityManager } from "typeorm";
import { organizationOf } from "../core/security/access";
import type { AuthUser } from "../core/security/decorators";
import { hashPassword, verifyPassword } from "../core/security/password";
import { EventType } from "../models/event-type.entity";
import { APPROVAL_ROLES, Party } from "../models/party.entity";
import { PLATFORM_ROLES, ROLES_BY_COMPANY, User, type UserRole } from "../models/user.entity";
import type { ChangePasswordDto, CreateOrganizationDto, CreateUserDto, UpdateOrganizationDto, UpdateUserDto, UserListQuery } from "../schemas/account.schema";
import { Paginated, pageMeta, toSkipTake } from "../utils/paging";

type ApprovalRole = (typeof APPROVAL_ROLES)[number];
const APPROVER_NAMES: Record<ApprovalRole, string> = {
  CONTRACT_OWNER: "Contract Owner", FINANCE_APPROVER: "Finance Approver", SECONDARY_APPROVER: "Secondary Approver",
};

/** A user as the account screens show it: never the password hash. */
export interface UserView {
  id: string; email: string; fullName: string; role: UserRole; active: boolean; version: number;
  partyId: number | null; organizationId: number | null; organizationName: string | null;
  createdBy: string | null; createdAt: Date;
}

/**
 * Accounts and companies. The platform administrator (SYSTEM_ADMIN) opens a company and its first
 * administrator (ORG_ADMIN); each company administrator then manages the staff of their own company,
 * with the roles that fit the company type (ROLES_BY_COMPANY). Approval roles of a buyer work for the
 * buyer's approver party (one per role), created on first use, as in the organiser's data.
 */
@Injectable()
export class AccountService {
  constructor(private readonly dataSource: DataSource) {}

  // ---------------- Companies (platform administrator) ----------------

  /** Opens a company (buyer or supplier) with its first administrator. */
  createOrganization(dto: CreateOrganizationDto, actor: AuthUser): Promise<{ organization: Party; admin: UserView }> {
    return this.dataSource.transaction(async (db) => {
      if (await db.getRepository(Party).exist({ where: { name: dto.name.trim() } }))
        throw new ConflictException(`ORGANIZATION_EXISTS: a party named "${dto.name.trim()}" already exists`);
      const organization = await db.getRepository(Party).save(db.getRepository(Party).create({
        name: dto.name.trim(), type: dto.type, parentId: null, approvalRole: null, approvalLimitVndMn: null,
        allowedEventTypeIds: await this.defaultEventTypes(dto.type, null, db),
      }));
      const admin = await this.insertUser({ email: dto.adminEmail, fullName: dto.adminName, password: dto.adminPassword, role: "ORG_ADMIN", partyId: organization.id }, actor, db);
      return { organization, admin: await this.view(admin.id, db) };
    });
  }

  /** Locks or unlocks a whole company: its staff cannot log in while it is locked (AuthGuard checks it). */
  async updateOrganization(id: number, dto: UpdateOrganizationDto): Promise<Party> {
    const repo = this.dataSource.getRepository(Party);
    const party = await repo.findOne({ where: { id } });
    if (!party || party.type === "APPROVER") throw new NotFoundException(`Company ${id} not found`);
    if (party.version !== dto.version) throw new ConflictException(`VERSION_CONFLICT: company ${id} changed; reload it`);
    await repo.update({ id, version: dto.version }, { active: dto.active });
    return repo.findOneOrFail({ where: { id } });
  }

  // ---------------- Users ----------------

  /** SYSTEM_ADMIN sees every account; ORG_ADMIN the accounts of their own company. */
  async listUsers(query: UserListQuery, actor: AuthUser): Promise<Paginated<UserView>> {
    const qb = this.dataSource.getRepository(User).createQueryBuilder("u").leftJoin(Party, "p", "p.id = u.party_id");
    if (actor.role === "ORG_ADMIN") {
      const org = await this.orgOf(actor);
      qb.andWhere("(p.id = :org OR p.parent_id = :org)", { org });
    } else if (query.organizationId) {
      qb.andWhere("(p.id = :org OR p.parent_id = :org)", { org: query.organizationId });
    }
    if (query.role) qb.andWhere("u.role = :role", { role: query.role });
    if (query.q) qb.andWhere("(u.email ILIKE :q OR u.full_name ILIKE :q)", { q: `%${query.q}%` });
    const { skip, take } = toSkipTake(query);
    const total = await qb.getCount();
    const rows = await qb.orderBy("u.email", "ASC").offset(skip).limit(take).getMany();
    const views = await Promise.all(rows.map((u) => this.view(u.id)));
    return new Paginated(views, pageMeta(query, total));
  }

  /**
   * ORG_ADMIN creates staff of their own company, with a role the company type allows.
   * SYSTEM_ADMIN creates platform accounts, or another administrator of an existing company.
   */
  createUser(dto: CreateUserDto, actor: AuthUser): Promise<UserView> {
    return this.dataSource.transaction(async (db) => {
      let partyId: number | null;
      if (actor.role === "SYSTEM_ADMIN") {
        if ((PLATFORM_ROLES as readonly string[]).includes(dto.role)) partyId = null;
        else if (dto.role === "ORG_ADMIN" && dto.organizationId) partyId = (await this.company(dto.organizationId, db)).id;
        else throw new ForbiddenException("ROLE_NOT_ALLOWED: the platform administrator creates platform accounts and company administrators; a company's staff is created by its own administrator");
      } else {
        const company = await this.company(await this.orgOf(actor, db), db);
        partyId = await this.partyFor(company, dto.role, db);
      }
      const user = await this.insertUser({ ...dto, partyId }, actor, db);
      return this.view(user.id, db);
    });
  }

  /** Change name, role or lock state, within the same scope as creation. Nobody changes or locks their own account here. */
  updateUser(id: string, dto: UpdateUserDto, actor: AuthUser): Promise<UserView> {
    return this.dataSource.transaction(async (db) => {
      const user = await this.manageable(id, actor, db);
      if (user.version !== dto.version) throw new ConflictException(`VERSION_CONFLICT: account ${id} changed; reload it`);
      if (id === actor.id && (dto.role !== undefined || dto.active === false))
        throw new ForbiddenException("SELF_CHANGE_NOT_ALLOWED: you cannot change your own role or lock yourself");
      const changes: Partial<User> = {};
      if (dto.fullName !== undefined) changes.fullName = dto.fullName.trim();
      if (dto.active !== undefined) changes.active = dto.active;
      if (dto.role !== undefined && dto.role !== user.role) {
        if (actor.role === "SYSTEM_ADMIN") {
          // The platform administrator only moves accounts between platform roles.
          if (!(PLATFORM_ROLES as readonly string[]).includes(dto.role) || user.partyId !== null)
            throw new ForbiddenException("ROLE_NOT_ALLOWED: a company's roles are changed by its own administrator");
        } else {
          changes.partyId = await this.partyFor(await this.company(await this.orgOf(actor, db), db), dto.role, db);
        }
        changes.role = dto.role;
      }
      await db.getRepository(User).update({ id, version: dto.version }, changes);
      return this.view(id, db);
    });
  }

  /** Sets a new password chosen by the administrator (for a forgotten password); the user changes it after logging in. */
  async resetPassword(id: string, password: string, actor: AuthUser): Promise<UserView> {
    const user = await this.manageable(id, actor, this.dataSource.manager);
    await this.dataSource.getRepository(User).update({ id: user.id }, { passwordHash: await hashPassword(password) });
    return this.view(id);
  }

  /** Every user changes their own password, given the current one. */
  async changeOwnPassword(dto: ChangePasswordDto, actor: AuthUser): Promise<void> {
    const user = await this.dataSource.getRepository(User).createQueryBuilder("u").addSelect("u.passwordHash").where("u.id = :id", { id: actor.id }).getOneOrFail();
    if (!(await verifyPassword(dto.currentPassword, user.passwordHash))) throw new BadRequestException("WRONG_PASSWORD: the current password is not correct");
    await this.dataSource.getRepository(User).update({ id: actor.id }, { passwordHash: await hashPassword(dto.newPassword) });
  }

  // ---------------- Helpers ----------------

  private async insertUser(data: { email: string; fullName: string; password: string; role: UserRole; partyId: number | null }, actor: AuthUser, db: EntityManager): Promise<User> {
    const email = data.email.trim().toLowerCase();
    if (await db.getRepository(User).exist({ where: { email } })) throw new ConflictException(`EMAIL_TAKEN: ${email} already has an account`);
    return db.getRepository(User).save(db.getRepository(User).create({
      email, fullName: data.fullName.trim(), passwordHash: await hashPassword(data.password), role: data.role, partyId: data.partyId, createdBy: actor.id,
    }));
  }

  /** The account, if `actor` may manage it: SYSTEM_ADMIN manages platform accounts and company administrators; ORG_ADMIN their own company. */
  private async manageable(id: string, actor: AuthUser, db: EntityManager): Promise<User> {
    const user = await db.getRepository(User).findOne({ where: { id } });
    if (!user) throw new NotFoundException(`Account ${id} not found`);
    if (actor.role === "SYSTEM_ADMIN") {
      if (user.partyId === null || user.role === "ORG_ADMIN") return user;
      throw new ForbiddenException("ACCOUNT_OUT_OF_SCOPE: a company's staff is managed by its own administrator");
    }
    const org = await this.orgOf(actor, db);
    const party = user.partyId === null ? null : await db.getRepository(Party).findOne({ where: { id: user.partyId } });
    if (!party || (party.id !== org && party.parentId !== org)) throw new ForbiddenException("ACCOUNT_OUT_OF_SCOPE: this account is not in your company");
    return user;
  }

  /** The party a company role works for: the company itself, or for an approval role the buyer's approver party of that role. */
  private async partyFor(company: Party, role: UserRole, db: EntityManager): Promise<number> {
    const allowed: readonly string[] = ROLES_BY_COMPANY[company.type as "BUYER" | "SUPPLIER"];
    if (!allowed.includes(role))
      throw new ForbiddenException(`ROLE_NOT_ALLOWED: a ${company.type.toLowerCase()} company can give ${allowed.join(", ")}`);
    if (!(APPROVAL_ROLES as readonly string[]).includes(role)) return company.id;
    const approvalRole = role as ApprovalRole;
    const repo = db.getRepository(Party);
    const existing = await repo.findOne({ where: { parentId: company.id, approvalRole } });
    if (existing) return existing.id;
    const created = await repo.save(repo.create({
      name: `${APPROVER_NAMES[approvalRole]} - ${company.name}`, type: "APPROVER", parentId: company.id, approvalRole,
      approvalLimitVndMn: null, allowedEventTypeIds: await this.defaultEventTypes("APPROVER", approvalRole, db),
    }));
    return created.id;
  }

  /**
   * Event types a new party may record: a buyer its own evidence, disputes and the close request; a
   * supplier its own evidence and disputes; an approver approvals and rejections (the contract owner
   * also disputes), like the parties of the organiser's data.
   */
  private async defaultEventTypes(type: "BUYER" | "SUPPLIER" | "APPROVER", approvalRole: ApprovalRole | null, db: EntityManager): Promise<number[]> {
    const types = await db.getRepository(EventType).find({ where: { active: true } });
    const pick = (fn: (t: EventType) => boolean) => types.filter(fn).map((t) => t.id).sort((a, b) => a - b);
    const disputes = (t: EventType) => t.category === "DISPUTE_OPEN" || t.category === "DISPUTE_RESOLVE";
    if (type === "BUYER") return pick((t) => (t.category === "EVIDENCE" && t.actorSide === "BUYER") || disputes(t) || t.category === "OTHER");
    if (type === "SUPPLIER") return pick((t) => (t.category === "EVIDENCE" && t.actorSide === "SUPPLIER") || disputes(t));
    return pick((t) => t.category === "APPROVAL" || t.category === "REJECTION" || (approvalRole === "CONTRACT_OWNER" && disputes(t)));
  }

  private async company(id: number, db: EntityManager): Promise<Party> {
    const party = await db.getRepository(Party).findOne({ where: { id } });
    if (!party || party.type === "APPROVER") throw new BadRequestException(`Company ${id} not found (a buyer or a supplier)`);
    return party;
  }

  private async orgOf(actor: AuthUser, db: EntityManager = this.dataSource.manager): Promise<number> {
    const org = await organizationOf(actor, db);
    if (org === null) throw new ForbiddenException("NO_ORGANIZATION: your account belongs to no company");
    return org;
  }

  private async view(id: string, db: EntityManager = this.dataSource.manager): Promise<UserView> {
    const u = await db.getRepository(User).findOneOrFail({ where: { id } });
    const party = u.partyId === null ? null : await db.getRepository(Party).findOne({ where: { id: u.partyId } });
    const orgId = party ? (party.type === "APPROVER" ? party.parentId : party.id) : null;
    const org = orgId === null ? null : await db.getRepository(Party).findOne({ where: { id: In([orgId]) } });
    return {
      id: u.id, email: u.email, fullName: u.fullName, role: u.role, active: u.active, version: u.version, partyId: u.partyId,
      organizationId: orgId, organizationName: org?.name ?? null, createdBy: u.createdBy, createdAt: u.createdAt,
    };
  }
}
