import { Body, Controller, Module, Post } from '@nestjs/common';

@Controller('echo')
class EchoController {
  // Better Auth 핸들러 뒤에 다시 건 JSON 파서가 Nest 라우트에서 동작하는지 확인한다
  @Post()
  echo(@Body() body: unknown) {
    return { received: body };
  }
}

@Module({ controllers: [EchoController] })
export class AppModule {}
