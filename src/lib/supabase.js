import { createClient } from "@supabase/supabase-js";
import { parseJsonResponse } from "./response.js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const supabaseClient = supabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
    },
  })
  : null;

export async function getAuthSettings() {
  if (!supabaseConfigured) return { google: false };
  const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
    headers: { apikey: supabaseAnonKey },
  });
  if (!response.ok) {
    throw new Error(`Could not check Supabase authentication settings (${response.status}).`);
  }
  const settings = await parseJsonResponse(response, "Checking authentication settings");
  return { google: settings.external?.google === true };
}
