import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { supabaseServer, isServerSupabaseConfigured } from '@/lib/supabaseServer';
import { setSessionCookie } from '@/lib/session';
import { mockStore, STANDARD_ACCOUNTS, VIP_ACCOUNTS, ADMIN_ACCOUNTS } from '@/lib/mock-store';
import { toDbUuid } from '@/lib/catalog-data';

// Optional environment-configured admin credentials
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

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

  if (record.count >= 8) {
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
    const { username, password, recoveryKey, action = 'login' } = body;

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

    const enteredPassword = (password || recoveryKey || '').trim();
    if (!enteredPassword) {
      return NextResponse.json({ success: false, error: 'Укажите пароль' }, { status: 400 });
    }

    const rateLimitKey = getRateLimitKey(cleanUsername, request);
    const rateLimitCheck = checkRateLimit(rateLimitKey);
    if (!rateLimitCheck.allowed) {
      return NextResponse.json({ success: false, error: rateLimitCheck.error }, { status: 429 });
    }

    let userRecord = null;

    if (isServerSupabaseConfigured && supabaseServer) {
      const { data: existingUser } = await supabaseServer
        .from('users')
        .select('*')
        .ilike('username', cleanUsername)
        .maybeSingle();

      userRecord = existingUser;
    } else {
      userRecord = mockStore.getUserByUsername(cleanUsername);
    }

    // If user does not exist in store
    if (!userRecord) {
      if (action === 'register') {
        if (enteredPassword.length < 3) {
          return NextResponse.json(
            { success: false, error: 'Пароль должен содержать минимум 3 символа' },
            { status: 400 }
          );
        }
        const passwordHash = await bcrypt.hash(enteredPassword, 10);
        const fakeTgId = 1000000000 + Math.floor(Math.random() * 899999999);
        const isAdminAccount = ADMIN_ACCOUNTS.some((a) => a.toLowerCase() === cleanUsername);
        const isVipAccount = VIP_ACCOUNTS.some((v) => v.toLowerCase() === cleanUsername);

        // Strict capacity limit: 100 standard accounts
        if (!isAdminAccount && !isVipAccount) {
          if (isServerSupabaseConfigured && supabaseServer) {
            const { count, error: countErr } = await supabaseServer
              .from('users')
              .select('*', { count: 'exact', head: true })
              .eq('is_vip', false);
            if (!countErr && typeof count === 'number' && count >= 100) {
              return NextResponse.json(
                { success: false, error: 'Достигнут лимит стандартных слотов игроков (100 из 100). Регистрация новых стандартных аккаунтов завершена.' },
                { status: 400 }
              );
            }
          } else {
            const currentUsers = mockStore.getAllUsers();
            const standardCount = currentUsers.filter((u) => !u.is_vip).length;
            if (standardCount >= 100) {
              return NextResponse.json(
                { success: false, error: 'Достигнут лимит стандартных слотов игроков (100 из 100). Регистрация новых стандартных аккаунтов завершена.' },
                { status: 400 }
              );
            }
          }
        }

        if (isServerSupabaseConfigured && supabaseServer) {

          const { data: newUser, error: insertErr } = await supabaseServer
            .from('users')
            .insert({
              telegram_id: fakeTgId,
              username: cleanUsername,
              first_name: cleanUsername.charAt(0).toUpperCase() + cleanUsername.slice(1),
              avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
              password_hash: passwordHash,
              recovery_key_hash: passwordHash,
              free_spins_balance: (isAdminAccount || isVipAccount) ? 999999 : 2,
              spins_count: 0,
              total_uc: (isAdminAccount || isVipAccount) ? 5000 : 0,
              total_popularity: 0,
              popularity_updated_at: new Date().toISOString(),
              last_daily_spins_at: new Date().toISOString(),
              is_approved: true,
              is_blocked: false,
              is_admin: isAdminAccount || isVipAccount,
              is_vip: isVipAccount,
              profile_frame: isAdminAccount ? 'admin_shield' : (isVipAccount ? 'vip_gold' : 'default'),
              vip_badge: isVipAccount ? 'VIP_ADMIN' : null,
              coins_balance: isAdminAccount ? 999999 : (isVipAccount ? 1000 : 0),
              points_balance: isAdminAccount ? 999999 : (isVipAccount ? 1000 : 0),
            })
            .select()
            .single();

          if (insertErr) {
            return NextResponse.json(
              { success: false, error: 'Ошибка создания аккаунта: ' + insertErr.message },
              { status: 500 }
            );
          }
          userRecord = newUser;
        } else {
          const isAdminAccount = ADMIN_ACCOUNTS.some((a) => a.toLowerCase() === cleanUsername);
          const isVipAccount = VIP_ACCOUNTS.some((v) => v.toLowerCase() === cleanUsername);

          const newUser = {
            id: 'user-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
            telegram_id: fakeTgId,
            username: cleanUsername,
            first_name: cleanUsername.charAt(0).toUpperCase() + cleanUsername.slice(1),
            avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
            active_title_id: isVipAccount ? 'title-vip' : null,
            password_hash: passwordHash,
            recovery_key_hash: passwordHash,
            spins_count: 0,
            total_uc: (isAdminAccount || isVipAccount) ? 5000 : 0,
            total_popularity: 0,
            popularity_updated_at: new Date().toISOString(),
            free_spins_balance: (isAdminAccount || isVipAccount) ? 999999 : 2,
            last_daily_spins_at: new Date().toISOString(),
            is_approved: true,
            is_blocked: false,
            is_admin: isAdminAccount || isVipAccount,
            is_vip: isVipAccount,
            profile_frame: isAdminAccount ? 'admin_shield' : (isVipAccount ? 'vip_gold' : 'default'),
            vip_badge: isVipAccount ? 'VIP_ADMIN' : null,
            coins_balance: isAdminAccount ? 999999 : (isVipAccount ? 1000 : 0),
            points_balance: isAdminAccount ? 999999 : (isVipAccount ? 1000 : 0),
            created_at: new Date().toISOString(),
          };

          mockStore.addUser(newUser);
          mockStore.addItemToInventory(newUser.id, 'reward-xmas-sticker', 1);
          userRecord = newUser;
        }
      } else {
        recordFailedAttempt(rateLimitKey);
        return NextResponse.json(
          { success: false, error: `Игрок @${cleanUsername} не найден. Проверьте правильность никнейма.` },
          { status: 404 }
        );
      }
    }

    if (userRecord.is_blocked) {
      return NextResponse.json({ success: false, error: 'Ваш аккаунт заблокирован администратором' }, { status: 403 });
    }

    // Check if account already has a password set
    const existingHash = userRecord.password_hash || userRecord.recovery_key_hash;

    if (!existingHash) {
      // FIRST LOGIN: Set password and authenticate immediately!
      // (Правило 1: При первом входе пользователь вводит свой Nickname и Password)
      if (enteredPassword.length < 3) {
        return NextResponse.json(
          { success: false, error: 'Пароль должен содержать минимум 3 символа' },
          { status: 400 }
        );
      }

      const passwordHash = await bcrypt.hash(enteredPassword, 10);
      userRecord.password_hash = passwordHash;
      userRecord.recovery_key_hash = passwordHash;

      if (isServerSupabaseConfigured && supabaseServer) {
        await supabaseServer
          .from('users')
          .update({
            password_hash: passwordHash,
            recovery_key_hash: passwordHash,
          })
          .eq('id', userRecord.id);
      } else {
        mockStore.updateUser(userRecord.id, {
          password_hash: passwordHash,
          recovery_key_hash: passwordHash,
        });

        // Mark registration code record as used if matching
        const foundCode = mockStore.serverRegistrationCodes?.find(
          (c) => c.code.toLowerCase() === cleanUsername
        );
        if (foundCode) {
          foundCode.isUsed = true;
          foundCode.usedByUserId = userRecord.id;
          foundCode.usedAt = new Date().toISOString();
        }
        mockStore.saveToFile();
      }

      clearRateLimit(rateLimitKey);
    } else {
      // REPEAT LOGIN: Verify password
      // (Правило 2: При повторном входе пользователь снова вводит только Nickname и Password)
      let isKeyValid = false;
      try {
        isKeyValid = await bcrypt.compare(enteredPassword, existingHash);
      } catch {}

      if (!isKeyValid && existingHash === enteredPassword) {
        isKeyValid = true;
      }

      // Check optional env-configured admin credentials fallback if user is admin
      if (!isKeyValid && userRecord.is_admin) {
        if (ADMIN_PASSWORD && enteredPassword === ADMIN_PASSWORD) {
          isKeyValid = true;
        } else if (ADMIN_PASSWORD_HASH) {
          try {
            isKeyValid = await bcrypt.compare(enteredPassword, ADMIN_PASSWORD_HASH);
          } catch {}
        }
      }

      if (!isKeyValid) {
        recordFailedAttempt(rateLimitKey);
        return NextResponse.json({ success: false, error: 'Неверный пароль' }, { status: 401 });
      }

      clearRateLimit(rateLimitKey);
    }

    if (!isServerSupabaseConfigured) {
      mockStore.setCurrentUserId(userRecord.id);
    }

    const sanitizedUser = { ...userRecord };
    delete sanitizedUser.password_hash;
    delete sanitizedUser.recovery_key_hash;
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
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

    await setSessionCookie(sessionPayload, response);

    return response;
  } catch (err) {
    console.error('API /auth/browser error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
