-- Migration: パスタのグラム数と水量カラムを追加
-- 実行日: 2026-04-04

-- pasta_logsテーブルにパスタのグラム数と水量カラムを追加
ALTER TABLE pasta_logs
ADD COLUMN IF NOT EXISTS pasta_amount_g INTEGER,
ADD COLUMN IF NOT EXISTS water_amount_l DECIMAL(3,1);

-- 確認用コメント
COMMENT ON COLUMN pasta_logs.pasta_amount_g IS 'パスタのグラム数 (g)';
COMMENT ON COLUMN pasta_logs.water_amount_l IS '水量 (L)';

-- 完了メッセージ
SELECT 'パスタグラム数と水量カラムの追加が完了しました' as message;
