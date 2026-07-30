<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const supabase = useSupabase()
const { user, isGuest, hasAccount, displayName, refreshUser, trackPulseEvent } = useAuth()
const { config: campaign, load: loadCampaign } = useCampaign()
const copiedAccount = ref(false)

const matches = ref<any[]>([])
const predictions = ref<Record<string, any>>({})
const loading = ref(true)
const view = ref<'today' | 'week' | 'past'>('today')



// Celebratory banners
const recentWins = ref<Array<{ id: string; title: string; body: string; type: string; metadata: any }>>([])
const dismissedBanners = ref<Set<string>>(new Set())

const visibleBanners = computed(() => recentWins.value.filter((n) => !dismissedBanners.value.has(n.id)))

const dismissBanner = async (id: string) => {
  dismissedBanners.value.add(id)
  await supabase.from('notifications').update({ read: true }).eq('id', id)
}

const loadRecentWins = async () => {
  if (!user.value) return
  const { data } = await supabase
    .from('notifications')
    .select('id, title, body, type, metadata')
    .eq('user_id', user.value.id)
    .eq('read', false)
    .in('type', ['prediction_correct', 'team_won'])
    .order('created_at', { ascending: false })
    .limit(5)
  recentWins.value = data || []
}

const loadData = async () => {
  loading.value = true
  await refreshUser()
  await loadCampaign()
  const { data: m } = await supabase
    .from('matches')
    .select('*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)')
    .order('kickoff_at', { ascending: true })
  matches.value = m || []

  if (user.value) {
    const { data: p } = await supabase
      .from('predictions')
      .select('*')
      .eq('user_id', user.value.id)
    predictions.value = (p || []).reduce((acc, pred) => {
      acc[pred.match_id] = pred
      return acc
    }, {} as Record<string, any>)
  }
  loading.value = false
}

onMounted(() => {
  loadData()
  loadRecentWins()
  trackPulseEvent('predictions_viewed')
})

const weekRange = computed(() => {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay(), 0, 0, 0, 0)
  const end = new Date(start.getTime() + 7 * 86_400_000 - 1)
  return { start: start.getTime(), end: end.getTime() }
})

const filteredMatches = computed(() => {
  const now = Date.now()
  const dayMs = 86_400_000
  const { start, end } = weekRange.value
  return matches.value.filter((m) => {
    const t = new Date(m.kickoff_at).getTime()
    if (view.value === 'today') {
      return t >= now - dayMs / 6 && t <= now + dayMs && m.status !== 'completed'
    }
    if (view.value === 'week') {
      return t >= start && t <= end && m.status !== 'completed'
    }
    return m.status === 'completed'
  })
})

const weekLabel = computed(() => {
  const { start, end } = weekRange.value
  const fmt = (d: number) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return `${fmt(start)} – ${fmt(end)}`
})

const onSaved = (pred: any) => {
  predictions.value[pred.match_id] = pred
}

const predictionsList = computed(() => Object.values(predictions.value) as any[])
const predictionsCount = computed(() => predictionsList.value.length)
const scoredPredictionsCount = computed(() => predictionsList.value.filter((p) => p.scored).length)
const correctPredictions = computed(() => user.value?.correct_predictions_count || 0)
const exactScorelines = computed(() => user.value?.exact_scorelines_count || 0)

const tabs = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'past', label: 'Past' },
] as const

const userPointsToday = computed(() => {
  return Object.values(predictions.value).reduce((sum: number, p: any) => sum + (p.points_awarded || 0), 0)
})

const copyAccountNumber = async () => {
  if (!user.value?.account_number) return
  await navigator.clipboard.writeText(user.value.account_number)
  copiedAccount.value = true
  setTimeout(() => (copiedAccount.value = false), 2000)
}
</script>

