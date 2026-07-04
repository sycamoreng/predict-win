<script setup lang="ts">
definePageMeta({ middleware: 'admin-auth', layout: false })

const { admin } = useAuth()
const router = useRouter()

if (!admin.value) router.replace('/admin/login')

// --- Point configuration ---
const points = reactive({
  winner: 5,
  firstToScore: 10,
  correctScore_FT: 15,
  correctScore_AET: 20,
  correctScore_PEN: 25,
})

// --- Match setup ---
const homeTeam = reactive({ name: 'France', code: 'FRA', flag: '\u{1F1EB}\u{1F1F7}' })
const awayTeam = reactive({ name: 'Argentina', code: 'ARG', flag: '\u{1F1E6}\u{1F1F7}' })

type FinishType = 'FT' | 'AET' | 'PEN'

const matchResult = reactive({
  finishType: 'FT' as FinishType,
  ftHomeScore: 2,
  ftAwayScore: 1,
  aetHomeScore: 2,
  aetAwayScore: 1,
  penWinnerSide: 'home' as 'home' | 'away',
  firstToScoreSide: 'home' as 'home' | 'away',
})

const actualWinnerId = computed(() => {
  if (matchResult.finishType === 'FT') {
    return matchResult.ftHomeScore > matchResult.ftAwayScore ? 'home' : 'away'
  }
  if (matchResult.finishType === 'AET') {
    return matchResult.aetHomeScore > matchResult.aetAwayScore ? 'home' : 'away'
  }
  return matchResult.penWinnerSide
})

const displayScore = computed(() => {
  if (matchResult.finishType === 'FT') {
    return `${matchResult.ftHomeScore}-${matchResult.ftAwayScore}`
  }
  if (matchResult.finishType === 'AET') {
    return `${matchResult.aetHomeScore}-${matchResult.aetAwayScore} AET (FT: ${matchResult.ftHomeScore}-${matchResult.ftAwayScore})`
  }
  return `${matchResult.aetHomeScore}-${matchResult.aetAwayScore} (${matchResult.penWinnerSide === 'home' ? homeTeam.code : awayTeam.code} wins on pens)`
})

// --- Enforce constraints ---
watch(() => matchResult.finishType, (ft) => {
  if (ft === 'FT') {
    if (matchResult.ftHomeScore === matchResult.ftAwayScore) {
      matchResult.ftHomeScore = matchResult.ftAwayScore + 1
    }
  }
  if (ft === 'AET') {
    matchResult.ftHomeScore = matchResult.aetHomeScore > matchResult.aetAwayScore
      ? matchResult.aetHomeScore - 1
      : matchResult.aetAwayScore - 1
    matchResult.ftAwayScore = matchResult.ftHomeScore
    if (matchResult.aetHomeScore === matchResult.aetAwayScore) {
      matchResult.aetHomeScore = matchResult.aetAwayScore + 1
    }
  }
  if (ft === 'PEN') {
    // For PEN: both FT and AET scores must be draws, but they can be different draws.
    // Ensure FT is a draw without overwriting AET.
    if (matchResult.ftHomeScore !== matchResult.ftAwayScore) {
      const ftMax = Math.max(matchResult.ftHomeScore, matchResult.ftAwayScore)
      matchResult.ftHomeScore = ftMax
      matchResult.ftAwayScore = ftMax
    }
    // Ensure AET is a draw without overwriting FT.
    if (matchResult.aetHomeScore !== matchResult.aetAwayScore) {
      const aetMax = Math.max(matchResult.aetHomeScore, matchResult.aetAwayScore)
      matchResult.aetHomeScore = aetMax
      matchResult.aetAwayScore = aetMax
    }
  }
})

// --- Sample predictions ---
interface SamplePrediction {
  id: number
  label: string
  winnerSide: 'home' | 'away'
  firstToScoreSide: 'home' | 'away'
  scoreType: FinishType
  homeScore: number
  awayScore: number
}

const samplePredictions = ref<SamplePrediction[]>([
  { id: 1, label: 'User A', winnerSide: 'home', firstToScoreSide: 'home', scoreType: 'FT', homeScore: 2, awayScore: 1 },
  { id: 2, label: 'User B', winnerSide: 'away', firstToScoreSide: 'away', scoreType: 'FT', homeScore: 1, awayScore: 2 },
  { id: 3, label: 'User C', winnerSide: 'home', firstToScoreSide: 'home', scoreType: 'AET', homeScore: 2, awayScore: 1 },
  { id: 4, label: 'User D', winnerSide: 'home', firstToScoreSide: 'away', scoreType: 'PEN', homeScore: 1, awayScore: 1 },
])

let nextId = 5

const addPrediction = () => {
  samplePredictions.value.push({
    id: nextId++,
    label: `User ${String.fromCharCode(64 + nextId - 1)}`,
    winnerSide: 'home',
    firstToScoreSide: 'home',
    scoreType: 'FT',
    homeScore: 1,
    awayScore: 0,
  })
}

const removePrediction = (id: number) => {
  samplePredictions.value = samplePredictions.value.filter((p) => p.id !== id)
}

// --- Scoring engine ---
interface ScoredPrediction {
  id: number
  label: string
  winnerPoints: number
  firstToScorePoints: number
  scorePoints: number
  totalPoints: number
  breakdown: string[]
}

