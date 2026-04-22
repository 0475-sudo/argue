"use server";

import { createClient } from "@/lib/supabase/server";

export type VoteResult = {
  error?: string;
};

export async function voteOnArgument(
  argumentId: string,
  value: 1 | -1
): Promise<VoteResult> {
  if (value !== 1 && value !== -1) {
    return { error: "不正な投票値です" };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "ログインが必要です" };
  }

  const { data: existing } = await supabase
    .from("votes")
    .select("id, value")
    .eq("argument_id", argumentId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existing) {
    const { error } = await supabase.from("votes").insert({
      argument_id: argumentId,
      user_id: user.id,
      value,
    });
    if (error) return { error: "投票に失敗しました: " + error.message };
    return {};
  }

  if (existing.value === value) {
    const { error } = await supabase
      .from("votes")
      .delete()
      .eq("id", existing.id);
    if (error) return { error: "投票の取り消しに失敗しました: " + error.message };
    return {};
  }

  const { error } = await supabase
    .from("votes")
    .update({ value })
    .eq("id", existing.id);
  if (error) return { error: "投票の更新に失敗しました: " + error.message };
  return {};
}
