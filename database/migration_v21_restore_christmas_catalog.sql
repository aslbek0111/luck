-- ==============================================================================
-- LUCKY UC - Migration V21: Restore Missing Christmas Rewards Catalog Items
-- NOTE FOR SUPABASE DEPLOYMENT:
-- To prevent PostgreSQL ERROR 55P04 ("unsafe use of new value ... of enum type"),
-- this migration has been divided into two separate, committed files:
-- 1. database/migration_v21a_enum_christmas.sql (Run and commit first)
-- 2. database/migration_v21b_restore_christmas_catalog.sql (Run and commit second)
--
-- If your environment automatically commits statements or public.reward_category
-- already contains 'christmas', this unified file can be executed directly.
-- ==============================================================================

-- STEP 1: Safe enum registration (V21A)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public' AND t.typname = 'reward_category' AND t.typtype = 'e'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum e
            JOIN pg_type t ON t.oid = e.enumtypid
            JOIN pg_namespace n ON n.oid = t.typnamespace
            WHERE n.nspname = 'public' AND t.typname = 'reward_category' AND e.enumlabel = 'christmas'
        ) THEN
            ALTER TYPE public.reward_category ADD VALUE IF NOT EXISTS 'christmas';
        END IF;
    END IF;
END $$;


-- STEP 2: Restoration, Synchronization & Rigorous Integrity Verification (V21B)
DO $$
DECLARE
    v_conflict_count INTEGER := 0;
    v_conflict_list TEXT := '';
    v_missing_count INTEGER := 0;
    v_missing_list TEXT := '';
    v_integrity_errors TEXT := '';
    v_rec RECORD;
    v_canonical_uuids UUID[] := ARRAY[
        -- 4 Coin rewards (roulette)
        '10000000-0000-0000-0000-000000000051'::UUID,
        '10000000-0000-0000-0000-000000000052'::UUID,
        '10000000-0000-0000-0000-000000000053'::UUID,
        '10000000-0000-0000-0000-000000000054'::UUID,

        -- 2 UC rewards
        '10000000-0000-0000-0000-000000000001'::UUID,
        '10000000-0000-0000-0000-000000000002'::UUID,

        -- 4 Popularity rewards
        '10000000-0000-0000-0000-000000000003'::UUID,
        '10000000-0000-0000-0000-000000000004'::UUID,
        '10000000-0000-0000-0000-000000000005'::UUID,
        '10000000-0000-0000-0000-000000000006'::UUID,

        -- 3 Roses & Bouquets
        '10000000-0000-0000-0000-000000000007'::UUID,
        '10000000-0000-0000-0000-000000000008'::UUID,
        '10000000-0000-0000-0000-000000000009'::UUID,

        -- 2 Spins
        '10000000-0000-0000-0000-000000000010'::UUID,
        '10000000-0000-0000-0000-000000000011'::UUID,

        -- 19 Titles
        '10000000-0000-0000-0000-000000000012'::UUID,
        '10000000-0000-0000-0000-000000000013'::UUID,
        '10000000-0000-0000-0000-000000000014'::UUID,
        '10000000-0000-0000-0000-000000000015'::UUID,
        '10000000-0000-0000-0000-000000000016'::UUID,
        '10000000-0000-0000-0000-000000000017'::UUID,
        '10000000-0000-0000-0000-000000000061'::UUID,
        '10000000-0000-0000-0000-000000000062'::UUID,
        '10000000-0000-0000-0000-000000000063'::UUID,
        '10000000-0000-0000-0000-000000000064'::UUID,
        '10000000-0000-0000-0000-000000000065'::UUID,
        '10000000-0000-0000-0000-000000000071'::UUID,
        '10000000-0000-0000-0000-000000000072'::UUID,
        '10000000-0000-0000-0000-000000000073'::UUID,
        '10000000-0000-0000-0000-000000000074'::UUID,
        '10000000-0000-0000-0000-000000000075'::UUID,
        '10000000-0000-0000-0000-000000000076'::UUID,
        '10000000-0000-0000-0000-000000000077'::UUID,
        '10000000-0000-0000-0000-000000000078'::UUID,

        -- 8 Jokes & Souvenirs
        '10000000-0000-0000-0000-000000000018'::UUID,
        '10000000-0000-0000-0000-000000000019'::UUID,
        '10000000-0000-0000-0000-000000000020'::UUID,
        '10000000-0000-0000-0000-000000000021'::UUID,
        '10000000-0000-0000-0000-000000000022'::UUID,
        '10000000-0000-0000-0000-000000000023'::UUID,
        '10000000-0000-0000-0000-000000000024'::UUID,
        '10000000-0000-0000-0000-000000000025'::UUID,

        -- 15 Christmas Rewards
        '10000000-0000-0000-0000-000000000031'::UUID,
        '10000000-0000-0000-0000-000000000032'::UUID,
        '10000000-0000-0000-0000-000000000033'::UUID,
        '10000000-0000-0000-0000-000000000034'::UUID,
        '10000000-0000-0000-0000-000000000035'::UUID,
        '10000000-0000-0000-0000-000000000038'::UUID,
        '10000000-0000-0000-0000-000000000036'::UUID,
        '10000000-0000-0000-0000-000000000037'::UUID,
        '10000000-0000-0000-0000-000000000039'::UUID,
        '10000000-0000-0000-0000-000000000040'::UUID,
        '10000000-0000-0000-0000-000000000041'::UUID,
        '10000000-0000-0000-0000-000000000042'::UUID,
        '10000000-0000-0000-0000-000000000043'::UUID,
        '10000000-0000-0000-0000-000000000044'::UUID,
        '10000000-0000-0000-0000-000000000045'::UUID
    ];
