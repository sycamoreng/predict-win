interface CampaignConfig {
  predictions_enabled: boolean
  leaderboard_enabled: boolean
  team_picking_enabled: boolean
  campaign_name: string
}

const DEFAULT_CONFIG: CampaignConfig = {
  predictions_enabled: false,
  leaderboard_enabled: false,
  team_picking_enabled: false,
  campaign_name: 'FIFA World Cup 2026',
}

export const useCampaign = () => {
  const config = useState<CampaignConfig>('campaign-config', () => DEFAULT_CONFIG)
  const loaded = useState<boolean>('campaign-loaded', () => false)

  const load = async () => {
    if (loaded.value) return
    const supabase = useSupabase()
    const { data } = await supabase
      .from('campaign_config')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
    if (data) {
      config.value = data as CampaignConfig
    }
    loaded.value = true
  }

  const refresh = async () => {
    loaded.value = false
    await load()
  }

  return { config, load, refresh }
}
