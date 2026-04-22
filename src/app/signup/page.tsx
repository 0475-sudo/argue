"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signup, type AuthState } from "@/app/actions/auth";

const initialState: AuthState = {};

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signup, initialState);

  if (state.message) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <h1 className="mb-6 text-center text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            確認メールを送信しました
          </h1>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
            {state.message}
          </div>
          <p className="mt-6 text-center text-sm text-zinc-500">
            確認後に{" "}
            <Link
              href="/login"
              className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
            >
              ログイン
            </Link>{" "}
            してください。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <h1 className="mb-8 text-center text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          アカウント作成
        </h1>
        <form action={formAction} className="space-y-4">
          {state.error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
              {state.error}
            </div>
          )}
          <div>
            <label
              htmlFor="username"
              className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              ユーザー名
            </label>
            <input
              id="username"
              name="username"
              type="text"
              required
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              placeholder="your_username"
            />
          </div>
          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              メールアドレス
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              パスワード
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-zinc-900 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {pending ? "作成中..." : "サインアップ"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-zinc-500">
          既にアカウントをお持ちですか？{" "}
          <Link
            href="/login"
            className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
          >
            ログイン
          </Link>
        </p>
      </div>
    </div>
  );
}
