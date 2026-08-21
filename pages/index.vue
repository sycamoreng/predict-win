<script setup lang="ts">
const { user, loadFromStorage } = useAuth()
const { config: campaign, load: loadCampaign, isLive } = useCampaign()
const supabase = useSupabase()
const loading = ref(true)

const kickoff = ref<string | null>(null)
const now = ref(Date.now())
let ticker: ReturnType<typeof setInterval> | null = null

const showAnticipation = ref(false)

onMounted(async () => {
  loadFromStorage()
  await loadCampaign()
  loading.value = false

  // Earliest scheduled fixture of the active campaign = first kick-off.
  if (campaign.value.id) {
    const { data } = await supabase
      .from('matches')
      .select('kickoff_at')
      .eq('campaign_id', campaign.value.id)
      .order('kickoff_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    kickoff.value = data?.kickoff_at ?? null
  }

  ticker = setInterval(() => { now.value = Date.now() }, 1000)

  if (import.meta.client && localStorage.getItem('anticipation_dismissed') !== '1') {
    showAnticipation.value = true
  }
})

onUnmounted(() => { if (ticker) clearInterval(ticker) })

const dismissAnticipation = () => {
  showAnticipation.value = false
  if (import.meta.client) localStorage.setItem('anticipation_dismissed', '1')
}

const accessOpen = computed(() => campaign.value.public_access_enabled)

const countdown = computed(() => {
  if (!kickoff.value) return null
  const diff = new Date(kickoff.value).getTime() - now.value
  if (diff <= 0) return { over: true, days: 0, hours: 0, minutes: 0, seconds: 0 }
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  const minutes = Math.floor((diff % 3600000) / 60000)
  const seconds = Math.floor((diff % 60000) / 1000)
  return { over: false, days, hours, minutes, seconds }
})

const pad = (n: number) => String(n).padStart(2, '0')

const hasCampaign = computed(() => !!campaign.value.id)
const campaignName = computed(() => campaign.value.name || 'Predictor League')
const competitionType = computed(() =>
  campaign.value.competition_type === 'league' ? 'League' : 'Tournament'
)

const scoringResult = computed(() => campaign.value.scoring_result || 5)
const scoringFirstToScore = computed(() => campaign.value.scoring_first_to_score || 10)
const scoringExactFt = computed(() => campaign.value.scoring_exact_ft || 15)
const maxPointsPerMatch = computed(() => scoringResult.value + scoringFirstToScore.value + scoringExactFt.value)

const steps = [
  {
    step: '01',
    title: 'Sign in',
    description: 'Log in with your email — no passwords, no fuss. Sycamore customers get instant access.',
    color: 'sky',
    icon: 'user',
  },
  {
    step: '02',
    title: 'Predict',
    description: 'Call the correct result, exact score, and first team to score for every fixture on the card.',
    color: 'mint',
    icon: 'target',
  },
  {
    step: '03',
    title: 'Climb the table',
    description: 'Rack up points each week, rise up the leaderboard, and earn bragging rights over everyone else.',
    color: 'sun',
    icon: 'trophy',
  },
]

const stats = [
  { value: '5,000+', label: 'Active players' },
  { value: '20', label: 'Teams to back' },
  { value: 'Weekly', label: 'New fixtures' },
  { value: '6', label: 'Power-up chips' },
]

const features = [
  {
    title: 'Climb the leaderboard',
    description: 'Compete with thousands of predictors for the top spot. Track your ranking in real time, see weekly movers, and earn bragging rights over everyone else.',
    image: '/Leaderboard_illustr_2.png',
    badge: 'Competition',
    badgeColor: 'sky',
    reversed: false,
  },
  {
    title: 'Back your team',
    description: 'Pick a club to rally behind for the entire season. When your club wins, you unlock bonus opportunities and exclusive rewards.',
    image: '/Transfers.png',
    badge: 'Team spirit',
    badgeColor: 'mint',
    reversed: true,
  },
  {
    title: 'Play every week',
    description: 'New fixtures drop regularly. Set your predictions before kick-off, then watch the points roll in. The more you play, the higher you climb.',
    image: '/baller.png',
    badge: 'Consistency',
    badgeColor: 'sun',
    reversed: false,
  },
]

const WHATSAPP_COMMUNITY_URL = 'https://chat.whatsapp.com/IwD5XwS1PSB0sa6OQak50y'

const trustPoints = [
  { icon: 'shield', text: 'Free to play' },
  { icon: 'lock', text: 'Secure platform' },
  { icon: 'zap', text: 'Play every week' },
  { icon: 'users', text: '5,000+ community' },
]

const modes = [
  {
    title: 'Head-to-head duels',
    description: 'Opt in each week to be drawn against another player. Whoever scores more points from their predictions wins the tie and climbs the head-to-head table.',
    tag: 'New',
    color: 'coral',
    icon: 'swords',
  },
  {
    title: 'Side quests',
    description: 'Weekly bonus challenges — call the top scorer, the standout player, or a surprise result — for extra points outside the main fixtures.',
    tag: 'New',
    color: 'sky',
    icon: 'compass',
  },
  {
    title: 'Private groups',
    description: 'Create a group, share the join code, and run your own mini-league with friends, family, or colleagues on a leaderboard of your own.',
    tag: 'New',
    color: 'mint',
    icon: 'users',
  },
  {
    title: 'Winning streaks',
    description: 'String correct predictions together to build a streak. The longer it runs, the bigger the bragging rights — and streak milestones unlock rewards.',
    tag: 'New',
    color: 'sun',
    icon: 'flame',
  },
]
</script>

<template>
  <div>

    <!-- ============================================ -->
    <!-- ANTICIPATION MODAL                           -->
    <!-- ============================================ -->
    <ClientOnly>
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="showAnticipation"
          class="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 sm:p-6 bg-ink-900/70 backdrop-blur-sm"
          @click.self="dismissAnticipation"
        >
          <Transition
            enter-active-class="transition duration-300 ease-out"
            enter-from-class="opacity-0 translate-y-6 sm:scale-95"
            enter-to-class="opacity-100 translate-y-0 sm:scale-100"
          >
            <div
              v-if="showAnticipation"
              class="relative w-full max-w-lg rounded-3xl overflow-hidden bg-white shadow-2xl"
            >
              <button
                type="button"
                @click="dismissAnticipation"
                class="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-ink-900/10 hover:bg-ink-900/20 text-ink-700 grid place-items-center transition"
                aria-label="Close"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>

              <!-- Colourful header band -->
              <div class="relative h-28 sm:h-32 bg-gradient-to-r from-sky-500 via-mint-500 to-sun-400 overflow-hidden">
                <div class="absolute inset-0 opacity-20" style="background-image: radial-gradient(circle, rgba(255,255,255,0.9) 1.5px, transparent 1.5px); background-size: 18px 18px;" />
                <div class="absolute -bottom-10 -right-6 w-40 h-40 rounded-full bg-white/20 blur-2xl" />
                <div class="relative z-[1] h-full flex items-center justify-center">
                  <div class="w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-2xl bg-white/95 shadow-lg grid place-items-center">
                    <svg class="w-8 h-8 sm:w-9 sm:h-9 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div class="p-6 sm:p-9 text-center">
                <div class="inline-flex items-center gap-2 rounded-full bg-sun-100 border border-sun-200 px-3.5 py-1.5 text-xs font-bold text-sun-700 uppercase tracking-wider mb-5">
                  <span class="relative flex h-2 w-2">
                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-sun-500 opacity-75" />
                    <span class="relative inline-flex rounded-full h-2 w-2 bg-sun-500" />
                  </span>
                  Something big is coming
                </div>

                <h2 class="text-2xl sm:text-3xl font-extrabold text-ink-900 tracking-tight leading-tight">
                  The new season is nearly here
                </h2>
                <p class="mt-3 text-sm sm:text-base text-ink-500 leading-relaxed max-w-sm mx-auto">
                  Predictions, power-up chips, head-to-head duels and private leagues are all on the way. Get ready to call every result and climb the table from the very first whistle.
                </p>

                <!-- Countdown inside modal -->
                <div v-if="countdown && !countdown.over" class="mt-6 flex items-stretch gap-2 sm:gap-3">
                  <div
                    v-for="unit in [
                      { label: 'Days', value: countdown.days },
                      { label: 'Hours', value: countdown.hours },
                      { label: 'Mins', value: countdown.minutes },
                      { label: 'Secs', value: countdown.seconds },
                    ]"
                    :key="unit.label"
                    class="flex-1 min-w-0 rounded-2xl bg-ink-50 border border-ink-100 px-2 py-3 text-center"
                  >
                    <div class="text-xl sm:text-2xl font-extrabold text-ink-900 tabular-nums leading-none">{{ pad(unit.value) }}</div>
                    <div class="text-[9px] sm:text-[10px] font-semibold text-ink-400 uppercase tracking-wider mt-1">{{ unit.label }}</div>
                  </div>
                </div>

                <button
                  type="button"
                  @click="dismissAnticipation"
                  class="mt-7 w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm px-8 py-3.5 transition shadow-pop"
                >
                  Can't wait!
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </ClientOnly>

    <!-- ============================================ -->
    <!-- HERO SECTION                                 -->
    <!-- ============================================ -->
    <section class="relative overflow-hidden bg-gradient-to-br from-ink-900 via-ink-800 to-sky-900 text-white min-h-[600px] lg:min-h-[680px] flex items-center">
      <!-- Background pattern -->
      <div
        class="absolute inset-0 opacity-[0.04]"
        style="background-image: url('/Group_(1).svg'); background-size: 240px; background-repeat: repeat;"
      />

      <!-- Gradient orbs for depth -->
      <div class="absolute top-20 -right-32 w-[500px] h-[500px] rounded-full bg-sky-600/10 blur-[120px]" />
      <div class="absolute -bottom-20 -left-32 w-[400px] h-[400px] rounded-full bg-mint-500/8 blur-[100px]" />

      <!-- Content -->
      <div class="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
        <div class="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <!-- Left: Copy -->
          <div class="space-y-8">
            <!-- Campaign badge -->
            <ClientOnly>
              <div
                v-if="hasCampaign && isLive && !loading"
                class="inline-flex items-center gap-2.5 rounded-full bg-white/[0.08] border border-white/[0.08] px-4 py-2 text-sm font-semibold backdrop-blur-md animate-fade-up"
              >
                <span class="relative flex h-2 w-2">
                  <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-mint-400 opacity-75" />
                  <span class="relative inline-flex rounded-full h-2 w-2 bg-mint-400" />
                </span>
                <span class="text-white/90">{{ campaignName }}</span>
                <span class="text-white/40">·</span>
                <span class="text-sky-300">{{ competitionType }} live</span>
              </div>
              <div
                v-else-if="!loading"
                class="inline-flex items-center gap-2 rounded-full bg-white/[0.06] border border-white/[0.06] px-4 py-2 text-sm font-semibold backdrop-blur-md animate-fade-up"
              >
                <span class="w-2 h-2 rounded-full bg-sun-400" />
                <span class="text-white/80">{{ hasCampaign ? campaignName + ' · Coming soon' : 'Coming soon' }}</span>
              </div>
            </ClientOnly>

            <h1 class="text-4xl sm:text-5xl lg:text-[3.5rem] xl:text-6xl font-extrabold leading-[1.08] tracking-tight animate-fade-up" style="animation-delay: 0.1s">
              Your game,
              <br />
              <span class="bg-gradient-to-r from-sky-400 via-sky-300 to-mint-400 bg-clip-text text-transparent">your goals.</span>
            </h1>

            <p class="text-lg sm:text-xl text-ink-300 leading-relaxed max-w-lg animate-fade-up" style="animation-delay: 0.2s">
              Predict match results, climb the leaderboard, and prove you're the sharpest predictor around. Free to play for Sycamore customers.
            </p>

            <!-- Kick-off countdown -->
            <ClientOnly>
              <div
                v-if="countdown && !countdown.over"
                class="animate-fade-up"
                style="animation-delay: 0.25s"
              >
                <div class="text-xs font-bold uppercase tracking-widest text-sky-300/90 mb-3">First kick-off in</div>
                <div class="flex items-stretch gap-2 sm:gap-3">
                  <div
                    v-for="unit in [
                      { label: 'Days', value: countdown.days },
                      { label: 'Hours', value: countdown.hours },
                      { label: 'Mins', value: countdown.minutes },
                      { label: 'Secs', value: countdown.seconds },
                    ]"
                    :key="unit.label"
                    class="flex-1 min-w-0 rounded-2xl bg-white/[0.08] border border-white/[0.1] backdrop-blur-md px-2 py-3 sm:px-4 sm:py-4 text-center"
                  >
                    <div class="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tabular-nums leading-none">{{ pad(unit.value) }}</div>
                    <div class="text-[10px] sm:text-xs font-semibold text-ink-300 uppercase tracking-wider mt-1.5">{{ unit.label }}</div>
                  </div>
                </div>
              </div>
              <div
                v-else-if="countdown && countdown.over"
                class="inline-flex items-center gap-2 rounded-full bg-mint-500/15 border border-mint-400/25 px-4 py-2 text-sm font-bold text-mint-300 animate-fade-up"
              >
                <span class="relative flex h-2 w-2">
                  <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-mint-400 opacity-75" />
                  <span class="relative inline-flex rounded-full h-2 w-2 bg-mint-400" />
                </span>
                The season is under way!
              </div>
            </ClientOnly>

            <!-- CTA Buttons -->
            <div class="flex flex-wrap items-center gap-3 animate-fade-up" style="animation-delay: 0.3s">
              <ClientOnly>
                <template v-if="accessOpen">
                  <NuxtLink
                    v-if="user"
                    to="/predict"
                    class="group inline-flex items-center justify-center gap-2.5 rounded-xl bg-sky-600 text-white font-bold text-sm px-7 py-4 hover:bg-sky-500 transition-all duration-200 shadow-pop hover:shadow-lg hover:shadow-sky-500/25"
                  >
                    Go to predictions
                    <svg class="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                  </NuxtLink>
                  <NuxtLink
                    v-else
                    to="/login"
                    class="group inline-flex items-center justify-center gap-2.5 rounded-xl bg-sky-600 text-white font-bold text-sm px-7 py-4 hover:bg-sky-500 transition-all duration-200 shadow-pop hover:shadow-lg hover:shadow-sky-500/25"
                  >
                    Sign in to play
                    <svg class="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                  </NuxtLink>
                  <NuxtLink
                    to="/leaderboard"
                    class="inline-flex items-center justify-center gap-2 rounded-xl bg-white/[0.08] border border-white/[0.12] text-white font-bold text-sm px-7 py-4 hover:bg-white/[0.14] backdrop-blur-sm transition-all duration-200"
                  >
                    View leaderboard
                  </NuxtLink>
                </template>
                <button
                  v-else
                  type="button"
                  @click="showAnticipation = true"
                  class="group inline-flex items-center justify-center gap-2.5 rounded-xl bg-sky-600 text-white font-bold text-sm px-7 py-4 hover:bg-sky-500 transition-all duration-200 shadow-pop hover:shadow-lg hover:shadow-sky-500/25"
                >
                  Get ready — coming soon
                  <svg class="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                </button>
              </ClientOnly>
            </div>

            <!-- Mini social proof -->
            <div class="flex items-center gap-3 animate-fade-up" style="animation-delay: 0.4s">
              <!-- Stacked avatars -->
              <div class="flex -space-x-2">
                <div class="w-8 h-8 rounded-full bg-sky-500 border-2 border-ink-900 flex items-center justify-center text-[10px] font-bold text-white">AO</div>
                <div class="w-8 h-8 rounded-full bg-mint-500 border-2 border-ink-900 flex items-center justify-center text-[10px] font-bold text-white">KM</div>
                <div class="w-8 h-8 rounded-full bg-sun-500 border-2 border-ink-900 flex items-center justify-center text-[10px] font-bold text-white">TJ</div>
                <div class="w-8 h-8 rounded-full bg-coral-500 border-2 border-ink-900 flex items-center justify-center text-[10px] font-bold text-white">+5K</div>
              </div>
              <p class="text-sm text-ink-400">Join <span class="text-white font-semibold">5,000+</span> players already competing</p>
            </div>
          </div>

          <!-- Right: Decorative floating cards -->
          <div class="hidden lg:block relative h-[420px]">
            <!-- Floating match card 1 -->
            <div
              class="absolute top-4 right-8 w-64 rounded-2xl bg-white/[0.07] border border-white/[0.1] backdrop-blur-xl p-5 shadow-lg animate-fade-up"
              style="animation-delay: 0.3s; transform: rotate(2deg);"
            >
              <div class="flex items-center justify-between mb-4">
                <span class="pill bg-mint-500/20 text-mint-300 text-[11px]">Full time</span>
                <span class="text-[11px] text-ink-400 font-medium">GW 12</span>
              </div>
              <div class="flex items-center justify-between">
                <div class="text-center space-y-1.5">
                  <div class="w-10 h-10 rounded-full bg-white/90 mx-auto flex items-center justify-center p-1.5">
                    <img src="https://media.api-sports.io/football/teams/42.png" alt="Arsenal" class="w-full h-full object-contain" loading="lazy" />
                  </div>
                  <div class="text-xs font-bold text-white/90">ARS</div>
                </div>
                <div class="text-center px-4">
                  <div class="text-2xl font-extrabold text-white tracking-wider">3 – 1</div>
                  <div class="text-[10px] text-mint-400 font-semibold mt-1">+15 pts</div>
                </div>
                <div class="text-center space-y-1.5">
                  <div class="w-10 h-10 rounded-full bg-white/90 mx-auto flex items-center justify-center p-1.5">
                    <img src="https://media.api-sports.io/football/teams/49.png" alt="Chelsea" class="w-full h-full object-contain" loading="lazy" />
                  </div>
                  <div class="text-xs font-bold text-white/90">CHE</div>
                </div>
              </div>
            </div>

            <!-- Floating match card 2 -->
            <div
              class="absolute top-44 left-0 w-56 rounded-2xl bg-white/[0.06] border border-white/[0.08] backdrop-blur-xl p-4 shadow-lg animate-fade-up"
              style="animation-delay: 0.45s; transform: rotate(-3deg);"
            >
              <div class="flex items-center justify-between mb-3">
                <span class="pill bg-sky-500/20 text-sky-300 text-[11px]">Live</span>
                <span class="text-[11px] text-ink-400 font-medium">67'</span>
              </div>
              <div class="flex items-center justify-between">
                <div class="text-center space-y-1">
                  <div class="w-8 h-8 rounded-full bg-white/90 mx-auto flex items-center justify-center p-1">
                    <img src="https://media.api-sports.io/football/teams/40.png" alt="Liverpool" class="w-full h-full object-contain" loading="lazy" />
                  </div>
                  <div class="text-[11px] font-bold text-white/80">LIV</div>
                </div>
                <div class="text-xl font-extrabold text-white tracking-wider">2 – 2</div>
                <div class="text-center space-y-1">
                  <div class="w-8 h-8 rounded-full bg-white/90 mx-auto flex items-center justify-center p-1">
                    <img src="https://media.api-sports.io/football/teams/33.png" alt="Manchester United" class="w-full h-full object-contain" loading="lazy" />
                  </div>
                  <div class="text-[11px] font-bold text-white/80">MUN</div>
                </div>
              </div>
            </div>

            <!-- Points earned notification -->
            <div
              class="absolute bottom-12 right-4 w-52 rounded-xl bg-white/[0.09] border border-white/[0.1] backdrop-blur-xl p-4 shadow-lg animate-fade-up"
              style="animation-delay: 0.55s; transform: rotate(1deg);"
            >
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-mint-500/20 flex items-center justify-center flex-shrink-0">
                  <svg class="w-5 h-5 text-mint-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div>
                  <div class="text-sm font-bold text-white">+30 points</div>
                  <div class="text-[11px] text-mint-400">Exact scoreline! 🎯</div>
                </div>
              </div>
            </div>

            <!-- Leaderboard rank badge -->
            <div
              class="absolute top-[300px] right-36 w-28 rounded-xl bg-gradient-to-br from-sun-500/20 to-sun-600/10 border border-sun-400/20 backdrop-blur-xl p-3 text-center shadow-lg animate-fade-up"
              style="animation-delay: 0.65s;"
            >
              <div class="text-2xl font-extrabold text-sun-400">#4</div>
              <div class="text-[10px] font-semibold text-sun-300/80 mt-0.5">This week</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Decorative bottom curve -->
      <div class="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 56" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto" preserveAspectRatio="none">
          <path d="M0 56h1440V28C1240 4 960 0 720 0S200 4 0 28v28z" fill="#f6f7f9" />
        </svg>
      </div>
    </section>

    <!-- ============================================ -->
    <!-- STATS BAR                                    -->
    <!-- ============================================ -->
    <section class="relative z-10 -mt-4">
      <div class="max-w-5xl mx-auto px-4 sm:px-6">
        <div class="card p-2 sm:p-3">
          <div class="grid grid-cols-2 sm:grid-cols-4 divide-x divide-ink-100">
            <div
              v-for="(stat, i) in stats"
              :key="stat.label"
              class="text-center px-4 py-4 sm:py-5 animate-fade-up"
              :style="{ animationDelay: `${0.1 + i * 0.08}s` }"
            >
              <div class="text-xl sm:text-2xl font-extrabold text-ink-900">{{ stat.value }}</div>
              <div class="text-xs sm:text-sm text-ink-500 font-medium mt-0.5">{{ stat.label }}</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ============================================ -->
    <!-- HOW IT WORKS                                 -->
    <!-- ============================================ -->
    <section class="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
      <div class="text-center mb-14 sm:mb-16">
        <div class="pill bg-sky-100 text-sky-700 mb-4 mx-auto">Getting started</div>
        <h2 class="text-3xl sm:text-4xl font-extrabold text-ink-900 tracking-tight">How it works</h2>
        <p class="mt-3 text-ink-500 text-base sm:text-lg max-w-lg mx-auto leading-relaxed">
          Three simple steps to start competing every week.
        </p>
      </div>

      <div class="grid sm:grid-cols-3 gap-6 lg:gap-8">
        <div
          v-for="(item, i) in steps"
          :key="item.title"
          class="card group p-8 text-center space-y-5 hover:shadow-lg hover:-translate-y-1.5 transition-all duration-300 cursor-default animate-fade-up"
          :style="{ animationDelay: `${i * 0.12}s` }"
        >
          <!-- Step number -->
          <div
            class="relative mx-auto w-16 h-16 flex items-center justify-center"
          >
            <div
              class="absolute inset-0 rounded-2xl transition-transform duration-300 group-hover:scale-110"
              :class="{
                'bg-sky-100': item.color === 'sky',
                'bg-mint-100': item.color === 'mint',
                'bg-sun-100': item.color === 'sun',
              }"
            />
            <!-- User icon -->
            <svg v-if="item.icon === 'user'" class="relative z-10 w-7 h-7" :class="{ 'text-sky-600': item.color === 'sky' }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <!-- Target icon -->
            <svg v-else-if="item.icon === 'target'" class="relative z-10 w-7 h-7" :class="{ 'text-mint-600': item.color === 'mint' }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke-width="1.5" />
              <circle cx="12" cy="12" r="6" stroke-width="1.5" />
              <circle cx="12" cy="12" r="2" stroke-width="1.5" />
            </svg>
            <!-- Trophy icon -->
            <svg v-else class="relative z-10 w-7 h-7" :class="{ 'text-sun-600': item.color === 'sun' }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 3h14l-1 9a5 5 0 01-5 4h-2a5 5 0 01-5-4L5 3zM8 21h8M12 16v5M19 3c1 1 2 3 1 5M5 3c-1 1-2 3-1 5" />
            </svg>
          </div>

          <!-- Step label -->
          <div
            class="text-xs font-bold tracking-widest uppercase"
            :class="{
              'text-sky-500': item.color === 'sky',
              'text-mint-500': item.color === 'mint',
              'text-sun-500': item.color === 'sun',
            }"
          >
            Step {{ item.step }}
          </div>

          <h3 class="text-lg font-extrabold text-ink-900">{{ item.title }}</h3>
          <p class="text-sm text-ink-500 leading-relaxed">{{ item.description }}</p>
        </div>
      </div>
    </section>

    <!-- ============================================ -->
    <!-- LIVE SCORING                                 -->
    <!-- ============================================ -->
    <section class="bg-gradient-to-b from-ink-50 to-white">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
        <div class="text-center mb-14 sm:mb-16">
          <div class="pill bg-mint-100 text-mint-700 mb-4 mx-auto">Scoring system</div>
          <h2 class="text-3xl sm:text-4xl font-extrabold text-ink-900 tracking-tight">Points that add up</h2>
          <p class="mt-3 text-ink-500 text-base sm:text-lg max-w-lg mx-auto leading-relaxed">
            Every correct prediction earns you points. Stack all three for maximum impact.
          </p>
        </div>

        <ClientOnly>
          <div class="grid sm:grid-cols-3 gap-5 sm:gap-6 max-w-3xl mx-auto mb-10">
            <!-- Correct result -->
            <div class="card group relative overflow-hidden p-6 sm:p-8 text-center hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
              <div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-400 to-sky-600" />
              <div class="w-14 h-14 rounded-2xl bg-sky-50 mx-auto mb-4 flex items-center justify-center">
                <svg class="w-7 h-7 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div class="text-4xl sm:text-5xl font-extrabold text-sky-600 mb-2">{{ scoringResult }}</div>
              <div class="text-sm font-bold text-ink-900 mb-1">Correct result</div>
              <div class="text-xs text-ink-400 leading-relaxed">Home Win, Away Win, or Draw — call the outcome right</div>
            </div>

            <!-- First to score -->
            <div class="card group relative overflow-hidden p-6 sm:p-8 text-center hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
              <div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-mint-400 to-mint-600" />
              <div class="w-14 h-14 rounded-2xl bg-mint-50 mx-auto mb-4 flex items-center justify-center">
                <svg class="w-7 h-7 text-mint-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div class="text-4xl sm:text-5xl font-extrabold text-mint-600 mb-2">{{ scoringFirstToScore }}</div>
              <div class="text-sm font-bold text-ink-900 mb-1">First team to score</div>
              <div class="text-xs text-ink-400 leading-relaxed">Pick the team to score first in the match</div>
            </div>

            <!-- Exact scoreline -->
            <div class="card group relative overflow-hidden p-6 sm:p-8 text-center hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
              <div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sun-400 to-sun-600" />
              <div class="w-14 h-14 rounded-2xl bg-sun-50 mx-auto mb-4 flex items-center justify-center">
                <svg class="w-7 h-7 text-sun-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </div>
              <div class="text-4xl sm:text-5xl font-extrabold text-sun-600 mb-2">{{ scoringExactFt }}</div>
              <div class="text-sm font-bold text-ink-900 mb-1">Exact scoreline</div>
              <div class="text-xs text-ink-400 leading-relaxed">Nail the final score for maximum points</div>
            </div>
          </div>

          <!-- Max points callout -->
          <div class="max-w-md mx-auto">
            <div class="rounded-2xl bg-ink-900 p-5 sm:p-6 text-center">
              <div class="flex items-center justify-center gap-3 mb-2">
                <svg class="w-5 h-5 text-sun-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
                <span class="text-2xl sm:text-3xl font-extrabold text-white">{{ maxPointsPerMatch }} pts</span>
              </div>
              <p class="text-sm text-ink-400">
                Maximum per match — points are cumulative across all three categories
              </p>
            </div>
          </div>
        </ClientOnly>
      </div>
    </section>

    <!-- ============================================ -->
    <!-- POWER-UPS & CHIPS                             -->
    <!-- ============================================ -->
    <section class="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
      <div class="text-center mb-14 sm:mb-16">
        <div class="pill bg-amber-100 text-amber-700 mb-4 mx-auto">Power-ups</div>
        <h2 class="text-3xl sm:text-4xl font-extrabold text-ink-900 tracking-tight">Chips that change the game</h2>
        <p class="mt-3 text-ink-500 text-base sm:text-lg max-w-lg mx-auto leading-relaxed">
          Use one chip per matchweek to multiply your points, protect your streak, or go for a massive bonus. Timing is everything.
        </p>
      </div>

      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
        <!-- Double Down -->
        <div class="card group p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-11 h-11 rounded-xl bg-emerald-100 grid place-items-center">
              <svg class="w-5.5 h-5.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
              </svg>
            </div>
            <div>
              <h3 class="text-sm font-extrabold text-ink-900">Double Down</h3>
              <p class="text-[11px] text-ink-400 font-medium">2 uses per season</p>
            </div>
          </div>
          <p class="text-sm text-ink-600 leading-relaxed">All your predictions for the matchweek earn <span class="font-bold text-emerald-600">double points</span>. Best used when you feel confident about every fixture.</p>
        </div>

        <!-- Triple Captain -->
        <div class="card group p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-11 h-11 rounded-xl bg-amber-100 grid place-items-center">
              <svg class="w-5.5 h-5.5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
              </svg>
            </div>
            <div>
              <h3 class="text-sm font-extrabold text-ink-900">Triple Captain</h3>
              <p class="text-[11px] text-ink-400 font-medium">1 use per season</p>
            </div>
          </div>
          <p class="text-sm text-ink-600 leading-relaxed">Pick one match and earn <span class="font-bold text-amber-600">triple points</span> on it. Choose your most confident prediction for maximum impact.</p>
        </div>

        <!-- First Blood -->
        <div class="card group p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-11 h-11 rounded-xl bg-red-100 grid place-items-center">
              <svg class="w-5.5 h-5.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
              </svg>
            </div>
            <div>
              <h3 class="text-sm font-extrabold text-ink-900">First Blood</h3>
              <p class="text-[11px] text-ink-400 font-medium">3 uses per season</p>
            </div>
          </div>
          <p class="text-sm text-ink-600 leading-relaxed">Your first prediction is your pick for the matchweek's earliest kickoff. If you call that match's result correctly so it earns points, a <span class="font-bold text-red-500">1.5x bonus</span> carries across all your remaining matches that week.</p>
        </div>

        <!-- Streak Shield -->
        <div class="card group p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-11 h-11 rounded-xl bg-teal-100 grid place-items-center">
              <svg class="w-5.5 h-5.5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
              </svg>
            </div>
            <div>
              <h3 class="text-sm font-extrabold text-ink-900">Streak Shield</h3>
              <p class="text-[11px] text-ink-400 font-medium">1 use per season</p>
            </div>
          </div>
          <p class="text-sm text-ink-600 leading-relaxed"><span class="font-bold text-teal-600">Protects your winning streak</span> for the entire matchweek. Wrong predictions won't reset your streak counter.</p>
        </div>

        <!-- Perfect Week -->
        <div class="card group p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-11 h-11 rounded-xl bg-violet-100 grid place-items-center">
              <svg class="w-5.5 h-5.5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/>
              </svg>
            </div>
            <div>
              <h3 class="text-sm font-extrabold text-ink-900">Perfect Week</h3>
              <p class="text-[11px] text-ink-400 font-medium">1 use per season</p>
            </div>
          </div>
          <p class="text-sm text-ink-600 leading-relaxed">Getting every prediction right means every match you predict that week earns points &mdash; you call the result of each one correctly. Pull it off and earn a <span class="font-bold text-violet-600">+50 bonus points</span> on top. High risk, massive reward.</p>
        </div>

        <!-- Last Stand -->
        <div class="card group p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-11 h-11 rounded-xl bg-orange-100 grid place-items-center">
              <svg class="w-5.5 h-5.5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z"/>
              </svg>
            </div>
            <div>
              <h3 class="text-sm font-extrabold text-ink-900">Last Stand</h3>
              <p class="text-[11px] text-ink-400 font-medium">1 use · final 5 weeks only</p>
            </div>
          </div>
          <p class="text-sm text-ink-600 leading-relaxed"><span class="font-bold text-orange-500">4x points</span> for one matchweek. Only available in the final 5 matchweeks of the season. The ultimate endgame play.</p>
        </div>
      </div>

      <!-- Rule callout -->
      <div class="mt-8 max-w-2xl mx-auto">
        <div class="rounded-2xl bg-ink-50 border border-ink-100 p-5 text-center">
          <p class="text-sm text-ink-600">
            <span class="font-bold text-ink-800">One chip per matchweek.</span> Choose wisely — once you activate a chip, you can't use another one that same week. You can cancel before the first match kicks off.
          </p>
        </div>
      </div>
    </section>

    <!-- ============================================ -->
    <!-- MORE WAYS TO PLAY                            -->
    <!-- ============================================ -->
    <section class="bg-gradient-to-b from-white to-ink-50">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
        <div class="text-center mb-14 sm:mb-16">
          <div class="pill bg-coral-100 text-coral-700 mb-4 mx-auto">Game modes</div>
          <h2 class="text-3xl sm:text-4xl font-extrabold text-ink-900 tracking-tight">More ways to play</h2>
          <p class="mt-3 text-ink-500 text-base sm:text-lg max-w-lg mx-auto leading-relaxed">
            Beyond the weekly card — challenge friends, take on bonus quests, and build your streak.
          </p>
        </div>

        <div class="grid sm:grid-cols-2 gap-5 lg:gap-6">
          <div
            v-for="(mode, i) in modes"
            :key="mode.title"
            class="card group p-6 sm:p-7 flex items-start gap-5 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 animate-fade-up"
            :style="{ animationDelay: `${i * 0.1}s` }"
          >
            <div
              class="w-12 h-12 rounded-2xl grid place-items-center flex-shrink-0 transition-transform duration-300 group-hover:scale-110"
              :class="{
                'bg-coral-100': mode.color === 'coral',
                'bg-sky-100': mode.color === 'sky',
                'bg-mint-100': mode.color === 'mint',
                'bg-sun-100': mode.color === 'sun',
              }"
            >
              <!-- Swords -->
              <svg v-if="mode.icon === 'swords'" class="w-6 h-6" :class="{ 'text-coral-600': mode.color === 'coral' }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M14.5 17.5L3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2M15 4l3-1 1 3-2 2-4-4 2-1zM5 14l3-3" />
              </svg>
              <!-- Compass -->
              <svg v-else-if="mode.icon === 'compass'" class="w-6 h-6" :class="{ 'text-sky-600': mode.color === 'sky' }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9" stroke-width="1.75" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M15.5 8.5l-2 5-5 2 2-5 5-2z" />
              </svg>
              <!-- Users -->
              <svg v-else-if="mode.icon === 'users'" class="w-6 h-6" :class="{ 'text-mint-600': mode.color === 'mint' }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <!-- Flame -->
              <svg v-else class="w-6 h-6" :class="{ 'text-sun-600': mode.color === 'sun' }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
              </svg>
            </div>
            <div class="space-y-2">
              <div class="flex items-center gap-2">
                <h3 class="text-base font-extrabold text-ink-900">{{ mode.title }}</h3>
                <span
                  class="pill text-[10px] py-0.5"
                  :class="{
                    'bg-coral-100 text-coral-700': mode.color === 'coral',
                    'bg-sky-100 text-sky-700': mode.color === 'sky',
                    'bg-mint-100 text-mint-700': mode.color === 'mint',
                    'bg-sun-100 text-sun-700': mode.color === 'sun',
                  }"
                >{{ mode.tag }}</span>
              </div>
              <p class="text-sm text-ink-500 leading-relaxed">{{ mode.description }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ============================================ -->
    <!-- FEATURES SHOWCASE                            -->
    <!-- ============================================ -->
    <section class="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
      <div class="text-center mb-16 sm:mb-20">
        <div class="pill bg-sun-100 text-sun-700 mb-4 mx-auto">Features</div>
        <h2 class="text-3xl sm:text-4xl font-extrabold text-ink-900 tracking-tight">Built for real competition</h2>
        <p class="mt-3 text-ink-500 text-base sm:text-lg max-w-lg mx-auto leading-relaxed">
          Everything you need to predict, compete, and win — all in one place.
        </p>
      </div>

      <div class="space-y-20 sm:space-y-28">
        <div
          v-for="(feature, i) in features"
          :key="feature.title"
          class="grid md:grid-cols-2 gap-10 md:gap-16 items-center animate-fade-up"
          :style="{ animationDelay: `${i * 0.1}s` }"
        >
          <!-- Image -->
          <div
            :class="{ 'md:order-2': feature.reversed }"
          >
            <div class="relative">
              <div
                class="absolute -inset-4 rounded-3xl opacity-40"
                :class="{
                  'bg-sky-100': feature.badgeColor === 'sky',
                  'bg-mint-100': feature.badgeColor === 'mint',
                  'bg-sun-100': feature.badgeColor === 'sun',
                }"
              />
              <div
                class="relative rounded-2xl overflow-hidden border border-ink-100 shadow-soft flex items-center justify-center"
                :class="{
                  'bg-sky-50': feature.badgeColor === 'sky',
                  'bg-mint-50': feature.badgeColor === 'mint',
                  'bg-sun-50': feature.badgeColor === 'sun',
                }"
              >
                <img
                  :src="feature.image"
                  :alt="feature.title"
                  class="w-auto h-auto max-w-[220px] sm:max-w-[260px] max-h-56 sm:max-h-64 object-contain mx-auto py-8 px-6"
                  loading="lazy"
                />
              </div>
            </div>
          </div>

          <!-- Text -->
          <div :class="{ 'md:order-1': feature.reversed }">
            <div
              class="pill mb-4"
              :class="{
                'bg-sky-100 text-sky-700': feature.badgeColor === 'sky',
                'bg-mint-100 text-mint-700': feature.badgeColor === 'mint',
                'bg-sun-100 text-sun-700': feature.badgeColor === 'sun',
              }"
            >
              {{ feature.badge }}
            </div>
            <h3 class="text-2xl sm:text-3xl font-extrabold text-ink-900 mb-4 tracking-tight">{{ feature.title }}</h3>
            <p class="text-base sm:text-lg text-ink-500 leading-relaxed mb-6">{{ feature.description }}</p>
            <ClientOnly>
              <NuxtLink
                :to="user ? '/predict' : '/login'"
                class="group inline-flex items-center gap-2 text-sm font-bold transition-colors"
                :class="{
                  'text-sky-600 hover:text-sky-700': feature.badgeColor === 'sky',
                  'text-mint-600 hover:text-mint-700': feature.badgeColor === 'mint',
                  'text-sun-600 hover:text-sun-700': feature.badgeColor === 'sun',
                }"
              >
                {{ user ? 'Start predicting' : 'Get started' }}
                <svg class="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              </NuxtLink>
            </ClientOnly>
          </div>
        </div>
      </div>
    </section>

    <!-- ============================================ -->
    <!-- TRUST / SOCIAL PROOF                         -->
    <!-- ============================================ -->
    <section class="border-y border-ink-100 bg-white">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-16">
        <div class="flex flex-col sm:flex-row items-center justify-between gap-8">
          <!-- Powered by -->
          <div class="flex items-center gap-3 flex-shrink-0">
            <img src="/logo.png" alt="Sycamore" class="h-8 sm:h-9 w-auto object-contain" />
            <div class="border-l border-ink-200 pl-3">
              <div class="text-[10px] font-bold text-ink-400 uppercase tracking-wider leading-none">Powered by</div>
              <div class="text-sm font-extrabold text-ink-800 mt-0.5">Sycamore</div>
            </div>
          </div>

          <!-- Trust points -->
          <div class="flex flex-wrap items-center justify-center gap-5 sm:gap-7">
            <div
              v-for="point in trustPoints"
              :key="point.text"
              class="flex items-center gap-2"
            >
              <!-- Shield -->
              <svg v-if="point.icon === 'shield'" class="w-[18px] h-[18px] text-mint-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <!-- Lock -->
              <svg v-else-if="point.icon === 'lock'" class="w-[18px] h-[18px] text-sky-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <!-- Zap -->
              <svg v-else-if="point.icon === 'zap'" class="w-[18px] h-[18px] text-sun-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <!-- Users -->
              <svg v-else class="w-[18px] h-[18px] text-coral-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span class="text-sm font-semibold text-ink-600 whitespace-nowrap">{{ point.text }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ============================================ -->
    <!-- COMMUNITY                                    -->
    <!-- ============================================ -->
    <section class="bg-gradient-to-b from-ink-50 to-white">
      <div class="max-w-5xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
        <div class="text-center mb-12 sm:mb-14">
          <div class="pill bg-emerald-100 text-emerald-700 mb-4 mx-auto">Community</div>
          <h2 class="text-3xl sm:text-4xl font-extrabold text-ink-900 tracking-tight">Join the conversation</h2>
          <p class="mt-3 text-ink-500 text-base sm:text-lg max-w-lg mx-auto leading-relaxed">
            Predicting is more fun together. Trade tips, share your wins, and settle the banter with fellow players.
          </p>
        </div>

        <div class="grid sm:grid-cols-2 gap-5 lg:gap-6">
          <!-- WhatsApp community -->
          <a
            :href="WHATSAPP_COMMUNITY_URL"
            target="_blank"
            rel="noreferrer"
            class="card group relative overflow-hidden p-6 sm:p-8 flex items-center gap-5 hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
          >
            <div class="w-14 h-14 rounded-2xl bg-emerald-500 grid place-items-center shrink-0 shadow-soft">
              <svg class="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <h3 class="text-lg font-extrabold text-ink-900 group-hover:text-emerald-700 transition">WhatsApp community</h3>
                <span class="pill bg-emerald-100 text-emerald-700 text-[10px] font-bold">Live</span>
              </div>
              <p class="text-sm text-ink-500 leading-relaxed mt-1">Chat with other players, share tips and banter throughout the season.</p>
              <span class="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-600 mt-3">
                Join the group
                <svg class="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              </span>
            </div>
          </a>

          <!-- FPL group placeholder -->
          <div class="card relative overflow-hidden p-6 sm:p-8 flex items-center gap-5 opacity-90">
            <div class="w-14 h-14 rounded-2xl bg-ink-200 grid place-items-center shrink-0">
              <svg class="w-7 h-7 text-ink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <h3 class="text-lg font-extrabold text-ink-900">Fantasy Premier League group</h3>
                <span class="pill bg-ink-100 text-ink-500 text-[10px] font-bold">Coming soon</span>
              </div>
              <p class="text-sm text-ink-500 leading-relaxed mt-1">Our official FPL mini-league is on the way. Check back soon for the join details.</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ============================================ -->
    <!-- FINAL CTA                                    -->
    <!-- ============================================ -->
    <section class="relative overflow-hidden">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
        <div class="relative rounded-3xl bg-gradient-to-br from-ink-900 via-ink-800 to-sky-900 overflow-hidden">
          <!-- Background pattern -->
          <div
            class="absolute inset-0 opacity-[0.03]"
            style="background-image: url('/Group_(1).svg'); background-size: 200px; background-repeat: repeat;"
          />
          <!-- Glow -->
          <div class="absolute -top-20 right-0 w-96 h-96 rounded-full bg-sky-500/10 blur-[100px]" />

          <div class="relative z-10 px-6 sm:px-12 lg:px-20 py-16 sm:py-20 text-center">
            <h2 class="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight mb-4">
              Ready to play?
            </h2>
            <p class="text-base sm:text-lg text-ink-300 max-w-lg mx-auto leading-relaxed mb-8">
              Join thousands of Sycamore customers already competing every week. Sign in with just your email — no downloads, no passwords.
            </p>

            <ClientOnly>
              <div class="flex flex-col sm:flex-row items-center justify-center gap-3">
                <NuxtLink
                  :to="user ? '/predict' : '/login'"
                  class="group inline-flex items-center justify-center gap-2.5 rounded-xl bg-sky-600 text-white font-bold text-sm px-8 py-4 hover:bg-sky-500 transition-all duration-200 shadow-pop hover:shadow-lg hover:shadow-sky-500/25 w-full sm:w-auto"
                >
                  {{ user ? 'Make your predictions' : 'Get started — it\'s free' }}
                  <svg class="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </NuxtLink>
                <NuxtLink
                  to="/faq"
                  class="inline-flex items-center justify-center gap-2 rounded-xl bg-white/[0.08] border border-white/[0.12] text-white font-bold text-sm px-8 py-4 hover:bg-white/[0.14] transition-all duration-200 w-full sm:w-auto"
                >
                  Learn more
                </NuxtLink>
              </div>
            </ClientOnly>

            <!-- Micro trust -->
            <p class="mt-8 text-xs text-ink-500 flex items-center justify-center gap-1.5">
              <svg class="w-3.5 h-3.5 text-mint-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Free to play · No app required · Open to all Sycamore customers
            </p>
          </div>
        </div>
      </div>
    </section>

  </div>
</template>
