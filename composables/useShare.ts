interface ShareOptions {
  text: string
  url?: string
  title?: string
}

export const useShare = () => {
  const siteUrl = typeof window !== 'undefined' ? window.location.origin : ''

  const canNativeShare = computed(() => {
    if (!import.meta.client) return false
    return !!navigator.share
  })

  const nativeShare = async (opts: ShareOptions) => {
    try {
      await navigator.share({ text: opts.text, url: opts.url || siteUrl, title: opts.title })
      return true
    } catch {
      return false
    }
  }

  const shareToTwitter = (opts: ShareOptions) => {
    const params = new URLSearchParams({
      text: opts.text,
      url: opts.url || siteUrl,
    })
    window.open(`https://twitter.com/intent/tweet?${params}`, '_blank', 'width=550,height=420')
  }

  const shareToWhatsApp = (opts: ShareOptions) => {
    const message = opts.url ? `${opts.text}\n${opts.url}` : opts.text
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank')
  }

  const shareToThreads = (opts: ShareOptions) => {
    const message = opts.url ? `${opts.text}\n${opts.url}` : opts.text
    window.open(`https://www.threads.net/intent/post?text=${encodeURIComponent(message)}`, '_blank')
  }

  const copyToClipboard = async (opts: ShareOptions) => {
    const message = opts.url ? `${opts.text}\n${opts.url}` : opts.text
    await navigator.clipboard.writeText(message)
    return true
  }

  return {
    canNativeShare,
    nativeShare,
    shareToTwitter,
    shareToWhatsApp,
    shareToThreads,
    copyToClipboard,
    siteUrl,
  }
}
