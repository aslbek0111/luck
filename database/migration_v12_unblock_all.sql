-- LUCKY UC: Migration V12 - Unblock all users
UPDATE public.users SET is_blocked = FALSE, is_approved = TRUE;
