import type { SupabaseClient, User } from "@supabase/supabase-js";

/**
 * profiles 行が無ければ、サインアップ時に user_metadata に保存された
 * username を最優先で使って作成する。メール部分からの派生はフォールバック。
 * UNIQUE 制約に当たった場合は id 先頭 6 文字を付けてリトライ。
 */
export async function ensureProfile(
  supabase: SupabaseClient,
  user: User
): Promise<{ error?: string }> {
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (existing) return {};

  const metadata = user.user_metadata as { username?: string } | null;
  const baseUsername =
    metadata?.username?.trim() ||
    user.email?.split("@")[0] ||
    user.id.slice(0, 8);

  const { error } = await supabase.from("profiles").insert({
    id: user.id,
    username: baseUsername,
  });

  if (error && error.code === "23505") {
    const { error: retryError } = await supabase.from("profiles").insert({
      id: user.id,
      username: `${baseUsername}_${user.id.slice(0, 6)}`,
    });
    if (retryError) return { error: retryError.message };
  } else if (error) {
    return { error: error.message };
  }

  return {};
}
