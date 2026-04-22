"use client";

import { useActionState } from "react";
import { createRoom, type CreateRoomState } from "@/app/actions/rooms";

const initialState: CreateRoomState = {};

export default function RoomForm() {
  const [state, formAction, pending] = useActionState(createRoom, initialState);

  return (
    <form action={formAction} className="space-y-8">
      {state.error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </div>
      )}

      {/* SNS投稿URL */}
      <div>
        <label
          htmlFor="sourceUrl"
          className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          議論したいSNSの投稿URL
        </label>
        <input
          id="sourceUrl"
          name="sourceUrl"
          type="url"
          required
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          placeholder="例: https://x.com/user/status/123456789"
        />
      </div>

      {/* 区切り線 */}
      <div className="border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          あなたの意見
        </h2>

        {/* スタンス選択 */}
        <fieldset className="mb-4">
          <legend className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            スタンス
          </legend>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="stance"
                value="for"
                required
                className="accent-blue-600"
              />
              <span className="text-zinc-700 dark:text-zinc-300">同じです</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="stance"
                value="against"
                className="accent-red-600"
              />
              <span className="text-zinc-700 dark:text-zinc-300">ほかにもあります</span>
            </label>
          </div>
        </fieldset>

        {/* 意見の内容 */}
        <div className="mb-4">
          <label
            htmlFor="content"
            className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            意見の内容
          </label>
          <textarea
            id="content"
            name="content"
            rows={4}
            required
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            placeholder="この投稿に対するあなたの意見を書いてください"
          />
        </div>

        {/* 証拠URL */}
        <div>
          <label
            htmlFor="evidenceUrl"
            className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            証拠となるURL
          </label>
          <input
            id="evidenceUrl"
            name="evidenceUrl"
            type="url"
            required
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            placeholder="例: https://example.com/article"
          />
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            あなたの意見を裏付ける記事やデータのURLを入力してください
          </p>
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-zinc-900 py-3 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {pending ? "作成中..." : "ルームを作成して意見を投稿"}
      </button>
    </form>
  );
}
