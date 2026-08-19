<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const supabase = useSupabase()
const { user, isGuest, hasAccount, isStaff, isEnrolled, joinCampaign, refreshUser, trackPulseEvent, campaignPoints } = useAuth()
const { campaignId } = useCampaign()
const { config: campaign, load: loadCampaign } = useCampaign()

type LeaderboardMode = 'week' | 'overall'
const mode = ref<LeaderboardMode>('week')

const players = ref<any[]>([])
const weeklyPlayers = ref<any[]>([])
const staffPlayers = ref<any[]>([])
const staffPlayersOverall = ref<any[]>([])
const loading = ref(true)
const activeTab = ref<'public' | 'staff'>('public')
const streaks = ref<Record<string, number>>({})

const joining = ref(false)
const handleJoin = async () => {
  if (!campaignId.value) return
  joining.value = true
  await joinCampaign(campaignId.value)
  await load()
  joining.value = false
}

const weekStart = ref('')
const weekEnd = ref('')
const weekNumber = ref(1)

const displayUsername = (p: any) => {
  return p.username || (p.name || '').split(' ')[0] || 'Player'
}

const formatWeekDate = (iso: string) => {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short' })
}

const loadWeekBounds = async () => {
  const { data } = await supabase.rpc('get_week_bounds')
  if (data && data.length > 0) {
    weekStart.value = data[0].week_start
    weekEnd.value = data[0].week_end
    weekNumber.value = data[0].week_number || 1
  }
}

const loadOverall = async () => {
  if (!campaignId.value) return
  const { data } = await supabase
    .from('campaign_participants')
    .select('id, user_id, total_points, correct_predictions_count, exact_scorelines_count, backed_team:teams!campaign_participants_backed_team_id_fkey(flag_emoji, code, logo_url), user:synced_users!campaign_participants_user_id_fkey(id, name, username, email, active_customer_flag, is_account_valid, is_staff)')
    .eq('campaign_id', campaignId.value)
    .order('total_points', { ascending: false })
    .order('exact_scorelines_count', { ascending: false })
    .order('correct_predictions_count', { ascending: false })
    .limit(200)
  const requireActive = campaign.value.require_eligibility_leaderboard
  const mapped = (data || []).filter((p: any) => (!requireActive || (p.user?.active_customer_flag && p.user?.is_account_valid)) && !p.user?.is_staff).map((p: any) => ({
    id: p.user.id,
    name: p.user.name,
    username: p.user.username,
    email: p.user.email,
    is_staff: p.user.is_staff,
    total_points: p.total_points,
    exact_scorelines_count: p.exact_scorelines_count,
    correct_predictions_count: p.correct_predictions_count,
    backed_team: p.backed_team,
  })).slice(0, 100)
  players.value = mapped
}

const loadWeekly = async () => {
  const { data } = await supabase
    .from('weekly_leaderboard')
    .select('*')
    .eq('is_staff', false)
    .order('rank', { ascending: true })
    .limit(100)

  weeklyPlayers.value = (data || []).map((p: any) => ({
    ...p,
    id: p.user_id,
    total_points: p.week_points,
  }))
}

const loadStaff = async () => {
  if (!isStaff.value) return
  const { data } = await supabase
    .from('weekly_leaderboard')
    .select('*')
    .eq('is_staff', true)
    .order('rank', { ascending: true })
    .limit(50)
  staffPlayers.value = (data || []).map((p: any) => ({
    ...p,
    id: p.user_id,
    total_points: p.week_points,
  }))
}

const loadStaffOverall = async () => {
  if (!isStaff.value || !campaignId.value) return
  const { data } = await supabase
    .from('campaign_participants')
    .select('id, user_id, total_points, correct_predictions_count, exact_scorelines_count, backed_team:teams!campaign_participants_backed_team_id_fkey(flag_emoji, code, logo_url), user:synced_users!campaign_participants_user_id_fkey(id, name, username, email, is_staff)')
    .eq('campaign_id', campaignId.value)
    .order('total_points', { ascending: false })
    .order('exact_scorelines_count', { ascending: false })
    .order('correct_predictions_count', { ascending: false })
    .limit(100)
  staffPlayersOverall.value = (data || []).filter((p: any) => p.user?.is_staff).map((p: any) => ({
    id: p.user.id,
    name: p.user.name,
    username: p.user.username,
    email: p.user.email,
    is_staff: true,
    total_points: p.total_points,
    exact_scorelines_count: p.exact_scorelines_count,
    correct_predictions_count: p.correct_predictions_count,
    backed_team: p.backed_team,
  })).slice(0, 50)
}

