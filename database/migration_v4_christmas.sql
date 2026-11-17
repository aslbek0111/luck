-- ==============================================================================
-- LUCKY UC - Migration V4: Christmas Gaming Rewards Platform (Production Ready)
-- 12 Dedicated Player Slots (10 Standard + 2 VIP), Admin Panel,
-- 15 Christmas Rewards, Player Gifting with Messages, Row Level Security & RPCs
-- ==============================================================================

-- 1. BASE TABLE COMPATIBILITY & NULLABLE TELEGRAM_ID
ALTER TABLE public.users 
ALTER COLUMN telegram_id DROP NOT NULL;

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS password_hash TEXT;

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS is_vip BOOLEAN DEFAULT FALSE;

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS profile_frame TEXT DEFAULT 'default';

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS vip_badge TEXT;

-- Safe handling for reward_category (convert to TEXT to avoid Postgres enum transaction traps)
DO $$ BEGIN
    ALTER TABLE public.rewards_catalog ALTER COLUMN category TYPE TEXT;
    ALTER TABLE public.public_events ALTER COLUMN reward_category TYPE TEXT;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.rewards_catalog 
ADD COLUMN IF NOT EXISTS slug TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_rewards_catalog_slug 
ON public.rewards_catalog(slug) WHERE slug IS NOT NULL;

-- 2. REGISTRATION CODES TABLE (12 Slots: 10 Standard + 2 VIP)
CREATE TABLE IF NOT EXISTS public.registration_codes (
    code TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('standard', 'vip')),
    is_used BOOLEAN NOT NULL DEFAULT FALSE,
    used_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed the exact 12 registration codes
INSERT INTO public.registration_codes (code, type, is_used) VALUES
    ('Snow24A', 'standard', FALSE),
    ('Frost82B', 'standard', FALSE),
    ('Winter39C', 'standard', FALSE),
    ('Gift51Dx', 'standard', FALSE),
    ('Santa73K', 'standard', FALSE),
    ('Magic46P', 'standard', FALSE),
    ('Merry28Q', 'standard', FALSE),
    ('North64R', 'standard', FALSE),
    ('Star92Tm', 'standard', FALSE),
    ('Candy35V', 'standard', FALSE),
    ('VIP5000X', 'vip', FALSE),
    ('VIP2026Z', 'vip', FALSE)
ON CONFLICT (code) DO NOTHING;

-- 3. IN-APP NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('gift_received', 'admin_bonus', 'spin_win', 'system')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}'::jsonb,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id, is_read, created_at DESC);

-- 4. ADMIN AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    target_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON public.admin_audit_logs(created_at DESC);

