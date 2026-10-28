# OpenAPI 스펙 규약

`openapi/`의 모든 스펙에 적용한다. 툴체인은 ADR 0012. **[린트]** 표시는 `redocly lint`가 강제하는 규칙이다.

## 버전

- `openapi: 3.1.1`
- null 허용은 `type: [string, 'null']`처럼 쓴다. `nullable`은 3.1에서 없어진 키워드다 **[린트]**

## 이름

| 대상 | 규칙 | 예 |
|---|---|---|
| 경로 | 소문자 kebab-case, 컬렉션은 복수 명사 **[린트]** | `/products`, `/order-issues/{orderIssueId}` |
| 경로 파라미터·쿼리 파라미터·JSON 필드 | camelCase **[린트]** | `productId`, `pageSize`, `createdAt` |
| `operationId` | camelCase 동사+명사. Hey API가 이 이름으로 컨트롤러 메서드를 만든다 **[린트]** | `getProduct`, `listProducts`, `createOrder` |
| 태그 | 복수 kebab-case, api 모듈 이름과 같게. 첫 태그가 `XxxControllerMethods` 이름이 된다 | `products`, `order-issues` |
| 스키마 이름 | PascalCase **[린트]** | `Product`, `OrderItem` |
| enum 값 | UPPER_SNAKE_CASE **[린트]** | `PAYMENT_PENDING` |

## 타입 표현

| 의미 | 스키마 |
|---|---|
| ID | `type: string`, `format: uuid` |
| 금액 | `type: integer`, 원 단위, `minimum: 0` |
| 시각 | `type: string`, `format: date-time` (RFC 3339, UTC `Z`) |
| 날짜 | `type: string`, `format: date` |

## 스키마 엄격성

- 모든 object 스키마에 `additionalProperties: false`를 단다 **[린트]**
  - 응답: 스펙에 없는 필드(내부 필드)가 나가려 하면 런타임 응답 검증이 500으로 막는다
  - 요청: 모르는 필드를 보내면 400
  - `allOf`로 스키마를 합치면 `additionalProperties: false`가 합친 결과를 깨뜨린다. 그때는 `unevaluatedProperties: false`를 쓰고 두 도구가 처리하는지 확인한다
- `required`에 적은 필드는 `properties`에 정의한다. Hey API는 정의 없는 required를 경고 없이 무시한다 **[린트]**
- 요청·응답 본문 스키마는 `components/schemas`에 이름을 붙여 둔다. 생성 타입 이름이 된다

## 에러 응답 (RFC 9457 Problem Details)

- 모든 4xx·5xx 본문은 `application/problem+json`, 스키마 `Problem`이다. 공통 응답은 `components/responses`에 두고 `$ref`로 쓴다
- 클라이언트는 **`type`으로만 분기**한다. `title`·`detail`은 화면 표시용이다

| 필드 | 값 |
|---|---|
| `type` | 일반 HTTP 오류는 `about:blank`. 클라이언트가 구분해야 하는 오류는 `/problems/<kebab-case>` |
| `title` | 같은 `type`이면 항상 같은 짧은 요약. `about:blank`면 HTTP 상태 문구 |
| `status` | HTTP 상태 코드와 같은 값 |
| `detail` | 이번 발생에 대한 설명. 5xx에는 넣지 않는다 |
| `instance` | 요청 경로 |
| `errors` | 검증 오류일 때만. `[{ pointer, detail }]`, `pointer`는 `#/body/name`, `#/query/pageSize`, `#/path/productId`처럼 위치를 접두어로 둔 JSON Pointer |

상태 코드: 400 요청이 스펙과 다름, 401 인증 없음, 403 권한 없음, 404 리소스 없음, 409 현재 상태와 충돌(재고 부족, 중복, 허용되지 않은 상태 전이). 422는 쓰지 않는다. 5xx는 스펙에 적지 않는다.

### 오류 종류 목록

`/problems/*` type은 계약이다. 이름을 바꾸거나 지우면 BREAKING이다. 새 type은 이 표에 먼저 추가한다.

| type | status | 의미 |
|---|---|---|
| `/problems/validation-error` | 400 | 요청이 스펙과 다름. `errors`에 위치별 원인 |
| `/problems/invalid-page-token` | 400 | `pageToken`이 잘못됐거나, 발급 때와 다른 조건(필터·정렬)으로 쓰임 |

## 페이지네이션 (Google AIP-158)

목록 operation(`listXxx`)은 모두 커서 방식을 쓴다. 행 번호로 이동하고 전체 개수를 보여야 하는 그리드 목록(셀러센터·어드민의 AG Grid)만 오프셋을 함께 연다.

| 방식 | 쿼리 | 응답 200 | 쓰는 곳 |
|---|---|---|---|
| 커서 (기본) | `pageSize`(integer, 1~100, 기본 20), `pageToken`(string, 선택) | `{ items, nextPageToken }` | 모든 목록 |
| + 오프셋 | 위에 더해 `skip`(integer, 0~10000, 기본 0) | 위에 더해 `totalSize`(integer) | 그리드 목록만 |

- `items`, `nextPageToken`(`string | null`)은 required다. 마지막 페이지면 `nextPageToken: null`
- `pageToken`은 서버가 만든 불투명한 문자열이다. 클라이언트는 받은 값을 그대로 돌려보내기만 한다
- 서버는 토큰에 발급 조건(필터·정렬)을 담고, 다른 조건으로 쓰이면 `/problems/invalid-page-token`으로 거절한다
- `skip`은 결과 앞에서부터 건너뛸 개수다. 그리드는 `pageToken` 없이 `skip`만 쓴다. AG Grid Infinite Row Model에서는 `skip = startRow`, `pageSize = endRow - startRow`, `lastRow = totalSize`
- `skip` 상한 10000: 오프셋은 뒤로 갈수록 DB가 앞 행을 세고 버려 느려진다
- 그리드 목록의 `totalSize`는 required다. `COUNT` 비용이 들어 그리드 목록에만 둔다
