import { Module } from "@nestjs/common";
import { ContractTypesController } from "../api/v1/contract-types.controller";
import { ContractTypeStageRepository } from "../repositories/contract-type-stage.repository";
import { ContractTypeRepository } from "../repositories/contract-type.repository";
import { ContractTypeService } from "../services/contract-type.service";

/** Contract types and their stage templates. */
@Module({
  controllers: [ContractTypesController],
  providers: [ContractTypeService, ContractTypeRepository, ContractTypeStageRepository],
  exports: [ContractTypeRepository, ContractTypeStageRepository],
})
export class ContractTypesModule {}
