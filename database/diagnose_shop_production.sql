-- ==============================================================================
-- LUCKY UC: READ-ONLY PRODUCTION DIAGNOSTIC SCRIPT
-- STRICT SAFETY: ONLY SELECT QUERIES. NO MUTATIONS. NO SCHEMA CHANGES.
-- ==============================================================================

-- 1. Check the active definition of purchase_item_atomic in Supabase
SELECT 
    p.proname AS function_name,
    pg_get_function_identity_arguments(p.oid) AS arguments,
    p.prosecdef AS is_security_definer,
    pg_get_functiondef(p.oid) AS full_function_source
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' 
  AND p.proname IN ('purchase_item_atomic', 'sell_duplicate_atomic');

-- 2. Check catalog items and their value vs price_coins
SELECT 
    id,
    name,
    category,
    rarity,
    is_title,
    title_slug,
    is_active,
    value AS legacy_value,
    price_coins,
    price_points
FROM public.rewards_catalog
WHERE id IN (
    '10000000-0000-0000-0000-000000000003', -- 10 популярности (цена 25)
    '10000000-0000-0000-0000-000000000004', -- 25 популярности (цена 60)
    '10000000-0000-0000-0000-000000000033', -- Леденец-Трость (цена 50)
    '10000000-0000-0000-0000-000000000076', -- BALBIBOL (цена 150)
    '10000000-0000-0000-0000-000000000065', -- ОВЕРЛОРД (цена 2800)
    '10000000-0000-0000-0000-000000000007', -- Одна роза
    '10000000-0000-0000-0000-000000000010'  -- +1 вращение
)
ORDER BY id;

-- 3. Check recent purchases history to see recorded cost_coins
SELECT 
    id,
    user_id,
    item_name,
    item_slug,
    cost_coins,
    cost_points,
    quantity,
    is_admin_purchase,
    created_at
FROM public.purchases_history
ORDER BY created_at DESC
LIMIT 15;

-- 4. Check for any PostgreSQL triggers on public tables that could modify balances
SELECT 
    event_object_table AS table_name,
    trigger_name,
    action_timing,
    event_manipulation AS event,
    action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- 5. Check users balance columns and recent balances
SELECT 
    id,
    username,
    is_admin,
    is_vip,
    coins_balance,
    points_balance,
    updated_at
FROM public.users
WHERE username IN ('lucky_admin', 'pro_gamer777', 'queen_elena', 'cyborg_rus')
   OR id IN (
       SELECT DISTINCT user_id 
       FROM public.purchases_history 
       ORDER BY user_id 
       LIMIT 5
   );
