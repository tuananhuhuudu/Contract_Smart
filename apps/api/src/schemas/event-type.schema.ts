import { Transform, Type } from "class-transformer";
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Length, Min, ValidateIf } from "class-validator";
import { ACTOR_SIDES, EVENT_CATEGORIES } from "../models/event-type.entity";
import { ListQueryDto } from "./base.schema";

/** POST /event-types */
export class CreateEventTypeDto {
  /** Hoàn thành đào tạo */
  @IsString()
  @Length(1, 200)
  name!: string;

  @IsIn(EVENT_CATEGORIES)
  category!: (typeof EVENT_CATEGORIES)[number];

  /** Required for EVIDENCE: who records it. */
  @ValidateIf((dto: CreateEventTypeDto) => dto.category === "EVIDENCE")
  @IsIn(ACTOR_SIDES)
  actorSide?: (typeof ACTOR_SIDES)[number];
}

/** PATCH /event-types/:id: name and on/off only; category and side are used by events and the engine. */
export class UpdateEventTypeDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  name?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

/** GET /event-types?category=EVIDENCE&active=true */
export class EventTypeListQuery extends ListQueryDto {
  @IsOptional()
  @IsIn(EVENT_CATEGORIES)
  category?: (typeof EVENT_CATEGORIES)[number];

  @IsOptional()
  @Transform(({ value }) => (value === "true" ? true : value === "false" ? false : value))
  @IsBoolean()
  active?: boolean;
}
