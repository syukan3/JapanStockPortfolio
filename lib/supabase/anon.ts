import { createClient } from "@supabase/supabase-js";

let anonClient: ReturnType<typeof createClient> | null = null;

/**
 * cookies 不使用の anon クライアント。
 * "use cache" ページ（/stocks/[code] 等）で使用。
 * 認証情報を持たず、全ユーザーで共有キャッシュが可能。
 */
export function getSupabaseAnon() {
  if (anonClient) return anonClient;

  anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  return anonClient;
}
