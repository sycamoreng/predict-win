export default defineNuxtRouteMiddleware((to) => {
  if (!import.meta.client) return
  const { user, loadFromStorage } = useAuth()
  if (!user.value) loadFromStorage()
  if (!user.value) return navigateTo('/login')
})
