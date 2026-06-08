<script setup lang="ts">
interface Team {
  id: string
  name: string
  code: string
  flag_emoji: string
}

interface Match {
  id: string
  home_team_id: string
  away_team_id: string
  kickoff_at: string
  stage: string
  status: string
  home_score: number | null
  away_score: number | null
  first_to_score_team_id: string | null
  home_team: Team
  away_team: Team
}

interface Prediction {
  match_id: string
  predicted_winner_team_id: string | null
  predicted_first_to_score_team_id: string | null
  predicted_home_score: number
  predicted_away_score: number
  points_awarded: number
  scored: boolean
  wants_winner_pick: boolean
  wants_first_to_score_pick: boolean
  wants_exact_score_pick: boolean
}

const props = defineProps<{
  match: Match
  prediction?: Prediction | null
}>()

const emit = defineEmits<{ saved: [Prediction] }>()

const { user } = useAuth()
const { call } = useFunctions()

const initialWinner = props.prediction
  ? (props.prediction.predicted_winner_team_id ?? 'draw')
  : null
const winner = ref<string | null>(initialWinner)
const firstToScore = ref<string | null>(props.prediction?.predicted_first_to_score_team_id ?? null)
const homeScore = ref<number>(props.prediction?.predicted_home_score ?? 0)
const awayScore = ref<number>(props.prediction?.predicted_away_score ?? 0)

const wantsWinner = ref<boolean>(props.prediction?.wants_winner_pick ?? true)
const wantsFirstToScore = ref<boolean>(props.prediction?.wants_first_to_score_pick ?? true)
const wantsExactScore = ref<boolean>(props.prediction?.wants_exact_score_pick ?? true)

const saving = ref(false)
const error = ref('')
const justSaved = ref(false)
const showShare = ref(false)

const shareText = computed(() => {
  const home = props.match.home_team.name
  const away = props.match.away_team.name
  const homeFlag = props.match.home_team.flag_emoji
  const awayFlag = props.match.away_team.flag_emoji

  const parts: string[] = []

  if (wantsExactScore.value) {
    parts.push(`${homeFlag} ${home} ${homeScore.value} - ${awayScore.value} ${away} ${awayFlag}`)
  } else if (wantsWinner.value) {
    const winLabel = winner.value === props.match.home_team_id
      ? `${home} to win`
      : winner.value === props.match.away_team_id
        ? `${away} to win`
        : 'a draw'
    parts.push(`${homeFlag} ${home} vs ${away} ${awayFlag} — I'm calling ${winLabel}`)
  } else {
    parts.push(`${homeFlag} ${home} vs ${away} ${awayFlag}`)
  }

  parts.push('')
  parts.push('Think you know better? Make your predictions on Sycamore Predictor League!')
  parts.push('#SycamorePredictor #WorldCup2026')

  return parts.join('\n')
})

const LOCK_MS = 3 * 60 * 60 * 1000

const lockTime = computed(() => new Date(props.match.kickoff_at).getTime() - LOCK_MS)
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  timer = setInterval(() => (now.value = Date.now()), 30_000)
})
onUnmounted(() => {
  if (timer) clearInterval(timer)
})

const isLocked = computed(() => now.value >= lockTime.value || props.match.status !== 'scheduled')
const isCompleted = computed(() => props.match.status === 'completed')

const timeToLock = computed(() => {
  const diff = lockTime.value - now.value
  if (diff <= 0) return 'Locked'
  const hours = Math.floor(diff / 3_600_000)
  const minutes = Math.floor((diff % 3_600_000) / 60_000)
  if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
})

