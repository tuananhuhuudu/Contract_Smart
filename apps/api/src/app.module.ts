import { Module } from "@nestjs/common";
import { CoreModule } from "./core/core.module";
import { EventTypesModule } from "./modules/event-types.module";
import { HelloModule } from "./modules/hello.module";
import { MilestoneLibraryModule } from "./modules/milestone-library.module";
import { PartiesModule } from "./modules/parties.module";

/** Root module: add one line per feature module. */
@Module({ imports: [CoreModule, HelloModule, EventTypesModule, PartiesModule, MilestoneLibraryModule] })
export class AppModule {}
