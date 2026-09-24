import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { startEmbeddedPostgres } from './embedded/embedded-pg';
import { loadEnvFile } from './common/env';

loadEnvFile();

async function bootstrap() {
  await startEmbeddedPostgres();

  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.setGlobalPrefix('api');

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API listening on http://127.0.0.1:${port}/api`);
}
bootstrap();
