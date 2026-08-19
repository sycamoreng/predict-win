<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const supabase = useSupabase()
const { user, trackPulseEvent } = useAuth()
const { config: campaign, load: loadCampaign, campaignId } = useCampaign()

const loading = ref(true)
const activeTab = ref<'my-matchups' | 'standings'>('my-matchups')
const pairings = ref<any[]>([])
const standings = ref<any[]>([])
const currentWeek = ref(1)
const optedIn = ref(false)
const optInCount = ref(0)
const optInLoading = ref(false)

const loadData = async () => {
  loading.value = true
  await loadCampaign()
  if (!campaignId.value) { loading.value = false; return }

  const weekStart = campaign.value?.week_start_date || '2026-06-11'
  const anchor = new Date(weekStart + 'T00:00:00Z')
  const daysSince = Math.floor((Date.now() - anchor.getTime()) / (1000 * 60 * 60 * 24))
  currentWeek.value = Math.floor(daysSince / 7) + 1

  const [pairRes, standRes] = await Promise.all([
    supabase.from('h2h_pairings')
      .select('*, player_a:synced_users!h2h_pairings_player_a_id_fkey(id, name, username), player_b:synced_users!h2h_pairings_player_b_id_fkey(id, name, username)')
      .eq('campaign_id', campaignId.value)
      .order('week_number', { ascending: false }),
    supabase.from('h2h_standings')
      .select('*, user:synced_users!h2h_standings_user_id_fkey(id, name, username)')
      .eq('campaign_id', campaignId.value)
      .order('h2h_points', { ascending: false }),
  ])

  pairings.value = pairRes.data || []
  standings.value = standRes.data || []
  await loadOptIn()
  loading.value = false
}

const loadOptIn = async () => {
  if (!campaignId.value || !user.value?.id) return
  const { count } = await supabase.from('h2h_optins')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaignId.value)
    .eq('week_number', currentWeek.value)
  optInCount.value = count || 0

  const { data: mine } = await supabase.from('h2h_optins')
    .select('id')
    .eq('campaign_id', campaignId.value)
    .eq('week_number', currentWeek.value)
    .eq('user_id', user.value.id)
    .maybeSingle()
  optedIn.value = !!mine
}

const weekHasPairings = computed(() =>
  pairings.value.some((p) => p.week_number === currentWeek.value)
)

const weeklyLimit = computed(() => campaign.value?.h2h_weekly_limit || 0)
const spotsFull = computed(() => weeklyLimit.value > 0 && optInCount.value >= weeklyLimit.value && !optedIn.value)

const toggleOptIn = async () => {
  if (!campaignId.value || !user.value?.id || optInLoading.value) return
  if (spotsFull.value) return
  optInLoading.value = true
  try {
    if (optedIn.value) {
      await supabase.from('h2h_optins')
        .delete()
        .eq('campaign_id', campaignId.value)
        .eq('week_number', currentWeek.value)
        .eq('user_id', user.value.id)
      trackPulseEvent('h2h_opt_out', { week: currentWeek.value })
    } else {
      await supabase.from('h2h_optins')
        .insert({ campaign_id: campaignId.value, week_number: currentWeek.value, user_id: user.value.id })
      trackPulseEvent('h2h_opt_in', { week: currentWeek.value })
    }
    await loadOptIn()
  } finally {
    optInLoading.value = false
  }
}

onMounted(() => {
  loadData()
  trackPulseEvent('h2h_page_viewed')
})

const myPairings = computed(() =>
  pairings.value.filter((p) => p.player_a_id === user.value?.id || p.player_b_id === user.value?.id)
)

const allPairingsByWeek = computed(() => {
  const map: Record<number, any[]> = {}
  for (const p of pairings.value) {
    if (!map[p.week_number]) map[p.week_number] = []
    map[p.week_number].push(p)
  }
  return Object.entries(map).sort(([a], [b]) => Number(b) - Number(a))
})

const displayName = (u: any) => {
  if (!u) return 'Unknown'
  return u.username || u.name || 'Player'
}

const getResultClass = (pairing: any, playerId: string) => {
  if (pairing.status !== 'completed') return ''
  if (pairing.winner_id === playerId) return 'text-emerald-600 font-bold'
  if (pairing.winner_id === null) return 'text-amber-600 font-semibold'
  return 'text-ink-400'
}

