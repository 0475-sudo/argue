-- 証拠URLのOGPタイトルを保存するカラムを追加
alter table public.arguments
  add column if not exists evidence_title text;
