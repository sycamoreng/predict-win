<script setup lang="ts">
interface Team {
  id: string
  name: string
  code: string
  flag_emoji: string
  logo_url?: string
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
  predicted_finish_type?: string | null
  points_awarded: number
  scored: boolean
  wants_winner_pick: boolean
  wants_first_to_score_pick: boolean
  wants_exact_score_pick: boolean
}

type FinishType = 'FT' | 'AET' | 'PEN'

const KNOCKOUT_STAGES = new Set(['round_of_16', 'round_of_32', 'quarter_final', 'semi_final', 'third_place', 'final'])

const props = defineProps<{
  match: Match
  prediction?: Prediction | null
  campaign?: { has_knockout_stages?: boolean; scoring_result?: number; scoring_first_to_score?: number; scoring_exact_ft?: number; scoring_exact_aet?: number; scoring_exact_pen?: number; name?: string }
  tripleCaptainMatchId?: string | null
  tripleCaptainAvailable?: boolean
  matchweekLocked?: boolean
}>()

const emit = defineEmits<{ saved: [Prediction]; 'activate-triple-captain': [string]; 'cancel-triple-captain': [] }>()

const { user, trackPulseEvent } = useAuth()
const { call } = useFunctions()
const { config: campaignConfig } = useCampaign()

const initialWinner = props.prediction
  ? (props.prediction.predicted_winner_team_id ?? 'draw')
  : null
const winner = ref<string | null>(initialWinner)
const firstToScore = ref<string | null>(props.prediction?.predicted_first_to_score_team_id ?? null)
const homeScore = ref<number>(props.prediction?.predicted_home_score ?? 0)
const awayScore = ref<number>(props.prediction?.predicted_away_score ?? 0)

const wantsWinner = ref<boolean>(props.prediction?.wants_winner_pick ?? false)
const wantsFirstToScore = ref<boolean>(props.prediction?.wants_first_to_score_pick ?? false)
const wantsExactScore = ref<boolean>(props.prediction?.wants_exact_score_pick ?? false)

const hasTouchedWinner = ref(!!props.prediction?.wants_winner_pick)
const hasTouchedFirstScorer = ref(!!props.prediction?.wants_first_to_score_pick)
const hasTouchedScore = ref(!!props.prediction?.wants_exact_score_pick)

// Knockout mode
const isKnockout = computed(() => (props.campaign?.has_knockout_stages !== false) && KNOCKOUT_STAGES.has(props.match.stage))
const finishType = ref<FinishType | null>((props.prediction?.predicted_finish_type as FinishType) ?? null)

const saving = ref(false)
const error = ref('')
const justSaved = ref(false)
const showShare = ref(false)
const toastMessage = ref('')

const isTripleCaptainOnThis = computed(() => props.tripleCaptainMatchId === props.match.id)
const canActivateTC = computed(() => {
  if (!props.tripleCaptainAvailable) return false
  if (props.match.status !== 'scheduled') return false
  if (new Date(props.match.kickoff_at) <= new Date()) return false
  return true
})

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
  const campaignName = props.campaign?.name || 'Sycamore Predictor League'
  parts.push(`Think you know better? Make your predictions on ${campaignName}!`)
  parts.push('#SycamorePredictor')

  return parts.join('\n')
})

const predictionImageProps = computed(() => {
  const winnerName = winner.value === props.match.home_team_id
    ? props.match.home_team.name
    : winner.value === props.match.away_team_id
      ? props.match.away_team.name
      : winner.value === 'draw' ? 'draw' : undefined

  return {
    variant: 'prediction' as const,
    username: user.value?.username || user.value?.email?.split('@')[0] || 'player',
    homeTeam: props.match.home_team,
    awayTeam: props.match.away_team,
    predictedScore: wantsExactScore.value ? { home: homeScore.value, away: awayScore.value } : undefined,
    predictedWinner: wantsWinner.value ? winnerName : undefined,
  }
})

const lockMs = computed(() => (campaignConfig.value.prediction_lock_minutes ?? 60) * 60 * 1000)

const lockTime = computed(() => new Date(props.match.kickoff_at).getTime() - lockMs.value)
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  timer = setInterval(() => (now.value = Date.now()), 30_000)
})
onUnmounted(() => {
  if (timer) clearInterval(timer)
})

