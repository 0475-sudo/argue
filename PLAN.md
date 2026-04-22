# Argue - 開発計画書

## プロジェクト概要

**Argue** は、AIモデレーターが議論の質を高める次世代ディスカッションプラットフォームです。
SNS の投稿 URL を起点に、ユーザーが賛成・反対の立場から意見(+ 根拠 URL)を投稿し、AIが論点整理・議論サマリー・投稿の事前モデレーションをリアルタイムで行います。

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フロントエンド | Next.js 16 (App Router) + React 19 + TypeScript |
| スタイリング | Tailwind CSS v4 |
| 認証 | Supabase Auth |
| データベース | Supabase (PostgreSQL) |
| リアルタイム | Supabase Realtime |
| AIモデレーター | Claude API (claude-haiku-4-5) |
| デプロイ | Vercel (未設定) |

---

## Phase 1: 基盤構築（認証 + DB + レイアウト） — ✅ 完了

プラットフォームの土台を作る。ログインでき、画面遷移できる状態にする。

- [x] **1.1** Supabase プロジェクト作成・環境変数設定 (`.env.local`)
- [x] **1.2** Supabase クライアント初期化 (`@supabase/ssr`)
  - `src/lib/supabase/{client,server,middleware}.ts`
- [x] **1.3** データベーススキーマ設計・マイグレーション作成
  - `supabase/migrations/001_create_tables.sql` — profiles / rooms / arguments / votes / ai_moderations + RLS
  - `002_add_profiles_insert_policy.sql`、`003_add_evidence_title.sql`
- [x] **1.4** 認証フロー実装（サインアップ / ログイン / ログアウト）
  - `src/app/actions/auth.ts`、`/login`、`/signup`
  - サインアップ時に `profiles` 行を自動作成
- [x] **1.5** 共通レイアウト作成（ヘッダー / フッター）
  - `src/components/{header,footer}.tsx`
- [x] **1.6** ページルーティング
  - `/` トップ(ルーム一覧兼ランディング)、`/login`、`/signup`
  - `/room/[id]`、`/room/new`、`/profile/[id]`

---

## Phase 2: ディベートルーム（CRUD + 一覧） — 🟡 概ね実装 / 一部未着手

議論の場を作成・表示できるようにする。

- [x] **2.1** ルーム作成フォーム
  - SNS 投稿 URL をトリガーに、立場 + 意見 + 根拠 URL を投稿する設計に変更
  - 元投稿・根拠の OGP タイトルを並列取得(`src/lib/og.ts`)
  - `src/components/room-form.tsx`、`src/app/actions/rooms.ts`
- [x] **2.2** ルーム一覧ページ(カード形式、ステータス表示)
- [x] **2.3** ルーム詳細ページの基本レイアウト
  - 当初計画の「左右2カラム」ではなく、賛成/反対の色分けチャット形式に変更
  - ルームヘッダ(ステータスバッジ + タイトル + 元投稿リンク)
- [ ] **2.4** ルームのステータス自動遷移（open → active → closed）
  - DB カラム/バッジ表示はあるが、遷移ロジックは未実装
  - `time_limit` カラムも未活用
- [ ] **2.5** カテゴリ・ステータスによるフィルタリング
  - 現状は全件新着順20件を取得するだけ

**完了条件**: ルームを作成し、一覧から選んで詳細ページを表示できる → ✅ 達成

---

## Phase 3: 議論機能（投稿 + リアルタイム） — 🟡 コア機能のみ実装

ルーム内で意見を投稿し、リアルタイムで表示する。

- [x] **3.1** 意見投稿フォーム(立場 + 本文 + 根拠 URL + 根拠説明)
  - `src/components/argument-form.tsx`、`src/app/actions/arguments.ts`
  - 根拠 URL は必須、OGP タイトル自動取得
- [x] **3.2** 投稿一覧の表示
  - チャットバブル形式(自分の投稿は右寄せ、賛成=青 / 反対=赤)
  - `src/components/debate-chat.tsx`
- [x] **3.3** Supabase Realtime で新規投稿をリアルタイム反映
  - `arguments` と `ai_moderations` の INSERT を購読
- [ ] **3.4** 投稿への投票機能（説得力あり / なし）
  - `votes` テーブル・`vote_count` カラムは存在するが UI 未実装
- [ ] **3.5** 投稿の並び替え（新着順 / 投票順）
- [ ] **3.6** 返信（スレッド）機能
  - `arguments.parent_id` カラムはあるが UI 未実装

**完了条件**: 2人のユーザーが同じルームでリアルタイムに議論できる → ✅ 達成

---

## Phase 4: AIモデレーター — 🟡 主要機能は実装 / ファクトチェック未着手

Claude API を統合し、議論を支援する AI 機能を実装する。

- [x] **4.1** Claude API 連携の基盤構築
  - `src/app/api/moderate/route.ts`(投稿事前審査)
  - `src/app/api/analyze/route.ts`(ルーム全体の分析)
  - モデル: `claude-haiku-4-5-20251001`
- [x] **4.2** 論点整理機能（`topic_analysis`）
  - チャット画面の「AI 論点整理」ボタンから実行
- [ ] **4.3** ファクトチェック機能
  - `ai_moderations.type` に `fact_check` は定義済みだが、呼び出しコード未実装
