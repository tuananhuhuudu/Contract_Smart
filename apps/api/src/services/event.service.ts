import { BadRequestException, ConflictException, ForbiddenException, Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { Contract } from "../models/contract.entity";
import type { Event } from "../models/event.entity";
import { EventType } from "../models/event-type.entity";
import { Milestone } from "../models/milestone.entity";
import { Party } from "../models/party.entity";
import { EventRepository } from "../repositories/event.repository";
import { AuditService } from "./audit.service";
import { EngineService } from "./engine.service";
import { PaymentService } from "./payment.service";
import type { CreateEventDto } from "../schemas/contract.schema";
import { nowInVietnam } from "../utils/dates";
import { assertCanSee } from "../core/security/access";
import type { AuthUser } from "../core/security/decorators";

/**
 * Records what happened on a milestone. The status comes from the event type; who may record which
 * type is left to the engine (it flags evidence recorded by the wrong party), so such cases stay visible.
 */
@Injectable()
export class EventService {
  constructor(
    private readonly events: EventRepository,
    private readonly engine: EngineService,
    private readonly payments: PaymentService,
    private readonly audit: AuditService,
    private readonly dataSource: DataSource,
  ) {}

  async listByMilestone(milestoneId: number, user: AuthUser): Promise<Event[]> {
    await this.assertMilestoneVisible(milestoneId, user);
    return this.events.listByMilestone(milestoneId);
  }

  async getEvent(id: number, user: AuthUser): Promise<Event> {
    const event = await this.events.findById(id);
    await this.assertMilestoneVisible(event.milestoneId, user);
    return event;
  }

  /** Records an event for the logged-in user's own party; nobody can act in another party's name. */
  record(dto: CreateEventDto, user: AuthUser): Promise<Event> {
    return this.dataSource.transaction(async (db) => {
      const milestone = await db.getRepository(Milestone).findOne({ where: { id: dto.milestoneId } });
      if (!milestone) throw new BadRequestException(`Milestone ${dto.milestoneId} does not exist`);
      const contract = await db.getRepository(Contract).findOneOrFail({ where: { id: milestone.contractId } });
      if (contract.status !== "ACTIVE")
        throw new ConflictException(`CONTRACT_NOT_ACTIVE: contract ${contract.id} is ${contract.status}; events are recorded only on an active contract`);
      if ((await this.payments.paidMilestoneIds([milestone.id], db)).size)
        throw new ConflictException(`MILESTONE_PAID: milestone ${milestone.id} is already paid; it takes no more events`);

      const type = await db.getRepository(EventType).findOne({ where: { id: dto.eventTypeId } });
      if (!type || !type.active) throw new BadRequestException(`Event type ${dto.eventTypeId} is not an active event type`);

      // The acting party is the user's own, and it belongs to this contract: its buyer, the buyer's approvers, or its supplier.
      const party = user.partyId === null ? null : await db.getRepository(Party).findOne({ where: { id: user.partyId } });
      const ofContract = party && (party.id === contract.buyerId || party.id === contract.supplierId || party.parentId === contract.buyerId);
      if (!ofContract) throw new ForbiddenException(`CONTRACT_ACCESS_DENIED: your party is not a party of contract ${contract.id}`);

      const happenedAt = dto.happenedAt ? (dto.happenedAt.length === 16 ? `${dto.happenedAt}:00` : dto.happenedAt) : nowInVietnam();
      let resolvesEventId: number | null = null;
      if (type.category === "DISPUTE_RESOLVE") {
        if (!dto.resolvesEventId) throw new BadRequestException("Closing a dispute needs resolvesEventId: the dispute it closes");
        const opened = await this.events.findByIdOptional(dto.resolvesEventId, db);
        const openedType = opened && (await db.getRepository(EventType).findOneOrFail({ where: { id: opened.eventTypeId } }));
        if (!opened || opened.milestoneId !== milestone.id || openedType?.category !== "DISPUTE_OPEN")
          throw new BadRequestException(`Event ${dto.resolvesEventId} is not an opened dispute of milestone ${milestone.id}`);
        if (happenedAt < opened.happenedAt) throw new BadRequestException("A dispute cannot be closed before it was opened");
        const already = await db.query(`SELECT id FROM events WHERE resolves_event_id = $1 LIMIT 1`, [opened.id]);
        if (already.length) throw new ConflictException(`Dispute ${opened.id} is already closed by event ${already[0].id}`);
        resolvesEventId = opened.id;
      } else if (dto.resolvesEventId) {
        throw new BadRequestException("resolvesEventId is only for closing a dispute");
      }

      const event = await this.events.create({
        milestoneId: milestone.id, eventTypeId: type.id, status: type.validStatus, partyId: party.id, recordedBy: user.id,
        happenedAt, documentNo: dto.documentNo || null, resolvesEventId, note: dto.note?.trim() ?? "",
      }, db);
      const action = type.category === "DISPUTE_OPEN" ? "DISPUTE_OPENED" : type.category === "DISPUTE_RESOLVE" ? "DISPUTE_CLOSED" : "EVENT_RECORDED";
      await this.audit.record(db, user, {
        action, resource: "event", resourceId: event.id, contractId: contract.id,
        after: { milestoneId: milestone.id, eventType: type.name, partyId: party.id, happenedAt, documentNo: event.documentNo, resolvesEventId, note: event.note },
      });
      // The engine judges the milestone again with this event included.
      await this.engine.evaluateQuietly(contract.id, { milestoneIds: [milestone.id], triggerEventId: event.id }, db);
      return event;
    });
  }

  private async assertMilestoneVisible(milestoneId: number, user: AuthUser): Promise<void> {
    const db = this.dataSource.manager;
    const milestone = await db.getRepository(Milestone).findOne({ where: { id: milestoneId } });
    if (!milestone) throw new BadRequestException(`Milestone ${milestoneId} does not exist`);
    await assertCanSee(user, await db.getRepository(Contract).findOneOrFail({ where: { id: milestone.contractId } }), db);
  }
}
