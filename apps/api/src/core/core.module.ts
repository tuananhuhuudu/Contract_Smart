import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { databaseOptions } from "./data-source";

/** Opens the database connection; the DataSource is then injectable in every repository. */
@Module({ imports: [TypeOrmModule.forRoot(databaseOptions)] })
export class CoreModule {}
