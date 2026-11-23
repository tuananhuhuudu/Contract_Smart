import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { Contract } from "../models/contract.entity";
import type { Event } from "../models/event.entity";
import { EventType } from "../models/event-type.entity";
import { Milestone } from "../models/milestone.entity";
import { Party } from "../models/party.entity";
import { EventRepository } from "../repositories/event.repository";
import type { CreateEventDto } from "../schemas/contract.schema";
import { nowInVietnam } from "../utils/dates";

/**
 * Records what happened on a milestone. The status comes from the event type; who may record which
 * type is left to the engine (it flags evidence recorded by the wrong party), so such cases stay visible.
 */
@Injectable()
export class EventService {
  constructor(
    private readonly events: EventRepository,
    private readonly dataSource: DataSource,
  ) {}

  listByMilestone(milestoneId: number): Promise<Event[]> {
    return this.events.listByMilestone(milestoneId);
  }

  getEvent(id: number): Promise<Event> {
    return this.events.findById(id);
  }

  record(dto: CreateEventDto): Promise<Event> {
    return this.dataSource.transaction(async (db) => {
      const milestone = await db.getRepository(Milestone).findOne({ where: { id: dto.milestoneId } });
      if (!milestone) throw new BadRequestException(`Milestone ${dto.milestoneId} does not exist`);
      const contract = await db.getRepository(Contract).findOneOrFail({ where: { id: milestone.contractId } });
      if (contract.status !== "ACTIVE")
        throw new ConflictException(`CONTRACT_NOT_ACTIVE: contract ${contract.id} is ${contract.status}; events are recorded only on an active contract`);

      const type = await db.getRepository(EventType).findOne({ where: { id: dto.eventTypeId } });
      if (!type || !type.active) throw new BadRequestException(`Event type ${dto.eventTypeId} is not an active event type`);

      // The acting party belongs to this contract: its buyer, the buyer's approvers, or its supplier.
      const party = await db.getRepository(Party).findOne({ where: { id: dto.partyId } });
      const ofContract = party && (party.id === contract.buyerId || party.id === contract.supplierId || party.parentId === contract.buyerId);
      if (!ofContract) throw new BadRequestException(`Party ${dto.partyId} is not a party of contract ${contract.id}`);

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

      return this.events.create({
        milestoneId: milestone.id, eventTypeId: type.id, status: type.validStatus, partyId: party.id, recordedBy: null,
        happenedAt, documentNo: dto.documentNo || null, resolvesEventId, note: dto.note?.trim() ?? "",
      }, db);
    });
  }
}
