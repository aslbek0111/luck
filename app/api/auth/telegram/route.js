import { NextResponse } from 'next/server';
import { verifyTelegramInitData } from '@/lib/telegram-auth';
import { supabaseServer, isServerSupabaseConfigured } from '@/lib/supabaseServer';
import { setSessionCookie } from '@/lib/session';
import { mockStore } from '@/lib/mock-store';

export async function POST(request) {
  try {
    const body = await request.json();
    const { initData } = body;

    if (!initData) {
      return NextResponse.json({ success: false, error: 'initData отсутствует' }, { status: 400 });
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const verification = verifyTelegramInitData(initData, botToken);

    if (!verification.isValid) {
      return NextResponse.json({ success: false, error: verification.error || 'Неверная подпись initData' }, { status: 401 });
    }

    const tgUser = verification.user;
    if (!tgUser || !tgUser.id) {
      return NextResponse.json({ success: false, error: 'Пользователь не найден в initData' }, { status: 400 });
    }

    let userRecord = null;

    if (isServerSupabaseConfigured && supabaseServer) {
      // 1. Look up user by telegram_id in Supabase
      const { data: existingUser, error: fetchErr } = await supabaseServer
        .from('users')
        .select('*')
        .eq('telegram_id', tgUser.id)
        .maybeSingle();

      if (fetchErr) {
        console.error('Supabase fetch user error:', fetchErr);
      }

      if (existingUser) {
        // Update user profile info
        const { data: updated, error: updateErr } = await supabaseServer
          .from('users')
          .update({
            username: tgUser.username || existingUser.username,
            first_name: tgUser.first_name || existingUser.first_name,
            last_name: tgUser.last_name || existingUser.last_name,
            avatar_url: tgUser.photo_url || existingUser.avatar_url,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingUser.id)
          .select()
          .single();

        userRecord = updated || existingUser;
      } else {
        // Insert new user with initial 5 free spins
        const { data: newUser, error: insertErr } = await supabaseServer
          .from('users')
          .insert({
            telegram_id: tgUser.id,
            username: tgUser.username || `user_${tgUser.id}`,
            first_name: tgUser.first_name || 'Игрок',
            last_name: tgUser.last_name || '',
            avatar_url: tgUser.photo_url || '',
            free_spins_balance: 5,
            spins_count: 0,
            total_uc: 0,
            total_popularity: 0,
          })
          .select()
          .single();

        if (insertErr) {
          console.error('Supabase insert user error:', insertErr);
          return NextResponse.json({ success: false, error: 'Ошибка регистрации в базе данных' }, { status: 500 });
        }

        userRecord = newUser;

        // Give starter gift (e.g. 1 rose or bronze pacifier)
        const { data: starterReward } = await supabaseServer
          .from('rewards_catalog')
          .select('id')
          .eq('name', 'Одна роза')
          .maybeSingle();

        if (starterReward && userRecord) {
          await supabaseServer.from('user_inventory').insert({
            user_id: userRecord.id,
            reward_id: starterReward.id,
            quantity: 1,
          });
        }
      }
    } else {
      if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_DEV_STORE) {
        return NextResponse.json({ success: false, error: 'База данных Supabase не настроена на сервере' }, { status: 503 });
      }
      // Fallback in-memory/mock store
      const users = mockStore.getUsers();
      let found = users.find((u) => u.telegram_id === tgUser.id);
      if (!found) {
        found = {
          id: 'user-' + tgUser.id,
          telegram_id: tgUser.id,
          username: tgUser.username || `user_${tgUser.id}`,
          first_name: tgUser.first_name || 'Игрок',
          last_name: tgUser.last_name || '',
          avatar_url: tgUser.photo_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
          active_title_id: null,
          spins_count: 0,
          total_uc: 0,
          total_popularity: 0,
          free_spins_balance: 5,
          is_approved: true,
          is_blocked: false,
          is_admin: false,
        };
        users.push(found);
        mockStore.saveUsers(users);
      }
      userRecord = found;
    }

    if (userRecord.is_blocked) {
      return NextResponse.json({ success: false, error: 'Ваш аккаунт заблокирован администратором' }, { status: 403 });
    }

    // Set signed session cookie
    const sessionPayload = {
      userId: userRecord.id,
      telegramId: userRecord.telegram_id,
      username: userRecord.username,
      isAdmin: Boolean(userRecord.is_admin),
    };

    const token = await setSessionCookie(sessionPayload);

    // Sanitize user object before responding (strip sensitive credentials)
    const sanitizedUser = { ...userRecord };
    delete sanitizedUser.browser_pin;
    delete sanitizedUser.auth_token;

    return NextResponse.json({
      success: true,
      user: sanitizedUser,
      token,
      isTelegram: true,
    });
  } catch (err) {
    console.error('API /auth/telegram error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
