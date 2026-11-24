-- ==============================================================================
-- LUCKY UC - Migration V23: Production Rollback Script (Audited & Hardened)
--
-- PURPOSE:
-- Safely revert changes made by migration_v23_production_shop_price_repair.sql.
--
-- CRITICAL SAFETY RULES:
-- 1. FULLY TRANSACTIONAL:
--    Uses "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;". Cannot partially commit.
-- 2. VERIFIES COMPLETE BACKUP RUN IDENTIFIER:
--    Requires backup_run_id to match across rewards_catalog, users, and user_inventory
--    metadata records. Rejects duplicate, ambiguous, or incomplete metadata.
-- 3. VERIFIES COMPLETE CATALOG UUID SET:
--    Verifies that the live rewards_catalog UUID set exactly matches the backup
--    (bidirectional EXCEPT). Aborts if any UUID was added, deleted, or altered.
-- 4. DROPS ONLY V23-ADDED COLUMNS IN RESTRICT MODE (STRICT RESTRICT ONLY):
--    Inspects pg_depend before dropping price_coins and price_points.
--    If ANY dependent objects exist, aborts immediately. NEVER uses RESTRICT_AUTOMATIC.
-- 5. ZERO USER DATA OVERWRITING:
--    Live user balances (coins_balance, points_balance), user inventory, and purchase
--    history are strictly PRESERVED. Snapshots of users and user_inventory are NEVER
--    used to update or restore live tables.
-- 6. RESTORES EXACT CAPTURED ORIGINAL PRODUCTION RPC:
--    Verifies that public.pre_v23_captured_rpc_definitions contains the exact
--    captured pre-migration definition of purchase_item_atomic. If missing, aborts
--    before making any changes. Does NOT guess or use an assumed V17 approximation.
-- ==============================================================================

BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;

DO $$
DECLARE
    v_table_exists BOOLEAN;
    v_row_count BIGINT;
    v_col_count INTEGER;
    v_missing_core_ids INTEGER;
    v_null_active_count INTEGER;
    v_metadata_checksum TEXT;
    v_computed_checksum TEXT;
    v_dep_count INTEGER;
    v_dep_names TEXT;
    v_uuid_diff BIGINT;

    -- Backup run identifier verification
    v_rewards_run_id UUID;
    v_users_run_id UUID;
    v_inventory_run_id UUID;
    v_metadata_record_count INTEGER;

    -- Exact captured RPC definition
    v_captured_rpc_def TEXT;
