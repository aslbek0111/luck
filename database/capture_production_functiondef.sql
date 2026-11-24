-- ==============================================================================
-- LUCKY UC: PRODUCTION RPC CAPTURE & AUDIT SCRIPT
-- ==============================================================================
-- 
-- PURPOSE:
-- Safely inspect and capture the exact existing Production definition of
-- public.purchase_item_atomic(UUID, TEXT, INTEGER) and public.sell_duplicate_atomic
-- using PostgreSQL's pg_get_functiondef and system catalog inspection.
--
-- SECTIONS:
-- PART 1: 100% READ-ONLY DIAGNOSTIC INSPECTION
--   - Does NOT modify the database in any way (ZERO CREATE, ZERO INSERT, ZERO GRANT/REVOKE).
--   - Safe to run in Supabase SQL editor at any time.
--   - Captures: full definition, arguments, return type, security definer, volatility,
--     configuration/search_path, owner, and execute ACL permissions.
--
-- PART 2: OPTIONAL PERSISTENT CAPTURE SCRIPT (MODIFIES DATABASE: DDL & DML)
--   - Statements that MODIFY the database:
--       * CREATE TABLE IF NOT EXISTS public.pre_v23_captured_rpc_definitions
--       * REVOKE / GRANT statements restricting access to postgres and service_role
--       * PL/pgSQL validation and INSERT block
--   - SAFETY GUARD: Compares existing captured definition against live pg_get_functiondef.
--     If an existing capture differs from the current live Production definition,
--     it FAILS VISIBLY with an exception. NEVER overwrites an original capture.
-- ==============================================================================


-- ==============================================================================
-- PART 1: 100% READ-ONLY DIAGNOSTIC INSPECTION (DOES NOT MODIFY DATABASE)
-- ==============================================================================
-- Run this query to view all attributes and source code of the live functions.

SELECT 
    n.nspname AS schema_name,
    p.proname AS function_name,
    pg_get_function_identity_arguments(p.oid) AS argument_signature,
    pg_get_function_result(p.oid) AS return_type,
    p.prosecdef AS is_security_definer,
    CASE p.provolatile
        WHEN 'i' THEN 'IMMUTABLE'
        WHEN 's' THEN 'STABLE'
        WHEN 'v' THEN 'VOLATILE'
    END AS volatility,
    COALESCE(array_to_string(p.proconfig, ', '), 'NONE') AS configuration_search_path,
    pg_get_userbyid(p.proowner) AS function_owner,
    COALESCE(p.proacl::TEXT, 'DEFAULT') AS execute_permissions_acl,
    pg_get_functiondef(p.oid) AS exact_function_definition,
    NOW() AS inspection_time
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' 
  AND p.proname IN ('purchase_item_atomic', 'sell_duplicate_atomic')
ORDER BY p.proname;


-- ==============================================================================
-- PART 2: OPTIONAL PERSISTENT CAPTURE SCRIPT (MODIFIES DATABASE: DDL & DML)
-- ==============================================================================
-- NOTE: The statements below MODIFY the database schema and table data.
-- Run this section only when you wish to record a persistent snapshot table in Supabase.

-- 2.1 CREATE CAPTURE TABLE (DDL: Modifies Schema)
CREATE TABLE IF NOT EXISTS public.pre_v23_captured_rpc_definitions (
    id SERIAL PRIMARY KEY,
    function_name TEXT NOT NULL,
    argument_signature TEXT NOT NULL,
    return_type TEXT NOT NULL,
    is_security_definer BOOLEAN NOT NULL,
    volatility TEXT NOT NULL,
    configuration_search_path TEXT,
    function_owner TEXT NOT NULL,
    execute_permissions_acl TEXT,
    full_functiondef TEXT NOT NULL,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.2 ACCESS CONTROL (DCL: Modifies Permissions)
REVOKE ALL ON TABLE public.pre_v23_captured_rpc_definitions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.pre_v23_captured_rpc_definitions TO postgres, service_role;

-- 2.3 CAPTURE VERIFICATION & SAFE INSERT (DML: Validates & Modifies Table Data)
DO $$
DECLARE
    r RECORD;
    v_existing_def TEXT;
    v_existing_captured_at TIMESTAMPTZ;
BEGIN
    FOR r IN (
        SELECT 
            p.proname AS func_name,
            pg_get_function_identity_arguments(p.oid) AS arg_sig,
            pg_get_function_result(p.oid) AS ret_type,
            p.prosecdef AS sec_def,
            CASE p.provolatile
                WHEN 'i' THEN 'IMMUTABLE'
                WHEN 's' THEN 'STABLE'
                WHEN 'v' THEN 'VOLATILE'
            END AS vol,
            COALESCE(array_to_string(p.proconfig, ', '), 'NONE') AS cfg_path,
            pg_get_userbyid(p.proowner) AS fn_owner,
            COALESCE(p.proacl::TEXT, 'DEFAULT') AS acl_perms,
            pg_get_functiondef(p.oid) AS cur_def
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' 
          AND p.proname IN ('purchase_item_atomic', 'sell_duplicate_atomic')
    ) LOOP
        -- Check if an earlier capture already exists for this function
        SELECT full_functiondef, captured_at 
        INTO v_existing_def, v_existing_captured_at
        FROM public.pre_v23_captured_rpc_definitions
        WHERE function_name = r.func_name
        ORDER BY id ASC LIMIT 1;

        IF v_existing_def IS NOT NULL THEN
            -- Stale capture detection: Compare live definition against captured definition
            IF v_existing_def <> r.cur_def THEN
                RAISE EXCEPTION 'CAPTURE MISMATCH DETECTED: Function public.% in pre_v23_captured_rpc_definitions (captured at %) differs from current live Production definition! Aborting to prevent treating stale snapshot as current. The original capture was NOT overwritten.', 
                    r.func_name, v_existing_captured_at;
            ELSE
                RAISE NOTICE 'ℹ️ [CAPTURE] Function public.% is already captured (at %) and matches current Production definition.', 
                    r.func_name, v_existing_captured_at;
            END IF;
        ELSE
            -- Insert initial capture
            INSERT INTO public.pre_v23_captured_rpc_definitions (
                function_name,
                argument_signature,
                return_type,
                is_security_definer,
                volatility,
                configuration_search_path,
                function_owner,
                execute_permissions_acl,
                full_functiondef,
                captured_at
            ) VALUES (
                r.func_name,
                r.arg_sig,
                r.ret_type,
                r.sec_def,
                r.vol,
                r.cfg_path,
                r.fn_owner,
                r.acl_perms,
                r.cur_def,
                NOW()
            );
            RAISE NOTICE '✅ [CAPTURE] Successfully captured current Production definition for public.%.', r.func_name;
        END IF;
    END LOOP;
END $$;

-- 2.4 READ-ONLY AUDIT VERIFICATION OF CAPTURED RECORDS
SELECT 
    id,
    function_name,
    argument_signature,
    return_type,
    is_security_definer,
    volatility,
    function_owner,
    captured_at,
    length(full_functiondef) AS source_code_length_bytes
FROM public.pre_v23_captured_rpc_definitions;
