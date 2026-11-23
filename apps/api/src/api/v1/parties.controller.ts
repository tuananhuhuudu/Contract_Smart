import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { PartyListQuery } from "../../schemas/party.schema";
import { PartyService } from "../../services/party.service";

@ApiTags("parties")
@Controller("parties")
export class PartiesController {
  constructor(private readonly service: PartyService) {}

  @Get()
  @ApiOperation({ summary: "Danh sách các bên (lọc theo BUYER, SUPPLIER, APPROVER)" })
  list(@Query() query: PartyListQuery) {
    return this.service.listParties(query);
  }

  @Get(":partyId")
  @ApiOperation({ summary: "Một bên" })
  get(@Param("partyId") partyId: string) {
    return this.service.getById(partyId);
  }
}
