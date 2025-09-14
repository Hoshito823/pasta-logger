-- レシピ参考欄をpasta_logsテーブルに追加
-- 参考にしたレシピのURL、書籍名、動画リンクなどを記録するためのカラム

ALTER TABLE pasta_logs 
ADD COLUMN recipe_reference TEXT;

-- カラムにコメントを追加
COMMENT ON COLUMN pasta_logs.recipe_reference IS '参考にしたレシピのURL、書籍名、動画リンクなど';