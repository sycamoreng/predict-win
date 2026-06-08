<script setup lang="ts">
const { user, isGuest, displayName, loadFromStorage, logout } = useAuth()
const { config: campaign, load: loadCampaign } = useCampaign()
const route = useRoute()
const copiedAccount = ref(false)

onMounted(() => {
  loadFromStorage()
  loadCampaign()
})

const navItems = computed(() => {
  const items = [
    { to: '/predict', label: 'Predict' },
  ]
  if (!isGuest.value) {
    items.push({ to: '/leaderboard', label: 'Leaderboard' })
    items.push({ to: '/team', label: 'My Team' })
  }
  return items
})

const initials = computed(() => {
  if (!user.value) return ''
  const name = displayName.value
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
})

const backedTeamWins = computed(() => (user.value as any)?.backed_team_wins || 0)

const copyAccountNumber = async () => {
  if (!user.value?.account_number) return
  await navigator.clipboard.writeText(user.value.account_number)
  copiedAccount.value = true
  setTimeout(() => (copiedAccount.value = false), 2000)
}

const onLogout = async () => {
  logout()
  await navigateTo('/')
}
</script>

<template>
  <header class="sticky top-0 z-30 bg-white/85 backdrop-blur border-b border-ink-100">
    <div class="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
      <NuxtLink to="/" class="flex items-center gap-2.5 group">
        <img src="/Group.png" alt="Sycamore" class="h-8 w-8" />
        <div class="leading-tight">
          <div class="font-extrabold text-ink-900 tracking-tight text-sm">Predictor League</div>
          <div class="text-[10px] uppercase tracking-widest text-ink-400 font-semibold">Sycamore</div>
        </div>
      </NuxtLink>

      <nav v-if="user" class="hidden md:flex items-center gap-1">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="px-4 py-2 rounded-xl text-sm font-semibold transition"
          :class="route.path.startsWith(item.to) ? 'bg-sky-50 text-sky-700' : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900'"
        >
          {{ item.label }}
        </NuxtLink>
      </nav>

      <div v-if="user" class="flex items-center gap-3">
        <!-- Backed team badge -->
        <NuxtLink
          v-if="user.backed_team && !isGuest"
          to="/team"
          class="hidden sm:flex items-center gap-2 pill bg-sky-50 text-sky-700 hover:bg-sky-100 transition"
        >
          <span class="text-base leading-none">{{ user.backed_team.flag_emoji }}</span>
          <span class="font-semibold text-xs">{{ user.backed_team.code }}</span>
          <span class="text-[10px] text-sky-500 font-bold">{{ backedTeamWins }}W</span>
        </NuxtLink>

        <!-- Guest badge -->
        <span v-if="isGuest" class="hidden sm:flex items-center gap-1.5 pill bg-sun-50 text-sun-700 text-xs">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          Guest
        </span>

        <div v-if="!isGuest" class="hidden sm:flex items-center gap-2 pill bg-mint-50 text-mint-700">
          <span class="w-1.5 h-1.5 rounded-full bg-mint-500"></span>
          {{ user.total_points }} pts
        </div>
        <div class="relative group">
          <button class="w-9 h-9 rounded-full bg-gradient-to-br from-coral-400 to-sun-400 text-white font-bold text-sm grid place-items-center hover:scale-105 transition">
            {{ initials }}
          </button>
          <div class="absolute right-0 pt-3 w-56 invisible opacity-0 group-hover:visible group-hover:opacity-100 transition">
          <div class="card p-2">
            <div class="px-3 py-2 border-b border-ink-100">
              <div class="font-semibold text-sm text-ink-900 truncate capitalize">{{ displayName }}</div>
              <div class="text-xs text-ink-500 truncate">{{ user.email }}</div>
              <div v-if="isGuest" class="mt-1 text-[10px] text-sun-600 font-semibold uppercase">Guest account</div>
            </div>
            <div v-if="user.account_number && !isGuest" class="px-3 py-2 border-b border-ink-100">
              <div class="text-[10px] text-ink-400 font-semibold uppercase tracking-wider">Sycamore MFB</div>
              <div class="flex items-center gap-2 mt-0.5">
                <span class="font-mono text-sm font-bold text-ink-900">{{ user.account_number }}</span>
                <button @click.stop="copyAccountNumber" class="text-sky-600 hover:text-sky-700 transition" title="Copy account number">
                  <svg v-if="!copiedAccount" class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                  <svg v-else class="w-3.5 h-3.5 text-mint-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                </button>
              </div>
            </div>
            <div v-if="user.backed_team && !isGuest" class="px-3 py-2 border-b border-ink-100 flex items-center gap-2">
              <span>{{ user.backed_team.flag_emoji }}</span>
              <span class="text-sm text-ink-700 font-medium">{{ user.backed_team.name }}</span>
              <span class="ml-auto text-xs text-sky-600 font-bold">{{ backedTeamWins }} {{ backedTeamWins === 1 ? 'win' : 'wins' }}</span>
            </div>
            <NuxtLink v-if="!isGuest" to="/team" class="block px-3 py-2 text-sm rounded-lg hover:bg-ink-50 text-ink-700">My Team</NuxtLink>
            <a v-if="isGuest" href="https://sycamore.ng" target="_blank" rel="noreferrer" class="block px-3 py-2 text-sm rounded-lg hover:bg-sky-50 text-sky-700">
              Get Sycamore App
            </a>
            <button @click="onLogout" class="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-coral-50 text-coral-700">
              Sign out
            </button>
          </div>
          </div>
        </div>
      </div>
      <div v-else>
        <NuxtLink to="/login" class="inline-flex items-center justify-center rounded-full bg-ink-900 text-white font-bold text-sm px-5 py-2.5 hover:bg-ink-800 transition">Sign in</NuxtLink>
      </div>
    </div>

    <nav v-if="user" class="md:hidden border-t border-ink-100">
      <div class="max-w-6xl mx-auto px-2 flex">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="flex-1 text-center py-3 text-sm font-semibold transition border-b-2"
          :class="route.path.startsWith(item.to) ? 'border-sky-500 text-sky-700' : 'border-transparent text-ink-500'"
        >
          {{ item.label }}
        </NuxtLink>
      </div>
    </nav>
  </header>
</template>