const getResultLabel = (pairing: any, playerId: string) => {
  if (pairing.status !== 'completed') return 'vs'
  if (pairing.winner_id === playerId) return 'W'
  if (pairing.winner_id === null) return 'D'
  return 'L'
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-extrabold text-ink-900">Head to Head</h1>
      <p class="text-sm text-ink-500 mt-1">Weekly 1v1 matchups against other predictors</p>
    </div>

    <!-- Tabs -->
    <div class="flex gap-2 p-1 bg-ink-100 rounded-xl">
      <button
        @click="activeTab = 'my-matchups'"
        :class="['flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition', activeTab === 'my-matchups' ? 'bg-white shadow-sm text-ink-900' : 'text-ink-600 hover:text-ink-900']"
      >My Matchups</button>
      <button
        @click="activeTab = 'standings'"
        :class="['flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition', activeTab === 'standings' ? 'bg-white shadow-sm text-ink-900' : 'text-ink-600 hover:text-ink-900']"
      >H2H Table</button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="space-y-4">
      <div v-for="n in 5" :key="n" class="card h-20 animate-pulse bg-ink-100/40"></div>
    </div>

    <!-- My Matchups -->
    <template v-else-if="activeTab === 'my-matchups'">
      <!-- Weekly opt-in -->
      <div class="card p-5 bg-gradient-to-br from-sky-50 to-white border border-sky-100">
        <div class="flex items-start justify-between gap-4">
          <div>
            <div class="flex items-center gap-2">
              <h3 class="font-bold text-ink-900">Week {{ currentWeek }} head-to-head</h3>
              <span v-if="optedIn && !weekHasPairings" class="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold uppercase">You're in</span>
            </div>
            <p v-if="weekHasPairings" class="text-sm text-ink-500 mt-1">Matchups for this week are set. See your pairing below.</p>
            <p v-else-if="optedIn" class="text-sm text-ink-500 mt-1">You're entered. You'll be paired with another player when this week's matchups are drawn.</p>
            <p v-else-if="spotsFull" class="text-sm text-ink-500 mt-1">This week's head-to-head is full. Check back next week.</p>
            <p v-else class="text-sm text-ink-500 mt-1">Opt in to be paired against another predictor this week.</p>
            <p class="text-xs text-ink-400 mt-2">
              {{ optInCount }}<template v-if="weeklyLimit > 0"> / {{ weeklyLimit }}</template> player{{ optInCount === 1 && weeklyLimit === 0 ? '' : 's' }} opted in{{ weeklyLimit > 0 ? '' : ' so far' }}
            </p>
          </div>
          <button
            v-if="!weekHasPairings"
            @click="toggleOptIn"
            :disabled="optInLoading || spotsFull"
            :class="['flex-shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition disabled:opacity-50', optedIn ? 'bg-ink-100 text-ink-700 hover:bg-ink-200' : 'bg-sky-500 text-white hover:bg-sky-600']"
          >
            {{ optInLoading ? '...' : optedIn ? 'Opt out' : spotsFull ? 'Full' : 'Opt in' }}
          </button>
        </div>
      </div>

      <div v-if="myPairings.length === 0" class="card p-12 text-center">
        <div class="w-14 h-14 rounded-2xl bg-ink-100 mx-auto grid place-items-center mb-4">
          <svg class="w-7 h-7 text-ink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
        </div>
        <h3 class="text-lg font-bold text-ink-900">No matchups yet</h3>
        <p class="text-sm text-ink-500 mt-1">Head-to-head pairings are generated each week. Check back soon!</p>
      </div>

      <div v-else class="space-y-4">
        <div v-for="p in myPairings" :key="p.id" class="card p-4">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-semibold text-ink-500 uppercase">Week {{ p.week_number }}</span>
            <span :class="['text-xs font-semibold px-2 py-0.5 rounded-full', p.status === 'completed' ? 'bg-ink-100 text-ink-600' : p.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700']">
              {{ p.status === 'completed' ? 'Completed' : p.status === 'active' ? 'Live' : 'Pending' }}
            </span>
          </div>
          <div class="flex items-center gap-3">
            <!-- Player A -->
            <div class="flex-1 text-center">
              <p class="text-sm font-bold text-ink-900 truncate lowercase" :class="getResultClass(p, p.player_a_id)">
                {{ displayName(p.player_a) }}
              </p>
              <p v-if="p.status === 'completed'" class="text-lg font-extrabold" :class="getResultClass(p, p.player_a_id)">
                {{ p.player_a_points ?? 0 }}
              </p>
            </div>
            <!-- VS -->
            <div class="w-12 h-12 rounded-full bg-ink-100 grid place-items-center flex-shrink-0">
              <span class="text-xs font-bold text-ink-500">VS</span>
            </div>
            <!-- Player B -->
            <div class="flex-1 text-center">
              <p class="text-sm font-bold text-ink-900 truncate lowercase" :class="getResultClass(p, p.player_b_id)">
                {{ displayName(p.player_b) }}
              </p>
              <p v-if="p.status === 'completed'" class="text-lg font-extrabold" :class="getResultClass(p, p.player_b_id)">
                {{ p.player_b_points ?? 0 }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Standings -->
    <template v-else>
      <div v-if="standings.length === 0" class="card p-12 text-center">
        <h3 class="text-lg font-bold text-ink-900">No H2H data yet</h3>
        <p class="text-sm text-ink-500 mt-1">The standings table will populate after the first week of matchups.</p>
      </div>

      <div v-else class="card overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-ink-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-bold text-ink-500 uppercase">#</th>
              <th class="px-4 py-3 text-left text-xs font-bold text-ink-500 uppercase">Player</th>
              <th class="px-4 py-3 text-center text-xs font-bold text-ink-500 uppercase">W</th>
              <th class="px-4 py-3 text-center text-xs font-bold text-ink-500 uppercase">D</th>
              <th class="px-4 py-3 text-center text-xs font-bold text-ink-500 uppercase">L</th>
              <th class="px-4 py-3 text-right text-xs font-bold text-ink-500 uppercase">Pts</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-ink-100">
            <tr
              v-for="(s, i) in standings"
              :key="s.id"
              :class="s.user_id === user?.id ? 'bg-sky-50/50' : ''"
            >
              <td class="px-4 py-3 text-ink-500 font-semibold">{{ i + 1 }}</td>
              <td class="px-4 py-3 font-semibold text-ink-900 truncate lowercase max-w-[200px]">
                {{ displayName(s.user) }}
                <span v-if="s.user_id === user?.id" class="ml-1 text-[10px] bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded-full font-bold">You</span>
              </td>
              <td class="px-4 py-3 text-center text-emerald-600 font-semibold">{{ s.wins }}</td>
              <td class="px-4 py-3 text-center text-amber-600 font-semibold">{{ s.draws }}</td>
              <td class="px-4 py-3 text-center text-red-500 font-semibold">{{ s.losses }}</td>
              <td class="px-4 py-3 text-right font-extrabold text-ink-900">{{ s.h2h_points }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
