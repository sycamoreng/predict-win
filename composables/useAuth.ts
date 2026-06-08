interface SessionUser {
  id: string
  email: string
  name: string
  account_number: string | null
  active_customer_flag: boolean
  qualifying_transactions_count: number
  is_account_valid: boolean
  total_points: number
  backed_team_id: string | null
  backed_team?: { id: string; name: string; flag_emoji: string; code: string } | null
  is_guest?: boolean
}

export type AdminPermission =
  | 'manage_results'
  | 'manage_fixtures'
  | 'view_payouts'
  | 'manage_admins'

interface AdminInfo {
  email: string
  name: string
  role: 'super_admin' | 'results' | 'fixtures' | 'payouts'
  permissions: AdminPermission[]
}

const STORAGE_KEY = 'predictor_session'
const ADMIN_STORAGE_KEY = 'predictor_admin'

export const useAuth = () => {
  const user = useState<SessionUser | null>('auth-user', () => null)
  const admin = useState<AdminInfo | null>('auth-admin', () => null)

  const loadFromStorage = () => {
    if (!import.meta.client) return
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      try {
        user.value = JSON.parse(raw)
      } catch {
        localStorage.removeItem(STORAGE_KEY)
      }
    }
    const rawAdmin = localStorage.getItem(ADMIN_STORAGE_KEY)
    if (rawAdmin) {
      try {
        admin.value = JSON.parse(rawAdmin)
      } catch {
        localStorage.removeItem(ADMIN_STORAGE_KEY)
      }
    }
  }

  const setSession = (u: SessionUser | null) => {
    user.value = u
    if (!import.meta.client) return
    if (u) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(u))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  const setAdminSession = (a: AdminInfo | null) => {
    admin.value = a
    if (!import.meta.client) return
    if (a) {
      localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(a))
    } else {
      localStorage.removeItem(ADMIN_STORAGE_KEY)
    }
  }

  const isGuest = computed(() => !!user.value?.is_guest)
  const hasAccount = computed(() => !!user.value?.account_number)
  const isSycamoreUser = computed(() => !!user.value && !isGuest.value && hasAccount.value)

  const displayName = computed(() => {
    if (!user.value) return ''
    if (user.value.is_guest) {
      return user.value.email.split('@')[0]
    }
    return user.value.name || user.value.email.split('@')[0]
  })

  const refreshUser = async () => {
    if (!user.value) return
    const supabase = useSupabase()

    if (user.value.is_guest) {
      const { data } = await supabase
        .from('synced_users')
        .select('*, backed_team:teams!synced_users_backed_team_id_fkey(*)')
        .eq('email', user.value.email)
        .maybeSingle()
      if (data) {
        user.value = data as SessionUser
        if (import.meta.client) localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
      }
      return
    }

    const { data } = await supabase
      .from('synced_users')
      .select('*, backed_team:teams!synced_users_backed_team_id_fkey(*)')
      .eq('id', user.value.id)
      .maybeSingle()
    if (data) {
      user.value = data as SessionUser
      if (import.meta.client) localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    }
  }

  const hasPermission = (permission: AdminPermission) =>
    !!admin.value && admin.value.permissions.includes(permission)

  const logout = () => {
    setSession(null)
  }

  const adminLogout = () => {
    setAdminSession(null)
  }

  return { user, admin, isGuest, hasAccount, isSycamoreUser, displayName, setSession, setAdminSession, loadFromStorage, refreshUser, logout, adminLogout, hasPermission }
}
