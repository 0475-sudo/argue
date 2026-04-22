import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/ensure-profile";

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
    await ensureProfile(supabase, user);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
