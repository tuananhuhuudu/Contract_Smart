import { IsIn, IsOptional, IsString, Length, Matches } from "class-validator";
import { EVENT_SOURCES, EVENT_STATUSES } from "../models/event.entity";
import { CODE, DECIMAL_2 } from "./common.schema";

/** Wall-clock date and time without a time zone: 2026-06-06T10:20:00 */
export const LOCAL_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;

/**
 * POST /events: records something that happened. actorPartyId is taken from the request until
 * sign-in exists; it will then be the party the signed-in user represents.
 */
export class CreateEventDto {
  /** MS0002 */
  @IsString()
  milestoneId!: string;

  /** A code of the event type catalogue (GET /event-types), for example INVOICE. */
  @Matches(CODE)
  eventType!: string;

  @IsIn(EVENT_STATUSES)
  eventStatus!: (typeof EVENT_STATUSES)[number];

  /** S021 */
  @IsString()
  actorPartyId!: string;

  /** Default: now, Vietnam time. */
  @IsOptional()
  @Matches(LOCAL_DATE_TIME)
  eventTimestamp?: string;

  @IsOptional()
  @IsIn(EVENT_SOURCES)
  eventSource?: (typeof EVENT_SOURCES)[number];

  /** INV-CT0001-02 */
  @IsOptional()
  @IsString()
  @Length(1, 100)
  documentId?: string;

  /** "516.00" */
  @IsOptional()
  @Matches(DECIMAL_2)
  amountVndMn?: string;

  /** Only for DISPUTE_RESOLVED: the DISPUTE_OPENED event it closes. */
  @IsOptional()
  @IsString()
  referenceEventId?: string;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  eventNote?: string;
}
