import { Injectable } from "@nestjs/common";
import { DataSource, type EntityManager } from "typeorm";
import { MilestoneLibrary } from "../models/milestone-library.entity";
import { MilestoneVersion } from "../models/milestone-version.entity";
import { PaymentRule } from "../models/payment-rule.entity";
import { BaseRepository } from "./base.repository";

@Injectable()
export class MilestoneLibraryRepository extends BaseRepository<MilestoneLibrary, "id"> {
  protected readonly entity = MilestoneLibrary;
  protected readonly idField = "id";
  protected readonly sortableFields = ["id", "name"] as const;
  protected readonly defaultSort = "id";

  constructor(dataSource: DataSource) {
    super(dataSource);
  }
}

@Injectable()
export class MilestoneVersionRepository extends BaseRepository<MilestoneVersion, "id"> {
  protected readonly entity = MilestoneVersion;
  protected readonly idField = "id";
  protected readonly sortableFields = ["id", "versionNo"] as const;
  protected readonly defaultSort = "id";

  constructor(dataSource: DataSource) {
    super(dataSource);
  }

  /** Shared versions of a milestone, oldest first (custom versions belong to contracts and are left out). */
  listShared(milestoneId: number, db?: EntityManager): Promise<MilestoneVersion[]> {
    return this.repo(db).find({ where: { milestoneId, isCustom: false }, order: { versionNo: "ASC" } });
  }

  findPublished(milestoneId: number, db?: EntityManager): Promise<MilestoneVersion | null> {
    return this.repo(db).findOne({ where: { milestoneId, isCustom: false, status: "PUBLISHED" } });
  }
}

@Injectable()
export class PaymentRuleRepository extends BaseRepository<PaymentRule, "id"> {
  protected readonly entity = PaymentRule;
  protected readonly idField = "id";
  protected readonly sortableFields = ["id", "priority"] as const;
  protected readonly defaultSort = "priority";
  // Rules of a draft can be removed; the database refuses it once the version is published.
  protected override readonly allowDelete = true;

  constructor(dataSource: DataSource) {
    super(dataSource);
  }

  listByVersion(milestoneVersionId: number, db?: EntityManager): Promise<PaymentRule[]> {
    return this.repo(db).find({ where: { milestoneVersionId }, order: { priority: "ASC" } });
  }
}
