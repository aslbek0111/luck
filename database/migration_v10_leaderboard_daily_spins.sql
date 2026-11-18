-- ==============================================================================
-- LUCKY UC - Migration V10: Real-Time PP Leaderboard & Standard Daily Spins
-- 1. Create public.popularity_transactions table for permanent, idempotent PP tracking.
-- 2. Add popularity_updated_at and last_daily_spins_at columns to public.users.
-- 3. Reset all STANDARD accounts to 0 UC, 0 Coins, and 2 daily free spins.
--    Preserve VIP (is_vip = TRUE) and Admin (is_admin = TRUE) privileges & balances.
-- 4. Set column defaults: 0 starting UC, 0 starting coins, 2 free spins for new standard users.
-- 5. Create atomic RPC function public.record_popularity_transaction_atomic with idempotency.
-- 6. Create atomic RPC function public.check_and_grant_daily_spins_atomic with 24-hour cooldown.
-- 7. Update public.public_profiles view for secure leaderboard querying.
-- 8. Enable Supabase Realtime publication for public.users and public.popularity_transactions.
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ADD COLUMNS TO USERS TABLE
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS popularity_updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS last_daily_spins_at TIMESTAMPTZ DEFAULT NOW();

-- Set new defaults for standard accounts
ALTER TABLE public.users ALTER COLUMN total_uc SET DEFAULT 0;
ALTER TABLE public.users ALTER COLUMN coins_balance SET DEFAULT 0;
ALTER TABLE public.users ALTER COLUMN points_balance SET DEFAULT 0;
ALTER TABLE public.users ALTER COLUMN free_spins_balance SET DEFAULT 2;
ALTER TABLE public.users ALTER COLUMN total_popularity SET DEFAULT 0;

-- 3. RESET EXISTING STANDARD ACCOUNTS
-- Remove starting UC and Coins from all STANDARD accounts (is_vip = false AND is_admin = false)
-- Grant them 2 free spins and initialize daily spin timer
UPDATE public.users
SET 
    total_uc = 0,
    coins_balance = 0,
    points_balance = 0,
    free_spins_balance = CASE 
        WHEN free_spins_balance IS NULL OR free_spins_balance > 2 THEN 2 
        ELSE free_spins_balance 
    END,
    last_daily_spins_at = COALESCE(last_daily_spins_at, created_at, NOW()),
    popularity_updated_at = COALESCE(popularity_updated_at, created_at, NOW())
WHERE is_vip = FALSE AND is_admin = FALSE;

-- Ensure VIP and Admin accounts maintain unlimited spins & golden status
UPDATE public.users
SET 
    free_spins_balance = 999999,
    is_admin = TRUE,
    profile_frame = 'vip_gold',
    vip_badge = 'VIP_ADMIN'
WHERE is_vip = TRUE;

-- 4. CREATE POPULARITY TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.popularity_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL CHECK (amount > 0),
    source TEXT NOT NULL DEFAULT 'spin', -- 'spin', 'gift', 'daily_bonus', 'reward', 'admin', 'achievement'
    description TEXT,
    reference_id TEXT UNIQUE, -- Idempotency key to strictly prevent duplicate PP transactions
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pop_tx_user ON public.popularity_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_pop_tx_created ON public.popularity_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pop_tx_ref ON public.popularity_transactions(reference_id);

