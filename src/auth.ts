import { betterAuth } from 'better-auth';

// B1: DB 없이 핸들러 연결만 확인한다. DB와 이메일 로그인은 B2·B3
export const auth = betterAuth({
  baseURL: 'http://localhost:3000',
  secret: process.env.BETTER_AUTH_SECRET,
});