const scoredResults = computed<ScoredPrediction[]>(() => {
  return samplePredictions.value.map((pred) => {
    const breakdown: string[] = []
    let winnerPoints = 0
    let firstToScorePoints = 0
    let scorePoints = 0

    // Winner check
    if (pred.winnerSide === actualWinnerId.value) {
      winnerPoints = points.winner
      breakdown.push(`Winner correct (+${points.winner})`)
    } else {
      breakdown.push('Winner incorrect')
    }

    // First to score check
    if (pred.firstToScoreSide === matchResult.firstToScoreSide) {
      firstToScorePoints = points.firstToScore
      breakdown.push(`First to score correct (+${points.firstToScore})`)
    } else {
      breakdown.push('First to score incorrect')
    }

    // Scoreline check - the key knockout logic
    const scoreTypeMatches = pred.scoreType === matchResult.finishType

    if (scoreTypeMatches) {
      let scoreCorrect = false

      if (pred.scoreType === 'FT') {
        scoreCorrect = pred.homeScore === matchResult.ftHomeScore && pred.awayScore === matchResult.ftAwayScore
      } else if (pred.scoreType === 'AET') {
        scoreCorrect = pred.homeScore === matchResult.aetHomeScore && pred.awayScore === matchResult.aetAwayScore
      } else if (pred.scoreType === 'PEN') {
        scoreCorrect = pred.homeScore === matchResult.aetHomeScore &&
          pred.awayScore === matchResult.aetAwayScore &&
          pred.winnerSide === matchResult.penWinnerSide
      }

      if (scoreCorrect) {
        const pts = pred.scoreType === 'PEN' ? points.correctScore_PEN
          : pred.scoreType === 'AET' ? points.correctScore_AET
            : points.correctScore_FT
        scorePoints = pts
        breakdown.push(`Exact score correct (${pred.scoreType}) (+${pts})`)
      } else {
        breakdown.push(`Score incorrect (predicted ${pred.homeScore}-${pred.awayScore} ${pred.scoreType})`)
      }
    } else {
      // Score type doesn't match, but check if they got the FT portion right
      if (matchResult.finishType !== 'FT' && pred.scoreType === 'FT') {
        // User predicted FT win but match went to ET/PEN
        // Check if their score matches the 90-min score
        if (pred.homeScore === matchResult.ftHomeScore && pred.awayScore === matchResult.ftAwayScore) {
          // They got the FT score right but predicted the wrong finish type
          // Award partial? Or nothing? Configurable:
          breakdown.push(`Score matches FT result but predicted ${pred.scoreType} finish (no points - wrong finish type)`)
        } else {
          breakdown.push(`Score incorrect (predicted ${pred.homeScore}-${pred.awayScore} ${pred.scoreType}, match ended ${matchResult.finishType})`)
        }
      } else {
        breakdown.push(`Score incorrect (predicted ${pred.scoreType}, match ended ${matchResult.finishType})`)
      }
    }

    const totalPoints = winnerPoints + firstToScorePoints + scorePoints
    return { id: pred.id, label: pred.label, winnerPoints, firstToScorePoints, scorePoints, totalPoints, breakdown }
  })
})

const maxPoints = computed(() => Math.max(...scoredResults.value.map((r) => r.totalPoints), 1))

// --- User Experience Preview (the widget users will see) ---
const previewWinner = ref<'home' | 'away' | null>(null)
const previewFirstToScore = ref<'home' | 'away' | null>(null)
const previewFinishType = ref<FinishType | null>(null)
const previewHomeScore = ref(0)
const previewAwayScore = ref(0)

const previewWantsWinner = ref(false)
const previewWantsFirstToScore = ref(false)
const previewWantsExactScore = ref(false)

const previewHasTouchedScore = ref(false)
const previewJustSaved = ref(false)

const previewScoreLabel = computed(() => {
  if (!previewFinishType.value) return `+${points.correctScore_FT} pts`
  if (previewFinishType.value === 'FT') return `+${points.correctScore_FT} pts`
  if (previewFinishType.value === 'AET') return `+${points.correctScore_AET} pts`
  return `+${points.correctScore_PEN} pts`
})

const previewScoreValid = computed(() => {
  if (!previewHasTouchedScore.value || !previewFinishType.value) return true
  if (previewFinishType.value === 'FT' || previewFinishType.value === 'AET') {
    return previewHomeScore.value !== previewAwayScore.value
  }
  if (previewFinishType.value === 'PEN') {
    return previewHomeScore.value === previewAwayScore.value
  }
  return true
})

const previewCanSubmit = computed(() => {
  if (!previewWantsWinner.value && !previewWantsFirstToScore.value && !previewWantsExactScore.value) return false
  if (previewWantsWinner.value && !previewWinner.value) return false
  if (previewWantsFirstToScore.value && !previewFirstToScore.value) return false
  if (previewWantsExactScore.value && !previewFinishType.value) return false
  if (previewWantsExactScore.value && !previewHasTouchedScore.value) return false
  if (previewWantsExactScore.value && !previewScoreValid.value) return false
  return true
})

const previewAdjScore = (side: 'home' | 'away', delta: number) => {
  previewHasTouchedScore.value = true
  if (side === 'home') previewHomeScore.value = Math.max(0, Math.min(15, previewHomeScore.value + delta))
  else previewAwayScore.value = Math.max(0, Math.min(15, previewAwayScore.value + delta))

  // For PEN: keep scores level
  if (previewFinishType.value === 'PEN') {
    if (side === 'home') previewAwayScore.value = previewHomeScore.value
    else previewHomeScore.value = previewAwayScore.value
  }

  // For FT/AET: auto-derive winner from score
  if (previewWantsWinner.value && (previewFinishType.value === 'FT' || previewFinishType.value === 'AET')) {
    if (previewHomeScore.value > previewAwayScore.value) previewWinner.value = 'home'
    else if (previewAwayScore.value > previewHomeScore.value) previewWinner.value = 'away'
  }
}

const previewPickWinner = (side: 'home' | 'away') => {
  previewWinner.value = side
  // For FT/AET: ensure score reflects the winner
  if (previewWantsExactScore.value && previewHasTouchedScore.value) {
    if (previewFinishType.value === 'FT' || previewFinishType.value === 'AET') {
      if (side === 'home' && previewHomeScore.value <= previewAwayScore.value) {
        previewHomeScore.value = previewAwayScore.value + 1
      } else if (side === 'away' && previewAwayScore.value <= previewHomeScore.value) {
        previewAwayScore.value = previewHomeScore.value + 1
      }
    }
  }
}

const previewPickFinishType = (ft: FinishType) => {
  previewFinishType.value = ft
  if (ft === 'PEN') {
    // PEN: score must be a draw
    const maxScore = Math.max(previewHomeScore.value, previewAwayScore.value)
    previewHomeScore.value = maxScore
    previewAwayScore.value = maxScore
    previewHasTouchedScore.value = true
  } else if (ft === 'AET' || ft === 'FT') {
    // AET/FT: score must not be a draw, enforce if needed
    if (previewHasTouchedScore.value && previewHomeScore.value === previewAwayScore.value) {
      if (previewWinner.value === 'home') {
        previewHomeScore.value = previewAwayScore.value + 1
      } else if (previewWinner.value === 'away') {
        previewAwayScore.value = previewHomeScore.value + 1
      } else {
        previewHomeScore.value = previewAwayScore.value + 1
      }
    }
  }
}

