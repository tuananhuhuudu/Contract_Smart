import { Controller, Get, Query } from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiExcludeController } from "@nestjs/swagger";
import type { HelloResponse } from "../../schemas/hello.schema";
import { HelloService } from "../../services/hello.service";

/** Layer 1, HTTP (like api_*.py): reads the request, calls the service, returns the result. */
@ApiExcludeController()
@Controller("hello")
export class HelloController {
  constructor(private readonly service: HelloService) {}

  // GET /api/v1/hello?name=An
  @Get()
  @ApiOperation({ summary: "Chào và trả về giờ hiện tại của PostgreSQL (kiểm tra kết nối CSDL)" })
  @ApiQuery({ name: "name", required: false, example: "An" })
  hello(@Query("name") name?: string): Promise<HelloResponse> {
    return this.service.greet(name?.trim() || "bạn");
  }
}
