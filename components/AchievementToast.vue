<script setup lang="ts">
import type { Achievement } from '~/composables/useAchievements'

const { latestUnshown, dismiss } = useAchievements()
const { user } = useAuth()
const showShare = ref(false)
const currentAchievement = ref<Achievement | null>(null)
const visible = ref(false)

watch(latestUnshown, (a) => {
  if (a && !currentAchievement.value) {
    currentAchievement.value = a
    setTimeout(() => (visible.value = true), 600)
  }
}, { immediate: true })

const onDismiss = () => {
  if (currentAchievement.value) {
    dismiss(currentAchievement.value.id)
  }
  visible.value = false
  currentAchievement.value = null
}

const onShare = () => {
  showShare.value = true
}

const onShareClose = () => {
  showShare.value = false
  onDismiss()
}

type Tier = NonNullable<Achievement['tier']>
const tierThemes: Record<Tier, { label: string; bar: string; ring: string; glow: string; chip: string; btn: string }> = {
  bronze: {
    label: 'Bronze unlocked',
    bar: 'from-amber-600 via-amber-400 to-orange-400',
    ring: 'ring-amber-200 bg-amber-50',
    glow: 'bg-amber-300/30',
    chip: 'text-amber-700',
    btn: 'bg-amber-600 hover:bg-amber-700',
  },
  silver: {
    label: 'Silver unlocked',
    bar: 'from-slate-400 via-slate-300 to-sky-300',
    ring: 'ring-slate-200 bg-slate-50',
    glow: 'bg-sky-300/30',
    chip: 'text-slate-600',
    btn: 'bg-sky-600 hover:bg-sky-700',
  },
  gold: {
    label: 'Gold unlocked',
    bar: 'from-yellow-500 via-sun-400 to-amber-300',
    ring: 'ring-sun-200 bg-sun-50',
    glow: 'bg-sun-300/40',
    chip: 'text-amber-600',
    btn: 'bg-amber-500 hover:bg-amber-600',
  },
  legend: {
    label: 'Legendary',
    bar: 'from-emerald-600 via-emerald-400 to-sun-400',
    ring: 'ring-emerald-200 bg-emerald-50',
    glow: 'bg-emerald-300/40',
    chip: 'text-emerald-700',
    btn: 'bg-emerald-600 hover:bg-emerald-700',
  },
}
const theme = computed(() => tierThemes[currentAchievement.value?.tier || 'silver'])

const achievementImageProps = computed(() => {
  if (!currentAchievement.value) return undefined
  return {
    variant: 'achievement' as const,
    username: user.value?.username || user.value?.email?.split('@')[0] || 'player',
    achievementTitle: currentAchievement.value.title,
    achievementIcon: currentAchievement.value.icon,
    achievementDescription: currentAchievement.value.description,
    achievementTier: currentAchievement.value.tier || 'silver',
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-500 ease-out"
      enter-from-class="translate-y-8 opacity-0 scale-95"
      enter-to-class="translate-y-0 opacity-100 scale-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="translate-y-0 opacity-100"
      leave-to-class="translate-y-8 opacity-0"
    >
      <div v-if="visible && currentAchievement && !showShare" class="fixed bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-50">
        <div class="bg-white rounded-2xl shadow-2xl border border-ink-100 p-5 relative overflow-hidden">
          <div class="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r" :class="theme.bar"></div>
          <div class="absolute -top-10 -right-8 w-28 h-28 rounded-full blur-2xl" :class="theme.glow"></div>
          <div class="flex items-start gap-4 relative">
            <div class="relative shrink-0">
              <div class="w-14 h-14 rounded-2xl ring-2 flex items-center justify-center text-3xl animate-bounce" :class="theme.ring">
                {{ currentAchievement.icon }}
              </div>
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-[11px] uppercase tracking-widest font-black mb-0.5" :class="theme.chip">
                {{ theme.label }}
              </div>
              <h4 class="font-black text-ink-900 text-base leading-tight">{{ currentAchievement.title }}</h4>
              <p class="text-sm text-ink-600 mt-1 leading-snug">{{ currentAchievement.description }}</p>
              <div class="flex items-center gap-2 mt-3">
                <button
                  @click="onShare"
                  class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-semibold transition"
                  :class="theme.btn"
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                  Share
                </button>
                <button
                  @click="onDismiss"
                  class="px-3 py-1.5 rounded-lg text-xs font-semibold text-ink-500 hover:bg-ink-100 transition"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <ShareModal
      v-if="showShare && currentAchievement"
      :text="currentAchievement.shareText"
      :image-card-props="achievementImageProps"
      :title="currentAchievement.title"
      @close="onShareClose"
    />
  </Teleport>
</template>
