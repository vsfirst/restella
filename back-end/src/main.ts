import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';

// rawBody: 채널 웹훅의 HMAC 서명은 파싱 전 원본 본문으로 검증한다
const app = configureApp(await NestFactory.create(AppModule, { rawBody: true }));
await app.listen(Number(process.env.PORT ?? 3000));
