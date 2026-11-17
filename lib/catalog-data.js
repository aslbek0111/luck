/**
 * LUCKY UC - Catalog Data & Constants
 * Complete definitions of titles, rewards, rarities, and visual themes.
 */

export const RARITIES = {
  common: {
    id: 'common',
    label: 'Обычный',
    color: '#9ca3af',
    badgeBg: 'bg-zinc-800/80',
    badgeText: 'text-zinc-300',
    border: 'border-zinc-700/60',
    glow: 'shadow-[0_0_15px_rgba(156,163,175,0.15)]',
    cardGradient: 'from-zinc-900/90 via-zinc-900/60 to-zinc-950/90',
  },
  rare: {
    id: 'rare',
    label: 'Редкий',
    color: '#38bdf8',
    badgeBg: 'bg-sky-500/20',
    badgeText: 'text-sky-300',
    border: 'border-sky-500/40',
    glow: 'shadow-[0_0_20px_rgba(56,189,248,0.25)]',
    cardGradient: 'from-sky-950/40 via-zinc-900/80 to-zinc-950/90',
  },
  epic: {
    id: 'epic',
    label: 'Эпический',
    color: '#ec4899',
    badgeBg: 'bg-pink-500/20',
    badgeText: 'text-pink-300',
    border: 'border-pink-500/40',
    glow: 'shadow-[0_0_25px_rgba(236,72,153,0.3)]',
    cardGradient: 'from-pink-950/40 via-zinc-900/80 to-zinc-950/90',
  },
  mythic: {
    id: 'mythic',
    label: 'Мифический',
    color: '#a855f7',
    badgeBg: 'bg-purple-500/20',
    badgeText: 'text-purple-300',
    border: 'border-purple-500/50',
    glow: 'shadow-[0_0_35px_rgba(168,85,247,0.45)]',
    cardGradient: 'from-purple-950/50 via-zinc-900/80 to-zinc-950/90',
  },
  legendary: {
    id: 'legendary',
    label: 'Легендарный',
    color: '#f59e0b',
    badgeBg: 'bg-amber-500/20',
    badgeText: 'text-amber-300',
    border: 'border-amber-400/60',
    glow: 'shadow-[0_0_40px_rgba(245,158,11,0.55)]',
    cardGradient: 'from-amber-950/40 via-zinc-900/80 to-zinc-950/90',
  },
};

export const CATEGORIES = [
  { id: 'all', label: 'Все награды', icon: 'Sparkles' },
  { id: 'christmas', label: 'Новогодние 🎄', icon: 'TreePine' },
  { id: 'titles', label: 'Титулы', icon: 'Crown' },
  { id: 'uc', label: 'UC', icon: 'Coins' },
  { id: 'popularity', label: 'Популярность', icon: 'Flame' },
  { id: 'roses', label: 'Розы и букеты', icon: 'Flower' },
  { id: 'jokes', label: 'Шуточные', icon: 'Smile' },
  { id: 'spins', label: 'Вращения', icon: 'RotateCcw' },
];

