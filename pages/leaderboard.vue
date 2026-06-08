<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const supabase = useSupabase()
const { user, isGuest, hasAccount } = useAuth()
const { config: campaign, load: loadCampaign } = useCampaign()

const players = ref<any[]>([])
const loading = ref(true)

const displayUsername = (p: any) => {
  return p.username || (p.name || '').split(' ')[0] || 'Player'
}

const load = async () => {
  await loadCampaign()
  if (isGuest.value || !hasAccount.value || !campaign.value.leaderboard_enabled) {
    loading.value = false
    return
  }
  loading.value = true
  const { data } = await supabase
    .from('synced_users')
    .select('id, name, username, email, total_points, active_customer_flag, is_account_valid, exact_scorelines_count, correct_predictions_count, backed_team:teams!synced_users_backed_team_id_fkey(flag_emoji, code)')
    .eq('active_customer_flag', true)
    .eq('is_account_valid', true)
    .order('total_points', { ascending: false })
    .order('exact_scorelines_count', { ascending: false })
    .order('correct_predictions_count', { ascending: false })
    .order('name', { ascending: true })
    .limit(100)
  players.value = data || []
  loading.value = false
}

onMounted(load)

const myRank = computed(() => {
  if (!user.value) return null
  const idx = players.value.findIndex((p) => p.id === user.value!.id)
  return idx >= 0 ? idx + 1 : null
})

const podiumColors = [
  'from-sun-300 to-sun-500',
  'from-ink-200 to-ink-400',
  'from-coral-300 to-coral-500',
]

const showShareRank = ref(false)
const rankShareText = computed(() => {
  if (!myRank.value || !user.value) return ''
  return `I'm ranked #${myRank.value} with ${user.value.total_points} points on the Sycamore Predictor League! Can you beat me?\n\n#SycamorePredictor #WorldCup2026`
})
</script>

