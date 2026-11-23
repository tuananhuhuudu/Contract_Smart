import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { ContractListQuery, CreateContractDto } from "../../schemas/contract.schema";
import { ContractService } from "../../services/contract.service";

@ApiTags("contracts")
@Controller("contracts")
export class ContractsController {
  constructor(private readonly service: ContractService) {}

  @Get()
  @ApiOperation({ summary: "Danh sách hợp đồng (lọc theo loại, vòng đời, bên mua, nhà cung cấp)" })
  list(@Query() query: ContractListQuery) {
    return this.service.listContracts(query);
  }

  @Get(":contractId")
  @ApiOperation({ summary: "Một hợp đồng kèm loại, hai bên, phiên bản luật và các mốc" })
  get(@Param("contractId") contractId: string) {
    return this.service.getDetail(contractId);
  }

  @Get(":contractId/milestones")
  @ApiOperation({ summary: "Các mốc của hợp đồng" })
  milestones(@Param("contractId") contractId: string) {
    return this.service.listMilestones(contractId);
  }

  @Post()
  @ApiOperation({ summary: "Tạo hợp đồng nháp; các mốc được sinh tự động từ khuôn của loại hợp đồng" })
  create(@Body() dto: CreateContractDto) {
    return this.service.createContract(dto);
  }
}

@ApiTags("milestones")
@Controller("milestones")
export class MilestonesController {
  constructor(private readonly service: ContractService) {}

  @Get(":milestoneId")
  @ApiOperation({ summary: "Một mốc thanh toán" })
  get(@Param("milestoneId") milestoneId: string) {
    return this.service.getMilestone(milestoneId);
  }
}
