<script setup lang="ts">
import confetti from 'canvas-confetti'

const props = defineProps<{
  champion: { id?: string; username?: string; name?: string; total_points: number } | null
  label: string
  currentUserId?: string | null
}>()

const showShareModal = ref(false)
const hasLaunched = ref(false)

const displayName = computed(() => {
  if (!props.champion) return ''
  return props.champion.username || (props.champion.name || '').split(' ')[0] || 'Champion'
})

const isCurrentUserChampion = computed(() => {
  if (!props.champion || !props.currentUserId) return false
  return props.champion.id === props.currentUserId
})

const shareText = computed(() => {
  return `I won the Sycamore Predictor League! ${props.label} with ${props.champion?.total_points} points.`
})

const shareImageProps = computed(() => ({
  variant: 'champion' as const,
  username: displayName.value,
  championPoints: props.champion?.total_points,
  championLabel: props.label,
}))

const launchConfetti = () => {
  if (hasLaunched.value) return
  hasLaunched.value = true

  const duration = 3000
  const end = Date.now() + duration

  const frame = () => {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.7 },
      colors: ['#ffc448', '#3aa1f5', '#1eb781', '#fb5a45'],
    })
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.7 },
      colors: ['#ffc448', '#3aa1f5', '#1eb781', '#fb5a45'],
    })
    if (Date.now() < end) requestAnimationFrame(frame)
  }
  frame()

  setTimeout(() => {
    confetti({
      particleCount: 100,
      spread: 100,
      origin: { y: 0.6 },
      colors: ['#ffc448', '#3aa1f5', '#1eb781', '#ffffff'],
    })
  }, 500)
}

onMounted(() => {
  if (props.champion) {
    setTimeout(launchConfetti, 400)
  }
})
</script>

<template>
  <div v-if="champion" class="relative rounded-3xl overflow-hidden bg-gradient-to-br from-sun-100 via-white to-sky-100 border border-sun-200 p-6 sm:p-10 text-center animate-fade-up">
    <div class="absolute inset-0 pointer-events-none overflow-hidden">
      <div class="absolute -top-16 -left-16 w-48 h-48 rounded-full bg-sun-200/40 blur-2xl"></div>
      <div class="absolute -bottom-16 -right-16 w-48 h-48 rounded-full bg-sky-200/40 blur-2xl"></div>
    </div>

    <div class="relative">
      <div class="text-5xl sm:text-6xl mb-4">&#127942;</div>
      <div class="text-xs uppercase tracking-widest font-bold text-sun-700 mb-2">{{ label }}</div>
      <h2 class="text-2xl sm:text-3xl font-extrabold text-ink-900 lowercase">{{ displayName }}</h2>
      <div class="mt-3 inline-flex items-center gap-2 pill bg-sun-200/70 text-sun-800 text-base px-5 py-2">
        <span class="font-extrabold">{{ champion.total_points }}</span>
        <span class="font-semibold">points</span>
      </div>
      <p class="mt-4 text-sm text-ink-500 max-w-sm mx-auto">
        The tournament is over. Congratulations to our champion!
      </p>

      <button
        v-if="isCurrentUserChampion"
        @click="showShareModal = true"
        class="mt-5 btn-primary py-3 px-6 text-sm"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
        Share your victory
      </button>
    </div>

    <ShareModal
      v-if="showShareModal"
      :text="shareText"
      title="Champion"
      :image-card-props="shareImageProps"
      @close="showShareModal = false"
    />
  </div>
</template>
