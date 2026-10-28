# 도메인 모델 (ERD)

커머스 DB(Postgres)의 테이블과 관계. 엔티티 목록의 원본은 핸드북 `architecture.md` "도메인 모델"이고, 이 문서는 그것을 테이블·관계·컬럼으로 내린다. 스키마 코드(`db/schema/`)를 바꾸면 이 문서도 같은 PR에서 고친다.

## 테이블 공통 규칙

| 대상 | 규칙 | 예 |
|---|---|---|
| 테이블 이름 | snake_case 복수 | `users`, `order_items` |
| 컬럼 이름 | snake_case. Drizzle에서 이름을 직접 적는다 | `uuid('seller_id')` → TS `sellerId` |
| 기본 키 | `id uuid DEFAULT uuidv7()` | 시간순으로 정렬되는 UUID(Postgres 18 내장) |
| 외래 키 | `<참조 단수>_id`, 기본 `ON DELETE RESTRICT` | `seller_id` |
| 시각 | `created_at`, `updated_at`: `timestamptz NOT NULL DEFAULT now()`. `updated_at`은 앱이 갱신 | |
| 금액 | 원 단위 `integer`, `CHECK (>= 0)`. 합계·정산 금액은 `bigint` | `price`, `total_amount` |
| 상태·유형 | Postgres enum, 값은 UPPER_SNAKE_CASE(스펙과 같은 값). 값은 추가만 한다 | `product_status` |
| 동시 수정 | 여러 사람이 고치는 행은 `version integer`로 낙관적 락 | `products.version` |
| 삭제 | 기본은 실제 삭제하지 않고 상태로 표현. 필요한 테이블만 `deleted_at` | |
| 제약·인덱스 이름 | `<테이블>_<컬럼>_<종류>` (`pkey`, `fkey`, `key`, `idx`, `check`) | `products_seller_id_idx` |

## 모듈 소유

- 테이블마다 소유 모듈이 하나다. 아래 다이어그램은 소유 모듈별로 나눈다
- 다른 모듈의 테이블은 읽지 않는다(CLAUDE.md "모듈 경계"). 대신 **모듈 간 외래 키는 둔다**: 조회는 공개 인터페이스로 하되, 참조 무결성은 DB가 지킨다
- 다른 레포가 소유하는 데이터(shop-sim-vendor의 운송장·모의 PG 거래, shop-sim-loadtest의 시뮬레이션)는 커머스 DB에 두지 않는다. 커머스 DB에는 외부 식별자(운송장 번호, PG 거래 ID)만 저장한다

## 관계도

`||--o{` 1:N, `||--|{` 1:1..N, `|o--o{` 0..1:N(부모가 없을 수 있음), `||--o|` 1:0..1, `||--||` 1:1. 다른 모듈의 테이블은 관계를 보여 주기 위해 함께 그린다.

### 회원·판매자 (user, auth, seller, admin)

```mermaid
erDiagram
    users ||--o{ addresses : "배송지"
    users ||--o| sellers : "판매자 프로필"
    users ||--o{ seller_applications : "입점 신청"
    sellers ||--|| shipping_policies : "기본 배송 정책"
```

- **미정: Better Auth POC(#17) 후 확정** — `users`와 인증 테이블(세션, 소셜 계정)은 Better Auth가 정의한다. 운영자 계정을 `users`와 분리할지(입점 심사자 참조 포함)도 POC 결론을 따른다
- 입점 신청은 거절 후 재신청할 수 있어 `users` 1:N. 승인되면 `sellers`가 만들어진다

### 카탈로그 (catalog)

```mermaid
erDiagram
    categories |o--o{ categories : "상위 카테고리"
    categories ||--o{ products : ""
    sellers ||--o{ products : "판매"
    products ||--o{ product_images : ""
    products ||--o{ product_revisions : "상세 본문 이력"
    products ||--o{ product_options : "선택형 옵션"
    product_options ||--o{ option_values : ""
    products ||--o{ skus : "옵션 조합"
    skus ||--o{ sku_option_values : ""
    option_values ||--o{ sku_option_values : ""
    products ||--o{ custom_option_fields : "자유 입력형 옵션"
```

- `sku_option_values`는 SKU 하나가 어떤 옵션 값 조합인지 기록하는 연결 테이블이다(SKU ↔ 옵션 값 N:M). 옵션이 없는 상품도 SKU 1개를 가진다

### 재고 (inventory)

```mermaid
erDiagram
    sellers ||--o{ raw_materials : "원재료"
    products ||--o{ bill_of_materials : "제작상품 소요량"
    raw_materials ||--o{ bill_of_materials : ""
    skus |o--o{ stock_lots : "완제품 로트"
    raw_materials |o--o{ stock_lots : "원재료 로트"
    stock_lots ||--o{ stock_ledger_entries : "변동 원장"
    stock_lots ||--o{ stock_reservations : "예약"
```

- `stock_lots`는 완제품(SKU) 또는 원재료 중 정확히 하나를 가리킨다(`CHECK`로 강제)
- 재고 수량의 원본은 원장(`stock_ledger_entries`)이고, `stock_lots.quantity`는 원장 합계를 캐시한 값이다
- 예약은 로트 단위다. 유효기한이 가까운 로트부터 예약한다(FEFO). 주문 항목과의 관계는 주문 관계도에서 그린다

### 주문·결제·배송·쿠폰 (order, payment, coupon, shipment)

```mermaid
erDiagram
    users ||--o| carts : ""
    carts ||--o{ cart_items : ""
    skus ||--o{ cart_items : ""
    users ||--o{ checkouts : "주문서(결제 단위)"
    checkouts ||--|{ orders : "판매자별 주문"
    sellers ||--o{ orders : ""
    orders ||--|{ order_items : ""
    skus ||--o{ order_items : ""
    order_items ||--o{ stock_reservations : "재고 예약"
    checkouts ||--o{ payments : "결제 시도"
    payments ||--o{ refunds : ""
    orders ||--o{ order_issues : "취소·반품 요청"
    order_issues ||--|{ order_issue_items : ""
    order_items ||--o{ order_issue_items : ""
    order_issues |o--o{ refunds : ""
    orders ||--o| shipments : "배송"
    sellers |o--o{ coupons : "발행(없으면 플랫폼)"
    coupons ||--o{ coupon_issues : "발급"
    users ||--o{ coupon_issues : ""
    coupon_issues ||--o| coupon_redemptions : "사용"
    checkouts ||--o{ coupon_redemptions : ""
```

- 결제는 주문서(`checkouts`) 단위로 한 번, 배송은 판매자별 주문(`orders`) 단위다. 여러 판매자 상품을 한 번에 결제하면 주문서 1개에 주문 N개
- `payments`는 주문서당 여러 행일 수 있다(실패 후 재시도). 승인된 결제는 주문서당 최대 1개(부분 유니크 인덱스)
- 주문 항목은 가격·할인·옵션 입력값을, 주문은 배송지를 **스냅샷**으로 복사한다. 상품·배송지가 나중에 바뀌어도 주문은 그대로다
- 쿠폰 사용은 주문서에 기록하고, 할인액은 주문 항목별로 나눠 스냅샷에 적는다(부분 취소·정산 계산용)
- 환불은 결제에 묶인다. 판매자 취소처럼 요청 없이 생기는 환불도 있어 `order_issues`와의 관계는 0..1
- 운송장 상세·상태 이력은 shop-sim-vendor가 소유한다. `shipments`에는 택배사, 운송장 번호, 마지막으로 동기화한 상태만 둔다
