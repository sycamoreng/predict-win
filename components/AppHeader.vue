<script setup lang="ts">
const { user, isGuest, displayName, loadFromStorage, logout } = useAuth()
const { config: campaign, load: loadCampaign } = useCampaign()
const supabase = useSupabase()
const route = useRoute()
const copiedAccount = ref(false)

// Notifications
const notifications = ref<Array<{ id: string; type: string; title: string; body: string | null; metadata: any; read: boolean; created_at: string }>>([])
const showNotifications = ref(false)
const unreadCount = computed(() => notifications.value.filter((n) => !n.read).length)

const loadNotifications = async () => {
  if (!user.value) return
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.value.id)
    .order('created_at', { ascending: false })
    .limit(20)
  notifications.value = data || []
}

const markAllRead = async () => {
  if (!user.value || !unreadCount.value) return
  const unreadIds = notifications.value.filter((n) => !n.read).map((n) => n.id)
  await supabase
    .from('notifications')
    .update({ read: true })
    .in('id', unreadIds)
  notifications.value.forEach((n) => (n.read = true))
}

const toggleNotifications = () => {
  showNotifications.value = !showNotifications.value
  if (showNotifications.value) loadNotifications()
}

const closeNotifications = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  if (!target.closest('.notif-panel')) {
    showNotifications.value = false
  }
}

onMounted(() => {
  loadFromStorage()
  loadCampaign()
  document.addEventListener('click', closeNotifications)
})

onUnmounted(() => {
  document.removeEventListener('click', closeNotifications)
})

watch(user, (u) => {
  if (u) loadNotifications()
}, { immediate: true })

const timeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

const navItems = computed(() => {
  const items = [
    { to: '/team', label: 'My Team' },
    { to: '/predict', label: 'Predict' },
  ]
  if (!isGuest.value) {
    items.push({ to: '/leaderboard', label: 'Leaderboard' })
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

const backedTeamWins = computed(() => user.value?.backed_team_wins || 0)

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
        <img src="/logo.png" alt="Sycamore" class="h-8 w-auto" />
      </NuxtLink>

      <ClientOnly>
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

        <!-- Notification bell -->
        <div class="relative notif-panel">
          <button @click="toggleNotifications" class="relative w-9 h-9 rounded-full hover:bg-ink-100 grid place-items-center transition">
            <svg class="w-5 h-5 text-ink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
            <span v-if="unreadCount > 0" class="absolute top-1 right-1 w-4 h-4 bg-coral-500 text-white text-[10px] font-bold rounded-full grid place-items-center">
              {{ unreadCount > 9 ? '9+' : unreadCount }}
            </span>
          </button>

          <!-- Notification dropdown -->
          <div v-if="showNotifications" class="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto card shadow-xl z-50">
            <div class="sticky top-0 bg-white px-4 py-3 border-b border-ink-100 flex items-center justify-between">
              <h3 class="font-bold text-sm text-ink-900">Notifications</h3>
              <button v-if="unreadCount > 0" @click="markAllRead" class="text-xs text-sky-600 hover:text-sky-700 font-semibold">
                Mark all read
              </button>
            </div>
            <div v-if="!notifications.length" class="px-4 py-8 text-center text-sm text-ink-400">
              No notifications yet
            </div>
            <div v-else>
              <div
                v-for="n in notifications"
                :key="n.id"
                :class="['px-4 py-3 border-b border-ink-50 last:border-0 transition', n.read ? 'bg-white' : 'bg-sky-50/50']"
              >
                <div class="flex items-start gap-2.5">
                  <div :class="['w-8 h-8 rounded-lg grid place-items-center shrink-0 mt-0.5', n.type === 'prediction_correct' ? 'bg-mint-100' : n.type === 'team_won' ? 'bg-sky-100' : 'bg-ink-100']">
                    <svg v-if="n.type === 'prediction_correct'" class="w-4 h-4 text-mint-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                    <svg v-else-if="n.type === 'team_won'" class="w-4 h-4 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>
                    <svg v-else class="w-4 h-4 text-ink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="text-sm font-semibold text-ink-900 leading-tight">{{ n.title }}</div>
                    <div v-if="n.body" class="text-xs text-ink-500 mt-0.5 leading-snug">{{ n.body }}</div>
                    <div class="text-[10px] text-ink-400 mt-1">{{ timeAgo(n.created_at) }}</div>
                  </div>
                  <span v-if="!n.read" class="w-2 h-2 rounded-full bg-sky-500 shrink-0 mt-2"></span>
                </div>
              </div>
            </div>
          </div>
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
            <NuxtLink to="/history" class="block px-3 py-2 text-sm rounded-lg hover:bg-ink-50 text-ink-700">Prediction History</NuxtLink>
            <NuxtLink v-if="!isGuest" to="/settings" class="block px-3 py-2 text-sm rounded-lg hover:bg-ink-50 text-ink-700">Settings</NuxtLink>
            <a v-if="isGuest" href="https://appsflyer.sycamore.ng/Qthc/worldcup_website" target="_blank" rel="noreferrer" class="block px-3 py-2 text-sm rounded-lg hover:bg-sky-50 text-sky-700">
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
      </ClientOnly>
    </div>

    <ClientOnly>
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
    </ClientOnly>
  </header>
</template>