- [x] **4.4** 議論サマリー機能（`summary`）
  - チャット画面の「AI 議論サマリー」ボタンから実行
- [x] **4.5** 建設的フィードバック(投稿時の事前モデレーション)
  - 感情攻撃(0-10) / 論理構成(0-10) を採点し、閾値超で投稿を却下
  - 却下時は理由と修正案をユーザーに返す + `ai_moderations` に `rejection` として記録
- [x] **4.6** AIモデレーションの表示 UI
  - タイムラインに `AiCard`(紫カード)を時系列統合

**完了条件**: AIが議論を分析し、要約・指摘を表示できる → ✅ 達成(ファクトチェックを除く)

---

## Phase 5: ユーザー体験の向上 — 🔴 ほぼ未着手

使いやすさと見た目を磨き、プラットフォームとしての完成度を上げる。

- [x] **5.1** ユーザープロフィールページ(参加履歴表示)
  - 統計(勝率・投票獲得数など)は未実装
- [ ] **5.2** 議論スコアリングシステム（説得力・論理性の評価）
  - 投稿時の採点は既にあるが、ユーザー単位の蓄積・表示がない
- [ ] **5.3** 通知機能（返信・投票通知）
- [ ] **5.4** レスポンシブデザインの最適化(モバイル動作確認)
- [x] **5.5** ダークモード対応(Tailwind の `dark:` で一貫実装済み)
- [ ] **5.6** ローディング・エラーステートの整備
  - `useActionState` ベースのエラー表示は認証フォームに存在
  - ルーム/投稿/AI 分析の loading スケルトン等は未整備
- [ ] **5.7** OGP / メタデータ設定(SNSシェア対応)
  - `layout.tsx` の基本メタデータのみ。OG 画像等は未設定

---

## Phase 6: デプロイ + 公開準備 — 🔴 未着手

- [ ] **6.1** Vercel へのデプロイ設定
- [ ] **6.2** 環境変数の本番設定
- [ ] **6.3** Supabase RLS ポリシーの最終確認
  - `ai_moderations` の INSERT が `with check (true)` のまま。Service Role 経由に絞るべきか要検討
- [ ] **6.4** パフォーマンス最適化（画像・バンドルサイズ）
- [ ] **6.5** E2Eテスト
- [ ] **6.6** ランディングページの作成
  - `/` がランディング兼ルーム一覧。独立したLPにするかは未決

---

## データベーススキーマ（実装反映版）

```
profiles
├── id (uuid, PK, FK → auth.users)
├── username (text, unique, NOT NULL)
├── display_name (text)
├── avatar_url (text)
└── created_at (timestamptz)

rooms
├── id (uuid, PK)
├── title (text, NOT NULL)   -- 元投稿の OGP タイトル
├── description (text)
├── category (text, default 'other')
├── status (text: open|active|closed, default 'open')
├── source_url (text)        -- 起点となった SNS 投稿 URL
├── created_by (uuid, FK → profiles)
├── time_limit (int)         -- 分、0 = 無制限 (※未活用)
├── created_at (timestamptz)
└── closed_at (timestamptz)

arguments
├── id (uuid, PK)
├── room_id (uuid, FK → rooms)
├── user_id (uuid, FK → profiles)
├── stance (for|against)
├── content (text)
├── evidence_url (text, NOT NULL)
├── evidence_title (text)           -- OGP 自動取得(003で追加)
├── evidence_description (text)
├── parent_id (uuid, FK → arguments) -- ※スレッドUI未実装
├── created_at (timestamptz)
└── vote_count (int, default 0)      -- ※投票UI未実装

votes
├── id (uuid, PK)
├── argument_id (uuid, FK → arguments)
├── user_id (uuid, FK → profiles)
├── value (int: 1 or -1)
├── created_at (timestamptz)
└── UNIQUE(argument_id, user_id)

ai_moderations
├── id (uuid, PK)
├── room_id (uuid, FK → rooms)
├── type (summary | fact_check | feedback | topic_analysis | rejection)
├── content (text)
├── suggestion (text)        -- 却下時の修正案
├── triggered_by (uuid, FK → arguments)
└── created_at (timestamptz)
```

---

## 次のマイルストーン候補（優先度順の私見）

1. **Phase 3.4 投票機能** — DB スキーマは揃っているので UI だけで閉じる。議論の質評価の土台になる
2. **Phase 4.3 ファクトチェック** — AI の魅力を伸ばす主要機能。`analyze` route に type を追加する形で拡張可能
3. **Phase 2.4 ステータス自動遷移** — `time_limit` を使った closed 自動化
4. **Phase 6.1-6.3 デプロイ** — 公開して触ってもらえる状態にする
5. **Phase 3.6 スレッド / 2.5 フィルタ / 5.x UX 系** — 上記が片付いた後

## 開発の進め方

1. **Phase ごとに進める** — 完了条件を満たしてから次へ
2. **動くものを優先** — 最小限の実装で動作確認してから機能を追加
3. **Git コミット** — 機能単位でこまめにコミット(現在は未コミットの初期スナップショット状態)
4. **この計画は生きたドキュメント** — 進捗に応じてチェックボックスを更新する
