-- ==============================================================================
-- LUCKY UC - Telegram Mini App Database Schema
-- Supabase PostgreSQL with Row Level Security (RLS)
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ENUM TYPES
DO $$ BEGIN
    CREATE TYPE reward_category AS ENUM (
        'titles',
        'popularity',
        'roses',
        'jokes',
        'spins',
        'uc',
        'coins'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE reward_rarity AS ENUM (
        'common',
        'uncommon',
        'rare',
        'epic',
        'pro-epic',
        'mythic',
        'legendary'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE approval_status AS ENUM (
        'pending',
        'approved',
        'rejected'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. USERS TABLE
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    telegram_id BIGINT UNIQUE NOT NULL,
    username TEXT,
    first_name TEXT,
    last_name TEXT,
    avatar_url TEXT,
    active_title_id UUID,
    spins_count INTEGER DEFAULT 0,
    total_uc INTEGER DEFAULT 0,
    total_popularity INTEGER DEFAULT 0,
    free_spins_balance INTEGER DEFAULT 5,
    coins_balance INTEGER DEFAULT 1000 CHECK (coins_balance >= 0),
    points_balance INTEGER DEFAULT 1000 CHECK (points_balance >= 0),
    is_approved BOOLEAN DEFAULT TRUE,
    is_blocked BOOLEAN DEFAULT FALSE,
    is_admin BOOLEAN DEFAULT FALSE,
    is_vip BOOLEAN DEFAULT FALSE,
    profile_frame TEXT DEFAULT 'default',
    vip_badge TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON public.users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(LOWER(username));

-- 4. REWARDS CATALOG
CREATE TABLE IF NOT EXISTS public.rewards_catalog (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    category reward_category NOT NULL,
    rarity reward_rarity NOT NULL DEFAULT 'common',
    icon_name TEXT NOT NULL,
    description TEXT,
    value INTEGER DEFAULT 0,
    is_title BOOLEAN DEFAULT FALSE,
    title_slug TEXT UNIQUE,
    is_active BOOLEAN DEFAULT TRUE,
    conditions TEXT DEFAULT 'Выдается за достижения или вращения',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rewards_category ON public.rewards_catalog(category);
CREATE INDEX IF NOT EXISTS idx_rewards_rarity ON public.rewards_catalog(rarity);

-- 5. USER INVENTORY
CREATE TABLE IF NOT EXISTS public.user_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    reward_id UUID NOT NULL REFERENCES public.rewards_catalog(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 0),
    acquired_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_user_reward UNIQUE (user_id, reward_id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_user_id ON public.user_inventory(user_id);

-- Add foreign key constraint for active_title_id in users table
DO $$ BEGIN
    ALTER TABLE public.users 
    ADD CONSTRAINT fk_users_active_title 
    FOREIGN KEY (active_title_id) REFERENCES public.rewards_catalog(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 6. GIFTS HISTORY
CREATE TABLE IF NOT EXISTS public.gifts_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    reward_id UUID NOT NULL REFERENCES public.rewards_catalog(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    status TEXT DEFAULT 'completed',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_diff_users CHECK (sender_id <> recipient_id)
);

CREATE INDEX IF NOT EXISTS idx_gifts_sender ON public.gifts_history(sender_id);
CREATE INDEX IF NOT EXISTS idx_gifts_recipient ON public.gifts_history(recipient_id);

-- 7. PUBLIC EVENTS (Live Feed)
CREATE TABLE IF NOT EXISTS public.public_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    reward_id UUID REFERENCES public.rewards_catalog(id) ON DELETE SET NULL,
    reward_name TEXT NOT NULL,
    reward_rarity reward_rarity NOT NULL,
    reward_category reward_category NOT NULL,
    event_type TEXT NOT NULL DEFAULT 'reward_received',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_public_events_created ON public.public_events(created_at DESC);

-- 8. UC REQUESTS / ADMIN CONFIRMATION
CREATE TABLE IF NOT EXISTS public.uc_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL CHECK (amount > 0),
    reason TEXT NOT NULL,
    status approval_status DEFAULT 'pending',
    admin_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_uc_requests_status ON public.uc_requests(status);

-- 9. ACTION & AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.action_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_action_logs_user ON public.action_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_action_logs_created ON public.action_logs(created_at DESC);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rewards_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gifts_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uc_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_logs ENABLE ROW LEVEL SECURITY;

-- Catalog: Everyone can view active rewards
CREATE POLICY "Anyone can view active catalog items" 
    ON public.rewards_catalog FOR SELECT 
    USING (is_active = TRUE);

-- Public Events: Everyone can read the live feed
CREATE POLICY "Public events are viewable by all" 
    ON public.public_events FOR SELECT 
    USING (TRUE);

-- Users: Only user themselves or service role can select directly from public.users table (prevents leaking browser_pin and auth_token)
CREATE POLICY "Users can view own data" 
    ON public.users FOR SELECT 
    USING (auth.uid() = id OR auth.role() = 'service_role');

-- Secure public profiles view (exposes only non-sensitive leaderboard/feed profile data)
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT 
    id,
    username,
    first_name,
    avatar_url,
    active_title_id,
    total_popularity,
    total_uc,
    spins_count,
    created_at
FROM public.users
WHERE is_blocked = FALSE;

GRANT SELECT ON public.public_profiles TO anon, authenticated, service_role;

-- Inventory: Users can view their own inventory
CREATE POLICY "Users can view own inventory" 
    ON public.user_inventory FOR SELECT 
    USING (auth.uid() = user_id OR auth.role() = 'service_role');

-- Gifts: Users can view gifts they sent or received
CREATE POLICY "Users can view gifts involving them" 
    ON public.gifts_history FOR SELECT 
    USING (auth.uid() = sender_id OR auth.uid() = recipient_id OR auth.role() = 'service_role');

-- Service role has full access to all tables
CREATE POLICY "Service role full access users" ON public.users FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access catalog" ON public.rewards_catalog FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access inventory" ON public.user_inventory FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access gifts" ON public.gifts_history FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access events" ON public.public_events FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access requests" ON public.uc_requests FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access logs" ON public.action_logs FOR ALL USING (auth.role() = 'service_role');
