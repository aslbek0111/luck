-- ==============================================================================
-- LUCKY UC - Pre-Migration V22 Backup Script
-- Run this script in the Supabase SQL Editor to preserve snapshots of existing
-- tables before executing migration_v22_full_shop_and_coin_repair.sql
-- ==============================================================================

DO $$
BEGIN
    -- 1. Backup users table
    CREATE TABLE IF NOT EXISTS public.backup_v22_users AS
    SELECT * FROM public.users;

    -- 2. Backup rewards catalog
    CREATE TABLE IF NOT EXISTS public.backup_v22_rewards_catalog AS
    SELECT * FROM public.rewards_catalog;

    -- 3. Backup user inventory
    CREATE TABLE IF NOT EXISTS public.backup_v22_user_inventory AS
    SELECT * FROM public.user_inventory;

    -- 4. Backup purchases history
    CREATE TABLE IF NOT EXISTS public.backup_v22_purchases_history AS
    SELECT * FROM public.purchases_history;

    -- 5. Backup sales history (if exists)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sales_history') THEN
        CREATE TABLE IF NOT EXISTS public.backup_v22_sales_history AS
        SELECT * FROM public.sales_history;
    END IF;

    RAISE NOTICE '✅ [BACKUP V22] Snapshot tables created successfully: backup_v22_users, backup_v22_rewards_catalog, backup_v22_user_inventory, backup_v22_purchases_history, backup_v22_sales_history';
END $$;
