# shop-sim-api — 마켓플레이스 백엔드

멀티 판매자 마켓플레이스 **shop-sim**의 백엔드 레포. 회사에서 일한다고 가정하고 진행하는 학습 프로젝트다.

공통 문서 (`../.github/handbook/`):
- 작업 방식: @../.github/handbook/working-agreement.md
- 시스템 구성·계약·도메인 모델·배포 환경: `../.github/handbook/architecture.md`
- 작업 목록: `../.github/handbook/ROADMAP.md`의 `[api]`, `[both]` 항목
- 결정 근거: `../.github/handbook/adr/`

## 이 레포의 책임

Nest CLI 모노레포 모드로 두 앱을 관리한다.

```
apps/
  api/        # 모듈러 모놀리스 (HTTP, SSE, WebSocket 게이트웨이)
  worker/     # 아웃박스 릴레이, Kafka 컨슈머, 기한 스윕, 배치
openapi/      # HTTP 계약 (YAML 원본, 손으로 작성·리뷰)
asyncapi/     # Kafka 이벤트 계약 (YAML 원본)
db/
  schema/     # Drizzle 스키마
  migrations/ # drizzle-kit이 생성한 SQL (리뷰 후 커밋)
scripts/
  seed/       # ABO 데이터셋 임포트 (실제 업로드 API 흐름을 그대로 탄다)
```

- `api` 모듈: user, auth, seller, catalog, search, inventory, order, payment, coupon, shipment, notification, chat, support, review, settlement, analytics, forecast, admin, audit
- `worker` 역할: 아웃박스 → Kafka 릴레이, 컨슈머 그룹(검색 색인, 알림, 분석 등), 기한 스윕(결제 타임아웃·예약 발행), 이미지 리사이즈, 물류 대사 폴링, 일 배치(유효기한 임박, 판매 집계, 수요 예측, LLM 리뷰 요약), 월 배치(정산)

**이 레포에 없는 것**: 로컬 인프라 compose·배포 설정(`shop-sim-infra`), 모의 PG·모의 택배사(`shop-sim-vendor`), 시뮬레이터·부하 테스트(`shop-sim-loadtest`).

## 레포 규칙

### 계약
- **API·이벤트 변경은 항상 스펙 수정부터.** `openapi/` 또는 `asyncapi/` 변경 → 코드 생성 → 구현. 구현을 먼저 하고 스펙을 맞추지 않는다.
- 스펙도 작업 방식대로 Claude가 엔드포인트·이벤트 단위로 작성하고 내가 리뷰한다. 리뷰 가이드에 네이밍·에러 응답 일관성, 하위 호환 영향, 소비자(web, loadtest, 내부 컨슈머) 영향을 포함한다.
- 생성된 코드는 수정하지 않는다.
- 벤더(모의 PG, 택배사)는 `shop-sim-vendor`가 공개한 스펙 패키지로만 연동한다. 벤더 코드를 참고하거나 import하지 않는다.

