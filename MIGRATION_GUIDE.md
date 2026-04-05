# パスタ記録アプリ改修 - マイグレーションガイド

## 概要
このガイドでは、パスタ記録アプリに「5大要素」「サブ要素」「香り要素」「具材」を追加する改修のマイグレーション手順を説明します。

## 改修内容のサマリー

### 追加された機能
1. **5大要素の記録**
   - トマト、にんにく、オリーブオイル、バター、パルミジャーノ
   - 各要素について「使ったか」と「どう使ったか」を記録

3. **サブ要素の記録**
   - 唐辛子オイル、アンチョビ、チーズ各種、生クリーム

4. **香り要素の記録**
   - イタリアンパセリ、バジル、ローズマリー、セージ、レモン、黒胡椒など

5. **具材の記録**
   - 旨味系具材（グアンチャーレ、パンチェッタなど）
   - その他具材（野菜、魚介など）

6. **評価スコアの拡張**
   - 麺の質、塩加減、ソース・食材のバランス、全体の完成度の4項目

## マイグレーション手順

### ステップ1: データベースのバックアップ（推奨）
Supabaseダッシュボードから現在のデータをエクスポートしてください。

### ステップ2: マイグレーションSQLの実行

以下のSQLファイルを順番に実行してください：

#### 2-1. 既存の未実行マイグレーション（必要に応じて）
```bash
# パスタのグラム数と水量を追加（すでに実行済みの場合はスキップ）
# sql/add_pasta_amount_and_water.sql

# 不要なカラムを削除（すでに実行済みの場合はスキップ）
# sql/remove_unused_columns.sql
```

#### 2-2. 新しい調理詳細スキーマの追加
```bash
# 5大要素、サブ要素、香り要素、具材のカラムを追加
sql/add_cooking_details_schema.sql
```

**実行方法:**
1. Supabaseダッシュボードにログイン
2. 左メニューから「SQL Editor」を選択
3. 「New Query」をクリック
4. `sql/add_cooking_details_schema.sql` の内容をコピー＆ペースト
5. 「Run」をクリックして実行
6. エラーがないことを確認

### ステップ3: アプリケーションコードのデプロイ

改修済みのファイル：
- `log-new.html` - 記録画面UI
- `src/logNew.js` - 記録画面ロジック
- その他のファイルは既存のまま

### ステップ4: 動作確認

以下の項目を確認してください：

1. **新規記録の作成**
   - 記録画面が正しく表示されるか
   - 5大要素のチェックボックスを選択すると詳細入力欄が表示されるか
   - サブ要素、香り要素、具材の入力ができるか
   - 評価スコアが4項目表示されるか
   - 保存が成功するか

2. **一覧画面の表示**
   - 既存の記録が正しく表示されるか
   - 新しく作成した記録が表示されるか

3. **データの互換性**
   - 古い記録（新フィールドがNULL）が正しく表示されるか
   - 新しい記録が正しく保存・表示されるか

## データ構造の詳細

### pasta_logs テーブルに追加されたカラム

| カラム名 | 型 | 説明 |
|---------|-----|------|
| `core_ingredients` | JSONB | 5大要素 |
| `sub_ingredients` | JSONB | サブ要素 |
| `aroma_ingredients` | JSONB | 香り要素 |
| `umami_ingredients` | TEXT[] | 旨味系具材 |
| `other_ingredients` | TEXT[] | その他具材 |

### rating_core の拡張

```json
{
  "overall": 4,              // 全体の完成度
  "pasta_quality": 4,        // 麺の質（新規）
  "salt_balance": 5,         // 塩加減（新規）
  "sauce_balance": 4         // ソース・食材のバランス（新規）
}
```

## トラブルシューティング

### エラー: カラムが既に存在する
```
ERROR: column "xxx" of relation "pasta_logs" already exists
```
→ このカラムは既に追加されています。問題ありません。

### エラー: 保存時に失敗する
- ブラウザのコンソールを開いてエラーメッセージを確認
- データベースのカラムが正しく追加されているか確認
- Supabaseの Row Level Security (RLS) ポリシーを確認

## ロールバック手順（問題が発生した場合）

```sql
-- 新しく追加したカラムを削除
ALTER TABLE pasta_logs
DROP COLUMN IF EXISTS core_ingredients,
DROP COLUMN IF EXISTS sub_ingredients,
DROP COLUMN IF EXISTS aroma_ingredients,
DROP COLUMN IF EXISTS umami_ingredients,
DROP COLUMN IF EXISTS other_ingredients;

-- インデックスを削除
DROP INDEX IF EXISTS idx_pasta_logs_core_ingredients;
DROP INDEX IF EXISTS idx_pasta_logs_sub_ingredients;
DROP INDEX IF EXISTS idx_pasta_logs_aroma_ingredients;
DROP INDEX IF EXISTS idx_pasta_logs_umami_ingredients;
DROP INDEX IF EXISTS idx_pasta_logs_other_ingredients;
```

その後、古いバージョンのアプリケーションコードをデプロイしてください。

## 今後の拡張について

### 分析・絞り込み機能（今回は未実装）
将来的に以下の機能を追加できます：
- 「にんにくをみじん切りにした記録」だけを表示
- 「グアンチャーレを使った記録」の平均評価を計算
- 「パルミジャーノをブロック削りにした回」と「パウダーにした回」の比較

これらの機能を実装する際は、既に追加されたインデックス（GINインデックス）により高速な検索が可能です。

## 質問・サポート
問題が発生した場合は、以下の情報を添えてお問い合わせください：
- ブラウザのコンソールログ
- Supabaseのエラーログ
- 実行したSQLとエラーメッセージ
