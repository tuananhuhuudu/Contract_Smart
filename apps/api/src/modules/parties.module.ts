import { Module } from "@nestjs/common";
import { PartiesController } from "../api/v1/parties.controller";
import { PartyRepository } from "../repositories/party.repository";
import { PartyService } from "../services/party.service";

/** Buyers, suppliers and approvers (read-only in the API; loaded by the seed script). */
@Module({
  controllers: [PartiesController],
  providers: [PartyService, PartyRepository],
  exports: [PartyRepository],
})
export class PartiesModule {}
