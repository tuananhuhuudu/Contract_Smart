import { Controller, Get, Query } from "@nestjs/common";
import type { HelloResponse } from "../../schemas/hello.schema";
import { HelloService } from "../../services/hello.service";

/** Layer 1, HTTP (like api_*.py): reads the request, calls the service, returns the result. */
@Controller("hello")
export class HelloController {
  constructor(private readonly service: HelloService) {}

  // GET /api/v1/hello?name=An
  @Get()
  hello(@Query("name") name?: string): Promise<HelloResponse> {
    return this.service.greet(name?.trim() || "bạn");
  }
}
