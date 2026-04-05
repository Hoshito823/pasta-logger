-- Migration: レストラン記録機能の追加
-- 実行日: 2026-04-05
-- 目的: 「食べる」機能として、レストランで食べたパスタを記録する

-- 1. restaurant_logsテーブルの作成
CREATE TABLE IF NOT EXISTS restaurant_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  restaurant_name VARCHAR(255) NOT NULL,
  dish_name VARCHAR(255) NOT NULL,
  visited_at DATE NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  revisit_desire INTEGER CHECK (revisit_desire >= 1 AND revisit_desire <= 5),
  google_maps_url VARCHAR(500),
  next_menu_to_try TEXT,
  memo TEXT,
  photo_path VARCHAR(500),
  photo_url VARCHAR(500),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- カラムのコメント
COMMENT ON TABLE restaurant_logs IS 'レストランで食べたパスタの記録';
COMMENT ON COLUMN restaurant_logs.user_id IS 'ユーザーID';
COMMENT ON COLUMN restaurant_logs.restaurant_name IS '店名';
COMMENT ON COLUMN restaurant_logs.dish_name IS '料理名';
COMMENT ON COLUMN restaurant_logs.visited_at IS '訪問日';
COMMENT ON COLUMN restaurant_logs.rating IS '評価（5段階）';
COMMENT ON COLUMN restaurant_logs.revisit_desire IS 'また行きたい度（5段階）';
COMMENT ON COLUMN restaurant_logs.google_maps_url IS 'Google Maps URL';
COMMENT ON COLUMN restaurant_logs.next_menu_to_try IS '次回試したいメニュー';
COMMENT ON COLUMN restaurant_logs.memo IS 'メモ・感想';
COMMENT ON COLUMN restaurant_logs.photo_path IS '写真パス';
COMMENT ON COLUMN restaurant_logs.photo_url IS '写真URL';

-- 2. Row Level Security (RLS) ポリシーの設定
ALTER TABLE restaurant_logs ENABLE ROW LEVEL SECURITY;

-- ユーザーは自分のrestaurant_logsのみアクセス可能
CREATE POLICY IF NOT EXISTS "Users can manage their own restaurant_logs"
ON restaurant_logs FOR ALL
TO authenticated
USING (auth.uid() = user_id);

-- 3. インデックスの作成（パフォーマンス向上）
CREATE INDEX IF NOT EXISTS idx_restaurant_logs_user_id ON restaurant_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_logs_visited_at ON restaurant_logs(visited_at);
CREATE INDEX IF NOT EXISTS idx_restaurant_logs_revisit_desire ON restaurant_logs(revisit_desire);
CREATE INDEX IF NOT EXISTS idx_restaurant_logs_restaurant_name ON restaurant_logs(restaurant_name);

-- 4. updated_atを自動更新するトリガー関数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- トリガーの作成
CREATE TRIGGER update_restaurant_logs_updated_at
BEFORE UPDATE ON restaurant_logs
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 完了メッセージ
SELECT 'レストラン記録機能のスキーマ追加が完了しました' as message;
