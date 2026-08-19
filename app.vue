<script setup lang="ts">
const route = useRoute()
const isAdminRoute = computed(() => route.path.startsWith('/admin') || route.path === '/simulator')
const isFullscreenRoute = computed(() => route.path === '/login')
const isLandingRoute = computed(() => route.path === '/')
</script>

<template>
  <div v-if="isAdminRoute">
    <NuxtPage />
  </div>
  <div v-else-if="isFullscreenRoute" class="min-h-screen bg-white">
    <NuxtPage />
  </div>
  <div v-else-if="isLandingRoute" class="min-h-screen bg-ink-50">
    <AppHeader />
    <main>
      <NuxtPage />
    </main>
    <footer class="py-8 text-center text-xs text-ink-400">
      <p>Predictor League is part of the Sycamore Predict &amp; Win campaign.</p>
      <p class="mt-1">Eligibility is based on Sycamore customer activity, not skill or chance.</p>
      <div class="mt-3 flex items-center justify-center gap-4">
        <NuxtLink to="/faq" class="text-ink-500 hover:text-ink-700 font-medium transition">FAQs</NuxtLink>
        <span class="text-ink-200">|</span>
        <NuxtLink to="/terms" class="text-ink-500 hover:text-ink-700 font-medium transition">Terms &amp; Conditions</NuxtLink>
      </div>
    </footer>
  </div>
  <div v-else class="min-h-screen bg-ink-50">
    <AppHeader />
    <main class="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <NuxtPage />
    </main>
    <footer class="mt-16 py-8 text-center text-xs text-ink-400">
      <p>Predictor League is part of the Sycamore Predict &amp; Win campaign.</p>
      <p class="mt-1">Eligibility is based on Sycamore customer activity, not skill or chance.</p>
      <div class="mt-3 flex items-center justify-center gap-4">
        <NuxtLink to="/faq" class="text-ink-500 hover:text-ink-700 font-medium transition">FAQs</NuxtLink>
        <span class="text-ink-200">|</span>
        <NuxtLink to="/terms" class="text-ink-500 hover:text-ink-700 font-medium transition">Terms &amp; Conditions</NuxtLink>
      </div>
    </footer>
    <AchievementToast />
  </div>
</template>
