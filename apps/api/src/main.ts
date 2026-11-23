import "./core/load-env";
import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import path from "node:path";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { API_TAGS } from "./core/api-tags";
import { AllExceptionsFilter } from "./utils/exception.filter";
import { ResponseInterceptor } from "./utils/response.interceptor";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix("api/v1");
  // Plain HTML page for trying the API by hand: http://127.0.0.1:<API_PORT>/test/
  app.useStaticAssets(path.join(process.cwd(), "public"), { prefix: "/test/" });
  // DTO validation: unknown fields are rejected (400) and query strings become typed values.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  // API docs (like FastAPI's /docs): http://127.0.0.1:<API_PORT>/api/docs
  const builder = new DocumentBuilder()
    .setTitle("Contract Smart API")
    .setDescription("Luồng: 1. danh mục, các bên → 2. thư viện mốc (phiên bản, luật) → 3. loại hợp đồng (khuôn) → 4. hợp đồng (mốc, sự kiện)")
    .setVersion("0.1.0")
    .addBearerAuth()
    // Every endpoint sends the token once you click Authorize (except login and register, which ignore it).
    .addSecurityRequirements("bearer");
  for (const [name, description] of API_TAGS) builder.addTag(name, description);
  const docs = builder.build();
  SwaggerModule.setup("api/docs", app, () => SwaggerModule.createDocument(app, docs), {
    customSiteTitle: "Contract Smart API",
    swaggerOptions: {
      docExpansion: "list", // groups open, each endpoint collapsed
      defaultModelsExpandDepth: -1, // hide the long "Schemas" section at the bottom
      tryItOutEnabled: true, // inputs editable without clicking "Try it out"
      filter: true, // search box for endpoints
      displayRequestDuration: true,
      persistAuthorization: true, // keep the JWT after a page reload
    },
  });
  await app.listen(Number(process.env.API_PORT ?? 3000), "127.0.0.1");
}

void bootstrap();
