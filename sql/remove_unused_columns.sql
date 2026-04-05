-- Migration: 不要になったカラムを削除
-- 実行日: 2026-04-04
-- 理由: 調理工程記録機能とカテゴリ機能を削除したため

-- pasta_logsテーブルから調理工程記録関連のカラムを削除
ALTER TABLE pasta_logs
DROP COLUMN IF EXISTS cooking_process_times,
DROP COLUMN IF EXISTS cooking_start_time,
DROP COLUMN IF EXISTS cooking_total_seconds;

-- pasta_logsテーブルからカテゴリ関連のカラムを削除
ALTER TABLE pasta_logs
DROP COLUMN IF EXISTS recipe_id;

-- 完了メッセージ
SELECT '不要なカラムの削除が完了しました' as message;
