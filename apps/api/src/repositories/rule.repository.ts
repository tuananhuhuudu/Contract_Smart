import { Injectable } from "@nestjs/common";
import { DataSource, type EntityManager } from "typeorm";
import { PaymentRule } from "../models/payment-rule.entity";
import { RuleScope } from "../models/rule-scope.entity";
import { RuleVersion } from "../models/rule-version.entity";
import { BaseRepository } from "./base.repository";

@Injectable()
export class RuleScopeRepository extends BaseRepository<RuleScope, "releaseRuleCode"> {
  protected readonly entity = RuleScope;
  protected readonly idField = "releaseRuleCode";
  protected readonly sortableFields = ["releaseRuleCode", "contractType", "milestoneType"] as const;
  protected readonly defaultSort = "releaseRuleCode";

  constructor(dataSource: DataSource) {
    super(dataSource);
  }
}

@Injectable()
export class RuleVersionRepository extends BaseRepository<RuleVersion, "id"> {
  protected readonly entity = RuleVersion;
  protected readonly idField = "id";
  protected readonly sortableFields = ["id", "status", "publishedAt", "createdAt"] as const;
  protected readonly defaultSort = "createdAt";

  constructor(dataSource: DataSource) {
    super(dataSource);
  }

  /** The version new contracts use: the most recently published one, or null. */
  findCurrent(db?: EntityManager): Promise<RuleVersion | null> {
    return this.repo(db).findOne({ where: { status: "PUBLISHED" }, order: { publishedAt: "DESC" } });
  }
}

@Injectable()
export class PaymentRuleRepository extends BaseRepository<PaymentRule, "ruleId"> {
  protected readonly entity = PaymentRule;
  protected readonly idField = "ruleId";
  protected readonly sortableFields = ["ruleId", "releaseRuleCode", "priority"] as const;
  protected readonly defaultSort = "priority";
  // Rules of a DRAFT version may be removed; the database refuses it for published versions.
  protected override readonly allowDelete = true;

  constructor(dataSource: DataSource) {
    super(dataSource);
  }

  /** All rules of one version, grouped by rule set and in evaluation order. */
  listByVersion(ruleVersionId: string, db?: EntityManager): Promise<PaymentRule[]> {
    return this.repo(db).find({ where: { ruleVersionId }, order: { releaseRuleCode: "ASC", priority: "ASC" } });
  }
}
