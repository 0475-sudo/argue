"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { fetchOgTitle } from "@/lib/og";

export type PostArgumentState = {
  error?: string;
  moderationFeedback?: {
    reason: string;
    suggestion: string;
    scores: { emotional_attack: number; logical_structure: number };
  };
  success?: boolean;
};

export async function postArgument(
  _prev: PostArgumentState,
  formData: FormData
): Promise<PostArgumentState> {
  const supabase = await createClient();

  const roomId = formData.get("roomId") as string;
  const roomTitle = formData.get("roomTitle") as string;
  const stance = formData.get("stance") as string;
  const content = formData.get("content") as string;
  const evidenceUrl = formData.get("evidenceUrl") as string;
  const evidenceDescription = formData.get("evidenceDescription") as string;
  const parentIdRaw = (formData.get("parentId") as string | null)?.trim();

  if (!roomId || !stance || !content?.trim() || !evidenceUrl?.trim()) {
    return { error: "すべての必須フィールドを入力してください" };
  }

  if (stance !== "for" && stance !== "against") {
    return { error: "立場を選択してください" };
  }

  try {
    new URL(evidenceUrl);
  } catch {
    return { error: "根拠URLに有効なURLを入力してください" };
  }

  // AI Moderation
  const moderationRes = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL ? "" : ""}${getBaseUrl()}/api/moderate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, evidenceUrl, stance, roomTitle }),
    }
  );

  if (moderationRes.ok) {
    const moderation = await moderationRes.json();

    if (!moderation.approved) {
      // Log the rejection
      await supabase.from("ai_moderations").insert({
        room_id: roomId,
        type: "rejection",
        content: moderation.reason || "基準を満たしませんでした",
        suggestion: moderation.suggestion || null,
      });

      return {
        moderationFeedback: {
          reason: moderation.reason || "投稿が基準を満たしませんでした",
          suggestion:
            moderation.suggestion ||
            "より論理的で建設的な表現に修正してください",
          scores: moderation.scores,
        },
      };
    }
  }
  // If moderation fails (API key not set, etc.), allow the post through

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 証拠URLのOGPタイトルを取得
  const evidenceTitle = await fetchOgTitle(evidenceUrl.trim());

  // 踏まえる発言 (parentId) が指定された場合、同じルーム内の存在チェック。
  // 不正な値は黙って null に落として投稿を止めない。
  let parentId: string | null = null;
  if (parentIdRaw) {
    const { data: parent } = await supabase
      .from("arguments")
      .select("id")
      .eq("id", parentIdRaw)
      .eq("room_id", roomId)
      .maybeSingle();
    if (parent) parentId = parentIdRaw;
  }

  const { error } = await supabase.from("arguments").insert({
    room_id: roomId,
    user_id: user?.id ?? null,
    stance,
    content: content.trim(),
    evidence_url: evidenceUrl.trim(),
    evidence_title: evidenceTitle,
    evidence_description: evidenceDescription?.trim() || null,
    parent_id: parentId,
  });

  if (error) {
    return { error: "投稿に失敗しました: " + error.message };
  }

  revalidatePath(`/room/${roomId}`);
  return { success: true };
}

function getBaseUrl(): string {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT || 3000}`;
}
