-- Pasta Logger - データベースセットアップ SQL
-- 既存のpasta_logsテーブルに調理工程時間フィールドを追加

-- 1. pasta_logsテーブルに調理工程時間フィールドを追加
ALTER TABLE pasta_logs
ADD COLUMN IF NOT EXISTS cooking_process_times JSONB,
ADD COLUMN IF NOT EXISTS cooking_start_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS cooking_total_seconds INTEGER;

-- 2. 基本テーブルが存在しない場合の作成（参考）

-- recipesテーブル（カテゴリ）
CREATE TABLE IF NOT EXISTS recipes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- pasta_kindsテーブル（パスタの種類）
CREATE TABLE IF NOT EXISTS pasta_kinds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand VARCHAR(255),
  thickness_mm DECIMAL(3,1),
  purchase_location VARCHAR(255),
  image_path VARCHAR(500),
  image_url VARCHAR(500),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- cheesesテーブル（チーズの種類）
CREATE TABLE IF NOT EXISTS cheeses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  image_path VARCHAR(500),
  image_url VARCHAR(500),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- pasta_logsテーブル（メイン）
CREATE TABLE IF NOT EXISTS pasta_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  recipe_id UUID REFERENCES recipes(id),
  pasta_kind_id UUID REFERENCES pasta_kinds(id),
  cheese_kind_ids UUID[],
  boil_start_ts TIMESTAMP WITH TIME ZONE,
  up_ts TIMESTAMP WITH TIME ZONE,
  combine_end_ts TIMESTAMP WITH TIME ZONE,
  boil_salt_pct DECIMAL(5,2),
  ladle_half_units DECIMAL(3,1),
  photo_path VARCHAR(500),
  photo_url VARCHAR(500),
  rating_core JSONB,
  feedback_text TEXT,
  recipe_reference VARCHAR(500),
  taken_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- 新しく追加された調理工程時間フィールド
  cooking_process_times JSONB,
  cooking_start_time TIMESTAMP WITH TIME ZONE,
  cooking_total_seconds INTEGER
);

-- 3. Row Level Security (RLS) ポリシーの設定

-- recipesテーブルのRLS
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;

-- 認証済みユーザーは全ての recipes を読み取り可能
CREATE POLICY IF NOT EXISTS "Allow authenticated users to read recipes"
ON recipes FOR SELECT
TO authenticated
USING (true);

-- pasta_kindsテーブルのRLS
ALTER TABLE pasta_kinds ENABLE ROW LEVEL SECURITY;

-- 認証済みユーザーは全ての pasta_kinds を読み取り可能
CREATE POLICY IF NOT EXISTS "Allow authenticated users to read pasta_kinds"
ON pasta_kinds FOR SELECT
TO authenticated
USING (true);

-- 認証済みユーザーは pasta_kinds を作成・更新・削除可能
CREATE POLICY IF NOT EXISTS "Allow authenticated users to manage pasta_kinds"
ON pasta_kinds FOR ALL
TO authenticated
USING (true);

-- cheesesテーブルのRLS
ALTER TABLE cheeses ENABLE ROW LEVEL SECURITY;

-- 認証済みユーザーは全ての cheeses を読み取り可能
CREATE POLICY IF NOT EXISTS "Allow authenticated users to read cheeses"
ON cheeses FOR SELECT
TO authenticated
USING (true);

-- pasta_logsテーブルのRLS
ALTER TABLE pasta_logs ENABLE ROW LEVEL SECURITY;

-- ユーザーは自分の pasta_logs のみアクセス可能
CREATE POLICY IF NOT EXISTS "Users can manage their own pasta_logs"
ON pasta_logs FOR ALL
TO authenticated
USING (auth.uid() = user_id);

-- 4. 初期データの挿入（サンプル）

-- サンプルレシピ
INSERT INTO recipes (name, description) VALUES
('ペペロンチーノ', 'シンプルなガーリックオイルパスタ'),
('カルボナーラ', '卵とチーズのクリーミーパスタ'),
('アラビアータ', '辛いトマトソースパスタ'),
('ボロネーゼ', '肉入りトマトソースパスタ')
ON CONFLICT DO NOTHING;

-- サンプルチーズ
INSERT INTO cheeses (name) VALUES
('パルミジャーノ・レッジャーノ'),
('ペコリーノ・ロマーノ'),
('グラナ・パダーノ'),
('モッツァレラ'),
('ゴルゴンゾーラ')
ON CONFLICT DO NOTHING;

-- 5. インデックスの作成（パフォーマンス向上）

-- pasta_logsテーブルのインデックス
CREATE INDEX IF NOT EXISTS idx_pasta_logs_user_id ON pasta_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_pasta_logs_taken_at ON pasta_logs(taken_at);
CREATE INDEX IF NOT EXISTS idx_pasta_logs_cooking_start_time ON pasta_logs(cooking_start_time);

-- pasta_kindsテーブルのインデックス
CREATE INDEX IF NOT EXISTS idx_pasta_kinds_is_active ON pasta_kinds(is_active);
CREATE INDEX IF NOT EXISTS idx_pasta_kinds_brand ON pasta_kinds(brand);

-- 6. ストレージバケットの作成（画像用）

-- pasta-photosバケット
INSERT INTO storage.buckets (id, name, public)
VALUES ('pasta-photos', 'pasta-photos', true)
ON CONFLICT (id) DO NOTHING;

-- pasta-imagesバケット（パスタ種類・チーズ画像用）
INSERT INTO storage.buckets (id, name, public)
VALUES ('pasta-images', 'pasta-images', true)
ON CONFLICT (id) DO NOTHING;

-- ストレージポリシー
-- 認証済みユーザーは pasta-photos バケットにアップロード可能
CREATE POLICY IF NOT EXISTS "Allow authenticated users to upload pasta photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'pasta-photos');

-- 認証済みユーザーは pasta-images バケットにアップロード可能
CREATE POLICY IF NOT EXISTS "Allow authenticated users to upload pasta images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'pasta-images');

-- 全員が pasta-photos を読み取り可能
CREATE POLICY IF NOT EXISTS "Allow public read for pasta photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'pasta-photos');

-- 全員が pasta-images を読み取り可能
CREATE POLICY IF NOT EXISTS "Allow public read for pasta images"
ON storage.objects FOR SELECT
USING (bucket_id = 'pasta-images');

-- 完了メッセージ
SELECT 'Pasta Logger データベースセットアップ完了！' as message;