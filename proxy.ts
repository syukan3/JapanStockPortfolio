import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 静的リソースはスキップ
  if (
    pathname.startsWith("/_next/static") ||
    pathname.startsWith("/_next/image") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // 認証不要パス（完全一致）
  const publicExactPaths = new Set([
    "/login",
    "/signup",
    "/reset-password",
    "/auth/callback",
    "/",
  ]);
  const isPublicPath =
    publicExactPaths.has(pathname) || pathname.startsWith("/stocks/");

  // 公開ページは認証チェック不要
  if (isPublicPath) {
    // login/signupはセッションリフレッシュして認証済みならリダイレクト
    if (pathname === "/login" || pathname === "/signup") {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard";
        return NextResponse.redirect(url);
      }
    }
    return supabaseResponse;
  }

  // 保護ページ: セッション自動リフレッシュ + 認証チェック
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
