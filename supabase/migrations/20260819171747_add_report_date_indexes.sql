/*
# Add indexes for report date aggregations

1. Purpose
The admin daily reports group large tables by signup / prediction date. These
indexes let those groupings use an index range scan instead of scanning the
whole table each time a report panel is opened, reducing the load a report run
puts on the database.

2. New Indexes
- `idx_cp_campaign_joined` on campaign_participants (campaign_id, joined_at)
  — speeds the campaign-scoped daily signups chart.
- `idx_synced_users_created_at` on synced_users (created_at)
  — speeds the platform-wide daily signups chart.
- `idx_predictions_campaign_created` on predictions (campaign_id, created_at)
  — speeds the campaign-scoped daily predictions chart.

3. Security
- None. Indexes do not change access rules or query results, only speed.

4. Notes
1. All use IF NOT EXISTS and are safe to re-run.
2. No data is modified.
*/

CREATE INDEX IF NOT EXISTS idx_cp_campaign_joined
  ON public.campaign_participants (campaign_id, joined_at);

CREATE INDEX IF NOT EXISTS idx_synced_users_created_at
  ON public.synced_users (created_at);

CREATE INDEX IF NOT EXISTS idx_predictions_campaign_created
  ON public.predictions (campaign_id, created_at);
