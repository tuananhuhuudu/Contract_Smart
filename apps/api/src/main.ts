import "./core/load-env";
import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./utils/exception.filter";
import { ResponseInterceptor } from "./utils/response.interceptor";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api/v1");
  // DTO validation: unknown fields are rejected (400) and query strings become typed values.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.listen(Number(process.env.API_PORT ?? 3000), "127.0.0.1");
}

void bootstrap();
