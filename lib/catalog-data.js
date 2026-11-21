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
  uncommon: {
    id: 'uncommon',
    label: 'Необычный',
    color: '#10b981',
    badgeBg: 'bg-emerald-500/20',
    badgeText: 'text-emerald-300',
    border: 'border-emerald-500/40',
    glow: 'shadow-[0_0_20px_rgba(16,185,129,0.25)]',
    cardGradient: 'from-emerald-950/40 via-zinc-900/80 to-zinc-950/90',
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
  'pro-epic': {
    id: 'pro-epic',
    label: 'PRO-EPIC',
    color: '#ff0055',
    badgeBg: 'bg-rose-500/25',
    badgeText: 'text-rose-300 font-black',
    border: 'border-rose-500/60',
    glow: 'shadow-[0_0_35px_rgba(255,0,85,0.55)]',
    cardGradient: 'from-rose-950/60 via-purple-950/40 to-zinc-950/90',
  },
  pro_epic: {
    id: 'pro-epic',
    label: 'PRO-EPIC',
    color: '#ff0055',
    badgeBg: 'bg-rose-500/25',
    badgeText: 'text-rose-300 font-black',
    border: 'border-rose-500/60',
    glow: 'shadow-[0_0_35px_rgba(255,0,85,0.55)]',
    cardGradient: 'from-rose-950/60 via-purple-950/40 to-zinc-950/90',
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
    priceCoins: 250,
    pricePoints: 250,
    description: 'Для тех, кто мастерски умеет присосаться к удаче и вытягивать максимум из каждого вращения.',
    conditions: 'Собрать 3 соски в инвентаре или приобрести в магазине.',
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
    priceCoins: 350,
    pricePoints: 350,
    description: 'Сотрясает воздух громкими обещаниями и легко крутит колесо фортуны.',
    conditions: '50 вращений за сутки на платформе или покупка в магазине.',
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
    priceCoins: 750,
    pricePoints: 750,
    description: 'Истинный повелитель платформы. Авторитет, признание и царская щедрость к свите.',
    conditions: 'Топ-1 в рейтинге игроков по популярности или покупка в магазине.',
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
    priceCoins: 750,
    pricePoints: 750,
    description: 'Грациозная владычица удачи, окруженная букетами роз и восхищением окружающих.',
    conditions: 'Получить не менее 10 букетов роз в подарок или купить в магазине.',
    auraColor: 'from-pink-500/40 to-rose-500/15',
    accentColor: '#ec4899',
    glowShadow: 'shadow-[0_0_30px_rgba(236,72,153,0.4)]',
    cardBorder: 'border-pink-500/40 hover:border-pink-400',
  },
  // --- 5 EXCLUSIVE PRO-EPIC TITLES ---
  {
    id: 'title-phoenix',
    slug: 'phoenix',
    name: 'ФЕНИКС',
    rarity: 'pro-epic',
    tier: 'PRO-EPIC',
    icon: 'Flame',
    priceCoins: 1200,
    pricePoints: 1200,
    description: 'Возрождается из пламени азарта. Каждое поражение превращает в великий триумф.',
    conditions: 'Приобрести в магазине за 1200 монет.',
    auraColor: 'from-orange-600/45 via-red-600/30 to-amber-500/20',
    accentColor: '#f97316',
    glowShadow: 'shadow-[0_0_35px_rgba(249,115,22,0.55)]',
    cardBorder: 'border-orange-500/60 hover:border-orange-400 shadow-[0_0_20px_rgba(249,115,22,0.3)]',
  },
  {
    id: 'title-phantom',
    slug: 'phantom',
    name: 'ПРИЗРАК',
    rarity: 'pro-epic',
    tier: 'PRO-EPIC',
    icon: 'Wind',
    priceCoins: 1350,
    pricePoints: 1350,
    description: 'Неуловимый мастер удачи. Появляется в таблице лидеров внезапно и забирает банк.',
    conditions: 'Приобрести в магазине за 1350 монет.',
    auraColor: 'from-cyan-500/45 via-teal-500/30 to-blue-600/20',
    accentColor: '#06b6d4',
    glowShadow: 'shadow-[0_0_35px_rgba(6,182,212,0.55)]',
    cardBorder: 'border-cyan-500/60 hover:border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.3)]',
  },
  {
    id: 'title-dominator',
    slug: 'dominator',
    name: 'ДОМИНАТОР',
    rarity: 'pro-epic',
    tier: 'PRO-EPIC',
    icon: 'Award',
    priceCoins: 1500,
    pricePoints: 1500,
    description: 'Непререкаемая сила и тотальный перевес. Подчиняет теорию вероятностей своей воле.',
    conditions: 'Приобрести в магазине за 1500 монет.',
    auraColor: 'from-violet-600/45 via-fuchsia-600/30 to-rose-600/20',
    accentColor: '#c026d3',
    glowShadow: 'shadow-[0_0_35px_rgba(192,38,211,0.55)]',
    cardBorder: 'border-fuchsia-500/60 hover:border-fuchsia-400 shadow-[0_0_20px_rgba(192,38,211,0.3)]',
  },
  {
    id: 'title-titan',
    slug: 'titan',
    name: 'ТИТАН',
    rarity: 'pro-epic',
    tier: 'PRO-EPIC',
    icon: 'ShieldAlert',
    priceCoins: 1650,
    pricePoints: 1650,
    description: 'Несокрушимый монолит платформы. Обладает железной выдержкой и колоссальным запасом монет.',
    conditions: 'Приобрести в магазине за 1650 монет.',
    auraColor: 'from-emerald-600/45 via-teal-600/30 to-lime-500/20',
    accentColor: '#10b981',
    glowShadow: 'shadow-[0_0_35px_rgba(16,185,129,0.55)]',
    cardBorder: 'border-emerald-500/60 hover:border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]',
  },
  {
    id: 'title-overlord',
    slug: 'overlord',
    name: 'ОВЕРЛОРД',
    rarity: 'pro-epic',
    tier: 'PRO-EPIC',
    icon: 'Crown',
    priceCoins: 2800,
    pricePoints: 2800,
    description: 'Высшая ступень PRO-мастерства. Повелитель колеса удачи и куратор новогоднего азарта.',
    conditions: 'Приобрести в магазине за 2800 монет.',
    auraColor: 'from-rose-600/45 via-amber-500/30 to-purple-600/20',
    accentColor: '#f43f5e',
    glowShadow: 'shadow-[0_0_35px_rgba(244,63,94,0.55)]',
    cardBorder: 'border-rose-500/60 hover:border-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.3)]',
  },
  {
    id: 'title-terpilla',
    slug: 'terpilla',
    name: 'ТЕРПИЛЛА',
    rarity: 'rare',
    tier: 'Редкий',
    icon: 'Shield',
    priceCoins: 300,
    pricePoints: 300,
    description: 'Терпит любые капризы фортуны, промахи и серии неудач, чтобы в итоге забрать самый жирный куш.',
    conditions: 'Выпадает из Lucky Spin или приобретается за 300 монет.',
    auraColor: 'from-blue-600/35 to-slate-500/10',
    accentColor: '#64748b',
    glowShadow: 'shadow-[0_0_25px_rgba(100,116,139,0.35)]',
    cardBorder: 'border-slate-500/40 hover:border-slate-400',
  },
  {
    id: 'title-podsos',
    slug: 'podsos',
    name: 'ПОДСОС',
    rarity: 'rare',
    tier: 'Редкий',
    icon: 'Smile',
    priceCoins: 350,
    pricePoints: 350,
    description: 'Мастерски находит богатых друзей и всегда оказывается рядом в момент щедрой раздачи подарков.',
    conditions: 'Выпадает из Lucky Spin или приобретается за 350 монет.',
    auraColor: 'from-cyan-500/35 to-teal-500/10',
    accentColor: '#14b8a6',
    glowShadow: 'shadow-[0_0_25px_rgba(20,184,166,0.35)]',
    cardBorder: 'border-teal-500/40 hover:border-teal-400',
  },
  {
    id: 'title-santa',
    slug: 'santa',
    name: 'САНТА',
    rarity: 'legendary',
    tier: 'Легендарный',
    icon: 'TreePine',
    priceCoins: 3000,
    pricePoints: 3000,
    description: 'Главный символ новогоднего триумфа! Рассылает подарки, дарит золотой блеск и приносит новогоднее чудо.',
    conditions: 'Легендарный дроп из Lucky Spin или 3000 монет в магазине.',
    auraColor: 'from-red-600/50 via-amber-400/30 to-emerald-600/20',
    accentColor: '#ef4444',
    glowShadow: 'shadow-[0_0_40px_rgba(239,68,68,0.6)]',
    cardBorder: 'border-red-500/60 hover:border-red-400 shadow-[0_0_25px_rgba(239,68,68,0.4)]',
  },
  {
    id: 'title-femboy',
    slug: 'femboy',
    name: 'FEMBOY',
    rarity: 'epic',
    tier: 'Эпический',
    icon: 'Sparkles',
    imageUrl: '/images/femboy.png',
    priceCoins: 800,
    pricePoints: 800,
    description: 'Особый эстетичный титул! При экипировке рядом с вашим никнеймом появляется уникальная иллюстрация персонажа.',
    conditions: 'Приобрести в магазине за 800 монет или выиграть в Lucky Spin.',
    auraColor: 'from-pink-500/40 via-purple-500/25 to-rose-500/15',
    accentColor: '#f472b6',
    glowShadow: 'shadow-[0_0_35px_rgba(244,114,182,0.55)]',
    cardBorder: 'border-pink-500/50 hover:border-pink-400 shadow-[0_0_20px_rgba(244,114,182,0.3)]',
  },
  {
    id: 'title-nefor',
    slug: 'nefor',
    name: 'NEFOR',
    rarity: 'rare',
    tier: 'Редкий',
    icon: 'Flame',
    imageUrl: '/images/nefor.png',
    priceCoins: 450,
    pricePoints: 450,
    description: 'Бунтарский стиль, альтернативный кибер-вайб и полная независимость от чужих ожиданий.',
    conditions: 'Приобрести в магазине за 450 монет или выиграть в Lucky Spin.',
    auraColor: 'from-teal-600/40 via-purple-600/25 to-cyan-500/15',
    accentColor: '#2dd4bf',
    glowShadow: 'shadow-[0_0_30px_rgba(45,212,191,0.45)]',
    cardBorder: 'border-teal-500/50 hover:border-teal-400 shadow-[0_0_20px_rgba(45,212,191,0.25)]',
  },
  {
    id: 'title-balbibol',
    slug: 'balbibol',
    name: 'BALBIBOL',
    rarity: 'uncommon',
    tier: 'Необычный',
    icon: 'Award',
    imageUrl: '/images/balbibol.png',
    priceCoins: 150,
    pricePoints: 150,
    description: 'Задорный уличный вайб, бесконечный позитив, надутая жвачка и лёгкость на каждом спине.',
    conditions: 'Приобрести в магазине за 150 монет или выиграть в Lucky Spin.',
    auraColor: 'from-amber-500/35 to-orange-500/15',
    accentColor: '#fb923c',
    glowShadow: 'shadow-[0_0_25px_rgba(251,146,60,0.35)]',
    cardBorder: 'border-orange-500/40 hover:border-orange-400',
  },
  {
    id: 'title-imperator',
    slug: 'imperator',
    name: 'ИМПЕРАТОР',
    rarity: 'pro-epic',
    tier: 'PRO-EPIC',
    icon: 'Crown',
    priceCoins: 2200,
    pricePoints: 2200,
    description: 'Абсолютный триумфатор платформы. Вершина PRO-мастерства, безграничные амбиции и непоколебимый авторитет.',
    conditions: 'Приобрести в магазине за 2200 монет.',
    auraColor: 'from-amber-600/50 via-red-600/30 to-yellow-500/20',
    accentColor: '#f59e0b',
    glowShadow: 'shadow-[0_0_35px_rgba(245,158,11,0.6)]',
    cardBorder: 'border-amber-400/60 hover:border-amber-300 shadow-[0_0_25px_rgba(245,158,11,0.35)]',
  },
  {
    id: 'title-demiurge',
    slug: 'demiurge',
    name: 'ДЕМИУРГ',
    rarity: 'mythic',
    tier: 'Мифический',
    icon: 'Zap',
    priceCoins: 5500,
    pricePoints: 5500,
    description: 'Создатель собственной игровой реальности. Управляет вероятностями и направляет колесо фортуны силой мысли.',
    conditions: 'Мифический статус или покупка в магазине за 5500 монет.',
    auraColor: 'from-violet-600/50 via-purple-700/35 to-fuchsia-600/25',
    accentColor: '#c084fc',
    glowShadow: 'shadow-[0_0_40px_rgba(192,132,252,0.6)]',
    cardBorder: 'border-purple-400/60 hover:border-purple-300 shadow-[0_0_30px_rgba(192,132,252,0.4)]',
  },
  {
    id: 'title-cyborg',
    slug: 'cyborg',
    name: 'КИБОРГ',
    rarity: 'mythic',
    tier: 'Мифический',
    icon: 'Bot',
    priceCoins: 5000,
    pricePoints: 5000,
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
    priceCoins: null,
    pricePoints: null,
    excludedFromShop: true,
    isVipExclusive: true,
    description: 'Абсолютная элита LUCKY UC. Золотой статус, эксклюзивные привилегии и особое уважение.',
    conditions: 'Специальный персональный статус от администрации платформы.',
    auraColor: 'from-amber-400/50 via-yellow-400/30 to-amber-600/15',
    accentColor: '#f59e0b',
    glowShadow: 'shadow-[0_0_40px_rgba(245,158,11,0.6)]',
    cardBorder: 'border-amber-400/60 hover:border-amber-300 shadow-[0_0_25px_rgba(245,158,11,0.4)]',
  },
];

