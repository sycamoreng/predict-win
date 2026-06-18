<script setup lang="ts">
const props = defineProps<{
  variant: 'stats' | 'prediction' | 'rank' | 'achievement'
  username?: string
  // Stats variant
  totalPoints?: number
  predictionsCount?: number
  correctPredictions?: number
  exactScorelines?: number
  rank?: number
  backedTeam?: { name: string; flag_emoji: string; code: string } | null
  // Prediction variant
  homeTeam?: { name: string; code: string; flag_emoji: string }
  awayTeam?: { name: string; code: string; flag_emoji: string }
  predictedScore?: { home: number; away: number }
  predictedWinner?: string
  // Achievement variant
  achievementTitle?: string
  achievementIcon?: string
  achievementDescription?: string
  // Rank variant
  rankPosition?: number
  rankPoints?: number
  rankLabel?: string
}>()

const accuracy = computed(() => {
  if (!props.predictionsCount || props.predictionsCount === 0) return 0
  return Math.round(((props.correctPredictions || 0) / props.predictionsCount) * 100)
})

const winnerLabel = computed(() => {
  if (!props.predictedWinner || !props.homeTeam || !props.awayTeam) return ''
  if (props.predictedWinner === 'draw') return 'Draw'
  if (props.predictedWinner === props.homeTeam.code || props.predictedWinner === props.homeTeam.name) return props.homeTeam.name
  return props.awayTeam.name
})
</script>

