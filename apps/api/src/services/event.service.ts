import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { DataSource, type EntityManager } from "typeorm";
import { Contract } from "../models/contract.entity";
import { EventType } from "../models/event-type.entity";
import type { Event } from "../models/event.entity";
import { Party } from "../models/party.entity";
import { nextCode } from "../repositories/codes";
import { MilestoneRepository } from "../repositories/contract.repository";
import { EventRepository } from "../repositories/event.repository";
import type { CreateEventDto } from "../schemas/event.schema";

/** Current wall-clock time in Vietnam, in the format of event_timestamp. */
function nowInVietnam(): string {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(new Date());
  return parts.replace(" ", "T");
}

/**
 * Records and reads events. It checks what the database cannot: the contract is running, the actor
 * is a party of that contract, and a dispute is closed by pointing at its opening event. Whether an
 * event counts as evidence (right party, right status, duplicates) is the engine's call.
 */
@Injectable()
export class EventService {
  constructor(
    private readonly events: EventRepository,
    private readonly milestones: MilestoneRepository,
    private readonly dataSource: DataSource,
  ) {}

  getEvent(eventId: string): Promise<Event> {
    return this.events.findById(eventId);
  }

  async listByMilestone(milestoneId: string): Promise<Event[]> {
    await this.milestones.findById(milestoneId);
    return this.events.listByMilestone(milestoneId);
  }

  async record(dto: CreateEventDto): Promise<Event> {
    return this.dataSource.transaction(async (db) => {
      const milestone = await this.milestones.findById(dto.milestoneId, db);
      const contract = await db.getRepository(Contract).findOneByOrFail({ contractId: milestone.contractId });
      if (contract.lifecycle !== "ACTIVE")
        throw new ConflictException(`Contract ${contract.contractId} is ${contract.lifecycle}; events are recorded only while it is ACTIVE`);
      await this.assertPartyOfContract(dto.actorPartyId, contract, db);
      const type = await db.getRepository(EventType).findOneBy({ code: dto.eventType });
      if (!type || !type.active) throw new BadRequestException(`Event type ${dto.eventType} is not in the catalogue or not active`);
      const timestamp = dto.eventTimestamp ?? nowInVietnam();
      if (dto.eventType === "DISPUTE_RESOLVED") await this.assertClosesOpenDispute(dto, timestamp, db);
      else if (dto.referenceEventId) throw new BadRequestException("referenceEventId is only for DISPUTE_RESOLVED");

      return this.events.create(
        {
          ...dto,
          eventId: await nextCode(db, "events", "event_id", "EV", 5),
          eventTimestamp: timestamp,
          eventSource: dto.eventSource ?? "PORTAL",
          referenceEventId: dto.referenceEventId ?? null,
          eventNote: dto.eventNote ?? "",
        },
        db,
      );
    });
  }

  /** The actor is the buyer, the supplier, or one of the buyer's approvers. */
  private async assertPartyOfContract(partyId: string, contract: Contract, db: EntityManager): Promise<void> {
    const party = await db.getRepository(Party).findOneBy({ partyId });
    if (!party) throw new BadRequestException(`Party ${partyId} does not exist`);
    const ofContract =
      partyId === contract.buyerId || partyId === contract.supplierId || party.parentPartyId === contract.buyerId;
    if (!ofContract) throw new BadRequestException(`${partyId} is not a party of contract ${contract.contractId}`);
    if (party.status !== "ACTIVE") throw new BadRequestException(`${partyId} is not active`);
  }

  /** Closing a dispute points at a DISPUTE_OPENED of the same milestone, not later, not already closed. */
  private async assertClosesOpenDispute(dto: CreateEventDto, timestamp: string, db: EntityManager): Promise<void> {
    if (!dto.referenceEventId) throw new BadRequestException("DISPUTE_RESOLVED needs referenceEventId (the DISPUTE_OPENED event)");
    const opened = await this.events.findByIdOptional(dto.referenceEventId, db);
    if (!opened || opened.eventType !== "DISPUTE_OPENED" || opened.milestoneId !== dto.milestoneId)
      throw new BadRequestException(`${dto.referenceEventId} is not a DISPUTE_OPENED of milestone ${dto.milestoneId}`);
    if (opened.eventTimestamp > timestamp) throw new BadRequestException("A dispute cannot be resolved before it was opened");
    if (await this.events.exists({ referenceEventId: opened.eventId }, db))
      throw new ConflictException(`Dispute ${opened.eventId} is already resolved`);
  }
}
