<script setup lang="ts">
definePageMeta({ layout: false })

const email = ref('')
const code = ref('')
const step = ref<'email' | 'otp'>('email')
const loading = ref(false)
const error = ref('')
const devCode = ref('')

const { setAdminSession, setAdminToken, admin } = useAuth()
const { call } = useFunctions()
const router = useRouter()

onMounted(() => {
  const { loadFromStorage } = useAuth()
  loadFromStorage()
  if (admin.value) router.replace('/admin')
})

const requestOtp = async () => {
  error.value = ''
  if (!email.value.includes('@')) {
    error.value = 'Enter a valid email.'
    return
  }
  loading.value = true
  try {
    const res = await call('auth-otp/admin-request', { email: email.value })
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
    const res = await call('auth-otp/admin-verify', { email: email.value, code: code.value })
    setAdminSession(res.admin)
    setAdminToken(res.admin_token || null)
    await router.replace('/admin')
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-ink-900 flex items-center justify-center p-4">
    <div class="w-full max-w-md">
      <div class="bg-ink-800 border border-ink-700 rounded-3xl p-8 shadow-2xl">
        <div class="text-center mb-8">
          <div class="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-500 to-mint-500 items-center justify-center text-white text-2xl shadow-lg mb-4">
            <span class="font-extrabold">A</span>
          </div>
          <h1 class="text-2xl font-extrabold text-white">
            {{ step === 'email' ? 'Admin sign-in' : 'Verify your code' }}
          </h1>
          <p class="mt-2 text-sm text-ink-400">
            {{ step === 'email'
              ? 'Sign in with your staff email to access the admin console.'
              : `We sent a 6-digit code to ${email}.` }}
          </p>
        </div>

        <form v-if="step === 'email'" @submit.prevent="requestOtp" class="space-y-5">
          <div>
            <label class="block text-xs font-semibold uppercase tracking-wider text-ink-400 mb-1.5">Staff email</label>
            <input
              v-model="email"
              type="email"
              placeholder="tech@sycamore.ng"
              class="w-full rounded-xl border border-ink-600 bg-ink-700 px-4 py-3 text-white placeholder-ink-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 transition"
              :disabled="loading"
              autofocus
            />
          </div>
          <p v-if="error" class="text-sm text-coral-400">{{ error }}</p>
          <button
            class="w-full rounded-xl bg-gradient-to-r from-sky-500 to-mint-500 px-4 py-3 text-white font-bold shadow-lg shadow-sky-700/20 hover:shadow-sky-700/30 hover:brightness-110 transition disabled:opacity-50"
            :disabled="loading"
          >
            {{ loading ? 'Sending...' : 'Send code' }}
          </button>
        </form>

        <form v-else @submit.prevent="verifyOtp" class="space-y-5">
          <div>
            <label class="block text-xs font-semibold uppercase tracking-wider text-ink-400 mb-1.5">6-digit code</label>
            <input
              v-model="code"
              inputmode="numeric"
              maxlength="6"
              placeholder="000000"
              class="w-full rounded-xl border border-ink-600 bg-ink-700 px-4 py-3 text-white text-center text-2xl tracking-[0.5em] font-bold placeholder-ink-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 transition"
              :disabled="loading"
              autofocus
            />
            <p v-if="devCode" class="mt-2 text-xs text-ink-400">
              Code: <span class="font-mono font-bold text-mint-400">{{ devCode }}</span>
            </p>
          </div>
          <p v-if="error" class="text-sm text-coral-400">{{ error }}</p>
          <button
            class="w-full rounded-xl bg-gradient-to-r from-sky-500 to-mint-500 px-4 py-3 text-white font-bold shadow-lg shadow-sky-700/20 hover:shadow-sky-700/30 hover:brightness-110 transition disabled:opacity-50"
            :disabled="loading"
          >
            {{ loading ? 'Verifying...' : 'Verify & sign in' }}
          </button>
          <button
            type="button"
            @click="step = 'email'; code = ''; error = ''"
            class="w-full rounded-xl border border-ink-600 px-4 py-2.5 text-sm text-ink-400 hover:text-white hover:border-ink-500 transition"
          >
            Use a different email
          </button>
        </form>

        <div class="mt-8 pt-5 border-t border-ink-700 text-center">
          <p class="text-xs text-ink-500">
            This portal is for authorized Sycamore staff only.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
