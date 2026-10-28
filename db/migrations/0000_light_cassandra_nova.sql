CREATE TYPE "public"."payment_status" AS ENUM('PENDING', 'APPROVED', 'EXPIRED');--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"amount" integer NOT NULL,
	"status" "payment_status" DEFAULT 'PENDING' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_amount_non_negative" CHECK ("payments"."amount" >= 0)
);
--> statement-breakpoint
CREATE INDEX "payments_status_expires_at_idx" ON "payments" USING btree ("status","expires_at");