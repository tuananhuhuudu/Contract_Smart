import { Module } from "@nestjs/common";
import { ContractTypeMilestonesController, ContractTypesController } from "../api/v1/contract-types.controller";
import { ContractTypeMilestoneRepository, ContractTypeRepository } from "../repositories/contract-type.repository";
import { MilestoneLibraryRepository, MilestoneVersionRepository } from "../repositories/milestone-library.repository";
import { ContractTypeService } from "../services/contract-type.service";

/** Contract types and their templates built from the milestone library. */
@Module({
  controllers: [ContractTypesController, ContractTypeMilestonesController],
  providers: [ContractTypeService, ContractTypeRepository, ContractTypeMilestoneRepository, MilestoneLibraryRepository, MilestoneVersionRepository],
  exports: [ContractTypeService],
})
export class ContractTypesModule {}