export const TITLES_LIST = [
  {
    id: 'title-sosun',
    slug: 'sosun',
    name: 'СОСУН',
    rarity: 'rare',
    tier: 'Редкий',
    icon: 'Baby',
    description: 'Для тех, кто мастерски умеет присосаться к удаче и вытягивать максимум из каждого вращения.',
    conditions: 'Собрать 3 соски в инвентаре или получить при особом дропе.',
    auraColor: 'from-sky-500/35 to-cyan-500/10',
    accentColor: '#38bdf8',
    glowShadow: 'shadow-[0_0_25px_rgba(56,189,248,0.35)]',
    cardBorder: 'border-sky-500/40 hover:border-sky-400',
  },
  {
    id: 'title-vozduhan',
    slug: 'vozduhan',
    name: 'ВОЗДУХАН',
    rarity: 'rare',
    tier: 'Редкий',
    icon: 'Wind',
    description: 'Сотрясает воздух громкими обещаниями и легко крутит колесо фортуны.',
    conditions: '50 вращений за сутки на платформе.',
    auraColor: 'from-blue-500/35 to-indigo-500/10',
    accentColor: '#60a5fa',
    glowShadow: 'shadow-[0_0_25px_rgba(96,165,250,0.35)]',
    cardBorder: 'border-blue-500/40 hover:border-blue-400',
  },
  {
    id: 'title-korol',
    slug: 'korol',
    name: 'КОРОЛЬ',
    rarity: 'epic',
    tier: 'Эпический',
    icon: 'Crown',
    description: 'Истинный повелитель платформы. Авторитет, признание и царская щедрость к свите.',
    conditions: 'Топ-1 в рейтинге игроков по популярности.',
    auraColor: 'from-amber-600/40 via-yellow-600/20 to-zinc-950/40',
    accentColor: '#eab308',
    glowShadow: 'shadow-[0_0_30px_rgba(234,179,8,0.4)]',
    cardBorder: 'border-yellow-500/40 hover:border-yellow-400',
  },
  {
    id: 'title-koroleva',
    slug: 'koroleva',
    name: 'КОРОЛЕВА',
    rarity: 'epic',
    tier: 'Эпический',
    icon: 'Sparkle',
    description: 'Грациозная владычица удачи, окруженная букетами роз и восхищением окружающих.',
    conditions: 'Получить не менее 10 букетов роз в подарок от других игроков.',
    auraColor: 'from-pink-500/40 to-rose-500/15',
    accentColor: '#ec4899',
    glowShadow: 'shadow-[0_0_30px_rgba(236,72,153,0.4)]',
    cardBorder: 'border-pink-500/40 hover:border-pink-400',
  },
  {
    id: 'title-cyborg',
    slug: 'cyborg',
    name: 'КИБОРГ',
    rarity: 'mythic',
    tier: 'Мифический',
    icon: 'Bot',
    description: 'Математический расчет, стальные нервы и абсолютный контроль над случайностью.',
    conditions: 'Собрать всю базовую коллекцию сувениров и наград.',
    auraColor: 'from-purple-600/45 via-fuchsia-600/30 to-violet-900/20',
    accentColor: '#a855f7',
    glowShadow: 'shadow-[0_0_35px_rgba(168,85,247,0.5)]',
    cardBorder: 'border-purple-500/50 hover:border-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.3)]',
  },
  {
    id: 'title-vip',
    slug: 'vip',
    name: 'VIP',
    rarity: 'legendary',
    tier: 'Легендарный',
    icon: 'ShieldAlert',
    description: 'Абсолютная элита LUCKY UC. Золотой статус, эксклюзивные привилегии и особое уважение.',
    conditions: 'Специальный персональный статус от администрации платформы.',
    auraColor: 'from-amber-400/50 via-yellow-400/30 to-amber-600/15',
    accentColor: '#f59e0b',
    glowShadow: 'shadow-[0_0_40px_rgba(245,158,11,0.6)]',
    cardBorder: 'border-amber-400/60 hover:border-amber-300 shadow-[0_0_25px_rgba(245,158,11,0.4)]',
  },
];

