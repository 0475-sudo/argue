import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchEvidenceText } from "@/lib/og";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

type AnalysisType = "topic_analysis" | "summary" | "fact_check";

export async function POST(request: NextRequest) {
  if (!ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY is not configured" },
      { status: 500 }
    );
  }

  const body = await request.json();
  const { roomId, type, argumentId } = body as {
    roomId: string;
    type: AnalysisType;
    argumentId?: string;
  };

  if (!roomId || !type) {
    return Response.json(
      { error: "roomId and type are required" },
      { status: 400 }
    );
  }

  if (
    type !== "topic_analysis" &&
    type !== "summary" &&
    type !== "fact_check"
  ) {
    return Response.json({ error: "invalid type" }, { status: 400 });
  }

  const supabase = await createClient();

  if (type === "fact_check") {
    if (!argumentId) {
      return Response.json(
        { error: "argumentId is required for fact_check" },
        { status: 400 }
      );
    }
    return handleFactCheck(supabase, roomId, argumentId);
  }

  return handleRoomAnalysis(supabase, roomId, type);
}

// --- ルーム全体の分析（論点整理 / 議論サマリー） ---

async function handleRoomAnalysis(
  supabase: Awaited<ReturnType<typeof createClient>>,
  roomId: string,
  type: "topic_analysis" | "summary"
) {
  const { data: room } = await supabase
    .from("rooms")
    .select("title, source_url")
    .eq("id", roomId)
    .single();

  if (!room) {
    return Response.json({ error: "Room not found" }, { status: 404 });
  }

  const { data: args } = await supabase
    .from("arguments")
    .select("stance, content, evidence_url, evidence_title, profiles(username)")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true });

  if (!args || args.length === 0) {
    return Response.json({ error: "No arguments to analyze" }, { status: 400 });
  }

  const formattedArgs = args
    .map((a, i) => {
      const user =
        (a.profiles as unknown as { username: string } | null)?.username ??
        "匿名";
      const stance = a.stance === "for" ? "同じです" : "ほかにもあります";
      const evidence = a.evidence_title || a.evidence_url;
      return `${i + 1}. [${stance}] ${user}: ${a.content}\n   根拠: ${evidence}`;
    })
    .join("\n\n");

  const forCount = args.filter((a) => a.stance === "for").length;
  const againstCount = args.filter((a) => a.stance === "against").length;

  const systemPrompt = buildAnalysisSystemPrompt(type);
  const userMessage = buildAnalysisUserMessage(
    type,
    room.title,
    room.source_url,
    formattedArgs,
    forCount,
    againstCount
  );

  const aiText = await callClaude(systemPrompt, userMessage, 2048);
  if ("error" in aiText) {
    return Response.json({ error: aiText.error }, { status: aiText.status });
  }

  const { data: moderation, error: insertError } = await supabase
    .from("ai_moderations")
    .insert({
      room_id: roomId,
      type,
      content: aiText.text,
    })
    .select("id, type, content, triggered_by, created_at")
    .single();

  if (insertError) {
    return Response.json(
      { error: "Failed to save analysis: " + insertError.message },
      { status: 500 }
    );
  }

  return Response.json(moderation);
}

// --- 個別投稿のファクトチェック ---

