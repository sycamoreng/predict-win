<script setup lang="ts">
const email = ref('')
const code = ref('')
const step = ref<'email' | 'otp'>('email')
const loading = ref(false)
const error = ref('')
const devCode = ref('')
const agreedToTerms = ref(false)

const { setSession, user } = useAuth()
const { call } = useFunctions()
const router = useRouter()

onMounted(() => {
  if (user.value) router.replace('/predict')
})

const requestOtp = async () => {
  error.value = ''
  if (!email.value.includes('@')) {
    error.value = 'Enter a valid email.'
    return
  }
  if (!agreedToTerms.value) {
    error.value = 'You must agree to the Terms & Conditions to continue.'
    return
  }
  loading.value = true
  try {
    const res = await call('auth-otp/request', { email: email.value })
    devCode.value = res.devCode || ''
    step.value = 'otp'
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

const verifyOtp = async () => {
  error.value = ''
  if (code.value.length !== 6) {
    error.value = 'Enter the 6-digit code.'
    return
  }
  loading.value = true
  try {
    const res = await call('auth-otp/verify', { email: email.value, code: code.value })
    setSession(res.user)
    await router.replace('/predict')
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex flex-col md:flex-row">
    <!-- Left branding panel (desktop only) -->
    <div class="hidden md:flex md:w-[42%] lg:w-[38%] bg-gradient-to-br from-ink-900 via-ink-800 to-sky-900 relative overflow-hidden flex-col justify-between p-8 lg:p-10">
      <div class="absolute inset-0 opacity-[0.03]" style="background-image: url('/Group_(1).svg'); background-size: 280px; background-repeat: repeat;" />

      <div class="relative z-10">
        <div class="flex items-center gap-2.5">
          <img src="/Group.png" alt="Sycamore" class="h-9 w-9" />
          <div class="leading-tight">
            <div class="font-extrabold text-white tracking-tight">Predictor League</div>
            <div class="text-[10px] uppercase tracking-widest text-sky-400 font-semibold">Sycamore</div>
          </div>
        </div>
      </div>

      <div class="relative z-10 space-y-5">
        <h2 class="text-2xl lg:text-3xl font-extrabold text-white leading-tight">
          Predict. Compete.<br />Win real rewards.
        </h2>

        <div class="space-y-2.5">
          <p class="text-[11px] uppercase tracking-wider font-bold text-sky-400">How it works</p>
          <div class="flex items-start gap-2.5">
            <span class="flex-shrink-0 w-6 h-6 rounded-full bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-[10px] font-bold text-sky-300">1</span>
            <div>
              <p class="text-white text-sm font-medium">Sign in with your email</p>
              <p class="text-ink-400 text-xs">Anyone can sign in and start predicting.</p>
            </div>
          </div>
          <div class="flex items-start gap-2.5">
            <span class="flex-shrink-0 w-6 h-6 rounded-full bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-[10px] font-bold text-sky-300">2</span>
            <div>
              <p class="text-white text-sm font-medium">Make your predictions</p>
              <p class="text-ink-400 text-xs">Pick match winners, first scorers, and exact scores.</p>
            </div>
          </div>
          <div class="flex items-start gap-2.5">
            <span class="flex-shrink-0 w-6 h-6 rounded-full bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-[10px] font-bold text-sky-300">3</span>
            <div>
              <p class="text-white text-sm font-medium">Become a Sycamore customer to win</p>
              <p class="text-ink-400 text-xs">Sign up on the app to unlock the leaderboard, team backing, and cash prizes.</p>
            </div>
          </div>
        </div>
      </div>

      <p class="relative z-10 text-ink-500 text-[11px]">&copy; 2026 Sycamore. All rights reserved.</p>
    </div>

    <!-- Right form panel -->
    <div class="flex-1 flex items-center justify-center px-5 py-8 sm:py-12">
      <div class="w-full max-w-sm">
        <!-- Mobile logo -->
        <div class="md:hidden flex items-center gap-2 mb-6">
          <img src="/Group.png" alt="Sycamore" class="h-7 w-7" />
          <span class="text-sm font-extrabold text-ink-900">Predictor League</span>
        </div>

        <div class="animate-fade-up">
          <!-- Email step -->
          <template v-if="step === 'email'">
            <h1 class="text-xl font-extrabold text-ink-900">Sign in to play</h1>
            <p class="mt-1 text-sm text-ink-500 mb-6">
              Enter your email to get started. Everyone can play!
            </p>

            <form @submit.prevent="requestOtp" class="space-y-4">
              <div>
                <label class="label">Email address</label>
                <input
                  v-model="email"
                  type="email"
                  placeholder="you@example.com"
                  class="input"
                  :disabled="loading"
                  autofocus
                />
              </div>

              <label class="flex items-start gap-2.5 cursor-pointer group">
                <input
                  v-model="agreedToTerms"
                  type="checkbox"
                  class="mt-0.5 w-4 h-4 rounded border-ink-300 text-sky-600 focus:ring-sky-500 focus:ring-2 transition"
                />
                <span class="text-xs text-ink-500 leading-relaxed group-hover:text-ink-700 transition">
                  I agree to the
                  <a href="https://sycamore.ng/terms" target="_blank" rel="noreferrer" class="text-sky-600 underline underline-offset-2">Terms &amp; Conditions</a>
                  and
                  <a href="https://sycamore.ng/privacy" target="_blank" rel="noreferrer" class="text-sky-600 underline underline-offset-2">Privacy Policy</a>.
                </span>
              </label>

              <p v-if="error" class="text-xs text-coral-600 bg-coral-50 rounded-lg px-3 py-2">{{ error }}</p>

              <button class="btn-primary w-full" :disabled="loading || !agreedToTerms">
                {{ loading ? 'Sending code...' : 'Continue' }}
              </button>
            </form>

            <!-- Mobile note -->
            <div class="md:hidden mt-6 rounded-lg bg-ink-50 p-3.5">
              <p class="text-xs font-semibold text-ink-700 mb-1">Want the full experience?</p>
              <p class="text-[11px] text-ink-500 leading-relaxed mb-2">
                Sycamore customers unlock the leaderboard, team backing, and cash prizes.
              </p>
              <a
                href="https://sycamore.ng"
                target="_blank"
                rel="noreferrer"
                class="text-xs font-semibold text-sky-600"
              >Get the Sycamore App &rarr;</a>
            </div>
          </template>

          <!-- OTP step -->
          <template v-else>
            <button
              type="button"
              @click="step = 'email'; code = ''"
              class="flex items-center gap-1 text-xs text-ink-400 hover:text-ink-700 transition mb-4"
            >
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <h1 class="text-xl font-extrabold text-ink-900">Enter your code</h1>
            <p class="mt-1 text-sm text-ink-500 mb-6">
              Sent to <span class="font-medium text-ink-700">{{ email }}</span>
            </p>

            <form @submit.prevent="verifyOtp" class="space-y-4">
              <div>
                <input
                  v-model="code"
                  inputmode="numeric"
                  maxlength="6"
                  placeholder="------"
                  class="input text-center text-xl tracking-[0.35em] font-bold py-3.5"
                  :disabled="loading"
                  autofocus
                />
                <p v-if="devCode" class="mt-2 text-xs text-ink-400 bg-mint-50 border border-mint-100 rounded-lg px-3 py-1.5">
                  Code: <span class="font-mono font-bold text-mint-700">{{ devCode }}</span>
                </p>
              </div>
              <p v-if="error" class="text-xs text-coral-600 bg-coral-50 rounded-lg px-3 py-2">{{ error }}</p>
              <button class="btn-primary w-full" :disabled="loading">
                {{ loading ? 'Verifying...' : 'Verify & sign in' }}
              </button>
              <p class="text-center text-xs text-ink-400">
                Didn't get it?
                <button type="button" @click="requestOtp" class="text-sky-600 font-semibold">Resend</button>
              </p>
            </form>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
