import { Global, Module } from "@nestjs/common";
import { AuditController } from "../api/v1/audit.controller";
import { AuditService } from "../services/audit.service";

/** Audit log: global, because every module writes to it. */
@Global()
@Module({ controllers: [AuditController], providers: [AuditService], exports: [AuditService] })
export class AuditModule {}
