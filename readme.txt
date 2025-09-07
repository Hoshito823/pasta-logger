Pasta Logger (MVP)

シンプルなパスタ研究・記録アプリ。
写真・カテゴリ（レシピ）・麺・チーズ・タイムスタンプ・評価・メモを記録し、履歴から振り返れます。

フロント：Vite + JavaScript + Tailwind CSS

BaaS：Supabase（Auth / Database / Storage）

認証：Magic Link（メール）

データ保護：**RLS（Row Level Security）**で「自分の行だけ」アクセス

目次

機能

技術スタック

ディレクトリ構成

前提条件

セットアップ (開発)

Supabase 設定手順

スキーマ概要

開発コマンド

デプロイ（Vercel想定）

よくあるハマりどころ

ライセンス

機能

Magic Link でログイン / ログアウト

新規記録：写真アップロード（JPEG/PNG/WebP）、カテゴリ/麺/チーズ選択、B/U/C タイムスタンプ、評価（総合・堅さ・塩味）、メモ

履歴一覧：★順＋カテゴリで絞り込み、写真サムネイル表示

詳細：記録の詳細表示・削除（写真があれば同時削除）

技術スタック

フロント：Vite、Vanilla JS、Tailwind CSS

BaaS：Supabase

Auth（メール OTP / Magic Link）

Postgres（RLS 有効）

Storage（pasta-photos バケット）

開発補助（任意）：VS Code / Cursor + Claude Code（差分適用の自動編集）

ディレクトリ構成
.
├─ index.html            # ようこそ（ログイン確認）
├─ log-new.html          # 新規記録フォーム
├─ log-list.html         # 履歴（カテゴリ/★順）
├─ log-detail.html       # 詳細（表示・削除）
├─ public/               # 静的アセット（必要に応じて）
├─ src/
│  ├─ supa.js            # Supabase クライアント・セッション取得
│  ├─ auth.js            # ログイン/ログアウトUI
│  ├─ logNew.js          # 新規記録の保存＆写真アップロード
│  ├─ logList.js         # 一覧読み込み・表示
│  ├─ logDetail.js       # 詳細表示・削除
│  └─ style.css          # Tailwind ベースのスタイル
├─ package.json
├─ vite.config.js
├─ postcss.config.js
├─ tailwind.config.js
└─ .env                  # VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY

前提条件

Node.js v20 以上（推奨：nvm で v20 LTS）

Supabase プロジェクト（Free でOK）

（WSL 推奨）VS Code で Remote – WSL を利用

セットアップ (開発)

依存をインストール

npm install


.env を作成（プロジェクト直下）

VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxxxxxxxxxxxxxxxxxxxxxxx


開発サーバ

npm run dev
# http://localhost:5173 で確認

Supabase 設定手順

Auth

「Authentication → Sign in / Providers」：Email を Enable

「URL Configuration」：Site URL を http://localhost:5173 に設定
（Magic Link のリダイレクト先にも使われます）

Storage

バケット名：pasta-photos（Public ON）

※MVPは Public 読み取り運用。将来 Private にする場合は署名URLへ切替。

Database / RLS / トリガー

SQL Editor でスキーマを適用（下記「スキーマ概要」参照）

各テーブルに RLS 有効化 & **「自分の行だけ」**ポリシー

set_user_id トリガーで INSERT 時に user_id を自動付与

Storage 書き込みポリシー（必須）
storage.objects に「自分の {userId}/... のみ書込可」のポリシーを作成：

-- 既存があれば削除
drop policy if exists obj_insert_own on storage.objects;
drop policy if exists obj_update_own on storage.objects;
drop policy if exists obj_delete_own on storage.objects;

-- insert/update/delete を自分のフォルダ限定に
create policy obj_insert_own on storage.objects
for insert to authenticated
with check (
  bucket_id = 'pasta-photos'
  and split_part(name, '/', 1) = auth.uid()::text
);

create policy obj_update_own on storage.objects
for update to authenticated
using (
  bucket_id = 'pasta-photos'
  and split_part(name, '/', 1) = auth.uid()::text
);

create policy obj_delete_own on storage.objects
for delete to authenticated
using (
  bucket_id = 'pasta-photos'
  and split_part(name, '/', 1) = auth.uid()::text
);

スキーマ概要

すでに適用済みなら読み飛ばし可。未適用なら SQL Editor で実行してください。

テーブル

recipes（カテゴリ）

pasta_kinds（麺）

cheeses（チーズ）

pasta_logs（記録本体）

ポイント

全テーブルに user_id uuid not null（auth.users(id) 参照）

RLS：auth.uid() = user_id の行だけ参照/書込可

トリガー：set_user_id() で INSERT 時に user_id を自動補完

インデックス：pasta_logs に user_id,taken_at、overall など

（※詳細DDLは省略。プロジェクト内で運用中のSQLをそのまま使ってOK）

開発コマンド
# 起動
npm run dev

# 本番ビルド
npm run build

# ビルド結果のプレビュー
npm run preview

デプロイ（Vercel想定）

GitHub にプッシュ → Vercel で Import Project

Vercel の Environment Variables に .env の値を設定

VITE_SUPABASE_URL

VITE_SUPABASE_ANON_KEY

Supabase の URL Configuration に本番 URL を追加（Redirect / Site URL）

デプロイ後に Magic Link が本番 URL に戻ることを確認

よくあるハマりどころ

画像が出ない

バケット pasta-photos が Public ON か確認

photo_path が {userId}/... 形式か（書込ポリシーに一致）

403/権限エラー

ログイン済みか / RLS の *_owner ポリシーがあるか

Auth の Site URL が http://localhost:5173

Magic Link が無効

メールのリンク先ドメインと Site URL が一致しているか

Vite が起動しない / エラー

Node v20+ / 依存の再インストール（rm -rf node_modules && npm i）

WSL で遅い / 権限

プロジェクトは /home/... 配下に置く（/mnt/c 直下は遅くなりがち）

ライセンス

個人利用用（MVP）。必要に応じて任意の OSS ライセンスを追加してください。

メモ（開発時の便利Tips）

画像アップロードは JPEG/PNG/WebP を許可（フロントで MIME/サイズチェック推奨）

Private 運用に切り替える場合は、一覧/詳細で createSignedUrl を使用

VS Code / Cursor + Claude Code を使うと、差分パッチで画面追加・リファクタが高速化

依頼は「目的＋対象ファイル＋制約（最小差分/既存スタイル）」を明記

適用前に diff を必ず確認、秘密鍵は送らない