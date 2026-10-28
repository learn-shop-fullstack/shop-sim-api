import { Body, Controller, Get, Module, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, type AuthSession } from './auth.guard';

@Controller('echo')
class EchoController {
  // Better Auth 핸들러 뒤에 다시 건 JSON 파서가 Nest 라우트에서 동작하는지 확인한다
  @Post()
  echo(@Body() body: unknown) {
    return { received: body };
  }
}

@Controller('me')
@UseGuards(AuthGuard)
class MeController {
  @Get()
  me(@Req() req: { authSession: AuthSession }) {
    return { userId: req.authSession.user.id, email: req.authSession.user.email };
  }
}

@Module({ controllers: [EchoController, MeController] })
export class AppModule {}
