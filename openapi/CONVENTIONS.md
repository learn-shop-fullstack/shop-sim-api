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
