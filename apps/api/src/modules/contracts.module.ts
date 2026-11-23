import { Module } from "@nestjs/common";
import { ContractsController, MilestonesController } from "../api/v1/contracts.controller";
import { ContractRepository, MilestoneRepository } from "../repositories/contract.repository";
import { ContractService } from "../services/contract.service";
import { ContractTypesModule } from "./contract-types.module";
import { PartiesModule } from "./parties.module";
import { RulesModule } from "./rules.module";

/** Contracts and their milestones. */
@Module({
  imports: [ContractTypesModule, PartiesModule, RulesModule],
  controllers: [ContractsController, MilestonesController],
  providers: [ContractService, ContractRepository, MilestoneRepository],
})
export class ContractsModule {}
