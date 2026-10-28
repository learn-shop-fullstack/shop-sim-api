# AsyncAPI 이벤트 규약

`asyncapi/`의 모든 이벤트 계약에 적용한다. 결정 근거는 ADR 0016, 실험은 POC #7(`poc/event-contract` 브랜치). Kafka 클라이언트 규칙(오프셋 커밋, at-least-once, 종료)은 `CLAUDE.md` "Kafka".

## 검사

| 검사 | 명령 | 실패 조건 |
|---|---|---|
| 문법·구조 | `asyncapi validate asyncapi/asyncapi.yaml` | 스펙 위반 |
| 채널(토픽) 변경 | `asyncapi diff <기준> <새>` | 토픽 주소 변경 등 breaking (종료 코드 1) |
| 페이로드 호환성 | `node scripts/check-event-compat.mjs <기준> <새>` | 아래 "호환성"의 BREAKING (종료 코드 1) |

- CLI는 `pnpm --package=@asyncapi/cli@6.2.2 dlx asyncapi …`로 버전을 고정해 쓴다
- AsyncAPI CLI는 사용 통계를 기본으로 보내고, 스펙 파일 내용도 기록 함수에 넘긴다. 로컬에서 처음 한 번 `asyncapi config analytics --disable`을 실행한다. `CI=true` 환경(GitHub Actions)에서는 보내지 않는다
- `asyncapi diff`는 페이로드 변경을 모두 `unclassified`로 두고 통과시킨다. 페이로드는 호환성 스크립트로만 판정한다
- 기준은 main의 `asyncapi.yaml`이다. 스크립트 원형은 POC 브랜치에 있고 1단계 CI에서 옮긴다

## 버전

- `asyncapi: 3.1.0`, 스키마는 기본 형식(JSON Schema draft-07 상위 집합)
- `unevaluatedProperties`·`prefixItems` 같은 2019-09 이후 키워드는 쓰지 않는다. 호환성 도구가 draft-07 기준이라 자동 판정하지 못한다

## 구조와 이름

| 대상 | 규칙 | 예 |
|---|---|---|
| 채널 | 집계 하나에 토픽 하나. 채널 키 camelCase `<집계>Events` | `orderEvents` |
| 토픽(`address`) | 소문자 `<집계>.events`. `_`를 쓰지 않는다(Kafka 메트릭 이름에서 `.`과 `_`가 충돌) | `order.events` |
| 파티션 수 | 채널의 kafka 바인딩 `partitions`에 적고, 그 값으로 토픽을 직접 만든다 | `partitions: 3` |
| 오퍼레이션 | `action: send`, `publish<집계>Events` | `publishOrderEvents` |
| 메시지 | `components/messages`에 PascalCase `<집계><과거형 사건>` | `OrderPaid` |
| 페이로드 스키마 | `components/schemas`에 `<메시지>V<메이저>` | `OrderPaidV1` |

## 봉투: CloudEvents 1.0, Kafka binary 모드

이벤트 속성은 `ce_` 헤더, 이벤트 데이터는 메시지 값(순수 JSON)이다. 모든 메시지는 트레이트 `CloudEvent`를 쓴다.

| 헤더 | 값 |
|---|---|
| `ce_specversion` | `1.0` |
| `ce_id` | 아웃박스 행의 ID(`uuidv7()`). 릴레이가 다시 보내도 같은 값이라 컨슈머의 멱등 키가 된다 |
| `ce_source` | `/shop-sim-api/<모듈>` |
| `ce_type` | `<집계>.<사건>.v<메이저>`. 메시지와 1:1이고 메시지 헤더에 `const`로 고정한다. 한 번 정하면 바꾸지 않는다 |
| `ce_time` | 사건이 일어난 시각(상태 변경 트랜잭션 시각), RFC 3339 UTC |
| `ce_subject` | 집계 ID. 메시지 키와 같다 |
| `content-type` | `application/json` |

- 헤더 스키마는 `additionalProperties: false`를 달지 않는다. 추적 헤더(`traceparent`) 등이 붙는다
- 메시지 키는 집계 ID다. 같은 집계의 이벤트는 같은 파티션에서 순서대로 처리된다

## 페이로드

- 필드 이름과 타입 표현(ID, 금액, 시각)은 `openapi/CONVENTIONS.md`와 같다
- 모든 object에 `additionalProperties: false`. 생산자가 내부 필드를 내보내지 못하게 막는다
- 상태값은 `enum`(UPPER_SNAKE_CASE)

## 호환성

판정 원칙: **생산자는 닫힌 스키마로 엄격하게 보내고, 컨슈머는 모르는 필드를 무시한다.** 그래서 두 방향을 모두 본다.

- 옛 컨슈머가 새 메시지를 받는다: 새 스키마가 허용하는 값을 옛 스키마(열린)가 모두 받아들이는가
- 새 컨슈머가 옛 메시지를 재처리한다: 옛 스키마가 허용하는 값을 새 스키마(열린)가 모두 받아들이는가

| 변경 | 판정 | 깨지는 쪽 |
|---|---|---|
| 선택 필드 추가 | 호환 | |
| `enum` 값 추가(순서 변경 포함) | 호환 | 컨슈머는 모르는 값을 기본 처리한다 |
| 필수 필드 삭제 | BREAKING | 옛 컨슈머 |
| 필수 필드를 선택으로 | BREAKING | 옛 컨슈머 |
| 타입 넓힘(integer → number 등) | BREAKING | 옛 컨슈머 |
| 필수 필드 추가 | BREAKING | 재처리 |
| 제약 강화(`maxLength`, `maximum` 추가 등) | BREAKING | 재처리 |
| 타입 변경 | BREAKING | 양쪽 |
| `enum` 값 삭제 | BREAKING | 재처리 |
| `format`·`pattern`·`const` 등의 변경 | BREAKING(수동 검토) | 도구가 판정하지 못해 실패시킨다 |
| 메시지 삭제·이름 변경 | BREAKING | 옛 컨슈머 |
| 토픽 주소 변경 | BREAKING | 전체(`asyncapi diff`) |

### BREAKING 변경 절차

기존 메시지를 고치지 않고 새 메이저 버전을 나란히 둔다.

1. 새 메시지(`OrderPaidV2`, 페이로드 `OrderPaidV2`, `ce_type: order.paid.v2`)를 **같은 채널**에 추가한다. 이 PR은 호환이다
2. 생산자가 v1과 v2를 함께 발행한다
3. 컨슈머가 v2로 옮긴다
4. v1 메시지를 지운다. 이 PR은 제목에 `BREAKING`을 붙인다

## 생산자

- 발행 전에 헤더·페이로드를 스키마로 검증하고(ajv + ajv-formats), 어기면 보내지 않는다
- 상태 변경과 아웃박스 기록은 같은 트랜잭션이다. 릴레이가 아웃박스를 Kafka로 보낸다

## 컨슈머

- `ce_type`으로 분기한다. 모르는 `ce_type`은 로그를 남기고 건너뛴 뒤 커밋한다
- 페이로드의 모르는 필드는 무시하고, 모르는 `enum` 값은 기본 처리로 넘긴다
- `ce_id`로 멱등 처리한다(`processed_messages`)
