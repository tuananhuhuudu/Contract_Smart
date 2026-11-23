import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { DataSource, type DeepPartial, type EntityManager, type Repository } from "typeorm";
import type { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";
import { ContractTypeStage } from "../models/contract-type-stage.entity";

/**
 * Stages have a two-column key (contract type, sequence), so this repository does not extend
 * BaseRepository; it follows the same rules: optional transaction `db`, version checks, 404/409.
 */
@Injectable()
export class ContractTypeStageRepository {
  constructor(private readonly dataSource: DataSource) {}

  private repo(db?: EntityManager): Repository<ContractTypeStage> {
    return (db ?? this.dataSource.manager).getRepository(ContractTypeStage);
  }

  /** The template of one contract type, in order. */
  listByType(contractType: string, db?: EntityManager): Promise<ContractTypeStage[]> {
    return this.repo(db).find({ where: { contractType }, order: { sequence: "ASC" } });
  }

  async findOne(contractType: string, sequence: number, db?: EntityManager): Promise<ContractTypeStage> {
    const stage = await this.repo(db).findOneBy({ contractType, sequence });
    if (!stage) throw new NotFoundException(`Stage ${sequence} of ${contractType} not found`);
    return stage;
  }

  /** Inserts a new stage; an existing (type, sequence) is a 409, never an overwrite. */
  async create(data: DeepPartial<ContractTypeStage>, db?: EntityManager): Promise<ContractTypeStage> {
    const repo = this.repo(db);
    const stage = repo.create(data);
    await repo.insert(stage as QueryDeepPartialEntity<ContractTypeStage>);
    return this.findOne(stage.contractType, stage.sequence, db); // as stored, not as sent
  }

  async update(
    contractType: string,
    sequence: number,
    expectedVersion: number,
    data: Partial<ContractTypeStage>,
    db?: EntityManager,
  ): Promise<ContractTypeStage> {
    const { affected } = await this.repo(db).update(
      { contractType, sequence, version: expectedVersion },
      data as QueryDeepPartialEntity<ContractTypeStage>,
    );
    if (!affected) {
      await this.findOne(contractType, sequence, db); // 404 if missing
      throw new ConflictException("VERSION_CONFLICT: the record was changed by someone else; reload and retry");
    }
    return this.findOne(contractType, sequence, db);
  }

  /** Stages are a template, so they may be removed; existing milestones keep their copy. */
  async delete(contractType: string, sequence: number, expectedVersion: number, db?: EntityManager): Promise<void> {
    const { affected } = await this.repo(db).delete({ contractType, sequence, version: expectedVersion });
    if (!affected) {
      await this.findOne(contractType, sequence, db);
      throw new ConflictException("VERSION_CONFLICT: the record was changed by someone else; reload and retry");
    }
  }
}
