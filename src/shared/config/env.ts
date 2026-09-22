const value = (key: "VITE_SUPABASE_URL" | "VITE_SUPABASE_ANON_KEY") =>
  import.meta.env[key]?.trim() ?? "";

export const env = {
  supabaseUrl: value("VITE_SUPABASE_URL"),
  supabaseAnonKey: value("VITE_SUPABASE_ANON_KEY")
} as const;

export const hasSupabaseConfig =
  env.supabaseUrl.startsWith("https://") && env.supabaseAnonKey.length > 20;
