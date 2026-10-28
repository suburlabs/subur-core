declare global {
  namespace NodeJS {
    interface ProcessEnv {
      SUBUR_SECRET: string
      PREVIEW_SECRET: string
      CRON_SECRET: string
      DATABASE_URL: string
      NEXT_PUBLIC_SERVER_URL: string
      VERCEL_PROJECT_PRODUCTION_URL: string
    }
  }
}

// If this file has no import/export statements (i.e. is a script)
// convert it into a module by adding an empty export statement.
export {}
