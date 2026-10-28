import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * El `UPDATE` omple `max_languages` amb els idiomes que ja hi ha actius (mínim
 * 1): amb el valor per defecte, el global quedaria per sota dels idiomes del
 * client i el panell no el podria desar fins al pas `subscription` de `pnpm ops deploy`.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "subscription_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  ALTER TABLE "subscription" ADD COLUMN "max_languages" numeric DEFAULT 1 NOT NULL;
  UPDATE "subscription" s SET "max_languages" = GREATEST(1, (SELECT count(*) FROM "subscription_active_locales" a WHERE a."parent_id" = s."id"));
  ALTER TABLE "subscription_texts" ADD CONSTRAINT "subscription_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."subscription"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "subscription_texts_order_parent" ON "subscription_texts" USING btree ("order","parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "subscription_texts" CASCADE;
  ALTER TABLE "subscription" DROP COLUMN "max_languages";`)
}
