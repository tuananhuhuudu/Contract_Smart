import { Injectable } from "@nestjs/common";
import { HelloRepository } from "../repositories/hello.repository";
import type { HelloResponse } from "../schemas/hello.schema";

/** Layer 2, business logic (like srv_*.py): builds the answer, asks the repository for data. */
@Injectable()
export class HelloService {
  constructor(private readonly repository: HelloRepository) {}

  async greet(name: string): Promise<HelloResponse> {
    const databaseTime = await this.repository.now();
    return { message: `Xin chào ${name}!`, databaseTime: databaseTime.toISOString() };
  }
}
