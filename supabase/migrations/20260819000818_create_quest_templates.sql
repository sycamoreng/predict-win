/*
  # Create quest_templates (reusable side-quest pool)

  A curated bank of side-quest definitions admins build once. The weekly
  suggestion engine draws from this pool (in addition to the dynamic
  fixture-based quests) so admins get consistent, ready-made options every week.

  1. New table `quest_templates`
     - `id` uuid PK
     - `campaign_id` uuid null -> campaigns (null = applies to every campaign)
     - `quest_type` text (e.g. 'custom', 'player_to_score', 'player_pick')
     - `title` text (supports the {MW} placeholder -> matchweek number)
     - `description` text (also supports {MW})
     - `options` jsonb
     - `options_meta` jsonb
     - `point_value` int default 10
     - `active` bool default true (only active templates feed suggestions)
     - `sort_order` int default 0
     - timestamps

  2. Security
     - RLS enabled.
     - Public SELECT (definitions are not sensitive; the suggestion engine
       reads them with the service role regardless).
     - Writes restricted to authenticated; admins have no Supabase session, so
       all mutations go through the admin-gated side-quests edge function.
*/

CREATE TABLE IF NOT EXISTS quest_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES campaigns(id) ON DELETE CASCADE,
  quest_type text NOT NULL DEFAULT 'custom',
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  options_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  point_value integer NOT NULL DEFAULT 10,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quest_templates_campaign_active
  ON quest_templates(campaign_id, active);

ALTER TABLE quest_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_quest_templates" ON quest_templates;
CREATE POLICY "select_quest_templates" ON quest_templates FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_quest_templates" ON quest_templates;
CREATE POLICY "insert_quest_templates" ON quest_templates FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_quest_templates" ON quest_templates;
CREATE POLICY "update_quest_templates" ON quest_templates FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_quest_templates" ON quest_templates;
CREATE POLICY "delete_quest_templates" ON quest_templates FOR DELETE
  TO authenticated USING (true);
