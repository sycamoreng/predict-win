<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const supabase = useSupabase()
const { user, trackPulseEvent } = useAuth()

type FilterMode = 'all' | 'day' | 'week'
const filterMode = ref<FilterMode>('all')
const selectedDate = ref(new Date().toISOString().slice(0, 10))

const predictions = ref<any[]>([])
const loading = ref(true)

const selectedWeekStart = computed(() => {
  const d = new Date(selectedDate.value + 'T00:00:00Z')
  const day = d.getUTCDay()
  const start = new Date(d.getTime() - day * 86_400_000)
  return start.toISOString().slice(0, 10)
})

const selectedWeekEnd = computed(() => {
  const start = new Date(selectedWeekStart.value + 'T00:00:00Z')
  const end = new Date(start.getTime() + 7 * 86_400_000)
  return end.toISOString().slice(0, 10)
})

const filteredPredictions = computed(() => {
  if (filterMode.value === 'all') return predictions.value

  return predictions.value.filter((p) => {
    const kickoff = (p.match?.kickoff_at || '').slice(0, 10)
    if (filterMode.value === 'day') {
      return kickoff === selectedDate.value
    }
    return kickoff >= selectedWeekStart.value && kickoff < selectedWeekEnd.value
  })
})

const totalPoints = computed(() =>
  filteredPredictions.value.reduce((sum, p) => sum + (p.points_awarded || 0), 0),
)

const scoredCount = computed(() =>
  filteredPredictions.value.filter((p) => p.scored && p.points_awarded > 0).length,
)

const missedCount = computed(() =>
  filteredPredictions.value.filter((p) => p.scored && p.points_awarded === 0).length,
)

const pendingCount = computed(() =>
  filteredPredictions.value.filter((p) => !p.scored).length,
)

const loadPredictions = async () => {
  if (!user.value) return
  loading.value = true

  const { data } = await supabase
    .from('predictions')
    .select(`
      id,
      predicted_home_score,
      predicted_away_score,
      predicted_winner_team_id,
      predicted_first_to_score_team_id,
      points_awarded,
      scored,
      wants_winner_pick,
      wants_first_to_score_pick,
      wants_exact_score_pick,
      created_at,
      match:matches!predictions_match_id_fkey(
        id,
        kickoff_at,
        status,
        home_score,
        away_score,
        first_to_score_team_id,
        stage,
        home_team:teams!matches_home_team_id_fkey(id, name, code, flag_emoji),
        away_team:teams!matches_away_team_id_fkey(id, name, code, flag_emoji)
      )
    `)
    .eq('user_id', user.value.id)
    .order('created_at', { ascending: false })

  predictions.value = data || []
  loading.value = false
}

onMounted(() => {
  loadPredictions()
  trackPulseEvent('history_viewed')
})

const formatDate = (iso: string) => {
  const d = new Date(iso)
  return d.toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short' })
}

const formatTime = (iso: string) => {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' })
}

const shiftDay = (dir: number) => {
  const d = new Date(selectedDate.value + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + dir)
  selectedDate.value = d.toISOString().slice(0, 10)
}

const shiftWeek = (dir: number) => {
  const d = new Date(selectedDate.value + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + dir * 7)
  selectedDate.value = d.toISOString().slice(0, 10)
}

const pointsBreakdown = (p: any) => {
  const parts: string[] = []
  const m = p.match
  if (!m || !p.scored) return null

  if (p.wants_winner_pick) {
    const actual = m.home_score > m.away_score ? m.home_team.id : m.away_score > m.home_score ? m.away_team.id : null
    const correct = p.predicted_winner_team_id === actual
    parts.push(`Result: ${correct ? '+5' : '0'}`)
  }
  if (p.wants_first_to_score_pick) {
    const correct = m.first_to_score_team_id && p.predicted_first_to_score_team_id === m.first_to_score_team_id
    parts.push(`First goal: ${correct ? '+10' : '0'}`)
  }
  if (p.wants_exact_score_pick) {
    const correct = p.predicted_home_score === m.home_score && p.predicted_away_score === m.away_score
    parts.push(`Exact: ${correct ? '+15' : '0'}`)
  }
  return parts.join(' / ')
}
</script>

