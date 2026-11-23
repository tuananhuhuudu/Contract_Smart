import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { ListQueryDto } from "../../schemas/base.schema";
import { VersionedDto } from "../../schemas/common.schema";
import {
  CreatePaymentRuleDto,
  CreateRuleScopeDto,
  CreateRuleVersionDto,
  PaymentRuleListQuery,
  RuleScopeListQuery,
  UpdatePaymentRuleDto,
  UpdateRuleScopeDto,
} from "../../schemas/rule.schema";
import { RuleService } from "../../services/rule.service";

@ApiTags("rule-scopes")
@Controller("rule-scopes")
export class RuleScopesController {
  constructor(private readonly service: RuleService) {}

  @Get()
  @ApiOperation({ summary: "Danh sách bộ luật (lọc theo loại hợp đồng)" })
  list(@Query() query: RuleScopeListQuery) {
    return this.service.listScopes(query);
  }

  @Get(":code")
  @ApiOperation({ summary: "Một bộ luật" })
  get(@Param("code") code: string) {
    return this.service.getScope(code);
  }

  @Post()
  @ApiOperation({ summary: "Tạo bộ luật cho một loại mốc" })
  create(@Body() dto: CreateRuleScopeDto) {
    return this.service.createScope(dto);
  }

  @Patch(":code")
  @ApiOperation({ summary: "Đổi tên bộ luật (gửi kèm version)" })
  rename(@Param("code") code: string, @Body() dto: UpdateRuleScopeDto) {
    return this.service.renameScope(code, dto.version, dto.name);
  }
}

@ApiTags("rule-versions")
@Controller("rule-versions")
export class RuleVersionsController {
  constructor(private readonly service: RuleService) {}

  @Get()
  @ApiOperation({ summary: "Danh sách phiên bản luật" })
  list(@Query() query: ListQueryDto) {
    return this.service.listVersions(query);
  }

  @Get("current")
  @ApiOperation({ summary: "Phiên bản đang dùng cho hợp đồng mới" })
  current() {
    return this.service.currentVersion();
  }

  @Get(":id")
  @ApiOperation({ summary: "Một phiên bản luật kèm số luật" })
  get(@Param("id") id: string) {
    return this.service.getVersion(id);
  }

  @Post()
  @ApiOperation({ summary: "Tạo phiên bản nháp, mặc định chép luật từ phiên bản đang dùng" })
  create(@Body() dto: CreateRuleVersionDto) {
    return this.service.createVersion(dto);
  }

  @Post(":id/publish")
  @ApiOperation({ summary: "Công bố phiên bản nháp (kiểm tra đủ luật, khóa luật lại)" })
  publish(@Param("id") id: string, @Body() dto: VersionedDto) {
    return this.service.publishVersion(id, dto.version);
  }
}

@ApiTags("payment-rules")
@Controller("payment-rules")
export class PaymentRulesController {
  constructor(private readonly service: RuleService) {}

  @Get()
  @ApiOperation({ summary: "Danh sách luật (lọc theo phiên bản, bộ luật; mặc định theo priority)" })
  list(@Query() query: PaymentRuleListQuery) {
    return this.service.listRules(query);
  }

  @Get(":ruleId")
  @ApiOperation({ summary: "Một luật" })
  get(@Param("ruleId") ruleId: string) {
    return this.service.getRule(ruleId);
  }

  @Post()
  @ApiOperation({ summary: "Thêm luật vào phiên bản nháp" })
  create(@Body() dto: CreatePaymentRuleDto) {
    return this.service.createRule(dto);
  }

  @Patch(":ruleId")
  @ApiOperation({ summary: "Sửa luật của phiên bản nháp (gửi kèm version)" })
  update(@Param("ruleId") ruleId: string, @Body() dto: UpdatePaymentRuleDto) {
    return this.service.updateRule(ruleId, dto);
  }

  @Delete(":ruleId")
  @HttpCode(204)
  @ApiOperation({ summary: "Xóa luật của phiên bản nháp (?version=)" })
  remove(@Param("ruleId") ruleId: string, @Query() { version }: VersionedDto) {
    return this.service.removeRule(ruleId, version);
  }
}