export const REWARDS_CATALOG = [
  // UC
  {
    id: 'reward-uc-30',
    name: '30 UC',
    category: 'uc',
    rarity: 'rare',
    icon: 'Coins',
    value: 30,
    description: '30 внутриигровых UC. Начисляются администратором после подтверждения.',
    conditions: 'Выполнить задания сезона или получить в турнире',
  },
  {
    id: 'reward-uc-60',
    name: '60 UC',
    category: 'uc',
    rarity: 'epic',
    icon: 'Coins',
    value: 60,
    description: '60 внутриигровых UC. Двойной комплект для крутых скинов.',
    conditions: 'Особые турнирные достижения и рекорды',
  },

  // Popularity
  {
    id: 'reward-pop-10',
    name: '10 популярности',
    category: 'popularity',
    rarity: 'common',
    icon: 'Flame',
    value: 10,
    description: '+10 к общему счетчику популярности профиля.',
    conditions: 'Ежедневная активность',
  },
  {
    id: 'reward-pop-25',
    name: '25 популярности',
    category: 'popularity',
    rarity: 'common',
    icon: 'Flame',
    value: 25,
    description: '+25 к популярности игрока.',
    conditions: 'Серия из 3 дней входа',
  },
  {
    id: 'reward-pop-50',
    name: '50 популярности',
    category: 'popularity',
    rarity: 'rare',
    icon: 'Flame',
    value: 50,
    description: '+50 к статусу в таблице лидеров.',
    conditions: 'Победа в клановом баттле',
  },
  {
    id: 'reward-pop-100',
    name: '100 популярности',
    category: 'popularity',
    rarity: 'epic',
    icon: 'Flame',
    value: 100,
    description: 'Мощный буст +100 популярности.',
    conditions: 'Главные призовые места месяца',
  },

  // Roses & Bouquets
  {
    id: 'reward-rose-1',
    name: 'Одна роза',
    category: 'roses',
    rarity: 'common',
    icon: 'Flower2',
    value: 1,
    description: 'Изящная алая роза. Можно подарить другу.',
    conditions: 'Базовый дроп',
  },
  {
    id: 'reward-rose-bouquet',
    name: 'Букет роз',
    category: 'roses',
    rarity: 'rare',
    icon: 'Flower',
    value: 5,
    description: 'Красивый букет из 5 роз для ценителей прекрасного.',
    conditions: 'Удачное вращение',
  },
  {
    id: 'reward-rose-big-bouquet',
    name: 'Большой букет роз',
    category: 'roses',
    rarity: 'epic',
    icon: 'Gift',
    value: 20,
    description: 'Шикарный огромный букет, достойный королевских подарков.',
    conditions: 'Специальный ивент',
  },

  // Free Spins
  {
    id: 'reward-spin-1',
    name: '+1 бесплатное вращение',
    category: 'spins',
    rarity: 'common',
    icon: 'RotateCcw',
    value: 1,
    description: 'Дает +1 вращение на колесе фортуны.',
    conditions: 'Случайный бонус',
  },
  {
    id: 'reward-spin-2',
    name: '+2 бесплатных вращения',
    category: 'spins',
    rarity: 'rare',
    icon: 'Sparkles',
    value: 2,
    description: 'Дает +2 дополнительных вращения.',
    conditions: 'Случайный бонус',
  },

  // Titles included in catalog
  ...TITLES_LIST.map((t) => ({
    id: t.id,
    name: t.name,
    category: 'titles',
    rarity: t.rarity,
    icon: t.icon,
    value: 0,
    isTitle: true,
    titleSlug: t.slug,
    description: t.description,
    conditions: t.conditions,
  })),

  // Joke Rewards & Souvenirs
  {
    id: 'reward-pacifier-gold',
    name: 'Золотая соска',
    category: 'jokes',
    rarity: 'legendary',
    icon: 'Award',
    value: 500,
    description: 'Эксклюзивная золотая соска высшей ювелирной пробы.',
    conditions: 'Легендарный редчайший трофей',
  },
  {
    id: 'reward-pacifier-silver',
    name: 'Серебряная соска',
    category: 'jokes',
    rarity: 'epic',
    icon: 'Award',
    value: 250,
    description: 'Изящная серебряная соска для знатоков стиля.',
    conditions: 'Эпический дроп',
  },
  {
    id: 'reward-pacifier-bronze',
    name: 'Бронзовая соска',
    category: 'jokes',
    rarity: 'rare',
    icon: 'Award',
    value: 100,
    description: 'Бронзовый сувенир за первые шаги к успеху.',
    conditions: 'Редкий сувенир',
  },
  {
    id: 'reward-cup',
    name: 'Кубок',
    category: 'jokes',
    rarity: 'epic',
    icon: 'Trophy',
    value: 300,
    description: 'Позолоченный кубок победителя сезонной битвы.',
    conditions: 'Победа в сезонном состязании',
  },
  {
    id: 'reward-boxers-grandpa',
    name: 'Трусы деда',
    category: 'jokes',
    rarity: 'rare',
    icon: 'Shirt',
    value: 50,
    description: 'Уютные семейники в синий горошек. Хранят тепло советского уюта.',
    conditions: 'Шуточный дроп из секретного ящика',
  },
  {
    id: 'reward-boxers-andrey',
    name: 'Трусы Андрея',
    category: 'jokes',
    rarity: 'rare',
    icon: 'Shirt',
    value: 50,
    description: 'Именной артефакт чрезвычайной харизмы и дерзости.',
    conditions: 'Личный подарок от Андрея',
  },
  {
    id: 'reward-pacifier-deputy',
    name: 'Соска Зама',
    category: 'jokes',
    rarity: 'rare',
    icon: 'Smile',
    value: 75,
    description: 'Успокоительное спецсредство для Заместителя Главного.',
    conditions: 'Награда за стальное спокойствие',
  },
  {
    id: 'reward-shame-of-the-day',
    name: 'Позор дня',
    category: 'jokes',
    rarity: 'common',
    icon: 'Skull',
    value: 0,
    description: 'Шуточный анти-трофей за серию эпических промахов.',
    conditions: '10 попыток без ценного дропа',
  },
];

