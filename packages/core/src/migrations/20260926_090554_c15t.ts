import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Taules `c15t_*` per al backend de consentiment (spec §21.2). Migració
 * escrita a mà: el SQL s'ha capturat un cop amb el migrador de c15t (kysely)
 * contra una base de treball (`c15t_scratch`) i un `pg_dump --schema-only
 * -t 'c15t_*'`; la taula de control del migrador (`private_c15t_settings`)
 * queda fora, ja que les migracions de c15t no corren mai en producció.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE public."c15t_auditLog" (
        id character varying(255) NOT NULL,
        "entityType" text NOT NULL,
        "entityId" text NOT NULL,
        "actionType" text NOT NULL,
        "subjectId" text,
        "ipAddress" text,
        "userAgent" text,
        changes json,
        metadata json,
        "createdAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "tenantId" text
    );
    CREATE TABLE public.c15t_consent (
        id character varying(255) NOT NULL,
        "subjectId" text NOT NULL,
        "domainId" text NOT NULL,
        "policyId" text,
        "purposeIds" json NOT NULL,
        metadata json,
        "ipAddress" text,
        "userAgent" text,
        "givenAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "validUntil" timestamp without time zone,
        jurisdiction text,
        "jurisdictionModel" text,
        "tcString" text,
        "uiSource" text,
        "consentAction" text,
        "runtimePolicyDecisionId" text,
        "runtimePolicySource" text,
        "tenantId" text
    );
    CREATE TABLE public."c15t_consentPolicy" (
        id character varying(255) NOT NULL,
        version text NOT NULL,
        type text NOT NULL,
        hash text,
        "effectiveDate" timestamp without time zone NOT NULL,
        "isActive" boolean NOT NULL,
        "createdAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "tenantId" text
    );
    CREATE TABLE public."c15t_consentPurpose" (
        id character varying(255) NOT NULL,
        code text NOT NULL,
        "createdAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "updatedAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "tenantId" text
    );
    CREATE TABLE public.c15t_domain (
        id character varying(255) NOT NULL,
        name text NOT NULL,
        "createdAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "updatedAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "tenantId" text
    );
    CREATE TABLE public."c15t_runtimePolicyDecision" (
        id character varying(255) NOT NULL,
        "tenantId" text,
        "policyId" text NOT NULL,
        fingerprint text NOT NULL,
        "matchedBy" text NOT NULL,
        "countryCode" text,
        "regionCode" text,
        jurisdiction text NOT NULL,
        language text,
        model text NOT NULL,
        "policyI18n" json,
        "uiMode" text,
        "bannerUi" json,
        "dialogUi" json,
        categories json,
        "preselectedCategories" json,
        "proofConfig" json,
        "dedupeKey" text NOT NULL,
        "createdAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
    CREATE TABLE public.c15t_subject (
        id character varying(255) NOT NULL,
        "externalId" text,
        "identityProvider" text,
        "createdAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "updatedAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "tenantId" text
    );
    ALTER TABLE ONLY public."c15t_auditLog"
        ADD CONSTRAINT "c15t_auditLog_pkey" PRIMARY KEY (id);
    ALTER TABLE ONLY public."c15t_consentPolicy"
        ADD CONSTRAINT "c15t_consentPolicy_pkey" PRIMARY KEY (id);
    ALTER TABLE ONLY public."c15t_consentPurpose"
        ADD CONSTRAINT "c15t_consentPurpose_pkey" PRIMARY KEY (id);
    ALTER TABLE ONLY public.c15t_consent
        ADD CONSTRAINT c15t_consent_pkey PRIMARY KEY (id);
    ALTER TABLE ONLY public.c15t_domain
        ADD CONSTRAINT c15t_domain_pkey PRIMARY KEY (id);
    ALTER TABLE ONLY public."c15t_runtimePolicyDecision"
        ADD CONSTRAINT "c15t_runtimePolicyDecision_pkey" PRIMARY KEY (id);
    ALTER TABLE ONLY public.c15t_subject
        ADD CONSTRAINT c15t_subject_pkey PRIMARY KEY (id);
    ALTER TABLE ONLY public."c15t_runtimePolicyDecision"
        ADD CONSTRAINT "unique_c_runtimePolicyDecision_dedupeKey" UNIQUE ("dedupeKey");
    ALTER TABLE ONLY public."c15t_auditLog"
        ADD CONSTRAINT "auditLog_subject_subject_fk" FOREIGN KEY ("subjectId") REFERENCES public.c15t_subject(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
    ALTER TABLE ONLY public.c15t_consent
        ADD CONSTRAINT "consent_consentPolicy_policy_fk" FOREIGN KEY ("policyId") REFERENCES public."c15t_consentPolicy"(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
    ALTER TABLE ONLY public.c15t_consent
        ADD CONSTRAINT consent_domain_domain_fk FOREIGN KEY ("domainId") REFERENCES public.c15t_domain(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
    ALTER TABLE ONLY public.c15t_consent
        ADD CONSTRAINT "consent_runtimePolicyDecision_runtimePolicyDecision_fk" FOREIGN KEY ("runtimePolicyDecisionId") REFERENCES public."c15t_runtimePolicyDecision"(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
    ALTER TABLE ONLY public.c15t_consent
        ADD CONSTRAINT consent_subject_subject_fk FOREIGN KEY ("subjectId") REFERENCES public.c15t_subject(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "c15t_auditLog" CASCADE;
    DROP TABLE IF EXISTS "c15t_consent" CASCADE;
    DROP TABLE IF EXISTS "c15t_consentPolicy" CASCADE;
    DROP TABLE IF EXISTS "c15t_consentPurpose" CASCADE;
    DROP TABLE IF EXISTS "c15t_domain" CASCADE;
    DROP TABLE IF EXISTS "c15t_runtimePolicyDecision" CASCADE;
    DROP TABLE IF EXISTS "c15t_subject" CASCADE;
  `)
}
