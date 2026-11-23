import { Module } from "@nestjs/common";
import { HelloController } from "../api/v1/hello.controller";
import { HelloRepository } from "../repositories/hello.repository";
import { HelloService } from "../services/hello.service";

/** Wires the three layers of one feature together (NestJS dependency injection). */
@Module({ controllers: [HelloController], providers: [HelloService, HelloRepository] })
export class HelloModule {}