const tournamentEnded = computed(() => campaign.value.campaign_ended === true)

const overallChampion = computed(() => {
  if (!tournamentEnded.value || players.value.length === 0) return null
  return players.value[0]
})

const staffChampion = computed(() => {
  if (!tournamentEnded.value || !isStaff.value || staffPlayersOverall.value.length === 0) return null
  return staffPlayersOverall.value[0]
})

const load = async () => {
  await refreshUser()
  await loadCampaign()
  if (!campaign.value.leaderboard_enabled || (campaign.value.require_eligibility_leaderboard && (isGuest.value || !hasAccount.value))) {
    loading.value = false
    return
  }
  loading.value = true
  await Promise.all([loadWeekBounds(), loadOverall(), loadWeekly(), loadStaff(), loadStaffOverall()])
  // Load streaks for all players
  if (campaignId.value) {
    const { data: streakData } = await supabase.from('user_streaks').select('user_id, current_streak').eq('campaign_id', campaignId.value).gte('current_streak', 3)
    const map: Record<string, number> = {}
    for (const s of streakData || []) map[s.user_id] = s.current_streak
    streaks.value = map
  }
  loading.value = false
}

const currentPlayers = computed(() => {
  if (activeTab.value === 'staff') {
    return mode.value === 'week' ? staffPlayers.value : staffPlayersOverall.value
  }
  return mode.value === 'week' ? weeklyPlayers.value : players.value
})

const myRank = computed(() => {
  if (!user.value) return null
  const list = currentPlayers.value
  const idx = list.findIndex((p) => p.id === user.value!.id)
  return idx >= 0 ? displayRank(list, idx) : null
})

const myWeekPoints = computed(() => {
  if (!user.value) return 0
  const entry = weeklyPlayers.value.find((p) => p.id === user.value!.id)
    || staffPlayers.value.find((p) => p.id === user.value!.id)
  return entry?.week_points || entry?.total_points || 0
})

const isStartOfTiedGroup = (list: any[], index: number) => {
  if (index < 0 || index >= list.length) return false
  const p = list[index]
  if (p.total_points === 0) return false
  const prev = index > 0 ? list[index - 1] : null
  const next = index < list.length - 1 ? list[index + 1] : null
  const hasTie = (prev && prev.total_points === p.total_points) || (next && next.total_points === p.total_points)
  if (!hasTie) return false
  return !prev || prev.total_points !== p.total_points
}

const getExacts = (p: any) => mode.value === 'week' ? (p.exact_scorelines || 0) : (p.exact_scorelines_count || 0)
const getCorrects = (p: any) => mode.value === 'week' ? (p.correct_predictions || 0) : (p.correct_predictions_count || 0)
const getMatchesPredicted = (p: any) => p.matches_predicted || 0

const isFullyTied = (a: any, b: any) => {
  if (a.total_points !== b.total_points) return false
  if (getExacts(a) !== getExacts(b)) return false
  if (getCorrects(a) !== getCorrects(b)) return false
  if (mode.value === 'week' && getMatchesPredicted(a) !== getMatchesPredicted(b)) return false
  return true
}

const displayRank = (list: any[], index: number) => {
  for (let i = index - 1; i >= 0; i--) {
    if (!isFullyTied(list[i], list[index])) return i + 2
  }
  return 1
}

const podiumColors = [
  'from-sun-300 to-sun-500',
  'from-ink-200 to-ink-400',
  'from-coral-300 to-coral-500',
]

const showShareRank = ref(false)
const rankShareText = computed(() => {
  if (!myRank.value || !user.value) return ''
  const pts = mode.value === 'week' ? myWeekPoints.value : campaignPoints.value
  const label = mode.value === 'week' ? 'this week' : 'overall'
  return `I'm ranked #${myRank.value} with ${pts} points ${label} on the Sycamore Predictor League! Can you beat me?\n\n#SycamorePredictor`
})

const rankImageProps = computed(() => {
  if (!myRank.value || !user.value) return undefined
  const pts = mode.value === 'week' ? myWeekPoints.value : campaignPoints.value
  const label = mode.value === 'week' ? `Week ${weekNumber.value} leaderboard` : 'Overall leaderboard'
  return {
    variant: 'rank' as const,
    username: user.value.username || user.value.email?.split('@')[0] || 'player',
    rankPosition: myRank.value,
    rankPoints: pts,
    rankLabel: label,
  }
})

