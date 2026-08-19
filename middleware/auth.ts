export default defineNuxtRouteMiddleware(async (to) => {
  if (!import.meta.client) return

  // Access gate: while the game is closed to the public, keep players out of
  // the dashboard and send them back to the landing "coming soon" page. Admins
  // use the separate /admin area, which is unaffected.
  const { config, load } = useCampaign()
  await load()
  if (!config.value.public_access_enabled) {
    // Send players to the sign-in screen, which shows a clear "not open yet"
    // message and countdown instead of silently bouncing them home.
    return navigateTo('/login')
  }

  const raw = localStorage.getItem('predictor_session')
  if (!raw) {
    return navigateTo('/login')
  }

  try {
    const parsed = JSON.parse(raw)
    if (!parsed || !parsed.email) {
      return navigateTo('/login')
    }
  } catch {
    localStorage.removeItem('predictor_session')
    return navigateTo('/login')
  }
})
