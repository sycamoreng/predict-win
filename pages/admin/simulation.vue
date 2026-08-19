<script setup lang="ts">
definePageMeta({ middleware: 'admin-auth', layout: false })

type FinishType = 'FT' | 'AET' | 'PEN'

interface SimTeam {
  id: string
  name: string
  code: string
}

interface SimMatch {
  id: string
  home_team: SimTeam
  away_team: SimTeam
  matchweek: number
  stage: string
  status: 'scheduled' | 'completed'
  home_score: number | null
  away_score: number | null
  first_to_score_team_id: string | null
  finish_type: FinishType | null
  favourite_team_id: string | null
}

interface SimPrediction {
  match_id: string
  predicted_winner_team_id: string | null
  predicted_first_to_score_team_id: string | null
  predicted_home_score: number
  predicted_away_score: number
  predicted_finish_type: FinishType | null
  wants_winner_pick: boolean
  wants_first_to_score_pick: boolean
  wants_exact_score_pick: boolean
}

interface SimChip {
  type: 'double_down' | 'triple_captain'
  matchweek?: number
  match_id?: string
}

interface ScoreBreakdown {
  match_id: string
  matchResultPoints: number
  firstGoalscorerPoints: number
  exactScorelinePoints: number
  basePts: number
  chipMultiplier: number
  chipLabel: string
  finalPts: number
  upsetMultiplier: number
  upsetLabel: string
}

// --- Premier League teams ---
const PL_TEAMS: SimTeam[] = [
  { id: 't1', name: 'Arsenal', code: 'ARS' },
  { id: 't2', name: 'Aston Villa', code: 'AVL' },
  { id: 't3', name: 'Bournemouth', code: 'BOU' },
  { id: 't4', name: 'Brentford', code: 'BRE' },
  { id: 't5', name: 'Brighton', code: 'BHA' },
  { id: 't6', name: 'Chelsea', code: 'CHE' },
  { id: 't7', name: 'Crystal Palace', code: 'CRY' },
  { id: 't8', name: 'Everton', code: 'EVE' },
  { id: 't9', name: 'Fulham', code: 'FUL' },
  { id: 't10', name: 'Ipswich Town', code: 'IPS' },
  { id: 't11', name: 'Leicester City', code: 'LEI' },
  { id: 't12', name: 'Liverpool', code: 'LIV' },
  { id: 't13', name: 'Man City', code: 'MCI' },
  { id: 't14', name: 'Man United', code: 'MUN' },
  { id: 't15', name: 'Newcastle', code: 'NEW' },
  { id: 't16', name: 'Nottm Forest', code: 'NFO' },
  { id: 't17', name: 'Southampton', code: 'SOU' },
  { id: 't18', name: 'Spurs', code: 'TOT' },
  { id: 't19', name: 'West Ham', code: 'WHU' },
  { id: 't20', name: 'Wolves', code: 'WOL' },
]

// --- Campaign config ---
const config = reactive({
  scoring_result: 5,
  scoring_first_to_score: 10,
  scoring_exact_ft: 15,
  scoring_exact_aet: 20,
  scoring_exact_pen: 25,
  max_double_down_uses: 2,
  max_triple_captain_uses: 1,
  upset_multiplier_enabled: false,
  upset_multiplier_favourite: 1.0,
  upset_multiplier_draw: 1.5,
  upset_multiplier_underdog: 2.0,
})

// --- State ---
const matches = ref<SimMatch[]>([])
const predictions = ref<Record<string, SimPrediction>>({})
const chips = ref<SimChip[]>([])
const scoreResults = ref<ScoreBreakdown[]>([])
const activeTab = ref<'setup' | 'predict' | 'resolve' | 'results'>('setup')
const showAddMatch = ref(false)

// Add match form
const newMatch = reactive({
  home_team_id: '',
  away_team_id: '',
  matchweek: 1,
  stage: 'league',
  favourite_team_id: '',
})

let matchCounter = 0
const addMatch = () => {
  if (!newMatch.home_team_id || !newMatch.away_team_id || newMatch.home_team_id === newMatch.away_team_id) return
  const home = PL_TEAMS.find(t => t.id === newMatch.home_team_id)!
  const away = PL_TEAMS.find(t => t.id === newMatch.away_team_id)!
  matchCounter++
  matches.value.push({
    id: `sim-${matchCounter}`,
    home_team: home,
    away_team: away,
    matchweek: newMatch.matchweek,
    stage: newMatch.stage,
    status: 'scheduled',
    home_score: null,
    away_score: null,
    first_to_score_team_id: null,
    finish_type: null,
    favourite_team_id: newMatch.favourite_team_id || null,
  })
  newMatch.home_team_id = ''
  newMatch.away_team_id = ''
  newMatch.favourite_team_id = ''
  showAddMatch.value = false
}

const addPresetMatchweek = () => {
  const mw = newMatch.matchweek
  const shuffled = [...PL_TEAMS].sort(() => Math.random() - 0.5)
  for (let i = 0; i < shuffled.length - 1; i += 2) {
    matchCounter++
    matches.value.push({
      id: `sim-${matchCounter}`,
      home_team: shuffled[i],
      away_team: shuffled[i + 1],
      matchweek: mw,
      stage: 'league',
      status: 'scheduled',
      home_score: null,
      away_score: null,
      first_to_score_team_id: null,
      finish_type: null,
      favourite_team_id: null,
    })
  }
}

