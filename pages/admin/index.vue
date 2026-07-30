<script setup lang="ts">
definePageMeta({ middleware: 'admin-auth', layout: false })

const supabase = useSupabase()
const { admin, hasPermission, adminLogout } = useAuth()
const { call } = useFunctions()

const canManageResults = computed(() => hasPermission('manage_results'))
const canManageFixtures = computed(() => hasPermission('manage_fixtures'))
const canViewPayouts = computed(() => hasPermission('view_payouts'))
const canManageAdmins = computed(() => hasPermission('manage_admins'))

type Tab = 'campaign' | 'fixtures' | 'results' | 'payouts' | 'teams' | 'users' | 'reports' | 'admins'

const tabs = computed<Array<{ key: Tab; label: string; show: boolean }>>(() => [
  { key: 'campaign', label: 'Campaign', show: true },
  { key: 'fixtures', label: 'Fixtures', show: canManageFixtures.value },
  { key: 'results', label: 'Results', show: canManageResults.value },
  { key: 'payouts', label: 'Payouts', show: canViewPayouts.value },
  { key: 'teams', label: 'Teams', show: canManageResults.value },
  { key: 'users', label: 'Users', show: true },
  { key: 'reports', label: 'Reports', show: true },
  { key: 'admins', label: 'Admins', show: canManageAdmins.value },
])

const visibleTabs = computed(() => tabs.value.filter((t) => t.show))
const activeTab = ref<Tab>(visibleTabs.value[0]?.key || 'fixtures')

watch(visibleTabs, (v) => {
  if (!v.find((t) => t.key === activeTab.value) && v.length) {
    activeTab.value = v[0].key
  }
})

const router = useRouter()
const signOut = () => {
  adminLogout()
  router.replace('/admin/login')
}

// --- Confirmation modal ---
const confirmModal = ref<{ title: string; message: string; action: () => Promise<void>; variant?: 'danger' | 'warning' } | null>(null)
const confirmLoading = ref(false)

const requestConfirm = (title: string, message: string, action: () => Promise<void>, variant: 'danger' | 'warning' = 'danger') => {
  confirmModal.value = { title, message, action, variant }
}

const executeConfirm = async () => {
  if (!confirmModal.value) return
  confirmLoading.value = true
  try {
    await confirmModal.value.action()
  } finally {
    confirmLoading.value = false
    confirmModal.value = null
  }
}

// --- Campaign Config ---
const campaignConfig = ref<{ predictions_enabled: boolean; leaderboard_enabled: boolean; team_picking_enabled: boolean; campaign_name: string; week_start_date: string; prediction_lock_minutes: number } | null>(null)
const campaignLoading = ref(false)

const loadCampaignConfig = async () => {
  campaignLoading.value = true
  const { data } = await supabase
    .from('campaign_config')
    .select('*')
    .eq('id', 1)
    .maybeSingle()
  campaignConfig.value = data
  campaignLoading.value = false
}

const toggleCampaignField = async (field: 'predictions_enabled' | 'leaderboard_enabled' | 'team_picking_enabled') => {
  if (!campaignConfig.value) return
  const newVal = !campaignConfig.value[field]
  campaignLoading.value = true
  try {
    await call('campaign-config-update', {
      admin_email: admin.value!.email,
      fields: { [field]: newVal },
    })
    campaignConfig.value[field] = newVal
  } catch (err: any) {
    error.value = `Failed to update ${field}: ${err.message}`
  }
  campaignLoading.value = false
}

const updateCampaignName = async () => {
  if (!campaignConfig.value) return
  campaignLoading.value = true
  try {
    await call('campaign-config-update', {
      admin_email: admin.value!.email,
      fields: { campaign_name: campaignConfig.value.campaign_name },
    })
  } catch (err: any) {
    error.value = `Failed to update campaign name: ${err.message}`
  }
  campaignLoading.value = false
}

const updateWeekStartDate = async () => {
  if (!campaignConfig.value) return
  campaignLoading.value = true
  try {
    await call('campaign-config-update', {
      admin_email: admin.value!.email,
      fields: { week_start_date: campaignConfig.value.week_start_date },
    })
  } catch (err: any) {
    error.value = `Failed to update week start date: ${err.message}`
  }
  campaignLoading.value = false
}

const updatePredictionLockMinutes = async () => {
  if (!campaignConfig.value) return
  campaignLoading.value = true
  try {
    await call('campaign-config-update', {
      admin_email: admin.value!.email,
      fields: { prediction_lock_minutes: campaignConfig.value.prediction_lock_minutes },
    })
  } catch (err: any) {
    error.value = `Failed to update prediction lock window: ${err.message}`
  }
  campaignLoading.value = false
}

// --- Fixtures ---
const leagueId = ref(1)
const seasonYear = ref(2026)
const searchQuery = ref('World Cup')
const searching = ref(false)
const searchResults = ref<any[]>([])
const syncing = ref(false)
const syncResult = ref<{ updated_count: number; finished_fixtures: number; skipped: string[] } | null>(null)
const importing = ref(false)
const importResult = ref<{ teams_imported: number; matches_imported: number } | null>(null)
const showImportConfirm = ref(false)
const syncingFixtures = ref(false)
const syncFixturesResult = ref<{ added_teams: number; added_matches: number; skipped_existing: number } | null>(null)
const error = ref('')

const searchCompetitions = async () => {
  if (!admin.value || !searchQuery.value.trim()) return
  searching.value = true
  error.value = ''
  searchResults.value = []
  try {
    const res = await call('sync-results/leagues', {
      email: admin.value.email,
      search: searchQuery.value.trim(),
    })
    searchResults.value = res.leagues || []
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    searching.value = false
  }
}

const applySearchSelection = (id: number, year: number) => {
  leagueId.value = id
  seasonYear.value = year
}

const syncFromApi = async () => {
  if (!admin.value) return
  syncing.value = true
  error.value = ''
  syncResult.value = null
  try {
    const res = await call('sync-results', {
      email: admin.value.email,
      league: leagueId.value,
      season: seasonYear.value,
    })
    syncResult.value = {
      updated_count: res.updated_count,
      finished_fixtures: res.finished_fixtures,
      skipped: res.skipped || [],
    }
    await loadMatches()
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    syncing.value = false
  }
}

const syncNewFixtures = async () => {
  if (!admin.value) return
  syncingFixtures.value = true
  error.value = ''
  syncFixturesResult.value = null
  try {
    const res = await call('sync-results/sync-fixtures', {
      email: admin.value.email,
      league: leagueId.value,
      season: seasonYear.value,
    })
    syncFixturesResult.value = {
      added_teams: res.added_teams,
      added_matches: res.added_matches,
      skipped_existing: res.skipped_existing,
    }
    await loadMatches()
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    syncingFixtures.value = false
  }
}

const importFixtures = async () => {
  if (!admin.value) return
  importing.value = true
  error.value = ''
  importResult.value = null
  showImportConfirm.value = false
  try {
    const res = await call('sync-results/import', {
      email: admin.value.email,
      league: leagueId.value,
      season: seasonYear.value,
    })
    importResult.value = {
      teams_imported: res.teams_imported,
      matches_imported: res.matches_imported,
    }
    await loadMatches()
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    importing.value = false
  }
}

// --- Results ---
const matches = ref<any[]>([])
const loading = ref(true)
const saving = ref<string | null>(null)
const editStates = ref<Record<string, { home: number; away: number; first: string | null }>>({})
const resultsStatusFilter = ref<'all' | 'scheduled' | 'completed' | 'postponed' | 'cancelled'>('all')
const resultsSearch = ref('')

const filteredMatches = computed(() => {
  let list = matches.value
  if (resultsStatusFilter.value !== 'all') {
    list = list.filter((m) => m.status === resultsStatusFilter.value)
  }
  const q = resultsSearch.value.trim().toLowerCase()
  if (q) {
    list = list.filter((m) =>
      m.home_team.name.toLowerCase().includes(q) ||
      m.home_team.code.toLowerCase().includes(q) ||
      m.away_team.name.toLowerCase().includes(q) ||
      m.away_team.code.toLowerCase().includes(q)
    )
  }
  return list
})

const loadMatches = async () => {
  loading.value = true
  const { data } = await supabase
    .from('matches')
    .select('*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)')
    .order('kickoff_at', { ascending: true })
  matches.value = data || []
  for (const m of matches.value) {
    editStates.value[m.id] = {
      home: m.home_score ?? 0,
      away: m.away_score ?? 0,
      first: m.first_to_score_team_id || null,
    }
  }
  loading.value = false
}

onMounted(loadMatches)

const submit = async (matchId: string) => {
  if (!admin.value) return
  const s = editStates.value[matchId]
  saving.value = matchId
  error.value = ''
  try {
    await call('predictions/submit-result', {
      email: admin.value.email,
      match_id: matchId,
      home_score: s.home,
      away_score: s.away,
      first_to_score_team_id: s.first,
    })
    await loadMatches()
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    saving.value = null
  }
}

const setMatchStatus = async (matchId: string, status: 'scheduled' | 'postponed' | 'cancelled') => {
  if (!admin.value) return

  if (status === 'cancelled') {
    requestConfirm(
      'Cancel match',
      'Are you sure you want to cancel this match? All predictions for this match will be cleared permanently.',
      async () => {
        saving.value = matchId
        error.value = ''
        try {
          await call('predictions/set-status', {
            email: admin.value!.email,
            match_id: matchId,
            status,
          })
          await loadMatches()
        } catch (e) {
          error.value = (e as Error).message
        } finally {
          saving.value = null
        }
      }
    )
    return
  }

  saving.value = matchId
  error.value = ''
  try {
    await call('predictions/set-status', {
      email: admin.value.email,
      match_id: matchId,
      status,
    })
    await loadMatches()
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    saving.value = null
  }
}

// --- Payouts ---
const payoutLoading = ref(false)
const payoutWeeks = ref<any[]>([])
const payoutSingle = ref<any | null>(null)
const payoutWeekOf = ref('')
const payoutTopN = ref(10)
const payoutFilter = ref<'public' | 'staff' | 'all'>('public')

const fetchAllWeeks = async () => {
  if (!admin.value) return
  payoutLoading.value = true
  payoutSingle.value = null
  error.value = ''
  try {
    const res = await call('payouts/all-weeks', {
      email: admin.value.email,
      top_n: payoutTopN.value,
      filter: payoutFilter.value,
    })
    payoutWeeks.value = res.weeks || []
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    payoutLoading.value = false
  }
}

const fetchSingleWeek = async () => {
  if (!admin.value) return
  payoutLoading.value = true
  payoutWeeks.value = []
  error.value = ''
  try {
    const res = await call('payouts/weekly', {
      email: admin.value.email,
      week_of: payoutWeekOf.value || undefined,
      top_n: payoutTopN.value,
      filter: payoutFilter.value,
    })
    payoutSingle.value = res
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    payoutLoading.value = false
  }
}

