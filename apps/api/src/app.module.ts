import { Module } from "@nestjs/common";
import { CoreModule } from "./core/core.module";
import { HelloModule } from "./modules/hello.module";

/** Root module: add one line per feature module. */
@Module({ imports: [CoreModule, HelloModule] })
export class AppModule {}
