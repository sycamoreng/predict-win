interface SocialHandles {
  twitter?: string
  instagram?: string
  threads?: string
  tiktok?: string
}

export interface CampaignParticipation {
  id: string
  campaign_id: string
  total_points: number
  correct_predictions_count: number
  exact_scorelines_count: number
  backed_team_id: string | null
  backed_team?: { id: string; name: string; flag_emoji: string; code: string } | null
  backed_team_wins: number
  backed_team_locked_at: string | null
  auto_savings_enabled: boolean
  auto_savings_amount: number | null
  auto_savings_duration: number | null
  auto_savings_consented_at: string | null
  joined_at: string
}

interface SessionUser {
  id: string
  email: string
  name: string
  username?: string | null
  username_set_by_user?: boolean
  core_user_id?: string | null
  social_handles?: SocialHandles | null
  account_number: string | null
  bank_name?: string | null
  active_customer_flag: boolean
  qualifying_transactions_count: number
  is_account_valid: boolean
  is_staff: boolean
  // Legacy fields kept for backward compat during transition
  total_points: number
  correct_predictions_count: number
  exact_scorelines_count: number
  backed_team_id: string | null
  backed_team?: { id: string; name: string; flag_emoji: string; code: string } | null
  backed_team_wins?: number
  backed_team_locked_at?: string | null
  auto_savings_enabled?: boolean
  auto_savings_amount?: number | null
  auto_savings_duration?: number | null
  is_guest?: boolean
}

export type AdminPermission =
  | 'manage_results'
  | 'manage_fixtures'
  | 'view_payouts'
  | 'manage_admins'

interface AdminInfo {
  email: string
  name: string
  role: 'super_admin' | 'results' | 'fixtures' | 'payouts'
  permissions: AdminPermission[]
}

const STORAGE_KEY = 'predictor_session'
const ADMIN_STORAGE_KEY = 'predictor_admin'

