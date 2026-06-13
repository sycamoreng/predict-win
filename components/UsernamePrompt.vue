<script setup lang="ts">
const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{ done: [username: string] }>()

const supabase = useSupabase()
const { user, setSession, trackPulseEvent } = useAuth()
const { generate } = useRandomUsername()

const username = ref('')
const suggestion = ref(generate())
const saving = ref(false)
const error = ref('')

const useSuggestion = () => {
  username.value = suggestion.value
}

const regenerate = () => {
  suggestion.value = generate()
}

const isValid = computed(() => {
  const v = username.value.trim()
  return v.length >= 3 && v.length <= 24 && /^[a-zA-Z0-9_-]+$/.test(v)
})

const save = async () => {
  error.value = ''
  const trimmed = username.value.trim().toLowerCase()

  if (!isValid.value) {
    error.value = '3-24 characters, letters, numbers, hyphens, or underscores only.'
    return
  }

  saving.value = true
  const { error: dbError } = await supabase
    .from('synced_users')
    .update({ username: trimmed, username_set_by_user: true })
    .eq('id', user.value!.id)

  if (dbError) {
    if (dbError.message.includes('unique') || dbError.message.includes('duplicate')) {
      error.value = 'This username is already taken. Try another one.'
    } else {
      error.value = dbError.message
    }
    saving.value = false
    return
  }

  const updated = { ...user.value!, username: trimmed, username_set_by_user: true }
  setSession(updated)
  trackPulseEvent('username_set', { username: trimmed, method: 'manual' })
  emit('done', trimmed)
  saving.value = false
}

const skip = async () => {
  const fallback = suggestion.value.toLowerCase()
  saving.value = true

  const { error: dbError } = await supabase
    .from('synced_users')
    .update({ username: fallback, username_set_by_user: true })
    .eq('id', user.value!.id)

  if (dbError) {
    const retry = generate().toLowerCase()
    await supabase
      .from('synced_users')
      .update({ username: retry, username_set_by_user: true })
      .eq('id', user.value!.id)
    const updated = { ...user.value!, username: retry, username_set_by_user: true }
    setSession(updated)
    trackPulseEvent('username_set', { username: retry, method: 'skipped' })
    emit('done', retry)
  } else {
    const updated = { ...user.value!, username: fallback, username_set_by_user: true }
    setSession(updated)
    trackPulseEvent('username_set', { username: fallback, method: 'skipped' })
    emit('done', fallback)
  }
  saving.value = false
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50 backdrop-blur-sm">
        <div class="bg-white rounded-2xl p-6 sm:p-8 w-full max-w-md shadow-2xl animate-fade-up">
          <div class="text-center mb-6">
            <div class="w-14 h-14 rounded-2xl bg-sky-50 grid place-items-center mx-auto mb-4">
              <svg class="w-7 h-7 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
              </svg>
            </div>
            <h2 class="text-xl font-extrabold text-ink-900">Pick a username</h2>
            <p class="text-sm text-ink-500 mt-1">This is how you'll appear on the leaderboard.</p>
          </div>

          <div class="space-y-4">
            <div>
              <label class="label">Username</label>
              <input
                v-model="username"
                type="text"
                maxlength="24"
                placeholder="e.g. swift-falcon-7"
                class="input"
                :disabled="saving"
                @keydown.enter="save"
              />
              <p class="mt-1.5 text-[11px] text-ink-400">3-24 characters. Letters, numbers, hyphens, underscores.</p>
            </div>

            <div class="flex items-center gap-2 p-3 rounded-xl bg-ink-50 border border-ink-100">
              <span class="text-xs text-ink-500">Suggestion:</span>
              <span class="text-sm font-bold text-ink-800">{{ suggestion }}</span>
              <button
                type="button"
                @click="useSuggestion"
                class="ml-auto text-xs font-semibold text-sky-600 hover:text-sky-700 transition"
              >
                Use this
              </button>
              <button
                type="button"
                @click="regenerate"
                class="text-ink-400 hover:text-ink-600 transition"
                title="Generate another"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
              </button>
            </div>

            <p v-if="error" class="text-xs text-coral-600 bg-coral-50 rounded-lg px-3 py-2">{{ error }}</p>

            <button
              class="btn-primary w-full"
              :disabled="saving || !username.trim()"
              @click="save"
            >
              {{ saving ? 'Saving...' : 'Set username' }}
            </button>

            <button
              type="button"
              class="w-full text-center text-sm text-ink-400 hover:text-ink-600 transition py-1"
              :disabled="saving"
              @click="skip"
            >
              Skip for now (auto-assign one)
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
