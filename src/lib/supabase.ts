import { createClient } from "@supabase/supabase-js";

// Supabase access via the ANON/publishable key. Public reads go through the
// "Public read" RLS policies; once a user logs in the client attaches their JWT
// so auth.uid() gates the user-owned tables (profiles, user_follows). No
// privileged key ever ships to the browser — RLS is the gate.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigured = Boolean(url && anonKey);

export const supabase = supabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        // Persist + refresh the session so logins survive reloads, and parse the
        // token from the URL after email-confirmation / magic-link redirects.
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
