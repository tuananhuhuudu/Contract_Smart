import { Module } from "@nestjs/common";
import {
  MilestoneLibraryController,
  MilestoneVersionsController,
  PaymentRulesController,
} from "../api/v1/milestone-library.controller";
import {
  MilestoneLibraryRepository,
  MilestoneVersionRepository,
  PaymentRuleRepository,
} from "../repositories/milestone-library.repository";
import { MilestoneLibraryService } from "../services/milestone-library.service";

/** Milestone library: milestones, their versions and payment rules. */
@Module({
  controllers: [MilestoneLibraryController, MilestoneVersionsController, PaymentRulesController],
  providers: [MilestoneLibraryService, MilestoneLibraryRepository, MilestoneVersionRepository, PaymentRuleRepository],
  exports: [MilestoneLibraryService, MilestoneVersionRepository],
})
export class MilestoneLibraryModule {}
