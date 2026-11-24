-- ==============================================================================
-- LUCKY UC - Migration V23: Pre-Repair Backup Script (Audited & Hardened)
--
-- CRITICAL SAFETY RULES:
-- 1. Strictly append-only snapshotting: zero table drops, zero cascading deletes,
--    zero truncations. Never overwrites existing data.
-- 2. If ANY backup_v23_* table or metadata table already exists, aborts immediately
--    with an exception. Does not silently replace or destroy existing backups.
-- 3. SNAPSHOT ISOLATION LEVEL:
--    Uses "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;".
--    NOTE: A plain "BEGIN" (which defaults to READ COMMITTED in PostgreSQL) takes a
--    new snapshot for each query, leaving a window for race conditions if concurrent
--    transactions commit between table snapshots. REPEATABLE READ guarantees a single,
--    point-in-time consistent database snapshot across all source tables.
-- 4. ROBUST DATA INTEGRITY VALIDATION:
--    Row-count equality alone is insufficient. This script validates data integrity
--    for public.rewards_catalog using two independent mechanisms:
--    a) Bidirectional set difference (EXCEPT) across all 11 pre-V23 columns to detect
--       altered, missing, or extra rows.
--    b) A deterministic cryptographic MD5 hash over all row values with stable,
--       unambiguous primary-key ordering (ORDER BY id::TEXT).
--    The computed checksum and unique backup_run_id are recorded in public.backup_v23_metadata
--    so that the rollback script can verify zero corruption before restoring.
-- 5. UNIQUE BACKUP RUN IDENTIFIER:
--    Every snapshot row in backup_v23_metadata shares the exact same backup_run_id (UUID),
--    allowing the rollback script to verify that all snapshots belong to the same execution.
-- 6. ACCESS SECURITY HARDENING:
--    Explicitly revokes ALL privileges on every backup table, metadata table, and
--    sequence from PUBLIC, anon, and authenticated. Ordinary application users and
--    public PostgREST endpoints cannot read sensitive snapshots from the public schema.
-- 7. DATA-ONLY SNAPSHOT SEMANTICS & LIMITATIONS:
--    "CREATE TABLE ... AS SELECT" creates bare heap DATA-ONLY snapshots.
--    It does NOT copy indexes, foreign keys, primary keys, check constraints, triggers, or RLS policies.
--    The integrity checks audit all pre-V23 catalog columns (id, name, category,
--    rarity, icon_name, description, value, is_title, title_slug, is_active, conditions).
-- 8. CRITICAL ROLLBACK SAFETY POLICY:
--    Live user balances (coins_balance, points_balance) and live user inventories in
--    public.users and public.user_inventory are strictly PRESERVED during rollback.
--    The snapshots of users and user_inventory are created here solely for audit and
--    state inspection. The V23 rollback script is strictly prohibited from overwriting
--    live user balances or inventory from these snapshots.
-- ==============================================================================

BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;

DO $$
DECLARE
    -- Unique backup run identifier shared across all metadata records
    v_backup_run_id UUID := gen_random_uuid();
    v_backup_tag TEXT := 'V23_PRE_REPAIR';

    -- Source and backup row count variables
    v_src_rewards BIGINT;
    v_bak_rewards BIGINT;
    v_src_users BIGINT;
    v_bak_users BIGINT;
    v_src_inventory BIGINT;
    v_bak_inventory BIGINT;
    v_src_purchases BIGINT := 0;
    v_bak_purchases BIGINT := 0;

    -- Integrity variables
    v_diff_src_bak BIGINT := 0;
    v_diff_bak_src BIGINT := 0;
    v_src_rewards_checksum TEXT;
    v_bak_rewards_checksum TEXT;
    v_missing_core_ids INTEGER;

    v_has_purchases_history BOOLEAN;
    v_existing_table TEXT;
