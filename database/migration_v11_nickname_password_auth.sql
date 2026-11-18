-- ==============================================================================
-- LUCKY UC - Migration V11: Nickname + Password Authentication (14 Accounts)
-- 1. Ensure all 14 official player accounts exist in public.users:
--    10 Standard: Snow24A, Frost82B, Winter39C, Gift51Dx, Santa73K,
--                 Magic46P, Merry28Q, North64R, Star92Tm, Candy35V
--    4 VIP: VIP5000X, VIP2026Z, VIP7777M, VIP9999K
-- 2. Pure Nickname + Password authentication without Special / Registration Codes.
-- 3. Preserve all existing users, balances, VIP statuses, and inventories.
-- ==============================================================================

-- 1. Ensure password_hash and recovery_key_hash columns exist
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS password_hash TEXT;

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS recovery_key_hash TEXT;

-- 2. Insert standard accounts if not present (password_hash is NULL until first login)
INSERT INTO public.users (
    username, first_name, password_hash, recovery_key_hash, avatar_url,
    total_uc, spins_count, total_popularity, free_spins_balance,
    is_vip, is_admin, is_approved, is_blocked, profile_frame, vip_badge, coins_balance, points_balance
)
VALUES
    ('Snow24A', 'Snow24A', NULL, NULL, 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150', 0, 0, 0, 2, FALSE, FALSE, TRUE, FALSE, 'default', NULL, 0, 0),
    ('Frost82B', 'Frost82B', NULL, NULL, 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150', 0, 0, 0, 2, FALSE, FALSE, TRUE, FALSE, 'default', NULL, 0, 0),
    ('Winter39C', 'Winter39C', NULL, NULL, 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150', 0, 0, 0, 2, FALSE, FALSE, TRUE, FALSE, 'default', NULL, 0, 0),
    ('Gift51Dx', 'Gift51Dx', NULL, NULL, 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150', 0, 0, 0, 2, FALSE, FALSE, TRUE, FALSE, 'default', NULL, 0, 0),
    ('Santa73K', 'Santa73K', NULL, NULL, 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150', 0, 0, 0, 2, FALSE, FALSE, TRUE, FALSE, 'default', NULL, 0, 0),
    ('Magic46P', 'Magic46P', NULL, NULL, 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150', 0, 0, 0, 2, FALSE, FALSE, TRUE, FALSE, 'default', NULL, 0, 0),
    ('Merry28Q', 'Merry28Q', NULL, NULL, 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150', 0, 0, 0, 2, FALSE, FALSE, TRUE, FALSE, 'default', NULL, 0, 0),
    ('North64R', 'North64R', NULL, NULL, 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150', 0, 0, 0, 2, FALSE, FALSE, TRUE, FALSE, 'default', NULL, 0, 0),
    ('Star92Tm', 'Star92Tm', NULL, NULL, 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150', 0, 0, 0, 2, FALSE, FALSE, TRUE, FALSE, 'default', NULL, 0, 0),
    ('Candy35V', 'Candy35V', NULL, NULL, 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150', 0, 0, 0, 2, FALSE, FALSE, TRUE, FALSE, 'default', NULL, 0, 0)
ON CONFLICT (username) DO NOTHING;

-- 3. Insert VIP accounts if not present (5000 UC, 1000 Coins, unlimited spins, VIP+Admin, active VIP title)
INSERT INTO public.users (
    username, first_name, password_hash, recovery_key_hash, avatar_url,
    total_uc, spins_count, total_popularity, free_spins_balance,
    is_vip, is_admin, is_approved, is_blocked, profile_frame, vip_badge, active_title_id, coins_balance, points_balance
)
VALUES
    ('VIP5000X', 'VIP5000X', NULL, NULL, 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150', 5000, 0, 0, 999999, TRUE, TRUE, TRUE, FALSE, 'vip_gold', 'VIP_ADMIN', '10000000-0000-0000-0000-000000000017', 1000, 1000),
    ('VIP2026Z', 'VIP2026Z', NULL, NULL, 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150', 5000, 0, 0, 999999, TRUE, TRUE, TRUE, FALSE, 'vip_gold', 'VIP_ADMIN', '10000000-0000-0000-0000-000000000017', 1000, 1000),
    ('VIP7777M', 'VIP7777M', NULL, NULL, 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150', 5000, 0, 0, 999999, TRUE, TRUE, TRUE, FALSE, 'vip_gold', 'VIP_ADMIN', '10000000-0000-0000-0000-000000000017', 1000, 1000),
    ('VIP9999K', 'VIP9999K', NULL, NULL, 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150', 5000, 0, 0, 999999, TRUE, TRUE, TRUE, FALSE, 'vip_gold', 'VIP_ADMIN', '10000000-0000-0000-0000-000000000017', 1000, 1000)
ON CONFLICT (username) DO UPDATE
SET is_vip = TRUE,
    is_admin = TRUE,
    profile_frame = 'vip_gold',
    vip_badge = 'VIP_ADMIN',
    active_title_id = '10000000-0000-0000-0000-000000000017',
    total_uc = GREATEST(COALESCE(public.users.total_uc, 0), 5000),
    free_spins_balance = GREATEST(COALESCE(public.users.free_spins_balance, 0), 999999),
    coins_balance = GREATEST(COALESCE(public.users.coins_balance, 0), 1000),
    points_balance = GREATEST(COALESCE(public.users.points_balance, 0), 1000);

-- 4. Grant 3 copies of all catalog items and titles to all VIP accounts
INSERT INTO public.user_inventory (user_id, reward_id, quantity, acquired_at)
SELECT u.id, r.id, 3, NOW()
FROM public.users u
CROSS JOIN public.rewards_catalog r
WHERE u.is_vip = TRUE
ON CONFLICT (user_id, reward_id)
DO UPDATE SET quantity = GREATEST(public.user_inventory.quantity, 3);

