import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const app = await NestFactory.create(AppModule);
await app.listen(config.PORT);