async function handleFactCheck(
  supabase: Awaited<ReturnType<typeof createClient>>,
  roomId: string,
  argumentId: string
) {
  // 重複防止: 既存のファクトチェックがあればそれを返す
  const { data: existing } = await supabase
    .from("ai_moderations")
    .select("id, type, content, triggered_by, created_at")
    .eq("triggered_by", argumentId)
    .eq("type", "fact_check")
    .maybeSingle();

  if (existing) {
    return Response.json(existing);
  }

  const { data: arg } = await supabase
    .from("arguments")
    .select(
      "id, room_id, stance, content, evidence_url, evidence_title, evidence_description"
    )
    .eq("id", argumentId)
    .single();

  if (!arg) {
    return Response.json({ error: "Argument not found" }, { status: 404 });
  }

  if (arg.room_id !== roomId) {
    return Response.json(
      { error: "Argument does not belong to room" },
      { status: 400 }
    );
  }

  const { data: room } = await supabase
    .from("rooms")
    .select("title")
    .eq("id", roomId)
    .single();

  if (!room) {
    return Response.json({ error: "Room not found" }, { status: 404 });
  }

  // 根拠 URL の本文を取得（失敗したら null のまま AI に判断させる）
  const evidenceText = await fetchEvidenceText(arg.evidence_url);

  const systemPrompt = buildFactCheckSystemPrompt();
  const userMessage = buildFactCheckUserMessage({
    roomTitle: room.title,
    stance: arg.stance,
    content: arg.content,
    evidenceUrl: arg.evidence_url,
    evidenceTitle: arg.evidence_title,
    evidenceDescription: arg.evidence_description,
    evidenceText,
  });

  const aiText = await callClaude(systemPrompt, userMessage, 1500);
  if ("error" in aiText) {
    return Response.json({ error: aiText.error }, { status: aiText.status });
  }

  const { data: moderation, error: insertError } = await supabase
    .from("ai_moderations")
    .insert({
      room_id: roomId,
      type: "fact_check",
      content: aiText.text,
      triggered_by: argumentId,
    })
    .select("id, type, content, triggered_by, created_at")
    .single();

  if (insertError) {
    return Response.json(
      { error: "Failed to save fact check: " + insertError.message },
      { status: 500 }
    );
  }

  return Response.json(moderation);
}

// --- Claude API 呼び出し（共通） ---

async function callClaude(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number
): Promise<{ text: string } | { error: string; status: number }> {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return { error: "AI request failed: " + err, status: 502 };
    }

    const data = await response.json();
    const text = data.content?.[0]?.text ?? "";
    return { text };
  } catch (err) {
    return {
      error: "AI request failed: " + (err as Error).message,
      status: 500,
    };
  }
}

// --- 論点整理 / サマリー用プロンプト ---

function buildAnalysisSystemPrompt(
  type: "topic_analysis" | "summary"
): string {
  const terminology = `## 立場の用語について
このプラットフォームでは従来の「賛成/反対」ではなく、以下の表現を使用します:
- 「同じです」: 元の投稿の主張に同意・共感し、補強する立場
- 「ほかにもあります」: 元の投稿とは別の視点・補足・代替案を示す立場（必ずしも否定や対立ではない）

つまりこの議論は「賛否を戦わせる対立構造」ではなく、「同意による共鳴」と「多様な視点の提示」の両輪で成り立っています。出力ではこの前提を守ってください:
- 「ほかにもあります」側を単なる反論や敵対勢力として扱わない
- 「共通点」や「歩み寄り」ではなく、「同意の広がり」と「視点の多様性」として捉える
- 対立の勝敗ではなく、議論の豊かさに焦点を当てる`;

  if (type === "topic_analysis") {
    return `あなたはディスカッションプラットフォーム「Argue」のAIモデレーターです。
議論の現在の論点を整理し、参加者が議論を深められるよう支援してください。

${terminology}

## 出力ルール
- 日本語で回答
- Markdownは使わず、プレーンテキストで簡潔に書く
- 見出しや項目名でも必ず「同じです」「ほかにもあります」という表記を使う（「賛成側」「反対側」という語は使わない）
- 以下の構成で出力:
  1. 現在の主な論点（箇条書き）
  2. 「同じです」側の主な主張の要約（元投稿への同意・補強のポイント）
  3. 「ほかにもあります」側の主な主張の要約（提示されている別視点・補足のポイント）
  4. まだ提示されていない観点や、深掘りすべきポイントの提案`;
  }

  return `あなたはディスカッションプラットフォーム「Argue」のAIモデレーターです。
議論全体を公平にまとめ、両方の立場の主張を整理してください。

${terminology}

## 出力ルール
- 日本語で回答
- Markdownは使わず、プレーンテキストで簡潔に書く
- 見出しや項目名でも必ず「同じです」「ほかにもあります」という表記を使う（「賛成側」「反対側」という語は使わない）
- 以下の構成で出力:
  1. 議論の概要（1-2文）
  2. 「同じです」側の主張まとめ（根拠含む）
  3. 「ほかにもあります」側の主張まとめ（根拠含む）
  4. 両者を俯瞰して見えてくる、この話題の広がり（同意の共通項と、提示された視点の多様性）
  5. 総評（勝敗ではなく、議論の質・視点の豊かさについてコメント）`;
}

