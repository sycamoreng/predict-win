<script setup lang="ts">
const router = useRouter()
const { config: campaign, load: loadCampaign } = useCampaign()
const { setSession, loadParticipation, trackPulseEvent } = useAuth()
const loading = ref(true)

definePageMeta({ layout: false })

const runtimeConfig = useRuntimeConfig()
const supabaseUrl = runtimeConfig.public.supabaseUrl as string
const supabaseAnonKey = runtimeConfig.public.supabaseAnonKey as string

const step = ref<'email' | 'code'>('email')
const email = ref('')
const code = ref('')
const submitting = ref(false)
const error = ref('')
const devCode = ref('')
const isNewUser = ref(false)

const supabase = useSupabase()
const kickoff = ref<string | null>(null)
const now = ref(Date.now())
let ticker: ReturnType<typeof setInterval> | null = null

onMounted(async () => {
  await loadCampaign()
  loading.value = false

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
})

onUnmounted(() => { if (ticker) clearInterval(ticker) })

const hasCampaign = computed(() => !!campaign.value.id)
const campaignName = computed(() => campaign.value.name || 'Predictor League')
const campaignEnded = computed(() => campaign.value.campaign_ended)
const registrationOpen = computed(() => campaign.value.registration_open)
const accessOpen = computed(() => campaign.value.public_access_enabled)

const pad = (n: number) => String(n).padStart(2, '0')
const countdown = computed(() => {
  if (!kickoff.value) return null
  const diff = new Date(kickoff.value).getTime() - now.value
  if (diff <= 0) return { over: true, days: 0, hours: 0, minutes: 0, seconds: 0 }
  return {
    over: false,
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  }
})

const requestOtp = async () => {
  error.value = ''
  if (!email.value.trim()) {
    error.value = 'Please enter your email address.'
    return
  }
  submitting.value = true
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/auth-otp/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({ email: email.value.trim().toLowerCase() }),
    })
    const data = await res.json()
    if (!res.ok && !data.devCode) {
      error.value = data.error || 'Something went wrong. Please try again.'
      return
    }
    isNewUser.value = !!data.isNewUser
    if (data.devCode) devCode.value = data.devCode
    step.value = 'code'
  } catch {
    error.value = 'Could not connect. Please check your internet and try again.'
  } finally {
    submitting.value = false
  }
}

const verifyOtp = async () => {
  error.value = ''
  const trimmed = code.value.trim()
  if (!trimmed || trimmed.length !== 6) {
    error.value = 'Please enter the 6-digit code.'
    return
  }
  submitting.value = true
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/auth-otp/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({ email: email.value.trim().toLowerCase(), code: trimmed }),
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      error.value = data.error || 'Invalid code. Please try again.'
      return
    }
    setSession(data.user)
    trackPulseEvent('signed_in', { method: 'otp', is_guest: !!data.user.is_guest })

    if (campaign.value.id && data.user.id) {
      await loadParticipation(campaign.value.id)
    }

    router.push(isNewUser.value ? '/team' : '/predict')
  } catch {
    error.value = 'Could not verify. Please check your internet and try again.'
  } finally {
    submitting.value = false
  }
}

const goBack = () => {
  step.value = 'email'
  code.value = ''
  error.value = ''
  devCode.value = ''
}

const handleCodeInput = (event: Event) => {
  const input = event.target as HTMLInputElement
  code.value = input.value.replace(/\D/g, '').slice(0, 6)
}
</script>

