import { Injectable } from "@nestjs/common";
import { DataSource, type EntityManager } from "typeorm";
import { User } from "../models/user.entity";
import { BaseRepository } from "./base.repository";

@Injectable()
export class UserRepository extends BaseRepository<User, "id"> {
  protected readonly entity = User;
  protected readonly idField = "id";
  protected readonly sortableFields = ["email", "fullName", "role"] as const;
  protected readonly defaultSort = "email";

  constructor(dataSource: DataSource) {
    super(dataSource);
  }

  /** The user with its password hash, which normal reads leave out (select: false). */
  findWithPassword(email: string, db?: EntityManager): Promise<User | null> {
    return this.repo(db).createQueryBuilder("u").addSelect("u.passwordHash").where("u.email = :email", { email }).getOne();
  }
}
