<script setup lang="ts">
definePageMeta({ middleware: 'admin-auth', layout: false })

const supabase = useSupabase()
const { admin, hasPermission, adminLogout } = useAuth()
const { call } = useFunctions()

const canManageResults = computed(() => hasPermission('manage_results'))
const canManageFixtures = computed(() => hasPermission('manage_fixtures'))
const canViewPayouts = computed(() => hasPermission('view_payouts'))
const canManageAdmins = computed(() => hasPermission('manage_admins'))

type Tab = 'campaign' | 'fixtures' | 'results' | 'payouts' | 'teams' | 'users' | 'reports' | 'admins' | 'quests'

const tabs = computed<Array<{ key: Tab; label: string; show: boolean }>>(() => [
  { key: 'campaign', label: 'Campaign', show: true },
  { key: 'fixtures', label: 'Fixtures', show: canManageFixtures.value },
  { key: 'results', label: 'Results', show: canManageResults.value },
  { key: 'payouts', label: 'Payouts', show: canViewPayouts.value },
  { key: 'teams', label: 'Teams', show: canManageResults.value },
  { key: 'users', label: 'Users', show: true },
  { key: 'reports', label: 'Reports', show: true },
  { key: 'quests', label: 'Side Quests', show: true },
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
const campaignConfig = ref<Record<string, any> | null>(null)
const campaignLoading = ref(false)

const loadCampaignConfig = async () => {
  campaignLoading.value = true
  const { data } = await supabase
    .from('campaigns')
    .select('*')
    .eq('is_active', true)
    .maybeSingle()
  campaignConfig.value = data
  campaignLoading.value = false
}

const toggleCampaignField = async (field: 'predictions_enabled' | 'leaderboard_enabled' | 'team_picking_enabled' | 'public_access_enabled' | 'require_eligibility_leaderboard' | 'require_eligibility_chips') => {
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
      fields: { name: campaignConfig.value.name },
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

const updateChipConfig = async () => {
  if (!campaignConfig.value) return
  campaignLoading.value = true
  try {
    await call('campaign-config-update', {
      admin_email: admin.value!.email,
      fields: {
        max_double_down_uses: campaignConfig.value.max_double_down_uses,
        max_triple_captain_uses: campaignConfig.value.max_triple_captain_uses,
        max_first_blood_uses: campaignConfig.value.max_first_blood_uses,
        max_streak_shield_uses: campaignConfig.value.max_streak_shield_uses,
        max_last_stand_uses: campaignConfig.value.max_last_stand_uses,
        max_perfect_week_uses: campaignConfig.value.max_perfect_week_uses,
        total_matchweeks: campaignConfig.value.total_matchweeks,
      },
    })
  } catch (err: any) {
    error.value = `Failed to update chip config: ${err.message}`
  }
  campaignLoading.value = false
}

const updateScoringConfig = async () => {
  if (!campaignConfig.value) return
  campaignLoading.value = true
  try {
    await call('campaign-config-update', {
      admin_email: admin.value!.email,
      fields: {
        scoring_result: campaignConfig.value.scoring_result,
        scoring_first_to_score: campaignConfig.value.scoring_first_to_score,
        scoring_exact_ft: campaignConfig.value.scoring_exact_ft,
        scoring_exact_aet: campaignConfig.value.scoring_exact_aet,
        scoring_exact_pen: campaignConfig.value.scoring_exact_pen,
        upset_multiplier_enabled: campaignConfig.value.upset_multiplier_enabled,
        upset_multiplier_favourite: campaignConfig.value.upset_multiplier_favourite,
        upset_multiplier_draw: campaignConfig.value.upset_multiplier_draw,
        upset_multiplier_underdog: campaignConfig.value.upset_multiplier_underdog,
      },
    })
  } catch (err: any) {
    error.value = `Failed to update scoring config: ${err.message}`
  }
  campaignLoading.value = false
}

// --- Streak Milestones ---
const milestones = ref<Array<{ id: string; threshold: number; bonus_points: number }>>([])
const milestonesLoading = ref(false)
const newMilestoneThreshold = ref<number | null>(null)
const newMilestonePoints = ref<number | null>(null)

const loadMilestones = async () => {
  if (!campaignConfig.value) return
  milestonesLoading.value = true
  const { data } = await supabase
    .from('streak_milestones')
    .select('id, threshold, bonus_points')
    .eq('campaign_id', campaignConfig.value.id)
    .order('threshold', { ascending: true })
  milestones.value = data || []
  milestonesLoading.value = false
}

const addMilestone = async () => {
  if (!campaignConfig.value || !newMilestoneThreshold.value || !newMilestonePoints.value) return
  milestonesLoading.value = true
  const { error: err } = await supabase.from('streak_milestones').insert({
    campaign_id: campaignConfig.value.id,
    threshold: newMilestoneThreshold.value,
    bonus_points: newMilestonePoints.value,
  })
  if (err) {
    error.value = `Failed to add milestone: ${err.message}`
  } else {
    newMilestoneThreshold.value = null
    newMilestonePoints.value = null
  }
  await loadMilestones()
  milestonesLoading.value = false
}

const removeMilestone = async (id: string) => {
  milestonesLoading.value = true
  await supabase.from('streak_milestones').delete().eq('id', id)
  await loadMilestones()
  milestonesLoading.value = false
}

watch(campaignConfig, (cfg) => {
  if (cfg) loadMilestones()
}, { immediate: true })

// --- Side Quests ---
const sideQuests = ref<any[]>([])
const sideQuestsLoading = ref(false)
const generateWeek = ref<number | null>(null)
const generateResult = ref<string | null>(null)
const newQuestTitle = ref('')
const newQuestType = ref('total_goals_over_under')
const newQuestMatchweek = ref<number | null>(null)
const newQuestPoints = ref(10)
const newQuestOptions = ref('')
const newQuestLocksAt = ref('')
const newQuestLineupLock = ref(false)

// Sub-panels so the quests tab isn't one long scroll
const questPanel = ref<'suggest' | 'custom' | 'manage' | 'tools'>('suggest')

// Suggested quests (preview -> review -> publish)
const suggestWeek = ref<number | null>(null)
const suggesting = ref(false)
const publishing = ref(false)
const suggestNote = ref<string | null>(null)
const suggestedQuests = ref<Array<any & { include: boolean }>>([])

const adminFetchHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
  }
  if (import.meta.client) {
    const token = localStorage.getItem(APP_ADMIN_TOKEN_KEY)
    if (token) headers['x-app-admin-token'] = token
  }
  return headers
}

const suggestQuests = async () => {
  if (!suggestWeek.value) return
  suggesting.value = true
  suggestNote.value = null
  suggestedQuests.value = []
  try {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/side-quests/preview`, {
      method: 'POST',
      headers: adminFetchHeaders(),
      body: JSON.stringify({ matchweek: suggestWeek.value }),
    })
    const data = await res.json()
    if (!res.ok) { suggestNote.value = `Error: ${data.error || 'Could not build suggestions'}`; return }
    const list = Array.isArray(data.quests) ? data.quests : []
    if (!list.length) { suggestNote.value = `Nothing new to suggest for MW ${suggestWeek.value} — every standard quest type already exists.`; return }
    suggestedQuests.value = list.map((q: any) => ({ ...q, include: true }))
  } catch (err: any) {
    suggestNote.value = `Error: ${err.message}`
  } finally {
    suggesting.value = false
  }
}

const publishSuggested = async () => {
  if (!admin.value) return
  const chosen = suggestedQuests.value.filter((q) => q.include)
  if (!chosen.length) return
  publishing.value = true
  suggestNote.value = null
  try {
    const quests = chosen.map((q) => ({
      matchweek: q.matchweek ?? suggestWeek.value ?? null,
      quest_type: q.quest_type,
      title: q.title,
      description: q.description || '',
      options: q.options,
      options_meta: q.options_meta || {},
      point_value: Math.max(1, Number(q.point_value) || 10),
      locks_at: q.locks_at ?? null,
    }))
    const res = await call('side-quests/publish', { admin_email: admin.value.email, quests })
    suggestNote.value = `Published ${res.published} quest${res.published === 1 ? '' : 's'} for MW ${suggestWeek.value}.`
    suggestedQuests.value = []
    await loadSideQuests()
  } catch (err: any) {
    suggestNote.value = `Error: ${err.message}`
  } finally {
    publishing.value = false
  }
}

const optionPresets: Array<{ label: string; value: string }> = [
  { label: 'Yes / No', value: 'Yes, No' },
  { label: 'Over / Under', value: 'Over, Under' },
  { label: 'Home / Draw / Away', value: 'Home, Draw, Away' },
  { label: 'Count 0–5+', value: '0, 1, 2, 3, 4, 5+' },
]

const questMode = ref<'text' | 'players' | 'player_score'>('text')
const questTeams = ref<Array<{ id: string; name: string; logo_url: string | null }>>([])
const questTeamId = ref('')
const questTeamPlayers = ref<Array<{ id: string; name: string; position: string | null; photo_url: string | null; api_football_id: number | null; team_id: string }>>([])
const questPlayersLoading = ref(false)
const questSelectedPlayers = ref<Array<{ id: string; name: string; photo_url: string | null; team_name: string; api_football_id: number | null; team_id: string }>>([])

const loadQuestTeams = async () => {
  if (!campaignConfig.value?.id || questTeams.value.length) return
  const { data } = await supabase
    .from('campaign_teams')
    .select('team:teams!campaign_teams_team_id_fkey(id, name, logo_url)')
    .eq('campaign_id', campaignConfig.value.id)
  questTeams.value = (data || [])
    .map((r: any) => r.team)
    .filter(Boolean)
    .sort((a: any, b: any) => a.name.localeCompare(b.name))
}

const loadTeamPlayers = async () => {
  questTeamPlayers.value = []
  if (!campaignConfig.value?.id || !questTeamId.value) return
  questPlayersLoading.value = true
  const { data } = await supabase
    .from('players')
    .select('id, name, position, photo_url, api_football_id, team_id')
    .eq('campaign_id', campaignConfig.value.id)
    .eq('team_id', questTeamId.value)
    .eq('active', true)
    .order('name', { ascending: true })
  questTeamPlayers.value = data || []
  questPlayersLoading.value = false
}

watch(questTeamId, loadTeamPlayers)

const isPlayerSelected = (id: string) => questSelectedPlayers.value.some((p) => p.id === id)

const togglePlayerOption = (player: { id: string; name: string; photo_url: string | null; api_football_id?: number | null; team_id?: string }) => {
  const idx = questSelectedPlayers.value.findIndex((p) => p.id === player.id)
  if (idx >= 0) {
    questSelectedPlayers.value.splice(idx, 1)
    return
  }
  const teamName = questTeams.value.find((t) => t.id === questTeamId.value)?.name || ''
  const entry = {
    id: player.id,
    name: player.name,
    photo_url: player.photo_url,
    team_name: teamName,
    api_football_id: player.api_football_id ?? null,
    team_id: player.team_id ?? questTeamId.value,
  }
  // In single-player mode only one player can be selected at a time.
  if (questMode.value === 'player_score') {
    questSelectedPlayers.value = [entry]
  } else {
    questSelectedPlayers.value.push(entry)
  }
}

const loadSideQuests = async () => {
  if (!campaignConfig.value) return
  sideQuestsLoading.value = true
  const { data } = await supabase
    .from('side_quests')
    .select('*')
    .eq('campaign_id', campaignConfig.value.id)
    .order('matchweek', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(50)
  sideQuests.value = data || []
  sideQuestsLoading.value = false
}

const generateQuests = async () => {
  if (!generateWeek.value) return
  sideQuestsLoading.value = true
  generateResult.value = null
  try {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/side-quests/generate`, {
      method: 'POST',
      headers: adminFetchHeaders(),
      body: JSON.stringify({ matchweek: generateWeek.value }),
    })
    const data = await res.json()
    generateResult.value = data.generated ? `Generated ${data.generated} quests for MW ${generateWeek.value}` : (data.message || 'No quests generated')
    await loadSideQuests()
  } catch (err: any) {
    generateResult.value = `Error: ${err.message}`
  }
  sideQuestsLoading.value = false
}

const h2hWeek = ref<number | null>(null)
const h2hLoading = ref(false)
const h2hResult = ref<string | null>(null)
const h2hOptInCount = ref<number | null>(null)

watch(h2hWeek, async (week) => {
  h2hOptInCount.value = null
  if (!week || !campaignConfig.value?.id) return
  const { count } = await supabase.from('h2h_optins')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaignConfig.value.id)
    .eq('week_number', week)
  h2hOptInCount.value = count || 0
})

const h2hConfigSaved = ref(false)
const updateH2HConfig = async () => {
  if (!campaignConfig.value) return
  campaignLoading.value = true
  h2hConfigSaved.value = false
  try {
    await call('campaign-config-update', {
      admin_email: admin.value!.email,
      fields: { h2h_weekly_limit: campaignConfig.value.h2h_weekly_limit || 0 },
    })
    h2hConfigSaved.value = true
  } catch (err: any) {
    error.value = `Failed to update H2H limit: ${err.message}`
  }
  campaignLoading.value = false
}

const syncPlayersLoading = ref(false)
const syncPlayersResult = ref<string | null>(null)

const syncPlayers = async (force = false) => {
  if (!campaignConfig.value?.id) return
  syncPlayersLoading.value = true
  syncPlayersResult.value = null
  try {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-players`, {
      method: 'POST',
      headers: adminFetchHeaders(),
      body: JSON.stringify({ campaign_id: campaignConfig.value.id, force }),
    })
    const data = await res.json()
    if (!res.ok) {
      syncPlayersResult.value = `Error: ${data.error || 'Failed to sync players'}`
    } else {
      const failNote = data.failures?.length ? ` (${data.failures.length} club(s) rate-limited - run again in a minute)` : ''
      syncPlayersResult.value = `Added ${data.players_upserted} players across ${data.teams_processed} club(s), ${data.teams_skipped} already up to date${failNote}.`
      questTeams.value = []
    }
  } catch (err: any) {
    syncPlayersResult.value = `Error: ${err.message}`
  }
  syncPlayersLoading.value = false
}

const generateH2HPairings = async () => {
  if (!campaignConfig.value || !h2hWeek.value) return
  h2hLoading.value = true
  h2hResult.value = null
  try {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/predictions/generate-h2h`, {
      method: 'POST',
      headers: adminFetchHeaders(),
      body: JSON.stringify({ campaign_id: campaignConfig.value.id, week_number: h2hWeek.value }),
    })
    const data = await res.json()
    if (!res.ok) {
      h2hResult.value = `Error: ${data.error || 'Failed to generate pairings'}`
    } else {
      h2hResult.value = `Created ${data.pairings_created} matchups for week ${h2hWeek.value}${data.bye ? ' (1 player has a bye)' : ''}`
    }
  } catch (err: any) {
    h2hResult.value = `Error: ${err.message}`
  }
  h2hLoading.value = false
}