export const REWARDS_CATALOG = [
  // COIN WHEEL REWARDS (Earned via Roulette - Added directly to user coin balance)
  {
    id: 'reward-coins-25',
    name: '25 Монет',
    category: 'coins',
    rarity: 'common',
    icon: 'Coins',
    value: 25,
    priceCoins: null,
    pricePoints: null,
    excludedFromShop: true,
    description: '25 золотых монет. Моментально зачисляются на ваш баланс при выигрыше на Колесе.',
    conditions: 'Выпадает из Рождественского Колеса',
  },
  {
    id: 'reward-coins-50',
    name: '50 Монет',
    category: 'coins',
    rarity: 'uncommon',
    icon: 'Coins',
    value: 50,
    priceCoins: null,
    pricePoints: null,
    excludedFromShop: true,
    description: '50 золотых монет. Отличный выигрыш для накопления на редкие подарки.',
    conditions: 'Выпадает из Рождественского Колеса',
  },
  {
    id: 'reward-coins-75',
    name: '75 Монет',
    category: 'coins',
    rarity: 'rare',
    icon: 'Coins',
    value: 75,
    priceCoins: null,
    pricePoints: null,
    excludedFromShop: true,
    description: '75 золотых монет. Солидная сумма для покупки эпических предметов и титулов.',
    conditions: 'Выпадает из Рождественского Колеса',
  },
  {
    id: 'reward-coins-125',
    name: '125 Монет',
    category: 'coins',
    rarity: 'epic',
    icon: 'Coins',
    value: 125,
    priceCoins: null,
    pricePoints: null,
    excludedFromShop: true,
    description: '125 золотых монет! Крупный куш на Рождественском Колесе Фортуны!',
    conditions: 'Редкий куш из Рождественского Колеса',
  },

  // UC (EXCLUDED FROM SHOP - Cannot be bought for Coins/Points)
  {
    id: 'reward-uc-30',
    name: '30 UC',
    category: 'uc',
    rarity: 'rare',
    icon: 'Coins',
    value: 30,
    priceCoins: null,
    pricePoints: null,
    excludedFromShop: true,
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
    priceCoins: null,
    pricePoints: null,
    excludedFromShop: true,
    description: '60 внутриигровых UC. Двойной комплект для крутых скинов.',
    conditions: 'Особые турнирные достижения и рекорды',
  },

  // Popularity (Dynamic balanced coin pricing)
  {
    id: 'reward-pop-10',
    name: '10 популярности',
    category: 'popularity',
    rarity: 'common',
    icon: 'Flame',
    value: 10,
    priceCoins: 25,
    pricePoints: 25,
    description: '+10 к общему счетчику популярности профиля.',
    conditions: 'Ежедневная активность или покупка за 25 монет',
  },
  {
    id: 'reward-pop-25',
    name: '25 популярности',
    category: 'popularity',
    rarity: 'uncommon',
    icon: 'Flame',
    value: 25,
    priceCoins: 60,
    pricePoints: 60,
    description: '+25 к популярности игрока.',
    conditions: 'Серия из 3 дней входа или покупка за 60 монет',
  },
  {
    id: 'reward-pop-50',
    name: '50 популярности',
    category: 'popularity',
    rarity: 'rare',
    icon: 'Flame',
    value: 50,
    priceCoins: 160,
    pricePoints: 160,
    description: '+50 к статусу в таблице лидеров.',
    conditions: 'Победа в клановом баттле или покупка за 160 монет',
  },
  {
    id: 'reward-pop-100',
    name: '100 популярности',
    category: 'popularity',
    rarity: 'epic',
    icon: 'Flame',
    value: 100,
    priceCoins: 480,
    pricePoints: 480,
    description: 'Мощный буст +100 популярности.',
    conditions: 'Главные призовые места месяца или покупка за 480 монет',
  },

  // Roses & Bouquets (Common, Rare, Epic)
  {
    id: 'reward-rose-1',
    name: 'Одна роза',
    category: 'roses',
    rarity: 'common',
    icon: 'Flower2',
    value: 1,
    priceCoins: 20,
    pricePoints: 20,
    description: 'Изящная алая роза. Можно подарить другу.',
    conditions: 'Базовый дроп или покупка за 20 монет',
  },
  {
    id: 'reward-rose-bouquet',
    name: 'Букет роз',
    category: 'roses',
    rarity: 'rare',
    icon: 'Flower',
    value: 5,
    priceCoins: 120,
    pricePoints: 120,
    description: 'Красивый букет из 5 роз для ценителей прекрасного.',
    conditions: 'Удачное вращение или покупка за 120 монет',
  },
  {
    id: 'reward-rose-big-bouquet',
    name: 'Большой букет роз',
    category: 'roses',
    rarity: 'epic',
    icon: 'Gift',
    value: 20,
    priceCoins: 550,
    pricePoints: 550,
    description: 'Шикарный огромный букет, достойный королевских подарков.',
    conditions: 'Специальный ивент или покупка за 550 монет',
  },

  // Free Spins
  {
    id: 'reward-spin-1',
    name: '+1 бесплатное вращение',
    category: 'spins',
    rarity: 'uncommon',
    icon: 'RotateCcw',
    value: 1,
    priceCoins: 75,
    pricePoints: 75,
    description: 'Дает +1 вращение на колесе фортуны.',
    conditions: 'Случайный бонус или покупка за 75 монет',
  },
  {
    id: 'reward-spin-2',
    name: '+2 бесплатных вращения',
    category: 'spins',
    rarity: 'rare',
    icon: 'Sparkles',
    value: 2,
    priceCoins: 140,
    pricePoints: 140,
    description: 'Дает +2 дополнительных вращения.',
    conditions: 'Случайный бонус или покупка за 140 монет',
  },

  // Titles included in catalog
  ...TITLES_LIST.map((t) => ({
    id: t.id,
    name: t.name,
    category: 'titles',
    rarity: t.rarity,
    icon: t.icon,
    value: 0,
    priceCoins: t.priceCoins,
    pricePoints: t.pricePoints,
    excludedFromShop: t.excludedFromShop,
    isVipExclusive: t.isVipExclusive,
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
    priceCoins: 2600,
    pricePoints: 2600,
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
    priceCoins: 500,
    pricePoints: 500,
    description: 'Изящная серебряная соска для знатоков стиля.',
    conditions: 'Эпический дроп или покупка за 500 монет',
  },
  {
    id: 'reward-pacifier-bronze',
    name: 'Бронзовая соска',
    category: 'jokes',
    rarity: 'rare',
    icon: 'Award',
    value: 100,
    priceCoins: 200,
    pricePoints: 200,
    description: 'Бронзовый сувенир за первые шаги к успеху.',
    conditions: 'Редкий сувенир или покупка за 200 монет',
  },
  {
    id: 'reward-cup',
    name: 'Кубок',
    category: 'jokes',
    rarity: 'epic',
    icon: 'Trophy',
    value: 300,
    priceCoins: 600,
    pricePoints: 600,
    description: 'Позолоченный кубок победителя сезонной битвы.',
    conditions: 'Победа в сезонном состязании или покупка за 600 монет',
  },
  {
    id: 'reward-boxers-grandpa',
    name: 'Трусы деда',
    category: 'jokes',
    rarity: 'uncommon',
    icon: 'Shirt',
    value: 50,
    priceCoins: 70,
    pricePoints: 70,
    description: 'Уютные семейники в синий горошек. Хранят тепло советского уюта.',
    conditions: 'Шуточный дроп из секретного ящика или 70 монет',
  },
  {
    id: 'reward-boxers-andrey',
    name: 'Трусы Андрея',
    category: 'jokes',
    rarity: 'uncommon',
    icon: 'Shirt',
    value: 50,
    priceCoins: 85,
    pricePoints: 85,
    description: 'Именной артефакт чрезвычайной харизмы и дерзости.',
    conditions: 'Личный подарок от Андрея или 85 монет',
  },
  {
    id: 'reward-pacifier-deputy',
    name: 'Соска Зама',
    category: 'jokes',
    rarity: 'rare',
    icon: 'Smile',
    value: 75,
    priceCoins: 180,
    pricePoints: 180,
    description: 'Успокоительное спецсредство для Заместителя Главного.',
    conditions: 'Награда за стальное спокойствие или 180 монет',
  },
  {
    id: 'reward-shame-of-the-day',
    name: 'Позор дня',
    category: 'jokes',
    rarity: 'common',
    icon: 'Skull',
    value: 0,
    priceCoins: 15,
    pricePoints: 15,
    description: 'Шуточный анти-трофей за серию эпических промахов.',
    conditions: '10 попыток без ценного дропа или 15 монет',
  },
];

export const CHRISTMAS_REWARDS = [
  // Common (cheap: 20-50 coins)
  {
    id: 'reward-xmas-sticker',
    name: 'Новогодний стикер',
    category: 'christmas',
    rarity: 'common',
    icon: 'Sparkles',
    value: 20,
    priceCoins: 30,
    pricePoints: 30,
    description: 'Праздничный стикер с новогодним сиянием.',
    conditions: 'Выпадает из Рождественского Колеса или 30 монет',
  },
  {
    id: 'reward-xmas-snowflake-badge',
    name: 'Значок Снежинка',
    category: 'christmas',
    rarity: 'common',
    icon: 'Sparkle',
    value: 25,
    priceCoins: 40,
    pricePoints: 40,
    description: 'Кристальный значок ледяной снежинки.',
    conditions: 'Выпадает из Рождественского Колеса или 40 монет',
  },
  {
    id: 'reward-xmas-candy-cane',
    name: 'Леденец-Трость',
    category: 'christmas',
    rarity: 'common',
    icon: 'Candy',
    value: 30,
    priceCoins: 50,
    pricePoints: 50,
    description: 'Сладкий рождественский леденец в красно-белую полоску.',
    conditions: 'Выпадает из Рождественского Колеса или 50 монет',
  },

  // Uncommon (affordable: 60-140 coins)
  {
    id: 'reward-xmas-avatar',
    name: 'Новогодняя аватарка',
    category: 'christmas',
    rarity: 'uncommon',
    icon: 'UserCheck',
    value: 50,
    priceCoins: 90,
    pricePoints: 90,
    description: 'Праздничная шапочка Санты для твоего профиля.',
    conditions: 'Выпадает из Рождественского Колеса или 90 монет',
  },
  {
    id: 'reward-xmas-frame',
    name: 'Зимняя рамка профиля',
    category: 'christmas',
    rarity: 'uncommon',
    icon: 'Square',
    value: 75,
    priceCoins: 110,
    pricePoints: 110,
    description: 'Ледяная морозная рамка с узорами на стекле.',
    conditions: 'Выпадает из Рождественского Колеса или 110 монет',
  },
  {
    id: 'reward-xmas-reindeer-badge',
    name: 'Значок Оленёнок',
    category: 'christmas',
    rarity: 'uncommon',
    icon: 'Award',
    value: 250,
    priceCoins: 130,
    pricePoints: 130,
    description: 'Значок с верным спутником Санты.',
    conditions: 'Выпадает из Рождественского Колеса или 130 монет',
  },

  // Rare (medium: 150-450 coins)
  {
    id: 'reward-xmas-snow-globe',
    name: 'Снежный шар',
    category: 'christmas',
    rarity: 'rare',
    icon: 'Globe',
    value: 150,
    priceCoins: 220,
    pricePoints: 220,
    description: 'Магический шар с кружащимся внутри снегопадом.',
    conditions: 'Выпадает из Рождественского Колеса или 220 монет',
  },
  {
    id: 'reward-xmas-santas-gift',
    name: 'Подарок Санты',
    category: 'christmas',
    rarity: 'rare',
    icon: 'Gift',
    value: 200,
    priceCoins: 280,
    pricePoints: 280,
    description: 'Таинственная коробка с золотой лентой прямо из Лапландии.',
    conditions: 'Выпадает из Рождественского Колеса или 280 монет',
  },
  {
    id: 'reward-xmas-golden-bell',
    name: 'Золотой колокольчик',
    category: 'christmas',
    rarity: 'rare',
    icon: 'Bell',
    value: 300,
    priceCoins: 340,
    pricePoints: 340,
    description: 'Звонкий колокольчик, предвещающий новогоднее чудо.',
    conditions: 'Выпадает из Рождественского Колеса или 340 монет',
  },
  {
    id: 'reward-xmas-chest',
    name: 'Рождественский сундук',
    category: 'christmas',
    rarity: 'rare',
    icon: 'Archive',
    value: 400,
    priceCoins: 420,
    pricePoints: 420,
    description: 'Деревянный резной сундук с зимними сокровищами.',
    conditions: 'Выпадает из Рождественского Колеса или 420 монет',
  },

  // Epic (expensive: 500-950 coins)
  {
    id: 'reward-xmas-magic-snowflake',
    name: 'Волшебная снежинка',
    category: 'christmas',
    rarity: 'epic',
    icon: 'Zap',
    value: 800,
    priceCoins: 680,
    pricePoints: 680,
    description: 'Вечная снежинка, излучающая северное сияние.',
    conditions: 'Выпадает из Рождественского Колеса или 680 монет',
  },
  {
    id: 'reward-xmas-golden-tree',
    name: 'Золотая ёлочка',
    category: 'christmas',
    rarity: 'epic',
    icon: 'TreePine',
    value: 1200,
    priceCoins: 800,
    pricePoints: 800,
    description: 'Драгоценная миниатюрная ёлочка из чистого золота.',
    conditions: 'Выпадает из Рождественского Колеса или 800 монет',
  },
  {
    id: 'reward-xmas-ice-dragon-avatar',
    name: 'Аватар Ледяного дракона',
    category: 'christmas',
    rarity: 'epic',
    icon: 'Flame',
    value: 1500,
    priceCoins: 950,
    pricePoints: 950,
    description: 'Мифический ледяной дракон, повелитель метелей.',
    conditions: 'Выпадает из Рождественского Колеса или 950 монет',
  },

  // Legendary (very expensive: 2500-3500 coins)
  {
    id: 'reward-xmas-santas-sleigh',
    name: 'Золотые сани Санты',
    category: 'christmas',
    rarity: 'legendary',
    icon: 'Crown',
    value: 3000,
    priceCoins: 2800,
    pricePoints: 2800,
    description: 'Легендарные сани, рассекающие звездное рождественское небо.',
    conditions: 'Выпадает из Рождественского Колеса или 2800 монет',
  },

  // Mythic (highest-value category: 5000+ coins)
  {
    id: 'reward-xmas-miracle-box',
    name: 'Шкатулка Рождественского чуда',
    category: 'christmas',
    rarity: 'mythic',
    icon: 'PackageCheck',
    value: 5000,
    priceCoins: 5500,
    pricePoints: 5500,
    description: 'Вершина рождественской магии! Исполняет самые заветные желания.',
    conditions: 'Главный приз новогоднего сезона или 5500 монет',
  },
];

// Combine all rewards
REWARDS_CATALOG.push(...CHRISTMAS_REWARDS);

// ==============================================================================
// DETERMINISTIC DATABASE UUID MAPPINGS (for Supabase PostgreSQL compatibility)
// ==============================================================================
// DETERMINISTIC DATABASE UUID MAPPINGS (for Supabase PostgreSQL compatibility)
// Exactly 49 canonical items (25 base rewards/titles + 15 xmas + 4 coins + 5 pro-epic)
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
  // Coin Rewards (Roulette)
  'reward-coins-25': '10000000-0000-0000-0000-000000000051',
  'reward-coins-50': '10000000-0000-0000-0000-000000000052',
  'reward-coins-75': '10000000-0000-0000-0000-000000000053',
  'reward-coins-125': '10000000-0000-0000-0000-000000000054',
  // 5 New PRO-EPIC Titles
  'title-phoenix': '10000000-0000-0000-0000-000000000061',
  'phoenix': '10000000-0000-0000-0000-000000000061',
  'title-phantom': '10000000-0000-0000-0000-000000000062',
  'phantom': '10000000-0000-0000-0000-000000000062',
  'title-dominator': '10000000-0000-0000-0000-000000000063',
  'dominator': '10000000-0000-0000-0000-000000000063',
  'title-titan': '10000000-0000-0000-0000-000000000064',
  'titan': '10000000-0000-0000-0000-000000000064',
  'title-overlord': '10000000-0000-0000-0000-000000000065',
  'overlord': '10000000-0000-0000-0000-000000000065',
  // Base Titles (both with and without 'title-' prefix)
  'title-sosun': '10000000-0000-0000-0000-000000000012',
  'sosun': '10000000-0000-0000-0000-000000000012',
  'title-vozduhan': '10000000-0000-0000-0000-000000000013',
  'vozduhan': '10000000-0000-0000-0000-000000000013',
  'title-korol': '10000000-0000-0000-0000-000000000014',
  'korol': '10000000-0000-0000-0000-000000000014',
  'title-koroleva': '10000000-0000-0000-0000-000000000015',
  'koroleva': '10000000-0000-0000-0000-000000000015',
  'title-cyborg': '10000000-0000-0000-0000-000000000016',
  'cyborg': '10000000-0000-0000-0000-000000000016',
  'title-vip': '10000000-0000-0000-0000-000000000017',
  'vip': '10000000-0000-0000-0000-000000000017',
  // 8 New Titles (both with and without 'title-' prefix)
  'title-terpilla': '10000000-0000-0000-0000-000000000071',
  'terpilla': '10000000-0000-0000-0000-000000000071',
  'title-podsos': '10000000-0000-0000-0000-000000000072',
  'podsos': '10000000-0000-0000-0000-000000000072',
  'title-santa': '10000000-0000-0000-0000-000000000073',
  'santa': '10000000-0000-0000-0000-000000000073',
  'title-femboy': '10000000-0000-0000-0000-000000000074',
  'femboy': '10000000-0000-0000-0000-000000000074',
  'title-nefor': '10000000-0000-0000-0000-000000000075',
  'nefor': '10000000-0000-0000-0000-000000000075',
  'title-balbibol': '10000000-0000-0000-0000-000000000076',
  'balbibol': '10000000-0000-0000-0000-000000000076',
  'title-imperator': '10000000-0000-0000-0000-000000000077',
  'imperator': '10000000-0000-0000-0000-000000000077',
  'title-demiurge': '10000000-0000-0000-0000-000000000078',
  'demiurge': '10000000-0000-0000-0000-000000000078',
};

// Aliases for historical / alternative slug identifiers
export const ITEM_SLUG_ALIASES = {
  'reward-rose-1': 'reward-rose-single',
  'gift-rose': 'reward-rose-single',
  'reward-rose-big-bouquet': 'reward-rose-large',
  'gift-box-miracle': 'reward-xmas-miracle-box',
};

export const UUID_TO_SLUG_MAP = Object.fromEntries(
  Object.entries(ITEM_UUID_MAP)
    .filter(([slug]) => slug.startsWith('reward-') || slug.startsWith('title-'))
    .map(([slug, uuid]) => [uuid, slug])
);

// Enrich TITLES_LIST with database parity properties
TITLES_LIST.forEach((t) => {
  t.category = 'titles';
  t.isTitle = true;
  t.is_title = true;
  t.is_active = true;
  t.uuid = ITEM_UUID_MAP[t.id] || ITEM_UUID_MAP[t.slug] || null;
  t.titleSlug = t.slug; // clean slug matching DB title_slug column ('terpilla')
  t.title_slug = t.slug;
  t.value = t.priceCoins || t.pricePoints || 0;
});

// Enrich REWARDS_CATALOG with uuid and titleSlug
REWARDS_CATALOG.forEach((r) => {
  r.uuid = ITEM_UUID_MAP[r.id] || null;
  r.titleSlug = r.id;
  r.is_active = true;
});

if (Array.isArray(CHRISTMAS_REWARDS)) {
  CHRISTMAS_REWARDS.forEach((c) => {
    c.uuid = ITEM_UUID_MAP[c.id] || null;
    c.titleSlug = c.id;
    c.is_active = true;
  });
}

// Register all TITLES into REWARDS_CATALOG so it completely mirrors public.rewards_catalog
TITLES_LIST.forEach((t) => {
  if (!REWARDS_CATALOG.some((r) => r.id === t.id)) {
    REWARDS_CATALOG.push(t);
  }
});

// REWARDS_CATALOG contains gifts, christmas rewards, and titles (identical to DB rewards_catalog)
export const ALL_REWARDS_AND_GIFTS = [...REWARDS_CATALOG];

/**
 * Returns database UUID for an item (from slug or existing UUID).
 */
export function toDbUuid(idOrSlug) {
  if (!idOrSlug) return null;
  const str = String(idOrSlug).trim();
  const canonicalSlug = ITEM_SLUG_ALIASES[str] || str;
  if (ITEM_UUID_MAP[canonicalSlug]) return ITEM_UUID_MAP[canonicalSlug];
  if (ITEM_UUID_MAP[str]) return ITEM_UUID_MAP[str];
  if (str.includes('-') && str.length === 36) {
    return str;
  }
  const stripped = str.replace(/^(title-|reward-|gift-)/, '');
  if (ITEM_UUID_MAP[stripped]) return ITEM_UUID_MAP[stripped];
  if (ITEM_UUID_MAP[`title-${stripped}`]) return ITEM_UUID_MAP[`title-${stripped}`];
  if (ITEM_UUID_MAP[`reward-${stripped}`]) return ITEM_UUID_MAP[`reward-${stripped}`];

  const match =
    TITLES_LIST.find(
      (t) =>
        t.id === canonicalSlug ||
        t.id === str ||
        t.slug === canonicalSlug ||
        t.slug === str ||
        t.uuid === str ||
        t.uuid === canonicalSlug ||
        (t.name && t.name.toLowerCase() === str.toLowerCase())
    ) ||
    ALL_REWARDS_AND_GIFTS.find(
      (r) =>
        r.id === canonicalSlug ||
        r.id === str ||
        r.titleSlug === canonicalSlug ||
        r.titleSlug === str ||
        r.uuid === canonicalSlug ||
        r.uuid === str ||
        (r.name && r.name.toLowerCase() === str.toLowerCase())
    );
  return match?.uuid || str;
}

/**
 * Returns semantic slug ID for an item (from database UUID or slug).
 */
export function toSlugId(uuidOrSlug) {
  if (!uuidOrSlug) return null;
  const str = String(uuidOrSlug).trim();
  if (UUID_TO_SLUG_MAP[str]) return UUID_TO_SLUG_MAP[str];
  const canonical = ITEM_SLUG_ALIASES[str] || str;
  if (UUID_TO_SLUG_MAP[canonical]) return UUID_TO_SLUG_MAP[canonical];

  const match =
    TITLES_LIST.find(
      (t) =>
        t.uuid === str ||
        t.id === canonical ||
        t.id === str ||
        t.slug === canonical ||
        t.slug === str ||
        (t.name && t.name.toLowerCase() === str.toLowerCase())
    ) ||
    ALL_REWARDS_AND_GIFTS.find(
      (r) =>
        r.uuid === str ||
        r.id === canonical ||
        r.id === str ||
        r.titleSlug === canonical ||
        r.titleSlug === str ||
        (r.name && r.name.toLowerCase() === str.toLowerCase())
    );
  return match?.id || canonical;
}

/**
 * Finds reward metadata by slug, UUID or name.
 */
export function resolveReward(query) {
  if (!query) return null;
  const str = String(query).trim();
  const canonical = ITEM_SLUG_ALIASES[str] || str;
  const targetUuid = ITEM_UUID_MAP[canonical] || ITEM_UUID_MAP[str] || (str.length === 36 ? str : null);
  const stripped = str.replace(/^(title-|reward-|gift-)/, '');

  return (
    ALL_REWARDS_AND_GIFTS.find(
      (r) =>
        r.id === canonical ||
        r.id === str ||
        r.id === `title-${stripped}` ||
        r.id === `reward-${stripped}` ||
        (targetUuid && r.uuid === targetUuid) ||
        r.uuid === str ||
        r.titleSlug === str ||
        r.titleSlug === canonical ||
        r.titleSlug === stripped ||
        r.slug === str ||
        r.slug === canonical ||
        r.slug === stripped ||
        (r.name && r.name.toLowerCase() === str.toLowerCase())
    ) ||
    TITLES_LIST.find(
      (t) =>
        t.id === canonical ||
        t.id === str ||
        t.id === `title-${stripped}` ||
        (targetUuid && t.uuid === targetUuid) ||
        t.uuid === str ||
        t.slug === str ||
        t.slug === canonical ||
        t.slug === stripped ||
        (t.name && t.name.toLowerCase() === str.toLowerCase())
    ) ||
    null
  );
}

/**
 * Finds title metadata by slug, UUID or name.
 */
export function resolveTitle(query) {
  if (!query) return null;
  const str = String(query).trim();
  const canonical = ITEM_SLUG_ALIASES[str] || str;
  const targetUuid = ITEM_UUID_MAP[canonical] || ITEM_UUID_MAP[str] || (str.length === 36 ? str : null);
  const stripped = str.replace(/^(title-|reward-|gift-)/, '');

  return (
    TITLES_LIST.find(
      (t) =>
        t.id === canonical ||
        t.id === str ||
        t.id === `title-${stripped}` ||
        (targetUuid && t.uuid === targetUuid) ||
        t.uuid === str ||
        t.slug === str ||
        t.slug === canonical ||
        t.slug === stripped ||
        t.titleSlug === str ||
        t.titleSlug === canonical ||
        t.titleSlug === stripped ||
        (t.name && t.name.toLowerCase() === str.toLowerCase())
    ) || null
  );
}

/**
 * Checks if an item can be purchased for Coins/Points in the Shop / Gifts catalog.
 * STRICTLY excludes UC VIP, category 'uc', and VIP title.
 */
export function isItemAvailableInShop(itemOrSlug) {
  if (!itemOrSlug) return false;
  const slug = typeof itemOrSlug === 'string' ? itemOrSlug : itemOrSlug.id || itemOrSlug.slug;
  if (!slug) return false;
  const lower = slug.toLowerCase();
  if (
    lower === 'reward-uc-30' ||
    lower === 'reward-uc-60' ||
    lower === 'title-vip' ||
    lower === 'vip' ||
    (lower.includes('uc') && lower.includes('vip'))
  ) {
    return false;
  }
  const item = resolveReward(slug) || resolveTitle(slug);
  if (!item) return false;
  if (item.excludedFromShop) return false;
  if (item.category === 'uc' || item.isVipExclusive) return false;
  return Boolean(item.priceCoins || item.pricePoints);
}

/**
 * Returns all gifts available for purchase in Shop & Gifts (excluding UC VIP).
 */
export function getShopGifts() {
  const seen = new Set();
  return ALL_REWARDS_AND_GIFTS.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return (
      !r.isTitle &&
      r.category !== 'titles' &&
      !r.excludedFromShop &&
      r.category !== 'uc' &&
      Boolean(r.priceCoins || r.pricePoints)
    );
  });
}

/**
 * Returns all titles available for purchase in Shop (excluding VIP title).
 */
export function getShopTitles() {
  return TITLES_LIST.filter(
    (t) => !t.excludedFromShop && !t.isVipExclusive && t.slug !== 'vip' && Boolean(t.priceCoins || t.pricePoints)
  );
}

/**
 * Returns all exclusive PRO-EPIC titles available for purchase in Shop.
 */
export function getProEpicTitles() {
  return TITLES_LIST.filter(
    (t) => t.rarity === 'pro-epic' && !t.excludedFromShop && !t.isVipExclusive && Boolean(t.priceCoins || t.pricePoints)
  );
}

/**
 * Returns all items (Gifts + Titles) available in the Shop.
 */
export function getShopItems() {
  return [
    ...getShopGifts().map((g) => ({ ...g, itemType: 'gift' })),
    ...getShopTitles().map((t) => ({ ...t, itemType: 'title' })),
  ];
}