const switchTab = (tab: 'public' | 'staff') => {
  activeTab.value = tab
  trackPulseEvent('leaderboard_tab_switched', { tab })
}

const switchMode = (m: LeaderboardMode) => {
  mode.value = m
  trackPulseEvent('leaderboard_mode_switched', { mode: m })
}

const openShareRank = () => {
  showShareRank.value = true
  trackPulseEvent('leaderboard_share_opened', { rank: myRank.value, points: user.value?.total_points })
}

onMounted(() => {
  load()
  trackPulseEvent('leaderboard_viewed')
})
</script>

<template>
  <div class="space-y-8">
    <!-- Leaderboard not enabled -->
    <template v-if="!campaign.leaderboard_enabled">
      <div class="card p-12 sm:p-16 text-center max-w-lg mx-auto">
        <div class="w-16 h-16 rounded-2xl bg-sky-100 mx-auto grid place-items-center mb-5">
          <svg class="w-8 h-8 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        </div>
        <h1 class="text-2xl font-extrabold text-ink-900 mb-2">Leaderboard coming soon</h1>
        <p class="text-sm text-ink-600 leading-relaxed">
          The leaderboard will go live once the campaign kicks off. Start making predictions now so you're ready!
        </p>
      </div>
    </template>

    <!-- Guest users or users without account numbers -->
    <template v-else-if="campaign.require_eligibility_leaderboard && (isGuest || !hasAccount)">
      <div class="card p-12 sm:p-16 text-center max-w-lg mx-auto">
        <div class="w-16 h-16 rounded-2xl bg-sun-100 mx-auto grid place-items-center mb-5">
          <svg class="w-8 h-8 text-sun-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
          </svg>
        </div>
        <h1 class="text-2xl font-extrabold text-ink-900 mb-2">Sycamore account required</h1>
        <p class="text-sm text-ink-600 leading-relaxed max-w-sm mx-auto">
          The leaderboard is available to Sycamore customers with an account number. Sign up on the Sycamore app to see rankings and compete for prizes.
        </p>
        <a
          href="https://appsflyer.sycamore.ng/Qthc/EPL"
          target="_blank"
          rel="noreferrer"
          class="btn-primary px-8 py-3 text-sm inline-block mt-6"
        >
          Get the Sycamore App
        </a>
      </div>
    </template>

    <!-- Not enrolled in campaign -->
    <template v-else-if="!isEnrolled">
      <div class="card p-12 sm:p-16 text-center max-w-lg mx-auto animate-fade-up">
        <div class="w-16 h-16 rounded-2xl bg-sky-100 mx-auto grid place-items-center mb-5">
          <svg class="w-8 h-8 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/>
          </svg>
        </div>
        <h1 class="text-2xl font-extrabold text-ink-900 mb-2">Join {{ campaign.name }}</h1>
        <p class="text-sm text-ink-600 leading-relaxed max-w-sm mx-auto">
          Join this campaign to appear on the leaderboard, compete for weekly prizes, and track your ranking.
        </p>
        <button
          @click="handleJoin"
          :disabled="joining"
          class="btn-primary px-8 py-3 text-sm inline-flex items-center gap-2 mt-6"
        >
          <span v-if="joining" class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
          {{ joining ? 'Joining...' : 'Join campaign' }}
        </button>
      </div>
    </template>

    <!-- Leaderboard enabled -->
    <template v-else>
      <!-- Tournament ended celebration -->
      <template v-if="tournamentEnded && !loading">
        <LeaderboardCelebration
          v-if="overallChampion"
          :champion="overallChampion"
          :current-user-id="user?.id"
          label="Overall Champion"
        />
        <LeaderboardCelebration
          v-if="staffChampion"
          :champion="staffChampion"
          :current-user-id="user?.id"
          label="Staff Champion"
        />
      </template>

      <!-- Header with mode toggle -->
      <div class="flex flex-col gap-4">
        <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 class="text-3xl font-extrabold text-ink-900">Leaderboard</h1>
            <p class="mt-1 text-ink-500">
              {{ mode === 'week' ? 'Weekly standings — resets every week.' : 'All-time standings — counts towards the grand prize.' }}
            </p>
          </div>
          <div v-if="user" class="card px-4 py-3 flex items-center gap-4">
            <div>
              <div class="text-xs uppercase tracking-wider font-semibold text-ink-400">Your rank</div>
              <div class="text-2xl font-extrabold text-sky-600">
                {{ myRank ? `#${myRank}` : '—' }}
              </div>
            </div>
            <div class="w-px h-10 bg-ink-100"></div>
            <div>
              <div class="text-xs uppercase tracking-wider font-semibold text-ink-400">{{ mode === 'week' ? 'Week pts' : 'Total pts' }}</div>
              <div class="text-2xl font-extrabold text-mint-600">{{ mode === 'week' ? myWeekPoints : campaignPoints }}</div>
            </div>
            <div class="w-px h-10 bg-ink-100"></div>
            <button
              v-if="myRank"
              @click="openShareRank"
              class="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-ink-100 text-ink-600 transition"
              title="Share your rank"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
            </button>
          </div>
        </div>

        <!-- Week / Overall toggle -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div class="card p-1.5 inline-flex self-start">
            <button
              @click="switchMode('week')"
              :class="[
                'px-4 py-2 rounded-lg text-sm font-semibold transition',
                mode === 'week' ? 'bg-sky-600 text-white shadow-pop' : 'text-ink-600 hover:bg-ink-100',
              ]"
            >
              This Week
            </button>
            <button
              @click="switchMode('overall')"
              :class="[
                'px-4 py-2 rounded-lg text-sm font-semibold transition',
                mode === 'overall' ? 'bg-sky-600 text-white shadow-pop' : 'text-ink-600 hover:bg-ink-100',
              ]"
            >
              Overall
            </button>
            <button
              v-if="isStaff"
              @click="switchTab(activeTab === 'staff' ? 'public' : 'staff')"
              :class="[
                'px-4 py-2 rounded-lg text-sm font-semibold transition',
                activeTab === 'staff' ? 'bg-ink-700 text-white shadow-pop' : 'text-ink-600 hover:bg-ink-100',
              ]"
            >
              Staff
            </button>
          </div>

          <!-- Week date banner -->
          <div v-if="mode === 'week' && weekStart" class="flex items-center gap-2 bg-sky-50 border border-sky-100 rounded-xl px-4 py-2.5">
            <svg class="w-4 h-4 text-sky-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
            <div class="text-sm">
              <span class="font-bold text-sky-700">Week {{ weekNumber }}</span>
              <span class="text-sky-600 mx-1.5">|</span>
              <span class="font-semibold text-sky-600">{{ formatWeekDate(weekStart) }}</span>
              <span class="text-sky-400 mx-1"> - </span>
              <span class="font-semibold text-sky-600">{{ formatWeekDate(weekEnd) }}</span>
            </div>
          </div>
        </div>

        <!-- Fresh week callout -->
        <div v-if="mode === 'week' && !loading && weeklyPlayers.length === 0 && weekStart" class="rounded-2xl border-2 border-dashed border-sky-200 bg-sky-50/50 p-6 text-center">
          <div class="w-12 h-12 rounded-xl bg-sky-100 mx-auto grid place-items-center mb-3">
            <svg class="w-6 h-6 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          </div>
          <h3 class="font-bold text-sky-800 text-lg">Fresh week, fresh start!</h3>
          <p class="text-sm text-sky-600 mt-1 max-w-md mx-auto">
            A new week has started! Make your predictions to climb this week's rankings.
          </p>
          <NuxtLink to="/predict" class="btn-primary px-6 py-2.5 text-sm inline-block mt-4">
            Make predictions
          </NuxtLink>
        </div>
      </div>

      <div v-if="loading" class="card h-96 animate-pulse bg-ink-100/40"></div>

      <template v-else-if="currentPlayers.length > 0">
        <!-- Podium -->
        <div v-if="currentPlayers.length >= 3" class="grid grid-cols-3 gap-3 sm:gap-6">
          <div
            v-for="(p, i) in [currentPlayers[1], currentPlayers[0], currentPlayers[2]]"
            :key="p.id"
            :class="[
              'card p-4 sm:p-6 text-center relative overflow-hidden animate-fade-up',
              i === 1 ? 'sm:scale-110 sm:-mt-4' : '',
            ]"
          >
            <div :class="['absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-30 bg-gradient-to-br', podiumColors[[1, 0, 2][i]]]"></div>
            <div class="relative">
              <div class="text-3xl sm:text-4xl mb-2">
                {{ ['&#129352;', '&#129351;', '&#129353;'][i] }}
              </div>
              <div class="font-bold text-ink-900 truncate lowercase">
                {{ displayUsername(p) }}
                <span v-if="streaks[p.user_id || p.id] >= 10">&#x1F31F;&#x1F525;</span>
                <span v-else-if="streaks[p.user_id || p.id] >= 5">&#x1F535;&#x1F525;</span>
                <span v-else-if="streaks[p.user_id || p.id] >= 3">&#x1F525;</span>
              </div>
              <div class="text-xs text-ink-400 mb-3">#{{ [2, 1, 3][i] }}</div>
              <div class="inline-flex pill bg-sky-50 text-sky-700 text-base">{{ p.total_points }} pts</div>
            </div>
          </div>
        </div>

        <!-- Full table -->
        <div class="card overflow-hidden">
          <div class="px-4 sm:px-6 py-3 border-b border-ink-100 flex items-center justify-between">
            <h2 class="font-bold text-ink-900">
              {{ activeTab === 'staff' ? 'Staff Standings' : mode === 'week' ? 'This Week' : 'All-Time Standings' }}
            </h2>
            <span class="text-xs text-ink-400">{{ currentPlayers.length }} players</span>
          </div>
          <ul class="divide-y divide-ink-100">
            <template v-for="(p, i) in currentPlayers" :key="p.id">
              <li
                v-if="isStartOfTiedGroup(currentPlayers, i)"
                class="px-4 sm:px-6 py-1.5 bg-sun-50/60 border-b border-sun-100"
              >
                <span class="text-[11px] font-semibold uppercase tracking-wide text-sun-700">
                  {{ p.total_points }} pts tied — ranked by exact scorelines, then correct predictions{{ mode === 'week' ? ', then matches predicted' : '' }}
                </span>
              </li>
              <li
                :class="[
                  'flex items-center gap-4 px-4 sm:px-6 py-3 transition',
                  user && p.id === user.id ? 'bg-sky-50/60' : 'hover:bg-ink-50/50',
                ]"
              >
                <div
                  :class="[
                    'w-9 h-9 rounded-lg grid place-items-center text-sm font-bold',
                    displayRank(currentPlayers, i) === 1 ? 'bg-sun-100 text-sun-800'
                      : displayRank(currentPlayers, i) === 2 ? 'bg-ink-100 text-ink-700'
                      : displayRank(currentPlayers, i) === 3 ? 'bg-coral-100 text-coral-700'
                      : 'bg-ink-50 text-ink-500',
                  ]"
                >
                  {{ displayRank(currentPlayers, i) }}
                </div>
                <div class="flex-1 min-w-0">
                  <div class="font-semibold text-ink-900 truncate lowercase flex items-center gap-1">
                    {{ displayUsername(p) }}
                    <span v-if="streaks[p.user_id || p.id] >= 10" class="text-sm" title="Legendary streak">&#x1F31F;&#x1F525;</span>
                    <span v-else-if="streaks[p.user_id || p.id] >= 5" class="text-sm" title="Hot streak">&#x1F535;&#x1F525;</span>
                    <span v-else-if="streaks[p.user_id || p.id] >= 3" class="text-sm" title="On a streak">&#x1F525;</span>
                    <span v-if="user && p.id === user.id" class="ml-1 pill bg-sky-100 text-sky-700 text-[10px]">You</span>
                  </div>
                  <div v-if="mode === 'week'" class="text-xs text-ink-500 truncate">
                    {{ p.correct_predictions || 0 }} correct · {{ p.exact_scorelines || 0 }} exact
                  </div>
                  <div v-else class="text-xs text-ink-500 truncate">
                    {{ p.correct_predictions_count || 0 }} correct · {{ p.exact_scorelines_count || 0 }} exact
                  </div>
                </div>
                <div class="font-extrabold text-ink-900 tabular-nums">
                  {{ p.total_points }}
                  <span class="text-xs font-semibold text-ink-400">pts</span>
                </div>
              </li>
            </template>
          </ul>
        </div>
      </template>

      <div v-else-if="!loading && mode === 'overall'" class="card px-6 py-12 text-center">
        <p class="text-ink-500 text-sm">No players on the board yet. Start making predictions!</p>
      </div>
    </template>

    <ShareModal
      v-if="showShareRank"
      :text="rankShareText"
      :image-card-props="rankImageProps"
      title="My Leaderboard Rank"
      @close="showShareRank = false"
    />
  </div>
</template>
