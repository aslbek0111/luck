import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { supabaseServer, isServerSupabaseConfigured } from '@/lib/supabaseServer';
import { setSessionCookie } from '@/lib/session';
import { mockStore } from '@/lib/mock-store';
import { toDbUuid } from '@/lib/catalog-data';

// In-memory rate limiting tracker for brute-force protection
const rateLimitMap = new Map();

function getRateLimitKey(username, request) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1';
  return `${username.toLowerCase()}:${ip}`;
}

function checkRateLimit(key) {
  const record = rateLimitMap.get(key);
  if (!record) return { allowed: true };

  const now = Date.now();
  if (record.blockedUntil && record.blockedUntil > now) {
    const remainingMinutes = Math.ceil((record.blockedUntil - now) / 60000);
    return {
      allowed: false,
      error: `Слишком много попыток входа. Вход заблокирован на ${remainingMinutes} мин.`,
    };
  }

  if (now - record.lastAttempt > 15 * 60 * 1000) {
    rateLimitMap.delete(key);
    return { allowed: true };
  }

  return { allowed: true };
}

function recordFailedAttempt(key) {
  const now = Date.now();
  const record = rateLimitMap.get(key) || { count: 0, lastAttempt: now, blockedUntil: 0 };
  record.count += 1;
  record.lastAttempt = now;

  if (record.count >= 5) {
    record.blockedUntil = now + 15 * 60 * 1000;
  }
  rateLimitMap.set(key, record);
}

