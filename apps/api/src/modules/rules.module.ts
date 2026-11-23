import { Module } from "@nestjs/common";
import { PaymentRulesController, RuleScopesController, RuleVersionsController } from "../api/v1/rules.controller";
import { PaymentRuleRepository, RuleScopeRepository, RuleVersionRepository } from "../repositories/rule.repository";
import { RuleService } from "../services/rule.service";

/** Rule sets, rule versions and payment rules. */
@Module({
  controllers: [RuleScopesController, RuleVersionsController, PaymentRulesController],
  providers: [RuleService, RuleScopeRepository, RuleVersionRepository, PaymentRuleRepository],
  exports: [RuleVersionRepository, RuleScopeRepository],
})
export class RulesModule {}
