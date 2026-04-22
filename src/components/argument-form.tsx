"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { postArgument, type PostArgumentState } from "@/app/actions/arguments";

const initialState: PostArgumentState = {};

export type ArgumentPickerOption = {
  id: string;
  content: string;
  stance: "for" | "against";
};

export default function ArgumentForm({
  roomId,
  roomTitle,
  availableArguments,
}: {
  roomId: string;
  roomTitle: string;
  availableArguments: ArgumentPickerOption[];
}) {
  const [state, formAction, pending] = useActionState(
    postArgument,
    initialState
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [parentId, setParentId] = useState<string>("");

  const selectedParent = parentId
    ? availableArguments.find((a) => a.id === parentId) ?? null
    : null;

  // Reset form + parent selection on success
  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      setParentId("");
    }
  }, [state.success]);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <h3 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        意見を投稿
      </h3>

      {state.error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </div>
      )}

      {state.moderationFeedback && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-sm font-semibold text-amber-800 dark:text-amber-200">
              AIモデレーター: 投稿が基準を満たしませんでした
            </span>
          </div>
          <p className="mb-3 text-sm text-amber-700 dark:text-amber-300">
            {state.moderationFeedback.reason}
          </p>
          <div className="mb-3 flex gap-4 text-xs text-amber-600 dark:text-amber-400">
            <span>
              感情的攻撃スコア:{" "}
              {state.moderationFeedback.scores.emotional_attack}/10
            </span>
            <span>
              論理性スコア:{" "}
              {state.moderationFeedback.scores.logical_structure}/10
            </span>
          </div>
          <div className="rounded-md border border-amber-200 bg-white p-3 dark:border-amber-700 dark:bg-amber-900/30">
            <p className="mb-1 text-xs font-medium text-amber-800 dark:text-amber-200">
              修正案:
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              {state.moderationFeedback.suggestion}
            </p>
          </div>
        </div>
      )}

      {state.success && (
        <div className="mb-4 rounded-lg border border-green-300 bg-green-50 p-4 text-sm text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
          投稿が承認されました！
        </div>
      )}

      <form ref={formRef} action={formAction} className="space-y-4">
        <input type="hidden" name="roomId" value={roomId} />
        <input type="hidden" name="roomTitle" value={roomTitle} />
        <input type="hidden" name="parentId" value={parentId} />

        {/* 踏まえる発言の選択 (任意) */}
        {availableArguments.length > 0 && (
          <div>
            <p className="mb-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              踏まえる発言（任意）
            </p>
            {selectedParent ? (
              <div className="flex items-start gap-2 rounded-md border border-zinc-300 bg-zinc-50 p-2 dark:border-zinc-700 dark:bg-zinc-900">
                <span
                  className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    selectedParent.stance === "for"
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                      : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                  }`}
                >
                  {selectedParent.stance === "for"
                    ? "同じです"
                    : "ほかにもあります"}
                </span>
                <p className="flex-1 line-clamp-2 text-xs text-zinc-700 dark:text-zinc-300">
                  {selectedParent.content}
                </p>
                <button
                  type="button"
                  onClick={() => setParentId("")}
                  className="shrink-0 text-xs text-zinc-500 underline hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                >
                  解除
                </button>
              </div>
            ) : (
              <details className="group rounded-md border border-zinc-200 dark:border-zinc-800">
                <summary className="cursor-pointer list-none px-3 py-2 text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200">
                  どの発言を踏まえているか選ぶ（読み手が流れを追えるようになります）
                </summary>
                <div className="max-h-48 overflow-y-auto border-t border-zinc-200 dark:border-zinc-800">
                  {availableArguments.map((arg) => (
                    <button
                      key={arg.id}
                      type="button"
                      onClick={() => setParentId(arg.id)}
                      className="flex w-full items-start gap-2 border-b border-zinc-100 px-3 py-2 text-left last:border-b-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                    >
                      <span
                        className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          arg.stance === "for"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                            : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                        }`}
                      >
                        {arg.stance === "for" ? "同じです" : "ほかにもあります"}
                      </span>
                      <span className="flex-1 line-clamp-2 text-xs text-zinc-700 dark:text-zinc-300">
                        {arg.content}
                      </span>
                    </button>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}

        {/* 立場選択 */}
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            立場 <span className="text-red-500">*</span>
          </legend>
          <div className="flex gap-4">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-blue-200 px-4 py-2 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50 dark:border-blue-800 dark:has-[:checked]:border-blue-400 dark:has-[:checked]:bg-blue-950">
              <input
                type="radio"
                name="stance"
                value="for"
                required
                className="text-blue-600"
              />
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                同じです
              </span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-red-200 px-4 py-2 has-[:checked]:border-red-500 has-[:checked]:bg-red-50 dark:border-red-800 dark:has-[:checked]:border-red-400 dark:has-[:checked]:bg-red-950">
              <input
                type="radio"
                name="stance"
                value="against"
                className="text-red-600"
              />
              <span className="text-sm font-medium text-red-700 dark:text-red-300">
                ほかにもあります
              </span>
            </label>
          </div>
        </fieldset>

        {/* 主張 */}
        <div>
          <label
            htmlFor="content"
            className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            主張 <span className="text-red-500">*</span>
          </label>
          <textarea
            id="content"
            name="content"
            rows={4}
            required
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            placeholder="あなたの主張を論理的に記述してください"
          />
        </div>

        {/* 根拠URL（必須） */}
        <div>
          <label
            htmlFor="evidenceUrl"
            className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            根拠URL <span className="text-red-500">*</span>
          </label>
          <input
            id="evidenceUrl"
            name="evidenceUrl"
            type="url"
            required
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            placeholder="https://example.com/evidence"
          />
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            主張を裏付ける根拠となるURLを入力してください（必須）
          </p>
        </div>

        {/* 根拠の説明（任意） */}
        <div>
          <label
            htmlFor="evidenceDescription"
            className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            根拠の説明（任意）
          </label>
          <input
            id="evidenceDescription"
            name="evidenceDescription"
            type="text"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            placeholder="根拠URLの内容を簡潔に説明"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-zinc-900 py-3 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {pending ? "AIが検証中..." : "投稿する"}
        </button>
        {pending && (
          <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
            AIモデレーターが内容を検証しています...
          </p>
        )}
      </form>
    </div>
  );
}