<template>
  <div class="space-y-5">
    <div class="flex items-center justify-between gap-3">
      <div>
        <h1 class="text-xl font-extrabold text-ink-900">Prediction History</h1>
        <p class="text-sm text-ink-500">Review all your past predictions and points earned.</p>
      </div>
    </div>

      <!-- Filter controls -->
      <div class="card p-4 space-y-3">
        <div class="flex items-center gap-2">
          <button
            v-for="mode in (['all', 'day', 'week'] as FilterMode[])"
            :key="mode"
            @click="filterMode = mode"
            :class="[
              'px-4 py-2 rounded-xl text-sm font-semibold transition capitalize',
              filterMode === mode ? 'bg-ink-900 text-white' : 'bg-ink-100 text-ink-600 hover:bg-ink-200',
            ]"
          >
            {{ mode === 'all' ? 'All' : mode === 'day' ? 'By Day' : 'By Week' }}
          </button>
        </div>

        <!-- Day navigator -->
        <div v-if="filterMode === 'day'" class="flex items-center gap-3">
          <button @click="shiftDay(-1)" class="w-8 h-8 rounded-lg bg-ink-100 hover:bg-ink-200 grid place-items-center transition">
            <svg class="w-4 h-4 text-ink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <input v-model="selectedDate" type="date" class="input !py-2 w-44" />
          <button @click="shiftDay(1)" class="w-8 h-8 rounded-lg bg-ink-100 hover:bg-ink-200 grid place-items-center transition">
            <svg class="w-4 h-4 text-ink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
          </button>
          <span class="text-sm text-ink-500 font-medium">{{ formatDate(selectedDate) }}</span>
        </div>

        <!-- Week navigator -->
        <div v-if="filterMode === 'week'" class="flex items-center gap-3">
          <button @click="shiftWeek(-1)" class="w-8 h-8 rounded-lg bg-ink-100 hover:bg-ink-200 grid place-items-center transition">
            <svg class="w-4 h-4 text-ink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <div class="text-sm font-semibold text-ink-700">
            {{ formatDate(selectedWeekStart) }} - {{ formatDate(selectedWeekEnd) }}
          </div>
          <button @click="shiftWeek(1)" class="w-8 h-8 rounded-lg bg-ink-100 hover:bg-ink-200 grid place-items-center transition">
            <svg class="w-4 h-4 text-ink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
          </button>
          <input v-model="selectedDate" type="date" class="input !py-2 w-44" />
        </div>
      </div>

      <!-- Stats summary -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div class="card p-3 text-center">
          <div class="text-xl font-extrabold text-ink-900">{{ filteredPredictions.length }}</div>
          <div class="text-[10px] font-semibold uppercase tracking-wider text-ink-500 mt-0.5">Predictions</div>
        </div>
        <div class="card p-3 text-center">
          <div class="text-xl font-extrabold text-mint-600">{{ totalPoints }}</div>
          <div class="text-[10px] font-semibold uppercase tracking-wider text-ink-500 mt-0.5">Points</div>
        </div>
        <div class="card p-3 text-center">
          <div class="text-xl font-extrabold text-sky-600">{{ scoredCount }}</div>
          <div class="text-[10px] font-semibold uppercase tracking-wider text-ink-500 mt-0.5">Correct</div>
        </div>
        <div class="card p-3 text-center">
          <div class="text-xl font-extrabold text-ink-400">{{ pendingCount }}</div>
          <div class="text-[10px] font-semibold uppercase tracking-wider text-ink-500 mt-0.5">Pending</div>
        </div>
      </div>

      <!-- Predictions list -->
      <div v-if="loading" class="space-y-3">
        <div v-for="i in 5" :key="i" class="card h-24 animate-pulse bg-ink-100/40"></div>
      </div>

      <div v-else-if="filteredPredictions.length === 0" class="card p-8 text-center">
        <div class="text-ink-300 text-4xl mb-3">-</div>
        <p class="text-ink-500 font-medium">No predictions found for this period.</p>
        <NuxtLink to="/predict" class="inline-block mt-3 text-sm font-bold text-sky-600 hover:text-sky-700">Make a prediction</NuxtLink>
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="p in filteredPredictions"
          :key="p.id"
          :class="[
            'card p-4 border-l-4 transition',
            !p.scored ? 'border-l-ink-200' : p.points_awarded > 0 ? 'border-l-mint-500' : 'border-l-coral-300',
          ]"
        >
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-3 min-w-0">
              <div class="flex items-center gap-2">
                <span class="text-lg">{{ p.match?.home_team?.flag_emoji }}</span>
                <span class="font-bold text-sm text-ink-900">{{ p.match?.home_team?.code }}</span>
              </div>
              <span class="text-ink-300 text-xs font-bold">vs</span>
              <div class="flex items-center gap-2">
                <span class="font-bold text-sm text-ink-900">{{ p.match?.away_team?.code }}</span>
                <span class="text-lg">{{ p.match?.away_team?.flag_emoji }}</span>
              </div>
            </div>

            <div class="flex items-center gap-2 shrink-0">
              <span v-if="!p.scored" class="pill bg-ink-100 text-ink-500 text-xs">Pending</span>
              <span v-else-if="p.points_awarded > 0" class="pill bg-mint-100 text-mint-700 text-xs font-bold">+{{ p.points_awarded }} pts</span>
              <span v-else class="pill bg-coral-50 text-coral-600 text-xs">0 pts</span>
            </div>
          </div>

          <div class="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            <div class="rounded-lg bg-ink-50 p-2">
              <div class="text-ink-400 font-semibold uppercase tracking-wider text-[10px]">Your prediction</div>
              <div class="font-bold text-ink-800 mt-0.5">{{ p.predicted_home_score }} - {{ p.predicted_away_score }}</div>
            </div>
            <div v-if="p.match?.status === 'completed'" class="rounded-lg bg-ink-50 p-2">
              <div class="text-ink-400 font-semibold uppercase tracking-wider text-[10px]">Actual result</div>
              <div class="font-bold text-ink-800 mt-0.5">{{ p.match.home_score }} - {{ p.match.away_score }}</div>
            </div>
            <div class="rounded-lg bg-ink-50 p-2">
              <div class="text-ink-400 font-semibold uppercase tracking-wider text-[10px]">Kickoff</div>
              <div class="font-bold text-ink-800 mt-0.5">{{ formatDate(p.match?.kickoff_at) }} {{ formatTime(p.match?.kickoff_at) }}</div>
            </div>
          </div>

          <div v-if="p.scored && pointsBreakdown(p)" class="mt-2 text-xs text-ink-500 font-medium">
            {{ pointsBreakdown(p) }}
          </div>
        </div>
      </div>
  </div>
</template>
