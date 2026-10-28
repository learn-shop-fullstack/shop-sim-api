import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request } from 'express';
import { adminAuth, auth } from './auth';

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

export type AdminSession = NonNullable<Awaited<ReturnType<typeof adminAuth.api.getSession>>>;

// 운영자 세션만 통과시킨다. 일반 계정 쿠키로는 통과할 수 없다
@Injectable()
export class AdminGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { adminSession?: AdminSession }>();
    const session = await adminAuth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session) throw new UnauthorizedException();
    req.adminSession = session;
    return true;
  }
}
