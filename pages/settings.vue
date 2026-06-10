<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const supabase = useSupabase()
const functions = useFunctions()
const { user, setSession, isGuest, refreshUser, trackPulseEvent } = useAuth()
const { generate } = useRandomUsername()

const username = ref('')
const twitter = ref('')
const instagram = ref('')
const threads = ref('')
const tiktok = ref('')

const saving = ref(false)
const saved = ref(false)
const error = ref('')
const usernameError = ref('')

onMounted(() => {
  if (user.value) {
    username.value = user.value.username || ''
    const handles = user.value.social_handles || {}
    twitter.value = handles.twitter || ''
    instagram.value = handles.instagram || ''
    threads.value = handles.threads || ''
    tiktok.value = handles.tiktok || ''
  }
})

const suggestion = ref(generate())
const regenerate = () => { suggestion.value = generate() }
const useSuggestion = () => { username.value = suggestion.value }

const isUsernameValid = computed(() => {
  const v = username.value.trim()
  return v.length >= 3 && v.length <= 24 && /^[a-zA-Z0-9_-]+$/.test(v)
})

const stripAt = (val: string) => val.replace(/^@/, '').trim()

const save = async () => {
  error.value = ''
  usernameError.value = ''
  saved.value = false

  const trimmedUsername = username.value.trim().toLowerCase()
  if (!isUsernameValid.value) {
    usernameError.value = '3-24 characters, letters, numbers, hyphens, or underscores only.'
    return
  }

  saving.value = true

  const social_handles = {
    twitter: stripAt(twitter.value) || null,
    instagram: stripAt(instagram.value) || null,
    threads: stripAt(threads.value) || null,
    tiktok: stripAt(tiktok.value) || null,
  }

  try {
    await functions.call('profile-update', {
      user_id: user.value!.id,
      email: user.value!.email,
      username: trimmedUsername,
      social_handles,
    })
  } catch (err: any) {
    const msg = err.message || ''
    if (msg.includes('already taken') || msg.includes('username_taken')) {
      usernameError.value = 'This username is already taken.'
    } else {
      error.value = msg
    }
    saving.value = false
    return
  }

  await refreshUser()
  trackPulseEvent('profile_updated', {
    username_changed: trimmedUsername !== (user.value?.username || ''),
    has_twitter: !!social_handles.twitter,
    has_instagram: !!social_handles.instagram,
    has_threads: !!social_handles.threads,
    has_tiktok: !!social_handles.tiktok,
  })
  saving.value = false
  saved.value = true
  setTimeout(() => { saved.value = false }, 3000)
}
</script>

<template>
  <div class="max-w-lg mx-auto space-y-8">
    <div>
      <h1 class="text-2xl font-extrabold text-ink-900">Settings</h1>
      <p class="mt-1 text-sm text-ink-500">Manage your profile and social media handles.</p>
    </div>

    <form @submit.prevent="save" class="card p-6 sm:p-8 space-y-6">
      <!-- Username -->
      <div>
        <label class="label">Username</label>
        <input
          v-model="username"
          type="text"
          maxlength="24"
          class="input"
          placeholder="your-username"
        />
        <p v-if="usernameError" class="mt-1.5 text-xs text-coral-600">{{ usernameError }}</p>
        <div class="flex items-center gap-2 mt-2 p-2.5 rounded-lg bg-ink-50 border border-ink-100">
          <span class="text-[11px] text-ink-400">Suggestion:</span>
          <span class="text-xs font-bold text-ink-700">{{ suggestion }}</span>
          <button type="button" @click="useSuggestion" class="ml-auto text-[11px] font-semibold text-sky-600 hover:text-sky-700">Use</button>
          <button type="button" @click="regenerate" class="text-ink-400 hover:text-ink-600">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          </button>
        </div>
      </div>

      <hr class="border-ink-100" />

      <div>
        <h2 class="font-bold text-ink-900 mb-1">Social Media</h2>
        <p class="text-xs text-ink-400 mb-4">Add your handles so we can tag you when you win.</p>

        <div class="space-y-4">
          <!-- Twitter/X -->
          <div>
            <label class="label flex items-center gap-2">
              <svg class="w-4 h-4 text-ink-600" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              X (Twitter)
            </label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 text-sm">@</span>
              <input v-model="twitter" type="text" class="input pl-8" placeholder="handle" maxlength="30" />
            </div>
          </div>

          <!-- Instagram -->
          <div>
            <label class="label flex items-center gap-2">
              <svg class="w-4 h-4 text-ink-600" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
              Instagram
            </label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 text-sm">@</span>
              <input v-model="instagram" type="text" class="input pl-8" placeholder="handle" maxlength="30" />
            </div>
          </div>

          <!-- Threads -->
          <div>
            <label class="label flex items-center gap-2">
              <svg class="w-4 h-4 text-ink-600" viewBox="0 0 24 24" fill="currentColor"><path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.91 3.59 12c.025 3.088.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.96-.065-1.18.408-2.26 1.332-3.041.88-.744 2.107-1.173 3.553-1.241 1.06-.05 2.049.058 2.953.315-.105-1.16-.573-2.016-1.391-2.54-.866-.553-2.022-.779-3.44-.673l-.164-2.093c1.849-.137 3.42.2 4.68 1.004 1.226.782 2.006 1.996 2.253 3.51.034.11.06.217.08.321 1.003.48 1.835 1.138 2.47 1.96 1.014 1.311 1.442 2.9 1.24 4.598-.268 2.263-1.452 4.057-3.423 5.19C17.085 23.344 14.89 23.978 12.186 24zm.042-8.467c-1.075.052-1.9.334-2.39.818-.39.387-.572.862-.543 1.415.033.6.347 1.1.883 1.449.6.388 1.384.558 2.265.516 1.07-.058 1.9-.453 2.467-1.158.46-.573.767-1.347.916-2.313-.948-.32-2.019-.478-3.072-.478-.177 0-.353.005-.526.015v-.264z"/></svg>
              Threads
            </label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 text-sm">@</span>
              <input v-model="threads" type="text" class="input pl-8" placeholder="handle" maxlength="30" />
            </div>
          </div>

          <!-- TikTok -->
          <div>
            <label class="label flex items-center gap-2">
              <svg class="w-4 h-4 text-ink-600" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.88 2.89 2.89 0 01-2.88-2.88 2.89 2.89 0 012.88-2.88c.28 0 .56.04.82.11V9.4a6.33 6.33 0 00-.82-.05A6.34 6.34 0 003.15 15.7a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V9.42a8.16 8.16 0 004.76 1.52V7.5a4.85 4.85 0 01-1-.81z"/></svg>
              TikTok
            </label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 text-sm">@</span>
              <input v-model="tiktok" type="text" class="input pl-8" placeholder="handle" maxlength="30" />
            </div>
          </div>
        </div>
      </div>

      <p v-if="error" class="text-xs text-coral-600 bg-coral-50 rounded-lg px-3 py-2">{{ error }}</p>

      <div class="flex items-center gap-3">
        <button type="submit" class="btn-primary" :disabled="saving">
          {{ saving ? 'Saving...' : 'Save changes' }}
        </button>
        <Transition
          enter-active-class="transition duration-200"
          enter-from-class="opacity-0 translate-x-2"
          enter-to-class="opacity-100 translate-x-0"
          leave-active-class="transition duration-150"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0"
        >
          <span v-if="saved" class="text-sm font-semibold text-mint-600 flex items-center gap-1.5">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
            Saved
          </span>
        </Transition>
      </div>
    </form>
  </div>
</template>