export const useAuth = () => {
  const user = useState<SessionUser | null>('auth-user', () => null)
  const admin = useState<AdminInfo | null>('auth-admin', () => null)
  const participation = useState<CampaignParticipation | null>('campaign-participation', () => null)
  const streak = useState<{ current_streak: number; longest_streak: number } | null>('campaign-streak', () => null)
  const chipCount = useState<number>('campaign-chip-count', () => 0)

  const loadFromStorage = () => {
    if (!import.meta.client) return
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        user.value = parsed
        identifyPulseUser(parsed)
      } catch {
        localStorage.removeItem(STORAGE_KEY)
      }
    }
    const rawAdmin = localStorage.getItem(ADMIN_STORAGE_KEY)
    if (rawAdmin) {
      try {
        admin.value = JSON.parse(rawAdmin)
      } catch {
        localStorage.removeItem(ADMIN_STORAGE_KEY)
      }
    }
  }

  const identifyPulseUser = (u: SessionUser) => {
    if (!import.meta.client) return
    try {
      const { $pulse } = useNuxtApp() as any
      if (!$pulse) return
      const externalId = u.core_user_id || u.email
      $pulse.identify(externalId, {
        email: u.email,
        name: u.name,
        username: u.username || undefined,
        is_guest: !!u.is_guest,
        is_staff: !!u.is_staff,
        has_account: !!u.account_number,
        active_customer: !!u.active_customer_flag,
      })
    } catch {}
  }

  const resetPulse = () => {
    if (!import.meta.client) return
    try {
      const { $pulse } = useNuxtApp() as any
      if (!$pulse) return
      $pulse.reset()
    } catch {}
  }

  const trackPulseEvent = (name: string, properties?: Record<string, unknown>) => {
    if (!import.meta.client) return
    try {
      const { $pulse } = useNuxtApp() as any
      if (!$pulse) return
      $pulse.track(name, properties)
    } catch {}
  }

  const setSession = (u: SessionUser | null) => {
    user.value = u
    if (!import.meta.client) return
    if (u) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(u))
      identifyPulseUser(u)
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  const setSessionToken = (token: string | null) => {
    if (!import.meta.client) return
    if (token) localStorage.setItem(APP_TOKEN_KEY, token)
    else localStorage.removeItem(APP_TOKEN_KEY)
  }

  const setAdminToken = (token: string | null) => {
    if (!import.meta.client) return
    if (token) localStorage.setItem(APP_ADMIN_TOKEN_KEY, token)
    else localStorage.removeItem(APP_ADMIN_TOKEN_KEY)
  }

  const setAdminSession = (a: AdminInfo | null) => {
    admin.value = a
    if (!import.meta.client) return
    if (a) {
      localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(a))
    } else {
      localStorage.removeItem(ADMIN_STORAGE_KEY)
    }
  }

  const isGuest = computed(() => !!user.value?.is_guest)
  const hasAccount = computed(() => !!user.value?.account_number)
  const isStaff = computed(() => !!user.value?.is_staff)
  const isSycamoreUser = computed(() => !!user.value && !isGuest.value && hasAccount.value)
  const needsUsername = computed(() => !!user.value && !user.value.is_guest && !user.value.username_set_by_user && (!user.value.username || isAutoUsername(user.value.username)))

  const isAutoUsername = (u: string | null | undefined) => {
    if (!u) return true
    return /^[a-z]+-[a-z]+-\d+$/.test(u) || /^[a-z]+\d+$/.test(u)
  }

  const displayName = computed(() => {
    if (!user.value) return ''
    if (user.value.is_guest) {
      return user.value.email.split('@')[0]
    }
    if (user.value.username && !isAutoUsername(user.value.username)) {
      return user.value.username
    }
    return user.value.name?.split(' ')[0] || user.value.email.split('@')[0]
  })

  const isEnrolled = computed(() => !!participation.value)

  const campaignPoints = computed(() => participation.value?.total_points ?? 0)
  const campaignBackedTeam = computed(() => participation.value?.backed_team ?? null)
  const campaignBackedTeamId = computed(() => participation.value?.backed_team_id ?? null)
  const campaignBackedTeamWins = computed(() => participation.value?.backed_team_wins ?? 0)
  const campaignBackedTeamLockedAt = computed(() => participation.value?.backed_team_locked_at ?? null)
  const campaignCorrectPredictions = computed(() => participation.value?.correct_predictions_count ?? 0)
  const campaignExactScorelines = computed(() => participation.value?.exact_scorelines_count ?? 0)
  const campaignCurrentStreak = computed(() => streak.value?.current_streak ?? 0)
  const campaignLongestStreak = computed(() => streak.value?.longest_streak ?? 0)
  const campaignChipsUsed = computed(() => chipCount.value)

  const loadParticipation = async (campaignId: string) => {
    if (!user.value) return
    const supabase = useSupabase()
    const { data } = await supabase
      .from('campaign_participants')
      .select('*, backed_team:teams!campaign_participants_backed_team_id_fkey(*)')
      .eq('campaign_id', campaignId)
      .eq('user_id', user.value.id)
      .maybeSingle()
    participation.value = data as CampaignParticipation | null

    const [{ data: streakData }, { count: chips }] = await Promise.all([
      supabase
        .from('user_streaks')
        .select('current_streak, longest_streak')
        .eq('campaign_id', campaignId)
        .eq('user_id', user.value.id)
        .maybeSingle(),
      supabase
        .from('chip_activations')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', campaignId)
        .eq('user_id', user.value.id),
    ])
    streak.value = (streakData as { current_streak: number; longest_streak: number } | null) ?? null
    chipCount.value = chips ?? 0
  }

  const joinCampaign = async (campaignId: string) => {
    if (!user.value || isEnrolled.value) return
    const supabase = useSupabase()
    const { error } = await supabase
      .from('campaign_participants')
      .insert({ campaign_id: campaignId, user_id: user.value.id })
    if (!error) {
      await loadParticipation(campaignId)
    }
    return error
  }

  const refreshUser = async () => {
    if (!user.value) return

    try {
      const { call } = useFunctions()
      const { user: data } = await call('profile-me', {})
      if (data) {
        user.value = data as SessionUser
        if (import.meta.client) localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
      }
    } catch {
      // Keep the cached session if the refresh could not complete.
    }

    const { config } = useCampaign()
    if (config.value.id) {
      await loadParticipation(config.value.id)
    }
  }

  const hasPermission = (permission: AdminPermission) =>
    !!admin.value && admin.value.permissions.includes(permission)

  const logout = () => {
    resetPulse()
    setSession(null)
    setSessionToken(null)
    participation.value = null
    streak.value = null
    chipCount.value = 0
  }

  const adminLogout = () => {
    setAdminSession(null)
    setAdminToken(null)
  }

  return {
    user, admin, participation,
    isGuest, hasAccount, isStaff, isSycamoreUser, needsUsername, isEnrolled,
    displayName,
    campaignPoints, campaignBackedTeam, campaignBackedTeamId,
    campaignBackedTeamWins, campaignBackedTeamLockedAt,
    campaignCorrectPredictions, campaignExactScorelines,
    campaignCurrentStreak, campaignLongestStreak, campaignChipsUsed,
    setSession, setSessionToken, setAdminSession, setAdminToken, loadFromStorage, loadParticipation, joinCampaign,
    refreshUser, logout, adminLogout, hasPermission, trackPulseEvent,
  }
}
