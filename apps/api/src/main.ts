import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import type { Config } from './config.js';
import { CONFIG } from './config.module.js';

const app = await NestFactory.create(AppModule);
await app.listen(app.get<Config>(CONFIG).PORT);
