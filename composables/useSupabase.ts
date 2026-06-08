import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

export const useSupabase = () => {
  const config = useRuntimeConfig()
  if (!client) {
    client = createClient(config.public.supabaseUrl as string, config.public.supabaseAnonKey as string)
  }
  return client
}

export const useFunctions = () => {
  const config = useRuntimeConfig()
  const baseUrl = `${config.public.supabaseUrl}/functions/v1`
  const headers = {
    Authorization: `Bearer ${config.public.supabaseAnonKey}`,
    'Content-Type': 'application/json',
  }

  return {
    async call(path: string, body: Record<string, unknown>) {
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