<template>
  <div class="login-page min-h-screen flex flex-col md:flex-row bg-white">

    <!-- ============================================================ -->
    <!-- LEFT PANEL – desktop branding showcase                        -->
    <!-- ============================================================ -->
    <div
      class="hidden md:flex md:w-[44%] lg:w-[40%] relative overflow-hidden flex-col justify-between p-10 lg:p-12"
      style="background: linear-gradient(160deg, #0f1729 0%, #132040 40%, #0c3a6e 100%);"
    >
      <!-- Subtle dot-grid pattern overlay -->
      <div class="absolute inset-0 opacity-[0.04]" style="background-image: radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px); background-size: 24px 24px;" />

      <!-- Soft radial glow -->
      <div class="absolute top-1/4 -right-20 w-80 h-80 rounded-full opacity-[0.08]" style="background: radial-gradient(circle, #38bdf8 0%, transparent 70%);" />
      <div class="absolute bottom-1/4 -left-16 w-64 h-64 rounded-full opacity-[0.06]" style="background: radial-gradient(circle, #34d399 0%, transparent 70%);" />

      <!-- Floating match score cards -->
      <div class="match-card absolute top-[18%] right-8 bg-white/[0.07] backdrop-blur-sm border border-white/[0.08] rounded-xl px-4 py-2.5 text-white animate-float-slow">
        <div class="flex items-center gap-3 text-xs font-bold tracking-wide">
          <span>ARS</span>
          <span class="text-sky-400 text-sm font-extrabold">2 — 1</span>
          <span>CHE</span>
        </div>
        <div class="text-[10px] text-white/40 mt-0.5 text-center">FT</div>
      </div>

      <div class="match-card absolute top-[42%] right-16 bg-white/[0.07] backdrop-blur-sm border border-white/[0.08] rounded-xl px-4 py-2.5 text-white animate-float-medium">
        <div class="flex items-center gap-3 text-xs font-bold tracking-wide">
          <span>LIV</span>
          <span class="text-mint-400 text-sm font-extrabold">3 — 0</span>
          <span>MUN</span>
        </div>
        <div class="text-[10px] text-white/40 mt-0.5 text-center">FT</div>
      </div>

      <div class="match-card absolute bottom-[30%] right-10 bg-white/[0.07] backdrop-blur-sm border border-white/[0.08] rounded-xl px-4 py-2.5 text-white animate-float-fast">
        <div class="flex items-center gap-3 text-xs font-bold tracking-wide">
          <span>BAR</span>
          <span class="text-sun-400 text-sm font-extrabold">1 — 1</span>
          <span>RMA</span>
        </div>
        <div class="text-[10px] text-white/40 mt-0.5 text-center">FT</div>
      </div>

      <!-- Small decorative shapes -->
      <div class="absolute top-[12%] left-[55%] w-3 h-3 rounded-full bg-sky-500/20 animate-pulse" />
      <div class="absolute top-[60%] left-[30%] w-2 h-2 rounded-full bg-mint-400/20 animate-pulse" style="animation-delay: 1s;" />
      <div class="absolute bottom-[18%] left-[60%] w-2.5 h-2.5 rounded-full bg-sun-400/15 animate-pulse" style="animation-delay: 2s;" />

      <!-- Top: Logo -->
      <div class="relative z-10">
        <img src="/logo-white.png" alt="Sycamore" class="h-8 w-auto opacity-90" />
      </div>

      <!-- Center: Tagline & Campaign Info -->
      <div class="relative z-10 space-y-6">
        <div>
          <h2 class="text-3xl lg:text-[2.5rem] font-extrabold text-white leading-[1.1] tracking-tight">
            Predict.<br />
            Compete.<br />
            <span class="text-sky-400">Win.</span>
          </h2>
          <div class="mt-4 w-12 h-1 rounded-full bg-gradient-to-r from-sky-400 to-mint-400" />
        </div>

        <p class="text-sky-200/60 text-sm leading-relaxed max-w-[260px]">
          <template v-if="hasCampaign && !campaignEnded">
            <span class="text-white/90 font-semibold">{{ campaignName }}</span> is live.<br />
            Make your predictions and climb the leaderboard.
          </template>
          <template v-else-if="campaignEnded">
            <span class="text-white/90 font-semibold">{{ campaignName }}</span> has concluded.<br />
            Thank you to everyone who played!
          </template>
          <template v-else>
            No active campaign right now.<br />
            Check back soon for the next challenge.
          </template>
        </p>

        <!-- Feature pills -->
        <div class="flex flex-wrap gap-2" v-if="hasCampaign && !campaignEnded">
          <span class="inline-flex items-center gap-1.5 rounded-full bg-white/[0.08] border border-white/[0.06] px-3 py-1 text-[11px] font-medium text-white/70">
            <svg class="w-3 h-3 text-sky-400" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L11 6.477V16h2a1 1 0 110 2H7a1 1 0 110-2h2V6.477L6.237 7.582l1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.789l1.599.799L9 4.323V3a1 1 0 011-1z"/></svg>
            Leaderboard
          </span>
          <span class="inline-flex items-center gap-1.5 rounded-full bg-white/[0.08] border border-white/[0.06] px-3 py-1 text-[11px] font-medium text-white/70">
            <svg class="w-3 h-3 text-mint-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
            Power-ups
          </span>
          <span class="inline-flex items-center gap-1.5 rounded-full bg-white/[0.08] border border-white/[0.06] px-3 py-1 text-[11px] font-medium text-white/70">
            <svg class="w-3 h-3 text-sun-400" fill="currentColor" viewBox="0 0 20 20"><path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"/></svg>
            Free to play
          </span>
        </div>
      </div>

      <!-- Bottom: Copyright -->
      <p class="relative z-10 text-white/25 text-[11px]">&copy; 2026 Sycamore. All rights reserved.</p>
    </div>

    <!-- ============================================================ -->
    <!-- RIGHT PANEL – login form                                      -->
    <!-- ============================================================ -->
    <div class="flex-1 flex items-center justify-center px-6 py-10 sm:py-16 bg-white relative">
      <!-- Subtle background texture on right panel -->
      <div class="absolute inset-0 opacity-[0.015]" style="background-image: radial-gradient(circle, #94a3b8 1px, transparent 1px); background-size: 20px 20px;" />

      <div class="w-full max-w-[380px] relative z-10">
        <!-- Mobile header -->
        <div class="md:hidden flex items-center justify-center gap-2.5 mb-10">
          <img src="/Group.png" alt="Sycamore" class="h-7 w-7" />
          <span class="text-sm font-extrabold text-ink-900 tracking-tight">Predictor League</span>
        </div>

        <!-- ====== LOADING STATE ====== -->
        <div v-if="loading" class="space-y-6">
          <div class="flex flex-col items-center gap-4 animate-pulse">
            <div class="w-[72px] h-[72px] rounded-2xl bg-ink-100" />
            <div class="space-y-2.5 w-full flex flex-col items-center">
              <div class="h-6 bg-ink-100 rounded-lg w-44" />
              <div class="h-4 bg-ink-50 rounded w-56" />
            </div>
            <div class="w-full mt-4 space-y-3">
              <div class="h-12 bg-ink-50 rounded-xl w-full" />
              <div class="h-12 bg-ink-100 rounded-xl w-full" />
            </div>
          </div>
        </div>

        <!-- ====== ACCESS NOT OPEN YET ====== -->
        <Transition name="step" mode="out-in">
          <div v-if="!loading && !accessOpen" key="not-open" class="text-center space-y-6">
            <div class="w-[72px] h-[72px] mx-auto rounded-2xl bg-sun-50 border border-sun-100 grid place-items-center">
              <svg class="w-9 h-9 text-sun-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>

            <div>
              <h1 class="text-2xl font-extrabold text-ink-900 tracking-tight">We're not open just yet</h1>
              <p class="mt-3 text-sm text-ink-500 leading-relaxed max-w-xs mx-auto">
                Sign-in and predictions haven't gone live for this season yet. Hang tight — the moment the game opens, you'll be able to log in and make your picks right here.
              </p>
            </div>

            <div v-if="countdown && !countdown.over" class="flex items-stretch gap-2 max-w-xs mx-auto">
              <div
                v-for="unit in [
                  { label: 'Days', value: countdown.days },
                  { label: 'Hours', value: countdown.hours },
                  { label: 'Mins', value: countdown.minutes },
                  { label: 'Secs', value: countdown.seconds },
                ]"
                :key="unit.label"
                class="flex-1 min-w-0 rounded-xl bg-ink-50 border border-ink-100 px-1.5 py-2.5 text-center"
              >
                <div class="text-lg sm:text-xl font-extrabold text-ink-900 tabular-nums leading-none">{{ pad(unit.value) }}</div>
                <div class="text-[9px] font-semibold text-ink-400 uppercase tracking-wider mt-1">{{ unit.label }}</div>
              </div>
            </div>
            <p v-if="countdown && !countdown.over" class="text-xs text-ink-400">Until the first kick-off</p>

            <NuxtLink
              to="/"
              class="inline-flex items-center gap-2 text-sm font-semibold text-sky-600 hover:text-sky-700 transition-colors"
            >
              Back to home
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </NuxtLink>
          </div>

          <!-- ====== NO CAMPAIGN / ENDED ====== -->
          <div v-else-if="!loading && (!hasCampaign || campaignEnded)" key="no-campaign" class="text-center space-y-6">
            <div class="w-[72px] h-[72px] mx-auto rounded-2xl bg-ink-50 border border-ink-100 grid place-items-center">
              <svg class="w-9 h-9 text-ink-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>

            <div>
              <h1 class="text-2xl font-extrabold text-ink-900 tracking-tight">
                {{ campaignEnded ? 'Campaign has ended' : 'No active campaign' }}
              </h1>
              <p class="mt-3 text-sm text-ink-500 leading-relaxed max-w-xs mx-auto">
                {{ campaignEnded
                  ? `The ${campaignName} is no longer active. We're not accepting new sign-ups or predictions at this time.`
                  : 'There is no prediction challenge running right now. Check back soon for the next one!' }}
              </p>
            </div>

            <a
              href="https://sycamore.ng"
              target="_blank"
              rel="noreferrer"
              class="inline-flex items-center gap-2 text-sm font-semibold text-sky-600 hover:text-sky-700 transition-colors"
            >
              Visit Sycamore
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </a>
          </div>

          <!-- ====== EMAIL STEP ====== -->
          <div v-else-if="!loading && step === 'email'" key="email-step" class="space-y-6">
            <div class="text-center space-y-4">
              <div class="w-[72px] h-[72px] mx-auto rounded-2xl bg-sky-50 border border-sky-100 grid place-items-center">
                <svg class="w-9 h-9 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>

              <div>
                <h1 class="text-2xl font-extrabold text-ink-900 tracking-tight">{{ campaignName }}</h1>
                <p class="mt-2 text-sm text-ink-500 leading-relaxed">
                  Sign in with your email to start predicting
                </p>
              </div>
            </div>

            <form @submit.prevent="requestOtp" class="space-y-4">
              <div>
                <label for="login-email" class="label">Email address</label>
                <input
                  id="login-email"
                  v-model="email"
                  type="email"
                  placeholder="you@example.com"
                  class="input"
                  :disabled="submitting"
                  autocomplete="email"
                  autofocus
                />
              </div>

              <!-- Error message -->
              <Transition name="step">
                <div v-if="error" class="flex items-start gap-2 rounded-xl bg-coral-50 border border-coral-100 px-3.5 py-2.5">
                  <svg class="w-4 h-4 text-coral-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                  </svg>
                  <p class="text-sm text-coral-700 font-medium">{{ error }}</p>
                </div>
              </Transition>

              <button
                type="submit"
                :disabled="submitting || !email.trim()"
                class="btn-primary w-full text-sm h-12"
              >
                <svg v-if="submitting" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {{ submitting ? 'Sending code…' : 'Send login code' }}
              </button>
            </form>

            <p class="text-center text-xs text-ink-400 leading-relaxed">
              We'll send a 6-digit code to your email.<br />No password needed.
            </p>
          </div>

          <!-- ====== CODE VERIFICATION STEP ====== -->
          <div v-else-if="!loading && step === 'code'" key="code-step" class="space-y-6">
            <div class="text-center space-y-4">
              <div class="w-[72px] h-[72px] mx-auto rounded-2xl bg-mint-50 border border-mint-100 grid place-items-center">
                <svg class="w-9 h-9 text-mint-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>

              <div>
                <h1 class="text-2xl font-extrabold text-ink-900 tracking-tight">Check your email</h1>
                <p class="mt-2 text-sm text-ink-500 leading-relaxed">
                  We sent a 6-digit code to<br />
                  <span class="font-bold text-ink-800">{{ email }}</span>
                </p>
              </div>
            </div>

            <!-- Dev code display -->
            <div v-if="devCode" class="bg-sun-50 border-2 border-dashed border-sun-300 rounded-xl p-4 text-center">
              <p class="text-[11px] font-bold text-sun-700 uppercase tracking-wider">Dev mode — your code</p>
              <p class="text-3xl font-extrabold text-sun-800 tracking-[0.35em] mt-1.5 font-mono">{{ devCode }}</p>
            </div>

            <form @submit.prevent="verifyOtp" class="space-y-4">
              <div>
                <label for="login-code" class="label text-center w-full block">Verification code</label>
                <input
                  id="login-code"
                  :value="code"
                  @input="handleCodeInput"
                  type="text"
                  inputmode="numeric"
                  pattern="[0-9]*"
                  maxlength="6"
                  placeholder="000000"
                  class="input text-center text-[1.75rem] font-extrabold tracking-[0.4em] placeholder:tracking-[0.4em] placeholder:text-ink-200 h-14"
                  :disabled="submitting"
                  autofocus
                  autocomplete="one-time-code"
                />
              </div>

              <!-- Error message -->
              <Transition name="step">
                <div v-if="error" class="flex items-start gap-2 rounded-xl bg-coral-50 border border-coral-100 px-3.5 py-2.5">
                  <svg class="w-4 h-4 text-coral-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                  </svg>
                  <p class="text-sm text-coral-700 font-medium">{{ error }}</p>
                </div>
              </Transition>

              <button
                type="submit"
                :disabled="submitting || code.length !== 6"
                class="btn-primary w-full text-sm h-12"
              >
                <svg v-if="submitting" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {{ submitting ? 'Verifying…' : 'Verify & sign in' }}
              </button>
            </form>

            <div class="text-center">
              <button
                @click="goBack"
                class="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-sky-600 font-medium transition-colors group"
              >
                <svg class="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Use a different email
              </button>
            </div>
          </div>
        </Transition>

        <!-- Mobile footer -->
        <div class="md:hidden mt-12 text-center">
          <a
            href="https://sycamore.ng"
            target="_blank"
            rel="noreferrer"
            class="inline-flex items-center gap-1.5 text-[11px] text-ink-400 hover:text-ink-600 transition-colors"
          >
            <img src="/Group.png" alt="" class="w-3.5 h-3.5 opacity-40" />
            <span>A product by <span class="font-semibold">Sycamore</span></span>
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Step transition */
.step-enter-active,
.step-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.step-enter-from {
  opacity: 0;
  transform: translateY(12px);
}
.step-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* Floating match card animations */
@keyframes float-slow {
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  50% { transform: translateY(-12px) rotate(1deg); }
}
@keyframes float-medium {
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  50% { transform: translateY(-8px) rotate(-1.5deg); }
}
@keyframes float-fast {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
}

.animate-float-slow {
  animation: float-slow 7s ease-in-out infinite;
}
.animate-float-medium {
  animation: float-medium 5s ease-in-out infinite;
  animation-delay: 1s;
}
.animate-float-fast {
  animation: float-fast 6s ease-in-out infinite;
  animation-delay: 2.5s;
}
</style>