const kickoffLabel = computed(() => {
  const d = new Date(props.match.kickoff_at)
  return d.toLocaleString('en-NG', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
})

const homeWinSelected = computed(() => winner.value === props.match.home_team_id)
const awayWinSelected = computed(() => winner.value === props.match.away_team_id)
const drawSelected = computed(() => winner.value === 'draw')

const deriveWinnerFromScore = () => {
  if (homeScore.value > awayScore.value) winner.value = props.match.home_team_id
  else if (awayScore.value > homeScore.value) winner.value = props.match.away_team_id
  else winner.value = 'draw'
}

const reconcileFirstScorer = () => {
  if (firstToScore.value === props.match.home_team_id && homeScore.value === 0) {
    firstToScore.value = null
  } else if (firstToScore.value === props.match.away_team_id && awayScore.value === 0) {
    firstToScore.value = null
  }
}

const winnerDisabled = computed(() => isLocked.value || !wantsWinner.value)
const firstScorerDisabled = computed(() => isLocked.value || !wantsFirstToScore.value)
const scoreDisabled = computed(() => isLocked.value || !wantsExactScore.value)

const pickFirstScorer = (teamId: string) => {
  if (firstScorerDisabled.value) return
  firstToScore.value = teamId
  if (wantsExactScore.value) {
    if (teamId === props.match.home_team_id && homeScore.value === 0) {
      homeScore.value = 1
      deriveWinnerFromScore()
    } else if (teamId === props.match.away_team_id && awayScore.value === 0) {
      awayScore.value = 1
      deriveWinnerFromScore()
    }
  }
}

const pickWinner = (which: 'home' | 'draw' | 'away') => {
  if (winnerDisabled.value) return
  if (which === 'home') {
    winner.value = props.match.home_team_id
    if (wantsExactScore.value && homeScore.value <= awayScore.value) {
      homeScore.value = Math.min(15, awayScore.value + 1)
    }
  } else if (which === 'away') {
    winner.value = props.match.away_team_id
    if (wantsExactScore.value && awayScore.value <= homeScore.value) {
      awayScore.value = Math.min(15, homeScore.value + 1)
    }
  } else {
    winner.value = 'draw'
    if (wantsExactScore.value) awayScore.value = homeScore.value
  }
  if (wantsExactScore.value) reconcileFirstScorer()
}

const adjScore = (side: 'home' | 'away', delta: number) => {
  if (scoreDisabled.value) return
  if (side === 'home') homeScore.value = Math.max(0, Math.min(15, homeScore.value + delta))
  else awayScore.value = Math.max(0, Math.min(15, awayScore.value + delta))
  if (wantsWinner.value) deriveWinnerFromScore()
  reconcileFirstScorer()
}

const anyEnabled = computed(() => wantsWinner.value || wantsFirstToScore.value || wantsExactScore.value)

const save = async () => {
  if (!user.value || isLocked.value) return
  if (!anyEnabled.value) {
    error.value = 'Pick at least one prediction type to enter.'
    return
  }
  saving.value = true
  error.value = ''
  try {
    const winnerVal = wantsWinner.value
      ? (winner.value === 'draw' ? null : winner.value)
      : null
    await call('predictions/save', {
      email: user.value.email,
      match_id: props.match.id,
      winner_team_id: winnerVal,
      first_to_score_team_id: wantsFirstToScore.value ? firstToScore.value : null,
      home_score: homeScore.value,
      away_score: awayScore.value,
      wants_winner_pick: wantsWinner.value,
      wants_first_to_score_pick: wantsFirstToScore.value,
      wants_exact_score_pick: wantsExactScore.value,
    })
    justSaved.value = true
    setTimeout(() => (justSaved.value = false), 1800)
    emit('saved', {
      match_id: props.match.id,
      predicted_winner_team_id: winnerVal,
      predicted_first_to_score_team_id: wantsFirstToScore.value ? firstToScore.value : null,
      predicted_home_score: homeScore.value,
      predicted_away_score: awayScore.value,
      points_awarded: 0,
      scored: false,
      wants_winner_pick: wantsWinner.value,
      wants_first_to_score_pick: wantsFirstToScore.value,
      wants_exact_score_pick: wantsExactScore.value,
    })
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="card p-5 sm:p-6 animate-fade-up">
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2">
        <span class="pill bg-ink-100 text-ink-700 capitalize">{{ match.stage.replace('_', ' ') }}</span>
        <span v-if="isCompleted" class="pill bg-mint-100 text-mint-700">Final</span>
        <span v-else-if="isLocked" class="pill bg-coral-50 text-coral-700">Locked</span>
        <span v-else class="pill bg-sky-50 text-sky-700">Locks in {{ timeToLock }}</span>
      </div>
      <div v-if="prediction?.scored" class="pill bg-sun-100 text-sun-800">
        +{{ prediction.points_awarded }} pts
      </div>
    </div>

    <p class="text-xs text-ink-500 mb-4">{{ kickoffLabel }}</p>

    <div class="grid grid-cols-3 items-center gap-3 mb-6">
      <div class="text-center">
        <div class="text-4xl mb-1">{{ match.home_team.flag_emoji }}</div>
        <div class="font-bold text-ink-900 text-sm">{{ match.home_team.name }}</div>
      </div>
      <div class="text-center">
        <div v-if="isCompleted" class="text-2xl font-extrabold text-ink-900">
          {{ match.home_score }} <span class="text-ink-300">-</span> {{ match.away_score }}
        </div>
        <div v-else class="text-xl font-bold text-ink-300">vs</div>
      </div>
      <div class="text-center">
        <div class="text-4xl mb-1">{{ match.away_team.flag_emoji }}</div>
        <div class="font-bold text-ink-900 text-sm">{{ match.away_team.name }}</div>
      </div>
    </div>

    <div class="space-y-5">
      <div :class="['rounded-2xl p-4 transition', wantsWinner ? 'bg-white' : 'bg-ink-50/60']">
        <label class="flex items-center justify-between mb-2 cursor-pointer">
          <span class="flex items-center gap-2">
            <input
              type="checkbox"
              v-model="wantsWinner"
              :disabled="isLocked"
              class="w-4 h-4 rounded accent-sky-600"
            />
            <span class="font-bold text-ink-900 text-sm">Winner</span>
          </span>
          <span class="text-xs font-semibold text-sky-600">+5 pts</span>
        </label>
        <div :class="['grid grid-cols-3 gap-2 transition-opacity', wantsWinner ? '' : 'opacity-40 pointer-events-none']">
          <button
            type="button"
            :disabled="winnerDisabled"
            @click="pickWinner('home')"
            :class="[
              'rounded-xl border-2 px-3 py-3 text-sm font-bold transition',
              homeWinSelected && wantsWinner ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-ink-100 hover:border-ink-200 text-ink-700',
              winnerDisabled && 'opacity-60 cursor-not-allowed',
            ]"
          >
            {{ match.home_team.code }}
          </button>
          <button
            type="button"
            :disabled="winnerDisabled"
            @click="pickWinner('draw')"
            :class="[
              'rounded-xl border-2 px-3 py-3 text-sm font-bold transition',
              drawSelected && wantsWinner ? 'border-sun-500 bg-sun-50 text-sun-800' : 'border-ink-100 hover:border-ink-200 text-ink-700',
              winnerDisabled && 'opacity-60 cursor-not-allowed',
            ]"
          >
            Draw
          </button>
          <button
            type="button"
            :disabled="winnerDisabled"
            @click="pickWinner('away')"
            :class="[
              'rounded-xl border-2 px-3 py-3 text-sm font-bold transition',
              awayWinSelected && wantsWinner ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-ink-100 hover:border-ink-200 text-ink-700',
              winnerDisabled && 'opacity-60 cursor-not-allowed',
            ]"
          >
            {{ match.away_team.code }}
          </button>
        </div>
      </div>

      <div :class="['rounded-2xl p-4 transition', wantsFirstToScore ? 'bg-white' : 'bg-ink-50/60']">
        <label class="flex items-center justify-between mb-2 cursor-pointer">
          <span class="flex items-center gap-2">
            <input
              type="checkbox"
              v-model="wantsFirstToScore"
              :disabled="isLocked"
              class="w-4 h-4 rounded accent-mint-600"
            />
            <span class="font-bold text-ink-900 text-sm">First to score</span>
          </span>
          <span class="text-xs font-semibold text-mint-600">+10 pts</span>
        </label>
        <div :class="['grid grid-cols-2 gap-2 transition-opacity', wantsFirstToScore ? '' : 'opacity-40 pointer-events-none']">
          <button
            type="button"
            :disabled="firstScorerDisabled"
            @click="pickFirstScorer(match.home_team_id)"
            :class="[
              'rounded-xl border-2 px-3 py-3 text-sm font-bold transition',
              firstToScore === match.home_team_id && wantsFirstToScore ? 'border-mint-500 bg-mint-50 text-mint-700' : 'border-ink-100 hover:border-ink-200 text-ink-700',
              firstScorerDisabled && 'opacity-60 cursor-not-allowed',
            ]"
          >
            {{ match.home_team.flag_emoji }} {{ match.home_team.code }}
          </button>
          <button
            type="button"
            :disabled="firstScorerDisabled"
            @click="pickFirstScorer(match.away_team_id)"
            :class="[
              'rounded-xl border-2 px-3 py-3 text-sm font-bold transition',
              firstToScore === match.away_team_id && wantsFirstToScore ? 'border-mint-500 bg-mint-50 text-mint-700' : 'border-ink-100 hover:border-ink-200 text-ink-700',
              firstScorerDisabled && 'opacity-60 cursor-not-allowed',
            ]"
          >
            {{ match.away_team.flag_emoji }} {{ match.away_team.code }}
          </button>
        </div>
        <p v-if="wantsFirstToScore && wantsExactScore && homeScore === 0 && awayScore === 0" class="mt-2 text-xs text-ink-500">
          Goalless draw predicted &mdash; picking a first scorer will set their score to 1.
        </p>
      </div>

      <div :class="['rounded-2xl p-4 transition', wantsExactScore ? 'bg-white' : 'bg-ink-50/60']">
        <label class="flex items-center justify-between mb-2 cursor-pointer">
          <span class="flex items-center gap-2">
            <input
              type="checkbox"
              v-model="wantsExactScore"
              :disabled="isLocked"
              class="w-4 h-4 rounded accent-coral-600"
            />
            <span class="font-bold text-ink-900 text-sm">Exact scoreline</span>
          </span>
          <span class="text-xs font-semibold text-coral-600">+15 pts</span>
        </label>
        <div :class="['grid grid-cols-2 gap-3 transition-opacity', wantsExactScore ? '' : 'opacity-40 pointer-events-none']">
          <div class="rounded-xl bg-ink-50 p-3 flex items-center justify-between gap-2">
            <button
              type="button"
              :disabled="scoreDisabled"
              @click="adjScore('home', -1)"
              class="w-8 h-8 rounded-lg bg-white text-ink-600 font-bold hover:bg-ink-100 disabled:opacity-50"
            >−</button>
            <div class="flex-1 text-center">
              <div class="text-xs text-ink-500 font-semibold">{{ match.home_team.code }}</div>
              <div class="text-2xl font-extrabold text-ink-900">{{ homeScore }}</div>
            </div>
            <button
              type="button"
              :disabled="scoreDisabled"
              @click="adjScore('home', 1)"
              class="w-8 h-8 rounded-lg bg-white text-ink-600 font-bold hover:bg-ink-100 disabled:opacity-50"
            >+</button>
          </div>
          <div class="rounded-xl bg-ink-50 p-3 flex items-center justify-between gap-2">
            <button
              type="button"
              :disabled="scoreDisabled"
              @click="adjScore('away', -1)"
              class="w-8 h-8 rounded-lg bg-white text-ink-600 font-bold hover:bg-ink-100 disabled:opacity-50"
            >−</button>
            <div class="flex-1 text-center">
              <div class="text-xs text-ink-500 font-semibold">{{ match.away_team.code }}</div>
              <div class="text-2xl font-extrabold text-ink-900">{{ awayScore }}</div>
            </div>
            <button
              type="button"
              :disabled="scoreDisabled"
              @click="adjScore('away', 1)"
              class="w-8 h-8 rounded-lg bg-white text-ink-600 font-bold hover:bg-ink-100 disabled:opacity-50"
            >+</button>
          </div>
        </div>
      </div>

      <p v-if="error" class="text-sm text-coral-600">{{ error }}</p>

      <button
        v-if="!isLocked"
        @click="save"
        :disabled="saving || !anyEnabled"
        class="btn-primary w-full disabled:opacity-50"
      >
        <span v-if="justSaved" class="animate-pop-in">Saved</span>
        <span v-else-if="saving">Saving...</span>
        <span v-else>{{ prediction ? 'Update prediction' : 'Lock in prediction' }}</span>
      </button>
      <p v-else-if="!isCompleted" class="text-center text-sm text-ink-500">
        Predictions for this match are locked.
      </p>

      <!-- Share prediction -->
      <button
        v-if="prediction || justSaved"
        @click="showShare = true"
        class="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-ink-100 text-sm font-semibold text-ink-700 hover:bg-ink-50 hover:border-ink-200 transition"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
        Share prediction
      </button>
    </div>

    <ShareModal
      v-if="showShare"
      :text="shareText"
      title="My World Cup Prediction"
      @close="showShare = false"
    />
  </div>
</template>
