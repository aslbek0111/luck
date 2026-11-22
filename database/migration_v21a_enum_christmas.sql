-- ==============================================================================
-- LUCKY UC - Migration V21A: Register Enum Value 'christmas'
-- Purpose:
-- Safely registers enum label 'christmas' in public.reward_category (if enum type exists).
-- Must be executed and committed BEFORE Migration V21B to avoid PostgreSQL 55P04:
-- "ERROR: unsafe use of new value of enum type".
-- Fully idempotent and safe to re-run.
-- ==============================================================================

DO $$
BEGIN
    -- Check if public.reward_category exists as an ENUM type (typtype = 'e')
    IF EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public' AND t.typname = 'reward_category' AND t.typtype = 'e'
    ) THEN
        -- Check if 'christmas' label is already registered
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum e
            JOIN pg_type t ON t.oid = e.enumtypid
            JOIN pg_namespace n ON n.oid = t.typnamespace
            WHERE n.nspname = 'public' AND t.typname = 'reward_category' AND e.enumlabel = 'christmas'
        ) THEN
            ALTER TYPE public.reward_category ADD VALUE IF NOT EXISTS 'christmas';
            RAISE NOTICE 'MIGRATION V21A: Enum label "christmas" successfully added to public.reward_category.';
        ELSE
            RAISE NOTICE 'MIGRATION V21A: Enum label "christmas" already exists in public.reward_category (skipping).';
        END IF;
    ELSE
        RAISE NOTICE 'MIGRATION V21A: Type public.reward_category does not exist or is not an enum (skipping).';
    END IF;
END $$;