const csvCell = (v: unknown) => {
  const s = (v ?? '').toString()
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const downloadCsv = (filename: string, rows: any[]) => {
  if (!rows.length) return
  const headers = ['rank', 'username', 'name', 'email', 'account_number', 'phone_number', 'twitter', 'instagram', 'threads', 'tiktok', 'week_points', 'exact_scorelines', 'correct_predictions', 'matches_scored']
  const csv = [headers.join(',')]
    .concat(rows.map((r) => headers.map((h) => {
      if (['twitter', 'instagram', 'threads', 'tiktok'].includes(h)) {
        return csvCell(r.social_handles?.[h] || '')
      }
      return csvCell(r[h])
    }).join(',')))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const exportSingleCsv = () => {
  if (!payoutSingle.value) return
  const date = (payoutSingle.value.week_start || '').slice(0, 10)
  downloadCsv(`payout-week-${date}.csv`, payoutSingle.value.winners)
}

// --- Mark Paid ---
const markPaidEmail = ref('')
const markPaidAmount = ref<number | null>(null)
const markPaidType = ref('Weekly Winner')
const markPaidLoading = ref(false)
const markPaidResult = ref<{ success: boolean; message: string } | null>(null)

const rewardTypes = ['Weekly Winner', 'Weekly Runner-Up', 'Matchday Random Draw', 'Grand Prize']

const markSinglePaid = async () => {
  if (!admin.value || !markPaidEmail.value || !markPaidAmount.value) return
  markPaidLoading.value = true
  markPaidResult.value = null
  error.value = ''
  try {
    await call('payouts/mark-paid', {
      email: admin.value.email,
      target_email: markPaidEmail.value.trim().toLowerCase(),
      amount: markPaidAmount.value,
      reward_type: markPaidType.value,
    })
    markPaidResult.value = { success: true, message: `Payout notification sent to ${markPaidEmail.value}` }
    markPaidEmail.value = ''
    markPaidAmount.value = null
  } catch (e) {
    markPaidResult.value = { success: false, message: (e as Error).message }
  } finally {
    markPaidLoading.value = false
  }
}

const markBulkPaid = async (winners: any[], rewardType: string, amount: number) => {
  if (!admin.value || !winners.length) return
  markPaidLoading.value = true
  markPaidResult.value = null
  error.value = ''
  try {
    const recipients = winners.map((w) => ({
      email: w.email,
      amount,
      reward_type: rewardType,
    }))
    const res = await call('payouts/mark-paid-bulk', {
      email: admin.value.email,
      recipients,
    })
    const sentCount = (res.results || []).filter((r: any) => r.sent).length
    markPaidResult.value = { success: true, message: `Sent ${sentCount}/${recipients.length} payout notifications` }
  } catch (e) {
    markPaidResult.value = { success: false, message: (e as Error).message }
  } finally {
    markPaidLoading.value = false
  }
}

const bulkPayoutAmount = ref<number>(100000)
const bulkPayoutType = ref('Weekly Winner')

const exportAllWeeksCsv = () => {
  const all: any[] = []
  for (const w of payoutWeeks.value) {
    const date = (w.week_start || '').slice(0, 10)
    for (const winner of w.winners) {
      all.push({ ...winner, week_of: date })
    }
  }
  if (!all.length) return
  const headers = ['week_of', 'rank', 'username', 'name', 'email', 'account_number', 'phone_number', 'twitter', 'instagram', 'threads', 'tiktok', 'week_points', 'exact_scorelines', 'correct_predictions', 'matches_scored']
  const csv = [headers.join(',')]
    .concat(all.map((r) => headers.map((h) => {
      if (['twitter', 'instagram', 'threads', 'tiktok'].includes(h)) {
        return csvCell(r.social_handles?.[h] || '')
      }
      return csvCell(r[h])
    }).join(',')))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `payout-all-weeks.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// --- Teams ---
const teamsList = ref<any[]>([])
const teamsLoading = ref(false)
const teamsError = ref('')
const teamsStatusFilter = ref<'all' | 'active' | 'eliminated'>('all')
const teamsSearch = ref('')

const filteredTeams = computed(() => {
  let list = teamsList.value
  if (teamsStatusFilter.value === 'active') {
    list = list.filter((t) => !t.is_eliminated)
  } else if (teamsStatusFilter.value === 'eliminated') {
    list = list.filter((t) => t.is_eliminated)
  }
  const q = teamsSearch.value.trim().toLowerCase()
  if (q) {
    list = list.filter((t) =>
      t.name?.toLowerCase().includes(q) ||
      t.code?.toLowerCase().includes(q)
    )
  }
  return list
})

const loadTeams = async () => {
  if (!admin.value) return
  teamsLoading.value = true
  teamsError.value = ''
  try {
    const res = await call('predictions/teams-list', { email: admin.value.email })
    teamsList.value = res.teams || []
  } catch (e) {
    teamsError.value = (e as Error).message
  } finally {
    teamsLoading.value = false
  }
}

const toggleElimination = async (teamId: string, currentlyEliminated: boolean) => {
  if (!admin.value) return
  const team = teamsList.value.find((t) => t.id === teamId)
  const teamName = team?.code || 'this team'

  if (!currentlyEliminated) {
    requestConfirm(
      'Eliminate team',
      `Are you sure you want to mark ${teamName} as eliminated? Users who backed this team will be able to pick a new team.`,
      async () => {
        teamsLoading.value = true
        teamsError.value = ''
        try {
          await call('predictions/team-eliminate', {
            email: admin.value!.email,
            team_id: teamId,
            eliminated: true,
          })
          await loadTeams()
        } catch (e) {
          teamsError.value = (e as Error).message
        } finally {
          teamsLoading.value = false
        }
      },
      'warning'
    )
    return
  }

  teamsLoading.value = true
  teamsError.value = ''
  try {
    await call('predictions/team-eliminate', {
      email: admin.value.email,
      team_id: teamId,
      eliminated: false,
    })
    await loadTeams()
  } catch (e) {
    teamsError.value = (e as Error).message
  } finally {
    teamsLoading.value = false
  }
}

// --- Admins ---
const adminsList = ref<any[]>([])
const adminLoading = ref(false)
const newAdminEmail = ref('')
const newAdminName = ref('')
const newAdminRole = ref<'super_admin' | 'results' | 'fixtures' | 'payouts'>('results')
const adminError = ref('')

const availableRoles: Array<{ value: 'super_admin' | 'results' | 'fixtures' | 'payouts'; label: string; description: string }> = [
  { value: 'super_admin', label: 'Super admin', description: 'Full access to all admin features.' },
  { value: 'results', label: 'Results manager', description: 'Submit and edit match results, change match status.' },
  { value: 'fixtures', label: 'Fixtures manager', description: 'Search competitions, sync results, import fixtures.' },
  { value: 'payouts', label: 'Payouts viewer', description: 'View and export weekly payout reports.' },
]

const loadAdmins = async () => {
  if (!admin.value || !canManageAdmins.value) return
  adminLoading.value = true
  adminError.value = ''
  try {
    const res = await call('predictions/admins-list', { email: admin.value.email })
    adminsList.value = res.admins || []
  } catch (e) {
    adminError.value = (e as Error).message
  } finally {
    adminLoading.value = false
  }
}

const upsertAdmin = async () => {
  if (!admin.value) return
  if (!newAdminEmail.value.includes('@')) {
    adminError.value = 'Enter a valid email.'
    return
  }
  adminLoading.value = true
  adminError.value = ''
  try {
    await call('predictions/admins-upsert', {
      email: admin.value.email,
      target_email: newAdminEmail.value.trim().toLowerCase(),
      name: newAdminName.value.trim(),
      role: newAdminRole.value,
    })
    newAdminEmail.value = ''
    newAdminName.value = ''
    newAdminRole.value = 'results'
    await loadAdmins()
  } catch (e) {
    adminError.value = (e as Error).message
  } finally {
    adminLoading.value = false
  }
}

const removeAdmin = async (targetEmail: string) => {
  if (!admin.value) return
  if (targetEmail === admin.value.email) {
    adminError.value = "You can't remove yourself."
    return
  }
  requestConfirm(
    'Remove admin',
    `Are you sure you want to remove ${targetEmail} from the admin team? They will lose all admin access immediately.`,
    async () => {
      adminLoading.value = true
      adminError.value = ''
      try {
        await call('predictions/admins-remove', {
          email: admin.value!.email,
          target_email: targetEmail,
        })
        await loadAdmins()
      } catch (e) {
        adminError.value = (e as Error).message
      } finally {
        adminLoading.value = false
      }
    }
  )
}

// --- Reports ---
const reportLoading = ref(false)
const guestListLoading = ref(false)
const guestExportLoading = ref(false)
const guestList = ref<Array<{ email: string; username: string; social_handles: any; created_at: string; prediction_count: number }>>([])
const reportDateFrom = ref('')
const reportDateTo = ref('')
const reportData = ref<{
  totalUsers: number
  sycamoreUsers: number
  guestUsers: number
  activeCustomers: number
  usersWithTeam: number
  savingsEnabled: number
  totalSavingsAmount: number
  totalPredictions: number
  matchesCompleted: number
  matchesScheduled: number
  correctPredictions: number
  incorrectPredictions: number
  exactScorelines: number
  teamDistribution: Array<{ code: string; name: string; flag_emoji: string; count: number }>
  dailySignups: Array<{ date: string; count: number }>
  dailyPredictions: Array<{ date: string; count: number }>
} | null>(null)

const loadReports = async () => {
  reportLoading.value = true
  try {
    const from = reportDateFrom.value || null
    const to = reportDateTo.value ? reportDateTo.value + 'T23:59:59' : null

    let usersQuery = supabase.from('synced_users').select('*', { count: 'exact', head: true })
    if (from) usersQuery = usersQuery.gte('created_at', from)
    if (to) usersQuery = usersQuery.lte('created_at', to)
    const { count: totalUsers } = await usersQuery

    let sycQuery = supabase.from('synced_users').select('*', { count: 'exact', head: true }).not('account_number', 'is', null)
    if (from) sycQuery = sycQuery.gte('created_at', from)
    if (to) sycQuery = sycQuery.lte('created_at', to)
    const { count: sycamoreUsers } = await sycQuery

    let guestQuery = supabase.from('synced_users').select('*', { count: 'exact', head: true }).is('account_number', null)
    if (from) guestQuery = guestQuery.gte('created_at', from)
    if (to) guestQuery = guestQuery.lte('created_at', to)
    const { count: guestUsers } = await guestQuery

    let activeQuery = supabase.from('synced_users').select('*', { count: 'exact', head: true }).eq('active_customer_flag', true)
    if (from) activeQuery = activeQuery.gte('created_at', from)
    if (to) activeQuery = activeQuery.lte('created_at', to)
    const { count: activeCustomers } = await activeQuery

    let teamQuery = supabase.from('synced_users').select('*', { count: 'exact', head: true }).not('backed_team_id', 'is', null)
    if (from) teamQuery = teamQuery.gte('created_at', from)
    if (to) teamQuery = teamQuery.lte('created_at', to)
    const { count: usersWithTeam } = await teamQuery

    let savingsQuery = supabase.from('synced_users').select('*', { count: 'exact', head: true }).eq('auto_savings_enabled', true)
    if (from) savingsQuery = savingsQuery.gte('created_at', from)
    if (to) savingsQuery = savingsQuery.lte('created_at', to)
    const { count: savingsEnabled } = await savingsQuery

    let savingsAmountQuery = supabase.from('synced_users').select('auto_savings_amount').eq('auto_savings_enabled', true).not('auto_savings_amount', 'is', null)
    if (from) savingsAmountQuery = savingsAmountQuery.gte('created_at', from)
    if (to) savingsAmountQuery = savingsAmountQuery.lte('created_at', to)
    const { data: savingsRows } = await savingsAmountQuery
    const totalSavingsAmount = (savingsRows || []).reduce((sum, r) => sum + (r.auto_savings_amount || 0), 0)

    let predsQuery = supabase.from('predictions').select('*', { count: 'exact', head: true })
    if (from) predsQuery = predsQuery.gte('created_at', from)
    if (to) predsQuery = predsQuery.lte('created_at', to)
    const { count: totalPredictions } = await predsQuery

    const { count: matchesCompleted } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')

    const { count: matchesScheduled } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'scheduled')

    let correctQuery = supabase.from('predictions').select('*', { count: 'exact', head: true }).eq('scored', true).gt('points_awarded', 0)
    if (from) correctQuery = correctQuery.gte('created_at', from)
    if (to) correctQuery = correctQuery.lte('created_at', to)
    const { count: correctPredictions } = await correctQuery

    let incorrectQuery = supabase.from('predictions').select('*', { count: 'exact', head: true }).eq('scored', true).eq('points_awarded', 0)
    if (from) incorrectQuery = incorrectQuery.gte('created_at', from)
    if (to) incorrectQuery = incorrectQuery.lte('created_at', to)
    const { count: incorrectPredictions } = await incorrectQuery

    let exactQuery = supabase.from('predictions').select('*', { count: 'exact', head: true }).eq('scored', true).gte('points_awarded', 15)
    if (from) exactQuery = exactQuery.gte('created_at', from)
    if (to) exactQuery = exactQuery.lte('created_at', to)
    const { count: exactScorelines } = await exactQuery

    let teamDataQuery = supabase.from('synced_users').select('backed_team_id, backed_team:teams!synced_users_backed_team_id_fkey(code, name, flag_emoji)').not('backed_team_id', 'is', null)
    if (from) teamDataQuery = teamDataQuery.gte('created_at', from)
    if (to) teamDataQuery = teamDataQuery.lte('created_at', to)
    const { data: teamData } = await teamDataQuery

    const teamCounts: Record<string, { code: string; name: string; flag_emoji: string; count: number }> = {}
    for (const row of teamData || []) {
      const t = row.backed_team as any
      if (!t) continue
      const key = row.backed_team_id
      if (!teamCounts[key]) {
        teamCounts[key] = { code: t.code, name: t.name, flag_emoji: t.flag_emoji || '', count: 0 }
      }
      teamCounts[key].count++
    }
    const teamDistribution = Object.values(teamCounts).sort((a, b) => b.count - a.count)

    const { data: signupRows } = await supabase.rpc('get_daily_signups')
    let dailySignups = (signupRows || []).map((r: any) => ({ date: r.date, count: Number(r.count) }))
    if (from) dailySignups = dailySignups.filter((d) => d.date >= from)
    if (to) dailySignups = dailySignups.filter((d) => d.date <= (reportDateTo.value || '9999-12-31'))

    const { data: predRows } = await supabase.rpc('get_daily_predictions')
    let dailyPredictions = (predRows || []).map((r: any) => ({ date: r.date, count: Number(r.count) }))
    if (from) dailyPredictions = dailyPredictions.filter((d) => d.date >= from)
    if (to) dailyPredictions = dailyPredictions.filter((d) => d.date <= (reportDateTo.value || '9999-12-31'))

    reportData.value = {
      totalUsers: totalUsers || 0,
      sycamoreUsers: sycamoreUsers || 0,
      guestUsers: guestUsers || 0,
      activeCustomers: activeCustomers || 0,
      usersWithTeam: usersWithTeam || 0,
      savingsEnabled: savingsEnabled || 0,
      totalSavingsAmount,
      totalPredictions: totalPredictions || 0,
      matchesCompleted: matchesCompleted || 0,
      matchesScheduled: matchesScheduled || 0,
      correctPredictions: correctPredictions || 0,
      incorrectPredictions: incorrectPredictions || 0,
      exactScorelines: exactScorelines || 0,
      teamDistribution,
      dailySignups,
      dailyPredictions,
    }
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    reportLoading.value = false
  }
}

const loadGuestList = async () => {
  guestListLoading.value = true
  try {
    const { data: guests } = await supabase
      .from('synced_users')
      .select('id, email, username, social_handles, created_at')
      .is('account_number', null)
      .order('created_at', { ascending: false })
      .limit(100)

    const guestIds = (guests || []).map((g) => g.id)
    let predCounts: Record<string, number> = {}

    if (guestIds.length) {
      const { data: preds } = await supabase
        .from('predictions')
        .select('user_id')
        .in('user_id', guestIds)

      for (const p of preds || []) {
        predCounts[p.user_id] = (predCounts[p.user_id] || 0) + 1
      }
    }

    guestList.value = (guests || []).map((g) => ({
      email: g.email,
      username: g.username || '',
      social_handles: g.social_handles || null,
      created_at: g.created_at,
      prediction_count: predCounts[g.id] || 0,
    }))
  } finally {
    guestListLoading.value = false
  }
}

const exportGuestCsv = async () => {
  guestExportLoading.value = true
  try {
    const PAGE_SIZE = 1000
    let allGuests: any[] = []
    let offset = 0
    let hasMore = true

    while (hasMore) {
      let query = supabase
        .from('synced_users')
        .select('id, email, name, username, phone_number, social_handles, created_at, total_points')
        .is('account_number', null)
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1)

      if (reportDateFrom.value) query = query.gte('created_at', reportDateFrom.value)
      if (reportDateTo.value) query = query.lte('created_at', reportDateTo.value + 'T23:59:59')

      const { data } = await query
      if (!data || data.length === 0) { hasMore = false; break }
      allGuests = allGuests.concat(data)
      if (data.length < PAGE_SIZE) hasMore = false
      else offset += PAGE_SIZE
    }

    const guestIds = allGuests.map((g) => g.id)
    const predCounts: Record<string, number> = {}

    for (let i = 0; i < guestIds.length; i += 500) {
      const batch = guestIds.slice(i, i + 500)
      const { data: preds } = await supabase
        .from('predictions')
        .select('user_id')
        .in('user_id', batch)
      for (const p of preds || []) {
        predCounts[p.user_id] = (predCounts[p.user_id] || 0) + 1
      }
    }

    const headers = ['email', 'name', 'username', 'phone_number', 'twitter', 'instagram', 'threads', 'tiktok', 'total_points', 'predictions', 'joined']
    const csv = [headers.join(',')]
      .concat(allGuests.map((g) => [
        csvCell(g.email),
        csvCell(g.name),
        csvCell(g.username || ''),
        csvCell(g.phone_number || ''),
        csvCell(g.social_handles?.twitter || ''),
        csvCell(g.social_handles?.instagram || ''),
        csvCell(g.social_handles?.threads || ''),
        csvCell(g.social_handles?.tiktok || ''),
        csvCell(g.total_points || 0),
        csvCell(predCounts[g.id] || 0),
        csvCell(g.created_at?.slice(0, 10) || ''),
      ].join(',')))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const suffix = reportDateFrom.value || reportDateTo.value
      ? `-${reportDateFrom.value || 'start'}-to-${reportDateTo.value || 'now'}`
      : ''
    a.download = `users-no-account-number${suffix}.csv`
    a.click()
    URL.revokeObjectURL(url)
  } finally {
    guestExportLoading.value = false
  }
}

// --- Users Export ---
type UserFilter = 'all' | 'with_account' | 'no_account' | 'active_customers' | 'backed_team' | 'auto_savings'
const userFilterOptions: Array<{ value: UserFilter; label: string }> = [
  { value: 'all', label: 'All users' },
  { value: 'with_account', label: 'With account number' },
  { value: 'no_account', label: 'No account number (guests)' },
  { value: 'active_customers', label: 'Active customers' },
  { value: 'backed_team', label: 'Backed a team' },
  { value: 'auto_savings', label: 'Auto-savings enabled' },
]
const userFilter = ref<UserFilter>('all')
const userDateFrom = ref('')
const userDateTo = ref('')
const userSearchEmail = ref('')
const usersExporting = ref(false)
const usersExportFormat = ref<'csv' | 'json'>('csv')
const usersPreview = ref<any[]>([])
const usersPreviewLoading = ref(false)
const usersPreviewTotal = ref(0)

const buildUserQuery = (select: string, opts?: { countOnly?: boolean }) => {
  let query = opts?.countOnly
    ? supabase.from('synced_users').select(select, { count: 'exact', head: true })
    : supabase.from('synced_users').select(select)

  if (userFilter.value === 'with_account') query = query.not('account_number', 'is', null).neq('account_number', '')
  else if (userFilter.value === 'no_account') query = query.or('account_number.is.null,account_number.eq.')
  else if (userFilter.value === 'active_customers') query = query.eq('active_customer_flag', true)
  else if (userFilter.value === 'backed_team') query = query.not('backed_team_id', 'is', null)
  else if (userFilter.value === 'auto_savings') query = query.eq('auto_savings_enabled', true)

  if (userDateFrom.value) query = query.gte('created_at', userDateFrom.value)
  if (userDateTo.value) query = query.lte('created_at', userDateTo.value + 'T23:59:59')
  if (userSearchEmail.value.trim()) query = query.ilike('email', `%${userSearchEmail.value.trim()}%`)

  return query
}

const loadUsersPreview = async () => {
  usersPreviewLoading.value = true
  try {
    const { count } = await buildUserQuery('*', { countOnly: true })
    usersPreviewTotal.value = count || 0

    const { data } = await buildUserQuery('id, email, name, username, account_number, phone_number, active_customer_flag, total_points, backed_team_id, auto_savings_enabled, created_at')
      .order('created_at', { ascending: false })
      .limit(20)
    usersPreview.value = data || []
  } finally {
    usersPreviewLoading.value = false
  }
}

const fetchAllFilteredUsers = async () => {
  const PAGE_SIZE = 1000
  let allUsers: any[] = []
  let offset = 0
  let hasMore = true

  while (hasMore) {
    const { data } = await buildUserQuery('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)
    if (!data || data.length === 0) { hasMore = false; break }
    allUsers = allUsers.concat(data)
    if (data.length < PAGE_SIZE) hasMore = false
    else offset += PAGE_SIZE
  }
  return allUsers
}

const getExportFilename = (ext: string) => {
  const filterLabel = userFilter.value === 'all' ? 'all' : userFilter.value.replace(/_/g, '-')
  const dateSuffix = userDateFrom.value || userDateTo.value
    ? `-${userDateFrom.value || 'start'}-to-${userDateTo.value || 'now'}`
    : ''
  return `users-${filterLabel}${dateSuffix}.${ext}`
}

const exportUsers = async () => {
  usersExporting.value = true
  try {
    const allUsers = await fetchAllFilteredUsers()
    if (!allUsers.length) return

    let blob: Blob
    let filename: string

    if (usersExportFormat.value === 'json') {
      blob = new Blob([JSON.stringify(allUsers, null, 2)], { type: 'application/json;charset=utf-8;' })
      filename = getExportFilename('json')
    } else {
      const keys = Object.keys(allUsers[0])
      const csv = [keys.join(',')]
        .concat(allUsers.map((row) => keys.map((k) => {
          const val = row[k]
          if (val === null || val === undefined) return ''
          if (typeof val === 'object') return csvCell(JSON.stringify(val))
          return csvCell(val)
        }).join(',')))
        .join('\n')
      blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      filename = getExportFilename('csv')
    }

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  } finally {
    usersExporting.value = false
  }
}

// --- Acquisition ---
const acquisitionData = ref<{
  totalOrganic: number
  neverTransacted: number
  becameActive: number
  conversionRate: number
} | null>(null)
const acquisitionLoading = ref(false)
const acquisitionExporting = ref(false)

const loadAcquisition = async () => {
  acquisitionLoading.value = true
  try {
    const { count: totalOrganic } = await supabase
      .from('synced_users')
      .select('*', { count: 'exact', head: true })
      .eq('is_staff', false)
      .gt('created_at', '2026-06-08T23:59:59+00:00')

    const { count: neverTransacted } = await supabase
      .from('synced_users')
      .select('*', { count: 'exact', head: true })
      .eq('is_staff', false)
      .gt('created_at', '2026-06-08T23:59:59+00:00')
      .eq('qualifying_transactions_count', 0)
      .eq('active_customer_flag', false)

    const total = totalOrganic || 0
    const never = neverTransacted || 0
    const active = total - never

    acquisitionData.value = {
      totalOrganic: total,
      neverTransacted: never,
      becameActive: active,
      conversionRate: total > 0 ? Math.round((active / total) * 100) : 0,
    }
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    acquisitionLoading.value = false
  }
}

const exportAcquisitionCsv = async () => {
  acquisitionExporting.value = true
  try {
    const PAGE_SIZE = 1000
    let allUsers: any[] = []
    let offset = 0
    let hasMore = true

    while (hasMore) {
      const { data } = await supabase
        .from('synced_users')
        .select('id, email, name, username, phone_number, social_handles, created_at, total_points, backed_team_id')
        .eq('is_staff', false)
        .gt('created_at', '2026-06-08T23:59:59+00:00')
        .eq('qualifying_transactions_count', 0)
        .eq('active_customer_flag', false)
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1)

      if (!data || data.length === 0) { hasMore = false; break }
      allUsers = allUsers.concat(data)
      if (data.length < PAGE_SIZE) hasMore = false
      else offset += PAGE_SIZE
    }

    const headers = ['email', 'name', 'username', 'phone_number', 'twitter', 'instagram', 'threads', 'tiktok', 'total_points', 'joined']
    const csv = [headers.join(',')]
      .concat(allUsers.map((u) => [
        csvCell(u.email),
        csvCell(u.name),
        csvCell(u.username || ''),
        csvCell(u.phone_number || ''),
        csvCell(u.social_handles?.twitter || ''),
        csvCell(u.social_handles?.instagram || ''),
        csvCell(u.social_handles?.threads || ''),
        csvCell(u.social_handles?.tiktok || ''),
        csvCell(u.total_points || 0),
        csvCell(u.created_at?.slice(0, 10) || ''),
      ].join(',')))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `acquisition-organic-never-transacted.csv`
    a.click()
    URL.revokeObjectURL(url)
  } finally {
    acquisitionExporting.value = false
  }
}

// Load tab data on tab change
watch(activeTab, (tab) => {
  if (tab === 'campaign' && !campaignConfig.value) loadCampaignConfig()
  if (tab === 'teams' && !teamsList.value.length) loadTeams()
  if (tab === 'admins' && !adminsList.value.length) loadAdmins()
  if (tab === 'reports' && !reportData.value) loadReports()
  if (tab === 'reports' && !acquisitionData.value) loadAcquisition()
  if (tab === 'users' && !usersPreview.value.length) loadUsersPreview()
}, { immediate: true })
</script>

<template>
  <div class="min-h-screen bg-slate-50">
    <header class="sticky top-0 z-30 bg-slate-900 border-b border-slate-700">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-teal-400 grid place-items-center">
            <span class="text-white font-extrabold text-sm">A</span>
          </div>
          <div class="text-white font-bold text-sm">Predictor League <span class="text-slate-400 font-normal">Admin</span></div>
        </div>
        <div class="flex items-center gap-4">
          <span class="text-xs text-slate-400 hidden sm:block">{{ admin?.email }}</span>
          <button @click="signOut" class="text-xs text-slate-400 hover:text-white transition">
            Sign out
          </button>
        </div>
      </div>
    </header>

    <!-- Tab navigation -->
    <nav class="sticky top-14 z-20 bg-white border-b border-slate-200 shadow-sm">
      <div class="max-w-6xl mx-auto px-4 sm:px-6">
        <div class="flex gap-1 overflow-x-auto py-2 -mb-px">
          <button
            v-for="tab in visibleTabs"
            :key="tab.key"
            @click="activeTab = tab.key"
            :class="[
              'px-4 py-2 text-sm font-semibold rounded-lg transition whitespace-nowrap',
              activeTab === tab.key
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100',
            ]"
          >
            {{ tab.label }}
          </button>
        </div>
      </div>
    </nav>

    <main class="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      <p v-if="error" class="text-sm text-coral-600 mb-4 p-3 bg-coral-50 rounded-xl">{{ error }}</p>

      <!-- CAMPAIGN TAB -->
      <div v-if="activeTab === 'campaign'" class="space-y-6">
        <div v-if="campaignLoading && !campaignConfig" class="card h-48 animate-pulse bg-ink-100/40"></div>
        <template v-else-if="campaignConfig">
          <div class="card p-5 space-y-5">
            <div>
              <h2 class="font-bold text-ink-900">Campaign settings</h2>
              <p class="text-sm text-ink-500">Toggle features on or off in real time. Changes apply immediately.</p>
            </div>

            <div class="space-y-4">
              <div class="flex items-center justify-between p-4 rounded-xl border border-ink-100 hover:border-ink-200 transition">
                <div>
                  <div class="font-semibold text-ink-900 text-sm">Predictions</div>
                  <div class="text-xs text-ink-500 mt-0.5">Allow users to make match predictions</div>
                </div>
                <button
                  @click="toggleCampaignField('predictions_enabled')"
                  :disabled="campaignLoading"
                  :class="[
                    'relative w-12 h-7 rounded-full transition-colors duration-200',
                    campaignConfig.predictions_enabled ? 'bg-mint-500' : 'bg-ink-200',
                  ]"
                >
                  <span
                    :class="[
                      'absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform duration-200',
                      campaignConfig.predictions_enabled ? 'translate-x-5' : 'translate-x-0',
                    ]"
                  ></span>
                </button>
              </div>

              <div class="flex items-center justify-between p-4 rounded-xl border border-ink-100 hover:border-ink-200 transition">
                <div>
                  <div class="font-semibold text-ink-900 text-sm">Leaderboard</div>
                  <div class="text-xs text-ink-500 mt-0.5">Show the public leaderboard rankings</div>
                </div>
                <button
                  @click="toggleCampaignField('leaderboard_enabled')"
                  :disabled="campaignLoading"
                  :class="[
                    'relative w-12 h-7 rounded-full transition-colors duration-200',
                    campaignConfig.leaderboard_enabled ? 'bg-mint-500' : 'bg-ink-200',
                  ]"
                >
                  <span
                    :class="[
                      'absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform duration-200',
                      campaignConfig.leaderboard_enabled ? 'translate-x-5' : 'translate-x-0',
                    ]"
                  ></span>
                </button>
              </div>

              <div class="flex items-center justify-between p-4 rounded-xl border border-ink-100 hover:border-ink-200 transition">
                <div>
                  <div class="font-semibold text-ink-900 text-sm">Team picking</div>
                  <div class="text-xs text-ink-500 mt-0.5">Allow users to back a team for bonus points</div>
                </div>
                <button
                  @click="toggleCampaignField('team_picking_enabled')"
                  :disabled="campaignLoading"
                  :class="[
                    'relative w-12 h-7 rounded-full transition-colors duration-200',
                    campaignConfig.team_picking_enabled ? 'bg-mint-500' : 'bg-ink-200',
                  ]"
                >
                  <span
                    :class="[
                      'absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform duration-200',
                      campaignConfig.team_picking_enabled ? 'translate-x-5' : 'translate-x-0',
                    ]"
                  ></span>
                </button>
              </div>
            </div>
          </div>

          <div class="card p-5 space-y-4">
            <div>
              <h3 class="font-bold text-ink-900">Campaign name</h3>
              <p class="text-sm text-ink-500">Used in emails and display headers.</p>
            </div>
            <div class="flex gap-3">
              <input
                v-model="campaignConfig.campaign_name"
                type="text"
                class="input !py-2 flex-1"
                placeholder="e.g. World Cup 2026 Predictor League"
              />
              <button
                @click="updateCampaignName"
                :disabled="campaignLoading"
                class="btn-primary !py-2 !px-4 text-sm"
              >
                {{ campaignLoading ? 'Saving...' : 'Save' }}
              </button>
            </div>
          </div>

          <div class="card p-5 space-y-4">
            <div>
              <h3 class="font-bold text-ink-900">Week start date</h3>
              <p class="text-sm text-ink-500">Defines when Week 1 begins. All weekly boundaries (leaderboard, payouts) are calculated from this date in 7-day intervals.</p>
            </div>
            <div class="flex gap-3">
              <input
                v-model="campaignConfig.week_start_date"
                type="date"
                class="input !py-2 w-48"
              />
              <button
                @click="updateWeekStartDate"
                :disabled="campaignLoading"
                class="btn-primary !py-2 !px-4 text-sm"
              >
                {{ campaignLoading ? 'Saving...' : 'Save' }}
              </button>
            </div>
            <p class="text-xs text-ink-400">Current: Week 1 starts {{ campaignConfig.week_start_date }}. Weeks run for 7 days each.</p>
          </div>

          <div class="card p-5 space-y-4">
            <div>
              <h3 class="font-bold text-ink-900">Prediction lock window</h3>
              <p class="text-sm text-ink-500">How many minutes before kickoff predictions close. E.g. 60 = 1 hour before, 180 = 3 hours before.</p>
            </div>
            <div class="flex gap-3 items-center">
              <input
                v-model.number="campaignConfig.prediction_lock_minutes"
                type="number"
                min="0"
                max="1440"
                step="15"
                class="input !py-2 w-32"
              />
              <span class="text-sm text-ink-500">minutes</span>
              <button
                @click="updatePredictionLockMinutes"
                :disabled="campaignLoading"
                class="btn-primary !py-2 !px-4 text-sm"
              >
                {{ campaignLoading ? 'Saving...' : 'Save' }}
              </button>
            </div>
            <p class="text-xs text-ink-400">Currently set to {{ campaignConfig.prediction_lock_minutes }} min ({{ (campaignConfig.prediction_lock_minutes / 60).toFixed(1) }}h) before kickoff.</p>
          </div>
        </template>
      </div>

      <!-- FIXTURES TAB -->
      <div v-if="activeTab === 'fixtures'" class="space-y-6">
        <div class="card p-5 space-y-4">
          <div>
            <h2 class="font-bold text-ink-900">Find a competition</h2>
            <p class="text-sm text-ink-500">Search api-sports.io for available leagues and seasons.</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <input
              v-model="searchQuery"
              type="text"
              class="input !py-2 flex-1 min-w-[200px]"
              placeholder="e.g. World Cup, Premier League"
              @keydown.enter="searchCompetitions"
            />
            <button
              @click="searchCompetitions"
              :disabled="searching"
              class="btn-primary !py-2 !px-4 text-sm"
            >
              {{ searching ? 'Searching...' : 'Search' }}
            </button>
          </div>
          <div v-if="searchResults.length" class="space-y-3 max-h-80 overflow-y-auto">
            <div v-for="lg in searchResults" :key="lg.id" class="rounded-xl border border-ink-100 p-3">
              <div class="font-bold text-ink-900 text-sm">{{ lg.name }}</div>
              <div class="text-xs text-ink-500">id {{ lg.id }} · {{ lg.country }} · {{ lg.type }}</div>
              <div class="mt-2 flex flex-wrap gap-1">
                <button
                  v-for="s in lg.seasons.slice().reverse()"
                  :key="`${lg.id}-${s.year}`"
                  @click="applySearchSelection(lg.id, s.year)"
                  :class="[
                    'pill text-xs',
                    leagueId === lg.id && seasonYear === s.year
                      ? 'bg-sky-500 text-white'
                      : s.current ? 'bg-mint-100 text-mint-700 hover:bg-mint-200' : 'bg-ink-100 text-ink-700 hover:bg-ink-200',
                  ]"
                >
                  {{ s.year }}{{ s.current ? ' (current)' : '' }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="card p-5 space-y-5">
          <div class="flex flex-wrap items-end gap-3">
            <div>
              <label class="label !mb-1">League ID</label>
              <input v-model.number="leagueId" type="number" class="input !py-2 w-28" />
            </div>
            <div>
              <label class="label !mb-1">Season</label>
              <input v-model.number="seasonYear" type="number" class="input !py-2 w-28" />
            </div>
            <p class="text-xs text-ink-500 max-w-sm">
              Defaults to FIFA World Cup 2026 (league 1, season 2026).
            </p>
          </div>

          <!-- Sync results -->
          <div class="flex flex-wrap gap-3 pt-4 border-t border-ink-100">
            <div class="flex-1 min-w-[240px]">
              <h3 class="font-bold text-ink-900">Live results sync</h3>
              <p class="text-sm text-ink-500">Pull completed fixtures and apply scoring automatically.</p>
            </div>
            <button @click="syncFromApi" :disabled="syncing || importing" class="btn-primary !py-2 !px-4 text-sm self-end">
              {{ syncing ? 'Syncing...' : 'Sync results' }}
            </button>
          </div>

          <div v-if="syncResult" class="rounded-xl bg-mint-50 border border-mint-200 p-3 text-sm text-ink-700">
            Updated {{ syncResult.updated_count }} of {{ syncResult.finished_fixtures }} finished fixtures.
            <span v-if="syncResult.skipped.length" class="block text-ink-500 mt-1">Skipped: {{ syncResult.skipped.join(', ') }}</span>
          </div>

          <!-- Sync new fixtures (knockout) -->
          <div class="flex flex-wrap gap-3 pt-4 border-t border-ink-100">
            <div class="flex-1 min-w-[240px]">
              <h3 class="font-bold text-ink-900">Add new fixtures (non-destructive)</h3>
              <p class="text-sm text-ink-500">Pulls all fixtures from the API and adds only new matches (e.g. knockout rounds). Existing data is preserved.</p>
            </div>
            <button @click="syncNewFixtures" :disabled="syncingFixtures || importing" class="rounded-xl bg-sky-50 text-sky-700 font-bold py-2 px-4 text-sm hover:bg-sky-100 transition disabled:opacity-50 self-end">
              {{ syncingFixtures ? 'Syncing...' : 'Sync new fixtures' }}
            </button>
          </div>

          <div v-if="syncFixturesResult" class="rounded-xl bg-sky-50 border border-sky-200 p-3 text-sm text-ink-700">
            Added {{ syncFixturesResult.added_teams }} teams and {{ syncFixturesResult.added_matches }} matches.
            <span class="text-ink-500">({{ syncFixturesResult.skipped_existing }} existing skipped)</span>
          </div>

          <!-- Import (destructive) -->
          <div class="flex flex-wrap gap-3 pt-4 border-t border-coral-100">
            <div class="flex-1 min-w-[240px]">
              <h3 class="font-bold text-coral-700">Import fixtures (destructive)</h3>
              <p class="text-sm text-ink-500">Wipes all teams, matches, predictions and resets user points. Then re-imports from the API.</p>
            </div>
            <div class="self-end">
              <button
                v-if="!showImportConfirm"
                @click="showImportConfirm = true"
                :disabled="syncing || importing"
                class="rounded-xl bg-coral-50 text-coral-700 font-bold py-2 px-4 text-sm hover:bg-coral-100 transition disabled:opacity-50"
              >
                Import fixtures...
              </button>
              <div v-else class="flex gap-2">
                <button @click="importFixtures" :disabled="importing" class="rounded-xl bg-coral-600 text-white font-bold py-2 px-4 text-sm hover:bg-coral-700 transition disabled:opacity-50">
                  {{ importing ? 'Importing...' : 'Yes, wipe and import' }}
                </button>
                <button @click="showImportConfirm = false" :disabled="importing" class="rounded-xl bg-ink-100 text-ink-700 font-bold py-2 px-4 text-sm hover:bg-ink-200 transition">
                  Cancel
                </button>
              </div>
            </div>
          </div>

          <div v-if="importResult" class="rounded-xl bg-mint-50 border border-mint-200 p-3 text-sm text-ink-700">
            Imported {{ importResult.teams_imported }} teams and {{ importResult.matches_imported }} matches.
          </div>
        </div>
      </div>

      <!-- RESULTS TAB -->
      <div v-if="activeTab === 'results'" class="space-y-4">
        <div class="flex items-end justify-between gap-3">
          <div>
            <h2 class="text-xl font-extrabold text-ink-900">Match results</h2>
            <p class="text-sm text-ink-500">Upload official results. Scoring runs immediately for every prediction.</p>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <div class="flex gap-1 bg-ink-50 rounded-lg p-1">
            <button
              v-for="opt in (['all', 'scheduled', 'completed', 'postponed', 'cancelled'] as const)"
              :key="opt"
              @click="resultsStatusFilter = opt"
              :class="[
                'px-3 py-1.5 text-xs font-semibold rounded-md transition',
                resultsStatusFilter === opt ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-700',
              ]"
            >
              {{ opt === 'all' ? 'All' : opt.charAt(0).toUpperCase() + opt.slice(1) }}
            </button>
          </div>
          <input
            v-model="resultsSearch"
            type="text"
            placeholder="Search by team..."
            class="input !py-2 !px-3 text-sm w-52"
          />
          <span class="text-xs text-ink-400 ml-auto">{{ filteredMatches.length }} of {{ matches.length }} matches</span>
        </div>

        <div v-if="loading" class="card h-72 animate-pulse bg-ink-100/40"></div>

        <div v-else class="space-y-3">
          <div v-for="m in filteredMatches" :key="m.id" class="card p-5">
            <div class="flex flex-wrap items-center gap-4">
              <div class="flex items-center gap-3 flex-1 min-w-[260px]">
                <div class="text-2xl">{{ m.home_team.flag_emoji }}</div>
                <div class="font-bold text-ink-900">{{ m.home_team.code }}</div>
                <span class="text-ink-300">vs</span>
                <div class="font-bold text-ink-900">{{ m.away_team.code }}</div>
                <div class="text-2xl">{{ m.away_team.flag_emoji }}</div>
                <span :class="['pill ml-2', m.status === 'completed' ? 'bg-mint-100 text-mint-700' : 'bg-ink-100 text-ink-600']">
                  {{ m.status }}
                </span>
              </div>

              <div class="flex items-center gap-2">
                <input v-model.number="editStates[m.id].home" type="number" min="0" class="w-16 input text-center !py-2 !px-2" placeholder="0" />
                <span class="text-ink-300 font-bold">-</span>
                <input v-model.number="editStates[m.id].away" type="number" min="0" class="w-16 input text-center !py-2 !px-2" placeholder="0" />
              </div>

              <select v-model="editStates[m.id].first" class="input !py-2 max-w-[200px]">
                <option :value="null">First to score</option>
                <option :value="m.home_team_id">{{ m.home_team.name }}</option>
                <option :value="m.away_team_id">{{ m.away_team.name }}</option>
              </select>

              <button @click="submit(m.id)" :disabled="saving === m.id" class="btn-primary !py-2 !px-4 text-sm">
                {{ saving === m.id ? 'Saving...' : m.status === 'completed' ? 'Update' : 'Submit' }}
              </button>
            </div>

            <div class="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-ink-100 text-xs">
              <span class="text-ink-400 font-semibold uppercase tracking-wider">Status</span>
              <button
                v-for="opt in ['scheduled', 'postponed', 'cancelled']"
                :key="opt"
                @click="setMatchStatus(m.id, opt as any)"
                :disabled="saving === m.id || m.status === opt"
                :class="[
                  'pill text-xs',
                  m.status === opt
                    ? 'bg-sky-500 text-white'
                    : opt === 'cancelled'
                      ? 'bg-coral-50 text-coral-700 hover:bg-coral-100'
                      : opt === 'postponed'
                        ? 'bg-sun-50 text-sun-700 hover:bg-sun-100'
                        : 'bg-ink-100 text-ink-700 hover:bg-ink-200',
                ]"
              >
                Mark {{ opt }}
              </button>
              <span v-if="m.status === 'cancelled'" class="text-coral-600 ml-1">Predictions cleared.</span>
              <span v-else-if="m.status === 'postponed'" class="text-sun-700 ml-1">Lock disabled until status reset.</span>
            </div>
          </div>
        </div>
      </div>

      <!-- PAYOUTS TAB -->
      <div v-if="activeTab === 'payouts'" class="space-y-5">
        <!-- Mark Paid section -->
        <div class="card p-5 space-y-4">
          <div>
            <h2 class="font-bold text-ink-900">Mark as paid</h2>
            <p class="text-sm text-ink-500">Send payout confirmation emails to winners. Individual or bulk.</p>
          </div>

          <!-- Individual payout -->
          <div class="rounded-2xl border border-ink-100 p-4 space-y-3">
            <div class="text-xs font-semibold uppercase tracking-wider text-ink-400">Individual payout notification</div>
            <div class="grid sm:grid-cols-3 gap-3">
              <div>
                <label class="label !mb-1">Recipient email</label>
                <input v-model="markPaidEmail" type="email" class="input !py-2" placeholder="user@email.com" />
              </div>
              <div>
                <label class="label !mb-1">Amount (NGN)</label>
                <input v-model.number="markPaidAmount" type="number" min="0" class="input !py-2" placeholder="100000" />
              </div>
              <div>
                <label class="label !mb-1">Reward type</label>
                <select v-model="markPaidType" class="input !py-2">
                  <option v-for="t in rewardTypes" :key="t" :value="t">{{ t }}</option>
                </select>
              </div>
            </div>
            <div class="flex items-center justify-between gap-3">
              <div>
                <p v-if="markPaidResult" :class="['text-sm', markPaidResult.success ? 'text-mint-700' : 'text-coral-600']">
                  {{ markPaidResult.message }}
                </p>
              </div>
              <button
                @click="markSinglePaid"
                :disabled="markPaidLoading || !markPaidEmail || !markPaidAmount"
                class="btn-primary !py-2 !px-4 text-sm"
              >
                {{ markPaidLoading ? 'Sending...' : 'Send notification' }}
              </button>
            </div>
          </div>

          <!-- Bulk payout from winners -->
          <div v-if="payoutSingle?.winners?.length" class="rounded-2xl border border-ink-100 p-4 space-y-3">
            <div class="text-xs font-semibold uppercase tracking-wider text-ink-400">Bulk notify current week winners</div>
            <p class="text-sm text-ink-500">Send payout notifications to all {{ payoutSingle.winners.length }} winners shown below.</p>
            <div class="flex flex-wrap items-end gap-3">
              <div>
                <label class="label !mb-1">Amount per winner (NGN)</label>
                <input v-model.number="bulkPayoutAmount" type="number" min="0" class="input !py-2 w-36" />
              </div>
              <div>
                <label class="label !mb-1">Reward type</label>
                <select v-model="bulkPayoutType" class="input !py-2">
                  <option v-for="t in rewardTypes" :key="t" :value="t">{{ t }}</option>
                </select>
              </div>
              <button
                @click="markBulkPaid(payoutSingle.winners, bulkPayoutType, bulkPayoutAmount)"
                :disabled="markPaidLoading || !bulkPayoutAmount"
                class="btn-primary !py-2 !px-4 text-sm"
              >
                {{ markPaidLoading ? 'Sending...' : `Notify all ${payoutSingle.winners.length} winners` }}
              </button>
            </div>
          </div>
        </div>

        <!-- Weekly payout export (existing) -->
        <div class="card p-5 space-y-4">
          <div>
            <h2 class="font-bold text-ink-900">Weekly payout export</h2>
            <p class="text-sm text-ink-500">Aggregate weekly winners based on the configured week start date.</p>
          </div>
          <div class="flex flex-wrap items-end gap-3">
            <div>
              <label class="label !mb-1">Week of (any date in week)</label>
              <input v-model="payoutWeekOf" type="date" class="input !py-2 w-44" />
            </div>
            <div>
              <label class="label !mb-1">Top N</label>
              <input v-model.number="payoutTopN" type="number" min="1" max="200" class="input !py-2 w-24" />
            </div>
            <div>
              <label class="label !mb-1">Filter</label>
              <select v-model="payoutFilter" class="input !py-2 w-32">
                <option value="public">Public</option>
                <option value="staff">Staff</option>
                <option value="all">All</option>
              </select>
            </div>
            <button @click="fetchSingleWeek" :disabled="payoutLoading" class="btn-primary !py-2 !px-4 text-sm">
              {{ payoutLoading ? 'Loading...' : 'Build single week' }}
            </button>
            <button @click="fetchAllWeeks" :disabled="payoutLoading" class="rounded-xl bg-ink-100 text-ink-700 font-bold py-2 px-4 text-sm hover:bg-ink-200 transition disabled:opacity-50">
              {{ payoutLoading ? 'Loading...' : 'Build all weeks' }}
            </button>
          </div>

          <div v-if="payoutSingle" class="space-y-2">
            <div class="flex items-center justify-between flex-wrap gap-2">
              <div class="text-sm text-ink-600">
                <span class="font-semibold">{{ payoutSingle.week_start.slice(0, 10) }}</span> - <span class="font-semibold">{{ payoutSingle.week_end.slice(0, 10) }}</span>
                · {{ payoutSingle.match_count }} matches · {{ payoutSingle.winners.length }} winners
              </div>
              <button v-if="payoutSingle.winners.length" @click="exportSingleCsv" class="pill bg-mint-50 text-mint-700 hover:bg-mint-100 text-xs">
                Download CSV
              </button>
            </div>
            <div v-if="!payoutSingle.winners.length" class="text-sm text-ink-400">No winners for this week.</div>
            <div v-else class="overflow-auto rounded-xl border border-ink-100">
              <table class="w-full text-sm">
                <thead class="bg-ink-50 text-ink-500 text-xs uppercase">
                  <tr>
                    <th class="text-left px-3 py-2">#</th>
                    <th class="text-left px-3 py-2">User</th>
                    <th class="text-left px-3 py-2">Account</th>
                    <th class="text-left px-3 py-2">Socials</th>
                    <th class="text-right px-3 py-2">Pts</th>
                    <th class="text-right px-3 py-2">Exact</th>
                    <th class="text-right px-3 py-2">Correct</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-ink-100">
                  <tr v-for="w in payoutSingle.winners" :key="w.user_id">
                    <td class="px-3 py-2 font-bold">{{ w.rank }}</td>
                    <td class="px-3 py-2">
                      <div class="font-semibold text-ink-900">{{ w.username || w.name }}</div>
                      <div class="text-xs text-ink-400">{{ w.email }}</div>
                    </td>
                    <td class="px-3 py-2 font-mono text-xs">{{ w.account_number || '-' }}</td>
                    <td class="px-3 py-2 text-xs text-ink-500">
                      <span v-if="w.social_handles?.twitter">X:@{{ w.social_handles.twitter }}</span>
                      <span v-if="w.social_handles?.instagram" class="ml-1">IG:@{{ w.social_handles.instagram }}</span>
                    </td>
                    <td class="px-3 py-2 text-right font-bold tabular-nums">{{ w.week_points }}</td>
                    <td class="px-3 py-2 text-right tabular-nums">{{ w.exact_scorelines }}</td>
                    <td class="px-3 py-2 text-right tabular-nums">{{ w.correct_predictions }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div v-if="payoutWeeks.length" class="space-y-3">
            <div class="flex items-center justify-between flex-wrap gap-2">
              <div class="text-sm text-ink-600">{{ payoutWeeks.length }} weeks</div>
              <button @click="exportAllWeeksCsv" class="pill bg-mint-50 text-mint-700 hover:bg-mint-100 text-xs">
                Download all-weeks CSV
              </button>
            </div>
            <div v-for="w in payoutWeeks" :key="w.week_start" class="rounded-xl border border-ink-100 p-3">
              <div class="text-sm font-semibold text-ink-800">
                {{ w.week_start.slice(0, 10) }} - {{ w.week_end.slice(0, 10) }}
                <span class="text-ink-400 font-normal text-xs">· {{ w.match_count }} matches · top {{ w.winners.length }}</span>
              </div>
              <div v-if="w.winners.length" class="mt-2 grid sm:grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <div v-for="winner in w.winners" :key="winner.user_id" class="flex items-center justify-between gap-2">
                  <span class="truncate"><span class="font-bold text-ink-700">#{{ winner.rank }}</span> {{ winner.name }}</span>
                  <span class="font-bold text-sky-600 tabular-nums">{{ winner.week_points }} pts</span>
                </div>
              </div>
              <div v-else class="text-xs text-ink-400 mt-1">No winners.</div>
            </div>
          </div>
        </div>
      </div>

      <!-- TEAMS TAB -->
      <div v-if="activeTab === 'teams'" class="space-y-4">
        <div class="card p-5 space-y-4">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h2 class="font-bold text-ink-900">Team elimination status</h2>
              <p class="text-sm text-ink-500">Teams are auto-eliminated on knockout loss. Toggle manually here if needed.</p>
            </div>
            <button @click="loadTeams" :disabled="teamsLoading" class="pill bg-ink-100 text-ink-700 hover:bg-ink-200 text-xs shrink-0">
              {{ teamsLoading ? 'Loading...' : 'Refresh' }}
            </button>
          </div>

          <div class="flex flex-wrap items-center gap-3">
            <div class="flex gap-1 bg-ink-50 rounded-lg p-1">
              <button
                v-for="opt in (['all', 'active', 'eliminated'] as const)"
                :key="opt"
                @click="teamsStatusFilter = opt"
                :class="[
                  'px-3 py-1.5 text-xs font-semibold rounded-md transition',
                  teamsStatusFilter === opt ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-700',
                ]"
              >
                {{ opt.charAt(0).toUpperCase() + opt.slice(1) }}
              </button>
            </div>
            <input
              v-model="teamsSearch"
              type="text"
              placeholder="Search teams..."
              class="input !py-2 !px-3 text-sm w-44"
            />
            <span class="text-xs text-ink-400 ml-auto">{{ filteredTeams.length }} of {{ teamsList.length }} teams</span>
          </div>

          <p v-if="teamsError" class="text-sm text-coral-600">{{ teamsError }}</p>

          <div v-if="filteredTeams.length" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            <div
              v-for="t in filteredTeams"
              :key="t.id"
              :class="[
                'rounded-xl border p-3 flex items-center justify-between gap-2 transition',
                t.is_eliminated ? 'border-coral-200 bg-coral-50/50' : 'border-ink-100',
              ]"
            >
              <div class="flex items-center gap-2 min-w-0">
                <span class="text-lg">{{ t.flag_emoji }}</span>
                <div class="min-w-0">
                  <div class="text-sm font-bold text-ink-900 truncate">{{ t.code }}</div>
                  <div v-if="t.is_eliminated" class="text-[10px] font-bold uppercase text-coral-600">Eliminated</div>
                  <div v-else class="text-[10px] font-bold uppercase text-mint-600">Active</div>
                </div>
              </div>
              <button
                @click="toggleElimination(t.id, t.is_eliminated)"
                :disabled="teamsLoading"
                :class="[
                  'pill text-[10px] shrink-0',
                  t.is_eliminated ? 'bg-mint-50 text-mint-700 hover:bg-mint-100' : 'bg-coral-50 text-coral-700 hover:bg-coral-100',
                ]"
              >
                {{ t.is_eliminated ? 'Reinstate' : 'Eliminate' }}
              </button>
            </div>
          </div>
          <div v-else-if="!teamsLoading" class="text-sm text-ink-400">{{ teamsList.length ? 'No teams match your filter.' : 'No teams found.' }}</div>
        </div>
      </div>

      <!-- REPORTS TAB -->
      <!-- USERS TAB -->
      <div v-if="activeTab === 'users'" class="space-y-5">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h2 class="text-xl font-extrabold text-ink-900">User export</h2>
            <p class="text-sm text-ink-500">Filter and export users as CSV.</p>
          </div>
        </div>

        <div class="card p-5 space-y-4">
          <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label class="label !mb-1">Filter</label>
              <select v-model="userFilter" class="input !py-2">
                <option v-for="o in userFilterOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
              </select>
            </div>
            <div>
              <label class="label !mb-1">From</label>
              <input v-model="userDateFrom" type="date" class="input !py-2" />
            </div>
            <div>
              <label class="label !mb-1">To</label>
              <input v-model="userDateTo" type="date" class="input !py-2" />
            </div>
            <div>
              <label class="label !mb-1">Email search</label>
              <input v-model="userSearchEmail" type="text" class="input !py-2" placeholder="e.g. @gmail.com" />
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-3">
            <button @click="loadUsersPreview" :disabled="usersPreviewLoading" class="btn-primary !py-2 !px-4 text-sm">
              {{ usersPreviewLoading ? 'Loading...' : 'Apply filters' }}
            </button>
            <button
              v-if="userDateFrom || userDateTo || userSearchEmail || userFilter !== 'all'"
              @click="userFilter = 'all'; userDateFrom = ''; userDateTo = ''; userSearchEmail = ''; loadUsersPreview()"
              class="pill bg-ink-100 text-ink-700 hover:bg-ink-200 text-xs"
            >
              Clear all
            </button>
            <div class="ml-auto flex items-center gap-3">
              <span v-if="usersPreviewTotal > 0" class="text-sm text-ink-600 font-semibold tabular-nums">
                {{ usersPreviewTotal.toLocaleString() }} user{{ usersPreviewTotal !== 1 ? 's' : '' }} matched
              </span>
              <select v-model="usersExportFormat" class="input !py-1.5 !px-2 !text-xs !w-auto !rounded-lg">
                <option value="csv">CSV</option>
                <option value="json">JSON</option>
              </select>
              <button
                @click="exportUsers"
                :disabled="usersExporting || usersPreviewTotal === 0"
                class="pill bg-mint-50 text-mint-700 hover:bg-mint-100 text-xs font-bold disabled:opacity-40"
              >
                <span class="flex items-center gap-1.5">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                  {{ usersExporting ? 'Exporting...' : `Export ${usersExportFormat.toUpperCase()}` }}
                </span>
              </button>
            </div>
          </div>
        </div>

        <div v-if="usersPreviewLoading && !usersPreview.length" class="card h-48 animate-pulse bg-ink-100/40"></div>

        <div v-else-if="usersPreview.length" class="card p-0 overflow-hidden">
          <div class="px-4 py-3 bg-ink-50 border-b border-ink-100 flex items-center justify-between">
            <span class="text-xs font-semibold text-ink-500 uppercase tracking-wider">Preview (first 20 of {{ usersPreviewTotal.toLocaleString() }})</span>
          </div>
          <div class="overflow-auto max-h-[28rem]">
            <table class="w-full text-sm">
              <thead class="bg-ink-50 text-ink-500 text-xs uppercase sticky top-0">
                <tr>
                  <th class="text-left px-3 py-2">Email</th>
                  <th class="text-left px-3 py-2">Name</th>
                  <th class="text-left px-3 py-2">Account</th>
                  <th class="text-center px-3 py-2">Active</th>
                  <th class="text-right px-3 py-2">Points</th>
                  <th class="text-left px-3 py-2">Joined</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-ink-100">
                <tr v-for="u in usersPreview" :key="u.id" class="hover:bg-ink-50/50">
                  <td class="px-3 py-2 font-mono text-xs text-ink-700 max-w-[200px] truncate">{{ u.email }}</td>
                  <td class="px-3 py-2 text-xs font-semibold text-ink-900 max-w-[140px] truncate">{{ u.name || u.username || '-' }}</td>
                  <td class="px-3 py-2 font-mono text-xs text-ink-600">{{ u.account_number || '-' }}</td>
                  <td class="px-3 py-2 text-center">
                    <span :class="u.active_customer_flag ? 'text-mint-600' : 'text-ink-300'" class="text-xs font-bold">{{ u.active_customer_flag ? 'Yes' : 'No' }}</span>
                  </td>
                  <td class="px-3 py-2 text-right font-bold tabular-nums text-ink-900">{{ u.total_points }}</td>
                  <td class="px-3 py-2 text-xs text-ink-500">{{ u.created_at?.slice(0, 10) || '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-else-if="!usersPreviewLoading && usersPreviewTotal === 0" class="card p-8 text-center">
          <p class="text-sm text-ink-500">No users match the current filters.</p>
        </div>
      </div>

      <!-- REPORTS TAB -->
      <div v-if="activeTab === 'reports'" class="space-y-5">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h2 class="text-xl font-extrabold text-ink-900">Platform reports</h2>
            <p class="text-sm text-ink-500">Overview of user engagement and growth.</p>
          </div>
          <button @click="loadReports" :disabled="reportLoading" class="pill bg-ink-100 text-ink-700 hover:bg-ink-200 text-xs">
            {{ reportLoading ? 'Loading...' : 'Refresh' }}
          </button>
        </div>

        <!-- Date filter -->
        <div class="card p-4">
          <div class="flex flex-wrap items-end gap-3">
            <div>
              <label class="label !mb-1">From</label>
              <input v-model="reportDateFrom" type="date" class="input !py-2 w-40" />
            </div>
            <div>
              <label class="label !mb-1">To</label>
              <input v-model="reportDateTo" type="date" class="input !py-2 w-40" />
            </div>
            <button @click="loadReports" :disabled="reportLoading" class="btn-primary !py-2 !px-4 text-sm">
              {{ reportLoading ? 'Loading...' : 'Apply filter' }}
            </button>
            <button
              v-if="reportDateFrom || reportDateTo"
              @click="reportDateFrom = ''; reportDateTo = ''; loadReports()"
              class="pill bg-ink-100 text-ink-700 hover:bg-ink-200 text-xs"
            >
              Clear dates
            </button>
          </div>
          <p v-if="reportDateFrom || reportDateTo" class="text-xs text-ink-500 mt-2">
            Showing data {{ reportDateFrom ? `from ${reportDateFrom}` : '' }}{{ reportDateFrom && reportDateTo ? ' ' : '' }}{{ reportDateTo ? `to ${reportDateTo}` : '' }}
          </p>
        </div>

        <div v-if="reportLoading && !reportData" class="card h-72 animate-pulse bg-ink-100/40"></div>

        <template v-else-if="reportData">
          <!-- Summary cards -->
          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div class="card p-4 text-center">
              <div class="text-2xl font-extrabold text-ink-900">{{ reportData.totalUsers }}</div>
              <div class="text-xs text-ink-500 font-semibold uppercase tracking-wider mt-1">Total users</div>
            </div>
            <div class="card p-4 text-center">
              <div class="text-2xl font-extrabold text-sky-600">{{ reportData.sycamoreUsers }}</div>
              <div class="text-xs text-ink-500 font-semibold uppercase tracking-wider mt-1">With account no.</div>
            </div>
            <div class="card p-4 text-center">
              <div class="text-2xl font-extrabold text-sun-600">{{ reportData.guestUsers }}</div>
              <div class="text-xs text-ink-500 font-semibold uppercase tracking-wider mt-1">No account no.</div>
            </div>
            <div class="card p-4 text-center">
              <div class="text-2xl font-extrabold text-mint-600">{{ reportData.activeCustomers }}</div>
              <div class="text-xs text-ink-500 font-semibold uppercase tracking-wider mt-1">Active customers</div>
            </div>
            <div class="card p-4 text-center">
              <div class="text-2xl font-extrabold text-coral-600">{{ reportData.usersWithTeam }}</div>
              <div class="text-xs text-ink-500 font-semibold uppercase tracking-wider mt-1">Backed a team</div>
            </div>
            <div class="card p-4 text-center">
              <div class="text-2xl font-extrabold text-ink-700">{{ reportData.totalPredictions }}</div>
              <div class="text-xs text-ink-500 font-semibold uppercase tracking-wider mt-1">Predictions</div>
            </div>
          </div>

          <!-- Additional stats -->
          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div class="card p-4 text-center">
              <div class="text-2xl font-extrabold text-teal-600">{{ reportData.savingsEnabled }}</div>
              <div class="text-xs text-ink-500 font-semibold uppercase tracking-wider mt-1">Auto-savings on</div>
            </div>
            <div class="card p-4 text-center">
              <div class="text-2xl font-extrabold text-teal-700">&#8358;{{ reportData.totalSavingsAmount.toLocaleString() }}</div>
              <div class="text-xs text-ink-500 font-semibold uppercase tracking-wider mt-1">Total savings amount</div>
            </div>
            <div class="card p-4 text-center">
              <div class="text-2xl font-extrabold text-mint-700">{{ reportData.matchesCompleted }}</div>
              <div class="text-xs text-ink-500 font-semibold uppercase tracking-wider mt-1">Matches played</div>
            </div>
            <div class="card p-4 text-center">
              <div class="text-2xl font-extrabold text-ink-500">{{ reportData.matchesScheduled }}</div>
              <div class="text-xs text-ink-500 font-semibold uppercase tracking-wider mt-1">Matches left</div>
            </div>
            <div class="card p-4 text-center">
              <div class="text-2xl font-extrabold text-mint-600">{{ reportData.correctPredictions }}</div>
              <div class="text-xs text-ink-500 font-semibold uppercase tracking-wider mt-1">Correct picks</div>
            </div>
            <div class="card p-4 text-center">
              <div class="text-2xl font-extrabold text-coral-500">{{ reportData.incorrectPredictions }}</div>
              <div class="text-xs text-ink-500 font-semibold uppercase tracking-wider mt-1">Missed picks</div>
            </div>
            <div class="card p-4 text-center">
              <div class="text-2xl font-extrabold text-sun-600">{{ reportData.exactScorelines }}</div>
              <div class="text-xs text-ink-500 font-semibold uppercase tracking-wider mt-1">Exact scorelines</div>
            </div>
          </div>

          <!-- Win/Loss ratio -->
          <div v-if="reportData.correctPredictions + reportData.incorrectPredictions > 0" class="card p-5 space-y-3">
            <h3 class="font-bold text-ink-900">Prediction accuracy (all users)</h3>
            <div class="flex items-center gap-3">
              <div class="flex-1 h-8 bg-ink-100 rounded-lg overflow-hidden flex">
                <div
                  class="h-full bg-mint-500 flex items-center justify-center text-xs font-bold text-white"
                  :style="{ width: (reportData.correctPredictions / (reportData.correctPredictions + reportData.incorrectPredictions) * 100) + '%' }"
                >
                  {{ Math.round(reportData.correctPredictions / (reportData.correctPredictions + reportData.incorrectPredictions) * 100) }}% correct
                </div>
                <div
                  class="h-full bg-coral-400 flex items-center justify-center text-xs font-bold text-white"
                  :style="{ width: (reportData.incorrectPredictions / (reportData.correctPredictions + reportData.incorrectPredictions) * 100) + '%' }"
                >
                  {{ Math.round(reportData.incorrectPredictions / (reportData.correctPredictions + reportData.incorrectPredictions) * 100) }}% wrong
                </div>
              </div>
            </div>
            <div class="text-xs text-ink-500">
              {{ reportData.exactScorelines }} exact scoreline{{ reportData.exactScorelines !== 1 ? 's' : '' }} out of {{ reportData.correctPredictions + reportData.incorrectPredictions }} scored predictions
              ({{ reportData.correctPredictions + reportData.incorrectPredictions > 0 ? Math.round(reportData.exactScorelines / (reportData.correctPredictions + reportData.incorrectPredictions) * 100) : 0 }}% hit rate)
            </div>
          </div>

          <!-- Team distribution -->
          <div v-if="reportData.teamDistribution.length" class="card p-5 space-y-3">
            <h3 class="font-bold text-ink-900">Team popularity</h3>
            <p class="text-sm text-ink-500">How many users backed each team.</p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div
                v-for="(t, i) in reportData.teamDistribution"
                :key="t.code"
                class="flex items-center gap-3 p-2 rounded-lg"
                :class="i < 3 ? 'bg-sky-50' : ''"
              >
                <span class="text-lg">{{ t.flag_emoji }}</span>
                <span class="text-sm font-bold text-ink-900 w-12">{{ t.code }}</span>
                <div class="flex-1 h-5 bg-ink-100 rounded overflow-hidden relative">
                  <div
                    class="h-full rounded"
                    :class="i === 0 ? 'bg-sky-500' : i === 1 ? 'bg-sky-400' : i === 2 ? 'bg-sky-300' : 'bg-ink-300'"
                    :style="{ width: (t.count / reportData.teamDistribution[0].count * 100) + '%' }"
                  ></div>
                </div>
                <span class="text-sm font-bold text-ink-700 w-8 text-right tabular-nums">{{ t.count }}</span>
              </div>
            </div>
          </div>

          <!-- Conversion funnel -->
          <div class="card p-5 space-y-3">
            <h3 class="font-bold text-ink-900">Conversion funnel</h3>
            <div class="space-y-2">
              <div class="flex items-center gap-3">
                <div class="w-32 text-sm text-ink-600">All signups</div>
                <div class="flex-1 h-7 bg-ink-100 rounded-lg overflow-hidden relative">
                  <div class="h-full bg-ink-400 rounded-lg" style="width: 100%"></div>
                  <span class="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">{{ reportData.totalUsers }}</span>
                </div>
              </div>
              <div class="flex items-center gap-3">
                <div class="w-32 text-sm text-ink-600">With account no.</div>
                <div class="flex-1 h-7 bg-ink-100 rounded-lg overflow-hidden relative">
                  <div class="h-full bg-sky-500 rounded-lg" :style="{ width: reportData.totalUsers ? (reportData.sycamoreUsers / reportData.totalUsers * 100) + '%' : '0%' }"></div>
                  <span class="absolute inset-0 flex items-center justify-center text-xs font-bold" :class="reportData.sycamoreUsers > reportData.totalUsers * 0.5 ? 'text-white' : 'text-ink-700'">{{ reportData.sycamoreUsers }} ({{ reportData.totalUsers ? Math.round(reportData.sycamoreUsers / reportData.totalUsers * 100) : 0 }}%)</span>
                </div>
              </div>
              <div class="flex items-center gap-3">
                <div class="w-32 text-sm text-ink-600">Active</div>
                <div class="flex-1 h-7 bg-ink-100 rounded-lg overflow-hidden relative">
                  <div class="h-full bg-mint-500 rounded-lg" :style="{ width: reportData.totalUsers ? (reportData.activeCustomers / reportData.totalUsers * 100) + '%' : '0%' }"></div>
                  <span class="absolute inset-0 flex items-center justify-center text-xs font-bold" :class="reportData.activeCustomers > reportData.totalUsers * 0.5 ? 'text-white' : 'text-ink-700'">{{ reportData.activeCustomers }} ({{ reportData.totalUsers ? Math.round(reportData.activeCustomers / reportData.totalUsers * 100) : 0 }}%)</span>
                </div>
              </div>
              <div class="flex items-center gap-3">
                <div class="w-32 text-sm text-ink-600">Backed team</div>
                <div class="flex-1 h-7 bg-ink-100 rounded-lg overflow-hidden relative">
                  <div class="h-full bg-coral-400 rounded-lg" :style="{ width: reportData.totalUsers ? (reportData.usersWithTeam / reportData.totalUsers * 100) + '%' : '0%' }"></div>
                  <span class="absolute inset-0 flex items-center justify-center text-xs font-bold" :class="reportData.usersWithTeam > reportData.totalUsers * 0.5 ? 'text-white' : 'text-ink-700'">{{ reportData.usersWithTeam }} ({{ reportData.totalUsers ? Math.round(reportData.usersWithTeam / reportData.totalUsers * 100) : 0 }}%)</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Acquisition (organic predictor signups) -->
          <div class="card p-5 space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="font-bold text-ink-900">Organic acquisition</h3>
                <p class="text-sm text-ink-500">Users who signed up on the predictor after launch (post Jun 8) and never transacted on Sycamore.</p>
              </div>
              <button
                @click="exportAcquisitionCsv"
                :disabled="acquisitionExporting || !acquisitionData"
                class="pill bg-sky-100 text-sky-700 hover:bg-sky-200 text-xs shrink-0"
              >
                {{ acquisitionExporting ? 'Exporting...' : 'Export CSV' }}
              </button>
            </div>

            <div v-if="acquisitionLoading && !acquisitionData" class="h-20 bg-ink-100/40 rounded-xl animate-pulse"></div>

            <div v-else-if="acquisitionData" class="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div class="bg-slate-50 rounded-xl p-4 text-center">
                <div class="text-2xl font-extrabold text-ink-900">{{ acquisitionData.totalOrganic.toLocaleString() }}</div>
                <div class="text-xs text-ink-500 font-semibold uppercase tracking-wider mt-1">Total organic signups</div>
              </div>
              <div class="bg-slate-50 rounded-xl p-4 text-center">
                <div class="text-2xl font-extrabold text-coral-600">{{ acquisitionData.neverTransacted.toLocaleString() }}</div>
                <div class="text-xs text-ink-500 font-semibold uppercase tracking-wider mt-1">Never transacted</div>
              </div>
              <div class="bg-slate-50 rounded-xl p-4 text-center">
                <div class="text-2xl font-extrabold text-mint-600">{{ acquisitionData.becameActive.toLocaleString() }}</div>
                <div class="text-xs text-ink-500 font-semibold uppercase tracking-wider mt-1">Became active</div>
              </div>
              <div class="bg-slate-50 rounded-xl p-4 text-center">
                <div class="text-2xl font-extrabold text-sky-600">{{ acquisitionData.conversionRate }}%</div>
                <div class="text-xs text-ink-500 font-semibold uppercase tracking-wider mt-1">Conversion rate</div>
              </div>
            </div>

            <div v-if="acquisitionData" class="flex items-center gap-3">
              <div class="flex-1 h-8 bg-ink-100 rounded-lg overflow-hidden flex">
                <div
                  class="h-full bg-mint-500 flex items-center justify-center text-xs font-bold text-white"
                  :style="{ width: acquisitionData.conversionRate + '%' }"
                >
                  {{ acquisitionData.conversionRate }}% converted
                </div>
                <div
                  class="h-full bg-coral-400 flex items-center justify-center text-xs font-bold text-white"
                  :style="{ width: (100 - acquisitionData.conversionRate) + '%' }"
                >
                  {{ 100 - acquisitionData.conversionRate }}% unconverted
                </div>
              </div>
            </div>
          </div>

          <!-- Daily signups -->
          <div class="card p-5 space-y-3">
            <h3 class="font-bold text-ink-900">Daily signups</h3>
            <div v-if="!reportData.dailySignups.length" class="text-sm text-ink-400">No data yet.</div>
            <div v-else class="overflow-x-auto">
              <div class="flex items-end gap-1 h-40 pt-8 min-w-[400px] relative">
                <div
                  v-for="d in reportData.dailySignups"
                  :key="d.date"
                  class="flex-1 min-w-[24px] h-full flex flex-col items-center justify-end group relative"
                >
                  <div class="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 bg-ink-800 text-white text-[10px] font-bold px-2 py-1 rounded whitespace-nowrap z-10 pointer-events-none transition-opacity">
                    {{ d.date.slice(5) }}: {{ d.count }}
                  </div>
                  <div
                    class="w-full bg-sky-400 rounded-sm group-hover:bg-sky-500 transition cursor-pointer"
                    :style="{ height: Math.max(4, (d.count / Math.max(...reportData.dailySignups.map(x => x.count))) * 100) + '%' }"
                  ></div>
                </div>
              </div>
              <div class="flex gap-1 mt-1 min-w-[400px]">
                <div v-for="(d, i) in reportData.dailySignups" :key="d.date" class="flex-1 min-w-[24px] text-center">
                  <span v-if="i === 0 || i === reportData.dailySignups.length - 1" class="text-[9px] text-ink-400">{{ d.date.slice(5) }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Daily predictions -->
          <div class="card p-5 space-y-3">
            <h3 class="font-bold text-ink-900">Daily predictions</h3>
            <div v-if="!reportData.dailyPredictions.length" class="text-sm text-ink-400">No data yet.</div>
            <div v-else class="overflow-x-auto">
              <div class="flex items-end gap-1 h-40 pt-8 min-w-[400px] relative">
                <div
                  v-for="d in reportData.dailyPredictions"
                  :key="d.date"
                  class="flex-1 min-w-[24px] h-full flex flex-col items-center justify-end group relative"
                >
                  <div class="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 bg-ink-800 text-white text-[10px] font-bold px-2 py-1 rounded whitespace-nowrap z-10 pointer-events-none transition-opacity">
                    {{ d.date.slice(5) }}: {{ d.count }}
                  </div>
                  <div
                    class="w-full bg-mint-400 rounded-sm group-hover:bg-mint-500 transition cursor-pointer"
                    :style="{ height: Math.max(4, (d.count / Math.max(...reportData.dailyPredictions.map(x => x.count))) * 100) + '%' }"
                  ></div>
                </div>
              </div>
              <div class="flex gap-1 mt-1 min-w-[400px]">
                <div v-for="(d, i) in reportData.dailyPredictions" :key="d.date" class="flex-1 min-w-[24px] text-center">
                  <span v-if="i === 0 || i === reportData.dailyPredictions.length - 1" class="text-[9px] text-ink-400">{{ d.date.slice(5) }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Guest users list -->
          <div class="card p-5 space-y-3">
            <div class="flex items-center justify-between gap-3">
              <div>
                <h3 class="font-bold text-ink-900">Users without account numbers</h3>
                <p class="text-sm text-ink-500">These users have signed in but don't have a Sycamore account number yet.</p>
              </div>
              <button
                @click="exportGuestCsv"
                :disabled="guestExportLoading || !reportData || reportData.guestUsers === 0"
                class="pill bg-mint-50 text-mint-700 hover:bg-mint-100 text-xs shrink-0"
              >
                {{ guestExportLoading ? 'Exporting...' : 'Export CSV' }}
              </button>
            </div>
            <div v-if="reportData.guestUsers === 0" class="text-sm text-ink-400">All users have account numbers.</div>
            <div v-else class="text-sm text-ink-600">
              {{ reportData.guestUsers }} users without an account number.
              <button @click="loadGuestList" :disabled="guestListLoading" class="ml-2 pill bg-ink-100 text-ink-700 hover:bg-ink-200 text-xs">
                {{ guestListLoading ? 'Loading...' : 'View list' }}
              </button>
            </div>
            <div v-if="guestList.length" class="overflow-auto rounded-xl border border-ink-100 max-h-64">
              <table class="w-full text-sm">
                <thead class="bg-ink-50 text-ink-500 text-xs uppercase sticky top-0">
                  <tr>
                    <th class="text-left px-3 py-2">Email</th>
                    <th class="text-left px-3 py-2">Username</th>
                    <th class="text-left px-3 py-2">Joined</th>
                    <th class="text-right px-3 py-2">Predictions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-ink-100">
                  <tr v-for="g in guestList" :key="g.email">
                    <td class="px-3 py-2 font-mono text-xs">{{ g.email }}</td>
                    <td class="px-3 py-2 text-xs text-ink-700 font-semibold">{{ g.username || '-' }}</td>
                    <td class="px-3 py-2 text-xs text-ink-500">{{ g.created_at?.slice(0, 10) || '-' }}</td>
                    <td class="px-3 py-2 text-right font-bold tabular-nums">{{ g.prediction_count }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </template>
      </div>

      <!-- ADMINS TAB -->
      <div v-if="activeTab === 'admins'" class="space-y-5">
        <div class="card p-5 space-y-5">
          <div>
            <h2 class="font-bold text-ink-900">Admin team</h2>
            <p class="text-sm text-ink-500">Grant and revoke staff access by role.</p>
          </div>

          <div class="rounded-2xl border border-ink-100 p-4 space-y-3">
            <div class="text-xs font-semibold uppercase tracking-wider text-ink-400">Add or update an admin</div>
            <div class="grid sm:grid-cols-2 gap-3">
              <div>
                <label class="label !mb-1">Email</label>
                <input v-model="newAdminEmail" type="email" class="input !py-2" placeholder="staff@sycamore.ng" />
              </div>
              <div>
                <label class="label !mb-1">Display name</label>
                <input v-model="newAdminName" type="text" class="input !py-2" placeholder="Optional" />
              </div>
            </div>
            <div>
              <label class="label !mb-1">Role</label>
              <div class="grid sm:grid-cols-2 gap-2">
                <label
                  v-for="r in availableRoles"
                  :key="r.value"
                  :class="[
                    'rounded-xl border p-3 cursor-pointer transition',
                    newAdminRole === r.value ? 'border-sky-500 bg-sky-50' : 'border-ink-100 hover:border-ink-200',
                  ]"
                >
                  <div class="flex items-center gap-2">
                    <input type="radio" :value="r.value" v-model="newAdminRole" class="accent-sky-500" />
                    <span class="font-bold text-ink-900 text-sm">{{ r.label }}</span>
                  </div>
                  <p class="mt-1 text-xs text-ink-500">{{ r.description }}</p>
                </label>
              </div>
            </div>
            <div class="flex items-center justify-between gap-3">
              <p v-if="adminError" class="text-sm text-coral-600">{{ adminError }}</p>
              <span v-else></span>
              <button @click="upsertAdmin" :disabled="adminLoading || !newAdminEmail" class="btn-primary !py-2 !px-4 text-sm">
                {{ adminLoading ? 'Saving...' : 'Save admin' }}
              </button>
            </div>
          </div>

          <div>
            <div class="flex items-center justify-between mb-2">
              <h3 class="font-bold text-ink-900 text-sm">Current admins</h3>
              <button @click="loadAdmins" :disabled="adminLoading" class="pill bg-ink-100 text-ink-700 hover:bg-ink-200 text-xs">
                {{ adminLoading ? 'Loading...' : 'Refresh' }}
              </button>
            </div>
            <div v-if="!adminsList.length" class="text-sm text-ink-400">No admins yet.</div>
            <div v-else class="overflow-auto rounded-xl border border-ink-100">
              <table class="w-full text-sm">
                <thead class="bg-ink-50 text-ink-500 text-xs uppercase">
                  <tr>
                    <th class="text-left px-3 py-2">Name</th>
                    <th class="text-left px-3 py-2">Email</th>
                    <th class="text-left px-3 py-2">Role</th>
                    <th class="text-right px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-ink-100">
                  <tr v-for="a in adminsList" :key="a.email">
                    <td class="px-3 py-2 font-semibold text-ink-900">{{ a.name || '-' }}</td>
                    <td class="px-3 py-2 font-mono text-xs text-ink-600">{{ a.email }}</td>
                    <td class="px-3 py-2">
                      <span class="pill bg-sky-50 text-sky-700 text-xs">{{ a.role.replace('_', ' ') }}</span>
                    </td>
                    <td class="px-3 py-2 text-right">
                      <button
                        v-if="a.email !== admin?.email"
                        @click="removeAdmin(a.email)"
                        :disabled="adminLoading"
                        class="pill bg-coral-50 text-coral-700 hover:bg-coral-100 text-xs"
                      >
                        Remove
                      </button>
                      <span v-else class="text-xs text-ink-400">You</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- Confirmation Modal -->
    <Teleport to="body">
      <div v-if="confirmModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
        <div class="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
          <div class="flex items-start gap-3">
            <div :class="['w-10 h-10 rounded-xl grid place-items-center shrink-0', confirmModal.variant === 'warning' ? 'bg-sun-100' : 'bg-coral-100']">
              <svg :class="['w-5 h-5', confirmModal.variant === 'warning' ? 'text-sun-600' : 'text-coral-600']" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
            </div>
            <div>
              <h3 class="font-bold text-ink-900">{{ confirmModal.title }}</h3>
              <p class="text-sm text-ink-600 mt-1 leading-relaxed">{{ confirmModal.message }}</p>
            </div>
          </div>
          <div class="flex gap-3 pt-2">
            <button
              @click="executeConfirm"
              :disabled="confirmLoading"
              :class="[
                'flex-1 rounded-xl font-bold py-2.5 text-sm transition disabled:opacity-50',
                confirmModal.variant === 'warning'
                  ? 'bg-sun-500 text-white hover:bg-sun-600'
                  : 'bg-coral-600 text-white hover:bg-coral-700',
              ]"
            >
              {{ confirmLoading ? 'Processing...' : 'Confirm' }}
            </button>
            <button
              @click="confirmModal = null"
              :disabled="confirmLoading"
              class="flex-1 rounded-xl border border-ink-200 text-ink-700 font-bold py-2.5 text-sm hover:bg-ink-50 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