const removeMatch = (id: string) => {
  matches.value = matches.value.filter(m => m.id !== id)
  delete predictions.value[id]
  chips.value = chips.value.filter(c => c.match_id !== id)
}

// --- Predictions ---
const getPrediction = (matchId: string): SimPrediction => {
  if (!predictions.value[matchId]) {
    predictions.value[matchId] = {
      match_id: matchId,
      predicted_winner_team_id: null,
      predicted_first_to_score_team_id: null,
      predicted_home_score: 0,
      predicted_away_score: 0,
      predicted_finish_type: null,
      wants_winner_pick: false,
      wants_first_to_score_pick: false,
      wants_exact_score_pick: false,
    }
  }
  return predictions.value[matchId]
}

// --- Chips ---
const ddUsed = computed(() => chips.value.filter(c => c.type === 'double_down').length)
const tcUsed = computed(() => chips.value.filter(c => c.type === 'triple_captain').length)
const ddRemaining = computed(() => Math.max(0, config.max_double_down_uses - ddUsed.value))
const tcRemaining = computed(() => Math.max(0, config.max_triple_captain_uses - tcUsed.value))

const isDoubleDownOnWeek = (mw: number) => chips.value.some(c => c.type === 'double_down' && c.matchweek === mw)
const isTripleCaptainOnMatch = (matchId: string) => chips.value.some(c => c.type === 'triple_captain' && c.match_id === matchId)
const hasAnyChipOnWeek = (mw: number) => chips.value.some(c => {
  if (c.type === 'double_down') return c.matchweek === mw
  if (c.type === 'triple_captain' && c.match_id) {
    const m = matches.value.find(x => x.id === c.match_id)
    return m?.matchweek === mw
  }
  return false
})

const activateDoubleDown = (mw: number) => {
  if (ddRemaining.value <= 0 || hasAnyChipOnWeek(mw)) return
  chips.value.push({ type: 'double_down', matchweek: mw })
}

const activateTripleCaptain = (matchId: string) => {
  if (tcRemaining.value <= 0 || isTripleCaptainOnMatch(matchId)) return
  const m = matches.value.find(x => x.id === matchId)
  if (m && hasAnyChipOnWeek(m.matchweek)) return
  chips.value.push({ type: 'triple_captain', match_id: matchId })
}

const removeChip = (index: number) => {
  chips.value.splice(index, 1)
}

// --- Resolve (complete matches) ---
const resolveForm = reactive<Record<string, { home_score: number; away_score: number; first_to_score_team_id: string; finish_type: FinishType }>>({})

const getResolveForm = (matchId: string) => {
  if (!resolveForm[matchId]) {
    resolveForm[matchId] = { home_score: 0, away_score: 0, first_to_score_team_id: '', finish_type: 'FT' }
  }
  return resolveForm[matchId]
}

const completeMatch = (matchId: string) => {
  const m = matches.value.find(x => x.id === matchId)
  const form = resolveForm[matchId]
  if (!m || !form) return
  m.status = 'completed'
  m.home_score = form.home_score
  m.away_score = form.away_score
  m.first_to_score_team_id = form.first_to_score_team_id || null
  m.finish_type = form.finish_type
}

const resetMatch = (matchId: string) => {
  const m = matches.value.find(x => x.id === matchId)
  if (!m) return
  m.status = 'scheduled'
  m.home_score = null
  m.away_score = null
  m.first_to_score_team_id = null
  m.finish_type = null
}

