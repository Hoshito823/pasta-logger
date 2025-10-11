# 調理工程記録システム - データベーススキーマ

## 既存テーブルの拡張

### pasta_kinds テーブル
茹で時間とソース開始リードタイムのフィールドを追加：

```sql
ALTER TABLE pasta_kinds
ADD COLUMN boil_time_seconds INTEGER,
ADD COLUMN ideal_sauce_lead_time_seconds INTEGER;
```

## 新規テーブル

### 1. cooking_sessions テーブル
調理セッション全体の情報を管理

```sql
CREATE TABLE cooking_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  pasta_id UUID REFERENCES pasta_kinds(id),
  recipe_id UUID REFERENCES recipes(id),
  preset_boil_time_seconds INTEGER, -- 開始時に設定した茹で時間
  preset_sauce_lead_time_seconds INTEGER, -- 開始時に設定したソース開始時間
  status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT
);
```

### 2. cooking_process_logs テーブル
各調理工程の記録

```sql
CREATE TABLE cooking_process_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cooking_session_id UUID NOT NULL REFERENCES cooking_sessions(id) ON DELETE CASCADE,
  process_type VARCHAR(20) NOT NULL CHECK (process_type IN (
    'sauce_start',    -- ソース開始
    'pasta_start',    -- 麺投入
    'pasta_finish',   -- 麺ゆで上がり（自動記録）
    'sauce_finish',   -- ソース完成
    'combine_start',  -- 合わせ開始
    'completion'      -- 完成
  )),
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  is_auto_recorded BOOLEAN DEFAULT FALSE, -- 自動記録かどうか
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT
);
```

## インデックス

```sql
CREATE INDEX idx_cooking_sessions_user_id ON cooking_sessions(user_id);
CREATE INDEX idx_cooking_sessions_created_at ON cooking_sessions(created_at);
CREATE INDEX idx_cooking_process_logs_session_id ON cooking_process_logs(cooking_session_id);
CREATE INDEX idx_cooking_process_logs_timestamp ON cooking_process_logs(timestamp);
```

## RLS (Row Level Security) ポリシー

```sql
-- cooking_sessions
ALTER TABLE cooking_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own cooking sessions" ON cooking_sessions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own cooking sessions" ON cooking_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own cooking sessions" ON cooking_sessions
  FOR UPDATE USING (auth.uid() = user_id);

-- cooking_process_logs
ALTER TABLE cooking_process_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own cooking process logs" ON cooking_process_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM cooking_sessions
      WHERE cooking_sessions.id = cooking_process_logs.cooking_session_id
      AND cooking_sessions.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can insert their own cooking process logs" ON cooking_process_logs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM cooking_sessions
      WHERE cooking_sessions.id = cooking_process_logs.cooking_session_id
      AND cooking_sessions.user_id = auth.uid()
    )
  );
```

## 分析用ビュー

調理時間の分析用のビューも作成：

```sql
CREATE VIEW cooking_session_analysis AS
SELECT
  cs.id,
  cs.user_id,
  cs.pasta_id,
  cs.recipe_id,
  cs.preset_boil_time_seconds,
  cs.preset_sauce_lead_time_seconds,
  cs.created_at,
  cs.completed_at,

  -- 各工程の時間を抽出
  sauce_start.timestamp AS sauce_start_time,
  pasta_start.timestamp AS pasta_start_time,
  pasta_finish.timestamp AS pasta_finish_time,
  sauce_finish.timestamp AS sauce_finish_time,
  combine_start.timestamp AS combine_start_time,
  completion.timestamp AS completion_time,

  -- 時間差分析
  EXTRACT(EPOCH FROM (sauce_finish.timestamp - pasta_finish.timestamp)) AS sauce_wait_seconds,
  EXTRACT(EPOCH FROM (pasta_finish.timestamp - combine_start.timestamp)) AS pasta_wait_seconds,
  EXTRACT(EPOCH FROM (pasta_start.timestamp - sauce_finish.timestamp)) AS sauce_delay_seconds,
  EXTRACT(EPOCH FROM (combine_start.timestamp - completion.timestamp)) AS combine_duration_seconds,
  EXTRACT(EPOCH FROM (completion.timestamp - sauce_start.timestamp)) AS total_cooking_seconds

FROM cooking_sessions cs
LEFT JOIN cooking_process_logs sauce_start ON cs.id = sauce_start.cooking_session_id AND sauce_start.process_type = 'sauce_start'
LEFT JOIN cooking_process_logs pasta_start ON cs.id = pasta_start.cooking_session_id AND pasta_start.process_type = 'pasta_start'
LEFT JOIN cooking_process_logs pasta_finish ON cs.id = pasta_finish.cooking_session_id AND pasta_finish.process_type = 'pasta_finish'
LEFT JOIN cooking_process_logs sauce_finish ON cs.id = sauce_finish.cooking_session_id AND sauce_finish.process_type = 'sauce_finish'
LEFT JOIN cooking_process_logs combine_start ON cs.id = combine_start.cooking_session_id AND combine_start.process_type = 'combine_start'
LEFT JOIN cooking_process_logs completion ON cs.id = completion.cooking_session_id AND completion.process_type = 'completion';
```