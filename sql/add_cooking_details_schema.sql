-- Migration: 調理詳細スキーマの追加
-- 実行日: 2026-04-05
-- 目的: パスタ記録に5大要素、サブ要素、香り要素、具材情報を追加し、分析可能にする

-- 1. pasta_kinds テーブルに麺の種類と推奨茹で時間を追加
ALTER TABLE pasta_kinds
ADD COLUMN IF NOT EXISTS pasta_type VARCHAR(100),
ADD COLUMN IF NOT EXISTS default_boil_time_seconds INTEGER;

COMMENT ON COLUMN pasta_kinds.pasta_type IS 'パスタの種類（スパゲッティ、リングイネ等）';
COMMENT ON COLUMN pasta_kinds.default_boil_time_seconds IS '推奨茹で時間（秒）';

-- 2. pasta_logs テーブルに新しい記録項目を追加
ALTER TABLE pasta_logs
ADD COLUMN IF NOT EXISTS core_ingredients JSONB,
ADD COLUMN IF NOT EXISTS sub_ingredients JSONB,
ADD COLUMN IF NOT EXISTS aroma_ingredients JSONB,
ADD COLUMN IF NOT EXISTS umami_ingredients TEXT[],
ADD COLUMN IF NOT EXISTS other_ingredients TEXT[];

COMMENT ON COLUMN pasta_logs.core_ingredients IS '5大要素（トマト、にんにく、オリーブオイル、バター、パルミジャーノ）';
COMMENT ON COLUMN pasta_logs.sub_ingredients IS 'サブ要素（唐辛子オイル、アンチョビ、チーズ、生クリーム等）';
COMMENT ON COLUMN pasta_logs.aroma_ingredients IS '香り要素（パセリ、バジル、ローズマリー等）';
COMMENT ON COLUMN pasta_logs.umami_ingredients IS '旨味系具材（グアンチャーレ、パンチェッタ等）';
COMMENT ON COLUMN pasta_logs.other_ingredients IS 'その他具材（野菜、魚介等）';

-- 3. インデックスの作成（検索・絞り込み用）
CREATE INDEX IF NOT EXISTS idx_pasta_logs_core_ingredients ON pasta_logs USING GIN (core_ingredients);
CREATE INDEX IF NOT EXISTS idx_pasta_logs_sub_ingredients ON pasta_logs USING GIN (sub_ingredients);
CREATE INDEX IF NOT EXISTS idx_pasta_logs_aroma_ingredients ON pasta_logs USING GIN (aroma_ingredients);
CREATE INDEX IF NOT EXISTS idx_pasta_logs_umami_ingredients ON pasta_logs USING GIN (umami_ingredients);
CREATE INDEX IF NOT EXISTS idx_pasta_logs_other_ingredients ON pasta_logs USING GIN (other_ingredients);

-- 4. JSONBスキーマの例（コメントとして記載）
-- core_ingredients の形式:
-- {
--   "pomodoro": {"used": true, "detail": "ホール缶"},
--   "aglio": {"used": true, "detail": "みじん切り"},
--   "olio": {"used": true, "detail": "両方"},
--   "burro": {"used": false, "detail": null},
--   "parmigiano": {"used": true, "detail": "ブロック削り"}
-- }

-- sub_ingredients の形式:
-- {
--   "chili_oil": {"used": true, "note": ""},
--   "anchovy": {"used": true, "note": "3枚使用"},
--   "cheeses": {"used": true, "items": ["ペコリーノ", "ゴルゴンゾーラ"]},
--   "cream": {"used": false, "note": null}
-- }

-- aroma_ingredients の形式:
-- {
--   "italian_parsley": true,
--   "basil": false,
--   "rosemary": false,
--   "sage": false,
--   "lemon": true,
--   "black_pepper": true,
--   "other": "オレガノ"
-- }

-- 完了メッセージ
SELECT '調理詳細スキーマの追加が完了しました' as message;
