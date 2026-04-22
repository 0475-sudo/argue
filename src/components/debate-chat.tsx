"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ArgumentForm from "@/components/argument-form";
import { voteOnArgument } from "@/app/actions/votes";

export type Argument = {
  id: string;
  stance: "for" | "against";
  content: string;
  evidence_url: string;
  evidence_title: string | null;
  evidence_description: string | null;
  parent_id: string | null;
  created_at: string;
  user_id: string | null;
  vote_count: number;
  profiles: { username: string; display_name: string | null } | null;
};

export type AiModeration = {
  id: string;
  type: string;
  content: string;
  triggered_by: string | null;
  created_at: string;
};

type TimelineItem =
  | { kind: "argument"; data: Argument }
  | { kind: "ai"; data: AiModeration };

export default function DebateChat({
  roomId,
  roomTitle,
  roomStatus,
  initialArguments,
  initialModerations,
  initialUserVotes,
  currentUserId,
}: {
  roomId: string;
  roomTitle: string;
  roomStatus: string;
  initialArguments: Argument[];
  initialModerations: AiModeration[];
  initialUserVotes: Record<string, 1 | -1>;
  currentUserId: string | null;
}) {
  const [args, setArgs] = useState<Argument[]>(initialArguments);
  const [moderations, setModerations] =
    useState<AiModeration[]>(initialModerations);
  const [userVotes, setUserVotes] =
    useState<Record<string, 1 | -1>>(initialUserVotes);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [factChecking, setFactChecking] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<
    "chronological" | "popular" | "flow"
  >("chronological");
  const bottomRef = useRef<HTMLDivElement>(null);
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const bubbleRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [flowPaths, setFlowPaths] = useState<
    Array<{ id: string; d: string }>
  >([]);

  const setBubbleRef = (id: string) => (el: HTMLDivElement | null) => {
    bubbleRefs.current[id] = el;
  };

  // 親バブルへスクロール + 一時ハイライト
  const scrollToArgument = (argId: string) => {
    const el = bubbleRefs.current[argId];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-amber-400", "ring-offset-2");
    setTimeout(() => {
      el.classList.remove("ring-2", "ring-amber-400", "ring-offset-2");
    }, 1500);
  };

  const argsById: Record<string, Argument> = {};
  for (const a of args) argsById[a.id] = a;

  // triggered_by 付き（ファクトチェック等）はバブル直下、それ以外はタイムラインへ
  const factChecksByArg: Record<string, AiModeration> = {};
  const timelineModerations: AiModeration[] = [];
  for (const m of moderations) {
    if (m.triggered_by) {
      factChecksByArg[m.triggered_by] = m;
    } else {
      timelineModerations.push(m);
    }
  }

  const byCreatedAsc = (a: { created_at: string }, b: { created_at: string }) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime();

  const timeline: TimelineItem[] =
    sortMode === "popular"
      ? [
          ...[...timelineModerations]
            .sort(byCreatedAsc)
            .map((m) => ({ kind: "ai" as const, data: m })),
          ...[...args]
            .sort(
              (a, b) => b.vote_count - a.vote_count || byCreatedAsc(a, b)
            )
            .map((a) => ({ kind: "argument" as const, data: a })),
        ]
      : sortMode === "flow"
      ? [
          ...[...timelineModerations]
            .sort(byCreatedAsc)
            .map((m) => ({ kind: "ai" as const, data: m })),
          ...[...args]
            .sort(byCreatedAsc)
            .map((a) => ({ kind: "argument" as const, data: a })),
        ]
      : [
          ...args.map((a) => ({ kind: "argument" as const, data: a })),
          ...timelineModerations.map((m) => ({
            kind: "ai" as const,
            data: m,
          })),
        ].sort((a, b) => byCreatedAsc(a.data, b.data));

  // Realtime subscriptions
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`room-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "arguments",
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          const newArg = payload.new as Argument;

          if (newArg.user_id) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("username, display_name")
              .eq("id", newArg.user_id)
              .single();
            newArg.profiles = profile;
          }

          setArgs((prev) => {
            if (prev.some((a) => a.id === newArg.id)) return prev;
            return [...prev, newArg];
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "arguments",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const updated = payload.new as Argument;
          setArgs((prev) =>
            prev.map((a) =>
              a.id === updated.id
                ? { ...a, vote_count: updated.vote_count }
                : a
            )
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ai_moderations",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const newMod = payload.new as AiModeration;
          if (newMod.type === "rejection") return;
          setModerations((prev) => {
            if (prev.some((m) => m.id === newMod.id)) return prev;
            return [...prev, newMod];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  // サーバー側で revalidatePath されて initialArguments が更新されたら、
  // ローカル state にマージする (realtime が配信失敗しても新着が反映される)。
  useEffect(() => {
    setArgs((prev) => {
      const ids = new Set(prev.map((a) => a.id));
      const merged = [...prev];
      for (const a of initialArguments) {
        if (!ids.has(a.id)) merged.push(a);
      }
      return merged.sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    });
  }, [initialArguments]);

  useEffect(() => {
    setModerations((prev) => {
      const ids = new Set(prev.map((m) => m.id));
      const merged = [...prev];
      for (const m of initialModerations) {
        if (!ids.has(m.id)) merged.push(m);
      }
      return merged.sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    });
  }, [initialModerations]);

  // 新しいアイテムが追加されたら自動スクロール（時系列モード時のみ）
  useEffect(() => {
    if (sortMode !== "chronological") return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [timeline.length, sortMode]);

  // flow モード: 親↔子バブル間の SVG パスを計算
  useEffect(() => {
    if (sortMode !== "flow") {
      setFlowPaths([]);
      return;
    }

    const compute = () => {
      const container = timelineContainerRef.current;
      if (!container) return;
      const containerRect = container.getBoundingClientRect();
      const paths: Array<{ id: string; d: string }> = [];
      for (const arg of args) {
        if (!arg.parent_id) continue;
        const childEl = bubbleRefs.current[arg.id];
        const parentEl = bubbleRefs.current[arg.parent_id];
        if (!childEl || !parentEl) continue;
        const cr = childEl.getBoundingClientRect();
        const pr = parentEl.getBoundingClientRect();
        // 親は下辺中央、子は上辺中央
        const fromX = pr.left + pr.width / 2 - containerRect.left;
        const fromY = pr.bottom - containerRect.top;
        const toX = cr.left + cr.width / 2 - containerRect.left;
        const toY = cr.top - containerRect.top;
        const midY = (fromY + toY) / 2;
        paths.push({
          id: arg.id,
          d: `M ${fromX} ${fromY} C ${fromX} ${midY}, ${toX} ${midY}, ${toX} ${toY}`,
        });
      }
      setFlowPaths(paths);
    };

    // 初期化後に最初の measure を 1 フレーム遅延 (レイアウト完了待ち)
    const raf = requestAnimationFrame(compute);

    const ro = new ResizeObserver(() => {
      compute();
    });
    if (timelineContainerRef.current) {
      ro.observe(timelineContainerRef.current);
    }
    window.addEventListener("resize", compute);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", compute);
    };
  }, [sortMode, args]);

  // リアクション投票（楽観更新）
  async function handleVote(argumentId: string, value: 1 | -1) {
    if (!currentUserId) return;

    const prevVote = userVotes[argumentId];
    const prevArgs = args;
    const prevUserVotes = userVotes;

    // 楽観更新: userVotes を切り替え
    const nextUserVotes = { ...userVotes };
    let delta = 0;
    if (prevVote === value) {
      delete nextUserVotes[argumentId];
      delta = -value;
    } else if (prevVote === undefined) {
      nextUserVotes[argumentId] = value;
      delta = value;
    } else {
      nextUserVotes[argumentId] = value;
      delta = -prevVote + value;
    }
    setUserVotes(nextUserVotes);
    setArgs((prev) =>
      prev.map((a) =>
        a.id === argumentId ? { ...a, vote_count: a.vote_count + delta } : a
      )
    );

    const result = await voteOnArgument(argumentId, value);
    if (result.error) {
      setUserVotes(prevUserVotes);
      setArgs(prevArgs);
      alert(result.error);
    }
  }

  // AI分析リクエスト
  async function requestAnalysis(type: "topic_analysis" | "summary") {
    setAnalyzing(type);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, type }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "AI分析に失敗しました");
      }
    } catch {
      alert("AI分析リクエストに失敗しました");
    } finally {
      setAnalyzing(null);
    }
  }

  // ファクトチェックリクエスト
  async function requestFactCheck(argumentId: string) {
    if (factChecking) return;
    setFactChecking(argumentId);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, type: "fact_check", argumentId }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "ファクトチェックに失敗しました");
        return;
      }
      // 既存 or 新規の moderation 本体が返る。realtime で重複しうるので
      // ここで追加してしまう（setModerations 側で id 重複チェックあり）。
      const mod = (await res.json()) as AiModeration;
      setModerations((prev) =>
        prev.some((m) => m.id === mod.id) ? prev : [...prev, mod]
      );
    } catch {
      alert("ファクトチェックリクエストに失敗しました");
    } finally {
      setFactChecking(null);
    }
  }

  return (
    <div className="flex flex-col">
      {/* AI分析ボタン + 並び替えトグル */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => requestAnalysis("topic_analysis")}
            disabled={analyzing !== null || args.length === 0}
            className="rounded-lg border border-purple-300 bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-50 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-300 dark:hover:bg-purple-900"
          >
            {analyzing === "topic_analysis" ? "分析中..." : "AI 論点整理"}
          </button>
          <button
            onClick={() => requestAnalysis("summary")}
            disabled={analyzing !== null || args.length === 0}
            className="rounded-lg border border-purple-300 bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-50 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-300 dark:hover:bg-purple-900"
          >
            {analyzing === "summary" ? "生成中..." : "AI 議論サマリー"}
          </button>
        </div>
        <div className="flex rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => setSortMode("chronological")}
            aria-pressed={sortMode === "chronological"}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              sortMode === "chronological"
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            時系列
          </button>
          <button
            type="button"
            onClick={() => setSortMode("popular")}
            aria-pressed={sortMode === "popular"}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              sortMode === "popular"
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            納得数順
          </button>
          <button
            type="button"
            onClick={() => setSortMode("flow")}
            aria-pressed={sortMode === "flow"}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              sortMode === "flow"
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            流れ
          </button>
        </div>
      </div>

      {/* タイムライン */}
      <div
        ref={timelineContainerRef}
        className="relative mb-6 space-y-3"
      >
        {/* flow モード: SVG オーバーレイで親↔子を線で結ぶ */}
        {sortMode === "flow" && flowPaths.length > 0 && (
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full text-amber-500/60 dark:text-amber-400/50"
            aria-hidden="true"
          >
            {flowPaths.map((p) => (
              <path
                key={p.id}
                d={p.d}
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray="4 4"
                fill="none"
              />
            ))}
          </svg>
        )}

        {timeline.length === 0 ? (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm text-zinc-500">まだ意見がありません</p>
          </div>
        ) : (
          timeline.map((item) =>
            item.kind === "argument" ? (
              <ChatBubble
                key={`arg-${item.data.id}`}
                argument={item.data}
                parent={
                  item.data.parent_id
                    ? argsById[item.data.parent_id] ?? null
                    : null
                }
                isOwn={item.data.user_id === currentUserId}
                canVote={
                  currentUserId !== null && item.data.user_id !== currentUserId
                }
                canFactCheck={currentUserId !== null}
                userVote={userVotes[item.data.id] ?? null}
                factCheck={factChecksByArg[item.data.id] ?? null}
                factCheckPending={factChecking === item.data.id}
                bubbleRef={setBubbleRef(item.data.id)}
                onVote={handleVote}
                onFactCheck={requestFactCheck}
                onJumpToArgument={scrollToArgument}
              />
            ) : (
              <AiCard key={`ai-${item.data.id}`} moderation={item.data} />
            )
          )
        )}
        <div ref={bottomRef} />
      </div>

      {/* 投稿フォーム */}
      {roomStatus !== "closed" && (
        <ArgumentForm
          roomId={roomId}
          roomTitle={roomTitle}
          availableArguments={args.map((a) => ({
            id: a.id,
            content: a.content,
            stance: a.stance,
          }))}
        />
      )}
    </div>
  );
}

// --- AIモデレーションカード ---

const typeLabels: Record<string, string> = {
  topic_analysis: "論点整理",
  summary: "議論サマリー",
  fact_check: "ファクトチェック",
  feedback: "フィードバック",
};

function AiCard({
  moderation,
  compact = false,
}: {
  moderation: AiModeration;
  compact?: boolean;
}) {
  const time = new Date(moderation.created_at).toLocaleString("ja-JP", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const body = (
    <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 dark:border-purple-800 dark:bg-purple-950">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-[11px] font-bold text-purple-700 dark:text-purple-300">
          AI モデレーター
        </span>
        <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-600 dark:bg-purple-900 dark:text-purple-400">
          {typeLabels[moderation.type] ?? moderation.type}
        </span>
      </div>
      <p className="whitespace-pre-wrap text-xs text-purple-900 dark:text-purple-100">
        {moderation.content}
      </p>
      <p className="mt-1.5 text-right text-[10px] text-purple-400">{time}</p>
    </div>
  );

  if (compact) return body;

  return <div className="mx-auto w-full max-w-[90%]">{body}</div>;
}

// --- チャットバブル ---

function ChatBubble({
  argument,
  parent,
  isOwn,
  canVote,
  canFactCheck,
  userVote,
  factCheck,
  factCheckPending,
  bubbleRef,
  onVote,
  onFactCheck,
  onJumpToArgument,
}: {
  argument: Argument;
  parent: Argument | null;
  isOwn: boolean;
  canVote: boolean;
  canFactCheck: boolean;
  userVote: 1 | -1 | null;
  factCheck: AiModeration | null;
  factCheckPending: boolean;
  bubbleRef: (el: HTMLDivElement | null) => void;
  onVote: (argumentId: string, value: 1 | -1) => void;
  onFactCheck: (argumentId: string) => void;
  onJumpToArgument: (argumentId: string) => void;
}) {
  const isFor = argument.stance === "for";
  const displayName =
    argument.profiles?.display_name ||
    argument.profiles?.username ||
    "匿名ユーザー";
  const time = new Date(argument.created_at).toLocaleString("ja-JP", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const stanceLabel = isFor ? "同じです" : "ほかにもあります";
  const stanceBadge = isFor
    ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
    : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300";

  const bubbleBorder = isFor
    ? "border-blue-200 dark:border-blue-800"
    : "border-red-200 dark:border-red-800";

  const bubbleBg = isFor
    ? "bg-blue-50 dark:bg-blue-950"
    : "bg-red-50 dark:bg-red-950";

  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
      <div
        ref={bubbleRef}
        className="flex max-w-[85%] flex-col rounded-lg transition-shadow sm:max-w-[70%]"
      >
        {/* 踏まえている発言の引用 (任意) */}
        {parent && (
          <button
            type="button"
            onClick={() => onJumpToArgument(parent.id)}
            className="mb-1 flex items-start gap-2 rounded-md border border-zinc-200 bg-white/70 px-2 py-1.5 text-left hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/60 dark:hover:border-zinc-500 dark:hover:bg-zinc-900"
            aria-label="踏まえている発言へ移動"
          >
            <span
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-[11px] text-zinc-400"
            >
              ↳
            </span>
            <span className="line-clamp-1 flex-1 text-[11px] text-zinc-500 dark:text-zinc-400">
              {parent.content}
            </span>
          </button>
        )}

        <div
          className={`rounded-lg border ${bubbleBorder} ${bubbleBg} p-4`}
        >
          {/* ヘッダー: ユーザー名 + スタンス */}
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              {displayName}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${stanceBadge}`}
            >
              {stanceLabel}
            </span>
          </div>

          {/* 本文 */}
          <p className="whitespace-pre-wrap text-sm text-zinc-800 dark:text-zinc-200">
            {argument.content}
          </p>

          {/* 根拠 */}
          <div className="mt-3 border-t border-zinc-200 pt-2 dark:border-zinc-700">
            <p className="mb-1 text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
              根拠:
            </p>
            <a
              href={argument.evidence_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate text-xs text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              {argument.evidence_title || argument.evidence_url}
            </a>
            {argument.evidence_description && (
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {argument.evidence_description}
              </p>
            )}
          </div>

          {/* 時刻 */}
          <p className="mt-2 text-right text-[10px] text-zinc-400">{time}</p>
        </div>

        {/* リアクション & ファクトチェックボタン */}
        {(canVote || (canFactCheck && !factCheck)) && (
          <div className="mt-1 flex flex-wrap items-center gap-1.5 pl-1">
            {canVote && (
              <VoteBadges
                argumentId={argument.id}
                voteCount={argument.vote_count}
                userVote={userVote}
                onVote={onVote}
              />
            )}
            {canFactCheck && !factCheck && (
              <button
                type="button"
                onClick={() => onFactCheck(argument.id)}
                disabled={factCheckPending}
                className="rounded-full border border-purple-200 px-2 py-0.5 text-[10px] text-purple-600 transition-colors hover:border-purple-400 hover:bg-purple-50 disabled:opacity-50 dark:border-purple-800 dark:text-purple-400 dark:hover:border-purple-600 dark:hover:bg-purple-950"
              >
                {factCheckPending ? "検証中..." : "ファクトチェック"}
              </button>
            )}
          </div>
        )}

        {/* ファクトチェック結果（該当投稿に紐付く） */}
        {factCheck && (
          <div className="mt-2">
            <AiCard moderation={factCheck} compact />
          </div>
        )}
      </div>
    </div>
  );
}