<template>
  <div class="space-y-6">
    <!-- Celebratory banners -->
    <TransitionGroup name="banner" tag="div" class="space-y-3">
      <div
        v-for="banner in visibleBanners"
        :key="banner.id"
        :class="[
          'relative rounded-2xl p-4 sm:p-5 border overflow-hidden',
          banner.metadata?.points >= 15
            ? 'bg-gradient-to-r from-sun-50 via-sun-100/50 to-mint-50 border-sun-200'
            : banner.type === 'team_won'
              ? 'bg-gradient-to-r from-sky-50 to-mint-50 border-sky-200'
              : 'bg-gradient-to-r from-mint-50 to-sky-50 border-mint-200',
        ]"
      >
        <button
          @click="dismissBanner(banner.id)"
          class="absolute top-3 right-3 w-6 h-6 rounded-full bg-white/80 hover:bg-white text-ink-400 hover:text-ink-600 grid place-items-center transition"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
        <div class="flex items-center gap-4">
          <div :class="[
            'w-12 h-12 rounded-xl grid place-items-center shrink-0',
            banner.metadata?.points >= 15 ? 'bg-sun-200' : banner.type === 'team_won' ? 'bg-sky-200' : 'bg-mint-200',
          ]">
            <span v-if="banner.metadata?.points >= 15" class="text-2xl">&#127942;</span>
            <span v-else-if="banner.type === 'team_won'" class="text-2xl">&#11088;</span>
            <span v-else class="text-2xl">&#9989;</span>
          </div>
          <div class="min-w-0 flex-1">
            <div :class="[
              'font-extrabold text-base leading-tight',
              banner.metadata?.points >= 15 ? 'text-sun-800' : banner.type === 'team_won' ? 'text-sky-800' : 'text-mint-800',
            ]">
              {{ banner.title }}
            </div>
            <div v-if="banner.body" class="text-sm text-ink-600 mt-0.5">{{ banner.body }}</div>
          </div>
        </div>
      </div>
    </TransitionGroup>

    <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
      <div>
        <h1 class="text-3xl font-extrabold text-ink-900">Make your predictions</h1>
        <p class="mt-1 text-ink-500">
          Hello, <span class="font-semibold text-ink-800">{{ displayName.split(' ')[0] }}</span> — every pick counts.
        </p>
      </div>
      <div class="flex items-center gap-3">
        <div v-if="user" class="card px-4 py-3">
          <div class="text-xs uppercase tracking-wider font-semibold text-ink-400">Your points</div>
          <div class="text-2xl font-extrabold text-sky-600">{{ user.total_points }}</div>
        </div>
        <div v-if="user && !user.active_customer_flag" class="pill bg-coral-50 text-coral-700 max-w-[14rem]">
          Make a qualifying transaction to qualify
        </div>
      </div>
    </div>

    <!-- Account details card -->
    <div v-if="user && user.account_number && !isGuest" class="card p-4 bg-gradient-to-r from-sky-50 to-ink-50 border-sky-100">
      <div class="flex items-center justify-between gap-3">
        <div>
          <div class="text-[10px] uppercase tracking-wider font-semibold text-ink-400">Your Account</div>
          <div class="text-xs text-ink-500 mt-0.5">{{ user.bank_name || 'Bank Account' }}</div>
          <div class="font-mono text-lg font-bold text-ink-900 mt-0.5">{{ user.account_number }}</div>
        </div>
        <button
          @click="copyAccountNumber"
          class="flex items-center gap-1.5 pill bg-white text-sky-700 hover:bg-sky-100 border border-sky-200 text-xs font-semibold transition"
        >
          <svg v-if="!copiedAccount" class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
          <svg v-else class="w-3.5 h-3.5 text-mint-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
          {{ copiedAccount ? 'Copied!' : 'Copy' }}
        </button>
      </div>
    </div>

    <!-- Shareable Stats Card -->
    <ShareStatsCard
      v-if="user && !loading && scoredPredictionsCount > 0"
      :total-points="user.total_points"
      :predictions-count="scoredPredictionsCount"
      :correct-predictions="correctPredictions"
      :exact-scorelines="exactScorelines"
      :backed-team="user.backed_team"
    />

    <!-- Predictions paused banner -->
    <div v-if="!campaign.predictions_enabled" class="card p-6 sm:p-8 text-center bg-ink-50 border-ink-200">
      <div class="w-12 h-12 rounded-2xl bg-ink-200 mx-auto grid place-items-center mb-4">
        <svg class="w-6 h-6 text-ink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
      </div>
      <h3 class="text-lg font-extrabold text-ink-900 mb-1">Predictions paused</h3>
      <p class="text-sm text-ink-600">Predictions are currently disabled. Check back when the next round of matches opens!</p>
    </div>

    <template v-if="campaign.predictions_enabled">
    <div class="flex items-center gap-3 flex-wrap">
      <div class="card p-1.5 inline-flex">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="view = tab.id; trackPulseEvent('predictions_tab_switched', { tab: tab.id })"
          :class="[
            'px-4 py-2 rounded-lg text-sm font-semibold transition',
            view === tab.id ? 'bg-sky-600 text-white shadow-pop' : 'text-ink-600 hover:bg-ink-100',
          ]"
        >
          {{ tab.label }}
        </button>
      </div>
      <span v-if="view === 'week'" class="pill bg-ink-100 text-ink-600">
        Sun {{ weekLabel }} Sat
      </span>
    </div>

    <div v-if="loading" class="grid sm:grid-cols-2 gap-4">
      <div v-for="n in 4" :key="n" class="card h-72 animate-pulse bg-ink-100/40"></div>
    </div>

    <div v-else-if="filteredMatches.length === 0" class="card p-12 text-center">
      <div class="text-5xl mb-3">⚽</div>
      <h3 class="text-xl font-bold text-ink-900">No matches in this view</h3>
      <p class="text-ink-500 mt-1">Check back soon — fixtures are added daily.</p>
    </div>

    <div v-else class="grid sm:grid-cols-2 gap-4">
      <MatchCard
        v-for="m in filteredMatches"
        :key="m.id"
        :match="m"
        :prediction="predictions[m.id]"
        @saved="onSaved"
      />
    </div>
    </template>

    <!-- Upgrade banner for users without account numbers -->
    <div v-if="isGuest || !hasAccount" class="card p-4 sm:p-5 bg-gradient-to-r from-sun-50 to-sky-50 border-sun-200">
      <div class="flex flex-col sm:flex-row sm:items-center gap-3">
        <div class="flex-1">
          <p class="font-bold text-ink-900 text-sm">{{ isGuest ? "You're playing as a guest" : "You're not fully eligible yet" }}</p>
          <p class="text-xs text-ink-600 mt-0.5">
            Your predictions are saved, but to appear on the leaderboard, pick a team, and win prizes, you need a Sycamore account. Sign up with <span class="font-bold">{{ user?.email }}</span> so everything links up.
          </p>
        </div>
        <a
          href="https://appsflyer.sycamore.ng/Qthc/worldcup_website"
          target="_blank"
          rel="noreferrer"
          class="btn-primary text-sm px-5 py-2.5 shrink-0 text-center"
        >
          Sign up on Sycamore
        </a>
      </div>
    </div>
  </div>
</template>