// --- Scoring engine (mirrors server exactly) ---
const runScoring = () => {
  const results: ScoreBreakdown[] = []

  for (const m of matches.value.filter(x => x.status === 'completed')) {
    const p = predictions.value[m.id]
    if (!p) {
      results.push({ match_id: m.id, matchResultPoints: 0, firstGoalscorerPoints: 0, exactScorelinePoints: 0, basePts: 0, chipMultiplier: 1, chipLabel: '-', finalPts: 0, upsetMultiplier: 1, upsetLabel: '-' })
      continue
    }

    let matchResultPoints = 0
    let firstGoalscorerPoints = 0
    let exactScorelinePoints = 0

    // Determine actual winner
    const winnerId = m.home_score! > m.away_score!
      ? m.home_team.id
      : m.away_score! > m.home_score!
        ? m.away_team.id
        : null // draw

    // Winner pick
    if (p.wants_winner_pick) {
      const winnerCorrect =
        (winnerId === null && p.predicted_winner_team_id === null) ||
        (winnerId !== null && p.predicted_winner_team_id === winnerId)
      if (winnerCorrect) matchResultPoints = config.scoring_result
    }

    // First to score
    if (p.wants_first_to_score_pick && m.first_to_score_team_id && p.predicted_first_to_score_team_id === m.first_to_score_team_id) {
      firstGoalscorerPoints = config.scoring_first_to_score
    }

    // Exact scoreline
    if (p.wants_exact_score_pick && p.predicted_home_score === m.home_score && p.predicted_away_score === m.away_score) {
      if (m.finish_type === 'PEN' && p.predicted_finish_type === 'PEN') {
        exactScorelinePoints = config.scoring_exact_pen
      } else if (m.finish_type === 'AET' && p.predicted_finish_type === 'AET') {
        exactScorelinePoints = config.scoring_exact_aet
      } else if (!m.finish_type || m.finish_type === 'FT') {
        exactScorelinePoints = config.scoring_exact_ft
      }
    }

    let basePts = matchResultPoints + firstGoalscorerPoints + exactScorelinePoints

    // Upset multiplier
    let upsetMultiplier = 1
    let upsetLabel = '-'
    if (config.upset_multiplier_enabled && basePts > 0 && m.favourite_team_id) {
      if (winnerId === null) {
        upsetMultiplier = config.upset_multiplier_draw
        upsetLabel = `Draw (${upsetMultiplier}x)`
      } else if (winnerId !== m.favourite_team_id) {
        upsetMultiplier = config.upset_multiplier_underdog
        upsetLabel = `Underdog (${upsetMultiplier}x)`
      } else {
        upsetMultiplier = config.upset_multiplier_favourite
        upsetLabel = `Favourite (${upsetMultiplier}x)`
      }
      basePts = Math.round(basePts * upsetMultiplier)
    }

    // Chip multipliers
    let chipMultiplier = 1
    let chipLabel = '-'

    if (isTripleCaptainOnMatch(m.id)) {
      chipMultiplier = 3
      chipLabel = 'Triple Captain (3x)'
    } else if (isDoubleDownOnWeek(m.matchweek)) {
      chipMultiplier = 2
      chipLabel = 'Double Down (2x)'
    }

    const finalPts = basePts * chipMultiplier

    results.push({
      match_id: m.id,
      matchResultPoints,
      firstGoalscorerPoints,
      exactScorelinePoints,
      basePts,
      chipMultiplier,
      chipLabel,
      finalPts,
      upsetMultiplier,
      upsetLabel,
    })
  }

  scoreResults.value = results
  activeTab.value = 'results'
}

const totalPoints = computed(() => scoreResults.value.reduce((s, r) => s + r.finalPts, 0))

const getMatchById = (id: string) => matches.value.find(m => m.id === id)

const matchweeks = computed(() => {
  const mws = new Set(matches.value.map(m => m.matchweek))
  return [...mws].sort((a, b) => a - b)
})

const scheduledMatches = computed(() => matches.value.filter(m => m.status === 'scheduled'))
const completedMatches = computed(() => matches.value.filter(m => m.status === 'completed'))

const predictedCount = computed(() => {
  return Object.values(predictions.value).filter(p => p.wants_winner_pick || p.wants_first_to_score_pick || p.wants_exact_score_pick).length
})

const resetAll = () => {
  matches.value = []
  predictions.value = {}
  chips.value = []
  scoreResults.value = []
  Object.keys(resolveForm).forEach(k => delete resolveForm[k])
  matchCounter = 0
  activeTab.value = 'setup'
}
</script>

