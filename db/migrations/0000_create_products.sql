CREATE TYPE "public"."product_status" AS ENUM('DRAFT', 'PUBLISHED', 'SCHEDULED', 'SUSPENDED');--> statement-breakpoint
CREATE TYPE "public"."product_type" AS ENUM('FINISHED', 'MADE_TO_ORDER');--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"seller_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"name" text NOT NULL,
	"subtitle" text,
	"type" "product_type" NOT NULL,
	"price" integer NOT NULL,
	"discount_rate" integer DEFAULT 0 NOT NULL,
	"detail_content" jsonb NOT NULL,
	"lead_time_days" integer,
	"status" "product_status" DEFAULT 'DRAFT' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_name_check" CHECK ("products"."name" <> ''),
	CONSTRAINT "products_price_check" CHECK ("products"."price" >= 0),
	CONSTRAINT "products_discount_rate_check" CHECK ("products"."discount_rate" BETWEEN 0 AND 99),
	CONSTRAINT "products_lead_time_days_check" CHECK (("products"."type" = 'MADE_TO_ORDER') = ("products"."lead_time_days" IS NOT NULL) AND ("products"."lead_time_days" IS NULL OR "products"."lead_time_days" >= 1)),
	CONSTRAINT "products_scheduled_at_check" CHECK ("products"."status" <> 'SCHEDULED' OR "products"."scheduled_at" IS NOT NULL),
	CONSTRAINT "products_published_at_check" CHECK ("products"."status" <> 'PUBLISHED' OR "products"."published_at" IS NOT NULL)
);
--> statement-breakpoint
CREATE INDEX "products_seller_id_status_idx" ON "products" USING btree ("seller_id","status");--> statement-breakpoint
CREATE INDEX "products_scheduled_at_idx" ON "products" USING btree ("scheduled_at") WHERE "products"."status" = 'SCHEDULED';--> statement-breakpoint
CREATE INDEX "products_published_at_id_idx" ON "products" USING btree ("published_at" DESC NULLS FIRST,"id" DESC NULLS FIRST) WHERE "products"."status" = 'PUBLISHED';