// Compose the current form into a quest draft. Titles keep the {MW} placeholder
// so the same draft can be saved one-off (placeholder filled) or as a reusable
// template (placeholder preserved for the weekly suggestion engine).
const buildQuestDraft = (): { questType: string; title: string; options: string[]; optionsMeta: Record<string, any> } | null => {
  let options: string[]
  let optionsMeta: Record<string, any> = {}
  let questType = newQuestType.value
  let title = newQuestTitle.value.trim()

  if (questMode.value === 'player_score') {
    if (questSelectedPlayers.value.length !== 1) {
      alert('Pick exactly one player for a "will they score?" quest.')
      return null
    }
    const p = questSelectedPlayers.value[0]
    questType = 'player_to_score'
    options = ['yes', 'no']
    optionsMeta = {
      labels: { yes: 'Yes', no: 'No' },
      player: { api_id: p.api_football_id, name: p.name, photo_url: p.photo_url, team_id: p.team_id },
    }
    if (!title) title = `Will ${p.name} score in MW{MW}?`
  } else if (questMode.value === 'players') {
    if (questSelectedPlayers.value.length < 2) {
      alert('Pick at least two players as options.')
      return null
    }
    if (!title) { alert('Add a title.'); return null }
    options = questSelectedPlayers.value.map((p) => p.id)
    const labels: Record<string, string> = {}
    const players: Record<string, any> = {}
    for (const p of questSelectedPlayers.value) {
      labels[p.id] = p.name
      players[p.id] = { name: p.name, photo_url: p.photo_url, team_name: p.team_name }
    }
    optionsMeta = { labels, players }
    questType = 'player_pick'
  } else {
    if (!title) { alert('Add a title.'); return null }
    options = newQuestOptions.value.split(',').map((o) => o.trim()).filter(Boolean)
  }

  if (options.length < 2) {
    alert('Add at least two answer options.')
    return null
  }
  return { questType, title, options, optionsMeta }
}

const resetQuestForm = () => {
  newQuestTitle.value = ''
  newQuestOptions.value = ''
  questSelectedPlayers.value = []
  questTeamId.value = ''
  newQuestLocksAt.value = ''
  newQuestLineupLock.value = false
}

const createCustomQuest = async () => {
  if (!admin.value) return
  const draft = buildQuestDraft()
  if (!draft) return

  const mw = newQuestMatchweek.value || null
  let title = draft.title
  if (mw) title = title.replaceAll('{MW}', String(mw))
  else title = title.replace(/\s*in MW\{MW\}/i, '').replaceAll('{MW}', '')

  sideQuestsLoading.value = true
  try {
    await call('side-quests/create', {
      admin_email: admin.value.email,
      quest: {
        matchweek: mw,
        quest_type: draft.questType,
        title,
        options: draft.options,
        options_meta: draft.optionsMeta,
        point_value: newQuestPoints.value,
        locks_at: newQuestLocksAt.value ? new Date(newQuestLocksAt.value).toISOString() : null,
        lock_buffer_minutes: newQuestLineupLock.value ? 75 : 0,
      },
    })
    resetQuestForm()
    await loadSideQuests()
  } catch (err: any) {
    alert(`Could not create quest: ${err.message}`)
  }
  sideQuestsLoading.value = false
}

// --- Quest template library (reusable suggestion pool) ---
const templates = ref<any[]>([])
const templatesLoading = ref(false)
const templateGlobal = ref(false)
const templateNote = ref<string | null>(null)

const loadTemplates = async () => {
  if (!admin.value) return
  templatesLoading.value = true
  try {
    const res = await call('side-quests/templates-list', { admin_email: admin.value.email })
    templates.value = res.templates || []
  } catch (err: any) {
    templateNote.value = `Error: ${err.message}`
  }
  templatesLoading.value = false
}

const saveAsTemplate = async () => {
  if (!admin.value) return
  const draft = buildQuestDraft()
  if (!draft) return
  templateNote.value = null
  templatesLoading.value = true
  try {
    await call('side-quests/template-save', {
      admin_email: admin.value.email,
      template: {
        global: templateGlobal.value,
        quest_type: draft.questType,
        title: draft.title,
        options: draft.options,
        options_meta: draft.optionsMeta,
        point_value: newQuestPoints.value,
      },
    })
    templateNote.value = 'Saved to the template library. It will now appear in weekly suggestions.'
    resetQuestForm()
    await loadTemplates()
  } catch (err: any) {
    templateNote.value = `Error: ${err.message}`
  }
  templatesLoading.value = false
}

const toggleTemplateActive = async (t: any) => {
  if (!admin.value) return
  try {
    await call('side-quests/template-save', {
      admin_email: admin.value.email,
      template: { ...t, global: t.campaign_id === null, active: !t.active },
    })
    await loadTemplates()
  } catch (err: any) {
    templateNote.value = `Error: ${err.message}`
  }
}

const deleteTemplate = async (id: string) => {
  if (!admin.value) return
  try {
    await call('side-quests/template-delete', { admin_email: admin.value.email, template_id: id })
    await loadTemplates()
  } catch (err: any) {
    templateNote.value = `Error: ${err.message}`
  }
}

const deleteQuest = async (id: string) => {
  if (!admin.value) return
  requestConfirm(
    'Delete side quest',
    'Are you sure you want to delete this side quest? This permanently removes the quest and cannot be undone.',
    async () => {
      sideQuestsLoading.value = true
      try {
        await call('side-quests/delete', { admin_email: admin.value!.email, quest_id: id })
        await loadSideQuests()
      } catch (err: any) {
        alert(`Could not delete quest: ${err.message}`)
      }
      sideQuestsLoading.value = false
    }
  )
}

const resolvingQuest = ref<string | null>(null)
const resolveAnswer = ref<Record<string, string>>({})

const resolveQuestManually = async (questId: string) => {
  const answer = resolveAnswer.value[questId]
  if (!answer || !admin.value) return
  requestConfirm(
    'Resolve side quest',
    'Resolving this quest will award points to everyone who answered correctly and cannot be easily undone. Please confirm the answer is correct.',
    async () => {
      sideQuestsLoading.value = true
      resolvingQuest.value = questId
      try {
        await call('side-quests/resolve-manual', {
          admin_email: admin.value!.email,
          quest_id: questId,
          answer,
        })
        resolveAnswer.value[questId] = ''
        await loadSideQuests()
      } catch (err: any) {
        alert(`Could not resolve quest: ${err.message}`)
      }
      resolvingQuest.value = null
      sideQuestsLoading.value = false
    },
    'warning'
  )
}

watch(campaignConfig, (cfg) => {
  if (cfg) loadSideQuests()
}, { immediate: true })

// --- Fixtures ---
const leagueId = ref(campaignConfig.value?.api_football_league_id ?? 1)
const seasonYear = ref(campaignConfig.value?.api_football_season ?? 2026)

// Sync fixture defaults when campaign config loads
watch(campaignConfig, (cfg) => {
  if (cfg?.api_football_league_id != null) leagueId.value = cfg.api_football_league_id
  if (cfg?.api_football_season != null) seasonYear.value = cfg.api_football_season
})
const searchQuery = ref('')
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
  let query = supabase
    .from('matches')
    .select('*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)')
  if (campaignConfig.value?.id) {
    query = query.eq('campaign_id', campaignConfig.value.id)
  }
  const { data } = await query.order('kickoff_at', { ascending: true })
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

onMounted(async () => {
  await loadCampaignConfig()
  loadMatches()
})

