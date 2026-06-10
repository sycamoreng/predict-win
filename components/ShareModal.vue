<script setup lang="ts">
const props = defineProps<{
  text: string
  url?: string
  title?: string
}>()

const emit = defineEmits<{ close: [] }>()

const { canNativeShare, nativeShare, shareToTwitter, shareToWhatsApp, shareToThreads, copyToClipboard, siteUrl } = useShare()
const { trackPulseEvent } = useAuth()
const copied = ref(false)

const shareUrl = computed(() => props.url || siteUrl)

const doNativeShare = async () => {
  trackPulseEvent('shared', { method: 'native', title: props.title })
  await nativeShare({ text: props.text, url: shareUrl.value, title: props.title })
  emit('close')
}

const doCopy = async () => {
  trackPulseEvent('shared', { method: 'clipboard', title: props.title })
  await copyToClipboard({ text: props.text, url: shareUrl.value })
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}

const platforms = [
  { id: 'whatsapp', label: 'WhatsApp', color: 'bg-[#25D366]' },
  { id: 'twitter', label: 'X / Twitter', color: 'bg-[#000000]' },
  { id: 'threads', label: 'Threads', color: 'bg-[#000000]' },
]

const shareTo = (platform: string) => {
  trackPulseEvent('shared', { method: platform, title: props.title })
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
              <div :class="[p.color, 'w-12 h-12 rounded-full grid place-items-center']">
                <!-- WhatsApp -->
                <svg v-if="p.id === 'whatsapp'" class="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                <!-- X / Twitter -->
                <svg v-if="p.id === 'twitter'" class="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
                <!-- Threads -->
                <svg v-if="p.id === 'threads'" class="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.907 3.59 12c.025 3.091.717 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.96-.065-1.159.408-2.22 1.332-2.99.88-.732 2.063-1.145 3.527-1.23 1.095-.064 2.11.026 3.033.267-.084-1.063-.396-1.86-.934-2.384-.6-.584-1.499-.876-2.673-.866h-.065c-.952.016-1.736.296-2.33.833l-1.378-1.505c.917-.833 2.1-1.275 3.517-1.313h.104c1.744 0 3.11.558 4.06 1.66.776.9 1.21 2.115 1.293 3.612.445.225.86.486 1.236.789 1.16.936 1.96 2.196 2.326 3.648.476 1.89.153 4.16-1.59 5.98-1.86 1.94-4.258 2.86-7.533 2.882zm-.186-7.874c-1.005.06-1.79.305-2.333.729-.464.363-.665.82-.637 1.324.04.717.44 1.256 1.158 1.558.596.25 1.323.35 2.063.31 1.104-.06 1.963-.44 2.559-1.128.496-.573.84-1.368.987-2.373a9.182 9.182 0 00-3.797-.42z"/>
                </svg>
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
