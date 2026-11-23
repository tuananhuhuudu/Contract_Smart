import { Module } from "@nestjs/common";
import { CoreModule } from "./core/core.module";
import { ContractTypesModule } from "./modules/contract-types.module";
import { ContractsModule } from "./modules/contracts.module";
import { EventTypesModule } from "./modules/event-types.module";
import { EventsModule } from "./modules/events.module";
import { HelloModule } from "./modules/hello.module";
import { PartiesModule } from "./modules/parties.module";
import { RulesModule } from "./modules/rules.module";

/** Root module: add one line per feature module. */
@Module({ imports: [CoreModule, HelloModule, ContractTypesModule, RulesModule, PartiesModule, ContractsModule, EventTypesModule, EventsModule] })
export class AppModule {}
