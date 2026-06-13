<script setup lang="ts">
const props = defineProps<{
  username: string
  totalPoints: number
  predictionsCount: number
  correctPredictions: number
  exactScorelines: number
  rank?: number
  backedTeam?: { name: string; flag_emoji: string; code: string } | null
}>()

const accuracy = computed(() => {
  if (props.predictionsCount === 0) return 0
  return Math.round((props.correctPredictions / props.predictionsCount) * 100)
})
</script>

<template>
  <div class="share-image-card w-[540px] h-[540px] relative overflow-hidden flex flex-col bg-ink-900 p-0">
    <!-- Background pattern -->
    <div class="absolute inset-0 overflow-hidden">
      <div class="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-sky-700/20 blur-3xl"></div>
      <div class="absolute -bottom-20 -left-20 w-72 h-72 rounded-full bg-mint-600/15 blur-3xl"></div>
      <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-sky-500/5 blur-2xl"></div>
      <!-- Grid pattern overlay -->
      <div class="absolute inset-0 opacity-[0.03]" style="background-image: linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px); background-size: 40px 40px;"></div>
    </div>

    <!-- Content -->
    <div class="relative flex flex-col flex-1 p-10">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <img src="/logo-white.png" alt="Sycamore" class="h-7 opacity-90" />
        <div class="text-xs font-semibold text-sky-300/70 uppercase tracking-wider">Predictor League</div>
      </div>

      <!-- Username + rank -->
      <div class="mt-8">
        <div class="text-sky-400 text-sm font-bold uppercase tracking-wider mb-1">@{{ username }}</div>
        <div v-if="rank" class="flex items-center gap-2">
          <span class="text-white text-2xl font-extrabold">#{{ rank }}</span>
          <span class="text-ink-400 text-sm font-medium">on the leaderboard</span>
        </div>
      </div>

      <!-- Stats grid -->
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

      <!-- Backed team -->
      <div v-if="backedTeam" class="mt-5 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-white/5 border border-white/10 self-start">
        <span class="text-2xl">{{ backedTeam.flag_emoji }}</span>
        <span class="text-sm text-ink-300 font-medium">Backing <span class="text-white font-bold">{{ backedTeam.name }}</span></span>
      </div>

      <!-- Footer CTA -->
      <div class="mt-auto pt-6 flex items-center justify-between">
        <div class="text-ink-500 text-xs font-medium">play.sycamore.ng</div>
        <div class="text-xs font-bold text-sky-400/80 px-3 py-1.5 rounded-full bg-sky-400/10">Can you beat me?</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.share-image-card {
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
}
</style>