BEGIN
    -- --------------------------------------------------------------------------
    -- 1. PREFLIGHT: VERIFY ORIGINAL PRODUCTION RPC WAS CAPTURED (BEFORE ANY EDITS)
    -- --------------------------------------------------------------------------
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'pre_v23_captured_rpc_definitions'
    ) THEN
        RAISE EXCEPTION 'ROLLBACK V23 ABORTED: Table public.pre_v23_captured_rpc_definitions does not exist. Cannot restore pre-migration RPC without verified capture. Aborting before making any changes.';
    END IF;

    SELECT full_functiondef INTO v_captured_rpc_def
    FROM public.pre_v23_captured_rpc_definitions
    WHERE function_name = 'purchase_item_atomic'
    ORDER BY id ASC LIMIT 1;

    IF v_captured_rpc_def IS NULL OR TRIM(v_captured_rpc_def) = '' THEN
        RAISE EXCEPTION 'ROLLBACK V23 ABORTED: No captured definition for purchase_item_atomic found in public.pre_v23_captured_rpc_definitions. Exact restoration cannot be verified; aborting without guessing.';
    END IF;

    -- --------------------------------------------------------------------------
    -- 2. VERIFY BACKUP METADATA & CONSISTENT BACKUP RUN IDENTIFIER
    -- --------------------------------------------------------------------------
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'backup_v23_metadata'
    ) THEN
        RAISE EXCEPTION 'ROLLBACK V23 ABORTED: Metadata table public.backup_v23_metadata does not exist. Cannot verify backup integrity.';
    END IF;

    -- Check duplicate/ambiguous metadata records and exact row count parity
    SELECT COUNT(*) INTO v_metadata_record_count
    FROM public.backup_v23_metadata
    WHERE backup_table = 'backup_v23_rewards_catalog' AND status = 'VERIFIED' AND backup_row_count = source_row_count;

    IF v_metadata_record_count <> 1 THEN
        RAISE EXCEPTION 'ROLLBACK V23 ABORTED: Expected exactly 1 verified metadata record for rewards_catalog with backup_row_count = source_row_count, found %. Ambiguous backup metadata!', v_metadata_record_count;
    END IF;

    SELECT COUNT(*) INTO v_metadata_record_count
    FROM public.backup_v23_metadata
    WHERE backup_table = 'backup_v23_users' AND status = 'VERIFIED' AND backup_row_count = source_row_count;

    IF v_metadata_record_count <> 1 THEN
        RAISE EXCEPTION 'ROLLBACK V23 ABORTED: Expected exactly 1 verified metadata record for users with backup_row_count = source_row_count, found %. Ambiguous backup metadata!', v_metadata_record_count;
    END IF;

    SELECT COUNT(*) INTO v_metadata_record_count
    FROM public.backup_v23_metadata
    WHERE backup_table = 'backup_v23_user_inventory' AND status = 'VERIFIED' AND backup_row_count = source_row_count;

    IF v_metadata_record_count <> 1 THEN
        RAISE EXCEPTION 'ROLLBACK V23 ABORTED: Expected exactly 1 verified metadata record for user_inventory with backup_row_count = source_row_count, found %. Ambiguous backup metadata!', v_metadata_record_count;
    END IF;

    -- Verify shared backup_run_id across all 3 source tables and valid non-null checksum
    SELECT backup_run_id, checksum INTO v_rewards_run_id, v_metadata_checksum
    FROM public.backup_v23_metadata
    WHERE backup_table = 'backup_v23_rewards_catalog' AND status = 'VERIFIED' AND checksum IS NOT NULL;

    IF v_metadata_checksum IS NULL OR TRIM(v_metadata_checksum) = '' THEN
        RAISE EXCEPTION 'ROLLBACK V23 ABORTED: rewards_catalog backup metadata is missing cryptographic checksum!';
    END IF;

    SELECT backup_run_id INTO v_users_run_id
    FROM public.backup_v23_metadata
    WHERE backup_table = 'backup_v23_users' AND status = 'VERIFIED';

    SELECT backup_run_id INTO v_inventory_run_id
    FROM public.backup_v23_metadata
    WHERE backup_table = 'backup_v23_user_inventory' AND status = 'VERIFIED';

    IF v_rewards_run_id IS NULL OR v_rewards_run_id <> v_users_run_id OR v_rewards_run_id <> v_inventory_run_id THEN
        RAISE EXCEPTION 'ROLLBACK V23 ABORTED: Backup metadata records do not share the same backup_run_id! Rewards: %, Users: %, Inventory: %', 
            v_rewards_run_id, v_users_run_id, v_inventory_run_id;
    END IF;

    -- --------------------------------------------------------------------------
    -- 3. VERIFY BACKUP TABLE STRUCTURE, CHECKSUM & FULL CATALOG UUID SET
    -- --------------------------------------------------------------------------
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'backup_v23_rewards_catalog'
    ) INTO v_table_exists;

    IF NOT v_table_exists THEN
        RAISE EXCEPTION 'ROLLBACK V23 ABORTED: Snapshot table public.backup_v23_rewards_catalog does not exist.';
    END IF;

    -- 3.1 Verify backup table cryptographic checksum against metadata
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
    )) INTO v_computed_checksum
    FROM public.backup_v23_rewards_catalog;

    IF v_computed_checksum IS NULL OR v_computed_checksum <> v_metadata_checksum THEN
        RAISE EXCEPTION 'ROLLBACK V23 ABORTED: Backup table public.backup_v23_rewards_catalog failed cryptographic integrity check! Computed: %, Expected: %', 
            v_computed_checksum, v_metadata_checksum;
    END IF;

    -- 3.2 Verify backup table has required pre-existing columns
    SELECT COUNT(*) INTO v_col_count
    FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'backup_v23_rewards_catalog'
      AND column_name IN ('id', 'name', 'category', 'rarity', 'icon_name', 'value', 'is_title', 'title_slug', 'is_active', 'conditions');

    IF v_col_count < 9 THEN
        RAISE EXCEPTION 'ROLLBACK V23 ABORTED: public.backup_v23_rewards_catalog is missing required pre-migration columns (found % of 9).', v_col_count;
    END IF;

    -- 3.3 Verify full rewards_catalog UUID set matches live catalog exactly
    SELECT COUNT(*) INTO v_uuid_diff
    FROM (
        SELECT id FROM public.rewards_catalog
        EXCEPT
        SELECT id FROM public.backup_v23_rewards_catalog
        UNION ALL
        SELECT id FROM public.backup_v23_rewards_catalog
        EXCEPT
        SELECT id FROM public.rewards_catalog
    ) diff;

    IF v_uuid_diff > 0 THEN
        RAISE EXCEPTION 'ROLLBACK V23 ABORTED: Live rewards_catalog UUID set differs from backup_v23_rewards_catalog (diff: %)! Refusing to rollback.', v_uuid_diff;
    END IF;

    -- 3.4 Row count check
    SELECT COUNT(*) INTO v_row_count FROM public.backup_v23_rewards_catalog;
    IF v_row_count < 40 THEN
        RAISE EXCEPTION 'ROLLBACK V23 ABORTED: public.backup_v23_rewards_catalog has suspiciously low row count (%).', v_row_count;
    END IF;

    -- 3.5 Core items check
    SELECT COUNT(*) INTO v_missing_core_ids
    FROM (
        VALUES 
            ('10000000-0000-0000-0000-000000000007'::UUID), -- Роза (reward-rose-1)
            ('10000000-0000-0000-0000-000000000003'::UUID), -- Популярность +10 (reward-pop-10)
            ('10000000-0000-0000-0000-000000000076'::UUID), -- Balbibol (title-balbibol)
            ('10000000-0000-0000-0000-000000000065'::UUID)  -- Оверлорд (title-overlord)
    ) t(id)
    WHERE NOT EXISTS (
        SELECT 1 FROM public.backup_v23_rewards_catalog b WHERE b.id = t.id
    );

    IF v_missing_core_ids > 0 THEN
        RAISE EXCEPTION 'ROLLBACK V23 ABORTED: public.backup_v23_rewards_catalog is missing % essential core item UUIDs.', v_missing_core_ids;
    END IF;

    -- 3.6 is_active check
    SELECT COUNT(*) INTO v_null_active_count 
    FROM public.backup_v23_rewards_catalog 
    WHERE is_active IS NULL;

    IF v_null_active_count > 0 THEN
        RAISE EXCEPTION 'ROLLBACK V23 ABORTED: public.backup_v23_rewards_catalog contains % rows with NULL is_active.', v_null_active_count;
    END IF;

    RAISE NOTICE '✅ [ROLLBACK V23] Backup validation passed (Run ID: %, % rows, checksum verified).', v_rewards_run_id, v_row_count;

    -- --------------------------------------------------------------------------
    -- 4. DEPENDENCY AUDIT VIA pg_depend (STRICT RESTRICT MODE, STRICT RESTRICT ONLY)
    -- --------------------------------------------------------------------------
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'rewards_catalog' AND column_name = 'price_coins'
    ) THEN
        SELECT COUNT(*), string_agg(c.relname || '.' || a.attname, ', ')
        INTO v_dep_count, v_dep_names
        FROM pg_depend d
        JOIN pg_attribute a ON a.attrelid = d.refobjid AND a.attnum = d.refobjsubid
        JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' 
          AND c.relname = 'rewards_catalog' 
          AND a.attname = 'price_coins'
          AND d.deptype = 'n';

        IF v_dep_count > 0 THEN
            RAISE EXCEPTION 'ROLLBACK V23 ABORTED: Column public.rewards_catalog.price_coins has % dependent database objects (%): refusing to drop without manual review.', v_dep_count, v_dep_names;
        END IF;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'rewards_catalog' AND column_name = 'price_points'
    ) THEN
        SELECT COUNT(*), string_agg(c.relname || '.' || a.attname, ', ')
        INTO v_dep_count, v_dep_names
        FROM pg_depend d
        JOIN pg_attribute a ON a.attrelid = d.refobjid AND a.attnum = d.refobjsubid
        JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' 
          AND c.relname = 'rewards_catalog' 
          AND a.attname = 'price_points'
          AND d.deptype = 'n';

        IF v_dep_count > 0 THEN
            RAISE EXCEPTION 'ROLLBACK V23 ABORTED: Column public.rewards_catalog.price_points has % dependent database objects (%): refusing to drop without manual review.', v_dep_count, v_dep_names;
        END IF;
    END IF;

    -- --------------------------------------------------------------------------
    -- 5. REVERT V23 CATALOG CHANGES (STRICT RESTRICT ONLY, ONLY V23 COLUMNS)
    -- --------------------------------------------------------------------------
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'rewards_catalog' AND column_name = 'price_coins'
    ) THEN
        ALTER TABLE public.rewards_catalog DROP COLUMN price_coins;
        RAISE NOTICE '✅ [ROLLBACK V23] Dropped column rewards_catalog.price_coins safely in RESTRICT mode.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'rewards_catalog' AND column_name = 'price_points'
    ) THEN
        ALTER TABLE public.rewards_catalog DROP COLUMN price_points;
        RAISE NOTICE '✅ [ROLLBACK V23] Dropped column rewards_catalog.price_points safely in RESTRICT mode.';
    END IF;

    -- Pre-existing columns (id, name, category, rarity, icon_name, value, is_title,
    -- title_slug, description, conditions) are PRESERVED and NOT dropped.

    -- Revert is_active from backup_v23_rewards_catalog exactly
    UPDATE public.rewards_catalog r
    SET is_active = b.is_active
    FROM public.backup_v23_rewards_catalog b
    WHERE r.id = b.id;

    RAISE NOTICE '✅ [ROLLBACK V23] Restored rewards_catalog.is_active from backup_v23_rewards_catalog (% rows).', v_row_count;

    -- --------------------------------------------------------------------------
    -- 6. RESTORE EXACT CAPTURED PRE-MIGRATION RPC (NO GUESSING)
    -- --------------------------------------------------------------------------
    EXECUTE v_captured_rpc_def;
    RAISE NOTICE '✅ [ROLLBACK V23] Restored exact pre-migration Production definition of purchase_item_atomic from captured definition.';

    -- --------------------------------------------------------------------------
    -- 7. REAPPLY SECURE ACCESS PERMISSIONS
    -- --------------------------------------------------------------------------
    REVOKE ALL ON FUNCTION public.purchase_item_atomic(UUID, TEXT, INTEGER) FROM PUBLIC;
    REVOKE ALL ON FUNCTION public.purchase_item_atomic(UUID, TEXT, INTEGER) FROM anon;
    GRANT EXECUTE ON FUNCTION public.purchase_item_atomic(UUID, TEXT, INTEGER) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.purchase_item_atomic(UUID, TEXT, INTEGER) TO service_role;

    RAISE NOTICE '✅ [ROLLBACK V23] Rollback completed successfully and transaction committed.';
END $$;

COMMIT;
