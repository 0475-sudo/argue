"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ensureProfile } from "@/lib/ensure-profile";

export type AuthState = {
  error?: string;
  message?: string;
};

function getSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT || 3000}`;
}

export async function login(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email?.trim() || !password) {
    return { error: "メールアドレスとパスワードを入力してください" };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: "メールアドレスまたはパスワードが正しくありません" };
  }

  // Rescue: create profile row if missing (stranded signup)
  if (data.user) {
    await ensureProfile(supabase, data.user);
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signup(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const supabase = await createClient();

  const username = formData.get("username") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!username?.trim()) {
    return { error: "ユーザー名を入力してください" };
  }

  if (!email?.trim() || !password) {
    return { error: "メールアドレスとパスワードを入力してください" };
  }

  if (password.length < 8) {
    return { error: "パスワードは8文字以上で入力してください" };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username: username.trim(),
      },
      emailRedirectTo: `${getSiteUrl()}/auth/callback`,
    },
  });

  if (error) {
    return { error: "アカウントの作成に失敗しました: " + error.message };
  }

  // If email confirmation is disabled, a session is returned immediately
  if (data.session && data.user) {
    await ensureProfile(supabase, data.user);
    revalidatePath("/", "layout");
    redirect("/");
  }

  return {
    message: `確認メールを ${email} に送信しました。メール内のリンクをクリックして登録を完了してください。`,
  };
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