-- 5. SYSTEM CONFIG TABLE (Global features like spin wheel enabled/disabled & custom segments)
CREATE TABLE IF NOT EXISTS public.system_config (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.system_config (key, value) VALUES
    ('spin_wheel_enabled', '{"enabled": true}'::jsonb),
    ('max_player_slots', '{"max": 12}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 6. GIFTS HISTORY MESSAGE COLUMN
ALTER TABLE public.gifts_history
ADD COLUMN IF NOT EXISTS message TEXT;

-- 7. SEED & SYNC THE 15 CHRISTMAS REWARDS (WITH DETERMINISTIC UUIDS & SLUGS)
INSERT INTO public.rewards_catalog (id, slug, name, category, rarity, icon_name, description, value, is_title, title_slug, conditions)
VALUES
    -- Common (1-5)
    ('10000000-0000-0000-0000-000000000031', 'reward-xmas-sticker', 'Новогодний стикер', 'christmas', 'common', 'Sparkles', 'Праздничный стикер с новогодним сиянием', 20, FALSE, NULL, 'Праздничное колесо фортуны'),
    ('10000000-0000-0000-0000-000000000032', 'reward-xmas-snowflake-badge', 'Значок Снежинка', 'christmas', 'common', 'Sparkle', 'Кристальный значок ледяной снежинки', 25, FALSE, NULL, 'Праздничное колесо фортуны'),
    ('10000000-0000-0000-0000-000000000033', 'reward-xmas-candy-cane', 'Леденец-Трость', 'christmas', 'common', 'Candy', 'Сладкий рождественский леденец в красно-белую полоску', 30, FALSE, NULL, 'Праздничное колесо фортуны'),
    ('10000000-0000-0000-0000-000000000034', 'reward-xmas-avatar', 'Новогодняя аватарка', 'christmas', 'common', 'UserCheck', 'Праздничная шапочка Санты для твоего профиля', 50, FALSE, NULL, 'Праздничное колесо фортуны'),
    ('10000000-0000-0000-0000-000000000035', 'reward-xmas-frame', 'Зимняя рамка профиля', 'christmas', 'common', 'Square', 'Ледяная морозная рамка с узорами на стекле', 75, FALSE, NULL, 'Праздничное колесо фортуны'),

    -- Rare (6-10)
    ('10000000-0000-0000-0000-000000000036', 'reward-xmas-snow-globe', 'Снежный шар', 'christmas', 'rare', 'Globe', 'Магический шар с кружащимся внутри снегопадом', 150, FALSE, NULL, 'Праздничное колесо фортуны'),
    ('10000000-0000-0000-0000-000000000037', 'reward-xmas-santas-gift', 'Подарок Санты', 'christmas', 'rare', 'Gift', 'Таинственная коробка с золотой лентой прямо из Лапландии', 200, FALSE, NULL, 'Праздничное колесо фортуны'),
    ('10000000-0000-0000-0000-000000000038', 'reward-xmas-reindeer-badge', 'Значок Оленёнок', 'christmas', 'rare', 'Award', 'Значок с верным спутником Санты', 250, FALSE, NULL, 'Праздничное колесо фортуны'),
    ('10000000-0000-0000-0000-000000000039', 'reward-xmas-golden-bell', 'Золотой колокольчик', 'christmas', 'rare', 'Bell', 'Звонкий колокольчик, предвещающий новогоднее чудо', 300, FALSE, NULL, 'Праздничное колесо фортуны'),
    ('10000000-0000-0000-0000-000000000040', 'reward-xmas-chest', 'Рождественский сундук', 'christmas', 'rare', 'Archive', 'Деревянный резной сундук с зимними сокровищами', 400, FALSE, NULL, 'Праздничное колесо фортуны'),

    -- Epic (11-13)
    ('10000000-0000-0000-0000-000000000041', 'reward-xmas-magic-snowflake', 'Волшебная снежинка', 'christmas', 'epic', 'Zap', 'Вечная снежинка, излучающая северное сияние', 800, FALSE, NULL, 'Праздничное колесо фортуны'),
    ('10000000-0000-0000-0000-000000000042', 'reward-xmas-golden-tree', 'Золотая ёлочка', 'christmas', 'epic', 'TreePine', 'Драгоценная миниатюрная ёлочка из чистого золота', 1200, FALSE, NULL, 'Праздничное колесо фортуны'),
    ('10000000-0000-0000-0000-000000000043', 'reward-xmas-ice-dragon-avatar', 'Аватар Ледяного дракона', 'christmas', 'epic', 'Flame', 'Мифический ледяной дракон, повелитель метелей', 1500, FALSE, NULL, 'Праздничное колесо фортуны'),

    -- Legendary (14)
    ('10000000-0000-0000-0000-000000000044', 'reward-xmas-santas-sleigh', 'Золотые сани Санты', 'christmas', 'legendary', 'Crown', 'Легендарные сани, рассекающие звездное рождественское небо', 3000, FALSE, NULL, 'Праздничное колесо фортуны'),

    -- Mythic (15)
    ('10000000-0000-0000-0000-000000000045', 'reward-xmas-miracle-box', 'Шкатулка Рождественского чуда', 'christmas', 'mythic', 'PackageCheck', 'Вершина рождественской магии! Исполняет самые заветные желания', 5000, FALSE, NULL, 'Праздничное колесо фортуны')
ON CONFLICT (id) DO UPDATE SET
    slug = EXCLUDED.slug,
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    rarity = EXCLUDED.rarity,
    icon_name = EXCLUDED.icon_name,
    description = EXCLUDED.description,
    value = EXCLUDED.value;

-- Sync slugs on base catalog items if not present
UPDATE public.rewards_catalog SET slug = 'reward-uc-30' WHERE id = '10000000-0000-0000-0000-000000000001' AND slug IS NULL;
UPDATE public.rewards_catalog SET slug = 'reward-uc-60' WHERE id = '10000000-0000-0000-0000-000000000002' AND slug IS NULL;
UPDATE public.rewards_catalog SET slug = 'reward-pop-10' WHERE id = '10000000-0000-0000-0000-000000000003' AND slug IS NULL;
UPDATE public.rewards_catalog SET slug = 'reward-pop-25' WHERE id = '10000000-0000-0000-0000-000000000004' AND slug IS NULL;
UPDATE public.rewards_catalog SET slug = 'reward-pop-50' WHERE id = '10000000-0000-0000-0000-000000000005' AND slug IS NULL;
UPDATE public.rewards_catalog SET slug = 'reward-pop-100' WHERE id = '10000000-0000-0000-0000-000000000006' AND slug IS NULL;
UPDATE public.rewards_catalog SET slug = 'reward-rose-single' WHERE id = '10000000-0000-0000-0000-000000000007' AND slug IS NULL;
UPDATE public.rewards_catalog SET slug = 'reward-rose-bouquet' WHERE id = '10000000-0000-0000-0000-000000000008' AND slug IS NULL;
UPDATE public.rewards_catalog SET slug = 'reward-rose-large' WHERE id = '10000000-0000-0000-0000-000000000009' AND slug IS NULL;
UPDATE public.rewards_catalog SET slug = 'reward-spin-1' WHERE id = '10000000-0000-0000-0000-000000000010' AND slug IS NULL;
UPDATE public.rewards_catalog SET slug = 'reward-spin-2' WHERE id = '10000000-0000-0000-0000-000000000011' AND slug IS NULL;
UPDATE public.rewards_catalog SET slug = 'title-sosun' WHERE id = '10000000-0000-0000-0000-000000000012' AND slug IS NULL;
UPDATE public.rewards_catalog SET slug = 'title-vozduhan' WHERE id = '10000000-0000-0000-0000-000000000013' AND slug IS NULL;
UPDATE public.rewards_catalog SET slug = 'title-korol' WHERE id = '10000000-0000-0000-0000-000000000014' AND slug IS NULL;
UPDATE public.rewards_catalog SET slug = 'title-koroleva' WHERE id = '10000000-0000-0000-0000-000000000015' AND slug IS NULL;
UPDATE public.rewards_catalog SET slug = 'title-cyborg' WHERE id = '10000000-0000-0000-0000-000000000016' AND slug IS NULL;
UPDATE public.rewards_catalog SET slug = 'title-vip' WHERE id = '10000000-0000-0000-0000-000000000017' AND slug IS NULL;
UPDATE public.rewards_catalog SET slug = 'reward-pacifier-gold' WHERE id = '10000000-0000-0000-0000-000000000018' AND slug IS NULL;
UPDATE public.rewards_catalog SET slug = 'reward-pacifier-silver' WHERE id = '10000000-0000-0000-0000-000000000019' AND slug IS NULL;
UPDATE public.rewards_catalog SET slug = 'reward-pacifier-bronze' WHERE id = '10000000-0000-0000-0000-000000000020' AND slug IS NULL;
UPDATE public.rewards_catalog SET slug = 'reward-cup' WHERE id = '10000000-0000-0000-0000-000000000021' AND slug IS NULL;
UPDATE public.rewards_catalog SET slug = 'reward-underpants-grandpa' WHERE id = '10000000-0000-0000-0000-000000000022' AND slug IS NULL;
UPDATE public.rewards_catalog SET slug = 'reward-underpants-andrey' WHERE id = '10000000-0000-0000-0000-000000000023' AND slug IS NULL;
UPDATE public.rewards_catalog SET slug = 'reward-pacifier-deputy' WHERE id = '10000000-0000-0000-0000-000000000024' AND slug IS NULL;
UPDATE public.rewards_catalog SET slug = 'reward-shame-of-the-day' WHERE id = '10000000-0000-0000-0000-000000000025' AND slug IS NULL;

-- ==============================================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES FOR NEW TABLES
-- ==============================================================================

-- 8.1 Registration Codes: STRICTLY PROTECTED (No anonymous reading!)
ALTER TABLE public.registration_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access registration_codes" ON public.registration_codes;
CREATE POLICY "Service role full access registration_codes" 
    ON public.registration_codes FOR ALL 
    USING (auth.role() = 'service_role');

-- 8.2 Notifications: User isolation
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Service role full access notifications" ON public.notifications;

CREATE POLICY "Users can view own notifications" 
    ON public.notifications FOR SELECT 
    USING (auth.uid() = user_id OR auth.role() = 'service_role');

CREATE POLICY "Users can update own notifications" 
    ON public.notifications FOR UPDATE 
    USING (auth.uid() = user_id OR auth.role() = 'service_role');

CREATE POLICY "Service role full access notifications" 
    ON public.notifications FOR ALL 
    USING (auth.role() = 'service_role');

-- 8.3 Admin Audit Logs: Admin only (Service role)
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access admin_audit_logs" ON public.admin_audit_logs;
CREATE POLICY "Service role full access admin_audit_logs" 
    ON public.admin_audit_logs FOR ALL 
    USING (auth.role() = 'service_role');

-- 8.4 System Config: Public can view, only service role can update
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view system_config" ON public.system_config;
DROP POLICY IF EXISTS "Service role full access system_config" ON public.system_config;

CREATE POLICY "Anyone can view system_config" 
    ON public.system_config FOR SELECT 
    USING (TRUE);

CREATE POLICY "Service role full access system_config" 
    ON public.system_config FOR ALL 
    USING (auth.role() = 'service_role');

-- ==============================================================================
-- 9. ATOMIC RPC: REGISTER PLAYER WITH CODE
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.register_player_with_code_atomic(
    p_username TEXT,
    p_password_hash TEXT,
    p_code TEXT,
    p_first_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_code_record RECORD;
    v_player_count INTEGER;
    v_new_user RECORD;
    v_initial_uc INTEGER := 0;
    v_is_vip BOOLEAN := FALSE;
    v_starter_item RECORD;
BEGIN
    -- 1. Check existing username uniqueness (case-insensitive)
    IF EXISTS (SELECT 1 FROM public.users WHERE LOWER(username) = LOWER(p_username)) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Пользователь с таким никнеймом уже зарегистрирован');
    END IF;

    -- 2. Verify code exists and lock row
    SELECT * INTO v_code_record 
    FROM public.registration_codes 
    WHERE code = p_code 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Неверный код регистрации. Проверьте код и повторите ввод.');
    END IF;

    IF v_code_record.is_used THEN
        RETURN jsonb_build_object('success', false, 'error', 'Этот код регистрации уже был использован другим игроком.');
    END IF;

    -- 3. Verify total non-admin registered players cap (Max 12)
    SELECT COUNT(*) INTO v_player_count 
    FROM public.users 
    WHERE is_admin = FALSE;

    IF v_player_count >= 12 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Регистрация закрыта: все 12 игровых мест заняты.');
    END IF;

    -- 4. Setup parameters based on code type
    IF v_code_record.type = 'vip' THEN
        v_is_vip := TRUE;
        v_initial_uc := 5000;
    ELSE
        v_is_vip := FALSE;
        v_initial_uc := 0;
    END IF;

    -- 5. Insert user record (Spins default to 0, managed by admin)
    INSERT INTO public.users (
        username,
        first_name,
        password_hash,
        avatar_url,
        total_uc,
        spins_count,
        total_popularity,
        free_spins_balance,
        is_vip,
        is_admin,
        is_approved,
        is_blocked,
        profile_frame
    ) VALUES (
        LOWER(p_username),
        COALESCE(p_first_name, INITCAP(p_username)),
        p_password_hash,
        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
        v_initial_uc,
        0,
        0,
        0, -- 0 initial spins (admin must grant spins)
        v_is_vip,
        FALSE,
        TRUE,
        FALSE,
        CASE WHEN v_is_vip THEN 'vip_gold' ELSE 'default' END
    )
    RETURNING * INTO v_new_user;

    -- 6. Mark code as used
    UPDATE public.registration_codes
    SET is_used = TRUE,
        used_by_user_id = v_new_user.id,
        used_at = NOW()
    WHERE code = p_code;

    -- 7. Grant starter Christmas item ('reward-xmas-sticker')
    SELECT * INTO v_starter_item 
    FROM public.rewards_catalog 
    WHERE id = '10000000-0000-0000-0000-000000000031' OR slug = 'reward-xmas-sticker'
    LIMIT 1;

    IF v_starter_item.id IS NOT NULL THEN
        INSERT INTO public.user_inventory (user_id, reward_id, quantity)
        VALUES (v_new_user.id, v_starter_item.id, 1)
        ON CONFLICT (user_id, reward_id) DO UPDATE SET quantity = user_inventory.quantity + 1;
    END IF;

    -- 8. Add welcome notification
    INSERT INTO public.notifications (user_id, type, title, message)
    VALUES (
        v_new_user.id,
        'system',
        'Добро пожаловать в Lucky UC! 🎄',
        CASE WHEN v_is_vip 
            THEN 'Вам начислен VIP-статус и стартовый баланс 5000 UC! Счастливого Нового года!'
            ELSE 'Вы успешно зарегистрированы в новогодней платформе Lucky UC! Ожидайте начисления спинов от Администратора.'
        END
    );

    RETURN jsonb_build_object(
        'success', true,
        'user', row_to_json(v_new_user),
        'is_vip', v_is_vip,
        'initial_uc', v_initial_uc
    );
END;
$$;

-- ==============================================================================
-- 10. ATOMIC RPC: SEND PLAYER GIFT WITH CUSTOM MESSAGE
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.send_player_gift_with_message_atomic(
    p_sender_id UUID,
    p_recipient_username TEXT,
    p_reward_id UUID,
    p_quantity INTEGER DEFAULT 1,
    p_message TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_recipient RECORD;
    v_sender RECORD;
    v_sender_inv RECORD;
    v_reward RECORD;
BEGIN
    IF p_quantity <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Количество должно быть больше 0');
    END IF;

    -- 1. Fetch sender
    SELECT * INTO v_sender FROM public.users WHERE id = p_sender_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Отправитель не найден');
    END IF;

    IF v_sender.is_blocked THEN
        RETURN jsonb_build_object('success', false, 'error', 'Ваш аккаунт заблокирован');
    END IF;

    -- 2. Fetch recipient
    SELECT * INTO v_recipient FROM public.users WHERE LOWER(username) = LOWER(p_recipient_username);
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Игрок @' || p_recipient_username || ' не найден');
    END IF;

    IF v_recipient.id = v_sender.id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Нельзя отправить подарок самому себе');
    END IF;

    -- 3. Check reward
    SELECT * INTO v_reward FROM public.rewards_catalog WHERE id = p_reward_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Предмет не найден в каталоге');
    END IF;

    -- 4. Check sender inventory (Quantity > 0 rule)
    SELECT * INTO v_sender_inv 
    FROM public.user_inventory 
    WHERE user_id = v_sender.id AND reward_id = v_reward.id
    FOR UPDATE;

    IF NOT FOUND OR v_sender_inv.quantity < p_quantity THEN
        RETURN jsonb_build_object('success', false, 'error', 'Недостаточно предметов в вашем инвентаре');
    END IF;

    -- 5. Decrement sender inventory
    IF v_sender_inv.quantity = p_quantity THEN
        DELETE FROM public.user_inventory WHERE id = v_sender_inv.id;
    ELSE
        UPDATE public.user_inventory 
        SET quantity = quantity - p_quantity, updated_at = NOW()
        WHERE id = v_sender_inv.id;
    END IF;

    -- 6. Increment recipient inventory
    INSERT INTO public.user_inventory (user_id, reward_id, quantity)
    VALUES (v_recipient.id, v_reward.id, p_quantity)
    ON CONFLICT (user_id, reward_id) 
    DO UPDATE SET quantity = user_inventory.quantity + p_quantity, updated_at = NOW();

    -- 7. Record gift in history
    INSERT INTO public.gifts_history (sender_id, recipient_id, reward_id, quantity, status, message)
    VALUES (v_sender.id, v_recipient.id, v_reward.id, p_quantity, 'approved', p_message);

    -- 8. Create in-app notification for recipient
    INSERT INTO public.notifications (user_id, type, title, message, data)
    VALUES (
        v_recipient.id,
        'gift_received',
        'Вам пришел подарок! 🎁',
        'Игрок @' || v_sender.username || ' подарил вам «' || v_reward.name || '» (' || p_quantity || ' шт.)' || 
        CASE WHEN p_message IS NOT NULL AND length(trim(p_message)) > 0 
            THEN E'\nСообщение: «' || p_message || '»' 
            ELSE '' 
        END,
        jsonb_build_object(
            'sender_username', v_sender.username,
            'reward_name', v_reward.name,
            'reward_rarity', v_reward.rarity,
            'quantity', p_quantity,
            'message', p_message
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'recipient', v_recipient.username,
        'reward_name', v_reward.name,
        'quantity', p_quantity,
        'message', p_message
    );
END;
$$;

-- ==============================================================================
-- 11. GRANTS FOR FUNCTION EXECUTION
-- ==============================================================================
GRANT EXECUTE ON FUNCTION public.register_player_with_code_atomic TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.send_player_gift_with_message_atomic TO authenticated, service_role;
