<script setup lang="ts">
const props = defineProps<{
  text: string
  url?: string
  title?: string
}>()

const emit = defineEmits<{ close: [] }>()

const { canNativeShare, nativeShare, shareToTwitter, shareToWhatsApp, shareToThreads, copyToClipboard, siteUrl } = useShare()
const copied = ref(false)

const shareUrl = computed(() => props.url || siteUrl)

const doNativeShare = async () => {
  await nativeShare({ text: props.text, url: shareUrl.value, title: props.title })
  emit('close')
}

const doCopy = async () => {
  await copyToClipboard({ text: props.text, url: shareUrl.value })
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}

const platforms = [
  { id: 'whatsapp', label: 'WhatsApp', color: 'bg-[#25D366]', icon: 'M' },
  { id: 'twitter', label: 'X / Twitter', color: 'bg-[#000000]', icon: 'X' },
  { id: 'threads', label: 'Threads', color: 'bg-[#000000]', icon: '@' },
]

const shareTo = (platform: string) => {
  const opts = { text: props.text, url: shareUrl.value, title: props.title }
  if (platform === 'whatsapp') shareToWhatsApp(opts)
  else if (platform === 'twitter') shareToTwitter(opts)
  else if (platform === 'threads') shareToThreads(opts)
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm" @click.self="$emit('close')">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-fade-up">
        <div class="p-6 space-y-5">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-extrabold text-ink-900">Share</h3>
            <button @click="$emit('close')" class="w-8 h-8 rounded-lg hover:bg-ink-100 grid place-items-center text-ink-500 transition">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          <!-- Preview -->
          <div class="rounded-xl bg-ink-50 p-4">
            <p class="text-sm text-ink-700 whitespace-pre-line leading-relaxed">{{ text }}</p>
            <p v-if="shareUrl" class="text-xs text-ink-400 mt-2 truncate">{{ shareUrl }}</p>
          </div>

          <!-- Native share button (mobile) -->
          <button
            v-if="canNativeShare"
            @click="doNativeShare"
            class="w-full btn-primary py-3 text-sm flex items-center justify-center gap-2"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
            Share
          </button>

          <!-- Platform buttons -->
          <div class="grid grid-cols-3 gap-3">
            <button
              v-for="p in platforms"
              :key="p.id"
              @click="shareTo(p.id)"
              class="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-ink-50 transition"
            >
              <div :class="[p.color, 'w-12 h-12 rounded-full grid place-items-center text-white text-lg font-bold']">
                {{ p.icon }}
              </div>
              <span class="text-xs font-semibold text-ink-700">{{ p.label }}</span>
            </button>
          </div>

          <!-- Copy link -->
          <button
            @click="doCopy"
            class="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-ink-100 text-sm font-semibold text-ink-700 hover:bg-ink-50 transition"
          >
            <svg v-if="!copied" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
            <svg v-else class="w-4 h-4 text-mint-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
            {{ copied ? 'Copied!' : 'Copy to clipboard' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
