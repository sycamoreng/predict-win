export interface Campaign {
  id: string
  name: string
  slug: string
  competition_type: 'tournament' | 'league'
  api_football_league_id: number | null
  api_football_season: number | null
  is_active: boolean
  predictions_enabled: boolean
  leaderboard_enabled: boolean
  team_picking_enabled: boolean
  public_access_enabled: boolean
  require_eligibility_leaderboard: boolean
  require_eligibility_chips: boolean
  registration_open: boolean
  campaign_ended: boolean
  prediction_lock_minutes: number
  week_start_date: string | null
  scoring_exact_ft: number
  scoring_exact_aet: number
  scoring_exact_pen: number
  scoring_result: number
  scoring_first_to_score: number
  has_knockout_stages: boolean
  has_groups: boolean
  h2h_weekly_limit: number
  starts_at: string | null
  ends_at: string | null
}

const DEFAULT_CAMPAIGN: Campaign = {
  id: '',
  name: 'Predictor League',
  slug: '',
  competition_type: 'tournament',
  api_football_league_id: null,
  api_football_season: null,
  is_active: false,
  predictions_enabled: false,
  leaderboard_enabled: false,
  team_picking_enabled: false,
  public_access_enabled: false,
  require_eligibility_leaderboard: true,
  require_eligibility_chips: true,
  registration_open: false,
  campaign_ended: false,
  prediction_lock_minutes: 60,
  week_start_date: null,
  scoring_exact_ft: 15,
  scoring_exact_aet: 20,
  scoring_exact_pen: 25,
  scoring_result: 5,
  scoring_first_to_score: 10,
  has_knockout_stages: true,
  has_groups: true,
  h2h_weekly_limit: 0,
  starts_at: null,
  ends_at: null,
}

export const useCampaign = () => {
  const config = useState<Campaign>('campaign-config', () => DEFAULT_CAMPAIGN)
  const loaded = useState<boolean>('campaign-loaded', () => false)

  const load = async () => {
    if (loaded.value) return
    const supabase = useSupabase()
    const { data } = await supabase
      .from('campaigns')
      .select('*')
      .eq('is_active', true)
      .maybeSingle()
    if (data) {
      config.value = data as Campaign
    }
    loaded.value = true
  }

  const refresh = async () => {
    loaded.value = false
    await load()
  }

  const isLeague = computed(() => config.value.competition_type === 'league')
  const isTournament = computed(() => config.value.competition_type === 'tournament')
  const campaignId = computed(() => config.value.id)

  // The game counts as "live" once we open public access, or once the Premier
  // League season kicks off (21 Aug 2026). Before either, the site should read
  // as "coming soon" rather than claiming the campaign is live.
  const TOURNAMENT_KICKOFF = new Date('2026-08-21T00:00:00Z').getTime()
  const isLive = computed(() => {
    if (config.value.public_access_enabled) return true
    const start = config.value.starts_at ? new Date(config.value.starts_at).getTime() : TOURNAMENT_KICKOFF
    return Date.now() >= start
  })

  return { config, load, refresh, isLeague, isTournament, campaignId, isLive }
}
