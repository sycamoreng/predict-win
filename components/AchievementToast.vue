<script setup lang="ts">
import type { Achievement } from '~/composables/useAchievements'

const { latestUnshown, dismiss } = useAchievements()
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
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="translate-y-full opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="translate-y-0 opacity-100"
      leave-to-class="translate-y-full opacity-0"
    >
      <div v-if="visible && currentAchievement && !showShare" class="fixed bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-50">
        <div class="bg-white rounded-2xl shadow-xl border border-ink-100 p-5 relative overflow-hidden">
          <div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-500 via-sun-400 to-coral-400"></div>
          <div class="flex items-start gap-4">
            <div class="text-4xl shrink-0 animate-bounce">{{ currentAchievement.icon }}</div>
            <div class="flex-1 min-w-0">
              <div class="text-xs uppercase tracking-wider font-bold text-sky-600 mb-0.5">Achievement Unlocked</div>
              <h4 class="font-extrabold text-ink-900 text-base">{{ currentAchievement.title }}</h4>
              <p class="text-sm text-ink-600 mt-0.5">{{ currentAchievement.description }}</p>
              <div class="flex items-center gap-2 mt-3">
                <button
                  @click="onShare"
                  class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-semibold hover:bg-sky-700 transition"
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
      :title="currentAchievement.title"
      @close="onShareClose"
    />
  </Teleport>
</template>
