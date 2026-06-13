import { toPng } from 'html-to-image'

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

  const canNativeShareFiles = computed(() => {
    if (!import.meta.client) return false
    return !!navigator.canShare
  })

  const nativeShare = async (opts: ShareOptions) => {
    try {
      await navigator.share({ text: opts.text, url: opts.url || siteUrl, title: opts.title })
      return true
    } catch {
      return false
    }
  }

  const nativeShareWithImage = async (file: File, opts: ShareOptions) => {
    try {
      const shareData: ShareData = {
        text: opts.text,
        title: opts.title,
        files: [file],
      }
      if (navigator.canShare(shareData)) {
        await navigator.share(shareData)
        return true
      }
      return false
    } catch {
      return false
    }
  }

  const generateImage = async (element: HTMLElement): Promise<Blob | null> => {
    try {
      const dataUrl = await toPng(element, {
        pixelRatio: 2,
        cacheBust: true,
      })
      const res = await fetch(dataUrl)
      return await res.blob()
    } catch {
      return null
    }
  }

  const downloadImage = (blob: Blob, filename = 'sycamore-stats.png') => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
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

  const shareToInstagramStory = (opts: ShareOptions) => {
    const message = opts.url ? `${opts.text}\n${opts.url}` : opts.text
    window.open(`https://www.instagram.com/create/story/?text=${encodeURIComponent(message)}`, '_blank')
  }

  const copyToClipboard = async (opts: ShareOptions) => {
    const message = opts.url ? `${opts.text}\n${opts.url}` : opts.text
    await navigator.clipboard.writeText(message)
    return true
  }

  return {
    canNativeShare,
    canNativeShareFiles,
    nativeShare,
    nativeShareWithImage,
    generateImage,
    downloadImage,
    shareToTwitter,
    shareToWhatsApp,
    shareToThreads,
    shareToInstagramStory,
    copyToClipboard,
    siteUrl,
  }
}
