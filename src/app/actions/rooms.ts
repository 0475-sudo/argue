"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { fetchOgTitle } from "@/lib/og";
import { normalizeUrl } from "@/lib/normalize-url";

export type CreateRoomState = {
  error?: string;
};

export async function createRoom(
  _prev: CreateRoomState,
  formData: FormData
): Promise<CreateRoomState> {
  const supabase = await createClient();

  // --- 入力値の取得 ---
  const sourceUrl = (formData.get("sourceUrl") as string)?.trim();
  const stance = formData.get("stance") as string;
  const content = (formData.get("content") as string)?.trim();
  const evidenceUrl = (formData.get("evidenceUrl") as string)?.trim();

  // --- バリデーション ---
  if (!sourceUrl || !isValidUrl(sourceUrl)) {
    return { error: "有効なSNS投稿URLを入力してください" };
  }

  if (!stance || (stance !== "for" && stance !== "against")) {
    return { error: "スタンス（同じです/ほかにもあります）を選択してください" };
  }

  if (!content) {
    return { error: "意見の内容を入力してください" };
  }

  if (!evidenceUrl || !isValidUrl(evidenceUrl)) {
    return { error: "有効な証拠URLを入力してください" };
  }

  // --- 認証確認 ---
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "ルームを作成するにはログインが必要です" };
  }

  // --- profileが未作成なら自動作成 ---
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .single();

  if (!existingProfile) {
    const { error: profileError } = await supabase.from("profiles").insert({
      id: user.id,
      username: user.email?.split("@")[0] ?? user.id.slice(0, 8),
      display_name: user.email?.split("@")[0] ?? "ユーザー",
    });
    if (profileError) {
      return { error: "プロフィールの作成に失敗しました: " + profileError.message };
    }
  }

  const normalizedUrl = normalizeUrl(sourceUrl);

  // --- 既存ルーム重複チェック ---
  const { data: existingRoom } = await supabase
    .from("rooms")
    .select("id")
    .eq("source_url_normalized", normalizedUrl)
    .maybeSingle();

  if (existingRoom) {
    // 証拠URLのOGPタイトルだけ取得して、既存ルームに意見を追加
    const evidenceTitle = await fetchOgTitle(evidenceUrl);
    const { error: argError } = await supabase.from("arguments").insert({
      room_id: existingRoom.id,
      user_id: user.id,
      stance,
      content,
      evidence_url: evidenceUrl,
      evidence_title: evidenceTitle,
    });

    if (argError) {
      return { error: "意見の投稿に失敗しました: " + argError.message };
    }

    redirect(`/room/${existingRoom.id}?merged=1`);
  }

  // --- OGPタイトル取得（ルームURL + 証拠URLを並列で） ---
  const [ogTitle, evidenceTitle] = await Promise.all([
    fetchOgTitle(sourceUrl),
    fetchOgTitle(evidenceUrl),
  ]);
  const title = ogTitle || sourceUrl;

  // --- ルーム作成 ---
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .insert({
      title,
      source_url: sourceUrl,
      source_url_normalized: normalizedUrl,
      category: "other",
      time_limit: 0,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (roomError) {
    return { error: "ルームの作成に失敗しました: " + roomError.message };
  }

  // --- 最初の意見を投稿 ---
  const { error: argError } = await supabase.from("arguments").insert({
    room_id: room.id,
    user_id: user.id,
    stance,
    content,
    evidence_url: evidenceUrl,
    evidence_title: evidenceTitle,
  });

  if (argError) {
    return { error: "意見の投稿に失敗しました: " + argError.message };
  }

  redirect(`/room/${room.id}`);
}

function isValidUrl(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}