<template>
  <div class="share-image-card w-[540px] h-[540px] relative overflow-hidden flex flex-col bg-ink-900 p-0">
    <!-- Background pattern -->
    <div class="absolute inset-0 overflow-hidden">
      <div class="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-sky-700/20 blur-3xl"></div>
      <div class="absolute -bottom-20 -left-20 w-72 h-72 rounded-full bg-mint-600/15 blur-3xl"></div>
      <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-sky-500/5 blur-2xl"></div>
      <div class="absolute inset-0 opacity-[0.03]" style="background-image: linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px); background-size: 40px 40px;"></div>
    </div>

    <!-- Content -->
    <div class="relative flex flex-col flex-1 p-10">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <img src="/logo-white.png" alt="Sycamore" class="h-7 opacity-90" />
        <div class="text-xs font-semibold text-sky-300/70 uppercase tracking-wider">Predictor League</div>
      </div>

      <!-- STATS variant -->
      <template v-if="variant === 'stats'">
        <div class="mt-8">
          <div class="text-sky-400 text-sm font-bold uppercase tracking-wider mb-1">@{{ username }}</div>
          <div v-if="rank" class="flex items-center gap-2">
            <span class="text-white text-2xl font-extrabold">#{{ rank }}</span>
            <span class="text-ink-400 text-sm font-medium">on the leaderboard</span>
          </div>
        </div>

        <div class="mt-8 grid grid-cols-2 gap-5 flex-1">
          <div class="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col justify-center">
            <div class="text-4xl font-extrabold text-white leading-none">{{ totalPoints }}</div>
            <div class="text-xs font-bold text-sky-300 uppercase tracking-wider mt-2">Total Points</div>
          </div>
          <div class="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col justify-center">
            <div class="text-4xl font-extrabold text-white leading-none">{{ accuracy }}<span class="text-xl text-sky-300">%</span></div>
            <div class="text-xs font-bold text-sky-300 uppercase tracking-wider mt-2">Accuracy</div>
          </div>
          <div class="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col justify-center">
            <div class="text-4xl font-extrabold text-white leading-none">{{ correctPredictions }}<span class="text-xl text-ink-400">/{{ predictionsCount }}</span></div>
            <div class="text-xs font-bold text-sky-300 uppercase tracking-wider mt-2">Correct</div>
          </div>
          <div class="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col justify-center">
            <div class="text-4xl font-extrabold text-white leading-none">{{ exactScorelines }}</div>
            <div class="text-xs font-bold text-sky-300 uppercase tracking-wider mt-2">Exact Scores</div>
          </div>
        </div>

        <div v-if="backedTeam" class="mt-5 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-white/5 border border-white/10 self-start">
          <span class="text-2xl">{{ backedTeam.flag_emoji }}</span>
          <span class="text-sm text-ink-300 font-medium">Backing <span class="text-white font-bold">{{ backedTeam.name }}</span></span>
        </div>
      </template>

      <!-- PREDICTION variant -->
      <template v-if="variant === 'prediction'">
        <div class="mt-6">
          <div class="text-sky-400 text-sm font-bold uppercase tracking-wider mb-1">@{{ username }}</div>
          <div class="text-white text-lg font-extrabold">My Prediction</div>
        </div>

        <div class="mt-8 flex-1 flex flex-col items-center justify-center">
          <div class="flex items-center gap-8 mb-8">
            <div class="text-center">
              <div class="text-6xl mb-2">{{ homeTeam?.flag_emoji }}</div>
              <div class="text-white font-bold text-lg">{{ homeTeam?.code }}</div>
            </div>
            <div class="text-center">
              <div v-if="predictedScore" class="text-5xl font-extrabold text-white tracking-wider">
                {{ predictedScore.home }} <span class="text-ink-500">-</span> {{ predictedScore.away }}
              </div>
              <div v-else class="text-3xl font-bold text-ink-500">vs</div>
            </div>
            <div class="text-center">
              <div class="text-6xl mb-2">{{ awayTeam?.flag_emoji }}</div>
              <div class="text-white font-bold text-lg">{{ awayTeam?.code }}</div>
            </div>
          </div>

          <div v-if="predictedWinner" class="bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-center">
            <div class="text-xs font-bold text-sky-300 uppercase tracking-wider mb-1">I'm calling</div>
            <div class="text-xl font-extrabold text-white">{{ predictedWinner === 'draw' ? 'A Draw' : winnerLabel + ' to win' }}</div>
          </div>
        </div>
      </template>

      <!-- RANK variant -->
      <template v-if="variant === 'rank'">
        <div class="mt-6">
          <div class="text-sky-400 text-sm font-bold uppercase tracking-wider mb-1">@{{ username }}</div>
        </div>

        <div class="mt-auto mb-auto flex flex-col items-center justify-center text-center">
          <div class="bg-white/5 border border-white/10 rounded-3xl px-12 py-10">
            <div class="text-7xl font-extrabold text-white leading-none mb-3">#{{ rankPosition }}</div>
            <div class="text-xs font-bold text-sky-300 uppercase tracking-wider">{{ rankLabel || 'on the leaderboard' }}</div>
            <div class="mt-4 text-3xl font-extrabold text-sun-400">{{ rankPoints }} <span class="text-lg text-ink-400">pts</span></div>
          </div>
        </div>
      </template>

      <!-- ACHIEVEMENT variant -->
      <template v-if="variant === 'achievement'">
        <div class="mt-6">
          <div class="text-sky-400 text-sm font-bold uppercase tracking-wider mb-1">@{{ username }}</div>
        </div>

        <div class="mt-auto mb-auto flex flex-col items-center justify-center text-center">
          <div class="bg-white/5 border border-white/10 rounded-3xl px-12 py-10 max-w-[420px]">
            <div class="text-7xl mb-4">{{ achievementIcon }}</div>
            <div class="text-xs font-bold text-sky-300 uppercase tracking-wider mb-2">Achievement Unlocked</div>
            <div class="text-2xl font-extrabold text-white leading-tight">{{ achievementTitle }}</div>
            <div v-if="achievementDescription" class="text-sm text-ink-300 mt-2 leading-relaxed">{{ achievementDescription }}</div>
          </div>
        </div>
      </template>

      <!-- Footer CTA -->
      <div class="mt-auto pt-6 flex items-center justify-between">
        <div class="text-ink-500 text-xs font-medium">play.sycamore.ng</div>
        <div class="text-xs font-bold text-sky-400/80 px-3 py-1.5 rounded-full bg-sky-400/10">
          {{ variant === 'prediction' ? 'Think you know better?' : 'Can you beat me?' }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.share-image-card {
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
}
</style>
