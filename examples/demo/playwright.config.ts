import { defineConfig, devices } from '@playwright/test'
import 'dotenv/config'

/** La demo escolta al 3200: una altra web en dev al 3000 no s'ha de reutilitzar mai com a servidor d'aquestes proves. */
const BASE_URL = 'http://localhost:3200'

export default defineConfig({
  testDir: './tests/e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // En sèrie: tots els treballadors comparteixen la mateixa base sembrada i en paral·lel es trepitjarien el contingut.
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: BASE_URL,
    // L'idioma del navegador, fix: decideix la redirecció d'idioma de la web i l'idioma del panell. Les proves copiades de
    // l'arrel esperen el panell en anglès (`span[title="Dashboard"]` a helpers/login.ts), que és el que donava el Chromium
    // per defecte en local i al runner del CI; amb `ca-ES` el panell surt en català i 13 proves del panell fallen (T20, ronda 2).
    locale: 'en-US',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: 'chromium' },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    reuseExistingServer: true,
    url: BASE_URL,
  },
})