function buildAnalysisUserMessage(
  type: "topic_analysis" | "summary",
  title: string,
  sourceUrl: string | null,
  formattedArgs: string,
  forCount: number,
  againstCount: number
): string {
  const label = type === "topic_analysis" ? "論点整理" : "議論サマリー";

  return `以下の議論について${label}を行ってください。

【テーマ】${title}
${sourceUrl ? `【元の投稿】${sourceUrl}` : ""}
【投稿数】「同じです」: ${forCount}件 / 「ほかにもあります」: ${againstCount}件

【投稿一覧】
${formattedArgs}`;
}

// --- ファクトチェック用プロンプト ---

function buildFactCheckSystemPrompt(): string {
  return `あなたはディスカッションプラットフォーム「Argue」のAIファクトチェッカーです。
投稿者の主張と、その根拠として示された URL の内容との整合性を検証してください。

## 検証の観点
1. **根拠の関連性**: 根拠 URL の内容は主張と直接関係しているか
2. **根拠の支持度**: 根拠が主張を実際に裏付けているか、それとも主張を超えた飛躍があるか
3. **事実性**: 主張に含まれる客観的な事実（数値・固有名詞・引用等）の正確性
4. **情報源の質**: 根拠の情報源が一般に信頼できるタイプか（公的機関・査読論文 / 報道 / 個人ブログ / SNS 等）

## 出力ルール
- 日本語で、プレーンテキストで簡潔に
- Markdown 記号は使わない
- 中立的・事実ベースで、感情的な批判や断定は避ける
- 確信が持てない点は「〜と思われる」「判断には追加の情報が必要」と正直に書く
- 以下の構成で出力:
  1. 総合評価（例: 根拠は妥当 / 部分的に妥当 / 関連性が弱い / 検証不能 のどれかを一文で）
  2. 根拠と主張の整合性についてのコメント（2〜4文）
  3. 注意点や、追加で確認すると議論が深まるポイント（あれば）

## 重要
- 根拠URLの本文が取得できなかった場合は、タイトル・説明・URL・あなたの一般知識の範囲で判断し、必ず「本文を直接確認できなかった」と明記してください
- 投稿者を責める文体ではなく、「読者が事実を確認する助けになる」トーンで書いてください`;
}

function buildFactCheckUserMessage(params: {
  roomTitle: string;
  stance: string;
  content: string;
  evidenceUrl: string;
  evidenceTitle: string | null;
  evidenceDescription: string | null;
  evidenceText: string | null;
}): string {
  const stanceLabel = params.stance === "for" ? "同じです" : "ほかにもあります";

  const evidenceBlock = params.evidenceText
    ? `【根拠ページの本文抜粋】\n${params.evidenceText}`
    : `【根拠ページの本文抜粋】\n（取得できませんでした。タイトル・説明・URLとあなたの一般知識で評価してください）`;

  return `以下の投稿についてファクトチェックを行ってください。

【議論テーマ】${params.roomTitle}
【投稿者の立場】${stanceLabel}
【投稿者の主張】
${params.content}

【根拠 URL】${params.evidenceUrl}
【根拠のタイトル】${params.evidenceTitle ?? "（不明）"}
${params.evidenceDescription ? `【投稿者による根拠の補足】\n${params.evidenceDescription}\n` : ""}
${evidenceBlock}`;
}