<template>
  <div class="space-y-8">
    <!-- Leaderboard not enabled -->
    <template v-if="!campaign.leaderboard_enabled">
      <div class="card p-12 sm:p-16 text-center max-w-lg mx-auto">
        <div class="w-16 h-16 rounded-2xl bg-sky-100 mx-auto grid place-items-center mb-5">
          <svg class="w-8 h-8 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        </div>
        <h1 class="text-2xl font-extrabold text-ink-900 mb-2">Leaderboard coming soon</h1>
        <p class="text-sm text-ink-600 leading-relaxed">
          The leaderboard will go live once the campaign kicks off. Start making predictions now so you're ready!
        </p>
      </div>
    </template>

    <!-- Guest users or users without account numbers -->
    <template v-else-if="isGuest || !hasAccount">
      <div class="card p-12 sm:p-16 text-center max-w-lg mx-auto">
        <div class="w-16 h-16 rounded-2xl bg-sun-100 mx-auto grid place-items-center mb-5">
          <svg class="w-8 h-8 text-sun-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
          </svg>
        </div>
        <h1 class="text-2xl font-extrabold text-ink-900 mb-2">Sycamore account required</h1>
        <p class="text-sm text-ink-600 leading-relaxed max-w-sm mx-auto">
          The leaderboard is available to Sycamore customers with an account number. Sign up on the Sycamore app to see rankings and compete for prizes.
        </p>
        <a
          href="https://appsflyer.sycamore.ng/Qthc/worldcup_website"
          target="_blank"
          rel="noreferrer"
          class="btn-primary px-8 py-3 text-sm inline-block mt-6"
        >
          Get the Sycamore App
        </a>
      </div>
    </template>

    <!-- Leaderboard enabled -->
    <template v-else>
      <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 class="text-3xl font-extrabold text-ink-900">Leaderboard</h1>
          <p class="mt-1 text-ink-500">Live standings — only eligible players appear.</p>
        </div>
        <div v-if="user" class="card px-4 py-3 flex items-center gap-4">
          <div>
            <div class="text-xs uppercase tracking-wider font-semibold text-ink-400">Your rank</div>
            <div class="text-2xl font-extrabold text-sky-600">
              {{ myRank ? `#${myRank}` : '—' }}
            </div>
          </div>
          <div class="w-px h-10 bg-ink-100"></div>
          <div>
            <div class="text-xs uppercase tracking-wider font-semibold text-ink-400">Points</div>
            <div class="text-2xl font-extrabold text-mint-600">{{ user.total_points }}</div>
          </div>
          <div class="w-px h-10 bg-ink-100"></div>
          <button
            v-if="myRank"
            @click="showShareRank = true"
            class="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-ink-100 text-ink-600 transition"
            title="Share your rank"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
          </button>
        </div>
      </div>

      <div v-if="loading" class="card h-96 animate-pulse bg-ink-100/40"></div>

      <template v-else>
        <div v-if="players.length >= 3" class="grid grid-cols-3 gap-3 sm:gap-6">
          <div
            v-for="(p, i) in [players[1], players[0], players[2]]"
            :key="p.id"
            :class="[
              'card p-4 sm:p-6 text-center relative overflow-hidden animate-fade-up',
              i === 1 ? 'sm:scale-110 sm:-mt-4' : '',
            ]"
          >
            <div :class="['absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-30 bg-gradient-to-br', podiumColors[[1, 0, 2][i]]]"></div>
            <div class="relative">
              <div class="text-3xl sm:text-4xl mb-2">
                {{ ['&#129352;', '&#129351;', '&#129353;'][i] }}
              </div>
              <div class="text-3xl sm:text-4xl mb-1">{{ p.backed_team?.flag_emoji || '&#9917;' }}</div>
              <div class="font-bold text-ink-900 truncate lowercase">{{ displayUsername(p) }}</div>
              <div class="text-xs text-ink-400 mb-3">#{{ [2, 1, 3][i] }}</div>
              <div class="inline-flex pill bg-sky-50 text-sky-700 text-base">{{ p.total_points }} pts</div>
            </div>
          </div>
        </div>

        <div class="card overflow-hidden">
          <div class="px-4 sm:px-6 py-3 border-b border-ink-100 flex items-center justify-between">
            <h2 class="font-bold text-ink-900">Standings</h2>
            <span class="text-xs text-ink-400">{{ players.length }} eligible players</span>
          </div>
          <ul class="divide-y divide-ink-100">
            <li
              v-for="(p, i) in players"
              :key="p.id"
              :class="[
                'flex items-center gap-4 px-4 sm:px-6 py-3 transition',
                user && p.id === user.id ? 'bg-sky-50/60' : 'hover:bg-ink-50/50',
              ]"
            >
              <div
                :class="[
                  'w-9 h-9 rounded-lg grid place-items-center text-sm font-bold',
                  i === 0 ? 'bg-sun-100 text-sun-800'
                    : i === 1 ? 'bg-ink-100 text-ink-700'
                    : i === 2 ? 'bg-coral-100 text-coral-700'
                    : 'bg-ink-50 text-ink-500',
                ]"
              >
                {{ i + 1 }}
              </div>
              <div class="text-2xl">{{ p.backed_team?.flag_emoji || '&#9917;' }}</div>
              <div class="flex-1 min-w-0">
                <div class="font-semibold text-ink-900 truncate lowercase">
                  {{ displayUsername(p) }}
                  <span v-if="user && p.id === user.id" class="ml-2 pill bg-sky-100 text-sky-700 text-[10px]">You</span>
                </div>
                <div class="text-xs text-ink-500 truncate">
                  Backing {{ p.backed_team?.code || 'no one yet' }}
                </div>
              </div>
              <div class="font-extrabold text-ink-900 tabular-nums">
                {{ p.total_points }}
                <span class="text-xs font-semibold text-ink-400">pts</span>
              </div>
            </li>
          </ul>
        </div>
      </template>
    </template>

    <ShareModal
      v-if="showShareRank"
      :text="rankShareText"
      title="My Leaderboard Rank"
      @close="showShareRank = false"
    />
  </div>
</template>
