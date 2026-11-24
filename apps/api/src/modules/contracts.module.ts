import { Module } from "@nestjs/common";
import { ContractsController, EventsController, MilestonesController } from "../api/v1/contracts.controller";
import { EvaluationsController } from "../api/v1/evaluations.controller";
import { PaymentsController } from "../api/v1/payments.controller";
import { ContractRepository, MilestoneRepository } from "../repositories/contract.repository";
import { ContractTypeMilestoneRepository, ContractTypeRepository } from "../repositories/contract-type.repository";
import { EventRepository } from "../repositories/event.repository";
import { MilestoneLibraryRepository, MilestoneVersionRepository, PaymentRuleRepository } from "../repositories/milestone-library.repository";
import { ContractService } from "../services/contract.service";
import { EngineService } from "../services/engine.service";
import { EventService } from "../services/event.service";
import { PaymentService } from "../services/payment.service";
import { MilestoneLibraryModule } from "./milestone-library.module";

/** Contracts, their real milestones and the events recorded on them. */
@Module({
  imports: [MilestoneLibraryModule],
  controllers: [ContractsController, MilestonesController, EventsController, EvaluationsController, PaymentsController],
  providers: [
    ContractService, EventService, EngineService, PaymentService, ContractRepository, MilestoneRepository, EventRepository,
    ContractTypeRepository, ContractTypeMilestoneRepository, MilestoneLibraryRepository, MilestoneVersionRepository, PaymentRuleRepository,
  ],
})
export class ContractsModule {}
