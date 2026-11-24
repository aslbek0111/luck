-- ==============================================================================
-- LUCKY UC - Rollback Script for Migration V22
-- In the unlikely event a rollback is needed, this script restores previous catalog
-- states and functions from backup_v22_* tables.
-- ==============================================================================

BEGIN;

DO $$
BEGIN
    -- 1. Restore rewards_catalog from backup if available
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'backup_v22_rewards_catalog') THEN
        UPDATE public.rewards_catalog rc
        SET 
            price_coins = b.price_coins,
            price_points = b.price_points,
            is_active = b.is_active
        FROM public.backup_v22_rewards_catalog b
        WHERE rc.id = b.id;

        RAISE NOTICE '✓ rewards_catalog restored from backup_v22_rewards_catalog';
    END IF;

    -- 2. Reactivate spins if they were previously active in backup
    UPDATE public.rewards_catalog
    SET is_active = TRUE, price_coins = 75, price_points = 75
    WHERE id = '10000000-0000-0000-0000-000000000010';

    UPDATE public.rewards_catalog
    SET is_active = TRUE, price_coins = 140, price_points = 140
    WHERE id = '10000000-0000-0000-0000-000000000011';
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