export const CHRISTMAS_REWARDS = [
  // Common (1-5)
  {
    id: 'reward-xmas-sticker',
    name: 'Новогодний стикер',
    category: 'christmas',
    rarity: 'common',
    icon: 'Sparkles',
    value: 20,
    description: 'Праздничный стикер с новогодним сиянием.',
    conditions: 'Выпадает из Рождественского Колеса',
  },
  {
    id: 'reward-xmas-snowflake-badge',
    name: 'Значок Снежинка',
    category: 'christmas',
    rarity: 'common',
    icon: 'Sparkle',
    value: 25,
    description: 'Кристальный значок ледяной снежинки.',
    conditions: 'Выпадает из Рождественского Колеса',
  },
  {
    id: 'reward-xmas-candy-cane',
    name: 'Леденец-Трость',
    category: 'christmas',
    rarity: 'common',
    icon: 'Candy',
    value: 30,
    description: 'Сладкий рождественский леденец в красно-белую полоску.',
    conditions: 'Выпадает из Рождественского Колеса',
  },
  {
    id: 'reward-xmas-avatar',
    name: 'Новогодняя аватарка',
    category: 'christmas',
    rarity: 'common',
    icon: 'UserCheck',
    value: 50,
    description: 'Праздничная шапочка Санты для твоего профиля.',
    conditions: 'Выпадает из Рождественского Колеса',
  },
  {
    id: 'reward-xmas-frame',
    name: 'Зимняя рамка профиля',
    category: 'christmas',
    rarity: 'common',
    icon: 'Square',
    value: 75,
    description: 'Ледяная морозная рамка с узорами на стекле.',
    conditions: 'Выпадает из Рождественского Колеса',
  },

  // Rare (6-10)
  {
    id: 'reward-xmas-snow-globe',
    name: 'Снежный шар',
    category: 'christmas',
    rarity: 'rare',
    icon: 'Globe',
    value: 150,
    description: 'Магический шар с кружащимся внутри снегопадом.',
    conditions: 'Выпадает из Рождественского Колеса',
  },
  {
    id: 'reward-xmas-santas-gift',
    name: 'Подарок Санты',
    category: 'christmas',
    rarity: 'rare',
    icon: 'Gift',
    value: 200,
    description: 'Таинственная коробка с золотой лентой прямо из Лапландии.',
    conditions: 'Выпадает из Рождественского Колеса',
  },
  {
    id: 'reward-xmas-reindeer-badge',
    name: 'Значок Оленёнок',
    category: 'christmas',
    rarity: 'rare',
    icon: 'Award',
    value: 250,
    description: 'Значок с верным спутником Санты.',
    conditions: 'Выпадает из Рождественского Колеса',
  },
  {
    id: 'reward-xmas-golden-bell',
    name: 'Золотой колокольчик',
    category: 'christmas',
    rarity: 'rare',
    icon: 'Bell',
    value: 300,
    description: 'Звонкий колокольчик, предвещающий новогоднее чудо.',
    conditions: 'Выпадает из Рождественского Колеса',
  },
  {
    id: 'reward-xmas-chest',
    name: 'Рождественский сундук',
    category: 'christmas',
    rarity: 'rare',
    icon: 'Archive',
    value: 400,
    description: 'Деревянный резной сундук с зимними сокровищами.',
    conditions: 'Выпадает из Рождественского Колеса',
  },

  // Epic (11-13)
  {
    id: 'reward-xmas-magic-snowflake',
    name: 'Волшебная снежинка',
    category: 'christmas',
    rarity: 'epic',
    icon: 'Zap',
    value: 800,
    description: 'Вечная снежинка, излучающая северное сияние.',
    conditions: 'Выпадает из Рождественского Колеса',
  },
  {
    id: 'reward-xmas-golden-tree',
    name: 'Золотая ёлочка',
    category: 'christmas',
    rarity: 'epic',
    icon: 'TreePine',
    value: 1200,
    description: 'Драгоценная миниатюрная ёлочка из чистого золота.',
    conditions: 'Выпадает из Рождественского Колеса',
  },
  {
    id: 'reward-xmas-ice-dragon-avatar',
    name: 'Аватар Ледяного дракона',
    category: 'christmas',
    rarity: 'epic',
    icon: 'Flame',
    value: 1500,
    description: 'Мифический ледяной дракон, повелитель метелей.',
    conditions: 'Выпадает из Рождественского Колеса',
  },

  // Legendary (14)
  {
    id: 'reward-xmas-santas-sleigh',
    name: 'Золотые сани Санты',
    category: 'christmas',
    rarity: 'legendary',
    icon: 'Crown',
    value: 3000,
    description: 'Легендарные сани, рассекающие звездное рождественское небо.',
    conditions: 'Выпадает из Рождественского Колеса',
  },

  // Mythic (15)
  {
    id: 'reward-xmas-miracle-box',
    name: 'Шкатулка Рождественского чуда',
    category: 'christmas',
    rarity: 'mythic',
    icon: 'PackageCheck',
    value: 5000,
    description: 'Вершина рождественской магии! Исполняет самые заветные желания.',
    conditions: 'Главный приз новогоднего сезона',
  },
];

