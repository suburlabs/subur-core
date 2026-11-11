import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_settings_locales" ADD COLUMN "ui_hero_film_play" varchar;
  ALTER TABLE "site_settings_locales" ADD COLUMN "ui_hero_film_play_touch" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_settings_locales" DROP COLUMN "ui_hero_film_play";
  ALTER TABLE "site_settings_locales" DROP COLUMN "ui_hero_film_play_touch";`)
}
