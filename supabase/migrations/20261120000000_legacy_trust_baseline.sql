-- Baseline for the legacy trust schema imported on 20 November 2026.
-- Schema only: private records and legacy credentials are not migration seeds.
-- Existing imported databases must verify the schema and mark this applied;
-- fresh databases can execute it normally. Do not rerun it over existing tables.
BEGIN;
SET LOCAL standard_conforming_strings = on;
SET LOCAL TIME ZONE 'UTC';
CREATE SCHEMA legacy_trust;
REVOKE ALL ON SCHEMA legacy_trust FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA legacy_trust TO service_role;
CREATE TABLE legacy_trust."authors" (
"id" char(36) NOT NULL,
"title" varchar(255) NOT NULL,
"status" text NOT NULL DEFAULT 'active' CHECK ("status" IN ('active','inactive')),
"created_at" timestamp without time zone DEFAULT NULL,
"updated_at" timestamp without time zone DEFAULT NULL
);
ALTER TABLE legacy_trust."authors" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON legacy_trust."authors" FROM PUBLIC, anon, authenticated;
GRANT ALL ON legacy_trust."authors" TO service_role;
CREATE TABLE legacy_trust."bookings" (
"id" char(36) NOT NULL,
"orderNo" varchar(255) NOT NULL,
"issueDate" date NOT NULL,
"endDate" date NOT NULL,
"returnDate" date DEFAULT NULL,
"penaltyAmount" varchar(255) DEFAULT NULL,
"penaltyReason" text DEFAULT NULL,
"customer_id" char(36) DEFAULT NULL,
"ref_orderNo" varchar(255) DEFAULT NULL,
"status" text NOT NULL DEFAULT 'active' CHECK ("status" IN ('active','issue','lost','inactive','return','new','partial_return')),
"created_at" timestamp without time zone DEFAULT NULL,
"updated_at" timestamp without time zone DEFAULT NULL
);
ALTER TABLE legacy_trust."bookings" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON legacy_trust."bookings" FROM PUBLIC, anon, authenticated;
GRANT ALL ON legacy_trust."bookings" TO service_role;
CREATE TABLE legacy_trust."booking_items" (
"id" char(36) NOT NULL,
"orderNo" varchar(255) DEFAULT NULL,
"booking_id" char(36) DEFAULT NULL,
"book_id" char(36) DEFAULT NULL,
"status" text NOT NULL DEFAULT 'active' CHECK ("status" IN ('active','inactive','deleted')),
"created_at" timestamp without time zone DEFAULT NULL,
"updated_at" timestamp without time zone DEFAULT NULL
);
ALTER TABLE legacy_trust."booking_items" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON legacy_trust."booking_items" FROM PUBLIC, anon, authenticated;
GRANT ALL ON legacy_trust."booking_items" TO service_role;
CREATE TABLE legacy_trust."book_lists" (
"id" char(36) NOT NULL,
"bookName" varchar(255) NOT NULL,
"author" varchar(255) NOT NULL,
"class" varchar(255) NOT NULL,
"bookImage" varchar(255) DEFAULT NULL,
"utbn" integer NOT NULL,
"status" text NOT NULL DEFAULT 'active' CHECK ("status" IN ('active','issue','lost','inactive','return')),
"addedDate" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
"customer_id" char(36) DEFAULT NULL,
"created_at" timestamp without time zone DEFAULT NULL,
"updated_at" timestamp without time zone DEFAULT NULL
);
ALTER TABLE legacy_trust."book_lists" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON legacy_trust."book_lists" FROM PUBLIC, anon, authenticated;
GRANT ALL ON legacy_trust."book_lists" TO service_role;
CREATE TABLE legacy_trust."class_names" (
"id" char(36) NOT NULL,
"title" varchar(255) NOT NULL,
"status" text NOT NULL DEFAULT 'active' CHECK ("status" IN ('active','inactive')),
"created_at" timestamp without time zone DEFAULT NULL,
"updated_at" timestamp without time zone DEFAULT NULL
);
ALTER TABLE legacy_trust."class_names" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON legacy_trust."class_names" FROM PUBLIC, anon, authenticated;
GRANT ALL ON legacy_trust."class_names" TO service_role;
CREATE TABLE legacy_trust."contacts" (
"id" char(36) NOT NULL,
"name" varchar(255) NOT NULL,
"email" varchar(255) NOT NULL,
"phone" varchar(255) NOT NULL,
"subject" varchar(255) NOT NULL,
"message" text NOT NULL,
"status" text NOT NULL DEFAULT 'active' CHECK ("status" IN ('active','inactive')),
"created_at" timestamp without time zone DEFAULT NULL,
"updated_at" timestamp without time zone DEFAULT NULL
);
ALTER TABLE legacy_trust."contacts" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON legacy_trust."contacts" FROM PUBLIC, anon, authenticated;
GRANT ALL ON legacy_trust."contacts" TO service_role;
CREATE TABLE legacy_trust."customers" (
"id" char(36) NOT NULL,
"customerId" varchar(255) NOT NULL,
"name" varchar(255) NOT NULL,
"email" varchar(255) NOT NULL,
"phone" varchar(255) NOT NULL,
"address" varchar(255) DEFAULT NULL,
"bloodGroup" varchar(255) DEFAULT NULL,
"type" text NOT NULL CHECK ("type" IN ('donar','customer')),
"status" text NOT NULL DEFAULT 'active' CHECK ("status" IN ('active','inactive')),
"created_at" timestamp without time zone DEFAULT NULL,
"updated_at" timestamp without time zone DEFAULT NULL
);
ALTER TABLE legacy_trust."customers" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON legacy_trust."customers" FROM PUBLIC, anon, authenticated;
GRANT ALL ON legacy_trust."customers" TO service_role;
CREATE TABLE legacy_trust."failed_jobs" (
"id" bigint NOT NULL,
"uuid" varchar(255) NOT NULL,
"connection" text NOT NULL,
"queue" text NOT NULL,
"payload" text NOT NULL,
"exception" text NOT NULL,
"failed_at" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE legacy_trust."failed_jobs" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON legacy_trust."failed_jobs" FROM PUBLIC, anon, authenticated;
GRANT ALL ON legacy_trust."failed_jobs" TO service_role;
CREATE TABLE legacy_trust."feedback" (
"id" char(36) NOT NULL,
"name" varchar(255) NOT NULL,
"email" varchar(255) NOT NULL,
"phone" varchar(255) NOT NULL,
"feedback" text NOT NULL,
"status" text NOT NULL DEFAULT 'active' CHECK ("status" IN ('active','inactive')),
"created_at" timestamp without time zone DEFAULT NULL,
"updated_at" timestamp without time zone DEFAULT NULL
);
ALTER TABLE legacy_trust."feedback" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON legacy_trust."feedback" FROM PUBLIC, anon, authenticated;
GRANT ALL ON legacy_trust."feedback" TO service_role;
CREATE TABLE legacy_trust."members" (
"id" char(36) NOT NULL,
"memberId" varchar(255) NOT NULL,
"name" varchar(255) NOT NULL,
"email" varchar(255) NOT NULL,
"phone" varchar(255) NOT NULL,
"bloodgroup" varchar(255) NOT NULL,
"address" varchar(255) DEFAULT NULL,
"city" varchar(255) DEFAULT NULL,
"purpose" text DEFAULT NULL,
"status" text NOT NULL DEFAULT 'active' CHECK ("status" IN ('active','inactive')),
"created_at" timestamp without time zone DEFAULT NULL,
"updated_at" timestamp without time zone DEFAULT NULL
);
ALTER TABLE legacy_trust."members" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON legacy_trust."members" FROM PUBLIC, anon, authenticated;
GRANT ALL ON legacy_trust."members" TO service_role;
CREATE TABLE legacy_trust."migrations" (
"id" integer NOT NULL,
"migration" varchar(255) NOT NULL,
"batch" integer NOT NULL
);
ALTER TABLE legacy_trust."migrations" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON legacy_trust."migrations" FROM PUBLIC, anon, authenticated;
GRANT ALL ON legacy_trust."migrations" TO service_role;
CREATE TABLE legacy_trust."password_reset_tokens" (
"email" varchar(255) NOT NULL,
"token" varchar(255) NOT NULL,
"created_at" timestamp without time zone DEFAULT NULL
);
ALTER TABLE legacy_trust."password_reset_tokens" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON legacy_trust."password_reset_tokens" FROM PUBLIC, anon, authenticated;
GRANT ALL ON legacy_trust."password_reset_tokens" TO service_role;
CREATE TABLE legacy_trust."personal_access_tokens" (
"id" bigint NOT NULL,
"tokenable_type" varchar(255) NOT NULL,
"tokenable_id" char(36) NOT NULL,
"name" varchar(255) NOT NULL,
"token" varchar(64) NOT NULL,
"abilities" text DEFAULT NULL,
"last_used_at" timestamp without time zone DEFAULT NULL,
"expires_at" timestamp without time zone DEFAULT NULL,
"created_at" timestamp without time zone DEFAULT NULL,
"updated_at" timestamp without time zone DEFAULT NULL
);
ALTER TABLE legacy_trust."personal_access_tokens" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON legacy_trust."personal_access_tokens" FROM PUBLIC, anon, authenticated;
GRANT ALL ON legacy_trust."personal_access_tokens" TO service_role;
CREATE TABLE legacy_trust."users" (
"id" char(36) NOT NULL,
"name" varchar(255) NOT NULL,
"email" varchar(255) NOT NULL,
"role" varchar(255) NOT NULL,
"email_verified_at" timestamp without time zone DEFAULT NULL,
"isValid" integer NOT NULL DEFAULT 0,
"password" varchar(255) NOT NULL,
"remember_token" varchar(100) DEFAULT NULL,
"created_at" timestamp without time zone DEFAULT NULL,
"updated_at" timestamp without time zone DEFAULT NULL
);
ALTER TABLE legacy_trust."users" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON legacy_trust."users" FROM PUBLIC, anon, authenticated;
GRANT ALL ON legacy_trust."users" TO service_role;
ALTER TABLE legacy_trust."authors" ADD PRIMARY KEY ("id");
ALTER TABLE legacy_trust."bookings" ADD PRIMARY KEY ("id");
CREATE UNIQUE INDEX "bookings_orderno_unique" ON legacy_trust."bookings" ("orderNo");
CREATE INDEX "bookings_customer_id_foreign" ON legacy_trust."bookings" ("customer_id");
ALTER TABLE legacy_trust."booking_items" ADD PRIMARY KEY ("id");
CREATE INDEX "booking_items_booking_id_foreign" ON legacy_trust."booking_items" ("booking_id");
CREATE INDEX "booking_items_book_id_foreign" ON legacy_trust."booking_items" ("book_id");
ALTER TABLE legacy_trust."book_lists" ADD PRIMARY KEY ("id");
CREATE INDEX "book_lists_customer_id_foreign" ON legacy_trust."book_lists" ("customer_id");
ALTER TABLE legacy_trust."class_names" ADD PRIMARY KEY ("id");
ALTER TABLE legacy_trust."contacts" ADD PRIMARY KEY ("id");
ALTER TABLE legacy_trust."customers" ADD PRIMARY KEY ("id");
CREATE UNIQUE INDEX "customers_customerid_unique" ON legacy_trust."customers" ("customerId");
CREATE UNIQUE INDEX "customers_email_unique" ON legacy_trust."customers" ("email");
CREATE UNIQUE INDEX "customers_phone_unique" ON legacy_trust."customers" ("phone");
ALTER TABLE legacy_trust."failed_jobs" ADD PRIMARY KEY ("id");
CREATE UNIQUE INDEX "failed_jobs_uuid_unique" ON legacy_trust."failed_jobs" ("uuid");
ALTER TABLE legacy_trust."feedback" ADD PRIMARY KEY ("id");
ALTER TABLE legacy_trust."members" ADD PRIMARY KEY ("id");
CREATE UNIQUE INDEX "members_memberid_unique" ON legacy_trust."members" ("memberId");
CREATE UNIQUE INDEX "members_email_unique" ON legacy_trust."members" ("email");
CREATE UNIQUE INDEX "members_phone_unique" ON legacy_trust."members" ("phone");
ALTER TABLE legacy_trust."migrations" ADD PRIMARY KEY ("id");
ALTER TABLE legacy_trust."password_reset_tokens" ADD PRIMARY KEY ("email");
ALTER TABLE legacy_trust."personal_access_tokens" ADD PRIMARY KEY ("id");
CREATE UNIQUE INDEX "personal_access_tokens_token_unique" ON legacy_trust."personal_access_tokens" ("token");
CREATE INDEX "personal_access_tokens_tokenable_type_tokenable_id_index" ON legacy_trust."personal_access_tokens" ("tokenable_type","tokenable_id");
ALTER TABLE legacy_trust."users" ADD PRIMARY KEY ("id");
CREATE UNIQUE INDEX "users_email_unique" ON legacy_trust."users" ("email");
ALTER TABLE legacy_trust."failed_jobs" ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY;
ALTER TABLE legacy_trust."migrations" ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY;
ALTER TABLE legacy_trust."personal_access_tokens" ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY;
ALTER TABLE legacy_trust."bookings" ADD CONSTRAINT "bookings_customer_id_foreign" FOREIGN KEY ("customer_id") REFERENCES legacy_trust."customers" ("id") ON DELETE SET NULL;
ALTER TABLE legacy_trust."booking_items" ADD CONSTRAINT "booking_items_book_id_foreign" FOREIGN KEY ("book_id") REFERENCES legacy_trust."book_lists" ("id") ON DELETE SET NULL;
ALTER TABLE legacy_trust."booking_items" ADD CONSTRAINT "booking_items_booking_id_foreign" FOREIGN KEY ("booking_id") REFERENCES legacy_trust."bookings" ("id") ON DELETE SET NULL;
ALTER TABLE legacy_trust."book_lists" ADD CONSTRAINT "book_lists_customer_id_foreign" FOREIGN KEY ("customer_id") REFERENCES legacy_trust."customers" ("id") ON DELETE SET NULL;
CREATE VIEW public.catalogue AS SELECT id, "bookName" AS title, author, class AS class_name, utbn FROM legacy_trust.book_lists WHERE status = 'active';
CREATE VIEW public.catalogue_classes AS SELECT DISTINCT class_name FROM public.catalogue;
REVOKE ALL ON public.catalogue, public.catalogue_classes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.catalogue, public.catalogue_classes TO anon, authenticated, service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
