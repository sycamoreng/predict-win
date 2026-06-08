-- Tracks per-user sweep outcomes. Created as "pending" by sweep-trigger,
-- updated to "completed" or "failed" by the core-sync/sweep-result callback.
CREATE TABLE IF NOT EXISTS sweep_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES synced_users(id),
  account_number TEXT NOT NULL,
  match_id UUID REFERENCES matches(id),
  winning_team_id UUID REFERENCES teams(id),
  amount INTEGER NOT NULL,
  duration INTEGER NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create', 'topup')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  failure_reason TEXT,
  core_reference TEXT,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sweep_results_status ON sweep_results(status);
CREATE INDEX idx_sweep_results_user_id ON sweep_results(user_id);
CREATE INDEX idx_sweep_results_match_id ON sweep_results(match_id);

ALTER TABLE sweep_results ENABLE ROW LEVEL SECURITY;

-- Only service_role can read/write (edge functions use service_role key)
CREATE POLICY "service_role_all" ON sweep_results
  FOR ALL TO service_role USING (true) WITH CHECK (true);
