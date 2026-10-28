import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request } from 'express';
import { auth } from './auth';

export type AuthSession = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;

// 요청 쿠키로 세션을 조회해 req.authSession에 붙인다. 세션이 없으면 401
@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { authSession?: AuthSession }>();
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session) throw new UnauthorizedException();
    req.authSession = session;
    return true;
  }
}
