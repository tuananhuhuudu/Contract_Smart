import { Controller, Get, Param, ParseIntPipe, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { TAG } from "../../core/api-tags";
import { PartyListQuery } from "../../schemas/party.schema";
import { PartyService } from "../../services/party.service";

@ApiTags(TAG.parties)
@Controller("parties")
export class PartiesController {
  constructor(private readonly service: PartyService) {}

  @Get()
  @ApiOperation({ summary: "Danh sách các bên (lọc theo BUYER, SUPPLIER, APPROVER)" })
  list(@Query() query: PartyListQuery) {
    return this.service.listParties(query);
  }

  @Get(":id")
  @ApiOperation({ summary: "Một bên" })
  get(@Param("id", ParseIntPipe) id: number) {
    return this.service.getById(id);
  }
}
