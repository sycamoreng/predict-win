import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

export const useSupabase = () => {
  const config = useRuntimeConfig()
  if (!client) {
    client = createClient(config.public.supabaseUrl as string, config.public.supabaseAnonKey as string)
  }
  return client
}

export const APP_TOKEN_KEY = 'predictor_session_token'
export const APP_ADMIN_TOKEN_KEY = 'predictor_admin_token'

export const useFunctions = () => {
  const config = useRuntimeConfig()
  const baseUrl = `${config.public.supabaseUrl}/functions/v1`

  return {
    async call(path: string, body: Record<string, unknown>) {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${config.public.supabaseAnonKey}`,
        'Content-Type': 'application/json',
      }
      if (import.meta.client) {
        const sessionToken = localStorage.getItem(APP_TOKEN_KEY)
        if (sessionToken) headers['x-app-token'] = sessionToken
        const adminToken = localStorage.getItem(APP_ADMIN_TOKEN_KEY)
        if (adminToken) headers['x-app-admin-token'] = adminToken
      }
      const res = await fetch(`${baseUrl}/${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
      return data
    },
  }
}
