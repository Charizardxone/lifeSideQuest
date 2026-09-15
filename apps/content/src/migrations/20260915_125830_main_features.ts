import { sql } from '@payloadcms/db-postgres';
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres';

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_admins_role" AS ENUM('admin', 'editor');
  CREATE TYPE "public"."enum_quests_status" AS ENUM('draft', 'review', 'published', 'withdrawn');
  CREATE TABLE "quests" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"content" jsonb DEFAULT '{"title":"在窗边发现三种颜色","subtitle":"给熟悉的风景一点新的注意。","description":"在安全的室内，从窗边观察三种平时没有注意的颜色。无需拍摄他人或离开安全区域。","category":"exploration","steps":["选择安全的室内位置，不攀爬窗台。","找到三种不同的颜色，留意它们的形状。","回想哪一种颜色最让你意外。"],"duration":"5–10 分钟","budget":"0 元","people":"独自或与熟人一起","indoorOutdoor":"室内","timeOfDay":"光线充足时","environment":"无需特定城市或天气；可坐着完成","preparation":"无需准备","safetyNotes":"保持在安全室内，不攀爬，不拍摄他人隐私。任何不适都可以停止。","tags":["观察","低预算"],"rewards":{"ruleVersion":"mvp-v1","difficulty":1,"xp":10,"attributes":{"exploration":1,"courage":0,"creativity":1,"connection":0,"growth":0,"vitality":0}}}'::jsonb NOT NULL,
  	"status" "enum_quests_status" DEFAULT 'draft' NOT NULL,
  	"safety_reviewed" boolean DEFAULT false,
  	"experience_reviewed" boolean DEFAULT false,
  	"emergency" boolean DEFAULT false,
  	"reason" varchar,
  	"revision" numeric DEFAULT 0,
  	"published_snapshot" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "quest_versions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version_id" varchar NOT NULL,
  	"quest_id" varchar NOT NULL,
  	"title" varchar NOT NULL,
  	"snapshot" jsonb NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "audit_log" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"actor_id" varchar NOT NULL,
  	"action" varchar NOT NULL,
  	"entity_id" varchar NOT NULL,
  	"revision" numeric NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "daily_quests" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"business_date" varchar NOT NULL,
  	"version_id" integer NOT NULL,
  	"reason" varchar,
  	"revision" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "content_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"fallback_id" integer,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "admins" ADD COLUMN "role" "enum_admins_role" DEFAULT 'editor' NOT NULL;
  UPDATE "admins" SET "role" = 'admin';
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "quests_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "quest_versions_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "audit_log_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "daily_quests_id" integer;
  ALTER TABLE "daily_quests" ADD CONSTRAINT "daily_quests_version_id_quest_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."quest_versions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "content_settings" ADD CONSTRAINT "content_settings_fallback_id_quest_versions_id_fk" FOREIGN KEY ("fallback_id") REFERENCES "public"."quest_versions"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "quests_updated_at_idx" ON "quests" USING btree ("updated_at");
  CREATE INDEX "quests_created_at_idx" ON "quests" USING btree ("created_at");
  CREATE UNIQUE INDEX "quest_versions_version_id_idx" ON "quest_versions" USING btree ("version_id");
  CREATE INDEX "quest_versions_quest_id_idx" ON "quest_versions" USING btree ("quest_id");
  CREATE INDEX "quest_versions_updated_at_idx" ON "quest_versions" USING btree ("updated_at");
  CREATE INDEX "quest_versions_created_at_idx" ON "quest_versions" USING btree ("created_at");
  CREATE UNIQUE INDEX "audit_log_key_idx" ON "audit_log" USING btree ("key");
  CREATE INDEX "audit_log_updated_at_idx" ON "audit_log" USING btree ("updated_at");
  CREATE INDEX "audit_log_created_at_idx" ON "audit_log" USING btree ("created_at");
  CREATE UNIQUE INDEX "daily_quests_business_date_idx" ON "daily_quests" USING btree ("business_date");
  CREATE INDEX "daily_quests_version_idx" ON "daily_quests" USING btree ("version_id");
  CREATE INDEX "daily_quests_updated_at_idx" ON "daily_quests" USING btree ("updated_at");
  CREATE INDEX "daily_quests_created_at_idx" ON "daily_quests" USING btree ("created_at");
  CREATE INDEX "content_settings_fallback_idx" ON "content_settings" USING btree ("fallback_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_quests_fk" FOREIGN KEY ("quests_id") REFERENCES "public"."quests"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_quest_versions_fk" FOREIGN KEY ("quest_versions_id") REFERENCES "public"."quest_versions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_audit_log_fk" FOREIGN KEY ("audit_log_id") REFERENCES "public"."audit_log"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_daily_quests_fk" FOREIGN KEY ("daily_quests_id") REFERENCES "public"."daily_quests"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_quests_id_idx" ON "payload_locked_documents_rels" USING btree ("quests_id");
  CREATE INDEX "payload_locked_documents_rels_quest_versions_id_idx" ON "payload_locked_documents_rels" USING btree ("quest_versions_id");
  CREATE INDEX "payload_locked_documents_rels_audit_log_id_idx" ON "payload_locked_documents_rels" USING btree ("audit_log_id");
  CREATE INDEX "payload_locked_documents_rels_daily_quests_id_idx" ON "payload_locked_documents_rels" USING btree ("daily_quests_id");`);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "quests" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "quest_versions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "audit_log" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "daily_quests" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "content_settings" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "quests" CASCADE;
  DROP TABLE "quest_versions" CASCADE;
  DROP TABLE "audit_log" CASCADE;
  DROP TABLE "daily_quests" CASCADE;
  DROP TABLE "content_settings" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_quests_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_quest_versions_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_audit_log_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_daily_quests_fk";
  
  DROP INDEX "payload_locked_documents_rels_quests_id_idx";
  DROP INDEX "payload_locked_documents_rels_quest_versions_id_idx";
  DROP INDEX "payload_locked_documents_rels_audit_log_id_idx";
  DROP INDEX "payload_locked_documents_rels_daily_quests_id_idx";
  ALTER TABLE "admins" DROP COLUMN "role";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "quests_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "quest_versions_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "audit_log_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "daily_quests_id";
  DROP TYPE "public"."enum_admins_role";
  DROP TYPE "public"."enum_quests_status";`);
}
