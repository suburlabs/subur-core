import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "site_settings_location_area_served" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL
  );
  
  ALTER TABLE "site_settings" ADD COLUMN "location_street_address" varchar;
  ALTER TABLE "site_settings" ADD COLUMN "location_postal_code" varchar;
  ALTER TABLE "site_settings" ADD COLUMN "location_address_locality" varchar;
  ALTER TABLE "site_settings" ADD COLUMN "location_address_region" varchar;
  ALTER TABLE "site_settings" ADD COLUMN "location_address_country" varchar;
  ALTER TABLE "site_settings" ADD COLUMN "location_geo_latitude" numeric;
  ALTER TABLE "site_settings" ADD COLUMN "location_geo_longitude" numeric;
  ALTER TABLE "site_settings" ADD COLUMN "google_business_profile" varchar;
  ALTER TABLE "site_settings_location_area_served" ADD CONSTRAINT "site_settings_location_area_served_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "site_settings_location_area_served_order_idx" ON "site_settings_location_area_served" USING btree ("_order");
  CREATE INDEX "site_settings_location_area_served_parent_id_idx" ON "site_settings_location_area_served" USING btree ("_parent_id");
  CREATE INDEX "site_settings_location_area_served_locale_idx" ON "site_settings_location_area_served" USING btree ("_locale");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "site_settings_location_area_served" CASCADE;
  ALTER TABLE "site_settings" DROP COLUMN "location_street_address";
  ALTER TABLE "site_settings" DROP COLUMN "location_postal_code";
  ALTER TABLE "site_settings" DROP COLUMN "location_address_locality";
  ALTER TABLE "site_settings" DROP COLUMN "location_address_region";
  ALTER TABLE "site_settings" DROP COLUMN "location_address_country";
  ALTER TABLE "site_settings" DROP COLUMN "location_geo_latitude";
  ALTER TABLE "site_settings" DROP COLUMN "location_geo_longitude";
  ALTER TABLE "site_settings" DROP COLUMN "google_business_profile";`)
}