<template>
  <div class="min-h-screen bg-ink-50">
    <!-- Header -->
    <div class="bg-gradient-to-r from-ink-900 via-ink-800 to-amber-900 text-white">
      <div class="max-w-5xl mx-auto px-4 py-6">
        <div class="flex items-center justify-between">
          <div>
            <div class="flex items-center gap-2 mb-1">
              <span class="text-xs font-semibold uppercase tracking-wider text-amber-300">Simulation Mode</span>
              <span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
            </div>
            <h1 class="text-2xl font-extrabold">Premier League Scoring Simulator</h1>
            <p class="text-sm text-ink-400 mt-1">Test predictions, chips, and scoring without affecting live data</p>
          </div>
          <div class="flex items-center gap-3">
            <NuxtLink to="/admin" class="text-sm text-ink-400 hover:text-white transition">Back to Admin</NuxtLink>
            <button @click="resetAll" class="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-semibold transition">Reset all</button>
          </div>
        </div>

        <!-- Summary strip -->
        <div class="flex items-center gap-6 mt-4 text-sm">
          <div><span class="text-ink-400">Matches:</span> <span class="font-bold">{{ matches.length }}</span></div>
          <div><span class="text-ink-400">Predicted:</span> <span class="font-bold">{{ predictedCount }}</span></div>
          <div><span class="text-ink-400">Completed:</span> <span class="font-bold">{{ completedMatches.length }}</span></div>
          <div><span class="text-ink-400">Chips used:</span> <span class="font-bold">{{ chips.length }}</span></div>
          <div v-if="scoreResults.length > 0"><span class="text-ink-400">Total pts:</span> <span class="font-extrabold text-amber-300">{{ totalPoints }}</span></div>
        </div>
      </div>
    </div>

    <div class="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <!-- Tabs -->
      <div class="card p-1.5 inline-flex">
        <button v-for="tab in (['setup', 'predict', 'resolve', 'results'] as const)" :key="tab"
          @click="activeTab = tab"
          :class="['px-5 py-2.5 rounded-lg text-sm font-semibold transition capitalize',
            activeTab === tab ? 'bg-ink-900 text-white shadow-pop' : 'text-ink-600 hover:bg-ink-100']"
        >
          {{ tab === 'setup' ? '1. Setup' : tab === 'predict' ? '2. Predict' : tab === 'resolve' ? '3. Resolve' : '4. Results' }}
        </button>
      </div>

      <!-- STEP 1: Setup -->
      <template v-if="activeTab === 'setup'">
        <!-- Campaign config -->
        <div class="card p-5">
          <h2 class="text-lg font-extrabold text-ink-900 mb-4">Campaign scoring config</h2>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <label class="block">
              <span class="text-xs font-semibold text-ink-500 uppercase">Winner pts</span>
              <input v-model.number="config.scoring_result" type="number" class="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm font-bold" />
            </label>
            <label class="block">
              <span class="text-xs font-semibold text-ink-500 uppercase">First scorer pts</span>
              <input v-model.number="config.scoring_first_to_score" type="number" class="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm font-bold" />
            </label>
            <label class="block">
              <span class="text-xs font-semibold text-ink-500 uppercase">Exact FT pts</span>
              <input v-model.number="config.scoring_exact_ft" type="number" class="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm font-bold" />
            </label>
            <label class="block">
              <span class="text-xs font-semibold text-ink-500 uppercase">Exact AET pts</span>
              <input v-model.number="config.scoring_exact_aet" type="number" class="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm font-bold" />
            </label>
            <label class="block">
              <span class="text-xs font-semibold text-ink-500 uppercase">Exact PEN pts</span>
              <input v-model.number="config.scoring_exact_pen" type="number" class="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm font-bold" />
            </label>
            <label class="block">
              <span class="text-xs font-semibold text-ink-500 uppercase">Double Down uses</span>
              <input v-model.number="config.max_double_down_uses" type="number" min="0" class="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm font-bold" />
            </label>
            <label class="block">
              <span class="text-xs font-semibold text-ink-500 uppercase">Triple Captain uses</span>
              <input v-model.number="config.max_triple_captain_uses" type="number" min="0" class="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm font-bold" />
            </label>
            <label class="flex items-center gap-2 self-end pb-2">
              <input v-model="config.upset_multiplier_enabled" type="checkbox" class="w-4 h-4 rounded accent-amber-500" />
              <span class="text-xs font-semibold text-ink-500 uppercase">Upset multiplier</span>
            </label>
          </div>
          <div v-if="config.upset_multiplier_enabled" class="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-ink-100">
            <label class="block">
              <span class="text-xs font-semibold text-ink-500 uppercase">Favourite mult.</span>
              <input v-model.number="config.upset_multiplier_favourite" type="number" step="0.1" min="0" class="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm font-bold" />
            </label>
            <label class="block">
              <span class="text-xs font-semibold text-ink-500 uppercase">Draw mult.</span>
              <input v-model.number="config.upset_multiplier_draw" type="number" step="0.1" min="0" class="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm font-bold" />
            </label>
            <label class="block">
              <span class="text-xs font-semibold text-ink-500 uppercase">Underdog mult.</span>
              <input v-model.number="config.upset_multiplier_underdog" type="number" step="0.1" min="0" class="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm font-bold" />
            </label>
          </div>
        </div>

        <!-- Matches -->
        <div class="card p-5">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-extrabold text-ink-900">Matches ({{ matches.length }})</h2>
            <div class="flex items-center gap-2">
              <button @click="addPresetMatchweek" class="px-3 py-1.5 rounded-lg bg-ink-100 hover:bg-ink-200 text-xs font-semibold text-ink-700 transition">
                + Quick matchweek {{ newMatch.matchweek }}
              </button>
              <button @click="showAddMatch = !showAddMatch" class="px-3 py-1.5 rounded-lg bg-ink-900 hover:bg-ink-800 text-white text-xs font-semibold transition">
                + Add match
              </button>
            </div>
          </div>

          <!-- Add match form -->
          <div v-if="showAddMatch" class="bg-ink-50 rounded-xl p-4 mb-4 border border-ink-100">
            <div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <label class="block">
                <span class="text-[10px] font-semibold text-ink-500 uppercase">Home</span>
                <select v-model="newMatch.home_team_id" class="mt-1 w-full rounded-lg border border-ink-200 px-2 py-2 text-sm">
                  <option value="">Select...</option>
                  <option v-for="t in PL_TEAMS" :key="t.id" :value="t.id">{{ t.name }}</option>
                </select>
              </label>
              <label class="block">
                <span class="text-[10px] font-semibold text-ink-500 uppercase">Away</span>
                <select v-model="newMatch.away_team_id" class="mt-1 w-full rounded-lg border border-ink-200 px-2 py-2 text-sm">
                  <option value="">Select...</option>
                  <option v-for="t in PL_TEAMS.filter(t => t.id !== newMatch.home_team_id)" :key="t.id" :value="t.id">{{ t.name }}</option>
                </select>
              </label>
              <label class="block">
                <span class="text-[10px] font-semibold text-ink-500 uppercase">Matchweek</span>
                <input v-model.number="newMatch.matchweek" type="number" min="1" max="38" class="mt-1 w-full rounded-lg border border-ink-200 px-2 py-2 text-sm" />
              </label>
              <label class="block">
                <span class="text-[10px] font-semibold text-ink-500 uppercase">Favourite</span>
                <select v-model="newMatch.favourite_team_id" class="mt-1 w-full rounded-lg border border-ink-200 px-2 py-2 text-sm">
                  <option value="">None</option>
                  <option v-if="newMatch.home_team_id" :value="newMatch.home_team_id">{{ PL_TEAMS.find(t => t.id === newMatch.home_team_id)?.code }}</option>
                  <option v-if="newMatch.away_team_id" :value="newMatch.away_team_id">{{ PL_TEAMS.find(t => t.id === newMatch.away_team_id)?.code }}</option>
                </select>
              </label>
              <div class="flex items-end">
                <button @click="addMatch" :disabled="!newMatch.home_team_id || !newMatch.away_team_id || newMatch.home_team_id === newMatch.away_team_id"
                  class="w-full px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold transition disabled:opacity-40">
                  Add
                </button>
              </div>
            </div>
          </div>

          <!-- Match list grouped by matchweek -->
          <div v-if="matches.length === 0" class="text-center py-8 text-ink-400 text-sm">
            No matches yet. Add individual matches or generate a full matchweek above.
          </div>
          <div v-for="mw in matchweeks" :key="mw" class="mb-4 last:mb-0">
            <div class="flex items-center gap-2 mb-2">
              <span class="text-xs font-bold text-ink-500 uppercase tracking-wider">Matchweek {{ mw }}</span>
              <span class="text-[10px] text-ink-400">({{ matches.filter(m => m.matchweek === mw).length }} matches)</span>
            </div>
            <div class="space-y-1">
              <div v-for="m in matches.filter(x => x.matchweek === mw)" :key="m.id"
                class="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-ink-50 text-sm">
                <div class="flex items-center gap-2 flex-1 min-w-0">
                  <span class="font-bold text-ink-900">{{ m.home_team.code }}</span>
                  <span class="text-ink-300">vs</span>
                  <span class="font-bold text-ink-900">{{ m.away_team.code }}</span>
                  <span v-if="m.status === 'completed'" class="pill bg-mint-100 text-mint-700 text-[10px]">{{ m.home_score }}-{{ m.away_score }}</span>
                  <span v-if="m.favourite_team_id" class="pill bg-amber-50 text-amber-600 text-[10px]">Fav: {{ m.favourite_team_id === m.home_team.id ? m.home_team.code : m.away_team.code }}</span>
                  <span v-if="isTripleCaptainOnMatch(m.id)" class="pill bg-amber-100 text-amber-700 text-[10px]">TC</span>
                </div>
                <button @click="removeMatch(m.id)" class="text-ink-300 hover:text-coral-500 transition">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
            </div>
          </div>

          <div v-if="matches.length > 0" class="mt-4 pt-4 border-t border-ink-100 text-right">
            <button @click="activeTab = 'predict'" class="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold transition">
              Next: Make predictions &rarr;
            </button>
          </div>
        </div>
      </template>

      <!-- STEP 2: Predict -->
      <template v-if="activeTab === 'predict'">
        <div v-if="matches.length === 0" class="card p-8 text-center text-ink-500">
          Go to Setup first to add matches.
        </div>
        <template v-else>
          <!-- Chips bar -->
          <div class="card p-4">
            <h3 class="text-sm font-extrabold text-ink-900 mb-3">Active chips</h3>
            <div class="flex flex-wrap gap-2 mb-3">
              <div v-for="(chip, i) in chips" :key="i" class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold"
                :class="chip.type === 'triple_captain' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'">
                {{ chip.type === 'triple_captain' ? 'TC' : 'DD' }}:
                {{ chip.type === 'triple_captain' ? (getMatchById(chip.match_id!)?.home_team.code + ' v ' + getMatchById(chip.match_id!)?.away_team.code) : 'MW ' + chip.matchweek }}
                <button @click="removeChip(i)" class="ml-1 hover:text-red-600">&times;</button>
              </div>
              <span v-if="chips.length === 0" class="text-xs text-ink-400">No chips activated yet</span>
            </div>
            <div class="flex items-center gap-4 text-xs text-ink-500">
              <span>Double Down: {{ ddRemaining }}/{{ config.max_double_down_uses }} left</span>
              <span>Triple Captain: {{ tcRemaining }}/{{ config.max_triple_captain_uses }} left</span>
            </div>
          </div>

          <!-- Prediction cards by matchweek -->
          <div v-for="mw in matchweeks" :key="mw" class="space-y-3">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-bold text-ink-700 uppercase tracking-wider">Matchweek {{ mw }}</h3>
              <button v-if="!hasAnyChipOnWeek(mw) && ddRemaining > 0"
                @click="activateDoubleDown(mw)"
                class="px-3 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-xs font-semibold text-emerald-700 transition">
                Activate Double Down (2x)
              </button>
              <span v-else-if="isDoubleDownOnWeek(mw)" class="px-3 py-1 rounded-lg bg-emerald-100 text-xs font-bold text-emerald-700">DD ACTIVE</span>
            </div>

            <div class="grid sm:grid-cols-2 gap-4">
              <div v-for="m in matches.filter(x => x.matchweek === mw)" :key="m.id" class="card p-4 space-y-3"
                :class="isTripleCaptainOnMatch(m.id) ? 'ring-2 ring-amber-400 bg-amber-50/30' : ''">
                <!-- Match header -->
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2 text-sm">
                    <span class="font-bold text-ink-900">{{ m.home_team.code }}</span>
                    <span class="text-ink-300">vs</span>
                    <span class="font-bold text-ink-900">{{ m.away_team.code }}</span>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <span v-if="isTripleCaptainOnMatch(m.id)" class="pill bg-amber-100 text-amber-700 text-[10px]">3x TC</span>
                    <button v-else-if="tcRemaining > 0 && !hasAnyChipOnWeek(m.matchweek)"
                      @click="activateTripleCaptain(m.id)"
                      class="pill bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-200 text-[10px] transition cursor-pointer">
                      Use TC
                    </button>
                  </div>
                </div>

                <!-- Winner pick -->
                <div class="space-y-1.5">
                  <label class="flex items-center gap-2 text-xs">
                    <input type="checkbox" v-model="getPrediction(m.id).wants_winner_pick" class="w-3.5 h-3.5 rounded accent-sky-600" />
                    <span class="font-semibold text-ink-700">Winner (+{{ config.scoring_result }} pts)</span>
                  </label>
                  <div v-if="getPrediction(m.id).wants_winner_pick" class="grid grid-cols-3 gap-1.5">
                    <button @click="getPrediction(m.id).predicted_winner_team_id = m.home_team.id"
                      :class="['rounded-lg border px-2 py-1.5 text-xs font-bold transition',
                        getPrediction(m.id).predicted_winner_team_id === m.home_team.id ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-ink-100 text-ink-600 hover:border-ink-200']">
                      {{ m.home_team.code }}
                    </button>
                    <button @click="getPrediction(m.id).predicted_winner_team_id = null"
                      :class="['rounded-lg border px-2 py-1.5 text-xs font-bold transition',
                        getPrediction(m.id).predicted_winner_team_id === null && getPrediction(m.id).wants_winner_pick ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-ink-100 text-ink-600 hover:border-ink-200']">
                      Draw
                    </button>
                    <button @click="getPrediction(m.id).predicted_winner_team_id = m.away_team.id"
                      :class="['rounded-lg border px-2 py-1.5 text-xs font-bold transition',
                        getPrediction(m.id).predicted_winner_team_id === m.away_team.id ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-ink-100 text-ink-600 hover:border-ink-200']">
                      {{ m.away_team.code }}
                    </button>
                  </div>
                </div>

                <!-- First to score -->
                <div class="space-y-1.5">
                  <label class="flex items-center gap-2 text-xs">
                    <input type="checkbox" v-model="getPrediction(m.id).wants_first_to_score_pick" class="w-3.5 h-3.5 rounded accent-sky-600" />
                    <span class="font-semibold text-ink-700">First to score (+{{ config.scoring_first_to_score }} pts)</span>
                  </label>
                  <div v-if="getPrediction(m.id).wants_first_to_score_pick" class="grid grid-cols-2 gap-1.5">
                    <button @click="getPrediction(m.id).predicted_first_to_score_team_id = m.home_team.id"
                      :class="['rounded-lg border px-2 py-1.5 text-xs font-bold transition',
                        getPrediction(m.id).predicted_first_to_score_team_id === m.home_team.id ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-ink-100 text-ink-600 hover:border-ink-200']">
                      {{ m.home_team.code }}
                    </button>
                    <button @click="getPrediction(m.id).predicted_first_to_score_team_id = m.away_team.id"
                      :class="['rounded-lg border px-2 py-1.5 text-xs font-bold transition',
                        getPrediction(m.id).predicted_first_to_score_team_id === m.away_team.id ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-ink-100 text-ink-600 hover:border-ink-200']">
                      {{ m.away_team.code }}
                    </button>
                  </div>
                </div>

                <!-- Exact score -->
                <div class="space-y-1.5">
                  <label class="flex items-center gap-2 text-xs">
                    <input type="checkbox" v-model="getPrediction(m.id).wants_exact_score_pick" class="w-3.5 h-3.5 rounded accent-sky-600" />
                    <span class="font-semibold text-ink-700">Exact score (+{{ config.scoring_exact_ft }} pts)</span>
                  </label>
                  <div v-if="getPrediction(m.id).wants_exact_score_pick" class="flex items-center gap-3">
                    <div class="flex items-center gap-2">
                      <span class="text-xs font-bold text-ink-600">{{ m.home_team.code }}</span>
                      <input v-model.number="getPrediction(m.id).predicted_home_score" type="number" min="0" max="20"
                        class="w-14 rounded-lg border border-ink-200 px-2 py-1.5 text-center text-sm font-bold" />
                    </div>
                    <span class="text-ink-300 font-bold">-</span>
                    <div class="flex items-center gap-2">
                      <input v-model.number="getPrediction(m.id).predicted_away_score" type="number" min="0" max="20"
                        class="w-14 rounded-lg border border-ink-200 px-2 py-1.5 text-center text-sm font-bold" />
                      <span class="text-xs font-bold text-ink-600">{{ m.away_team.code }}</span>
                    </div>
                    <select v-if="m.stage !== 'league'" v-model="getPrediction(m.id).predicted_finish_type"
                      class="rounded-lg border border-ink-200 px-2 py-1.5 text-xs font-semibold">
                      <option value="FT">FT</option>
                      <option value="AET">AET</option>
                      <option value="PEN">PEN</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="text-right pt-2">
            <button @click="activeTab = 'resolve'" class="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold transition">
              Next: Set results &rarr;
            </button>
          </div>
        </template>
      </template>

      <!-- STEP 3: Resolve -->
      <template v-if="activeTab === 'resolve'">
        <div v-if="matches.length === 0" class="card p-8 text-center text-ink-500">Go to Setup first.</div>
        <template v-else>
          <div v-for="mw in matchweeks" :key="mw" class="space-y-3">
            <h3 class="text-sm font-bold text-ink-700 uppercase tracking-wider">Matchweek {{ mw }}</h3>
            <div class="grid sm:grid-cols-2 gap-4">
              <div v-for="m in matches.filter(x => x.matchweek === mw)" :key="m.id"
                class="card p-4 space-y-3" :class="m.status === 'completed' ? 'bg-mint-50/30 border-mint-200' : ''">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2 text-sm">
                    <span class="font-bold text-ink-900">{{ m.home_team.code }}</span>
                    <span class="text-ink-300">vs</span>
                    <span class="font-bold text-ink-900">{{ m.away_team.code }}</span>
                  </div>
                  <span v-if="m.status === 'completed'" class="pill bg-mint-100 text-mint-700 text-[10px]">Completed</span>
                </div>

                <template v-if="m.status === 'scheduled'">
                  <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <label class="block">
                      <span class="text-[10px] font-semibold text-ink-500 uppercase">{{ m.home_team.code }} goals</span>
                      <input v-model.number="getResolveForm(m.id).home_score" type="number" min="0" max="20"
                        class="mt-1 w-full rounded-lg border border-ink-200 px-2 py-1.5 text-center text-sm font-bold" />
                    </label>
                    <label class="block">
                      <span class="text-[10px] font-semibold text-ink-500 uppercase">{{ m.away_team.code }} goals</span>
                      <input v-model.number="getResolveForm(m.id).away_score" type="number" min="0" max="20"
                        class="mt-1 w-full rounded-lg border border-ink-200 px-2 py-1.5 text-center text-sm font-bold" />
                    </label>
                    <label class="block">
                      <span class="text-[10px] font-semibold text-ink-500 uppercase">First scorer</span>
                      <select v-model="getResolveForm(m.id).first_to_score_team_id"
                        class="mt-1 w-full rounded-lg border border-ink-200 px-2 py-1.5 text-xs font-semibold">
                        <option value="">None/0-0</option>
                        <option :value="m.home_team.id">{{ m.home_team.code }}</option>
                        <option :value="m.away_team.id">{{ m.away_team.code }}</option>
                      </select>
                    </label>
                    <label v-if="m.stage !== 'league'" class="block">
                      <span class="text-[10px] font-semibold text-ink-500 uppercase">Finish type</span>
                      <select v-model="getResolveForm(m.id).finish_type"
                        class="mt-1 w-full rounded-lg border border-ink-200 px-2 py-1.5 text-xs font-semibold">
                        <option value="FT">FT</option>
                        <option value="AET">AET</option>
                        <option value="PEN">PEN</option>
                      </select>
                    </label>
                  </div>
                  <button @click="completeMatch(m.id)" class="w-full px-3 py-2 rounded-lg bg-ink-900 hover:bg-ink-800 text-white text-xs font-semibold transition">
                    Complete match
                  </button>
                </template>
                <template v-else>
                  <div class="text-sm text-ink-600">
                    Final: <span class="font-bold text-ink-900">{{ m.home_score }} - {{ m.away_score }}</span>
                    <span v-if="m.first_to_score_team_id" class="ml-2 text-ink-400">
                      First: {{ m.first_to_score_team_id === m.home_team.id ? m.home_team.code : m.away_team.code }}
                    </span>
                    <span v-if="m.finish_type && m.finish_type !== 'FT'" class="ml-2 text-ink-400">({{ m.finish_type }})</span>
                  </div>
                  <button @click="resetMatch(m.id)" class="text-xs text-ink-400 hover:text-ink-600 transition underline">
                    Reset to scheduled
                  </button>
                </template>
              </div>
            </div>
          </div>

          <div class="flex items-center justify-between pt-4">
            <div class="text-sm text-ink-500">{{ completedMatches.length }}/{{ matches.length }} matches completed</div>
            <button @click="runScoring" :disabled="completedMatches.length === 0"
              class="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-extrabold transition disabled:opacity-40 shadow-lg">
              Run scoring engine &rarr;
            </button>
          </div>
        </template>
      </template>

      <!-- STEP 4: Results -->
      <template v-if="activeTab === 'results'">
        <div v-if="scoreResults.length === 0" class="card p-8 text-center text-ink-500">
          No results yet. Complete some matches and run the scoring engine.
        </div>
        <template v-else>
          <!-- Total -->
          <div class="card p-6 bg-gradient-to-r from-ink-900 via-ink-800 to-amber-900 text-white text-center">
            <div class="text-4xl font-extrabold tabular-nums">{{ totalPoints }}</div>
            <div class="text-sm text-ink-400 mt-1">Total simulated points</div>
          </div>

          <!-- Detailed breakdown -->
          <div class="card overflow-hidden">
            <table class="w-full text-sm">
              <thead>
                <tr class="bg-ink-50 text-left">
                  <th class="px-4 py-3 font-semibold text-ink-600 text-xs uppercase">Match</th>
                  <th class="px-4 py-3 font-semibold text-ink-600 text-xs uppercase text-center">Winner</th>
                  <th class="px-4 py-3 font-semibold text-ink-600 text-xs uppercase text-center">1st scorer</th>
                  <th class="px-4 py-3 font-semibold text-ink-600 text-xs uppercase text-center">Exact</th>
                  <th class="px-4 py-3 font-semibold text-ink-600 text-xs uppercase text-center">Base</th>
                  <th class="px-4 py-3 font-semibold text-ink-600 text-xs uppercase text-center">Upset</th>
                  <th class="px-4 py-3 font-semibold text-ink-600 text-xs uppercase text-center">Chip</th>
                  <th class="px-4 py-3 font-semibold text-ink-600 text-xs uppercase text-center">Final</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in scoreResults" :key="r.match_id" class="border-t border-ink-100 hover:bg-ink-50/50">
                  <td class="px-4 py-3">
                    <div class="font-bold text-ink-900">
                      {{ getMatchById(r.match_id)?.home_team.code }} {{ getMatchById(r.match_id)?.home_score }}-{{ getMatchById(r.match_id)?.away_score }} {{ getMatchById(r.match_id)?.away_team.code }}
                    </div>
                  </td>
                  <td class="px-4 py-3 text-center tabular-nums" :class="r.matchResultPoints > 0 ? 'text-mint-600 font-bold' : 'text-ink-300'">
                    {{ r.matchResultPoints > 0 ? '+' + r.matchResultPoints : '-' }}
                  </td>
                  <td class="px-4 py-3 text-center tabular-nums" :class="r.firstGoalscorerPoints > 0 ? 'text-mint-600 font-bold' : 'text-ink-300'">
                    {{ r.firstGoalscorerPoints > 0 ? '+' + r.firstGoalscorerPoints : '-' }}
                  </td>
                  <td class="px-4 py-3 text-center tabular-nums" :class="r.exactScorelinePoints > 0 ? 'text-sun-600 font-bold' : 'text-ink-300'">
                    {{ r.exactScorelinePoints > 0 ? '+' + r.exactScorelinePoints : '-' }}
                  </td>
                  <td class="px-4 py-3 text-center font-bold tabular-nums text-ink-900">{{ r.basePts }}</td>
                  <td class="px-4 py-3 text-center text-xs" :class="r.upsetMultiplier > 1 ? 'text-amber-600 font-bold' : 'text-ink-300'">
                    {{ r.upsetLabel }}
                  </td>
                  <td class="px-4 py-3 text-center text-xs" :class="r.chipMultiplier > 1 ? (r.chipMultiplier === 3 ? 'text-amber-600 font-bold' : 'text-emerald-600 font-bold') : 'text-ink-300'">
                    {{ r.chipLabel }}
                  </td>
                  <td class="px-4 py-3 text-center">
                    <span class="inline-block px-2 py-1 rounded-lg font-extrabold tabular-nums"
                      :class="r.finalPts > 0 ? 'bg-mint-100 text-mint-700' : 'bg-ink-100 text-ink-400'">
                      {{ r.finalPts }}
                    </span>
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr class="border-t-2 border-ink-200 bg-ink-50">
                  <td class="px-4 py-3 font-extrabold text-ink-900" colspan="7">Total</td>
                  <td class="px-4 py-3 text-center">
                    <span class="inline-block px-3 py-1 rounded-lg bg-ink-900 text-white font-extrabold tabular-nums">{{ totalPoints }}</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <!-- Chip summary -->
          <div v-if="chips.length > 0" class="card p-4">
            <h3 class="text-sm font-bold text-ink-900 mb-2">Chips used in this simulation</h3>
            <div class="flex flex-wrap gap-2">
              <div v-for="(chip, i) in chips" :key="i"
                class="px-3 py-1.5 rounded-lg text-xs font-semibold"
                :class="chip.type === 'triple_captain' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'">
                {{ chip.type === 'triple_captain' ? 'Triple Captain' : 'Double Down' }}:
                {{ chip.type === 'triple_captain'
                  ? (getMatchById(chip.match_id!)?.home_team.code + ' v ' + getMatchById(chip.match_id!)?.away_team.code)
                  : 'Matchweek ' + chip.matchweek }}
              </div>
            </div>
          </div>

          <div class="flex items-center gap-3 pt-2">
            <button @click="activeTab = 'resolve'" class="px-4 py-2 rounded-xl bg-ink-100 hover:bg-ink-200 text-sm font-semibold text-ink-700 transition">
              &larr; Adjust results
            </button>
            <button @click="runScoring" class="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition">
              Re-run scoring
            </button>
            <button @click="resetAll" class="px-4 py-2 rounded-xl bg-coral-50 hover:bg-coral-100 text-sm font-semibold text-coral-700 transition">
              Reset all
            </button>
          </div>
        </template>
      </template>
    </div>
  </div>
</template>