-- 5. ATOMIC POPULARITY TRANSACTION RPC FUNCTION
CREATE OR REPLACE FUNCTION public.record_popularity_transaction_atomic(
    p_user_id UUID,
    p_amount INTEGER,
    p_source TEXT DEFAULT 'spin',
    p_description TEXT DEFAULT 'Popularity points earned',
    p_reference_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user RECORD;
    v_new_popularity INTEGER;
    v_existing_tx RECORD;
    v_rank BIGINT;
BEGIN
    -- 1. Input validation
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Количество очков популярности должно быть больше 0');
    END IF;

    -- 2. Idempotency check: if reference_id is provided and already exists, return current user state without double counting
    IF p_reference_id IS NOT NULL AND TRIM(p_reference_id) <> '' THEN
        SELECT * INTO v_existing_tx 
        FROM public.popularity_transactions 
        WHERE reference_id = TRIM(p_reference_id);

        IF FOUND THEN
            SELECT * INTO v_user FROM public.users WHERE id = p_user_id;
            RETURN jsonb_build_object(
                'success', true,
                'already_processed', true,
                'total_popularity', v_user.total_popularity,
                'message', 'Транзакция уже была обработана ранее (защита от дублирования)'
            );
        END IF;
    END IF;

    -- 3. Lock user row to prevent race conditions
    SELECT * INTO v_user 
    FROM public.users 
    WHERE id = p_user_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Пользователь не найден');
    END IF;

    IF v_user.is_blocked THEN
        RETURN jsonb_build_object('success', false, 'error', 'Аккаунт пользователя заблокирован');
    END IF;

    -- 4. Calculate new total popularity and update timestamp
    v_new_popularity := COALESCE(v_user.total_popularity, 0) + p_amount;

    UPDATE public.users 
    SET total_popularity = v_new_popularity,
        popularity_updated_at = NOW(),
        updated_at = NOW()
    WHERE id = v_user.id;

    -- 5. Insert permanent transaction record
    INSERT INTO public.popularity_transactions (
        user_id,
        amount,
        source,
        description,
        reference_id,
        created_at
    ) VALUES (
        v_user.id,
        p_amount,
        COALESCE(p_source, 'spin'),
        p_description,
        NULLIF(TRIM(p_reference_id), ''),
        NOW()
    );

    -- 6. Calculate current rank
    SELECT COUNT(*) + 1 INTO v_rank 
    FROM public.users 
    WHERE is_blocked = FALSE 
      AND (
          total_popularity > v_new_popularity 
          OR (total_popularity = v_new_popularity AND popularity_updated_at > NOW())
      );

    RETURN jsonb_build_object(
        'success', true,
        'user_id', v_user.id,
        'username', v_user.username,
        'added_amount', p_amount,
        'total_popularity', v_new_popularity,
        'rank', v_rank,
        'popularity_updated_at', NOW()
    );
END;
$$;

-- 6. ATOMIC 24-HOUR DAILY SPINS CHECK & GRANT RPC
CREATE OR REPLACE FUNCTION public.check_and_grant_daily_spins_atomic(
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user RECORD;
    v_now TIMESTAMPTZ := NOW();
    v_last_grant TIMESTAMPTZ;
    v_next_grant TIMESTAMPTZ;
    v_seconds_remaining INTEGER;
    v_granted BOOLEAN := FALSE;
    v_new_spins INTEGER;
BEGIN
    SELECT * INTO v_user 
    FROM public.users 
    WHERE id = p_user_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Пользователь не найден');
    END IF;

    -- VIP and Admin have unlimited spins (999999) and no daily cooldown restriction
    IF v_user.is_vip = TRUE OR v_user.is_admin = TRUE THEN
        RETURN jsonb_build_object(
            'success', true,
            'is_vip', true,
            'is_admin', true,
            'free_spins', 999999,
            'seconds_remaining', 0,
            'next_daily_spins_at', NULL
        );
    END IF;

    v_last_grant := COALESCE(v_user.last_daily_spins_at, v_user.created_at, v_now - interval '25 hours');

    -- Check if 24 hours (interval '24 hours') have passed since last daily grant
    IF v_now >= (v_last_grant + interval '24 hours') THEN
        -- Grant exactly 2 free spins and update last_daily_spins_at
        v_new_spins := 2;
        v_last_grant := v_now;
        v_granted := TRUE;

        UPDATE public.users 
        SET free_spins_balance = v_new_spins,
            last_daily_spins_at = v_last_grant,
            updated_at = v_now
        WHERE id = v_user.id;
    ELSE
        v_new_spins := COALESCE(v_user.free_spins_balance, 0);
    END IF;

    v_next_grant := v_last_grant + interval '24 hours';
    v_seconds_remaining := GREATEST(0, EXTRACT(EPOCH FROM (v_next_grant - v_now))::INTEGER);

    RETURN jsonb_build_object(
        'success', true,
        'granted', v_granted,
        'free_spins', v_new_spins,
        'last_daily_spins_at', v_last_grant,
        'next_daily_spins_at', v_next_grant,
        'seconds_remaining', v_seconds_remaining
    );
END;
$$;

-- 7. UPDATE PUBLIC PROFILES VIEW
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT 
    id,
    username,
    first_name,
    avatar_url,
    active_title_id,
    total_popularity,
    popularity_updated_at,
    total_uc,
    spins_count,
    free_spins_balance,
    is_vip,
    is_admin,
    profile_frame,
    vip_badge,
    created_at
FROM public.users
WHERE is_blocked = FALSE;

GRANT SELECT ON public.public_profiles TO anon, authenticated, service_role;

-- 8. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.popularity_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own popularity transactions" 
    ON public.popularity_transactions FOR SELECT 
    USING (auth.uid() = user_id OR auth.role() = 'service_role');

CREATE POLICY "Service role full access popularity_transactions" 
    ON public.popularity_transactions FOR ALL 
    USING (auth.role() = 'service_role');

GRANT EXECUTE ON FUNCTION public.record_popularity_transaction_atomic TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_and_grant_daily_spins_atomic TO authenticated, service_role;

-- 9. ENABLE SUPABASE REALTIME SUBSCRIPTION
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN undefined_object THEN null;
END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.popularity_transactions;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN undefined_object THEN null;
END $$;