BEGIN
    -- --------------------------------------------------------------------------
    -- 1. ABORT IF ANY BACKUP TABLE OR METADATA ALREADY EXISTS
    -- --------------------------------------------------------------------------
    SELECT table_name INTO v_existing_table
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN (
          'backup_v23_metadata',
          'backup_v23_rewards_catalog',
          'backup_v23_users',
          'backup_v23_user_inventory',
          'backup_v23_purchases_history'
      )
    LIMIT 1;

    IF v_existing_table IS NOT NULL THEN
        RAISE EXCEPTION 'BACKUP V23 ABORTED: Table public.% already exists. Refusing to overwrite existing backup. If a new backup is needed, archive or resolve existing backup tables manually.', v_existing_table;
    END IF;

    -- --------------------------------------------------------------------------
    -- 2. VERIFY REQUIRED SOURCE TABLES EXIST
    -- --------------------------------------------------------------------------
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rewards_catalog') THEN
        RAISE EXCEPTION 'BACKUP V23 ABORTED: Required source table public.rewards_catalog does not exist.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
        RAISE EXCEPTION 'BACKUP V23 ABORTED: Required source table public.users does not exist.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_inventory') THEN
        RAISE EXCEPTION 'BACKUP V23 ABORTED: Required source table public.user_inventory does not exist.';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'purchases_history'
    ) INTO v_has_purchases_history;

    -- --------------------------------------------------------------------------
    -- 3. CREATE BACKUP METADATA TABLE WITH FULL PROVENANCE
    -- --------------------------------------------------------------------------
    CREATE TABLE public.backup_v23_metadata (
        id SERIAL PRIMARY KEY,
        backup_run_id UUID NOT NULL,
        backup_tag TEXT NOT NULL DEFAULT 'V23_PRE_REPAIR',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_by TEXT NOT NULL DEFAULT current_user,
        source_schema TEXT NOT NULL DEFAULT 'public',
        source_table TEXT NOT NULL,
        backup_table TEXT NOT NULL,
        source_row_count BIGINT NOT NULL,
        backup_row_count BIGINT NOT NULL,
        checksum TEXT,
        status TEXT NOT NULL DEFAULT 'IN_PROGRESS'
    );

    -- --------------------------------------------------------------------------
    -- 4. SNAPSHOT: public.rewards_catalog & DATA INTEGRITY VERIFICATION
    -- --------------------------------------------------------------------------
    SELECT COUNT(*) INTO v_src_rewards FROM public.rewards_catalog;

    IF v_src_rewards < 40 THEN
        RAISE EXCEPTION 'BACKUP V23 ABORTED: public.rewards_catalog row count is suspiciously low (%). Aborting.', v_src_rewards;
    END IF;

    -- Verify key expected reward UUIDs exist in source
    SELECT COUNT(*) INTO v_missing_core_ids
    FROM (
        VALUES 
            ('10000000-0000-0000-0000-000000000007'::UUID), -- Роза (reward-rose-1)
            ('10000000-0000-0000-0000-000000000003'::UUID), -- Популярность +10 (reward-pop-10)
            ('10000000-0000-0000-0000-000000000076'::UUID), -- Balbibol (title-balbibol)
            ('10000000-0000-0000-0000-000000000065'::UUID)  -- Оверлорд (title-overlord)
    ) t(id)
    WHERE NOT EXISTS (
        SELECT 1 FROM public.rewards_catalog r WHERE r.id = t.id
    );

    IF v_missing_core_ids > 0 THEN
        RAISE EXCEPTION 'BACKUP V23 ABORTED: public.rewards_catalog is missing % required core catalog UUIDs.', v_missing_core_ids;
    END IF;

    CREATE TABLE public.backup_v23_rewards_catalog AS
    SELECT * FROM public.rewards_catalog;

    SELECT COUNT(*) INTO v_bak_rewards FROM public.backup_v23_rewards_catalog;

    IF v_src_rewards <> v_bak_rewards THEN
        RAISE EXCEPTION 'BACKUP V23 ABORTED: Row count mismatch for rewards_catalog! Source: %, Backup: %', v_src_rewards, v_bak_rewards;
    END IF;

    -- 4.1 Check content differences via bidirectional EXCEPT across all 11 columns
    SELECT COUNT(*) INTO v_diff_src_bak
    FROM (
        SELECT id, name, category, rarity, icon_name, description, value, is_title, title_slug, is_active, conditions
        FROM public.rewards_catalog
        EXCEPT
        SELECT id, name, category, rarity, icon_name, description, value, is_title, title_slug, is_active, conditions
        FROM public.backup_v23_rewards_catalog
    ) d1;

    SELECT COUNT(*) INTO v_diff_bak_src
    FROM (
        SELECT id, name, category, rarity, icon_name, description, value, is_title, title_slug, is_active, conditions
        FROM public.backup_v23_rewards_catalog
        EXCEPT
        SELECT id, name, category, rarity, icon_name, description, value, is_title, title_slug, is_active, conditions
        FROM public.rewards_catalog
    ) d2;

    IF v_diff_src_bak > 0 OR v_diff_bak_src > 0 THEN
        RAISE EXCEPTION 'BACKUP V23 ABORTED: Content mismatch detected between source rewards_catalog and backup (diff: % vs %)!', v_diff_src_bak, v_diff_bak_src;
    END IF;

    -- 4.2 Deterministic cryptographic hash (MD5) with stable row ordering (ORDER BY id::TEXT), including conditions
    SELECT md5(string_agg(
        md5(
            COALESCE(id::TEXT, '') || '::' ||
            COALESCE(name, '') || '::' ||
            COALESCE(category, '') || '::' ||
            COALESCE(rarity, '') || '::' ||
            COALESCE(icon_name, '') || '::' ||
            COALESCE(description, '') || '::' ||
            COALESCE(value::TEXT, '') || '::' ||
            COALESCE(is_title::TEXT, '') || '::' ||
            COALESCE(title_slug, '') || '::' ||
            COALESCE(is_active::TEXT, '') || '::' ||
            COALESCE(conditions, '')
        ),
        ',' ORDER BY id::TEXT
    )) INTO v_src_rewards_checksum
    FROM public.rewards_catalog;

    SELECT md5(string_agg(
        md5(
            COALESCE(id::TEXT, '') || '::' ||
            COALESCE(name, '') || '::' ||
            COALESCE(category, '') || '::' ||
            COALESCE(rarity, '') || '::' ||
            COALESCE(icon_name, '') || '::' ||
            COALESCE(description, '') || '::' ||
            COALESCE(value::TEXT, '') || '::' ||
            COALESCE(is_title::TEXT, '') || '::' ||
            COALESCE(title_slug, '') || '::' ||
            COALESCE(is_active::TEXT, '') || '::' ||
            COALESCE(conditions, '')
        ),
        ',' ORDER BY id::TEXT
    )) INTO v_bak_rewards_checksum
    FROM public.backup_v23_rewards_catalog;

    IF v_src_rewards_checksum IS NULL OR v_src_rewards_checksum <> v_bak_rewards_checksum THEN
        RAISE EXCEPTION 'BACKUP V23 ABORTED: Checksum verification failed for rewards_catalog! Source: %, Backup: %', v_src_rewards_checksum, v_bak_rewards_checksum;
    END IF;

    INSERT INTO public.backup_v23_metadata (
        backup_run_id,
        backup_tag,
        source_table,
        backup_table,
        source_row_count,
        backup_row_count,
        checksum,
        status
    )
    VALUES (
        v_backup_run_id,
        v_backup_tag,
        'rewards_catalog',
        'backup_v23_rewards_catalog',
        v_src_rewards,
        v_bak_rewards,
        v_src_rewards_checksum,
        'VERIFIED'
    );

    -- --------------------------------------------------------------------------
    -- 5. SNAPSHOT: public.users (AUDIT-ONLY SNAPSHOT)
    -- --------------------------------------------------------------------------
    SELECT COUNT(*) INTO v_src_users FROM public.users;

    CREATE TABLE public.backup_v23_users AS
    SELECT * FROM public.users;

    SELECT COUNT(*) INTO v_bak_users FROM public.backup_v23_users;

    IF v_src_users <> v_bak_users THEN
        RAISE EXCEPTION 'BACKUP V23 ABORTED: Row count mismatch for users! Source: %, Backup: %', v_src_users, v_bak_users;
    END IF;

    INSERT INTO public.backup_v23_metadata (
        backup_run_id,
        backup_tag,
        source_table,
        backup_table,
        source_row_count,
        backup_row_count,
        status
    )
    VALUES (
        v_backup_run_id,
        v_backup_tag,
        'users',
        'backup_v23_users',
        v_src_users,
        v_bak_users,
        'VERIFIED'
    );

    -- --------------------------------------------------------------------------
    -- 6. SNAPSHOT: public.user_inventory (AUDIT-ONLY SNAPSHOT)
    -- --------------------------------------------------------------------------
    SELECT COUNT(*) INTO v_src_inventory FROM public.user_inventory;

    CREATE TABLE public.backup_v23_user_inventory AS
    SELECT * FROM public.user_inventory;

    SELECT COUNT(*) INTO v_bak_inventory FROM public.backup_v23_user_inventory;

    IF v_src_inventory <> v_bak_inventory THEN
        RAISE EXCEPTION 'BACKUP V23 ABORTED: Row count mismatch for user_inventory! Source: %, Backup: %', v_src_inventory, v_bak_inventory;
    END IF;

    INSERT INTO public.backup_v23_metadata (
        backup_run_id,
        backup_tag,
        source_table,
        backup_table,
        source_row_count,
        backup_row_count,
        status
    )
    VALUES (
        v_backup_run_id,
        v_backup_tag,
        'user_inventory',
        'backup_v23_user_inventory',
        v_src_inventory,
        v_bak_inventory,
        'VERIFIED'
    );

    -- --------------------------------------------------------------------------
    -- 7. SNAPSHOT: public.purchases_history (if exists)
    -- --------------------------------------------------------------------------
    IF v_has_purchases_history THEN
        SELECT COUNT(*) INTO v_src_purchases FROM public.purchases_history;

        CREATE TABLE public.backup_v23_purchases_history AS
        SELECT * FROM public.purchases_history;

        SELECT COUNT(*) INTO v_bak_purchases FROM public.backup_v23_purchases_history;

        IF v_src_purchases <> v_bak_purchases THEN
            RAISE EXCEPTION 'BACKUP V23 ABORTED: Row count mismatch for purchases_history! Source: %, Backup: %', v_src_purchases, v_bak_purchases;
        END IF;

        INSERT INTO public.backup_v23_metadata (
            backup_run_id,
            backup_tag,
            source_table,
            backup_table,
            source_row_count,
            backup_row_count,
            status
        )
        VALUES (
            v_backup_run_id,
            v_backup_tag,
            'purchases_history',
            'backup_v23_purchases_history',
            v_src_purchases,
            v_bak_purchases,
            'VERIFIED'
        );
    END IF;

    RAISE NOTICE '✅ [BACKUP V23] ALL DATA INTEGRITY CHECKS PASSED.';
    RAISE NOTICE '  - Backup Run ID: %', v_backup_run_id;
    RAISE NOTICE '  - rewards_catalog: % rows backed up (Checksum: %)', v_bak_rewards, v_src_rewards_checksum;
    RAISE NOTICE '  - users: % rows backed up', v_bak_users;
    RAISE NOTICE '  - user_inventory: % rows backed up', v_bak_inventory;
    IF v_has_purchases_history THEN
        RAISE NOTICE '  - purchases_history: % rows backed up', v_bak_purchases;
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 8. STRICT ACCESS CONTROL HARDENING
-- Revoke ALL privileges on all backup and metadata objects from untrusted roles
-- ------------------------------------------------------------------------------
REVOKE ALL ON TABLE public.backup_v23_metadata FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.backup_v23_metadata_id_seq FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.backup_v23_rewards_catalog FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.backup_v23_users FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.backup_v23_user_inventory FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'backup_v23_purchases_history') THEN
        REVOKE ALL ON TABLE public.backup_v23_purchases_history FROM PUBLIC, anon, authenticated;
        GRANT SELECT ON TABLE public.backup_v23_purchases_history TO postgres, service_role;
    END IF;
END $$;

GRANT SELECT ON TABLE public.backup_v23_metadata TO postgres, service_role;
GRANT SELECT ON TABLE public.backup_v23_rewards_catalog TO postgres, service_role;
GRANT SELECT ON TABLE public.backup_v23_users TO postgres, service_role;
GRANT SELECT ON TABLE public.backup_v23_user_inventory TO postgres, service_role;

-- ------------------------------------------------------------------------------
-- 9. AUDIT VERIFICATION OF METADATA RECORDS
-- ------------------------------------------------------------------------------
SELECT 
    id,
    backup_run_id,
    backup_tag,
    source_table,
    backup_table,
    source_row_count,
    backup_row_count,
    checksum,
    status,
    created_at,
    created_by
FROM public.backup_v23_metadata
ORDER BY id ASC;

COMMIT;
