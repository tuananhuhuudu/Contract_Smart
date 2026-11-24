import { Controller, Get, NotFoundException, Param, ParseIntPipe, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { DataSource } from "typeorm";
import { TAG } from "../../core/api-tags";
import { assertCanSee } from "../../core/security/access";
import { CurrentUser, type AuthUser } from "../../core/security/decorators";
import { Contract } from "../../models/contract.entity";
import { Milestone } from "../../models/milestone.entity";
import { PaymentRule } from "../../models/payment-rule.entity";
import { EngineService } from "../../services/engine.service";

@ApiTags(TAG.evaluations)
@Controller()
export class EvaluationsController {
  constructor(
    private readonly engine: EngineService,
    private readonly dataSource: DataSource,
  ) {}

  /** The contract of a milestone, if the user may see it. */
  private async contractOf(milestoneId: number, user: AuthUser): Promise<Contract> {
    const milestone = await this.dataSource.getRepository(Milestone).findOne({ where: { id: milestoneId } });
    if (!milestone) throw new NotFoundException(`Milestone ${milestoneId} not found`);
    const contract = await this.dataSource.getRepository(Contract).findOneOrFail({ where: { id: milestone.contractId } });
    await assertCanSee(user, contract, this.dataSource.manager);
    return contract;
  }

  @Get("milestones/:id/evaluations")
  @ApiOperation({ summary: "Lịch sử chấm của một mốc, mới nhất trước (kèm giải thích: con số, kết quả từng luật) và bộ luật mốc đang dùng" })
  async history(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    await this.contractOf(id, user);
    const milestone = await this.dataSource.getRepository(Milestone).findOneOrFail({ where: { id } });
    // The rules are sent along so every role (also the supplier) can read the trail by rule name.
    const rules = await this.dataSource.getRepository(PaymentRule).find({
      where: { milestoneVersionId: milestone.milestoneVersionId }, order: { priority: "ASC" },
      select: { id: true, priority: true, name: true, condition: true, decision: true, reasonCode: true },
    });
    return { rules, evaluations: await this.engine.history(id) };
  }

  @Post("milestones/:id/evaluate")
  @ApiOperation({ summary: "Chấm lại một mốc ngay (hợp đồng phải ACTIVE)" })
  async evaluateMilestone(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    const contract = await this.contractOf(id, user);
    this.assertActive(contract);
    return (await this.engine.evaluateContract(contract.id, { milestoneIds: [id] }))[0];
  }

  @Post("contracts/:id/evaluate")
  @ApiOperation({ summary: "Chấm lại mọi mốc của hợp đồng (hợp đồng phải ACTIVE)" })
  async evaluateContract(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    const contract = await this.dataSource.getRepository(Contract).findOne({ where: { id } });
    if (!contract) throw new NotFoundException(`Contract ${id} not found`);
    await assertCanSee(user, contract, this.dataSource.manager);
    this.assertActive(contract);
    return this.engine.evaluateContract(id);
  }

  private assertActive(contract: Contract): void {
    if (contract.status !== "ACTIVE") throw new NotFoundException(`CONTRACT_NOT_ACTIVE: contract ${contract.id} is ${contract.status}; only active contracts are evaluated`);
  }
}