const isLocked = computed(() => props.matchweekLocked || now.value >= lockTime.value || props.match.status !== 'scheduled')
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
  if (isKnockout.value) {
    if (homeScore.value > awayScore.value) winner.value = props.match.home_team_id
    else if (awayScore.value > homeScore.value) winner.value = props.match.away_team_id
    // PEN: scores are level, winner stays as-is (penalty winner)
  } else {
    if (homeScore.value > awayScore.value) winner.value = props.match.home_team_id
    else if (awayScore.value > homeScore.value) winner.value = props.match.away_team_id
    else winner.value = 'draw'
  }
}

const reconcileFirstScorer = () => {
  if (!wantsExactScore.value) return
  if (firstToScore.value === props.match.home_team_id && homeScore.value === 0) {
    firstToScore.value = null
    hasTouchedFirstScorer.value = false
  } else if (firstToScore.value === props.match.away_team_id && awayScore.value === 0) {
    firstToScore.value = null
    hasTouchedFirstScorer.value = false
  }
}

const winnerDisabled = computed(() => isLocked.value || !wantsWinner.value)
const firstScorerDisabled = computed(() => isLocked.value || !wantsFirstToScore.value)
const scoreDisabled = computed(() => isLocked.value || !wantsExactScore.value)

const pickFirstScorer = (teamId: string) => {
  if (firstScorerDisabled.value) return
  hasTouchedFirstScorer.value = true
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
  hasTouchedWinner.value = true
  if (which === 'home') {
    winner.value = props.match.home_team_id
    if (wantsExactScore.value && (finishType.value === 'FT' || finishType.value === 'AET') && homeScore.value <= awayScore.value) {
      homeScore.value = Math.min(15, awayScore.value + 1)
    }
  } else if (which === 'away') {
    winner.value = props.match.away_team_id
    if (wantsExactScore.value && (finishType.value === 'FT' || finishType.value === 'AET') && awayScore.value <= homeScore.value) {
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
  hasTouchedScore.value = true
  if (side === 'home') homeScore.value = Math.max(0, Math.min(15, homeScore.value + delta))
  else awayScore.value = Math.max(0, Math.min(15, awayScore.value + delta))

  // Knockout: enforce score constraints
  if (isKnockout.value && finishType.value === 'PEN') {
    if (side === 'home') awayScore.value = homeScore.value
    else homeScore.value = awayScore.value
  }

  if (wantsWinner.value) deriveWinnerFromScore()
  reconcileFirstScorer()
}

// Knockout: pick finish type
const pickFinishType = (ft: FinishType) => {
  finishType.value = ft
  if (ft === 'PEN') {
    const maxScore = Math.max(homeScore.value, awayScore.value)
    homeScore.value = maxScore
    awayScore.value = maxScore
    hasTouchedScore.value = true
  } else if (ft === 'FT' || ft === 'AET') {
    if (hasTouchedScore.value && homeScore.value === awayScore.value) {
      if (winner.value === props.match.home_team_id) {
        homeScore.value = awayScore.value + 1
      } else if (winner.value === props.match.away_team_id) {
        awayScore.value = homeScore.value + 1
      } else {
        homeScore.value = awayScore.value + 1
      }
    }
  }
}

const knockoutScoreValid = computed(() => {
  if (!isKnockout.value || !finishType.value || !hasTouchedScore.value) return true
  if (finishType.value === 'FT' || finishType.value === 'AET') {
    return homeScore.value !== awayScore.value
  }
  if (finishType.value === 'PEN') {
    return homeScore.value === awayScore.value
  }
  return true
})

const knockoutScoreLabel = computed(() => {
  const ftPts = props.campaign?.scoring_exact_ft ?? 15
  const aetPts = props.campaign?.scoring_exact_aet ?? 20
  const penPts = props.campaign?.scoring_exact_pen ?? 25
  if (!finishType.value) return `+${ftPts} pts`
  if (finishType.value === 'FT') return `+${ftPts} pts`
  if (finishType.value === 'AET') return `+${aetPts} pts`
  return `+${penPts} pts`
})

const anyEnabled = computed(() => wantsWinner.value || wantsFirstToScore.value || wantsExactScore.value)

const canSubmit = computed(() => {
  if (!anyEnabled.value) return false
  if (wantsWinner.value && !hasTouchedWinner.value) return false
  if (wantsFirstToScore.value && !hasTouchedFirstScorer.value) return false
  if (wantsExactScore.value && !hasTouchedScore.value) return false
  // Knockout: must pick finish type and score must be valid
  if (isKnockout.value && wantsExactScore.value) {
    if (!finishType.value) return false
    if (!knockoutScoreValid.value) return false
  }
  return true
})

const save = async () => {
  if (!user.value || isLocked.value) return
  if (!anyEnabled.value) {
    error.value = 'Pick at least one prediction type to enter.'
    return
  }
  if (!canSubmit.value) {
    error.value = 'Make a selection in each category you opted into.'
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
      predicted_finish_type: isKnockout.value && wantsExactScore.value ? finishType.value : null,
    })
    justSaved.value = true
    trackPulseEvent('prediction_saved', {
      match_id: props.match.id,
      home_team: props.match.home_team.name,
      away_team: props.match.away_team.name,
      wants_winner: wantsWinner.value,
      wants_first_to_score: wantsFirstToScore.value,
      wants_exact_score: wantsExactScore.value,
    })

    const diff = lockTime.value - Date.now()
    if (diff > 0) {
      const hours = Math.floor(diff / 3_600_000)
      const minutes = Math.floor((diff % 3_600_000) / 60_000)
      const timeStr = hours >= 24
        ? `${Math.floor(hours / 24)}d ${hours % 24}h`
        : hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
      toastMessage.value = `Prediction saved! You can still change it for the next ${timeStr}, until it locks.`
    } else {
      toastMessage.value = 'Prediction saved!'
    }
    setTimeout(() => { toastMessage.value = ''; justSaved.value = false }, 5000)
    emit('saved', {
      match_id: props.match.id,
      predicted_winner_team_id: winnerVal,
      predicted_first_to_score_team_id: wantsFirstToScore.value ? firstToScore.value : null,
      predicted_home_score: homeScore.value,
      predicted_away_score: awayScore.value,
      predicted_finish_type: isKnockout.value && wantsExactScore.value ? finishType.value : null,
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

    <!-- Triple Captain badge or activation -->
    <div v-if="isTripleCaptainOnThis" class="mb-4 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
      <svg class="w-4 h-4 text-amber-500 shrink-0" fill="currentColor" viewBox="0 0 24 24">
        <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
      </svg>
      <span class="text-xs font-bold text-amber-700 flex-1">Triple Captain active - 3x points!</span>
      <button
        v-if="!isLocked && !isCompleted"
        @click="emit('cancel-triple-captain')"
        class="px-2 py-1 rounded-lg bg-white hover:bg-coral-50 border border-coral-200 text-coral-600 text-[11px] font-semibold transition"
      >
        Cancel
      </button>
    </div>
    <div v-else-if="canActivateTC && !isLocked && !isCompleted" class="mb-4">
      <button
        @click="emit('activate-triple-captain', match.id)"
        class="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-amber-300 hover:border-amber-400 bg-amber-50/50 hover:bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 transition"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
        </svg>
        Use Triple Captain (3x points)
      </button>
    </div>

    <div class="grid grid-cols-3 items-center gap-3 mb-6">
      <div class="text-center">
        <img v-if="match.home_team.logo_url" :src="match.home_team.logo_url" :alt="match.home_team.name" class="w-10 h-10 mx-auto mb-1 object-contain" />
        <div v-else class="text-4xl mb-1">{{ match.home_team.flag_emoji }}</div>
        <div class="font-bold text-ink-900 text-sm">{{ match.home_team.name }}</div>
      </div>
      <div class="text-center">
        <div v-if="isCompleted" class="text-2xl font-extrabold text-ink-900">
          {{ match.home_score }} <span class="text-ink-300">-</span> {{ match.away_score }}
        </div>
        <div v-else class="text-xl font-bold text-ink-300">vs</div>
      </div>
      <div class="text-center">
        <img v-if="match.away_team.logo_url" :src="match.away_team.logo_url" :alt="match.away_team.name" class="w-10 h-10 mx-auto mb-1 object-contain" />
        <div v-else class="text-4xl mb-1">{{ match.away_team.flag_emoji }}</div>
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
          <span class="text-xs font-semibold text-sky-600">+{{ campaign?.scoring_result ?? 5 }} pts</span>
        </label>
        <!-- Group stage: 3-col with Draw -->
        <div v-if="!isKnockout" :class="['grid grid-cols-3 gap-2 transition-opacity', wantsWinner ? '' : 'opacity-40 pointer-events-none']">
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
        <!-- Knockout: 2-col, no Draw -->
        <div v-else :class="['grid grid-cols-2 gap-2 transition-opacity', wantsWinner ? '' : 'opacity-40 pointer-events-none']">
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
            <img v-if="match.home_team.logo_url" :src="match.home_team.logo_url" :alt="match.home_team.code" class="w-4 h-4 object-contain inline-block" /> <span v-else>{{ match.home_team.flag_emoji }}</span> {{ match.home_team.code }}
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
            <img v-if="match.away_team.logo_url" :src="match.away_team.logo_url" :alt="match.away_team.code" class="w-4 h-4 object-contain inline-block" /> <span v-else>{{ match.away_team.flag_emoji }}</span> {{ match.away_team.code }}
          </button>
        </div>
        <p v-if="isKnockout && wantsWinner && !hasTouchedWinner" class="mt-2 text-xs text-ink-400">
          Someone must advance — pick who wins.
        </p>
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
          <span class="text-xs font-semibold text-mint-600">+{{ campaign?.scoring_first_to_score ?? 10 }} pts</span>
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
            <img v-if="match.home_team.logo_url" :src="match.home_team.logo_url" :alt="match.home_team.code" class="w-4 h-4 object-contain inline-block" /> <span v-else>{{ match.home_team.flag_emoji }}</span> {{ match.home_team.code }}
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
            <img v-if="match.away_team.logo_url" :src="match.away_team.logo_url" :alt="match.away_team.code" class="w-4 h-4 object-contain inline-block" /> <span v-else>{{ match.away_team.flag_emoji }}</span> {{ match.away_team.code }}
          </button>
        </div>
        <p v-if="wantsFirstToScore && wantsExactScore && homeScore === 0 && awayScore === 0 && hasTouchedScore" class="mt-2 text-xs text-ink-500">
          Goalless draw predicted &mdash; picking a first scorer will set their score to 1.
        </p>
        <p v-if="wantsFirstToScore && !hasTouchedFirstScorer" class="mt-2 text-xs text-ink-400">
          Tap a team to pick who scores first.
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
          <span class="text-xs font-semibold text-coral-600">{{ isKnockout ? knockoutScoreLabel : `+${campaign?.scoring_exact_ft ?? 15} pts` }}</span>
        </label>

        <div :class="['transition-opacity', wantsExactScore ? '' : 'opacity-40 pointer-events-none']">
          <!-- Knockout: finish type picker -->
          <div v-if="isKnockout" class="mb-4">
            <p class="text-xs font-medium text-ink-500 mb-2">How does the match end?</p>
            <div class="grid grid-cols-3 gap-2">
              <button
                type="button"
                :disabled="scoreDisabled"
                @click="pickFinishType('FT')"
                :class="[
                  'rounded-xl border-2 px-2 py-2.5 text-xs font-bold transition text-center',
                  finishType === 'FT' ? 'border-coral-500 bg-coral-50 text-coral-700' : 'border-ink-100 hover:border-ink-200 text-ink-700',
                ]"
              >
                <span class="block text-base mb-0.5">90'</span>
                Full Time
              </button>
              <button
                type="button"
                :disabled="scoreDisabled"
                @click="pickFinishType('AET')"
                :class="[
                  'rounded-xl border-2 px-2 py-2.5 text-xs font-bold transition text-center',
                  finishType === 'AET' ? 'border-coral-500 bg-coral-50 text-coral-700' : 'border-ink-100 hover:border-ink-200 text-ink-700',
                ]"
              >
                <span class="block text-base mb-0.5">120'</span>
                Extra Time
              </button>
              <button
                type="button"
                :disabled="scoreDisabled"
                @click="pickFinishType('PEN')"
                :class="[
                  'rounded-xl border-2 px-2 py-2.5 text-xs font-bold transition text-center',
                  finishType === 'PEN' ? 'border-coral-500 bg-coral-50 text-coral-700' : 'border-ink-100 hover:border-ink-200 text-ink-700',
                ]"
              >
                <span class="block text-base mb-0.5">PK</span>
                Penalties
              </button>
            </div>
          </div>

          <!-- Score context label for knockout -->
          <p v-if="isKnockout && finishType" class="text-xs font-medium text-ink-500 mb-2">
            {{ finishType === 'FT' ? 'Final score at full time:' : finishType === 'AET' ? 'Score after extra time:' : 'Score after extra time (must be a draw):' }}
          </p>

          <!-- Score pickers (show always for group, after finish type for knockout) -->
          <div v-if="!isKnockout || finishType" class="grid grid-cols-2 gap-3">
            <div class="rounded-xl bg-ink-50 p-3 flex items-center justify-between gap-2">
              <button
                type="button"
                :disabled="scoreDisabled"
                @click="adjScore('home', -1)"
                class="w-8 h-8 rounded-lg bg-white text-ink-600 font-bold hover:bg-ink-100 disabled:opacity-50"
              >-</button>
              <div class="flex-1 text-center">
                <div class="text-xs text-ink-500 font-semibold">{{ match.home_team.code }}</div>
                <div class="text-2xl font-extrabold text-ink-900">{{ hasTouchedScore ? homeScore : '-' }}</div>
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
              >-</button>
              <div class="flex-1 text-center">
                <div class="text-xs text-ink-500 font-semibold">{{ match.away_team.code }}</div>
                <div class="text-2xl font-extrabold text-ink-900">{{ hasTouchedScore ? awayScore : '-' }}</div>
              </div>
              <button
                type="button"
                :disabled="scoreDisabled"
                @click="adjScore('away', 1)"
                class="w-8 h-8 rounded-lg bg-white text-ink-600 font-bold hover:bg-ink-100 disabled:opacity-50"
              >+</button>
            </div>
          </div>

          <!-- Knockout constraint hints -->
          <p v-if="isKnockout && (finishType === 'FT' || finishType === 'AET') && hasTouchedScore && homeScore === awayScore" class="mt-2 text-xs text-coral-600 flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/></svg>
            {{ finishType === 'FT' ? 'A Full Time finish means one team wins in 90 minutes. The score can\'t be level.' : 'Extra Time means a winner is decided in ET. The score after ET can\'t be level — that\'s penalties.' }}
          </p>
          <div v-if="isKnockout && finishType === 'PEN' && wantsWinner && winner" class="mt-2 rounded-lg bg-ink-50 px-3 py-2">
            <p class="text-xs text-ink-600">
              <span class="font-semibold">{{ winner === match.home_team_id ? match.home_team.name : match.away_team.name }}</span> wins the shootout (same as your winner pick above).
            </p>
          </div>
          <p v-if="isKnockout && finishType === 'PEN' && wantsWinner && !winner" class="mt-2 text-xs text-coral-600 flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/></svg>
            Pick a winner above — they'll be the penalty shootout winner.
          </p>
          <p v-if="isKnockout && finishType === 'PEN' && !wantsWinner" class="mt-2 text-xs text-coral-600 flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/></svg>
            Enable "Winner" above to specify who wins on penalties.
          </p>

          <!-- Bold prediction banner -->
          <div v-if="isKnockout && finishType && hasTouchedScore" class="mt-3 rounded-xl bg-sun-50 border border-sun-200 px-4 py-3 space-y-1.5">
            <p class="text-xs text-sun-800">
              <span class="font-semibold">Bold prediction!</span>
              {{ finishType === 'FT' ? 'You\'re predicting a decisive result in 90 minutes. The score must have a clear winner.' : finishType === 'AET' ? 'You\'re predicting the match goes to extra time where a winner is decided. Score after ET must have a clear winner.' : 'You\'re predicting the match stays level through extra time and goes to a penalty shootout. Your winner pick determines who wins on pens.' }}
            </p>
            <p class="text-xs text-sun-700">
              {{ finishType === 'FT' ? 'If the match goes to extra time or penalties instead, you won\'t earn scoreline points — even if the numbers match.' : finishType === 'AET' ? 'If the match is decided in 90 minutes or goes to penalties instead, you won\'t earn scoreline points — even if the numbers match.' : 'If the match is decided before penalties (in 90 min or extra time), you won\'t earn scoreline points — even if the numbers match.' }}
            </p>
          </div>

          <!-- Group stage hints -->
          <p v-if="!isKnockout && wantsExactScore && !hasTouchedScore" class="mt-2 text-xs text-ink-400">
            Tap +/&minus; to set your predicted score.
          </p>
          <!-- Knockout: no finish type selected yet -->
          <p v-if="isKnockout && !finishType && wantsExactScore" class="mt-2 text-xs text-ink-400">
            Pick how you think the match ends, then set your score.
          </p>
        </div>
      </div>

      <p v-if="error" class="text-sm text-coral-600">{{ error }}</p>
      <p v-if="!anyEnabled && !isLocked && !prediction" class="text-center text-xs text-ink-400">
        Tick the categories you want to predict, then make your picks.
      </p>

      <button
        v-if="!isLocked"
        @click="save"
        :disabled="saving || !canSubmit"
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
      :image-card-props="predictionImageProps"
      :title="`My ${campaign?.name || 'Predictor League'} Prediction`"
      @close="showShare = false"
    />

    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0 translate-y-4"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 translate-y-4"
      >
        <div
          v-if="toastMessage"
          class="fixed bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-50 bg-ink-900 text-white rounded-xl px-5 py-4 shadow-xl flex items-start gap-3"
        >
          <svg class="w-5 h-5 text-mint-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
          </svg>
          <p class="text-sm font-medium leading-snug">{{ toastMessage }}</p>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
