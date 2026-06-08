export default defineNuxtRouteMiddleware((to) => {
  if (!import.meta.client) return
  const { admin, loadFromStorage } = useAuth()
  if (!admin.value) loadFromStorage()
  if (!admin.value) return navigateTo('/admin/login')
})
