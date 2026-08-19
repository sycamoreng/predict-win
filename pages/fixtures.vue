<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const supabase = useSupabase()
const { user, refreshUser, trackPulseEvent } = useAuth()
const { config: campaign, load: loadCampaign, campaignId } = useCampaign()
const matches = ref<any[]>([])
const predictions = ref<Record<string, any>>({})
const loading = ref(true)
const search = ref('')
const selectedWeek = ref<number | 'all'>('all')

const loadData = async () => {
  loading.value = true
  await loadCampaign()
  await refreshUser()
  if (!campaignId.value) {
    loading.value = false
    return
  }
  const { data: m } = await supabase
    .from('matches')
    .select('*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)')
    .eq('campaign_id', campaignId.value)
    .order('kickoff_at', { ascending: true })
  matches.value = m || []

  if (user.value) {
    const { data: p } = await supabase
      .from('predictions')
      .select('*')
      .eq('user_id', user.value.id)
      .eq('campaign_id', campaignId.value)
    predictions.value = (p || []).reduce((acc: Record<string, any>, pred: any) => {
      acc[pred.match_id] = pred
      return acc
    }, {})
  }
  loading.value = false
}

onMounted(() => {
  loadData()
  trackPulseEvent('fixtures_page_viewed')
})

const onSaved = (pred: any) => {
  predictions.value[pred.match_id] = pred
}

const availableWeeks = computed(() => {
  const weeks = new Set<number>()
  for (const m of matches.value) {
    if (m.matchweek) weeks.add(m.matchweek)
  }
  return Array.from(weeks).sort((a, b) => a - b)
})

const currentWeek = computed(() => {
  const scheduled = matches.value.filter((m) => m.status === 'scheduled' || m.status === 'postponed')
  if (scheduled.length && scheduled[0].matchweek) return scheduled[0].matchweek
  const completed = matches.value.filter((m) => m.status === 'completed')
  if (completed.length) {
    const last = completed.reduce((a, b) => (a.matchweek || 0) > (b.matchweek || 0) ? a : b)
    return (last.matchweek || 0) + 1
  }
  return 1
})

// Auto-select current week on load
watch([loading], () => {
  if (!loading.value && selectedWeek.value === 'all') {
    selectedWeek.value = currentWeek.value
  }
})

const filtered = computed(() => {
  let result = matches.value
  if (selectedWeek.value !== 'all') {
    result = result.filter((m) => m.matchweek === selectedWeek.value)
  }
  if (search.value.trim()) {
    const q = search.value.toLowerCase().trim()
    result = result.filter((m) =>
      m.home_team?.name?.toLowerCase().includes(q) ||
      m.away_team?.name?.toLowerCase().includes(q) ||
      m.home_team?.code?.toLowerCase().includes(q) ||
      m.away_team?.code?.toLowerCase().includes(q)
    )
  }
  return result
})

const groupedByDate = computed(() => {
  const map: Record<string, any[]> = {}
  for (const m of filtered.value) {
    const day = m.kickoff_at?.slice(0, 10) || 'TBD'
    if (!map[day]) map[day] = []
    map[day].push(m)
  }
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
})

const formatDateHeading = (dateStr: string) => {
  if (dateStr === 'TBD') return 'Date TBD'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
}

const weekStats = computed(() => {
  if (selectedWeek.value === 'all') return null
  const weekMatches = matches.value.filter((m) => m.matchweek === selectedWeek.value)
  const completed = weekMatches.filter((m) => m.status === 'completed').length
  const predicted = weekMatches.filter((m) => predictions.value[m.id]).length
  return { total: weekMatches.length, completed, predicted }
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center gap-3">
      <NuxtLink to="/predict" class="w-9 h-9 rounded-xl bg-ink-100 hover:bg-ink-200 grid place-items-center transition">
        <svg class="w-5 h-5 text-ink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
      </NuxtLink>
      <div>
        <h1 class="text-2xl font-extrabold text-ink-900">Fixtures</h1>
        <p class="text-sm text-ink-500">{{ matches.length }} matches across {{ availableWeeks.length }} matchweeks</p>
      </div>
    </div>

    <!-- Matchweek selector -->
    <div class="flex flex-col sm:flex-row gap-3">
      <div class="relative flex-1">
        <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        <input
          v-model="search"
          type="text"
          placeholder="Search teams..."
          class="input pl-10"
        />
      </div>
      <select v-model="selectedWeek" class="input sm:w-56">
        <option value="all">All matchweeks</option>
        <option v-for="w in availableWeeks" :key="w" :value="w">
          Matchweek {{ w }}{{ w === currentWeek ? ' (current)' : '' }}
        </option>
      </select>
    </div>

    <!-- Quick matchweek navigation -->
    <div class="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
      <button
        v-for="w in availableWeeks"
        :key="w"
        @click="selectedWeek = w"
        class="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition"
        :class="selectedWeek === w
          ? 'bg-sky-600 text-white shadow-sm'
          : w === currentWeek
            ? 'bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100'
            : 'bg-ink-50 text-ink-600 hover:bg-ink-100'"
      >
        {{ w }}
      </button>
    </div>

    <!-- Week stats -->
    <div v-if="weekStats" class="card p-3 flex items-center gap-4">
      <div class="flex items-center gap-2">
        <div class="w-8 h-8 rounded-lg bg-sky-100 grid place-items-center">
          <svg class="w-4 h-4 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
        </div>
        <div>
          <p class="text-xs font-bold text-ink-900">Matchweek {{ selectedWeek }}</p>
          <p class="text-[11px] text-ink-500">{{ weekStats.total }} matches · {{ weekStats.predicted }} predicted · {{ weekStats.completed }} completed</p>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="grid sm:grid-cols-2 gap-4">
      <div v-for="n in 8" :key="n" class="card h-36 animate-pulse bg-ink-100/40"></div>
    </div>

    <!-- Empty -->
    <div v-else-if="filtered.length === 0" class="card p-12 text-center">
      <div class="w-14 h-14 rounded-2xl bg-ink-100 mx-auto grid place-items-center mb-4">
        <svg class="w-7 h-7 text-ink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
      </div>
      <h3 class="text-lg font-bold text-ink-900">No matches found</h3>
      <p class="text-sm text-ink-500 mt-1">Try adjusting your search or selecting a different matchweek.</p>
    </div>

    <!-- Grouped matches -->
    <div v-else class="space-y-8">
      <div v-for="[date, dayMatches] in groupedByDate" :key="date">
        <div class="flex items-center gap-3 mb-3">
          <h2 class="text-sm font-bold text-ink-700 uppercase tracking-wider">{{ formatDateHeading(date) }}</h2>
          <div class="h-px flex-1 bg-ink-100"></div>
          <span class="text-xs text-ink-400 font-semibold">{{ dayMatches.length }} {{ dayMatches.length === 1 ? 'match' : 'matches' }}</span>
        </div>
        <div class="grid sm:grid-cols-2 gap-4">
          <MatchCard
            v-for="m in dayMatches"
            :key="m.id"
            :match="m"
            :prediction="predictions[m.id]"
            :campaign="campaign"
            :matchweek-locked="m.matchweek !== currentWeek"
            @saved="onSaved"
          />
        </div>
      </div>
    </div>
  </div>
</template>