// Combine all rewards
REWARDS_CATALOG.push(...CHRISTMAS_REWARDS);

// ==============================================================================
// DETERMINISTIC DATABASE UUID MAPPINGS (for Supabase PostgreSQL compatibility)
// ==============================================================================
export const ITEM_UUID_MAP = {
  'reward-uc-30': '10000000-0000-0000-0000-000000000001',
  'reward-uc-60': '10000000-0000-0000-0000-000000000002',
  'reward-pop-10': '10000000-0000-0000-0000-000000000003',
  'reward-pop-25': '10000000-0000-0000-0000-000000000004',
  'reward-pop-50': '10000000-0000-0000-0000-000000000005',
  'reward-pop-100': '10000000-0000-0000-0000-000000000006',
  'reward-rose-single': '10000000-0000-0000-0000-000000000007',
  'reward-rose-bouquet': '10000000-0000-0000-0000-000000000008',
  'reward-rose-large': '10000000-0000-0000-0000-000000000009',
  'reward-spin-1': '10000000-0000-0000-0000-000000000010',
  'reward-spin-2': '10000000-0000-0000-0000-000000000011',
  'title-sosun': '10000000-0000-0000-0000-000000000012',
  'title-vozduhan': '10000000-0000-0000-0000-000000000013',
  'title-korol': '10000000-0000-0000-0000-000000000014',
  'title-koroleva': '10000000-0000-0000-0000-000000000015',
  'title-cyborg': '10000000-0000-0000-0000-000000000016',
  'title-vip': '10000000-0000-0000-0000-000000000017',
  'reward-pacifier-gold': '10000000-0000-0000-0000-000000000018',
  'reward-pacifier-silver': '10000000-0000-0000-0000-000000000019',
  'reward-pacifier-bronze': '10000000-0000-0000-0000-000000000020',
  'reward-cup': '10000000-0000-0000-0000-000000000021',
  'reward-underpants-grandpa': '10000000-0000-0000-0000-000000000022',
  'reward-underpants-andrey': '10000000-0000-0000-0000-000000000023',
  'reward-pacifier-deputy': '10000000-0000-0000-0000-000000000024',
  'reward-shame-of-the-day': '10000000-0000-0000-0000-000000000025',
  'reward-xmas-sticker': '10000000-0000-0000-0000-000000000031',
  'reward-xmas-snowflake-badge': '10000000-0000-0000-0000-000000000032',
  'reward-xmas-candy-cane': '10000000-0000-0000-0000-000000000033',
  'reward-xmas-avatar': '10000000-0000-0000-0000-000000000034',
  'reward-xmas-frame': '10000000-0000-0000-0000-000000000035',
  'reward-xmas-snow-globe': '10000000-0000-0000-0000-000000000036',
  'reward-xmas-santas-gift': '10000000-0000-0000-0000-000000000037',
  'reward-xmas-reindeer-badge': '10000000-0000-0000-0000-000000000038',
  'reward-xmas-golden-bell': '10000000-0000-0000-0000-000000000039',
  'reward-xmas-chest': '10000000-0000-0000-0000-000000000040',
  'reward-xmas-magic-snowflake': '10000000-0000-0000-0000-000000000041',
  'reward-xmas-golden-tree': '10000000-0000-0000-0000-000000000042',
  'reward-xmas-ice-dragon-avatar': '10000000-0000-0000-0000-000000000043',
  'reward-xmas-santas-sleigh': '10000000-0000-0000-0000-000000000044',
  'reward-xmas-miracle-box': '10000000-0000-0000-0000-000000000045',
};