const previewSave = () => {
  previewJustSaved.value = true
  setTimeout(() => { previewJustSaved.value = false }, 3000)
}

const previewReset = () => {
  previewWinner.value = null
  previewFirstToScore.value = null
  previewFinishType.value = null
  previewHomeScore.value = 0
  previewAwayScore.value = 0
  previewWantsWinner.value = false
  previewWantsFirstToScore.value = false
  previewWantsExactScore.value = false
  previewHasTouchedScore.value = false
  previewJustSaved.value = false
}

// --- Popup banner preview ---
const popupVisible = ref(false)
const selectedPopupVariant = ref<'A' | 'B' | 'C'>('A')

const showPopup = (variant: 'A' | 'B' | 'C') => {
  selectedPopupVariant.value = variant
  popupVisible.value = true
}
</script>

<template>
  <div class="min-h-screen bg-gray-950 text-white">
    <!-- Header -->
    <header class="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
      <div class="flex items-center gap-4">
        <NuxtLink to="/admin" class="text-gray-400 hover:text-white transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
        </NuxtLink>
        <h1 class="text-xl font-bold">Knockout Scoring Simulator</h1>
      </div>
      <span class="text-sm text-gray-500">Admin Tool</span>
    </header>

    <div class="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-10">
      <!-- Section 1: Point Configuration -->
      <section>
        <h2 class="text-lg font-semibold text-gray-200 mb-4">Point Values</h2>
        <div class="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div class="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <label class="text-xs text-gray-400 uppercase tracking-wide">Winner</label>
            <input v-model.number="points.winner" type="number" min="0" class="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-lg font-bold text-center focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
          </div>
          <div class="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <label class="text-xs text-gray-400 uppercase tracking-wide">First to Score</label>
            <input v-model.number="points.firstToScore" type="number" min="0" class="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-lg font-bold text-center focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
          </div>
          <div class="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <label class="text-xs text-gray-400 uppercase tracking-wide">Score (FT)</label>
            <input v-model.number="points.correctScore_FT" type="number" min="0" class="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-lg font-bold text-center focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
          </div>
          <div class="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <label class="text-xs text-gray-400 uppercase tracking-wide">Score (AET)</label>
            <input v-model.number="points.correctScore_AET" type="number" min="0" class="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-lg font-bold text-center focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
          </div>
          <div class="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <label class="text-xs text-gray-400 uppercase tracking-wide">Score (PEN)</label>
            <input v-model.number="points.correctScore_PEN" type="number" min="0" class="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-lg font-bold text-center focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
          </div>
        </div>
      </section>

      <!-- Section 2: User Experience Preview -->
      <section>
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-gray-200">User Prediction Widget Preview</h2>
          <button @click="previewReset" class="text-xs text-gray-400 hover:text-white transition-colors underline">Reset</button>
        </div>
        <p class="text-sm text-gray-400 mb-6">This is exactly what users will see on their prediction page for knockout matches.</p>

        <div class="flex justify-center">
          <div class="w-full max-w-md">
            <!-- The actual card widget -->
            <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6">
              <!-- Match header -->
              <div class="flex items-center justify-between mb-4">
                <div class="flex items-center gap-2">
                  <span class="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold bg-gray-100 text-gray-700">Round of 16</span>
                  <span class="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold bg-sky-50 text-sky-700">Locks in 2h 45m</span>
                </div>
              </div>

              <p class="text-xs text-gray-500 mb-4">Sat, Jun 28, 08:00 PM</p>

              <!-- Teams display -->
              <div class="grid grid-cols-3 items-center gap-3 mb-6">
                <div class="text-center">
                  <div class="text-4xl mb-1">{{ homeTeam.flag }}</div>
                  <div class="font-bold text-gray-900 text-sm">{{ homeTeam.name }}</div>
                </div>
                <div class="text-center">
                  <div class="text-xl font-bold text-gray-300">vs</div>
                </div>
                <div class="text-center">
                  <div class="text-4xl mb-1">{{ awayTeam.flag }}</div>
                  <div class="font-bold text-gray-900 text-sm">{{ awayTeam.name }}</div>
                </div>
              </div>

              <div class="space-y-5">
                <!-- Winner section (no draw!) -->
                <div :class="['rounded-2xl p-4 transition', previewWantsWinner ? 'bg-white ring-1 ring-gray-200' : 'bg-gray-50']">
                  <label class="flex items-center justify-between mb-2 cursor-pointer">
                    <span class="flex items-center gap-2">
                      <input type="checkbox" v-model="previewWantsWinner" class="w-4 h-4 rounded accent-sky-600" />
                      <span class="font-bold text-gray-900 text-sm">Winner</span>
                    </span>
                    <span class="text-xs font-semibold text-sky-600">+{{ points.winner }} pts</span>
                  </label>
                  <div :class="['grid grid-cols-2 gap-2 transition-opacity', previewWantsWinner ? '' : 'opacity-40 pointer-events-none']">
                    <button
                      type="button"
                      @click="previewPickWinner('home')"
                      :class="[
                        'rounded-xl border-2 px-3 py-3 text-sm font-bold transition',
                        previewWinner === 'home' && previewWantsWinner ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-gray-200 hover:border-gray-300 text-gray-700',
                      ]"
                    >
                      {{ homeTeam.flag }} {{ homeTeam.code }}
                    </button>
                    <button
                      type="button"
                      @click="previewPickWinner('away')"
                      :class="[
                        'rounded-xl border-2 px-3 py-3 text-sm font-bold transition',
                        previewWinner === 'away' && previewWantsWinner ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-gray-200 hover:border-gray-300 text-gray-700',
                      ]"
                    >
                      {{ awayTeam.flag }} {{ awayTeam.code }}
                    </button>
                  </div>
                  <p v-if="previewWantsWinner && !previewWinner" class="mt-2 text-xs text-gray-400">
                    Someone must advance — pick the winner.
                  </p>
                </div>

                <!-- First to score -->
                <div :class="['rounded-2xl p-4 transition', previewWantsFirstToScore ? 'bg-white ring-1 ring-gray-200' : 'bg-gray-50']">
                  <label class="flex items-center justify-between mb-2 cursor-pointer">
                    <span class="flex items-center gap-2">
                      <input type="checkbox" v-model="previewWantsFirstToScore" class="w-4 h-4 rounded accent-emerald-600" />
                      <span class="font-bold text-gray-900 text-sm">First to score</span>
                    </span>
                    <span class="text-xs font-semibold text-emerald-600">+{{ points.firstToScore }} pts</span>
                  </label>
                  <div :class="['grid grid-cols-2 gap-2 transition-opacity', previewWantsFirstToScore ? '' : 'opacity-40 pointer-events-none']">
                    <button
                      type="button"
                      @click="previewFirstToScore = 'home'"
                      :class="[
                        'rounded-xl border-2 px-3 py-3 text-sm font-bold transition',
                        previewFirstToScore === 'home' && previewWantsFirstToScore ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 hover:border-gray-300 text-gray-700',
                      ]"
                    >
                      {{ homeTeam.flag }} {{ homeTeam.code }}
                    </button>
                    <button
                      type="button"
                      @click="previewFirstToScore = 'away'"
                      :class="[
                        'rounded-xl border-2 px-3 py-3 text-sm font-bold transition',
                        previewFirstToScore === 'away' && previewWantsFirstToScore ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 hover:border-gray-300 text-gray-700',
                      ]"
                    >
                      {{ awayTeam.flag }} {{ awayTeam.code }}
                    </button>
                  </div>
                </div>

                <!-- Exact scoreline - knockout version -->
                <div :class="['rounded-2xl p-4 transition', previewWantsExactScore ? 'bg-white ring-1 ring-gray-200' : 'bg-gray-50']">
                  <label class="flex items-center justify-between mb-2 cursor-pointer">
                    <span class="flex items-center gap-2">
                      <input type="checkbox" v-model="previewWantsExactScore" class="w-4 h-4 rounded accent-amber-600" />
                      <span class="font-bold text-gray-900 text-sm">Exact scoreline</span>
                    </span>
                    <span class="text-xs font-semibold text-amber-600">{{ previewScoreLabel }}</span>
                  </label>

                  <div :class="['transition-opacity', previewWantsExactScore ? '' : 'opacity-40 pointer-events-none']">
                    <!-- Step 1: How does it end? -->
                    <div class="mb-4">
                      <p class="text-xs font-medium text-gray-500 mb-2">How does the match end?</p>
                      <div class="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          @click="previewPickFinishType('FT')"
                          :class="[
                            'rounded-xl border-2 px-2 py-2.5 text-xs font-bold transition text-center',
                            previewFinishType === 'FT' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-200 hover:border-gray-300 text-gray-700',
                          ]"
                        >
                          <span class="block text-lg mb-0.5">90'</span>
                          Full Time
                        </button>
                        <button
                          type="button"
                          @click="previewPickFinishType('AET')"
                          :class="[
                            'rounded-xl border-2 px-2 py-2.5 text-xs font-bold transition text-center',
                            previewFinishType === 'AET' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-200 hover:border-gray-300 text-gray-700',
                          ]"
                        >
                          <span class="block text-lg mb-0.5">120'</span>
                          Extra Time
                        </button>
                        <button
                          type="button"
                          @click="previewPickFinishType('PEN')"
                          :class="[
                            'rounded-xl border-2 px-2 py-2.5 text-xs font-bold transition text-center',
                            previewFinishType === 'PEN' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-200 hover:border-gray-300 text-gray-700',
                          ]"
                        >
                          <span class="block text-lg mb-0.5">PK</span>
                          Penalties
                        </button>
                      </div>
                    </div>

                    <!-- Step 2: Score pickers -->
                    <div v-if="previewFinishType" class="space-y-3">
                      <p class="text-xs font-medium text-gray-500">
                        {{ previewFinishType === 'FT' ? 'Final score at full time:' : previewFinishType === 'AET' ? 'Score after extra time:' : 'Score after extra time (must be a draw):' }}
                      </p>
                      <div class="grid grid-cols-2 gap-3">
                        <div class="rounded-xl bg-gray-50 p-3 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            @click="previewAdjScore('home', -1)"
                            class="w-8 h-8 rounded-lg bg-white text-gray-600 font-bold hover:bg-gray-100 border border-gray-200 text-sm"
                          >-</button>
                          <div class="flex-1 text-center">
                            <div class="text-xs text-gray-500 font-semibold">{{ homeTeam.code }}</div>
                            <div class="text-2xl font-extrabold text-gray-900">{{ previewHasTouchedScore ? previewHomeScore : '-' }}</div>
                          </div>
                          <button
                            type="button"
                            @click="previewAdjScore('home', 1)"
                            class="w-8 h-8 rounded-lg bg-white text-gray-600 font-bold hover:bg-gray-100 border border-gray-200 text-sm"
                          >+</button>
                        </div>
                        <div class="rounded-xl bg-gray-50 p-3 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            @click="previewAdjScore('away', -1)"
                            class="w-8 h-8 rounded-lg bg-white text-gray-600 font-bold hover:bg-gray-100 border border-gray-200 text-sm"
                          >-</button>
                          <div class="flex-1 text-center">
                            <div class="text-xs text-gray-500 font-semibold">{{ awayTeam.code }}</div>
                            <div class="text-2xl font-extrabold text-gray-900">{{ previewHasTouchedScore ? previewAwayScore : '-' }}</div>
                          </div>
                          <button
                            type="button"
                            @click="previewAdjScore('away', 1)"
                            class="w-8 h-8 rounded-lg bg-white text-gray-600 font-bold hover:bg-gray-100 border border-gray-200 text-sm"
                          >+</button>
                        </div>
                      </div>

                      <!-- Constraint hints -->
                      <p v-if="previewFinishType === 'FT' && previewHasTouchedScore && previewHomeScore === previewAwayScore" class="text-xs text-amber-600 flex items-center gap-1.5">
                        <svg class="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/></svg>
                        A Full Time finish means one team wins in 90 minutes. The score can't be level.
                      </p>
                      <p v-if="previewFinishType === 'AET' && previewHasTouchedScore && previewHomeScore === previewAwayScore" class="text-xs text-amber-600 flex items-center gap-1.5">
                        <svg class="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/></svg>
                        Extra Time means a winner is decided in ET. The score after ET can't be level — that's penalties.
                      </p>

                      <!-- PEN: explain that winner = pen winner (no separate picker needed) -->
                      <div v-if="previewFinishType === 'PEN' && previewWantsWinner && previewWinner" class="rounded-lg bg-gray-100 px-3 py-2 mt-1">
                        <p class="text-xs text-gray-600">
                          <span class="font-semibold">{{ previewWinner === 'home' ? homeTeam.name : awayTeam.name }}</span> wins the shootout (same as your winner pick above).
                        </p>
                      </div>
                      <p v-if="previewFinishType === 'PEN' && previewWantsWinner && !previewWinner" class="text-xs text-amber-600 flex items-center gap-1.5">
                        <svg class="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/></svg>
                        Pick a winner above — they'll be the penalty shootout winner.
                      </p>
                      <p v-if="previewFinishType === 'PEN' && !previewWantsWinner" class="text-xs text-amber-600 flex items-center gap-1.5">
                        <svg class="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/></svg>
                        Enable "Winner" above to specify who wins on penalties.
                      </p>
                    </div>

                    <p v-if="!previewFinishType && previewWantsExactScore" class="text-xs text-gray-400 mt-2">
                      First, pick how you think the match ends.
                    </p>
                  </div>
                </div>

                <!-- Tip banner -->
                <div v-if="previewWantsExactScore && previewFinishType" class="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
                  <p class="text-xs text-amber-800">
                    <span class="font-semibold">Bold prediction!</span>
                    {{ previewFinishType === 'FT' ? 'You\'re predicting a decisive result in 90 minutes. The score must have a clear winner.' : previewFinishType === 'AET' ? 'You\'re predicting the match goes to extra time where a winner is decided. Score after ET must have a clear winner.' : 'You\'re predicting the match stays level through extra time and goes to a penalty shootout. Your winner pick determines who wins on pens.' }}
                  </p>
                </div>

                <!-- Submit button -->
                <button
                  @click="previewSave"
                  :disabled="!previewCanSubmit"
                  :class="[
                    'w-full inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[0.98] px-5 py-3',
                    previewCanSubmit
                      ? 'bg-sky-600 text-white hover:bg-sky-700 shadow-lg shadow-sky-600/20'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed',
                  ]"
                >
                  <span v-if="previewJustSaved" class="flex items-center gap-2">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
                    Prediction locked in!
                  </span>
                  <span v-else>Lock in prediction</span>
                </button>

                <p v-if="!previewWantsWinner && !previewWantsFirstToScore && !previewWantsExactScore" class="text-center text-xs text-gray-400">
                  Tick the categories you want to predict, then make your picks.
                </p>
              </div>
            </div>

            <!-- Max points indicator below card -->
            <div class="mt-4 text-center text-sm text-gray-500">
              Max earnable: <span class="text-emerald-400 font-semibold">{{ points.winner + points.firstToScore + points.correctScore_PEN }} pts</span> per knockout match
            </div>
          </div>
        </div>

        <!-- Popup banner preview triggers -->
        <div class="mt-10">
          <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">Landing Popup Preview</h3>
          <p class="text-sm text-gray-500 mb-4">Click a variant to see the full-screen popup users will get when they land on the knockout prediction page.</p>
          <div class="flex flex-wrap gap-3">
            <button
              @click="showPopup('A')"
              class="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-semibold rounded-xl hover:from-amber-600 hover:to-orange-600 transition-all shadow-lg shadow-amber-500/20"
            >
              A: Hype &amp; Points
            </button>
            <button
              @click="showPopup('B')"
              class="px-4 py-2.5 bg-gray-800 text-white text-sm font-semibold rounded-xl hover:bg-gray-700 transition-all border border-gray-700"
            >
              B: Competitive Edge
            </button>
            <button
              @click="showPopup('C')"
              class="px-4 py-2.5 bg-white text-gray-900 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-all border border-gray-200 shadow-sm"
            >
              C: Clean &amp; Minimal
            </button>
          </div>
        </div>
      </section>

      <!-- Section 3: Match Result Setup -->
      <section>
        <h2 class="text-lg font-semibold text-gray-200 mb-4">Match Result (the "truth")</h2>
        <div class="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <!-- Teams -->
          <div class="grid grid-cols-2 gap-6 mb-6">
            <div>
              <label class="text-xs text-gray-400 uppercase">Home Team</label>
              <div class="flex gap-2 mt-2">
                <input v-model="homeTeam.name" placeholder="Name" class="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
                <input v-model="homeTeam.code" placeholder="Code" class="w-16 bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-white text-sm text-center focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
              </div>
            </div>
            <div>
              <label class="text-xs text-gray-400 uppercase">Away Team</label>
              <div class="flex gap-2 mt-2">
                <input v-model="awayTeam.name" placeholder="Name" class="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
                <input v-model="awayTeam.code" placeholder="Code" class="w-16 bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-white text-sm text-center focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
              </div>
            </div>
          </div>

          <!-- Finish type -->
          <div class="mb-6">
            <label class="text-xs text-gray-400 uppercase mb-2 block">How did the match end?</label>
            <div class="flex gap-2">
              <button
                v-for="ft in (['FT', 'AET', 'PEN'] as FinishType[])"
                :key="ft"
                @click="matchResult.finishType = ft"
                :class="[
                  'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                  matchResult.finishType === ft
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                    : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
                ]"
              >
                {{ ft === 'FT' ? 'Full Time (90 min)' : ft === 'AET' ? 'After Extra Time' : 'Penalties' }}
              </button>
            </div>
          </div>

          <!-- Scores -->
          <div class="grid gap-4">
            <!-- FT Score -->
            <div class="flex items-center gap-4">
              <span class="text-sm text-gray-400 w-32">90-min Score:</span>
              <div class="flex items-center gap-2">
                <input v-model.number="matchResult.ftHomeScore" type="number" min="0" max="15" class="w-16 bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-white text-center focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
                <span class="text-gray-500">-</span>
                <input v-model.number="matchResult.ftAwayScore" type="number" min="0" max="15" class="w-16 bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-white text-center focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
              </div>
              <span v-if="matchResult.finishType !== 'FT'" class="text-xs text-amber-400">(must be a draw for ET/PEN)</span>
            </div>

            <!-- AET Score (only for AET/PEN) -->
            <div v-if="matchResult.finishType === 'AET' || matchResult.finishType === 'PEN'" class="flex items-center gap-4">
              <span class="text-sm text-gray-400 w-32">After ET Score:</span>
              <div class="flex items-center gap-2">
                <input v-model.number="matchResult.aetHomeScore" type="number" min="0" max="15" class="w-16 bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-white text-center focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
                <span class="text-gray-500">-</span>
                <input v-model.number="matchResult.aetAwayScore" type="number" min="0" max="15" class="w-16 bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-white text-center focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
              </div>
              <span v-if="matchResult.finishType === 'PEN'" class="text-xs text-amber-400">(must be a draw for pens)</span>
            </div>

            <!-- Pen winner (only for PEN) -->
            <div v-if="matchResult.finishType === 'PEN'" class="flex items-center gap-4">
              <span class="text-sm text-gray-400 w-32">Pen Winner:</span>
              <div class="flex gap-2">
                <button
                  @click="matchResult.penWinnerSide = 'home'"
                  :class="['px-3 py-1.5 rounded-lg text-sm transition-all', matchResult.penWinnerSide === 'home' ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white']"
                >{{ homeTeam.code }}</button>
                <button
                  @click="matchResult.penWinnerSide = 'away'"
                  :class="['px-3 py-1.5 rounded-lg text-sm transition-all', matchResult.penWinnerSide === 'away' ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white']"
                >{{ awayTeam.code }}</button>
              </div>
            </div>

            <!-- First to score -->
            <div class="flex items-center gap-4">
              <span class="text-sm text-gray-400 w-32">First to Score:</span>
              <div class="flex gap-2">
                <button
                  @click="matchResult.firstToScoreSide = 'home'"
                  :class="['px-3 py-1.5 rounded-lg text-sm transition-all', matchResult.firstToScoreSide === 'home' ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white']"
                >{{ homeTeam.code }}</button>
                <button
                  @click="matchResult.firstToScoreSide = 'away'"
                  :class="['px-3 py-1.5 rounded-lg text-sm transition-all', matchResult.firstToScoreSide === 'away' ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white']"
                >{{ awayTeam.code }}</button>
              </div>
            </div>
          </div>

          <!-- Result summary -->
          <div class="mt-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
            <div class="flex items-center gap-3">
              <span class="text-2xl">{{ homeTeam.flag }}</span>
              <span class="text-lg font-bold">{{ homeTeam.code }}</span>
              <span class="text-xl font-mono font-bold text-emerald-400">{{ displayScore }}</span>
              <span class="text-lg font-bold">{{ awayTeam.code }}</span>
              <span class="text-2xl">{{ awayTeam.flag }}</span>
            </div>
            <p class="text-sm text-gray-400 mt-2">
              Winner: <span class="text-white font-medium">{{ actualWinnerId === 'home' ? homeTeam.name : awayTeam.name }}</span>
              | First to score: <span class="text-white font-medium">{{ matchResult.firstToScoreSide === 'home' ? homeTeam.name : awayTeam.name }}</span>
            </p>
          </div>
        </div>
      </section>

      <!-- Section 4: Sample Predictions -->
      <section>
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-gray-200">Sample Predictions</h2>
          <button @click="addPrediction" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-lg transition-colors">
            + Add User
          </button>
        </div>

        <div class="space-y-3">
          <div
            v-for="pred in samplePredictions"
            :key="pred.id"
            class="bg-gray-900 rounded-xl border border-gray-800 p-4"
          >
            <div class="flex flex-wrap items-center gap-3">
              <!-- Label -->
              <input v-model="pred.label" class="w-24 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />

              <!-- Winner pick -->
              <div class="flex items-center gap-1">
                <span class="text-xs text-gray-500 mr-1">Win:</span>
                <button
                  @click="pred.winnerSide = 'home'"
                  :class="['px-2 py-1 rounded text-xs transition-all', pred.winnerSide === 'home' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400']"
                >{{ homeTeam.code }}</button>
                <button
                  @click="pred.winnerSide = 'away'"
                  :class="['px-2 py-1 rounded text-xs transition-all', pred.winnerSide === 'away' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400']"
                >{{ awayTeam.code }}</button>
              </div>

              <!-- First to score -->
              <div class="flex items-center gap-1">
                <span class="text-xs text-gray-500 mr-1">1st:</span>
                <button
                  @click="pred.firstToScoreSide = 'home'"
                  :class="['px-2 py-1 rounded text-xs transition-all', pred.firstToScoreSide === 'home' ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400']"
                >{{ homeTeam.code }}</button>
                <button
                  @click="pred.firstToScoreSide = 'away'"
                  :class="['px-2 py-1 rounded text-xs transition-all', pred.firstToScoreSide === 'away' ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400']"
                >{{ awayTeam.code }}</button>
              </div>

              <!-- Score type -->
              <div class="flex items-center gap-1">
                <span class="text-xs text-gray-500 mr-1">End:</span>
                <button
                  v-for="ft in (['FT', 'AET', 'PEN'] as FinishType[])"
                  :key="ft"
                  @click="pred.scoreType = ft"
                  :class="['px-2 py-1 rounded text-xs transition-all', pred.scoreType === ft ? 'bg-amber-600 text-white' : 'bg-gray-800 text-gray-400']"
                >{{ ft }}</button>
              </div>

              <!-- Score -->
              <div class="flex items-center gap-1">
                <span class="text-xs text-gray-500 mr-1">Score:</span>
                <input v-model.number="pred.homeScore" type="number" min="0" max="15" class="w-10 bg-gray-800 border border-gray-700 rounded px-1 py-1 text-white text-xs text-center" />
                <span class="text-gray-500 text-xs">-</span>
                <input v-model.number="pred.awayScore" type="number" min="0" max="15" class="w-10 bg-gray-800 border border-gray-700 rounded px-1 py-1 text-white text-xs text-center" />
              </div>

              <!-- PEN indicator: winner = pen winner -->
              <span v-if="pred.scoreType === 'PEN'" class="text-xs text-rose-400">({{ pred.winnerSide === 'home' ? homeTeam.code : awayTeam.code }} wins pens)</span>

              <!-- Remove -->
              <button @click="removePrediction(pred.id)" class="ml-auto text-gray-500 hover:text-red-400 transition-colors">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- Section 5: Results -->
      <section>
        <h2 class="text-lg font-semibold text-gray-200 mb-4">Scoring Results</h2>
        <div class="space-y-3">
          <div
            v-for="result in scoredResults"
            :key="result.id"
            class="bg-gray-900 rounded-xl border border-gray-800 p-5"
          >
            <div class="flex items-center justify-between mb-3">
              <span class="font-medium text-white">{{ result.label }}</span>
              <div class="flex items-center gap-3">
                <span class="text-sm text-gray-400">
                  <span class="text-blue-400">{{ result.winnerPoints }}</span> +
                  <span class="text-violet-400">{{ result.firstToScorePoints }}</span> +
                  <span class="text-amber-400">{{ result.scorePoints }}</span>
                </span>
                <span class="text-lg font-bold text-emerald-400">{{ result.totalPoints }} pts</span>
              </div>
            </div>
            <!-- Points bar -->
            <div class="h-2 bg-gray-800 rounded-full overflow-hidden mb-3">
              <div
                class="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                :style="{ width: `${(result.totalPoints / maxPoints) * 100}%` }"
              ></div>
            </div>
            <!-- Breakdown -->
            <div class="space-y-1">
              <p v-for="(line, i) in result.breakdown" :key="i" class="text-xs" :class="line.includes('+') ? 'text-emerald-400' : 'text-gray-500'">
                {{ line }}
              </p>
            </div>
          </div>
        </div>
      </section>

      <!-- Section 6: Rules Summary -->
      <section class="pb-12">
        <h2 class="text-lg font-semibold text-gray-200 mb-4">Knockout Rules Summary</h2>
        <div class="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-4">
          <div class="grid sm:grid-cols-2 gap-6">
            <div>
              <h3 class="text-sm font-medium text-emerald-400 mb-2">How users predict in knockouts:</h3>
              <ul class="text-sm text-gray-300 space-y-1.5 list-disc list-inside">
                <li>Pick a <span class="text-white font-medium">winner</span> (no draw option — whoever advances)</li>
                <li>Pick <span class="text-white font-medium">first to score</span> team</li>
                <li>Choose how they think it ends: <span class="text-white font-medium">FT / Extra Time / Penalties</span></li>
                <li>Predict the <span class="text-white font-medium">scoreline</span> for their chosen finish type</li>
                <li>FT/AET: score must have a clear winner (non-draw)</li>
                <li>PEN: score must be level (draw after ET), winner pick = pen winner</li>
              </ul>
            </div>
            <div>
              <h3 class="text-sm font-medium text-emerald-400 mb-2">How scoring works:</h3>
              <ul class="text-sm text-gray-300 space-y-1.5 list-disc list-inside">
                <li>Winner: {{ points.winner }} pts (whoever advances)</li>
                <li>First to score: {{ points.firstToScore }} pts</li>
                <li>Exact score + correct finish type (FT): {{ points.correctScore_FT }} pts</li>
                <li>Exact score + correct finish type (AET): {{ points.correctScore_AET }} pts</li>
                <li>Exact score + correct finish type + pen winner (PEN): {{ points.correctScore_PEN }} pts</li>
              </ul>
            </div>
          </div>
          <div class="pt-4 border-t border-gray-800">
            <h3 class="text-sm font-medium text-amber-400 mb-2">Key design decisions:</h3>
            <ul class="text-sm text-gray-300 space-y-1.5 list-disc list-inside">
              <li>Scoreline points only awarded if finish type matches (predicted FT but went to AET = no score pts)</li>
              <li>Bolder predictions (AET/PEN) are rewarded with more points since they're harder</li>
              <li>FT/AET score must be non-draw (one team wins outright)</li>
              <li>PEN score must be a draw (level after ET, then pens decide)</li>
              <li>Winner pick = penalty winner (no separate picker, reduces redundancy)</li>
              <li>Max possible per match: {{ points.winner + points.firstToScore + points.correctScore_PEN }} pts (winner + first scorer + pen score)</li>
            </ul>
          </div>
        </div>
      </section>
    </div>

    <!-- Popup overlay -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div v-if="popupVisible" class="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4" @click.self="popupVisible = false">
          <div class="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>

          <!-- Variant A: Hype & Points -->
          <Transition
            enter-active-class="transition duration-400 ease-out delay-100"
            enter-from-class="opacity-0 translate-y-8 scale-95"
            enter-to-class="opacity-100 translate-y-0 scale-100"
            leave-active-class="transition duration-200 ease-in"
            leave-from-class="opacity-100 translate-y-0 scale-100"
            leave-to-class="opacity-0 translate-y-4 scale-95"
          >
            <div v-if="popupVisible && selectedPopupVariant === 'A'" class="relative w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl">
              <!-- Gradient header -->
              <div class="bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 px-6 pt-8 pb-12 text-center relative">
                <div class="absolute top-3 right-3">
                  <button @click="popupVisible = false" class="w-8 h-8 rounded-full bg-white/20 backdrop-blur flex items-center justify-center hover:bg-white/30 transition">
                    <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
                <div class="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm mx-auto mb-4 flex items-center justify-center">
                  <svg class="w-9 h-9 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                </div>
                <h2 class="text-2xl font-extrabold text-white tracking-tight">Knockout Round</h2>
                <p class="text-white/80 text-sm mt-1 font-medium">New rules. Bigger rewards.</p>
              </div>

              <!-- Content -->
              <div class="bg-white px-6 pb-6 -mt-6 rounded-t-3xl relative">
                <div class="pt-6 space-y-4">
                  <p class="text-sm text-gray-600 text-center leading-relaxed">
                    In knockouts, predict <span class="font-semibold text-gray-900">how the match ends</span> for bonus points. The bolder the call, the bigger the reward.
                  </p>

                  <!-- Points ladder -->
                  <div class="rounded-2xl border border-gray-200 overflow-hidden">
                    <div class="grid grid-cols-3 divide-x divide-gray-100">
                      <div class="px-3 py-4 text-center">
                        <div class="text-2xl font-extrabold text-gray-400">{{ points.correctScore_FT }}</div>
                        <div class="text-[10px] font-semibold text-gray-500 uppercase mt-1">Full Time</div>
                        <div class="text-[10px] text-gray-400 mt-0.5">90 min</div>
                      </div>
                      <div class="px-3 py-4 text-center bg-amber-50/60">
                        <div class="text-2xl font-extrabold text-amber-600">{{ points.correctScore_AET }}</div>
                        <div class="text-[10px] font-semibold text-amber-700 uppercase mt-1">Extra Time</div>
                        <div class="text-[10px] text-amber-600/70 mt-0.5">120 min</div>
                      </div>
                      <div class="px-3 py-4 text-center bg-orange-50/60">
                        <div class="text-2xl font-extrabold text-orange-600">{{ points.correctScore_PEN }}</div>
                        <div class="text-[10px] font-semibold text-orange-700 uppercase mt-1">Penalties</div>
                        <div class="text-[10px] text-orange-600/70 mt-0.5">Shootout</div>
                      </div>
                    </div>
                  </div>

                  <p class="text-xs text-gray-500 text-center">Points for getting the exact scoreline correct.</p>

                  <button @click="popupVisible = false" class="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold py-3.5 rounded-xl hover:from-amber-600 hover:to-orange-600 transition-all shadow-lg shadow-orange-500/20 text-sm">
                    Let's go!
                  </button>
                </div>
              </div>
            </div>
          </Transition>

          <!-- Variant B: Competitive Edge -->
          <Transition
            enter-active-class="transition duration-400 ease-out delay-100"
            enter-from-class="opacity-0 translate-y-8 scale-95"
            enter-to-class="opacity-100 translate-y-0 scale-100"
            leave-active-class="transition duration-200 ease-in"
            leave-from-class="opacity-100 translate-y-0 scale-100"
            leave-to-class="opacity-0 translate-y-4 scale-95"
          >
            <div v-if="popupVisible && selectedPopupVariant === 'B'" class="relative w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl bg-gray-900 border border-gray-800">
              <div class="absolute top-3 right-3 z-10">
                <button @click="popupVisible = false" class="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center hover:bg-gray-700 transition">
                  <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>

              <div class="px-6 pt-8 pb-6">
                <!-- Animated trophy -->
                <div class="text-center mb-5">
                  <div class="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 mb-4">
                    <div class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                    <span class="text-xs font-semibold text-emerald-400">KNOCKOUT STAGE</span>
                  </div>
                  <h2 class="text-2xl font-extrabold text-white tracking-tight">The stakes just got higher</h2>
                  <p class="text-gray-400 text-sm mt-2">No more draws. Every match has a winner. Will you predict the path to glory?</p>
                </div>

                <!-- Risk/reward visual -->
                <div class="space-y-2 mb-6">
                  <div class="flex items-center gap-3 rounded-xl bg-gray-800/60 border border-gray-700/50 px-4 py-3">
                    <span class="text-lg">90'</span>
                    <div class="flex-1">
                      <div class="h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div class="h-full bg-gray-400 rounded-full" style="width: 37.5%"></div>
                      </div>
                    </div>
                    <span class="text-sm font-bold text-gray-400">{{ points.correctScore_FT }} pts</span>
                  </div>
                  <div class="flex items-center gap-3 rounded-xl bg-amber-500/5 border border-amber-500/20 px-4 py-3">
                    <span class="text-lg">120'</span>
                    <div class="flex-1">
                      <div class="h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div class="h-full bg-amber-500 rounded-full" style="width: 62.5%"></div>
                      </div>
                    </div>
                    <span class="text-sm font-bold text-amber-400">{{ points.correctScore_AET }} pts</span>
                  </div>
                  <div class="flex items-center gap-3 rounded-xl bg-orange-500/5 border border-orange-500/20 px-4 py-3">
                    <span class="text-lg">PK</span>
                    <div class="flex-1">
                      <div class="h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div class="h-full bg-gradient-to-r from-orange-500 to-rose-500 rounded-full" style="width: 100%"></div>
                      </div>
                    </div>
                    <span class="text-sm font-bold text-orange-400">{{ points.correctScore_PEN }} pts</span>
                  </div>
                </div>

                <button @click="popupVisible = false" class="w-full bg-white text-gray-900 font-bold py-3.5 rounded-xl hover:bg-gray-100 transition-all text-sm">
                  I'm ready
                </button>
              </div>
            </div>
          </Transition>

          <!-- Variant C: Clean & Minimal -->
          <Transition
            enter-active-class="transition duration-400 ease-out delay-100"
            enter-from-class="opacity-0 translate-y-8 scale-95"
            enter-to-class="opacity-100 translate-y-0 scale-100"
            leave-active-class="transition duration-200 ease-in"
            leave-from-class="opacity-100 translate-y-0 scale-100"
            leave-to-class="opacity-0 translate-y-4 scale-95"
          >
            <div v-if="popupVisible && selectedPopupVariant === 'C'" class="relative w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl bg-white">
              <div class="absolute top-3 right-3 z-10">
                <button @click="popupVisible = false" class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition">
                  <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>

              <div class="px-6 pt-10 pb-6 text-center">
                <!-- Simple icon cluster -->
                <div class="flex items-center justify-center gap-2 mb-6">
                  <span class="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500">90'</span>
                  <svg class="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
                  <span class="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-sm font-bold text-amber-600">120'</span>
                  <svg class="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
                  <span class="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-sm font-bold text-orange-600">PK</span>
                </div>

                <h2 class="text-xl font-extrabold text-gray-900">Knockouts are here</h2>
                <p class="text-sm text-gray-500 mt-2 leading-relaxed max-w-xs mx-auto">
                  Now you can predict <span class="font-semibold text-gray-700">how the match ends</span> -- full time, extra time, or penalties. Bolder predictions earn more points.
                </p>

                <!-- Simple point callouts -->
                <div class="flex items-center justify-center gap-6 mt-6 mb-6">
                  <div class="text-center">
                    <div class="text-xs text-gray-400 uppercase font-medium">Safe</div>
                    <div class="text-lg font-extrabold text-gray-500 mt-0.5">{{ points.correctScore_FT }}</div>
                  </div>
                  <div class="w-px h-8 bg-gray-200"></div>
                  <div class="text-center">
                    <div class="text-xs text-amber-600 uppercase font-medium">Bold</div>
                    <div class="text-lg font-extrabold text-amber-600 mt-0.5">{{ points.correctScore_AET }}</div>
                  </div>
                  <div class="w-px h-8 bg-gray-200"></div>
                  <div class="text-center">
                    <div class="text-xs text-orange-600 uppercase font-medium">Bravest</div>
                    <div class="text-lg font-extrabold text-orange-600 mt-0.5">{{ points.correctScore_PEN }}</div>
                  </div>
                </div>

                <button @click="popupVisible = false" class="w-full bg-gray-900 text-white font-bold py-3.5 rounded-xl hover:bg-gray-800 transition-all text-sm">
                  Got it, let me predict
                </button>
                <p class="text-xs text-gray-400 mt-3">You won't see this again.</p>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
