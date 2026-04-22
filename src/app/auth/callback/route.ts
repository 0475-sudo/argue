import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=invalid_link`);
  }

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
    code
  );

  if (exchangeError) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(exchangeError.message)}`
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (!existing) {
      const metadata = user.user_metadata as
        | { username?: string; display_name?: string }
        | null;
      const baseUsername =
        metadata?.username?.trim() ||
        user.email?.split("@")[0] ||
        user.id.slice(0, 8);
      const displayName = metadata?.display_name?.trim() || baseUsername;

      const { error: insertError } = await supabase.from("profiles").insert({
        id: user.id,
        username: baseUsername,
        display_name: displayName,
      });

      if (insertError && insertError.code === "23505") {
        await supabase.from("profiles").insert({
          id: user.id,
          username: `${baseUsername}_${user.id.slice(0, 6)}`,
          display_name: displayName,
        });
      }
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