### 모듈 경계
- 모듈 간 호출은 각 모듈의 공개 서비스 인터페이스 또는 이벤트로만 한다. 다른 모듈의 리포지토리·테이블을 직접 읽지 않는다 (lint 규칙으로 강제).
  - 모듈이 둘 이상 생기면 `.oxlintrc.json`에 `no-restricted-imports`의 `group` 패턴(`["../*/*", "!../*/index.js"]`)으로 건다. `regex`의 lookahead는 지원되지 않고 경고 없이 무시되므로, 규칙을 넣으면 위반 예시로 실패하는지 확인한다 (#24)
- `worker`는 `api`의 모듈을 재사용하되, HTTP 계층은 쓰지 않는다.

### 데이터
- 마이그레이션은 `drizzle-kit generate`로 만든 SQL을 리뷰·커밋하고 적용한다. `push`는 로컬 실험에만.
  - `db/migrations/meta/`(스냅샷·저널)도 함께 커밋한다. 다음 `generate`가 이 스냅샷과 비교한다
  - 마이그레이션 PR은 머지 직전에 main을 rebase하고 `generate`를 다시 실행한다. 마이그레이터는 마지막 적용 시각보다 나중에 생성된 것만 적용해서, 먼저 만든 마이그레이션이 나중에 머지되면 조용히 건너뛴다 (POC #3)
  - 미적용 마이그레이션은 한 트랜잭션으로 실행된다. `CREATE INDEX CONCURRENTLY`처럼 트랜잭션 밖에서만 되는 DDL은 별도 절차로 한다
- 스키마에 컬럼·제약·인덱스 이름을 직접 적는다(`timestamp('expires_at', …)`, `index('payments_status_expires_at_idx')`). 1.0에서 casing API가 바뀌어도 마이그레이션이 흔들리지 않는다
- 시각은 `timestamp(…, { withTimezone: true })`(`timestamptz`)
- 트랜잭션 경계는 서비스 계층에서 명시적으로 잡는다. 상태 변경과 아웃박스 기록은 같은 트랜잭션.

### 코드 (#24)
- ESM(`"type": "module"`, `nodenext`)이라 상대 import에 `./x.js`처럼 확장자를 붙인다
- 빌더는 `tsc`다. 모노레포 기본값 rspack은 swc로 변환하고 타입 검사를 별도 플러그인이 있을 때만 해서, 스펙 타입과 어긋나도 빌드가 통과할 수 있다
- TypeScript는 6에 고정한다. 7은 TypeScript를 라이브러리로 쓰는 도구(Nest CLI, tsgolint 등)의 지원을 확인하지 않았다
- 환경 변수는 `process.env`를 직접 읽지 않고 앱의 `config.ts`(Zod 스키마)를 거친다. 변수는 쓰는 기능이 생길 때 추가하고 `.env.example`에도 적는다
- 테스트는 소스 옆 `*.spec.ts`이고 Vitest API를 명시적으로 import한다(`globals` 끔)

### 로컬 실행
- 데이터 스택은 `../shop-sim-infra/compose/local`을 띄운다(사용법은 그 README)
- 처음 받으면 `cp .env.example .env`. 개발 스크립트(`start:*`)는 `--env-file .env`로 읽어서 파일이 없으면 시작하지 않는다
- 종료 신호를 시험할 때는 `$(mise which node) dist/apps/<앱>/main.js`로 직접 실행한다. `mise exec`는 SIGTERM을 node에 전달하지 않는다. 배포 이미지도 셸 없이 node를 PID 1로 실행한다

## 기술 결정 (요약)

| 영역 | 결정 | ADR |
|---|---|---|
| 프레임워크 | NestJS 12, 모듈러 모놀리스 | 0002, 0012 |
| 런타임·도구 | Node 26 LTS, ESM, Nest CLI 모노레포(`tsc` 빌더), Zod(설정 검증), oxlint(type-aware), Vitest | — |
| 계약 | OpenAPI 3.1 + AsyncAPI 스펙 우선, semver 패키지 배포 | 0003, 0012 |
| 이벤트 | Kafka + 아웃박스, 재시도 토픽 + DLT, 지연 처리는 DB 스윕. 봉투는 CloudEvents 1.0 binary 모드 | 0004, 0016 |
| ORM | Drizzle + drizzle-kit (0.45 안정판, 1.0 정식 출시 시 업그레이드 경로 확인) | 0005 |
| 인증 | Better Auth, DB 세션(JWT 안 씀), 운영자는 별도 인스턴스 | 0015 |
| 검색 | OpenSearch + Nori, Kafka 이벤트로 색인 | 0006 |
| 도메인 | 멀티 판매자, 한 계정이 구매자 겸 판매자 | 0007 |
| LLM | 제공자 독립 `LlmClient` 포트 | 0008 |
| 결제 | `PaymentGateway` 포트 + 토스페이먼츠(테스트) / 모의 PG 어댑터 | 0009 |

### 스펙 우선 툴체인 (ADR 0012, POC #2)
- **컴파일 타임**: Hey API `@hey-api/openapi-ts`(`@hey-api/typescript` + `nestjs` 플러그인, 0.x라 정확한 버전 고정). 태그별 `XxxControllerMethods` 타입을 생성하고 컨트롤러가 `implements Pick<...>`로 구현 → 스펙과 어긋나면 빌드 실패
  - 파라미터는 객체 단위(`@Param() path`, `@Query() query`, `@Body() body`)로 받는다
  - 플러그인 문서는 Nest v11만 명시한다. 생성물이 순수 타입이라 Nest 12에서 동작하지만, Nest·플러그인 업그레이드 시 다시 확인한다
  - 생성물(`src/generated/`)은 커밋하지 않는다. `prebuild`로 빌드마다 생성한다
- **런타임 검증**: `express-openapi-validator`를 Nest 미들웨어로 전 경로에 건다. 요청·응답·`format` 검증, 응답 검증은 모든 환경에서 켠다. 실행 시 `openapi/` YAML이 필요하다(배포 이미지에 포함)
- **에러 응답**: 전역 `@Catch()` 필터가 모든 예외를 RFC 9457 `application/problem+json`으로 바꾼다. 4xx는 `detail`에 원인, 5xx는 메시지를 숨기고 로그로만. 이 필터가 없으면 검증기 오류가 전부 500이 된다
- 응답 스키마의 초과 필드는 `additionalProperties: false`가 있어야 잡힌다 → 규약은 #6
- **문서**: YAML 스펙을 Swagger UI 또는 Scalar로 그대로 서빙
- 쓰지 않는 것: DTO 클래스 + class-validator로 스키마 이중 정의, `@nestjs/swagger` 코드 우선 생성

### 이벤트 계약 (ADR 0016, POC #7)
- `asyncapi/` 메시지를 추가·변경하거나 이벤트를 발행·소비하는 코드를 쓸 때는 `asyncapi/CONVENTIONS.md`를 따른다(이름, CloudEvents 헤더, 호환성 판정표, BREAKING 절차)
- 호환성은 "생산자 닫힘 + 컨슈머 관대"로 양방향 판정한다. 필수 필드 추가·타입 넓힘·필수→선택도 BREAKING이다. BREAKING이면 기존 메시지를 고치지 않고 `V2` 메시지를 같은 채널에 추가한다
- 페이로드 호환성은 `asyncapi diff`가 판정하지 못한다(전부 `unclassified`로 통과). 호환성 스크립트로만 판정한다
- `ce_id`는 아웃박스 행 ID를 쓴다. 발행마다 새로 만들면 컨슈머 멱등 처리가 깨진다

### Kafka
- 클라이언트: `@confluentinc/kafka-javascript`를 Nest 모듈로 직접 감싼다 (연결 수명주기, 그레이스풀 셧다운, 오프셋 수동 커밋)
  - librdkafka 네이티브 바이너리를 설치 스크립트가 받는다 → `pnpm-workspace.yaml`의 `allowBuilds`에 이 패키지만 허용. 배포 이미지의 Node 메이저·libc가 릴리스의 사전 빌드 목록에 있어야 한다 (POC #4)
  - 1.11.0에는 Node 26(ABI 147) 사전 빌드가 없다. 설치가 소스 빌드로 넘어가며 Mac에서 약 6분 걸렸다. 3단계 착수 때 사전 빌드를 다시 확인하고, 없으면 Docker 빌드 단계에 컴파일 도구를 넣는 비용을 재서 정한다 (#24)
- 토픽: `product.events`, `order.events`, `payment.events`, `shipment.events` 등. 키는 집계 ID(`productId`, `orderId`)
  - 자동 생성에 맡기지 않고 파티션 수를 정해 명시적으로 만든다
- 컨슈머는 그룹별 `processed_messages`로 멱등 처리, 처리 완료 후 오프셋 커밋
  - 커밋 전에 죽으면 커밋 위치부터 다시 받는다(at-least-once). 멱등 처리는 선택이 아니다
  - 커밋 값은 다음에 읽을 오프셋(`offset + 1`). 오프셋은 64비트 문자열이라 `BigInt`로 계산한다
  - SIGTERM에서 `disconnect()`로 그룹을 떠난다. 강제 종료되면 세션 타임아웃까지 리밸런스가 늦어져 그 파티션 처리가 멈춘다

### 인증 (ADR 0015, POC #17)
- Better Auth 핸들러는 Nest 밖 Express에 직접 건다: `bodyParser: false` → `/auth/*splat`·`/admin/auth/*splat` 핸들러(Better Auth 기본 `basePath`가 `/api/auth`라 직접 지정한다) → `express.json()` → 검증기 → Nest 라우트. 세션 조회는 가드에서 `auth.api.getSession({ headers: fromNodeHeaders(req.headers) })`
- 인증 경로는 스펙 우선의 예외다. OpenAPI에 넣지 않고 검증기 `ignorePaths`로 뺀다. 이 예외를 다른 경로로 넓히지 않는다
- core 테이블은 Drizzle로 직접 정의한다(`db/ERD.md` "회원 1"). TS 키는 Better Auth 필드 이름과 같게, `generateId: false`로 id는 DB `uuidv7()`. 업그레이드·플러그인 추가 시 `@better-auth/cli generate` 결과와 비교한다
- 서버만 쓰는 필드(`isTestAccount` 등)는 `additionalFields`에 `input: false`
- 운영자 인스턴스는 가입을 막고 비밀값을 따로 둔다. 운영자 쿠키는 상위 도메인에 걸지 않는다

### 결제
- 승인 전 서버에 저장한 주문 금액과 결제 요청 금액을 비교한다
- 봇 계정(`isTestAccount`)은 모의 PG, 사람은 토스페이먼츠 테스트 모드

### LLM
- AI SDK 최신 메이저(7.x)는 Node 22+ · ESM 전용 → 10단계 착수 시 Nest 모듈 형식과의 호환 확인

## 미결정

- [ ] 채팅 게이트웨이: Socket.IO vs ws
- [ ] `p-stack.dev` 하위 도메인 구성에 따른 CORS·쿠키 도메인·신뢰 출처 (인증 방식은 ADR 0015로 결정)

## 현재 단계

1단계(뼈대 배포) 진행 중. 완료: Nest 프로젝트 세팅(#24), `openapi/` 스펙(헬스체크, 상품 단건·목록, #26). 다음: 서버 인터페이스 생성 파이프라인(Hey API) → 구현·계약 테스트.