export const UUID_TO_SLUG_MAP = Object.fromEntries(
  Object.entries(ITEM_UUID_MAP).map(([slug, uuid]) => [uuid, slug])
);

// Enrich TITLES_LIST and REWARDS_CATALOG with uuid
TITLES_LIST.forEach((t) => {
  t.uuid = ITEM_UUID_MAP[t.id] || null;
});

REWARDS_CATALOG.forEach((r) => {
  r.uuid = ITEM_UUID_MAP[r.id] || null;
});

/**
 * Returns database UUID for an item (from slug or existing UUID).
 */
export function toDbUuid(idOrSlug) {
  if (!idOrSlug) return null;
  if (ITEM_UUID_MAP[idOrSlug]) return ITEM_UUID_MAP[idOrSlug];
  if (typeof idOrSlug === 'string' && idOrSlug.includes('-') && idOrSlug.length === 36) {
    return idOrSlug;
  }
  const match = REWARDS_CATALOG.find((r) => r.id === idOrSlug || r.uuid === idOrSlug || r.name === idOrSlug);
  return match?.uuid || idOrSlug;
}

/**
 * Returns semantic slug ID for an item (from database UUID or slug).
 */
export function toSlugId(uuidOrSlug) {
  if (!uuidOrSlug) return null;
  if (UUID_TO_SLUG_MAP[uuidOrSlug]) return UUID_TO_SLUG_MAP[uuidOrSlug];
  const match = REWARDS_CATALOG.find((r) => r.uuid === uuidOrSlug || r.id === uuidOrSlug);
  return match?.id || uuidOrSlug;
}

/**
 * Finds reward metadata by slug, UUID or name.
 */
export function resolveReward(query) {
  if (!query) return null;
  const targetUuid = ITEM_UUID_MAP[query] || query;
  return (
    REWARDS_CATALOG.find(
      (r) => r.id === query || r.uuid === query || r.uuid === targetUuid || r.name === query
    ) || null
  );
}

/**
 * Finds title metadata by slug, UUID or name.
 */
export function resolveTitle(query) {
  if (!query) return null;
  const targetUuid = ITEM_UUID_MAP[query] || query;
  return (
    TITLES_LIST.find(
      (t) => t.id === query || t.uuid === query || t.uuid === targetUuid || t.slug === query || t.name === query
    ) || null
  );
}

