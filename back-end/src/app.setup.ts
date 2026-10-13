import { type INestApplication, ValidationPipe, type ValidationError } from '@nestjs/common';
import { problem } from './common/http/problem.js';
import type { FieldError } from './common/http/problems.js';
import { requestId } from './common/http/request-id.js';
import { requestLog } from './common/http/request-log.js';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/** main.ts와 테스트가 같은 설정을 쓰도록 한곳에 모은다 */
export function configureApp(app: INestApplication): INestApplication {
  app.use(requestId);
  app.use(requestLog);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true, // 모르는 필드는 거절한다 (docs/2-design/api.md)
      transform: true,
      // 어느 입력이 틀렸는지 화면이 표시할 수 있도록 { field, message } 목록으로 돌려준다
      exceptionFactory: (errors) => problem('validation', undefined, toFieldErrors(errors)),
    }),
  );
  app.enableShutdownHooks();

  const doc = new DocumentBuilder()
    .setTitle('Restella API')
    .setDescription('여러 채널에 동시에 판매하는 소형 숙소를 위한 단일 재고 원장')
    .setVersion('1')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, () => SwaggerModule.createDocument(app, doc));
  return app;
}

/** class-validator 오류 트리를 평평한 목록으로. 중첩 필드는 점으로 잇는다 */
export function toFieldErrors(errors: ValidationError[], parent = ''): FieldError[] {
  return errors.flatMap((e) => {
    const field = parent ? `${parent}.${e.property}` : e.property;
    return [...Object.values(e.constraints ?? {}).map((message) => ({ field, message })), ...toFieldErrors(e.children ?? [], field)];
  });
}
