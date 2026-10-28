import * as migration_20260922_092212_initial from './20260922_092212_initial.js';
import * as migration_20260924_020209_site_settings_location from './20260924_020209_site_settings_location.js';
import * as migration_20260925_080550_hero_film_loading from './20260925_080550_hero_film_loading.js';
import * as migration_20260925_221226_hero_beat_photo from './20260925_221226_hero_beat_photo.js';
import * as migration_20260926_090554_c15t from './20260926_090554_c15t.js';
import * as migration_20260927_224712_site_settings_price_range from './20260927_224712_site_settings_price_range.js';
import * as migration_20260927_233158_faq_block from './20260927_233158_faq_block.js';
import * as migration_20260928_005048_jobs from './20260928_005048_jobs.js';
import * as migration_20261016_201855_plan_m_subscription_modules from './20261016_201855_plan_m_subscription_modules.js';
import * as migration_20261018_120000_next_cache from './20261018_120000_next_cache.js';
import * as migration_20261023_203917_footer_credit from './20261023_203917_footer_credit.js';

export const migrations = [
  {
    up: migration_20260922_092212_initial.up,
    down: migration_20260922_092212_initial.down,
    name: '20260922_092212_initial',
  },
  {
    up: migration_20260924_020209_site_settings_location.up,
    down: migration_20260924_020209_site_settings_location.down,
    name: '20260924_020209_site_settings_location',
  },
  {
    up: migration_20260925_080550_hero_film_loading.up,
    down: migration_20260925_080550_hero_film_loading.down,
    name: '20260925_080550_hero_film_loading',
  },
  {
    up: migration_20260925_221226_hero_beat_photo.up,
    down: migration_20260925_221226_hero_beat_photo.down,
    name: '20260925_221226_hero_beat_photo',
  },
  {
    up: migration_20260926_090554_c15t.up,
    down: migration_20260926_090554_c15t.down,
    name: '20260926_090554_c15t',
  },
  {
    up: migration_20260927_224712_site_settings_price_range.up,
    down: migration_20260927_224712_site_settings_price_range.down,
    name: '20260927_224712_site_settings_price_range',
  },
  {
    up: migration_20260927_233158_faq_block.up,
    down: migration_20260927_233158_faq_block.down,
    name: '20260927_233158_faq_block',
  },
  {
    up: migration_20260928_005048_jobs.up,
    down: migration_20260928_005048_jobs.down,
    name: '20260928_005048_jobs',
  },
  {
    up: migration_20261016_201855_plan_m_subscription_modules.up,
    down: migration_20261016_201855_plan_m_subscription_modules.down,
    name: '20261016_201855_plan_m_subscription_modules',
  },
  {
    up: migration_20261018_120000_next_cache.up,
    down: migration_20261018_120000_next_cache.down,
    name: '20261018_120000_next_cache',
  },
  {
    up: migration_20261023_203917_footer_credit.up,
    down: migration_20261023_203917_footer_credit.down,
    name: '20261023_203917_footer_credit'
  },
];