function VoteBadges({
  argumentId,
  voteCount,
  userVote,
  onVote,
}: {
  argumentId: string;
  voteCount: number;
  userVote: 1 | -1 | null;
  onVote: (argumentId: string, value: 1 | -1) => void;
}) {
  const baseBtn =
    "rounded-full border px-2 py-0.5 text-[10px] transition-colors";
  const neutralBtn =
    "border-zinc-200 text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-300";
  const agreeActive =
    "border-emerald-400 bg-emerald-100 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
  const doubtActive =
    "border-amber-400 bg-amber-100 text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300";

  return (
    <>
      <button
        type="button"
        onClick={() => onVote(argumentId, 1)}
        className={`${baseBtn} ${userVote === 1 ? agreeActive : neutralBtn}`}
        aria-pressed={userVote === 1}
      >
        納得！
      </button>
      <button
        type="button"
        onClick={() => onVote(argumentId, -1)}
        className={`${baseBtn} ${userVote === -1 ? doubtActive : neutralBtn}`}
        aria-pressed={userVote === -1}
      >
        根拠不足
      </button>
      {voteCount !== 0 && (
        <span
          className={`text-[10px] ${
            voteCount > 0
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-amber-600 dark:text-amber-400"
          }`}
        >
          {voteCount > 0 ? `+${voteCount}` : voteCount}
        </span>
      )}
    </>
  );
}