BEGIN
    -- 1. Ensure required schema columns exist on public.rewards_catalog
    ALTER TABLE public.rewards_catalog ADD COLUMN IF NOT EXISTS slug TEXT;
    ALTER TABLE public.rewards_catalog ADD COLUMN IF NOT EXISTS price_coins INTEGER;
    ALTER TABLE public.rewards_catalog ADD COLUMN IF NOT EXISTS price_points INTEGER;
    ALTER TABLE public.rewards_catalog ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

    -- 2. Ensure unique index on slug exists (matching migration_v4_christmas.sql)
    CREATE UNIQUE INDEX IF NOT EXISTS idx_rewards_catalog_slug 
    ON public.rewards_catalog(slug) WHERE slug IS NOT NULL;

    -- 3. Pre-flight check: verify that no non-canonical rows claim the Christmas slugs
    FOR v_rec IN
        SELECT id, slug, name
        FROM public.rewards_catalog
        WHERE slug IN (
            'reward-xmas-sticker', 'reward-xmas-snowflake-badge', 'reward-xmas-candy-cane',
            'reward-xmas-avatar', 'reward-xmas-frame', 'reward-xmas-reindeer-badge',
            'reward-xmas-snow-globe', 'reward-xmas-santas-gift', 'reward-xmas-golden-bell',
            'reward-xmas-chest', 'reward-xmas-magic-snowflake', 'reward-xmas-golden-tree',
            'reward-xmas-ice-dragon-avatar', 'reward-xmas-santas-sleigh', 'reward-xmas-miracle-box'
        )
        AND id NOT IN (
            '10000000-0000-0000-0000-000000000031', '10000000-0000-0000-0000-000000000032',
            '10000000-0000-0000-0000-000000000033', '10000000-0000-0000-0000-000000000034',
            '10000000-0000-0000-0000-000000000035', '10000000-0000-0000-0000-000000000038',
            '10000000-0000-0000-0000-000000000036', '10000000-0000-0000-0000-000000000037',
            '10000000-0000-0000-0000-000000000039', '10000000-0000-0000-0000-000000000040',
            '10000000-0000-0000-0000-000000000041', '10000000-0000-0000-0000-000000000042',
            '10000000-0000-0000-0000-000000000043', '10000000-0000-0000-0000-000000000044',
            '10000000-0000-0000-0000-000000000045'
        )
    LOOP
        v_conflict_count := v_conflict_count + 1;
        v_conflict_list := v_conflict_list || ' [Slug: ' || v_rec.slug || ', Non-canonical ID: ' || v_rec.id::TEXT || ', Name: ' || v_rec.name || ']';
    END LOOP;

    IF v_conflict_count > 0 THEN
        RAISE EXCEPTION 'MIGRATION V21 ABORTED: Non-canonical records with Christmas slugs detected:%', v_conflict_list;
    END IF;

    -- 4. Insert or Update all 15 Christmas catalog items with canonical data from CHRISTMAS_REWARDS
    INSERT INTO public.rewards_catalog (
        id,
        slug,
        name,
        category,
        rarity,
        icon_name,
        description,
        value,
        price_coins,
        price_points,
        is_title,
        title_slug,
        conditions,
        is_active
    )
    VALUES
        -- 1. Новогодний стикер
        (
            '10000000-0000-0000-0000-000000000031',
            'reward-xmas-sticker',
            'Новогодний стикер',
            'christmas',
            'common',
            'Sparkles',
            'Праздничный стикер с новогодним сиянием.',
            20,
            30,
            30,
            FALSE,
            NULL,
            'Выпадает из Рождественского Колеса или 30 монет',
            TRUE
        ),
        -- 2. Значок Снежинка
        (
            '10000000-0000-0000-0000-000000000032',
            'reward-xmas-snowflake-badge',
            'Значок Снежинка',
            'christmas',
            'common',
            'Sparkle',
            'Кристальный значок ледяной снежинки.',
            25,
            40,
            40,
            FALSE,
            NULL,
            'Выпадает из Рождественского Колеса или 40 монет',
            TRUE
        ),
        -- 3. Леденец-Трость
        (
            '10000000-0000-0000-0000-000000000033',
            'reward-xmas-candy-cane',
            'Леденец-Трость',
            'christmas',
            'common',
            'Candy',
            'Сладкий рождественский леденец в красно-белую полоску.',
            30,
            50,
            50,
            FALSE,
            NULL,
            'Выпадает из Рождественского Колеса или 50 монет',
            TRUE
        ),
        -- 4. Новогодняя аватарка
        (
            '10000000-0000-0000-0000-000000000034',
            'reward-xmas-avatar',
            'Новогодняя аватарка',
            'christmas',
            'uncommon',
            'UserCheck',
            'Праздничная шапочка Санты для твоего профиля.',
            50,
            90,
            90,
            FALSE,
            NULL,
            'Выпадает из Рождественского Колеса или 90 монет',
            TRUE
        ),
        -- 5. Зимняя рамка профиля
        (
            '10000000-0000-0000-0000-000000000035',
            'reward-xmas-frame',
            'Зимняя рамка профиля',
            'christmas',
            'uncommon',
            'Square',
            'Ледяная морозная рамка с узорами на стекле.',
            75,
            110,
            110,
            FALSE,
            NULL,
            'Выпадает из Рождественского Колеса или 110 монет',
            TRUE
        ),
        -- 6. Значок Оленёнок
        (
            '10000000-0000-0000-0000-000000000038',
            'reward-xmas-reindeer-badge',
            'Значок Оленёнок',
            'christmas',
            'uncommon',
            'Award',
            'Значок с верным спутником Санты.',
            250,
            130,
            130,
            FALSE,
            NULL,
            'Выпадает из Рождественского Колеса или 130 монет',
            TRUE
        ),
        -- 7. Снежный шар
        (
            '10000000-0000-0000-0000-000000000036',
            'reward-xmas-snow-globe',
            'Снежный шар',
            'christmas',
            'rare',
            'Globe',
            'Магический шар с кружащимся внутри снегопадом.',
            150,
            220,
            220,
            FALSE,
            NULL,
            'Выпадает из Рождественского Колеса или 220 монет',
            TRUE
        ),
        -- 8. Подарок Санты
        (
            '10000000-0000-0000-0000-000000000037',
            'reward-xmas-santas-gift',
            'Подарок Санты',
            'christmas',
            'rare',
            'Gift',
            'Таинственная коробка с золотой лентой прямо из Лапландии.',
            200,
            280,
            280,
            FALSE,
            NULL,
            'Выпадает из Рождественского Колеса или 280 монет',
            TRUE
        ),
        -- 9. Золотой колокольчик
        (
            '10000000-0000-0000-0000-000000000039',
            'reward-xmas-golden-bell',
            'Золотой колокольчик',
            'christmas',
            'rare',
            'Bell',
            'Звонкий колокольчик, предвещающий новогоднее чудо.',
            300,
            340,
            340,
            FALSE,
            NULL,
            'Выпадает из Рождественского Колеса или 340 монет',
            TRUE
        ),
        -- 10. Рождественский сундук
        (
            '10000000-0000-0000-0000-000000000040',
            'reward-xmas-chest',
            'Рождественский сундук',
            'christmas',
            'rare',
            'Archive',
            'Деревянный резной сундук с зимними сокровищами.',
            400,
            420,
            420,
            FALSE,
            NULL,
            'Выпадает из Рождественского Колеса или 420 монет',
            TRUE
        ),
        -- 11. Волшебная снежинка
        (
            '10000000-0000-0000-0000-000000000041',
            'reward-xmas-magic-snowflake',
            'Волшебная снежинка',
            'christmas',
            'epic',
            'Zap',
            'Вечная снежинка, излучающая северное сияние.',
            800,
            680,
            680,
            FALSE,
            NULL,
            'Выпадает из Рождественского Колеса или 680 монет',
            TRUE
        ),
        -- 12. Золотая ёлочка
        (
            '10000000-0000-0000-0000-000000000042',
            'reward-xmas-golden-tree',
            'Золотая ёлочка',
            'christmas',
            'epic',
            'TreePine',
            'Драгоценная миниатюрная ёлочка из чистого золота.',
            1200,
            800,
            800,
            FALSE,
            NULL,
            'Выпадает из Рождественского Колеса или 800 монет',
            TRUE
        ),
        -- 13. Аватар Ледяного дракона
        (
            '10000000-0000-0000-0000-000000000043',
            'reward-xmas-ice-dragon-avatar',
            'Аватар Ледяного дракона',
            'christmas',
            'epic',
            'Flame',
            'Мифический ледяной дракон, повелитель метелей.',
            1500,
            950,
            950,
            FALSE,
            NULL,
            'Выпадает из Рождественского Колеса или 950 монет',
            TRUE
        ),
        -- 14. Золотые сани Санты
        (
            '10000000-0000-0000-0000-000000000044',
            'reward-xmas-santas-sleigh',
            'Золотые сани Санты',
            'christmas',
            'legendary',
            'Crown',
            'Легендарные сани, рассекающие звездное рождественское небо.',
            3000,
            2800,
            2800,
            FALSE,
            NULL,
            'Выпадает из Рождественского Колеса или 2800 монет',
            TRUE
        ),
        -- 15. Шкатулка Рождественского чуда
        (
            '10000000-0000-0000-0000-000000000045',
            'reward-xmas-miracle-box',
            'Шкатулка Рождественского чуда',
            'christmas',
            'mythic',
            'PackageCheck',
            'Вершина рождественской магии! Исполняет самые заветные желания.',
            5000,
            5500,
            5500,
            FALSE,
            NULL,
            'Главный приз новогоднего сезона или 5500 монет',
            TRUE
        )
    ON CONFLICT (id) DO UPDATE SET
        slug = EXCLUDED.slug,
        name = EXCLUDED.name,
        category = EXCLUDED.category,
        rarity = EXCLUDED.rarity,
        icon_name = EXCLUDED.icon_name,
        description = EXCLUDED.description,
        value = EXCLUDED.value,
        price_coins = EXCLUDED.price_coins,
        price_points = EXCLUDED.price_points,
        is_title = EXCLUDED.is_title,
        title_slug = EXCLUDED.title_slug,
        conditions = EXCLUDED.conditions,
        is_active = EXCLUDED.is_active;

    -- 5. Post-migration: verify existence of all 57 canonical UUIDs
    FOR v_rec IN 
        SELECT unnest(v_canonical_uuids) AS expected_id
    LOOP
        IF NOT EXISTS (SELECT 1 FROM public.rewards_catalog WHERE id = v_rec.expected_id) THEN
            v_missing_count := v_missing_count + 1;
            v_missing_list := v_missing_list || ' [' || v_rec.expected_id::TEXT || ']';
        END IF;
    END LOOP;

    IF v_missing_count > 0 THEN
        RAISE EXCEPTION 'MIGRATION V21 VERIFICATION FAILED: % canonical items missing from public.rewards_catalog:%',
            v_missing_count, v_missing_list;
    END IF;

    -- 6. Rigorous Integrity Audit: check that all 57 items meet business schema invariants
    FOR v_rec IN
        SELECT id, name, category, rarity, icon_name, value, is_active
        FROM public.rewards_catalog
        WHERE id = ANY(v_canonical_uuids)
          AND (
              name IS NULL OR TRIM(name) = ''
              OR category IS NULL OR TRIM(category::TEXT) = ''
              OR rarity IS NULL OR TRIM(rarity::TEXT) = ''
              OR icon_name IS NULL OR TRIM(icon_name) = ''
              OR value IS NULL OR value < 0
              OR is_active IS NOT TRUE
          )
    LOOP
        v_integrity_errors := v_integrity_errors || ' [Basic invariant broken on ' || v_rec.id::TEXT || ' (' || COALESCE(v_rec.name, 'NULL') || ')]';
    END LOOP;

    -- 6.2. Christmas items integrity (category 'christmas', price_coins = price_points > 0)
    FOR v_rec IN
        SELECT id, name, category, price_coins, price_points
        FROM public.rewards_catalog
        WHERE id IN (
            '10000000-0000-0000-0000-000000000031', '10000000-0000-0000-0000-000000000032',
            '10000000-0000-0000-0000-000000000033', '10000000-0000-0000-0000-000000000034',
            '10000000-0000-0000-0000-000000000035', '10000000-0000-0000-0000-000000000038',
            '10000000-0000-0000-0000-000000000036', '10000000-0000-0000-0000-000000000037',
            '10000000-0000-0000-0000-000000000039', '10000000-0000-0000-0000-000000000040',
            '10000000-0000-0000-0000-000000000041', '10000000-0000-0000-0000-000000000042',
            '10000000-0000-0000-0000-000000000043', '10000000-0000-0000-0000-000000000044',
            '10000000-0000-0000-0000-000000000045'
        )
        AND (
            category::TEXT <> 'christmas'
            OR price_coins IS NULL OR price_coins <= 0
            OR price_points IS NULL OR price_points <> price_coins
        )
    LOOP
        v_integrity_errors := v_integrity_errors || ' [Christmas pricing/category broken on ' || v_rec.id::TEXT || ']';
    END LOOP;

    -- 6.3. Titles integrity (is_title TRUE and non-empty title_slug)
    FOR v_rec IN
        SELECT id, name
        FROM public.rewards_catalog
        WHERE id IN (
            '10000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000013',
            '10000000-0000-0000-0000-000000000014', '10000000-0000-0000-0000-000000000015',
            '10000000-0000-0000-0000-000000000016', '10000000-0000-0000-0000-000000000017',
            '10000000-0000-0000-0000-000000000061', '10000000-0000-0000-0000-000000000062',
            '10000000-0000-0000-0000-000000000063', '10000000-0000-0000-0000-000000000064',
            '10000000-0000-0000-0000-000000000065', '10000000-0000-0000-0000-000000000071',
            '10000000-0000-0000-0000-000000000072', '10000000-0000-0000-0000-000000000073',
            '10000000-0000-0000-0000-000000000074', '10000000-0000-0000-0000-000000000075',
            '10000000-0000-0000-0000-000000000076', '10000000-0000-0000-0000-000000000077',
            '10000000-0000-0000-0000-000000000078'
        )
        AND (is_title IS NOT TRUE OR title_slug IS NULL OR TRIM(title_slug) = '')
    LOOP
        v_integrity_errors := v_integrity_errors || ' [Title invariant broken on ' || v_rec.id::TEXT || ']';
    END LOOP;

    -- 6.4. Non-purchasable items integrity (Roulette coins, UC vouchers, VIP title must have price_coins IS NULL)
    FOR v_rec IN
        SELECT id, name, price_coins
        FROM public.rewards_catalog
        WHERE id IN (
            '10000000-0000-0000-0000-000000000051', '10000000-0000-0000-0000-000000000052',
            '10000000-0000-0000-0000-000000000053', '10000000-0000-0000-0000-000000000054',
            '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002',
            '10000000-0000-0000-0000-000000000017'
        )
        AND price_coins IS NOT NULL
    LOOP
        v_integrity_errors := v_integrity_errors || ' [Non-shop item has non-null price on ' || v_rec.id::TEXT || ']';
    END LOOP;

    IF v_integrity_errors <> '' THEN
        RAISE EXCEPTION 'MIGRATION V21 INTEGRITY AUDIT FAILED:%', v_integrity_errors;
    END IF;

    RAISE NOTICE '================================================================';
    RAISE NOTICE 'MIGRATION V21 SUCCESS: 15 Christmas items synchronized.';
    RAISE NOTICE 'MIGRATION V21 SUCCESS: All 57 canonical items verified with full integrity.';
    RAISE NOTICE '================================================================';
END $$;