const submit = async (matchId: string) => {
  if (!admin.value) return
  const s = editStates.value[matchId]
  requestConfirm(
    'Submit match result',
    'Submitting this result will score everyone\'s predictions for this match and cannot be easily undone. Please double-check the scores before confirming.',
    async () => {
      saving.value = matchId
      error.value = ''
      try {
        await call('predictions/submit-result', {
          email: admin.value!.email,
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
    },
    'warning'
  )
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
const campaignTeamIds = ref<Set<string>>(new Set())
const teamsLoading = ref(false)
const teamsError = ref('')
const teamsStatusFilter = ref<'all' | 'active' | 'eliminated'>('all')
const teamsSearch = ref('')

const filteredTeams = computed(() => {
  // First filter to only teams belonging to the current campaign
  let list = campaignTeamIds.value.size > 0
    ? teamsList.value.filter((t) => campaignTeamIds.value.has(t.id))
    : teamsList.value
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

const loadCampaignTeamIds = async () => {
  if (!campaignConfig.value?.id) return
  const { data } = await supabase
    .from('campaign_teams')
    .select('team_id')
    .eq('campaign_id', campaignConfig.value.id)
  if (data) {
    campaignTeamIds.value = new Set(data.map((r: any) => r.team_id))
  }
}

const loadTeams = async () => {
  if (!admin.value) return
  teamsLoading.value = true
  teamsError.value = ''
  try {
    await loadCampaignTeamIds()
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
  playOriginUsers: number
  sycamoreOriginUsers: number
  playConvertedToSycamore: number
  activeCustomers: number
  usersWithTeam: number
  savingsEnabled: number
  totalSavingsAmount: number
  isTournament: boolean
  totalPredictions: number
  matchesCompleted: number
  matchesScheduled: number
  correctPredictions: number
  incorrectPredictions: number
  exactScorelines: number
  teamDistribution: Array<{ code: string; name: string; flag_emoji: string; logo_url?: string; count: number }>
  dailySignups: Array<{ date: string; count: number }>
  dailyPredictions: Array<{ date: string; count: number }>
  // Feature engagement
  questsTotal: number
  questsResolved: number
  questEntriesTotal: number
  questEntriesCorrect: number
  h2hOptInsTotal: number
  h2hPairingsTotal: number
  h2hCompleted: number
  h2hPlayers: number
  chipsTotal: number
  chipsByType: Array<{ type: string; count: number }>
  streakUsers: number
  longestCurrentStreak: number
  longestEverStreak: number
  groupsTotal: number
  groupMembersTotal: number
  playersRoster: number
} | null>(null)

type ReportPanel = 'overview' | 'participation' | 'savings' | 'leagues' | 'groups' | 'rewards' | 'audit'
const reportPanel = ref<ReportPanel>('overview')
const reportPanels: Array<{ key: ReportPanel; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'participation', label: 'Participation' },
  { key: 'savings', label: 'Savings' },
  { key: 'leagues', label: 'Private leagues' },
  { key: 'groups', label: 'Group memberships' },
  { key: 'rewards', label: 'Monthly rewards' },
  { key: 'audit', label: 'Timestamp audit' },
]
const namedReportLoading = ref(false)
const namedReportError = ref('')
const auditMatchweek = ref('')
const participationReport = ref<any>(null)
const savingsReport = ref<any>(null)
const leaguesReport = ref<any>(null)
const groupsReport = ref<any>(null)
const groupSearch = ref('')
const auditReport = ref<any>(null)
const rewardsReport = ref<any>(null)
const rewardsMonth = ref('')

const filteredUserGroups = computed(() => {
  const list: any[] = groupsReport.value?.user_groups ?? []
  const q = groupSearch.value.trim().toLowerCase()
  if (!q) return list
  return list.filter((g: any) =>
    (g.name || '').toLowerCase().includes(q) ||
    (g.code || '').toLowerCase().includes(q) ||
    (g.creator || '').toLowerCase().includes(q))
})

const loadNamedReport = async (panel: Exclude<ReportPanel, 'overview'>) => {
  if (!admin.value) return
  namedReportLoading.value = true
  namedReportError.value = ''
  try {
    const body: Record<string, unknown> = { admin_email: admin.value.email }
    if (panel === 'audit' && auditMatchweek.value) body.matchweek = auditMatchweek.value
    if (panel === 'rewards' && rewardsMonth.value) body.month = rewardsMonth.value
    const res: any = await call('reports/' + panel, body)
    const report = res?.report
    if (!report) throw new Error('No data returned')
    if (panel === 'participation') participationReport.value = report
    else if (panel === 'savings') savingsReport.value = report
    else if (panel === 'leagues') leaguesReport.value = report
    else if (panel === 'groups') groupsReport.value = report
    else if (panel === 'rewards') { rewardsReport.value = report; rewardsMonth.value = report.month || '' }
    else if (panel === 'audit') auditReport.value = report
  } catch (err: any) {
    namedReportError.value = err?.message || 'Failed to load report'
  } finally {
    namedReportLoading.value = false
  }
}

const openReportPanel = (panel: ReportPanel) => {
  reportPanel.value = panel
  if (panel === 'overview') {
    if (!reportData.value) loadReports()
    return
  }
  loadNamedReport(panel)
}

const downloadReportCsv = (filename: string, rows: Array<Record<string, any>>) => {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const csv = [headers.join(',')]
    .concat(rows.map((r) => headers.map((h) => csvCell(r[h] ?? '')).join(',')))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const exportParticipationCsv = () => {
  const r = participationReport.value
  if (!r) return
  downloadReportCsv('participation-by-gameweek.csv', (r.by_week || []).map((w: any) => ({
    matchweek: w.matchweek,
    active_predictors: w.active_predictors,
    new_predictors: w.new_predictors,
    returning_predictors: w.returning_predictors,
  })))
}

const exportSavingsCsv = () => {
  const r = savingsReport.value
  if (!r) return
  downloadReportCsv('savings-recent-triggers.csv', (r.recent || []).map((x: any) => ({
    triggered_at: x.triggered_at,
    username: x.username || '',
    action: x.action || '',
    status: x.status,
    amount: x.amount ?? '',
    failure_reason: x.failure_reason || '',
  })))
}

const exportGroupsCsv = (kind: 'clubs' | 'user') => {
  const r = groupsReport.value
  if (!r) return
  if (kind === 'clubs') {
    downloadReportCsv('club-league-memberships.csv', (r.clubs || []).map((c: any) => ({
      name: c.name,
      members: c.members,
    })))
  } else {
    downloadReportCsv('user-league-memberships.csv', (r.user_groups || []).map((g: any) => ({
      name: g.name,
      code: g.code || '',
      creator: g.creator || '',
      members: g.members,
      invites_sent: g.invites_sent,
      created_at: g.created_at,
    })))
  }
}

const exportRewardsPrivateCsv = () => {
  const r = rewardsReport.value
  if (!r) return
  downloadReportCsv('monthly-private-group-rewards-' + (r.month || '') + '.csv', (r.private_groups || []).map((g: any) => ({
    league: g.name,
    code: g.code || '',
    creator: g.creator || '',
    members: g.member_count,
    consistent_members: g.consistent_members,
    consistency_rate_pct: g.consistency_rate_pct,
    cumulative_backed_value: g.cumulative_backed_value,
  })))
}

const exportRewardsClubsCsv = () => {
  const r = rewardsReport.value
  if (!r) return
  const rows: Array<Record<string, any>> = []
  for (const c of (r.club_top_performers || [])) {
    for (const p of (c.top_performers || [])) {
      rows.push({
        club: c.name,
        rank: p.rank,
        username: p.username || '',
        account_number: p.account_number || '',
        points_month: p.points_month,
        scoring_predictions: p.scoring_preds,
      })
    }
  }
  downloadReportCsv('monthly-club-top-performers-' + (r.month || '') + '.csv', rows)
}

const exportAuditCsv = () => {
  const r = auditReport.value
  if (!r) return
  downloadReportCsv('timestamp-audit-log.csv', (r.rows || []).map((x: any) => ({
    username: x.username || '',
    email: x.email || '',
    matchweek: x.matchweek,
    fixture: x.fixture,
    predicted_at: x.predicted_at,
    last_updated_at: x.last_updated_at,
    points_awarded: x.points_awarded ?? '',
    power_ups: x.power_ups || '',
  })))
}

const exportAuditRankingCsv = () => {
  const r = auditReport.value
  if (!r) return
  downloadReportCsv('leaderboard-tiebreak-ranking.csv', (r.ranking || []).map((x: any, i: number) => ({
    rank: i + 1,
    username: x.username || '',
    email: x.email || '',
    total_points: x.total_points,
    predictions_count: x.predictions_count,
    first_prediction_at: x.first_prediction_at,
    last_prediction_at: x.last_prediction_at,
    cumulative_timestamp_epoch: x.cumulative_timestamp_epoch,
  })))
}

const loadReports = async () => {
  reportLoading.value = true
  try {
    const from = reportDateFrom.value || null
    const to = reportDateTo.value ? reportDateTo.value + 'T23:59:59' : null
    const cid = campaignConfig.value?.id || null
    // Auto-savings and national-team backing were World Cup mechanics with no league equivalent.
    const isTournamentCampaign = campaignConfig.value?.competition_type === 'tournament'

    const stats = await call('admin-users', {
      mode: 'stats',
      campaign_id: cid,
      from,
      to,
      is_tournament: isTournamentCampaign,
    })
    const totalUsers = stats.totalUsers || 0
    const sycamoreUsers = stats.sycamoreUsers || 0
    const guestUsers = stats.guestUsers || 0
    const playOriginUsers = stats.playOriginUsers || 0
    const sycamoreOriginUsers = stats.sycamoreOriginUsers || 0
    const playConvertedToSycamore = stats.playConvertedToSycamore || 0
    const activeCustomers = stats.activeCustomers || 0
    const usersWithTeam = stats.usersWithTeam || 0
    const campaignUsers = stats.campaignUsers || 0
    const campaignWithAccount = stats.campaignWithAccount || 0
    const campaignGuests = stats.campaignGuests || 0
    const campaignActive = stats.campaignActive || 0
    const savingsEnabled = stats.savingsEnabled || 0
    const totalSavingsAmount = stats.totalSavingsAmount || 0

    const teamData: any[] = []
    if (isTournamentCampaign) {
      {
        const PAGE = 1000
        let start = 0
        while (true) {
          let q = supabase.from('synced_users').select('backed_team_id, backed_team:teams!synced_users_backed_team_id_fkey(code, name, flag_emoji, logo_url)').not('backed_team_id', 'is', null)
          if (from) q = q.gte('created_at', from)
          if (to) q = q.lte('created_at', to)
          const { data: page } = await q.order('id', { ascending: true }).range(start, start + PAGE - 1)
          if (!page || page.length === 0) break
          teamData.push(...page)
          if (page.length < PAGE) break
          start += PAGE
        }
      }
    }

    let predsQuery = supabase.from('predictions').select('*', { count: 'exact', head: true })
    if (cid) predsQuery = predsQuery.eq('campaign_id', cid)
    if (from) predsQuery = predsQuery.gte('created_at', from)
    if (to) predsQuery = predsQuery.lte('created_at', to)
    const { count: totalPredictions } = await predsQuery

    let matchesCompletedQuery = supabase.from('matches').select('*', { count: 'exact', head: true }).eq('status', 'completed')
    if (cid) matchesCompletedQuery = matchesCompletedQuery.eq('campaign_id', cid)
    const { count: matchesCompleted } = await matchesCompletedQuery

    let matchesScheduledQuery = supabase.from('matches').select('*', { count: 'exact', head: true }).eq('status', 'scheduled')
    if (cid) matchesScheduledQuery = matchesScheduledQuery.eq('campaign_id', cid)
    const { count: matchesScheduled } = await matchesScheduledQuery

    let correctQuery = supabase.from('predictions').select('*', { count: 'exact', head: true }).eq('scored', true).gt('points_awarded', 0)
    if (cid) correctQuery = correctQuery.eq('campaign_id', cid)
    if (from) correctQuery = correctQuery.gte('created_at', from)
    if (to) correctQuery = correctQuery.lte('created_at', to)
    const { count: correctPredictions } = await correctQuery

    let incorrectQuery = supabase.from('predictions').select('*', { count: 'exact', head: true }).eq('scored', true).eq('points_awarded', 0)
    if (cid) incorrectQuery = incorrectQuery.eq('campaign_id', cid)
    if (from) incorrectQuery = incorrectQuery.gte('created_at', from)
    if (to) incorrectQuery = incorrectQuery.lte('created_at', to)
    const { count: incorrectPredictions } = await incorrectQuery

    const exactRes = await call('reports/exact-scorelines', {
      admin_email: admin.value!.email,
      campaign_id: cid,
      from,
      to,
    })
    const exactScorelines = Number(exactRes.count) || 0

    const teamCounts: Record<string, { code: string; name: string; flag_emoji: string; count: number }> = {}
    for (const row of teamData || []) {
      const t = row.backed_team as any
      if (!t) continue
      const key = row.backed_team_id
      if (!teamCounts[key]) {
        teamCounts[key] = { code: t.code, name: t.name, flag_emoji: t.flag_emoji || '', logo_url: t.logo_url || '', count: 0 }
      }
      teamCounts[key].count++
    }
    const teamDistribution = Object.values(teamCounts).sort((a, b) => b.count - a.count)

    const signupRes = await call('reports/daily-signups', { admin_email: admin.value!.email, campaign_id: cid })
    let dailySignups = (signupRes.rows || []).map((r: any) => ({ date: r.date, count: Number(r.count) }))
    if (from) dailySignups = dailySignups.filter((d) => d.date >= from)
    if (to) dailySignups = dailySignups.filter((d) => d.date <= (reportDateTo.value || '9999-12-31'))

    const predRes = await call('reports/daily-predictions', { admin_email: admin.value!.email, campaign_id: cid })
    let dailyPredictions = (predRes.rows || []).map((r: any) => ({ date: r.date, count: Number(r.count) }))
    if (from) dailyPredictions = dailyPredictions.filter((d) => d.date >= from)
    if (to) dailyPredictions = dailyPredictions.filter((d) => d.date <= (reportDateTo.value || '9999-12-31'))

    // --- Feature engagement metrics ---
    const withRange = (q: any, col = 'created_at') => {
      if (from) q = q.gte(col, from)
      if (to) q = q.lte(col, to)
      return q
    }
    const withCampaign = (q: any) => (cid ? q.eq('campaign_id', cid) : q)

    // Side quests
    const { count: questsTotal } = await withCampaign(supabase.from('side_quests').select('*', { count: 'exact', head: true }))
    const { count: questsResolved } = await withCampaign(supabase.from('side_quests').select('*', { count: 'exact', head: true }).eq('status', 'resolved'))
    const { count: questEntriesTotal } = await withRange(withCampaign(supabase.from('side_quest_entries').select('*', { count: 'exact', head: true })))
    const { count: questEntriesCorrect } = await withRange(withCampaign(supabase.from('side_quest_entries').select('*', { count: 'exact', head: true }).eq('is_correct', true)))

    // Head-to-head
    const { count: h2hOptInsTotal } = await withRange(withCampaign(supabase.from('h2h_optins').select('*', { count: 'exact', head: true })))
    const { count: h2hPairingsTotal } = await withCampaign(supabase.from('h2h_pairings').select('*', { count: 'exact', head: true }))
    const { count: h2hCompleted } = await withCampaign(supabase.from('h2h_pairings').select('*', { count: 'exact', head: true }).eq('status', 'completed'))
    const { count: h2hPlayers } = await withCampaign(supabase.from('h2h_standings').select('*', { count: 'exact', head: true }))

    // Chips
    const chipTypes = ['double_down', 'triple_captain', 'first_blood', 'streak_shield', 'last_stand', 'perfect_week']
    const chipTypeLabels: Record<string, string> = {
      double_down: 'Double Down', triple_captain: 'Triple Captain', first_blood: 'First Blood',
      streak_shield: 'Streak Shield', last_stand: 'Last Stand', perfect_week: 'Perfect Week',
    }
    const chipsByType: Array<{ type: string; count: number }> = []
    let chipsTotal = 0
    for (const ct of chipTypes) {
      const { count } = await withRange(withCampaign(supabase.from('chip_activations').select('*', { count: 'exact', head: true }).eq('chip_type', ct)), 'activated_at')
      const c = count || 0
      chipsTotal += c
      chipsByType.push({ type: chipTypeLabels[ct] || ct, count: c })
    }
    chipsByType.sort((a, b) => b.count - a.count)

    // Streaks
    const { count: streakUsers } = await withCampaign(supabase.from('user_streaks').select('*', { count: 'exact', head: true }))
    const { data: topCurrent } = await withCampaign(supabase.from('user_streaks').select('current_streak').order('current_streak', { ascending: false }).limit(1)).maybeSingle()
    const { data: topEver } = await withCampaign(supabase.from('user_streaks').select('longest_streak').order('longest_streak', { ascending: false }).limit(1)).maybeSingle()

    // Groups
    const { count: groupsTotal } = await withCampaign(supabase.from('groups').select('*', { count: 'exact', head: true }))
    const { data: groupIdRows } = await withCampaign(supabase.from('groups').select('id'))
    const groupIds = (groupIdRows || []).map((g: any) => g.id)
    let groupMembersTotal = 0
    if (groupIds.length) {
      const { count } = await supabase.from('group_members').select('*', { count: 'exact', head: true }).in('group_id', groupIds)
      groupMembersTotal = count || 0
    }

    // Players roster
    const { count: playersRoster } = await withCampaign(supabase.from('players').select('*', { count: 'exact', head: true }))

    reportData.value = {
      totalUsers: totalUsers || 0,
      sycamoreUsers: sycamoreUsers || 0,
      playOriginUsers: playOriginUsers || 0,
      sycamoreOriginUsers: sycamoreOriginUsers || 0,
      playConvertedToSycamore: playConvertedToSycamore || 0,
      guestUsers: guestUsers || 0,
      activeCustomers: activeCustomers || 0,
      usersWithTeam: usersWithTeam || 0,
      campaignUsers,
      campaignWithAccount,
      campaignGuests,
      campaignActive,
      savingsEnabled: savingsEnabled || 0,
      totalSavingsAmount,
      isTournament: isTournamentCampaign,
      totalPredictions: totalPredictions || 0,
      matchesCompleted: matchesCompleted || 0,
      matchesScheduled: matchesScheduled || 0,
      correctPredictions: correctPredictions || 0,
      incorrectPredictions: incorrectPredictions || 0,
      exactScorelines: exactScorelines || 0,
      teamDistribution,
      dailySignups,
      dailyPredictions,
      questsTotal: questsTotal || 0,
      questsResolved: questsResolved || 0,
      questEntriesTotal: questEntriesTotal || 0,
      questEntriesCorrect: questEntriesCorrect || 0,
      h2hOptInsTotal: h2hOptInsTotal || 0,
      h2hPairingsTotal: h2hPairingsTotal || 0,
      h2hCompleted: h2hCompleted || 0,
      h2hPlayers: h2hPlayers || 0,
      chipsTotal,
      chipsByType,
      streakUsers: streakUsers || 0,
      longestCurrentStreak: (topCurrent as any)?.current_streak || 0,
      longestEverStreak: (topEver as any)?.longest_streak || 0,
      groupsTotal: groupsTotal || 0,
      groupMembersTotal,
      playersRoster: playersRoster || 0,
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
    const { rows } = await call('admin-users', { mode: 'guest-list' })
    guestList.value = rows || []
  } finally {
    guestListLoading.value = false
  }
}

const exportGuestCsv = async () => {
  guestExportLoading.value = true
  try {
    const { rows: allGuests = [] } = await call('admin-users', {
      mode: 'guest-export',
      from: reportDateFrom.value || null,
      to: reportDateTo.value ? reportDateTo.value + 'T23:59:59' : null,
    })
    const predCounts: Record<string, number> = {}
    for (const g of allGuests) predCounts[g.id] = g.prediction_count || 0

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

const userQueryParams = () => ({
  filter: userFilter.value,
  from: userDateFrom.value || null,
  to: userDateTo.value ? userDateTo.value + 'T23:59:59' : null,
  search: userSearchEmail.value.trim() || null,
})

const loadUsersPreview = async () => {
  usersPreviewLoading.value = true
  try {
    const { count } = await call('admin-users', { mode: 'users-list', ...userQueryParams(), count_only: true })
    usersPreviewTotal.value = count || 0

    const { rows } = await call('admin-users', { mode: 'users-list', ...userQueryParams(), limit: 20, offset: 0 })
    usersPreview.value = rows || []
  } finally {
    usersPreviewLoading.value = false
  }
}

const fetchAllFilteredUsers = async () => {
  const PAGE_SIZE = 1000
  let allUsers: any[] = []
  let offset = 0

  while (true) {
    const { rows } = await call('admin-users', { mode: 'users-list', ...userQueryParams(), limit: PAGE_SIZE, offset })
    if (!rows || rows.length === 0) break
    allUsers = allUsers.concat(rows)
    if (rows.length < PAGE_SIZE) break
    offset += PAGE_SIZE
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
    const cid = campaignConfig.value?.id || null
    if (!cid) {
      acquisitionData.value = { totalOrganic: 0, neverTransacted: 0, becameActive: 0, conversionRate: 0 }
      return
    }

    acquisitionData.value = await call('admin-users', { mode: 'acquisition', campaign_id: cid })
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    acquisitionLoading.value = false
  }
}

const exportAcquisitionCsv = async () => {
  acquisitionExporting.value = true
  try {
    const cid = campaignConfig.value?.id || null
    const { rows: allUsers = [] } = await call('admin-users', { mode: 'acquisition-export', campaign_id: cid })

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
              <div class="flex items-center justify-between p-4 rounded-xl border-2 transition"
                :class="campaignConfig.public_access_enabled ? 'border-mint-200 bg-mint-50/50' : 'border-sun-200 bg-sun-50/50'">
                <div>
                  <div class="font-semibold text-ink-900 text-sm">Public access</div>
                  <div class="text-xs text-ink-500 mt-0.5">
                    {{ campaignConfig.public_access_enabled
                      ? 'Players can sign in and use the dashboard.'
                      : 'Site is in “coming soon” mode — sign-in and dashboard are closed to players.' }}
                  </div>
                </div>
                <button
                  @click="toggleCampaignField('public_access_enabled')"
                  :disabled="campaignLoading"
                  :class="[
                    'relative w-12 h-7 rounded-full transition-colors duration-200 flex-shrink-0',
                    campaignConfig.public_access_enabled ? 'bg-mint-500' : 'bg-ink-200',
                  ]"
                >
                  <span
                    :class="[
                      'absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform duration-200',
                      campaignConfig.public_access_enabled ? 'translate-x-5' : 'translate-x-0',
                    ]"
                  ></span>
                </button>
              </div>

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

              <div class="pt-2 mt-2 border-t border-ink-100">
                <div class="text-xs font-semibold uppercase tracking-wide text-ink-400 mb-3">Active customer eligibility</div>

                <div class="flex items-center justify-between p-4 rounded-xl border border-ink-100 hover:border-ink-200 transition mb-4">
                  <div class="pr-3">
                    <div class="font-semibold text-ink-900 text-sm">Leaderboard requires active customer</div>
                    <div class="text-xs text-ink-500 mt-0.5">
                      {{ campaignConfig.require_eligibility_leaderboard
                        ? 'Only active Sycamore customers appear on the general leaderboard.'
                        : 'Everyone appears on the general leaderboard, active or not.' }}
                    </div>
                  </div>
                  <button
                    @click="toggleCampaignField('require_eligibility_leaderboard')"
                    :disabled="campaignLoading"
                    :class="[
                      'relative w-12 h-7 rounded-full transition-colors duration-200 flex-shrink-0',
                      campaignConfig.require_eligibility_leaderboard ? 'bg-mint-500' : 'bg-ink-200',
                    ]"
                  >
                    <span
                      :class="[
                        'absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform duration-200',
                        campaignConfig.require_eligibility_leaderboard ? 'translate-x-5' : 'translate-x-0',
                      ]"
                    ></span>
                  </button>
                </div>

                <div class="flex items-center justify-between p-4 rounded-xl border border-ink-100 hover:border-ink-200 transition">
                  <div class="pr-3">
                    <div class="font-semibold text-ink-900 text-sm">Chips require active customer</div>
                    <div class="text-xs text-ink-500 mt-0.5">
                      {{ campaignConfig.require_eligibility_chips
                        ? 'Only active Sycamore customers can use power-up chips.'
                        : 'Everyone can use power-up chips, active or not.' }}
                    </div>
                  </div>
                  <button
                    @click="toggleCampaignField('require_eligibility_chips')"
                    :disabled="campaignLoading"
                    :class="[
                      'relative w-12 h-7 rounded-full transition-colors duration-200 flex-shrink-0',
                      campaignConfig.require_eligibility_chips ? 'bg-mint-500' : 'bg-ink-200',
                    ]"
                  >
                    <span
                      :class="[
                        'absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform duration-200',
                        campaignConfig.require_eligibility_chips ? 'translate-x-5' : 'translate-x-0',
                      ]"
                    ></span>
                  </button>
                </div>
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
                v-model="campaignConfig.name"
                type="text"
                class="input !py-2 flex-1"
                placeholder="e.g. Premier League 2025/26 Predictor"
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

          <div class="card p-5 space-y-4">
            <div>
              <h3 class="font-bold text-ink-900">Chips configuration</h3>
              <p class="text-sm text-ink-500">Set how many times each chip can be used per campaign. Only 1 chip (of any type) is allowed per matchweek.</p>
            </div>
            <div class="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label class="text-xs font-semibold text-ink-500 uppercase">Double Down uses</label>
                <input v-model.number="campaignConfig.max_double_down_uses" type="number" min="0" max="38" class="input !py-2 mt-1 w-full" />
                <p class="text-xs text-ink-400 mt-1">2x points for all matches in 1 week</p>
              </div>
              <div>
                <label class="text-xs font-semibold text-ink-500 uppercase">Triple Captain uses</label>
                <input v-model.number="campaignConfig.max_triple_captain_uses" type="number" min="0" max="38" class="input !py-2 mt-1 w-full" />
                <p class="text-xs text-ink-400 mt-1">3x points for 1 specific match</p>
              </div>
              <div>
                <label class="text-xs font-semibold text-ink-500 uppercase">First Blood uses</label>
                <input v-model.number="campaignConfig.max_first_blood_uses" type="number" min="0" max="38" class="input !py-2 mt-1 w-full" />
                <p class="text-xs text-ink-400 mt-1">1.5x week bonus if your first pick lands</p>
              </div>
              <div>
                <label class="text-xs font-semibold text-ink-500 uppercase">Streak Shield uses</label>
                <input v-model.number="campaignConfig.max_streak_shield_uses" type="number" min="0" max="38" class="input !py-2 mt-1 w-full" />
                <p class="text-xs text-ink-400 mt-1">Protects your streak for one week</p>
              </div>
              <div>
                <label class="text-xs font-semibold text-ink-500 uppercase">Last Stand uses</label>
                <input v-model.number="campaignConfig.max_last_stand_uses" type="number" min="0" max="38" class="input !py-2 mt-1 w-full" />
                <p class="text-xs text-ink-400 mt-1">4x points, final 5 matchweeks only</p>
              </div>
              <div>
                <label class="text-xs font-semibold text-ink-500 uppercase">Perfect Week uses</label>
                <input v-model.number="campaignConfig.max_perfect_week_uses" type="number" min="0" max="38" class="input !py-2 mt-1 w-full" />
                <p class="text-xs text-ink-400 mt-1">+50 points for a flawless matchweek</p>
              </div>
              <div>
                <label class="text-xs font-semibold text-ink-500 uppercase">Total matchweeks</label>
                <input v-model.number="campaignConfig.total_matchweeks" type="number" min="1" max="60" class="input !py-2 mt-1 w-full" />
                <p class="text-xs text-ink-400 mt-1">Used to unlock Last Stand near the end</p>
              </div>
            </div>
            <button @click="updateChipConfig" :disabled="campaignLoading" class="btn-primary !py-2 !px-4 text-sm">
              {{ campaignLoading ? 'Saving...' : 'Save chips config' }}
            </button>
          </div>

          <div class="card p-5 space-y-4">
            <div>
              <h3 class="font-bold text-ink-900">Scoring points</h3>
              <p class="text-sm text-ink-500">Configure how many points are awarded per correct prediction type.</p>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <label class="text-xs font-semibold text-ink-500 uppercase">Winner correct</label>
                <input v-model.number="campaignConfig.scoring_result" type="number" min="0" class="input !py-2 mt-1 w-full" />
              </div>
              <div>
                <label class="text-xs font-semibold text-ink-500 uppercase">First to score</label>
                <input v-model.number="campaignConfig.scoring_first_to_score" type="number" min="0" class="input !py-2 mt-1 w-full" />
              </div>
              <div>
                <label class="text-xs font-semibold text-ink-500 uppercase">Exact score (FT)</label>
                <input v-model.number="campaignConfig.scoring_exact_ft" type="number" min="0" class="input !py-2 mt-1 w-full" />
              </div>
              <div v-if="campaignConfig.has_knockout_stages">
                <label class="text-xs font-semibold text-ink-500 uppercase">Exact score (AET)</label>
                <input v-model.number="campaignConfig.scoring_exact_aet" type="number" min="0" class="input !py-2 mt-1 w-full" />
              </div>
              <div v-if="campaignConfig.has_knockout_stages">
                <label class="text-xs font-semibold text-ink-500 uppercase">Exact score (PEN)</label>
                <input v-model.number="campaignConfig.scoring_exact_pen" type="number" min="0" class="input !py-2 mt-1 w-full" />
              </div>
            </div>
            <div class="pt-3 border-t border-ink-100 space-y-3">
              <label class="flex items-center gap-2">
                <input v-model="campaignConfig.upset_multiplier_enabled" type="checkbox" class="w-4 h-4 rounded accent-amber-500" />
                <span class="text-sm font-semibold text-ink-700">Enable upset multiplier</span>
              </label>
              <div v-if="campaignConfig.upset_multiplier_enabled" class="grid grid-cols-3 gap-4">
                <div>
                  <label class="text-xs font-semibold text-ink-500 uppercase">Favourite mult.</label>
                  <input v-model.number="campaignConfig.upset_multiplier_favourite" type="number" step="0.1" min="0" class="input !py-2 mt-1 w-full" />
                </div>
                <div>
                  <label class="text-xs font-semibold text-ink-500 uppercase">Draw mult.</label>
                  <input v-model.number="campaignConfig.upset_multiplier_draw" type="number" step="0.1" min="0" class="input !py-2 mt-1 w-full" />
                </div>
                <div>
                  <label class="text-xs font-semibold text-ink-500 uppercase">Underdog mult.</label>
                  <input v-model.number="campaignConfig.upset_multiplier_underdog" type="number" step="0.1" min="0" class="input !py-2 mt-1 w-full" />
                </div>
              </div>
            </div>
            <button @click="updateScoringConfig" :disabled="campaignLoading" class="btn-primary !py-2 !px-4 text-sm">
              {{ campaignLoading ? 'Saving...' : 'Save scoring config' }}
            </button>
          </div>

          <!-- Streak Milestones -->
          <div class="card p-5 space-y-4">
            <div>
              <h3 class="font-bold text-ink-900">Streak Milestones</h3>
              <p class="text-sm text-ink-500">Configure bonus points awarded when users reach streak thresholds. Points go directly to the leaderboard.</p>
            </div>
            <div v-if="milestonesLoading && !milestones.length" class="h-20 animate-pulse bg-ink-100/40 rounded-xl"></div>
            <div v-else class="space-y-2">
              <div v-for="ms in milestones" :key="ms.id" class="flex items-center justify-between bg-ink-50 rounded-xl px-4 py-2.5">
                <div class="flex items-center gap-3">
                  <span class="text-lg">🔥</span>
                  <span class="text-sm font-semibold text-ink-800">{{ ms.threshold }} streak</span>
                  <span class="text-xs text-ink-500">→</span>
                  <span class="text-sm font-bold text-emerald-600">+{{ ms.bonus_points }} pts</span>
                </div>
                <button @click="removeMilestone(ms.id)" class="text-xs text-red-500 hover:text-red-700 font-semibold">Remove</button>
              </div>
              <div v-if="!milestones.length" class="text-sm text-ink-400 italic py-2">No milestones configured yet.</div>
            </div>
            <div class="flex items-end gap-3 pt-2 border-t border-ink-100">
              <div class="flex-1">
                <label class="text-xs font-semibold text-ink-500 uppercase">Streak threshold</label>
                <input v-model.number="newMilestoneThreshold" type="number" min="1" placeholder="e.g. 10" class="input !py-2 mt-1 w-full" />
              </div>
              <div class="flex-1">
                <label class="text-xs font-semibold text-ink-500 uppercase">Bonus points</label>
                <input v-model.number="newMilestonePoints" type="number" min="1" placeholder="e.g. 15" class="input !py-2 mt-1 w-full" />
              </div>
              <button @click="addMilestone" :disabled="!newMilestoneThreshold || !newMilestonePoints || milestonesLoading" class="btn-primary !py-2 !px-4 text-sm whitespace-nowrap">
                Add
              </button>
            </div>
          </div>
        </template>
      </div>

      <!-- SIDE QUESTS TAB -->
      <div v-if="activeTab === 'quests'" class="space-y-6">
        <!-- Sub-navigation -->
        <div class="flex flex-wrap gap-1.5 p-1 bg-ink-100 rounded-xl w-fit">
          <button v-for="p in [
            { key: 'suggest', label: 'Suggest' },
            { key: 'custom', label: 'Create' },
            { key: 'library', label: 'Library' },
            { key: 'manage', label: 'Manage' },
            { key: 'tools', label: 'Tools' },
          ]" :key="p.key"
            @click="questPanel = p.key as any; p.key === 'library' && (loadTemplates(), loadQuestTeams())"
            :class="['px-4 py-1.5 rounded-lg text-xs font-semibold transition', questPanel === p.key ? 'bg-white shadow-sm text-ink-900' : 'text-ink-600 hover:text-ink-900']"
          >{{ p.label }}</button>
        </div>

        <!-- SUGGEST PANEL -->
        <div v-show="questPanel === 'suggest'" class="card p-5 space-y-4">
          <div>
            <h3 class="font-bold text-ink-900">Suggest Quests</h3>
            <p class="text-sm text-ink-500">Build the standard set for a matchweek (over/under, clean sheets, both teams to score, highest-scoring match, and player-to-score picks), review them, then publish the ones you want. Already-published types are skipped automatically.</p>
          </div>
          <div class="flex items-end gap-3">
            <div>
              <label class="text-xs font-semibold text-ink-500 uppercase">Matchweek</label>
              <input v-model.number="suggestWeek" type="number" min="1" placeholder="e.g. 2" class="input !py-2 mt-1 w-24" />
            </div>
            <button @click="suggestQuests" :disabled="!suggestWeek || suggesting" class="btn-primary !py-2 !px-4 text-sm">{{ suggesting ? 'Building...' : 'Suggest quests' }}</button>
            <button @click="generateWeek = suggestWeek; generateQuests()" :disabled="!suggestWeek || sideQuestsLoading" class="pill bg-ink-100 text-ink-700 hover:bg-ink-200 text-xs">Publish all instantly</button>
          </div>
          <p v-if="suggestNote" class="text-xs text-ink-600 bg-ink-50 rounded-xl px-3 py-2">{{ suggestNote }}</p>
          <p v-if="generateResult" class="text-xs text-ink-600 bg-ink-50 rounded-xl px-3 py-2">{{ generateResult }}</p>

          <!-- Review candidates -->
          <div v-if="suggestedQuests.length" class="space-y-2 pt-2 border-t border-ink-100">
            <div class="flex items-center justify-between">
              <p class="text-xs font-semibold text-ink-500 uppercase">Review ({{ suggestedQuests.filter((q) => q.include).length }} selected)</p>
              <button @click="publishSuggested" :disabled="publishing || !suggestedQuests.some((q) => q.include)" class="btn-primary !py-1.5 !px-3 text-xs">{{ publishing ? 'Publishing...' : 'Publish selected' }}</button>
            </div>
            <div v-for="(q, i) in suggestedQuests" :key="i"
              :class="['rounded-xl border px-4 py-3 transition', q.include ? 'bg-white border-sky-200' : 'bg-ink-50 border-ink-100 opacity-60']">
              <div class="flex items-start gap-3">
                <input type="checkbox" v-model="q.include" class="mt-1 w-4 h-4 accent-sky-600" />
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <img v-if="q.options_meta?.player?.photo_url" :src="q.options_meta.player.photo_url" :alt="q.title" class="w-7 h-7 rounded-full object-cover ring-1 ring-emerald-200 flex-shrink-0" />
                    <p class="text-sm font-semibold text-ink-800 truncate">{{ q.title }}</p>
                  </div>
                  <p class="text-xs text-ink-500 mt-0.5">{{ q.description }}</p>
                  <div class="flex flex-wrap gap-1 mt-1.5">
                    <span v-for="opt in q.options" :key="opt" class="text-[10px] font-semibold text-ink-500 bg-ink-100 rounded px-1.5 py-0.5">{{ q.options_meta?.labels?.[opt] || opt }}</span>
                  </div>
                </div>
                <div class="flex-shrink-0 text-right">
                  <label class="text-[10px] font-semibold text-ink-400 uppercase block">Points</label>
                  <input v-model.number="q.point_value" type="number" min="1" class="input !py-1 !px-2 mt-0.5 w-16 text-sm text-right" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Head-to-head pairings -->
        <div v-show="questPanel === 'tools'" class="card p-5 space-y-4">
          <div>
            <h3 class="font-bold text-ink-900">Head-to-Head Matchups</h3>
            <p class="text-sm text-ink-500">Randomly pair up the players who opted into a given week. Each player faces one opponent; the one with more prediction points that week wins. Run this once per week after opt-in closes and before matches lock.</p>
          </div>
          <div class="flex items-end gap-3">
            <div>
              <label class="text-xs font-semibold text-ink-500 uppercase">Week</label>
              <input v-model.number="h2hWeek" type="number" min="1" placeholder="e.g. 2" class="input !py-2 mt-1 w-24" />
            </div>
            <button @click="generateH2HPairings" :disabled="!h2hWeek || h2hLoading" class="btn-primary !py-2 !px-4 text-sm">{{ h2hLoading ? 'Generating...' : 'Generate matchups' }}</button>
          </div>
          <p v-if="h2hWeek && h2hOptInCount !== null" class="text-xs text-ink-600">{{ h2hOptInCount }} player{{ h2hOptInCount === 1 ? '' : 's' }} opted into week {{ h2hWeek }}.</p>
          <p v-if="h2hResult" class="text-xs text-ink-600 bg-ink-50 rounded-xl px-3 py-2">{{ h2hResult }}</p>

          <div v-if="campaignConfig" class="pt-4 border-t border-ink-100">
            <label class="text-xs font-semibold text-ink-500 uppercase">Weekly opt-in limit</label>
            <div class="flex items-end gap-3 mt-1">
              <input v-model.number="campaignConfig.h2h_weekly_limit" type="number" min="0" class="input !py-2 w-28" />
              <button @click="updateH2HConfig" :disabled="campaignLoading" class="btn-primary !py-2 !px-4 text-sm">{{ campaignLoading ? 'Saving...' : 'Save limit' }}</button>
            </div>
            <p class="text-xs text-ink-400 mt-1">Maximum players allowed to opt into each week. Set to 0 for no limit (the default). Once a week is full, players can no longer opt in.</p>
            <p v-if="h2hConfigSaved" class="text-xs text-emerald-600 mt-1">Weekly limit saved.</p>
          </div>
        </div>

        <!-- Player roster sync -->
        <div v-show="questPanel === 'tools'" class="card p-5 space-y-3">
          <div>
            <h3 class="font-bold text-ink-900">Player Roster</h3>
            <p class="text-sm text-ink-500">Pull each club's squad so player-pick quests offer a fixed list. New clubs are added automatically; use “Refresh all” to update existing squads.</p>
          </div>
          <div class="flex items-center gap-3">
            <button @click="syncPlayers(false)" :disabled="syncPlayersLoading" class="btn-primary !py-2 !px-4 text-sm">{{ syncPlayersLoading ? 'Syncing...' : 'Sync players' }}</button>
            <button @click="syncPlayers(true)" :disabled="syncPlayersLoading" class="pill bg-ink-100 text-ink-700 hover:bg-ink-200 text-xs">Refresh all</button>
          </div>
          <p v-if="syncPlayersResult" class="text-xs text-ink-600 bg-ink-50 rounded-xl px-3 py-2">{{ syncPlayersResult }}</p>
        </div>

        <!-- Create custom quest -->
        <div v-show="questPanel === 'custom'" class="card p-5 space-y-4">
          <div>
            <h3 class="font-bold text-ink-900">Create Custom Quest</h3>
            <p class="text-sm text-ink-500">Manually create a side quest. Use player picks for “who will score” style quests so answers stay consistent.</p>
          </div>

          <!-- Answer type toggle -->
          <div class="flex gap-2 p-1 bg-ink-100 rounded-xl w-fit">
            <button
              @click="questMode = 'text'"
              :class="['px-4 py-1.5 rounded-lg text-xs font-semibold transition', questMode === 'text' ? 'bg-white shadow-sm text-ink-900' : 'text-ink-600']"
            >Custom options</button>
            <button
              @click="questMode = 'players'; loadQuestTeams()"
              :class="['px-4 py-1.5 rounded-lg text-xs font-semibold transition', questMode === 'players' ? 'bg-white shadow-sm text-ink-900' : 'text-ink-600']"
            >Player picks</button>
            <button
              @click="questMode = 'player_score'; loadQuestTeams()"
              :class="['px-4 py-1.5 rounded-lg text-xs font-semibold transition', questMode === 'player_score' ? 'bg-white shadow-sm text-ink-900' : 'text-ink-600']"
            >Will they score?</button>
          </div>

          <p v-if="questMode === 'player_score'" class="text-xs text-ink-500 bg-sky-50 border border-sky-100 rounded-xl px-3 py-2">
            Pick one player. Players answer Yes / No, and it settles itself from the recorded goalscorers. Leave the title blank to auto-name it, or use <span class="font-mono font-semibold">{MW}</span> for the matchweek number.
          </p>

          <div class="grid grid-cols-2 gap-3">
            <div class="col-span-2">
              <label class="text-xs font-semibold text-ink-500 uppercase">Title</label>
              <input v-model="newQuestTitle" type="text" placeholder="e.g. Player to score a brace" class="input !py-2 mt-1 w-full" />
            </div>
            <div>
              <label class="text-xs font-semibold text-ink-500 uppercase">Matchweek</label>
              <input v-model.number="newQuestMatchweek" type="number" min="1" placeholder="Leave blank for season-long" class="input !py-2 mt-1 w-full" />
            </div>
            <div>
              <label class="text-xs font-semibold text-ink-500 uppercase">Points</label>
              <input v-model.number="newQuestPoints" type="number" min="1" class="input !py-2 mt-1 w-full" />
            </div>
            <div v-if="questMode === 'text'" class="col-span-2">
              <label class="text-xs font-semibold text-ink-500 uppercase">Options (comma-separated)</label>
              <input v-model="newQuestOptions" type="text" placeholder="e.g. Over, Under, Exactly" class="input !py-2 mt-1 w-full" />
              <div class="flex flex-wrap gap-1.5 mt-2">
                <button
                  v-for="preset in optionPresets"
                  :key="preset.label"
                  type="button"
                  @click="newQuestOptions = preset.value"
                  class="pill bg-ink-100 text-ink-600 hover:bg-ink-200 text-[11px]"
                >{{ preset.label }}</button>
              </div>
            </div>
          </div>

          <!-- Locking -->
          <div class="rounded-xl border border-ink-100 bg-ink-50/60 p-3 space-y-2">
            <div class="flex items-center justify-between">
              <label class="text-xs font-semibold text-ink-500 uppercase">Locks at (entries close)</label>
              <label class="flex items-center gap-1.5 text-xs text-ink-600">
                <input type="checkbox" v-model="newQuestLineupLock" class="w-3.5 h-3.5 accent-sky-600" />
                Lineup quest (lock ~75 min before kick-off)
              </label>
            </div>
            <input v-model="newQuestLocksAt" type="datetime-local" class="input !py-2 w-full" />
            <p class="text-xs text-ink-500">
              Leave blank to lock automatically at the first kick-off of the chosen matchweek. Tick “Lineup quest” to lock earlier, before official team sheets are published. Season-long quests (no matchweek) only lock if you set a time here.
            </p>
          </div>

          <!-- Player picker -->
          <div v-if="questMode === 'players' || questMode === 'player_score'" class="space-y-3">
            <div>
              <label class="text-xs font-semibold text-ink-500 uppercase">Add players from a club</label>
              <select v-model="questTeamId" class="input !py-2 mt-1 w-full">
                <option value="">Select a club...</option>
                <option v-for="t in questTeams" :key="t.id" :value="t.id">{{ t.name }}</option>
              </select>
            </div>

            <div v-if="questPlayersLoading" class="h-16 animate-pulse bg-ink-100/40 rounded-xl"></div>
            <div v-else-if="questTeamId && questTeamPlayers.length" class="max-h-56 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5 pr-1">
              <button
                v-for="p in questTeamPlayers"
                :key="p.id"
                type="button"
                @click="togglePlayerOption(p)"
                :class="['flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition border', isPlayerSelected(p.id) ? 'bg-sky-50 border-sky-300' : 'bg-white border-ink-100 hover:bg-ink-50']"
              >
                <img v-if="p.photo_url" :src="p.photo_url" :alt="p.name" class="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                <span v-else class="w-7 h-7 rounded-full bg-ink-100 flex-shrink-0"></span>
                <span class="flex-1 min-w-0">
                  <span class="block text-sm font-semibold text-ink-800 truncate">{{ p.name }}</span>
                  <span class="block text-[10px] text-ink-400">{{ p.position }}</span>
                </span>
                <span v-if="isPlayerSelected(p.id)" class="text-sky-600 text-xs font-bold flex-shrink-0">Added</span>
              </button>
            </div>
            <p v-else-if="questTeamId" class="text-xs text-ink-400 italic">No players found for this club. Run “Sync players” in the tools panel.</p>

            <!-- Selected chips -->
            <div v-if="questSelectedPlayers.length" class="space-y-1.5">
              <p class="text-xs font-semibold text-ink-500 uppercase">Selected options ({{ questSelectedPlayers.length }})</p>
              <div class="flex flex-wrap gap-1.5">
                <span
                  v-for="p in questSelectedPlayers"
                  :key="p.id"
                  class="inline-flex items-center gap-1.5 bg-ink-100 rounded-full pl-2 pr-1 py-0.5 text-xs font-semibold text-ink-700"
                >
                  {{ p.name }}
                  <button type="button" @click="togglePlayerOption(p)" class="w-4 h-4 rounded-full bg-ink-300 text-white grid place-items-center hover:bg-red-400">&times;</button>
                </span>
              </div>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-3 pt-1">
            <button @click="createCustomQuest" :disabled="sideQuestsLoading" class="btn-primary !py-2 !px-4 text-sm">Create Quest</button>
            <button @click="saveAsTemplate" :disabled="templatesLoading" class="pill bg-ink-100 text-ink-700 hover:bg-ink-200 text-xs">Save as reusable template</button>
            <label class="flex items-center gap-1.5 text-xs text-ink-500">
              <input type="checkbox" v-model="templateGlobal" class="w-3.5 h-3.5 accent-sky-600" />
              Template applies to all campaigns
            </label>
          </div>
          <p v-if="templateNote" class="text-xs text-ink-600 bg-ink-50 rounded-xl px-3 py-2">{{ templateNote }}</p>
        </div>

        <!-- TEMPLATE LIBRARY PANEL -->
        <div v-show="questPanel === 'library'" class="card p-5 space-y-4">
          <div>
            <h3 class="font-bold text-ink-900">Quest Template Library</h3>
            <p class="text-sm text-ink-500">A reusable pool of quests. Every active template is offered automatically when you build a matchweek's suggestions, so you don't rebuild the same quests each week. Use <span class="font-mono font-semibold">{MW}</span> in a title for the matchweek number. Build new templates from the <button class="underline font-semibold" @click="questPanel = 'custom'">Create</button> tab with “Save as reusable template”.</p>
          </div>
          <p v-if="templateNote" class="text-xs text-ink-600 bg-ink-50 rounded-xl px-3 py-2">{{ templateNote }}</p>
          <div v-if="templatesLoading && !templates.length" class="h-20 animate-pulse bg-ink-100/40 rounded-xl"></div>
          <p v-else-if="!templates.length" class="text-sm text-ink-400 italic">No templates yet. Create one and tick “Save as reusable template”.</p>
          <div v-else class="space-y-2">
            <div v-for="t in templates" :key="t.id"
              :class="['rounded-xl border px-4 py-3 flex items-start gap-3', t.active ? 'bg-white border-ink-100' : 'bg-ink-50 border-ink-100 opacity-60']">
              <img v-if="t.options_meta?.player?.photo_url" :src="t.options_meta.player.photo_url" :alt="t.title" class="w-8 h-8 rounded-full object-cover ring-1 ring-emerald-200 flex-shrink-0" />
              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold text-ink-800">{{ t.title }}</p>
                <p class="text-xs text-ink-500">{{ t.point_value }} pts · {{ t.quest_type }}<span v-if="t.campaign_id === null"> · all campaigns</span></p>
                <div class="flex flex-wrap gap-1 mt-1.5">
                  <span v-for="opt in t.options" :key="opt" class="text-[10px] font-semibold text-ink-500 bg-ink-100 rounded px-1.5 py-0.5">{{ t.options_meta?.labels?.[opt] || opt }}</span>
                </div>
              </div>
              <div class="flex flex-col items-end gap-1.5 flex-shrink-0">
                <button @click="toggleTemplateActive(t)" :class="['pill text-[11px]', t.active ? 'bg-emerald-100 text-emerald-700' : 'bg-ink-200 text-ink-600']">{{ t.active ? 'Active' : 'Paused' }}</button>
                <button @click="deleteTemplate(t.id)" class="text-xs text-red-500 hover:text-red-700 font-semibold">Delete</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Existing quests list -->
        <div v-show="questPanel === 'manage'" class="card p-5 space-y-4">
          <h3 class="font-bold text-ink-900">All Quests ({{ sideQuests.length }})</h3>
          <div v-if="sideQuestsLoading && !sideQuests.length" class="h-24 animate-pulse bg-ink-100/40 rounded-xl"></div>
          <div v-else class="space-y-2 max-h-96 overflow-y-auto">
            <div v-for="sq in sideQuests" :key="sq.id" class="bg-ink-50 rounded-xl px-4 py-2.5">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm font-semibold text-ink-800">{{ sq.title }}</p>
                  <p class="text-xs text-ink-500">MW {{ sq.matchweek || 'Season' }} · {{ sq.point_value }} pts · {{ sq.status }} {{ sq.is_auto_generated ? '(auto)' : '' }}</p>
                </div>
                <div class="flex items-center gap-2">
                  <span v-if="sq.status === 'resolved'" class="text-xs text-emerald-600 font-semibold">{{ sq.correct_answer }}</span>
                  <button v-if="sq.status === 'open'" @click="deleteQuest(sq.id)" class="text-xs text-red-500 hover:text-red-700 font-semibold">Delete</button>
                </div>
              </div>
              <!-- Resolve controls for open/locked quests -->
              <div v-if="sq.status === 'open' || sq.status === 'locked'" class="flex items-center gap-2 mt-2 pt-2 border-t border-ink-100">
                <select v-model="resolveAnswer[sq.id]" class="input !py-1.5 text-xs flex-1">
                  <option value="">Select correct answer...</option>
                  <option v-for="opt in sq.options" :key="opt" :value="opt">{{ sq.options_meta?.labels?.[opt] || opt }}</option>
                </select>
                <button @click="resolveQuestManually(sq.id)" :disabled="!resolveAnswer[sq.id] || resolvingQuest === sq.id" class="text-xs font-bold text-emerald-600 hover:text-emerald-700 disabled:opacity-50">Resolve</button>
              </div>
            </div>
            <div v-if="!sideQuests.length" class="text-sm text-ink-400 italic py-2">No quests yet. Generate or create one above.</div>
          </div>
        </div>
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
              placeholder="e.g. Premier League, Champions League"
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
              {{ campaignConfig ? `Using ${campaignConfig.name} (league ${campaignConfig.api_football_league_id}, season ${campaignConfig.api_football_season}).` : 'Defaults to league 1, season 2026.' }}
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

          <!-- Sync new fixtures (upcoming matchweeks) -->
          <div class="flex flex-wrap gap-3 pt-4 border-t border-ink-100">
            <div class="flex-1 min-w-[240px]">
              <h3 class="font-bold text-ink-900">Add new fixtures (non-destructive)</h3>
              <p class="text-sm text-ink-500">Pulls all fixtures from the API and adds only new matches (e.g. upcoming matchweeks). Existing data is preserved.</p>
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
                <img v-if="m.home_team.logo_url" :src="m.home_team.logo_url" :alt="m.home_team.name" class="w-8 h-8 object-contain" />
                <div v-else class="text-2xl">{{ m.home_team.flag_emoji }}</div>
                <div class="font-bold text-ink-900">{{ m.home_team.code }}</div>
                <span class="text-ink-300">vs</span>
                <div class="font-bold text-ink-900">{{ m.away_team.code }}</div>
                <img v-if="m.away_team.logo_url" :src="m.away_team.logo_url" :alt="m.away_team.name" class="w-8 h-8 object-contain" />
                <div v-else class="text-2xl">{{ m.away_team.flag_emoji }}</div>
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
              <p class="text-sm text-ink-500">Toggle a team's active status manually here if needed.</p>
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
                <img v-if="t.logo_url" :src="t.logo_url" :alt="t.code" class="w-5 h-5 object-contain" />
                <span v-else class="text-lg">{{ t.flag_emoji }}</span>
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
            <p v-if="campaignConfig" class="text-sm text-mint-600 font-medium">Campaign: {{ campaignConfig.name }}</p>
            <p class="text-sm text-ink-500">Overview of user engagement and growth.</p>
          </div>
          <button @click="loadReports" :disabled="reportLoading" class="pill bg-ink-100 text-ink-700 hover:bg-ink-200 text-xs">
            {{ reportLoading ? 'Loading...' : 'Refresh' }}
          </button>
        </div>

        <!-- Sub-report navigation -->
        <div class="flex flex-wrap gap-1 bg-ink-100/60 p-1 rounded-xl w-fit">
          <button
            v-for="p in reportPanels"
            :key="p.key"
            @click="openReportPanel(p.key)"
            :class="['px-4 py-1.5 rounded-lg text-xs font-semibold transition', reportPanel === p.key ? 'bg-white shadow-sm text-ink-900' : 'text-ink-600 hover:text-ink-900']"
          >
            {{ p.label }}
          </button>
        </div>

        <!-- OVERVIEW PANEL -->
        <div v-show="reportPanel === 'overview'" class="space-y-5">

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
          <!-- This campaign (primary focus) -->
          <div>
            <div class="flex items-center gap-2 mb-2">
              <div class="text-sm font-bold text-ink-900">{{ campaignConfig?.name || 'Current campaign' }}</div>
              <span class="pill bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-wide">This campaign</span>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <div class="card p-4 text-center">
                <div class="text-2xl font-extrabold text-ink-900">{{ reportData.campaignUsers }}</div>
                <div class="text-xs text-ink-500 font-semibold uppercase tracking-wider mt-1">Joined players</div>
              </div>
              <div class="card p-4 text-center">
                <div class="text-2xl font-extrabold text-sky-600">{{ reportData.campaignWithAccount }}</div>
                <div class="text-xs text-ink-500 font-semibold uppercase tracking-wider mt-1">With account no.</div>
              </div>
              <div class="card p-4 text-center">
                <div class="text-2xl font-extrabold text-sun-600">{{ reportData.campaignGuests }}</div>
                <div class="text-xs text-ink-500 font-semibold uppercase tracking-wider mt-1">No account no.</div>
              </div>
              <div class="card p-4 text-center">
                <div class="text-2xl font-extrabold text-mint-600">{{ reportData.campaignActive }}</div>
                <div class="text-xs text-ink-500 font-semibold uppercase tracking-wider mt-1">Active customers</div>
              </div>
              <div class="card p-4 text-center">
                <div class="text-2xl font-extrabold text-ink-700">{{ reportData.totalPredictions }}</div>
                <div class="text-xs text-ink-500 font-semibold uppercase tracking-wider mt-1">Predictions</div>
              </div>
            </div>
          </div>

          <!-- Platform-wide context (secondary) -->
          <div>
            <div class="text-xs font-semibold uppercase tracking-wide text-ink-400 mb-2">Platform-wide, all campaigns since inception</div>
            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <div class="card p-4 text-center bg-ink-50/40">
                <div class="text-2xl font-extrabold text-ink-900">{{ reportData.totalUsers }}</div>
                <div class="text-xs text-ink-500 font-semibold uppercase tracking-wider mt-1">Total users</div>
              </div>
              <div class="card p-4 text-center bg-ink-50/40">
                <div class="text-2xl font-extrabold text-sky-600">{{ reportData.sycamoreUsers }}</div>
                <div class="text-xs text-ink-500 font-semibold uppercase tracking-wider mt-1">With account no.</div>
              </div>
              <div class="card p-4 text-center bg-ink-50/40">
                <div class="text-2xl font-extrabold text-sun-600">{{ reportData.guestUsers }}</div>
                <div class="text-xs text-ink-500 font-semibold uppercase tracking-wider mt-1">No account no.</div>
              </div>
              <div class="card p-4 text-center bg-ink-50/40">
                <div class="text-2xl font-extrabold text-mint-600">{{ reportData.activeCustomers }}</div>
                <div class="text-xs text-ink-500 font-semibold uppercase tracking-wider mt-1">Active customers</div>
              </div>
              <div v-if="reportData.isTournament" class="card p-4 text-center bg-ink-50/40">
                <div class="text-2xl font-extrabold text-coral-600">{{ reportData.usersWithTeam }}</div>
                <div class="text-xs text-ink-500 font-semibold uppercase tracking-wider mt-1">Backed a team</div>
              </div>
            </div>
          </div>

          <!-- Additional stats -->
          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div v-if="reportData.isTournament" class="card p-4 text-center">
              <div class="text-2xl font-extrabold text-teal-600">{{ reportData.savingsEnabled }}</div>
              <div class="text-xs text-ink-500 font-semibold uppercase tracking-wider mt-1">Auto-savings on</div>
            </div>
            <div v-if="reportData.isTournament" class="card p-4 text-center">
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
                <img v-if="t.logo_url" :src="t.logo_url" :alt="t.code" class="w-5 h-5 object-contain" />
                <span v-else class="text-lg">{{ t.flag_emoji }}</span>
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

          <!-- Feature engagement -->
          <div class="card p-5 space-y-4">
            <div>
              <h3 class="font-bold text-ink-900">Feature engagement</h3>
              <p class="text-sm text-ink-500">Activity across side quests, head-to-head, chips, streaks and groups.</p>
            </div>

            <div>
              <h4 class="text-xs font-bold uppercase tracking-wide text-ink-500 mb-2">Side quests</h4>
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div class="rounded-lg bg-ink-50 p-3 text-center">
                  <div class="text-xl font-extrabold text-ink-900">{{ reportData.questsTotal }}</div>
                  <div class="text-xs text-ink-500">Quests set</div>
                </div>
                <div class="rounded-lg bg-ink-50 p-3 text-center">
                  <div class="text-xl font-extrabold text-mint-600">{{ reportData.questsResolved }}</div>
                  <div class="text-xs text-ink-500">Resolved</div>
                </div>
                <div class="rounded-lg bg-ink-50 p-3 text-center">
                  <div class="text-xl font-extrabold text-ink-700">{{ reportData.questEntriesTotal }}</div>
                  <div class="text-xs text-ink-500">Answers</div>
                </div>
                <div class="rounded-lg bg-ink-50 p-3 text-center">
                  <div class="text-xl font-extrabold text-mint-600">{{ reportData.questEntriesCorrect }}</div>
                  <div class="text-xs text-ink-500">Correct{{ reportData.questEntriesTotal ? ' (' + Math.round(reportData.questEntriesCorrect / reportData.questEntriesTotal * 100) + '%)' : '' }}</div>
                </div>
              </div>
            </div>

            <div>
              <h4 class="text-xs font-bold uppercase tracking-wide text-ink-500 mb-2">Head-to-head</h4>
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div class="rounded-lg bg-ink-50 p-3 text-center">
                  <div class="text-xl font-extrabold text-ink-900">{{ reportData.h2hOptInsTotal }}</div>
                  <div class="text-xs text-ink-500">Opt-ins</div>
                </div>
                <div class="rounded-lg bg-ink-50 p-3 text-center">
                  <div class="text-xl font-extrabold text-ink-700">{{ reportData.h2hPlayers }}</div>
                  <div class="text-xs text-ink-500">Players</div>
                </div>
                <div class="rounded-lg bg-ink-50 p-3 text-center">
                  <div class="text-xl font-extrabold text-ink-900">{{ reportData.h2hPairingsTotal }}</div>
                  <div class="text-xs text-ink-500">Matchups</div>
                </div>
                <div class="rounded-lg bg-ink-50 p-3 text-center">
                  <div class="text-xl font-extrabold text-mint-600">{{ reportData.h2hCompleted }}</div>
                  <div class="text-xs text-ink-500">Completed</div>
                </div>
              </div>
            </div>

            <div>
              <h4 class="text-xs font-bold uppercase tracking-wide text-ink-500 mb-2">Streaks</h4>
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div class="rounded-lg bg-ink-50 p-3 text-center">
                  <div class="text-xl font-extrabold text-ink-900">{{ reportData.streakUsers }}</div>
                  <div class="text-xs text-ink-500">Players on a streak</div>
                </div>
                <div class="rounded-lg bg-ink-50 p-3 text-center">
                  <div class="text-xl font-extrabold text-sun-600">{{ reportData.longestCurrentStreak }}</div>
                  <div class="text-xs text-ink-500">Longest active</div>
                </div>
                <div class="rounded-lg bg-ink-50 p-3 text-center">
                  <div class="text-xl font-extrabold text-coral-500">{{ reportData.longestEverStreak }}</div>
                  <div class="text-xs text-ink-500">Longest ever</div>
                </div>
              </div>
            </div>

            <div>
              <h4 class="text-xs font-bold uppercase tracking-wide text-ink-500 mb-2">Groups &amp; roster</h4>
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div class="rounded-lg bg-ink-50 p-3 text-center">
                  <div class="text-xl font-extrabold text-ink-900">{{ reportData.groupsTotal }}</div>
                  <div class="text-xs text-ink-500">Groups created</div>
                </div>
                <div class="rounded-lg bg-ink-50 p-3 text-center">
                  <div class="text-xl font-extrabold text-ink-700">{{ reportData.groupMembersTotal }}</div>
                  <div class="text-xs text-ink-500">Group memberships</div>
                </div>
                <div class="rounded-lg bg-ink-50 p-3 text-center">
                  <div class="text-xl font-extrabold text-ink-700">{{ reportData.playersRoster }}</div>
                  <div class="text-xs text-ink-500">Players in roster</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Chip usage -->
          <div v-if="reportData.chipsTotal > 0" class="card p-5 space-y-3">
            <h3 class="font-bold text-ink-900">Chip usage</h3>
            <p class="text-sm text-ink-500">{{ reportData.chipsTotal }} chip{{ reportData.chipsTotal !== 1 ? 's' : '' }} played across all types.</p>
            <div class="space-y-2">
              <div v-for="c in reportData.chipsByType" :key="c.type" class="flex items-center gap-3">
                <span class="text-sm font-bold text-ink-900 w-28 shrink-0">{{ c.type }}</span>
                <div class="flex-1 h-5 bg-ink-100 rounded overflow-hidden">
                  <div class="h-full bg-sky-500 rounded" :style="{ width: (reportData.chipsByType[0].count ? c.count / reportData.chipsByType[0].count * 100 : 0) + '%' }"></div>
                </div>
                <span class="text-sm font-bold text-ink-700 w-8 text-right tabular-nums">{{ c.count }}</span>
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
              <div v-if="reportData.isTournament" class="flex items-center gap-3">
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
                <p class="text-sm text-ink-500">Players who joined {{ campaignConfig?.name || 'this campaign' }}, split by whether they have since transacted on Sycamore. “Became active” are active Sycamore customers or those with qualifying transactions.</p>
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
                <div class="text-xs text-ink-500 font-semibold uppercase tracking-wider mt-1">Players in campaign</div>
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

          <!-- Signup origin (immutable: where each player first signed up) -->
          <div class="card p-5 space-y-4">
            <div>
              <h3 class="font-bold text-ink-900">Signup origin</h3>
              <p class="text-sm text-ink-500">Where each player first signed up, recorded once and never changed — unlike account status, this stays accurate even after a Play player later opens a Sycamore account.</p>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div class="bg-slate-50 rounded-xl p-4 text-center">
                <div class="text-2xl font-extrabold text-emerald-600">{{ reportData.playOriginUsers.toLocaleString() }}</div>
                <div class="text-xs text-ink-500 font-semibold uppercase tracking-wider mt-1">First signed up on Play</div>
              </div>
              <div class="bg-slate-50 rounded-xl p-4 text-center">
                <div class="text-2xl font-extrabold text-sky-600">{{ reportData.sycamoreOriginUsers.toLocaleString() }}</div>
                <div class="text-xs text-ink-500 font-semibold uppercase tracking-wider mt-1">First signed up on Sycamore</div>
              </div>
              <div class="bg-slate-50 rounded-xl p-4 text-center">
                <div class="text-2xl font-extrabold text-mint-600">{{ reportData.playConvertedToSycamore.toLocaleString() }}</div>
                <div class="text-xs text-ink-500 font-semibold uppercase tracking-wider mt-1">Play players who opened a Sycamore account</div>
              </div>
              <div class="bg-slate-50 rounded-xl p-4 text-center">
                <div class="text-2xl font-extrabold text-ink-900">{{ reportData.playOriginUsers > 0 ? Math.round(100 * reportData.playConvertedToSycamore / reportData.playOriginUsers) : 0 }}%</div>
                <div class="text-xs text-ink-500 font-semibold uppercase tracking-wider mt-1">Play → Sycamore conversion</div>
              </div>
            </div>
          </div>

          <!-- Daily signups -->
          <div class="card p-5 space-y-3">
            <div>
              <h3 class="font-bold text-ink-900">Daily signups</h3>
              <p class="text-xs text-ink-500">Players joining {{ campaignConfig?.name || 'this campaign' }} per day.</p>
            </div>
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
            <div>
              <h3 class="font-bold text-ink-900">Daily predictions</h3>
              <p class="text-xs text-ink-500">Predictions made in {{ campaignConfig?.name || 'this campaign' }} per day.</p>
            </div>
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
        <!-- /OVERVIEW PANEL -->

        <!-- PARTICIPATION PANEL -->
        <div v-if="reportPanel === 'participation'" class="space-y-5">
          <div class="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 class="font-bold text-ink-900">Gameweek participation &amp; conversion</h3>
              <p class="text-sm text-ink-500">Active predictors each gameweek, split into first-time and returning players, plus account-link conversion.</p>
            </div>
            <div class="flex gap-2 shrink-0">
              <button @click="loadNamedReport('participation')" :disabled="namedReportLoading" class="pill bg-ink-100 text-ink-700 hover:bg-ink-200 text-xs">{{ namedReportLoading ? 'Loading...' : 'Refresh' }}</button>
              <button @click="exportParticipationCsv" :disabled="!participationReport" class="pill bg-sky-100 text-sky-700 hover:bg-sky-200 text-xs">Export CSV</button>
            </div>
          </div>
          <div v-if="namedReportError" class="card p-4 text-sm text-coral-600">{{ namedReportError }}</div>
          <div v-if="namedReportLoading && !participationReport" class="card h-40 animate-pulse bg-ink-100/40"></div>
          <template v-else-if="participationReport">
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div class="card p-4 text-center">
                <div class="text-2xl font-extrabold text-ink-900">{{ participationReport.account_links.total_participants }}</div>
                <div class="text-xs text-ink-500 font-semibold uppercase tracking-wider mt-1">Participants</div>
              </div>
              <div class="card p-4 text-center">
                <div class="text-2xl font-extrabold text-sky-600">{{ participationReport.account_links.linked_accounts }}</div>
                <div class="text-xs text-ink-500 font-semibold uppercase tracking-wider mt-1">Linked accounts</div>
              </div>
              <div class="card p-4 text-center">
                <div class="text-2xl font-extrabold text-mint-600">{{ participationReport.account_links.link_rate_pct }}%</div>
                <div class="text-xs text-ink-500 font-semibold uppercase tracking-wider mt-1">Link rate</div>
              </div>
            </div>
            <div class="card p-5 space-y-3">
              <h4 class="font-bold text-ink-900">By gameweek</h4>
              <div v-if="!participationReport.by_week.length" class="text-sm text-ink-400">No predictions recorded yet.</div>
              <div v-else class="overflow-auto rounded-xl border border-ink-100">
                <table class="w-full text-sm">
                  <thead class="bg-ink-50 text-ink-500 text-xs uppercase">
                    <tr>
                      <th class="text-left px-3 py-2">Gameweek</th>
                      <th class="text-right px-3 py-2">Active</th>
                      <th class="text-right px-3 py-2">First-time</th>
                      <th class="text-right px-3 py-2">Returning</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-ink-100">
                    <tr v-for="w in participationReport.by_week" :key="w.matchweek">
                      <td class="px-3 py-2 font-semibold text-ink-900">MW{{ w.matchweek }}</td>
                      <td class="px-3 py-2 text-right tabular-nums font-bold">{{ w.active_predictors }}</td>
                      <td class="px-3 py-2 text-right tabular-nums text-sun-600">{{ w.new_predictors }}</td>
                      <td class="px-3 py-2 text-right tabular-nums text-mint-600">{{ w.returning_predictors }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </template>
        </div>

        <!-- SAVINGS PANEL -->
        <div v-if="reportPanel === 'savings'" class="space-y-5">
          <div class="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 class="font-bold text-ink-900">"Back A Team" savings performance</h3>
              <p class="text-sm text-ink-500">Active savings plans, auto-save results and failure reasons (health check on the auto-save pilot).</p>
            </div>
            <div class="flex gap-2 shrink-0">
              <button @click="loadNamedReport('savings')" :disabled="namedReportLoading" class="pill bg-ink-100 text-ink-700 hover:bg-ink-200 text-xs">{{ namedReportLoading ? 'Loading...' : 'Refresh' }}</button>
              <button @click="exportSavingsCsv" :disabled="!savingsReport" class="pill bg-sky-100 text-sky-700 hover:bg-sky-200 text-xs">Export CSV</button>
            </div>
          </div>
          <div v-if="namedReportError" class="card p-4 text-sm text-coral-600">{{ namedReportError }}</div>
          <div v-if="namedReportLoading && !savingsReport" class="card h-40 animate-pulse bg-ink-100/40"></div>
          <template v-else-if="savingsReport">
            <div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div class="card p-4 text-center"><div class="text-2xl font-extrabold text-ink-900">{{ savingsReport.active_plans }}</div><div class="text-xs text-ink-500 font-semibold uppercase tracking-wider mt-1">Active plans</div></div>
              <div class="card p-4 text-center"><div class="text-2xl font-extrabold text-mint-600">{{ savingsReport.successful_triggers }}</div><div class="text-xs text-ink-500 font-semibold uppercase tracking-wider mt-1">Successful</div></div>
              <div class="card p-4 text-center"><div class="text-2xl font-extrabold text-coral-500">{{ savingsReport.failed_triggers }}</div><div class="text-xs text-ink-500 font-semibold uppercase tracking-wider mt-1">Failed</div></div>
              <div class="card p-4 text-center"><div class="text-2xl font-extrabold text-sun-600">{{ savingsReport.pending_triggers }}</div><div class="text-xs text-ink-500 font-semibold uppercase tracking-wider mt-1">Pending</div></div>
              <div class="card p-4 text-center"><div class="text-2xl font-extrabold text-teal-700">&#8358;{{ Number(savingsReport.total_balance).toLocaleString() }}</div><div class="text-xs text-ink-500 font-semibold uppercase tracking-wider mt-1">Total saved</div></div>
            </div>
            <div v-if="savingsReport.by_reason.length" class="card p-5 space-y-3">
              <h4 class="font-bold text-ink-900">Failure reasons</h4>
              <div v-for="f in savingsReport.by_reason" :key="f.reason" class="flex items-center gap-3">
                <span class="text-sm text-ink-700 flex-1">{{ f.reason }}</span>
                <span class="text-sm font-bold text-coral-600 tabular-nums">{{ f.count }}</span>
              </div>
            </div>
            <div class="card p-5 space-y-3">
              <h4 class="font-bold text-ink-900">Recent triggers</h4>
              <div v-if="!savingsReport.recent.length" class="text-sm text-ink-400">No auto-save activity recorded yet.</div>
              <div v-else class="overflow-auto rounded-xl border border-ink-100 max-h-80">
                <table class="w-full text-sm">
                  <thead class="bg-ink-50 text-ink-500 text-xs uppercase sticky top-0">
                    <tr>
                      <th class="text-left px-3 py-2">When</th>
                      <th class="text-left px-3 py-2">User</th>
                      <th class="text-left px-3 py-2">Status</th>
                      <th class="text-right px-3 py-2">Amount</th>
                      <th class="text-left px-3 py-2">Reason</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-ink-100">
                    <tr v-for="(x, i) in savingsReport.recent" :key="i">
                      <td class="px-3 py-2 text-xs text-ink-500">{{ (x.triggered_at || '').slice(0, 16).replace('T', ' ') }}</td>
                      <td class="px-3 py-2 text-xs font-semibold text-ink-800">{{ x.username || '-' }}</td>
                      <td class="px-3 py-2 text-xs"><span :class="x.status === 'completed' ? 'text-mint-600' : x.status === 'failed' ? 'text-coral-600' : 'text-sun-600'" class="font-bold">{{ x.status }}</span></td>
                      <td class="px-3 py-2 text-right tabular-nums">{{ x.amount != null ? '&#8358;' + Number(x.amount).toLocaleString() : '-' }}</td>
                      <td class="px-3 py-2 text-xs text-ink-500">{{ x.failure_reason || '-' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </template>
        </div>

        <!-- LEAGUES PANEL -->
        <div v-if="reportPanel === 'leagues'" class="space-y-5">
          <div class="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 class="font-bold text-ink-900">Private league viral coefficient</h3>
              <p class="text-sm text-ink-500">Invites sent vs. members earned for this campaign's private leagues.</p>
            </div>
            <button @click="loadNamedReport('leagues')" :disabled="namedReportLoading" class="pill bg-ink-100 text-ink-700 hover:bg-ink-200 text-xs shrink-0">{{ namedReportLoading ? 'Loading...' : 'Refresh' }}</button>
          </div>
          <div v-if="namedReportError" class="card p-4 text-sm text-coral-600">{{ namedReportError }}</div>
          <div v-if="namedReportLoading && !leaguesReport" class="card h-40 animate-pulse bg-ink-100/40"></div>
          <template v-else-if="leaguesReport">
            <div class="card p-5 bg-emerald-50 border border-emerald-100 flex flex-wrap items-center justify-between gap-4">
              <div>
                <div class="text-xs text-emerald-700 font-semibold uppercase tracking-wider">Viral coefficient</div>
                <div class="text-4xl font-extrabold text-emerald-700 mt-1">{{ leaguesReport.viral_coefficient ?? 0 }}</div>
                <div class="text-xs text-ink-500 mt-1">Members earned for every invite sent</div>
              </div>
              <div class="grid grid-cols-2 gap-3 text-center">
                <div><div class="text-2xl font-extrabold text-ink-900">{{ leaguesReport.invites_sent ?? 0 }}</div><div class="text-xs text-ink-500 font-semibold uppercase tracking-wider mt-1">Invites sent</div></div>
                <div><div class="text-2xl font-extrabold text-sky-600">{{ leaguesReport.distinct_inviters ?? 0 }}</div><div class="text-xs text-ink-500 font-semibold uppercase tracking-wider mt-1">People inviting</div></div>
              </div>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div class="card p-4 text-center"><div class="text-2xl font-extrabold text-ink-900">{{ leaguesReport.leagues_created }}</div><div class="text-xs text-ink-500 font-semibold uppercase tracking-wider mt-1">Leagues created</div></div>
              <div class="card p-4 text-center"><div class="text-2xl font-extrabold text-sky-600">{{ leaguesReport.total_members }}</div><div class="text-xs text-ink-500 font-semibold uppercase tracking-wider mt-1">Total members</div></div>
              <div class="card p-4 text-center"><div class="text-2xl font-extrabold text-mint-600">{{ leaguesReport.joins_via_invite }}</div><div class="text-xs text-ink-500 font-semibold uppercase tracking-wider mt-1">Joined via invite</div></div>
              <div class="card p-4 text-center"><div class="text-2xl font-extrabold text-coral-500">{{ leaguesReport.avg_members_per_league }}</div><div class="text-xs text-ink-500 font-semibold uppercase tracking-wider mt-1">Avg members/league</div></div>
            </div>
            <div v-if="leaguesReport.invites_by_channel?.length" class="card p-4">
              <div class="text-xs text-ink-500 font-semibold uppercase tracking-wider mb-3">Invites by channel</div>
              <div class="flex flex-wrap gap-2">
                <span v-for="c in leaguesReport.invites_by_channel" :key="c.channel" class="pill bg-ink-100 text-ink-700 text-xs capitalize">{{ c.channel }}: {{ c.count }}</span>
              </div>
            </div>
            <div class="card p-4 bg-sun-50 border border-sun-100">
              <p class="text-sm text-ink-600">{{ leaguesReport.note }}</p>
            </div>
          </template>
        </div>

        <!-- GROUPS PANEL -->
        <div v-if="reportPanel === 'groups'" class="space-y-5">
          <div class="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 class="font-bold text-ink-900">Group memberships</h3>
              <p class="text-sm text-ink-500">Member counts for every club league and user-created private league in this campaign.</p>
            </div>
            <button @click="loadNamedReport('groups')" :disabled="namedReportLoading" class="pill bg-ink-100 text-ink-700 hover:bg-ink-200 text-xs shrink-0">{{ namedReportLoading ? 'Loading...' : 'Refresh' }}</button>
          </div>
          <div v-if="namedReportError" class="card p-4 text-sm text-coral-600">{{ namedReportError }}</div>
          <div v-if="namedReportLoading && !groupsReport" class="card h-40 animate-pulse bg-ink-100/40"></div>
          <template v-else-if="groupsReport">
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div class="card p-4 text-center"><div class="text-2xl font-extrabold text-ink-900">{{ groupsReport.summary?.club_count ?? 0 }}</div><div class="text-xs text-ink-500 font-semibold uppercase tracking-wider mt-1">Club leagues</div></div>
              <div class="card p-4 text-center"><div class="text-2xl font-extrabold text-sky-600">{{ groupsReport.summary?.total_club_members ?? 0 }}</div><div class="text-xs text-ink-500 font-semibold uppercase tracking-wider mt-1">Club members</div></div>
              <div class="card p-4 text-center"><div class="text-2xl font-extrabold text-mint-600">{{ groupsReport.summary?.user_group_count ?? 0 }}</div><div class="text-xs text-ink-500 font-semibold uppercase tracking-wider mt-1">User leagues</div></div>
              <div class="card p-4 text-center"><div class="text-2xl font-extrabold text-coral-500">{{ groupsReport.summary?.total_user_group_members ?? 0 }}</div><div class="text-xs text-ink-500 font-semibold uppercase tracking-wider mt-1">User league members</div></div>
            </div>

            <div class="card p-4">
              <div class="flex items-center justify-between gap-3 mb-3 flex-wrap">
                <div class="text-xs text-ink-500 font-semibold uppercase tracking-wider">Club leagues</div>
                <button @click="exportGroupsCsv('clubs')" :disabled="!groupsReport.clubs?.length" class="pill bg-sky-100 text-sky-700 hover:bg-sky-200 text-xs">Export CSV</button>
              </div>
              <div v-if="!groupsReport.clubs?.length" class="text-sm text-ink-400">No club leagues yet.</div>
              <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div v-for="c in groupsReport.clubs" :key="c.group_id" class="flex items-center justify-between gap-3 rounded-xl bg-ink-50/60 px-3 py-2">
                  <div class="flex items-center gap-3 min-w-0">
                    <img v-if="c.logo_url" :src="c.logo_url" alt="" class="w-6 h-6 object-contain shrink-0" />
                    <span class="truncate text-sm font-semibold text-ink-800">{{ c.name }}</span>
                  </div>
                  <span class="text-sm font-extrabold text-ink-900 shrink-0">{{ c.members }}</span>
                </div>
              </div>
            </div>

            <div class="card p-4">
              <div class="flex items-center justify-between gap-3 mb-3 flex-wrap">
                <div class="text-xs text-ink-500 font-semibold uppercase tracking-wider">User-created leagues</div>
                <button @click="exportGroupsCsv('user')" :disabled="!groupsReport.user_groups?.length" class="pill bg-sky-100 text-sky-700 hover:bg-sky-200 text-xs">Export CSV</button>
              </div>
              <input v-model="groupSearch" type="text" placeholder="Search by league name, code or creator" class="input !py-2 mb-3" />
              <div v-if="!filteredUserGroups.length" class="text-sm text-ink-400">No leagues match your search.</div>
              <div v-else class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="text-left text-xs text-ink-500 uppercase tracking-wider border-b border-ink-100">
                      <th class="py-2 pr-3">League</th>
                      <th class="py-2 pr-3">Code</th>
                      <th class="py-2 pr-3">Creator</th>
                      <th class="py-2 pr-3 text-right">Members</th>
                      <th class="py-2 text-right">Invites</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="g in filteredUserGroups" :key="g.group_id" class="border-b border-ink-50">
                      <td class="py-2 pr-3 font-semibold text-ink-800"><span class="mr-1">{{ g.avatar_emoji }}</span>{{ g.name }}</td>
                      <td class="py-2 pr-3 font-mono text-xs text-ink-500">{{ g.code }}</td>
                      <td class="py-2 pr-3 text-ink-600">{{ g.creator || '—' }}</td>
                      <td class="py-2 pr-3 text-right font-extrabold text-ink-900">{{ g.members }}</td>
                      <td class="py-2 text-right text-ink-600">{{ g.invites_sent }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </template>
        </div>

        <!-- MONTHLY REWARDS PANEL -->
        <div v-if="reportPanel === 'rewards'" class="space-y-5">
          <div class="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 class="font-bold text-ink-900">Monthly rewards</h3>
              <p class="text-sm text-ink-500">Private-league consistency and cumulative "Back A Team" value, plus top performers in each club league — for rewarding the best each month.</p>
            </div>
            <div class="flex items-end gap-2 shrink-0">
              <div>
                <label class="label !mb-1">Month</label>
                <select v-model="rewardsMonth" @change="loadNamedReport('rewards')" :disabled="namedReportLoading" class="input !py-2 w-40">
                  <option v-if="!rewardsReport" value="">Latest</option>
                  <option v-for="m in (rewardsReport?.available_months || [])" :key="m" :value="m">{{ m }}</option>
                </select>
              </div>
              <button @click="loadNamedReport('rewards')" :disabled="namedReportLoading" class="pill bg-ink-100 text-ink-700 hover:bg-ink-200 text-xs">{{ namedReportLoading ? 'Loading...' : 'Refresh' }}</button>
            </div>
          </div>
          <div v-if="namedReportError" class="card p-4 text-sm text-coral-600">{{ namedReportError }}</div>
          <div v-if="namedReportLoading && !rewardsReport" class="card h-40 animate-pulse bg-ink-100/40"></div>
          <template v-else-if="rewardsReport">
            <div class="card p-4 bg-sun-50 border border-sun-100 text-sm text-ink-600">
              Consistency counts members who predicted <span class="font-semibold">every fixture of every gameweek</span> in
              <span class="font-semibold">{{ rewardsReport.month }}</span><span v-if="rewardsReport.matchweeks_in_month?.length"> (gameweeks {{ rewardsReport.matchweeks_in_month.join(', ') }})</span>. Staff accounts are excluded.
            </div>

            <!-- Private league rewards -->
            <div class="card p-4">
              <div class="flex items-center justify-between gap-3 mb-3 flex-wrap">
                <div class="text-xs text-ink-500 font-semibold uppercase tracking-wider">Private league consistency &amp; backed value</div>
                <button @click="exportRewardsPrivateCsv" :disabled="!rewardsReport.private_groups?.length" class="pill bg-sky-100 text-sky-700 hover:bg-sky-200 text-xs">Export CSV</button>
              </div>
              <div v-if="!rewardsReport.private_groups?.length" class="text-sm text-ink-400">No private-league activity for this month.</div>
              <div v-else class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="text-left text-xs text-ink-500 uppercase tracking-wider border-b border-ink-100">
                      <th class="py-2 pr-3">League</th>
                      <th class="py-2 pr-3">Creator</th>
                      <th class="py-2 pr-3 text-right">Members</th>
                      <th class="py-2 pr-3 text-right">Consistent</th>
                      <th class="py-2 pr-3 text-right">Consistency</th>
                      <th class="py-2 text-right">Backed value</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="g in rewardsReport.private_groups" :key="g.group_id" class="border-b border-ink-50">
                      <td class="py-2 pr-3 font-semibold text-ink-800"><span class="mr-1">{{ g.avatar_emoji }}</span>{{ g.name }}</td>
                      <td class="py-2 pr-3 text-ink-600">{{ g.creator || '—' }}</td>
                      <td class="py-2 pr-3 text-right tabular-nums text-ink-700">{{ g.member_count }}</td>
                      <td class="py-2 pr-3 text-right tabular-nums text-ink-700">{{ g.consistent_members }}</td>
                      <td class="py-2 pr-3 text-right tabular-nums font-extrabold text-emerald-600">{{ g.consistency_rate_pct }}%</td>
                      <td class="py-2 text-right tabular-nums font-bold text-teal-700">&#8358;{{ Number(g.cumulative_backed_value).toLocaleString() }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Club top performers -->
            <div class="card p-4">
              <div class="flex items-center justify-between gap-3 mb-3 flex-wrap">
                <div class="text-xs text-ink-500 font-semibold uppercase tracking-wider">Top performers by club league</div>
                <button @click="exportRewardsClubsCsv" :disabled="!rewardsReport.club_top_performers?.some((c) => c.top_performers?.length)" class="pill bg-sky-100 text-sky-700 hover:bg-sky-200 text-xs">Export CSV</button>
              </div>
              <div v-if="!rewardsReport.club_top_performers?.some((c) => c.member_count > 0)" class="text-sm text-ink-400">No club-league members with activity this month.</div>
              <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div v-for="c in rewardsReport.club_top_performers.filter((x) => x.member_count > 0)" :key="c.group_id" class="rounded-xl border border-ink-100 p-3">
                  <div class="flex items-center gap-2 mb-2">
                    <img v-if="c.logo_url" :src="c.logo_url" alt="" class="w-6 h-6 object-contain shrink-0" />
                    <span class="font-bold text-ink-900">{{ c.name }}</span>
                    <span class="text-xs text-ink-400">{{ c.member_count }} members</span>
                  </div>
                  <div v-if="!c.top_performers?.length" class="text-sm text-ink-400">No scored predictions yet.</div>
                  <table v-else class="w-full text-sm">
                    <tbody class="divide-y divide-ink-50">
                      <tr v-for="p in c.top_performers" :key="p.rank">
                        <td class="py-1.5 pr-2 font-bold text-ink-400 w-6">{{ p.rank }}</td>
                        <td class="py-1.5 pr-2 font-semibold text-ink-800 truncate">{{ p.username || '—' }}</td>
                        <td class="py-1.5 text-right tabular-nums font-extrabold text-ink-900">{{ p.points_month }} pts</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </template>
        </div>

        <!-- AUDIT PANEL -->
        <div v-if="reportPanel === 'audit'" class="space-y-5">
          <div class="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 class="font-bold text-ink-900">Leaderboard integrity &amp; timestamp audit</h3>
              <p class="text-sm text-ink-500">Prediction timestamps and applied power-ups, with a tie-break ranking on earliest cumulative prediction time.</p>
            </div>
            <div class="flex items-end gap-2 shrink-0">
              <div>
                <label class="label !mb-1">Gameweek</label>
                <input v-model="auditMatchweek" type="number" min="1" placeholder="All" class="input !py-2 w-24" />
              </div>
              <button @click="loadNamedReport('audit')" :disabled="namedReportLoading" class="btn-primary !py-2 !px-4 text-sm">{{ namedReportLoading ? 'Loading...' : 'Apply' }}</button>
            </div>
          </div>
          <div v-if="namedReportError" class="card p-4 text-sm text-coral-600">{{ namedReportError }}</div>
          <div v-if="namedReportLoading && !auditReport" class="card h-40 animate-pulse bg-ink-100/40"></div>
          <template v-else-if="auditReport">
            <div class="card p-5 space-y-3">
              <div class="flex items-center justify-between gap-3">
                <h4 class="font-bold text-ink-900">Tie-break ranking</h4>
                <button @click="exportAuditRankingCsv" :disabled="!auditReport.ranking.length" class="pill bg-sky-100 text-sky-700 hover:bg-sky-200 text-xs">Export CSV</button>
              </div>
              <p class="text-xs text-ink-500">Ordered by total points, then earliest cumulative prediction timestamp (lower = earlier).</p>
              <div v-if="!auditReport.ranking.length" class="text-sm text-ink-400">No ranking data yet.</div>
              <div v-else class="overflow-auto rounded-xl border border-ink-100 max-h-80">
                <table class="w-full text-sm">
                  <thead class="bg-ink-50 text-ink-500 text-xs uppercase sticky top-0">
                    <tr>
                      <th class="text-left px-3 py-2">#</th>
                      <th class="text-left px-3 py-2">User</th>
                      <th class="text-right px-3 py-2">Points</th>
                      <th class="text-right px-3 py-2">Picks</th>
                      <th class="text-left px-3 py-2">First pick</th>
                      <th class="text-right px-3 py-2">Cumulative (s)</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-ink-100">
                    <tr v-for="(x, i) in auditReport.ranking" :key="i">
                      <td class="px-3 py-2 font-bold text-ink-400">{{ i + 1 }}</td>
                      <td class="px-3 py-2 text-xs font-semibold text-ink-800">{{ x.username || x.email || '-' }}</td>
                      <td class="px-3 py-2 text-right tabular-nums font-bold">{{ x.total_points }}</td>
                      <td class="px-3 py-2 text-right tabular-nums">{{ x.predictions_count }}</td>
                      <td class="px-3 py-2 text-xs text-ink-500">{{ (x.first_prediction_at || '').slice(0, 16).replace('T', ' ') }}</td>
                      <td class="px-3 py-2 text-right tabular-nums text-ink-400">{{ x.cumulative_timestamp_epoch }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div class="card p-5 space-y-3">
              <div class="flex items-center justify-between gap-3">
                <h4 class="font-bold text-ink-900">Prediction timestamp log</h4>
                <button @click="exportAuditCsv" :disabled="!auditReport.rows.length" class="pill bg-sky-100 text-sky-700 hover:bg-sky-200 text-xs">Export CSV</button>
              </div>
              <div v-if="!auditReport.rows.length" class="text-sm text-ink-400">No predictions for this selection.</div>
              <div v-else class="overflow-auto rounded-xl border border-ink-100 max-h-96">
                <table class="w-full text-sm">
                  <thead class="bg-ink-50 text-ink-500 text-xs uppercase sticky top-0">
                    <tr>
                      <th class="text-left px-3 py-2">User</th>
                      <th class="text-left px-3 py-2">MW</th>
                      <th class="text-left px-3 py-2">Fixture</th>
                      <th class="text-left px-3 py-2">Predicted at</th>
                      <th class="text-left px-3 py-2">Power-ups</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-ink-100">
                    <tr v-for="(x, i) in auditReport.rows" :key="i">
                      <td class="px-3 py-2 text-xs font-semibold text-ink-800">{{ x.username || '-' }}</td>
                      <td class="px-3 py-2 text-xs">{{ x.matchweek }}</td>
                      <td class="px-3 py-2 text-xs text-ink-600">{{ x.fixture }}</td>
                      <td class="px-3 py-2 text-xs text-ink-500">{{ (x.predicted_at || '').slice(0, 19).replace('T', ' ') }}</td>
                      <td class="px-3 py-2 text-xs">{{ x.power_ups || '-' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </template>
        </div>
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
