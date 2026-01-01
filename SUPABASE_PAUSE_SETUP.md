# Supabase Pause 対応セットアップガイド

このドキュメントでは、Supabase Free プランの自動 Pause 問題に対応するための設定について説明します。

## 実装内容

### 1. エラー検知機能

**ファイル:** `src/supabaseConfig.js`

- Supabase の接続エラーを検知する関数を実装
- Pause を示すエラーパターンを判定
  - `fetch failed`, `503`, `network error` など
- Dashboard URL を自動生成

### 2. UI 通知コンポーネント

**ファイル:** `src/pauseNotification.js`

データベースが停止していると判断された場合、以下の UI を表示します：

- エラーメッセージ
- Supabase Dashboard へのリンクボタン
- ワンクリックで Dashboard を開いて手動で Resume 可能

### 3. フロントエンドのエラーハンドリング

以下のファイルを更新しました：

- `index.html` - メインページの履歴表示
- `src/manage.js` - 管理画面の統計データ
- `src/logList.js` - 記録一覧ページ

すべての Supabase クエリでエラーチェックを実装し、Pause 検知時に適切な UI を表示します。

### 4. GitHub Actions Keep Alive

**ファイル:** `.github/workflows/keep-alive.yml`

毎日 1 回、Supabase REST API に軽量なクエリを送信して、データベースの自動停止を防ぎます。

**スケジュール:** 毎日 03:00 UTC（日本時間 12:00）

## セットアップ手順

### 1. GitHub Secrets の設定

GitHub リポジトリに以下の Secrets を追加してください：

1. GitHub リポジトリページを開く
2. **Settings** → **Secrets and variables** → **Actions** へ移動
3. **New repository secret** をクリック
4. 以下の 2 つの Secrets を追加：

   - **Name:** `VITE_SUPABASE_URL`
     - **Value:** あなたの Supabase Project URL
     - 例: `https://xxxxxxxxxxxxx.supabase.co`

   - **Name:** `VITE_SUPABASE_ANON_KEY`
     - **Value:** あなたの Supabase Anon/Public Key

### 2. Supabase Dashboard URL の確認

`src/supabaseConfig.js` を開いて、Dashboard URL が正しく生成されているか確認してください。

環境変数から自動的にプロジェクト参照を抽出していますが、うまくいかない場合は手動で設定できます：

```javascript
export const SUPABASE_DASHBOARD_URL = 'https://supabase.com/dashboard/project/YOUR_PROJECT_REF'
```

### 3. GitHub Actions の有効化

1. GitHub リポジトリの **Actions** タブを開く
2. ワークフローが表示されることを確認
3. 手動でテスト実行する場合：
   - **Supabase Keep Alive** ワークフローを選択
   - **Run workflow** ボタンをクリック

### 4. 動作確認

#### フロントエンドのテスト

1. 開発環境で `npm run dev` を実行
2. データが正常に表示されることを確認
3. （オプション）Supabase Dashboard でデータベースを一時停止して、エラー UI が表示されることを確認

#### GitHub Actions のテスト

1. **Actions** タブで最新の実行結果を確認
2. 成功していれば緑色のチェックマークが表示されます
3. ログを確認して `✅ Keep-alive ping successful` が表示されていることを確認

## トラブルシューティング

### GitHub Actions が失敗する場合

- Secrets が正しく設定されているか確認
- Supabase の RLS (Row Level Security) 設定を確認
  - `pasta_logs` テーブルに対して匿名読み取りが許可されているか
- Supabase プロジェクトが手動で停止されていないか確認

### エラー UI が表示されない場合

1. ブラウザの開発者ツールを開く
2. Console でエラーメッセージを確認
3. Network タブで Supabase への通信が失敗しているか確認

### Dashboard URL が正しくない場合

`src/supabaseConfig.js` の `SUPABASE_DASHBOARD_URL` を手動で修正してください。

## 注意事項

- **認証は不要:** Keep Alive は匿名アクセスで実行されます
- **RLS 設計は変更不要:** 既存のセキュリティ設定をそのまま維持
- **完全自動 Resume は不可能:** Pause された場合は手動で Dashboard から再開が必要
- **個人利用前提:** UI は最小限のデザインです

## 効果

- ✅ Pause 状態を自動検知
- ✅ ユーザーに分かりやすいエラー表示
- ✅ ワンクリックで Dashboard へアクセス
- ✅ 毎日の Keep Alive で自動停止を予防

これにより、Supabase Free プランでも安定した運用が可能になります。