function clearRateLimit(key) {
  rateLimitMap.delete(key);
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { username, password, confirmPassword, code, action = 'login' } = body;

    if (!username || !username.trim()) {
      return NextResponse.json({ success: false, error: 'Укажите никнейм игрока' }, { status: 400 });
    }

    const cleanUsername = username.replace(/^@/, '').trim().toLowerCase();

    // Username format validation
    if (!/^[a-zA-Z0-9_]{3,32}$/.test(cleanUsername)) {
      return NextResponse.json(
        { success: false, error: 'Никнейм должен быть от 3 до 32 символов (только буквы, цифры и _)' },
        { status: 400 }
      );
    }

    if (!password || typeof password !== 'string') {
      return NextResponse.json({ success: false, error: 'Введите пароль' }, { status: 400 });
    }

    if (password.length < 4 || password.length > 128) {
      return NextResponse.json(
        { success: false, error: 'Пароль должен содержать от 4 до 128 символов' },
        { status: 400 }
      );
    }

    const rateLimitKey = getRateLimitKey(cleanUsername, request);
    let userRecord = null;

    if (action === 'register') {
      // 1. Password confirmation check
      if (confirmPassword !== undefined && password !== confirmPassword) {
        return NextResponse.json({ success: false, error: 'Пароли не совпадают' }, { status: 400 });
      }

      // 2. Strict Registration Code check
      if (!code || !code.trim()) {
        return NextResponse.json(
          { success: false, error: 'Введите один из 12 выданных кодов регистрации' },
          { status: 400 }
        );
      }

      const cleanCode = code.trim();
      const passwordHash = await bcrypt.hash(password, 10);
      const fakeTgId = 1000000000 + Math.floor(Math.random() * 899999999);

      if (isServerSupabaseConfigured && supabaseServer) {
        // 1. Try atomic RPC first
        const { data: rpcData, error: rpcErr } = await supabaseServer.rpc('register_player_with_code_atomic', {
          p_username: cleanUsername,
          p_password_hash: passwordHash,
          p_code: cleanCode,
          p_first_name: cleanUsername.charAt(0).toUpperCase() + cleanUsername.slice(1),
        });

        if (!rpcErr && rpcData) {
          if (!rpcData.success) {
            return NextResponse.json({ success: false, error: rpcData.error }, { status: 400 });
          }
          userRecord = rpcData.user;
        } else {
          // Fallback direct server queries if RPC is not yet created
          const { data: existingUser } = await supabaseServer
            .from('users')
            .select('id, username')
            .ilike('username', cleanUsername)
            .maybeSingle();

          if (existingUser) {
            return NextResponse.json(
              { success: false, error: 'Пользователь с таким никнеймом уже зарегистрирован' },
              { status: 400 }
            );
          }

          // Validate code in registration_codes table
          const { data: codeData, error: codeErr } = await supabaseServer
            .from('registration_codes')
            .select('*')
            .ilike('code', cleanCode)
            .maybeSingle();

          if (codeErr || !codeData) {
            return NextResponse.json(
              { success: false, error: 'Неверный код регистрации. Проверьте код и повторите ввод.' },
              { status: 400 }
            );
          }

          if (codeData.is_used) {
            return NextResponse.json(
              { success: false, error: 'Этот код регистрации уже был использован другим игроком.' },
              { status: 400 }
            );
          }

          // Validate max 12 non-admin players cap
          const { count: nonAdminCount } = await supabaseServer
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('is_admin', false);

          if ((nonAdminCount || 0) >= 12) {
            return NextResponse.json(
              { success: false, error: 'Регистрация закрыта: все 12 игровых мест заняты.' },
              { status: 400 }
            );
          }

          const isVip = codeData.type === 'vip';
          const initialUc = isVip ? 5000 : 0;

          // Insert new player
          const { data: newUser, error: insertErr } = await supabaseServer
            .from('users')
            .insert({
              telegram_id: fakeTgId,
              username: cleanUsername,
              first_name: cleanUsername.charAt(0).toUpperCase() + cleanUsername.slice(1),
              avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
              password_hash: passwordHash,
              free_spins_balance: 0, // Spins managed by admin
              spins_count: 0,
              total_uc: initialUc,
              total_popularity: 0,
              is_approved: true,
              is_blocked: false,
              is_admin: false,
              is_vip: isVip,
              profile_frame: isVip ? 'vip_gold' : 'default',
            })
            .select()
            .single();

          if (insertErr) {
            return NextResponse.json(
              { success: false, error: 'Ошибка создания аккаунта: ' + insertErr.message },
              { status: 500 }
            );
          }

          // Mark registration code as used
          await supabaseServer
            .from('registration_codes')
            .update({
              is_used: true,
              used_by_user_id: newUser.id,
              used_at: new Date().toISOString(),
            })
            .eq('code', codeData.code);

          // Add starter item with proper DB UUID
          const starterUuid = toDbUuid('reward-xmas-sticker');
          if (starterUuid) {
            await supabaseServer.from('user_inventory').insert({
              user_id: newUser.id,
              reward_id: starterUuid,
              quantity: 1,
            });
          }

          // Add welcome notification
          try {
            await supabaseServer.from('notifications').insert({
              user_id: newUser.id,
              type: 'system',
              title: 'Добро пожаловать в Lucky UC! 🎄',
              message: isVip
                ? 'Вам начислен VIP-статус и стартовый баланс 5000 UC! Счастливого Нового года!'
                : 'Вы успешно зарегистрированы в новогодней платформе Lucky UC! Ожидайте начисления спинов от Администратора.',
            });
          } catch {
            // Non-critical
          }

          userRecord = newUser;
        }
      } else {
        if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_DEV_STORE) {
          return NextResponse.json(
            { success: false, error: 'База данных Supabase не настроена на сервере' },
            { status: 503 }
          );
        }

        // Uniqueness check in mockStore
        const existing = mockStore.getUserByUsername(cleanUsername);
        if (existing) {
          return NextResponse.json(
            { success: false, error: 'Пользователь с таким никнеймом уже зарегистрирован' },
            { status: 400 }
          );
        }

        // Validate code in mockStore
        const codeResult = mockStore.validateAndUseCode(cleanCode, 'temp');
        if (!codeResult.valid) {
          return NextResponse.json({ success: false, error: codeResult.error }, { status: 400 });
        }

        const isVip = codeResult.type === 'vip';
        const initialUc = isVip ? 5000 : 0;

        const newUser = {
          id: 'user-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
          telegram_id: fakeTgId,
          username: cleanUsername,
          first_name: cleanUsername.charAt(0).toUpperCase() + cleanUsername.slice(1),
          avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
          active_title_id: null,
          password_hash: passwordHash,
          spins_count: 0,
          total_uc: initialUc,
          total_popularity: 0,
          free_spins_balance: 0, // Spins managed by admin
          is_approved: true,
          is_blocked: false,
          is_admin: false,
          is_vip: isVip,
          profile_frame: isVip ? 'vip_gold' : 'default',
          created_at: new Date().toISOString(),
        };

        mockStore.addUser(newUser);

        // Assign user id to code record
        const foundCode = mockStore.serverRegistrationCodes.find(
          (c) => c.code.toLowerCase() === cleanCode.toLowerCase()
        );
        if (foundCode) {
          foundCode.usedByUserId = newUser.id;
        }

        // Add starter Christmas sticker
        mockStore.addItemToInventory(newUser.id, 'reward-xmas-sticker', 1);

        // Add welcome notification
        mockStore.addNotification({
          userId: newUser.id,
          type: 'system',
          title: 'Добро пожаловать в Lucky UC! 🎄',
          message: isVip
            ? 'Вам начислен VIP-статус и стартовый баланс 5000 UC! Счастливого Нового года!'
            : 'Вы успешно зарегистрированы в новогодней платформе Lucky UC! Ожидайте начисления спинов от Администратора.',
        });

        userRecord = newUser;
      }

      clearRateLimit(rateLimitKey);
    } else {
      // Login action
      const rateLimitCheck = checkRateLimit(rateLimitKey);
      if (!rateLimitCheck.allowed) {
        return NextResponse.json({ success: false, error: rateLimitCheck.error }, { status: 429 });
      }

      // Check special admin alias: 'admin' maps to 'lucky_admin' if user typed 'admin'
      const lookupUsername = cleanUsername === 'admin' ? 'lucky_admin' : cleanUsername;

      if (isServerSupabaseConfigured && supabaseServer) {
        const { data: existingUser } = await supabaseServer
          .from('users')
          .select('*')
          .ilike('username', lookupUsername)
          .maybeSingle();

        if (!existingUser) {
          recordFailedAttempt(rateLimitKey);
          return NextResponse.json(
            { success: false, error: `Игрок @${cleanUsername} не найден. Зарегистрируйтесь!` },
            { status: 404 }
          );
        }
        userRecord = existingUser;
      } else {
        if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_DEV_STORE) {
          return NextResponse.json(
            { success: false, error: 'База данных Supabase не настроена на сервере' },
            { status: 503 }
          );
        }

        const found = mockStore.getUserByUsername(lookupUsername);
        if (!found) {
          recordFailedAttempt(rateLimitKey);
          return NextResponse.json(
            { success: false, error: `Игрок @${cleanUsername} не найден. Зарегистрируйтесь!` },
            { status: 404 }
          );
        }
        userRecord = found;
      }

      if (userRecord.is_blocked) {
        return NextResponse.json({ success: false, error: 'Ваш аккаунт заблокирован администратором' }, { status: 403 });
      }

      // Verify password
      let isPasswordValid = false;

      // Special secure check for Administrator with environment variables
      if (userRecord.is_admin) {
        if (process.env.ADMIN_PASSWORD_HASH) {
          isPasswordValid = await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH);
        } else if (process.env.ADMIN_PASSWORD) {
          isPasswordValid = password === process.env.ADMIN_PASSWORD;
        } else if (userRecord.password_hash) {
          isPasswordValid = await bcrypt.compare(password, userRecord.password_hash);
        }
      } else {
        if (userRecord.password_hash) {
          isPasswordValid = await bcrypt.compare(password, userRecord.password_hash);
        }
      }

      if (!isPasswordValid) {
        recordFailedAttempt(rateLimitKey);
        return NextResponse.json({ success: false, error: 'Неверный пароль' }, { status: 401 });
      }

      clearRateLimit(rateLimitKey);
    }

    if (!userRecord) {
      return NextResponse.json({ success: false, error: 'Не удалось получить данные пользователя' }, { status: 500 });
    }

    if (!isServerSupabaseConfigured) {
      mockStore.setCurrentUserId(userRecord.id);
    }

    const sanitizedUser = { ...userRecord };
    delete sanitizedUser.password_hash;
    delete sanitizedUser.browser_pin;
    delete sanitizedUser.auth_token;

    const sessionPayload = {
      userId: userRecord.id,
      telegramId: userRecord.telegram_id,
      username: userRecord.username,
      isAdmin: Boolean(userRecord.is_admin),
      isVip: Boolean(userRecord.is_vip),
    };

    const response = NextResponse.json({
      success: true,
      user: sanitizedUser,
      greeting: `Добро пожаловать, ${userRecord.username}! 🎄`,
      isTelegram: false,
    });

    await setSessionCookie(sessionPayload, response);

    return response;
  } catch (err) {
    console.error('API /auth/browser error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
