<script setup lang="ts">
const props = defineProps<{
  totalPoints: number
  predictionsCount: number
  correctPredictions: number
  exactScorelines: number
  backedTeam?: { name: string; flag_emoji: string; code: string } | null
}>()

const { shareToTwitter, shareToWhatsApp, shareToThreads, copyToClipboard, siteUrl } = useShare()

const showShare = ref(false)
const copied = ref(false)

const accuracy = computed(() => {
  if (props.predictionsCount === 0) return 0
  return Math.round((props.correctPredictions / props.predictionsCount) * 100)
})

const shareText = computed(() => {
  const lines: string[] = []
  lines.push(`My Sycamore Predictor League Stats:`)
  lines.push('')
  lines.push(`${props.totalPoints} points`)
  lines.push(`${props.correctPredictions}/${props.predictionsCount} correct (${accuracy.value}% accuracy)`)
  lines.push(`${props.exactScorelines} exact scoreline${props.exactScorelines === 1 ? '' : 's'}`)
  if (props.backedTeam) {
    lines.push(`Backing ${props.backedTeam.flag_emoji} ${props.backedTeam.name}`)
  }
  lines.push('')
  lines.push('Can you beat me? Join the Predictor League!')
  lines.push('#SycamorePredictor #WorldCup2026')
  return lines.join('\n')
})

const doCopy = async () => {
  await copyToClipboard({ text: shareText.value, url: siteUrl })
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}
</script>

<template>
  <div class="card p-5 sm:p-6 bg-gradient-to-br from-ink-900 via-ink-800 to-sky-900 text-white relative overflow-hidden">
    <div class="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-sky-500/10"></div>
    <div class="absolute -bottom-10 -left-10 w-32 h-32 rounded-full bg-sun-500/10"></div>

    <div class="relative">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-extrabold text-sm uppercase tracking-wider text-sky-300">Your Stats</h3>
        <button
          @click="showShare = true"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
          Share stats
        </button>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <div class="text-3xl font-extrabold text-white">{{ totalPoints }}</div>
          <div class="text-xs text-sky-300 font-semibold uppercase tracking-wider mt-0.5">Points</div>
        </div>
        <div>
          <div class="text-3xl font-extrabold text-white">{{ accuracy }}<span class="text-lg">%</span></div>
          <div class="text-xs text-sky-300 font-semibold uppercase tracking-wider mt-0.5">Accuracy</div>
        </div>
        <div>
          <div class="text-3xl font-extrabold text-white">{{ correctPredictions }}</div>
          <div class="text-xs text-sky-300 font-semibold uppercase tracking-wider mt-0.5">Correct</div>
        </div>
        <div>
          <div class="text-3xl font-extrabold text-white">{{ exactScorelines }}</div>
          <div class="text-xs text-sky-300 font-semibold uppercase tracking-wider mt-0.5">Exact scores</div>
        </div>
      </div>

      <div v-if="backedTeam" class="mt-4 flex items-center gap-2 text-sm text-sky-200">
        <span class="text-lg">{{ backedTeam.flag_emoji }}</span>
        <span>Backing <strong class="text-white">{{ backedTeam.name }}</strong></span>
      </div>
    </div>

    <ShareModal
      v-if="showShare"
      :text="shareText"
      title="My Predictor League Stats"
      @close="showShare = false"
    />
  </div>
</template>
