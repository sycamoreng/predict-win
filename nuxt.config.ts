export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  devtools: { enabled: false },
  modules: ['@nuxtjs/tailwindcss', '@sycamoreng/pulse-nuxt'],
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      title: 'Predictor League — Sycamore',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Predict the World Cup. Climb the leaderboard. Win cash prizes.' },
        { property: 'og:title', content: 'Predictor League — Sycamore' },
        { property: 'og:description', content: 'Predict the World Cup. Climb the leaderboard. Win cash prizes.' },
        { property: 'og:image', content: 'https://play.sycamore.ng/Asset_3emblem.png' },
        { property: 'og:image:width', content: '960' },
        { property: 'og:image:height', content: '960' },
        { property: 'og:type', content: 'website' },
        { property: 'og:url', content: 'https://play.sycamore.ng' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: 'Predictor League — Sycamore' },
        { name: 'twitter:description', content: 'Predict the World Cup. Climb the leaderboard. Win cash prizes.' },
        { name: 'twitter:image', content: 'https://play.sycamore.ng/Asset_3emblem.png' },
      ],
      link: [
        { rel: 'icon', type: 'image/png', href: '/favicon.png' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap',
        },
      ],
    },
  },
  pulse: {
    apiKey: process.env.NUXT_PUBLIC_PULSE_API_KEY,
    apiUrl: process.env.NUXT_PUBLIC_PULSE_API_URL,
    autoPage: false,
  },
  runtimeConfig: {
    public: {
      supabaseUrl: process.env.VITE_SUPABASE_URL,
      supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY,
    },
  },
})
