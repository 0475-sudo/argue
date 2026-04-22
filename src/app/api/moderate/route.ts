import { NextRequest } from "next/server";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

type ModerationResult = {
  approved: boolean;
  reason?: string;
  suggestion?: string;
  scores: {
    emotional_attack: number; // 0-10, 高いほど攻撃的
    logical_structure: number; // 0-10, 高いほど論理的
  };
};

export async function POST(request: NextRequest) {
  if (!ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY is not configured" },
      { status: 500 }
    );
  }

  const body = await request.json();
  const { content, evidenceUrl, stance, roomTitle } = body;

  if (!content || !evidenceUrl || !stance) {
    return Response.json(
      { error: "content, evidenceUrl, stance are required" },
      { status: 400 }
    );
  }

  const systemPrompt = `あなたはオンラインディベートプラットフォーム「Argue」のAIモデレーターです。
ユーザーの投稿を以下の基準で評価してください。

## 判定基準

1. **感情的攻撃の検出** (emotional_attack: 0-10)
   - 0: 完全に冷静で建設的
   - 5: やや感情的だが許容範囲
   - 10: 明らかな誹謗中傷・人身攻撃
   - 対象: 侮辱、蔑称、脅迫、差別的表現、人格否定

2. **論理的構成の評価** (logical_structure: 0-10)
   - 0: 論理性なし（感情論のみ）
   - 5: 一定の論理構成あり
   - 10: 非常に論理的で根拠が明確

## 判定ルール
- emotional_attack >= 6 → 不承認（攻撃的すぎる）
- logical_structure <= 2 → 不承認（論理性が不十分）
- それ以外 → 承認

## 出力形式
必ず以下のJSON形式のみで回答してください。他のテキストは不要です。
{
  "approved": boolean,
  "reason": "不承認の場合、具体的な理由を日本語で",
  "suggestion": "不承認の場合、より論理的な表現への修正案を日本語で提示",
  "scores": {
    "emotional_attack": number,
    "logical_structure": number
  }
}`;

  const userMessage = `以下の投稿を評価してください。

## 立場の用語について
このプラットフォームでは従来の「賛成/反対」ではなく、以下の表現を使用します:
- 「同じです」: 元の投稿の主張に同意・共感し、補強する立場
- 「ほかにもあります」: 元の投稿とは別の視点・補足・代替案を示す立場（必ずしも否定や対立ではない）

この用語の違いを踏まえ、「ほかにもあります」側の投稿が反論の形を取っていなくても論理的に不十分だと判定しないでください。別視点の提示そのものが主張として成立します。

**ディベートテーマ**: ${roomTitle || "未設定"}
**立場**: ${stance === "for" ? "同じです" : "ほかにもあります"}
**主張**:
${content}

**根拠URL**: ${evidenceUrl}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return Response.json(
        { error: "AI moderation failed: " + err },
        { status: 502 }
      );
    }

    const data = await response.json();
    const text = data.content?.[0]?.text ?? "";

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return Response.json(
        { error: "Failed to parse moderation result" },
        { status: 502 }
      );
    }

    const result: ModerationResult = JSON.parse(jsonMatch[0]);
    return Response.json(result);
  } catch (err) {
    return Response.json(
      { error: "Moderation request failed: " + (err as Error).message },
      { status: 500 }
    );
  }
}
