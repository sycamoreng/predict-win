<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const supabase = useSupabase()
const route = useRoute()
const router = useRouter()
const { user, trackPulseEvent } = useAuth()
const { config: campaign, campaignId, load: loadCampaign } = useCampaign()

interface Group {
  id: string
  name: string
  code: string | null
  avatar_emoji: string
  created_by: string | null
  campaign_id: string
  created_at: string
  is_system?: boolean
  team_id?: string | null
  team?: { name: string; logo_url: string | null; code: string } | null
  member_count?: number
}

interface GroupMember {
  id: string
  user_id: string
  role: string
  user?: { id: string; name: string; username: string }
  participation?: { total_points: number; correct_predictions_count: number; exact_scorelines_count: number }
}

const myGroups = ref<Group[]>([])
const loading = ref(true)
const showCreate = ref(false)
const showJoin = ref(false)
const selectedGroup = ref<Group | null>(null)
const groupMembers = ref<GroupMember[]>([])
const loadingMembers = ref(false)

const newGroupName = ref('')
const newGroupEmoji = ref('👥')
const creating = ref(false)
const createError = ref('')

const joinCode = ref('')
const joining = ref(false)
const joinError = ref('')

const emojiOptions = ['👥', '🏆', '⚽', '🔥', '💪', '🎯', '🌟', '👑', '🦁', '🐐', '💰', '🎮']

const generateCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

const loadMyGroups = async () => {
  if (!user.value) return
  loading.value = true

  const { data: memberships } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', user.value.id)

  if (!memberships || memberships.length === 0) {
    myGroups.value = []
    loading.value = false
    return
  }

  const groupIds = memberships.map((m) => m.group_id)

  const { data: groups } = await supabase
    .from('groups')
    .select('*, team:teams!groups_team_id_fkey(name, logo_url, code)')
    .in('id', groupIds)
    .eq('campaign_id', campaignId.value)
    .order('created_at', { ascending: false })

  // Get member counts
  for (const g of groups || []) {
    const { count } = await supabase
      .from('group_members')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', g.id)
    g.member_count = count || 0
  }

  myGroups.value = groups || []
  loading.value = false
}

const createGroup = async () => {
  if (!user.value || !campaignId.value || !newGroupName.value.trim()) return
  creating.value = true
  createError.value = ''

  const code = generateCode()

  const { data, error } = await supabase
    .from('groups')
    .insert({
      name: newGroupName.value.trim(),
      code,
      avatar_emoji: newGroupEmoji.value,
      campaign_id: campaignId.value,
      created_by: user.value.id,
    })
    .select()
    .maybeSingle()

  if (error) {
    createError.value = 'Failed to create group. Try again.'
    creating.value = false
    return
  }

  // Add self as admin member
  await supabase.from('group_members').insert({
    group_id: data.id,
    user_id: user.value.id,
    role: 'admin',
  })

  trackPulseEvent('group_created', { group_id: data.id })
  newGroupName.value = ''
  newGroupEmoji.value = '👥'
  creating.value = false
  showCreate.value = false
  await loadMyGroups()
}

const performJoin = async (rawCode: string): Promise<{ groupId: string | null; error: string }> => {
  if (!user.value || !campaignId.value) return { groupId: null, error: 'Something went wrong. Please try again.' }
  const code = rawCode.trim().toUpperCase()
  if (!code) return { groupId: null, error: 'Please enter an invite code.' }

  const { data: group } = await supabase
    .from('groups')
    .select('*')
    .eq('code', code)
    .eq('campaign_id', campaignId.value)
    .maybeSingle()

  if (!group) return { groupId: null, error: 'No group found with that code for this campaign.' }

  const { error } = await supabase.from('group_members').insert({
    group_id: group.id,
    user_id: user.value.id,
    role: 'member',
  })

  if (error) {
    // 23505 = already a member. Treat as success so an invite link simply opens
    // the group instead of showing an error.
    if (error.code === '23505') return { groupId: group.id, error: '' }
    return { groupId: null, error: 'Failed to join. Please try again.' }
  }

  trackPulseEvent('group_joined', { group_id: group.id })
  return { groupId: group.id, error: '' }
}

const openGroupById = async (groupId: string | null) => {
  if (!groupId) return
  const g = myGroups.value.find((x) => x.id === groupId)
  if (g) await loadGroupMembers(g)
}

const joinGroup = async () => {
  if (!user.value || !joinCode.value.trim()) return
  joining.value = true
  joinError.value = ''

  const { groupId, error } = await performJoin(joinCode.value)
  if (error) {
    joinError.value = error
    joining.value = false
    return
  }

  joinCode.value = ''
  joining.value = false
  showJoin.value = false
  await loadMyGroups()
  await openGroupById(groupId)
}

// Handle invite links of the form /groups?join=CODE. When signed in we join (or
// just open the group if already a member); the auth middleware sends signed-out
// visitors through login first and returns them here afterwards.
const handleJoinLink = async () => {
  const raw = route.query.join
  const code = Array.isArray(raw) ? raw[0] : raw
  if (typeof code !== 'string' || !code.trim()) return

  await router.replace({ query: {} })

  const { groupId, error } = await performJoin(code)
  if (error) {
    joinCode.value = code.trim().toUpperCase()
    joinError.value = error
    showJoin.value = true
    return
  }
  await loadMyGroups()
  await openGroupById(groupId)
}

const loadGroupMembers = async (group: Group) => {
  selectedGroup.value = group
  loadingMembers.value = true

  const { data: members } = await supabase
    .from('group_members')
    .select('id, user_id, role, user:synced_users!group_members_user_id_fkey(id, name, username)')
    .eq('group_id', group.id)
    .order('joined_at', { ascending: true })

  // Get participation data for leaderboard
  const userIds = (members || []).map((m: any) => m.user_id)
  const { data: participations } = await supabase
    .from('campaign_participants')
    .select('user_id, total_points, correct_predictions_count, exact_scorelines_count')
    .eq('campaign_id', campaignId.value)
    .in('user_id', userIds)

  const pointsMap = new Map((participations || []).map((p) => [p.user_id, p]))

  groupMembers.value = ((members || []) as any[])
    .map((m) => ({
      ...m,
      participation: pointsMap.get(m.user_id) || { total_points: 0, correct_predictions_count: 0, exact_scorelines_count: 0 },
    }))
    .sort((a, b) => {
      const ap = a.participation?.total_points || 0
      const bp = b.participation?.total_points || 0
      if (bp !== ap) return bp - ap
      const aes = a.participation?.exact_scorelines_count || 0
      const bes = b.participation?.exact_scorelines_count || 0
      return bes - aes
    })

  loadingMembers.value = false
}

const leaveGroup = async (groupId: string) => {
  if (!user.value) return
  await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', user.value.id)
  selectedGroup.value = null
  await loadMyGroups()
}

const copyCode = async (code: string) => {
  await navigator.clipboard.writeText(code)
}

const recordInvite = async (group: Group, channel: string) => {
  if (group.is_system) return
  await supabase.from('group_invites').insert({
    group_id: group.id,
    campaign_id: group.campaign_id,
    inviter_user_id: user.value?.id ?? null,
    channel,
  })
  trackPulseEvent('group_invite_sent', { group_id: group.id, channel })
}

const copied = ref('')
const handleCopyCode = async (code: string) => {
  await copyCode(code)
  copied.value = code
  setTimeout(() => (copied.value = ''), 2000)
  if (selectedGroup.value && selectedGroup.value.code === code) {
    await recordInvite(selectedGroup.value, 'code')
  }
}

const handleCopyLink = async (group: Group) => {
  await navigator.clipboard.writeText(inviteLink(group))
  copied.value = `${group.code}:link`
  setTimeout(() => (copied.value = ''), 2000)
  await recordInvite(group, 'link')
}

const inviteLink = (group: Group) => {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://play.sycamore.ng'
  return `${origin}/groups?join=${group.code}`
}

const canNativeShare = computed(() => typeof navigator !== 'undefined' && !!(navigator as any).share)
const shareInvite = async (group: Group) => {
  const link = inviteLink(group)
  const text = `Join my "${group.name}" league on Sycamore Play! Tap to join: ${link}`
  try {
    await (navigator as any).share({ title: 'Join my league', text, url: link })
    await recordInvite(group, 'share')
  } catch {
    // user dismissed the share sheet; nothing to record
  }
}

const displayMemberName = (m: GroupMember) => {
  if (m.user?.username) return m.user.username
  if (m.user?.name) return m.user.name.split(' ')[0]
  return 'Player'
}

const isMyGroup = (group: Group) => group.created_by === user.value?.id

const clubGroups = computed(() => myGroups.value.filter((g) => g.is_system))
const userGroups = computed(() => myGroups.value.filter((g) => !g.is_system))

const WHATSAPP_COMMUNITY_URL = 'https://chat.whatsapp.com/IwD5XwS1PSB0sa6OQak50y'
const FPL_GROUP_URL = 'https://fantasy.premierleague.com/leagues/auto-join/38ts86'
const openCommunity = (channel: 'whatsapp' | 'fpl') => {
  trackPulseEvent('community_link_clicked', { channel })
}

onMounted(async () => {
  await loadCampaign()
  await loadMyGroups()
  await handleJoinLink()
  trackPulseEvent('groups_viewed')
})
</script>

<template>
  <div class="space-y-6 max-w-4xl mx-auto">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
      <div>
        <h1 class="text-3xl font-extrabold text-ink-900">Groups</h1>
        <p class="mt-1 text-ink-500">Compete with friends in private mini-leagues.</p>
      </div>
      <div class="flex items-center gap-2">
        <button @click="showJoin = true" class="btn-secondary text-sm px-4 py-2.5">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>
          Join group
        </button>
        <button @click="showCreate = true" class="btn-primary text-sm px-4 py-2.5">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
          Create group
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="grid sm:grid-cols-2 gap-4">
      <div v-for="n in 4" :key="n" class="card h-32 animate-pulse bg-ink-100/40"></div>
    </div>

    <!-- Community -->
    <section v-if="!selectedGroup && !loading" class="animate-fade-up">
      <div class="flex items-center gap-2 mb-3">
        <h2 class="text-sm font-bold uppercase tracking-wider text-ink-500">Join the community</h2>
        <div class="h-px flex-1 bg-ink-100"></div>
      </div>
      <div class="grid sm:grid-cols-2 gap-4">
        <!-- WhatsApp community -->
        <a
          :href="WHATSAPP_COMMUNITY_URL"
          target="_blank"
          rel="noreferrer"
          @click="openCommunity('whatsapp')"
          class="relative overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-soft hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group"
        >
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-2xl bg-emerald-500 grid place-items-center shrink-0 shadow-soft">
              <svg class="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
            </div>
            <div class="flex-1 min-w-0">
              <div class="font-bold text-ink-900 group-hover:text-emerald-700 transition">WhatsApp community</div>
              <div class="text-xs text-ink-500 mt-0.5">Chat with other players, share tips and banter.</div>
            </div>
            <span class="pill bg-emerald-100 text-emerald-700 text-[10px] font-bold shrink-0">Join</span>
          </div>
        </a>

        <!-- FPL group -->
        <a
          :href="FPL_GROUP_URL"
          target="_blank"
          rel="noreferrer"
          @click="openCommunity('fpl')"
          class="relative overflow-hidden rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-5 shadow-soft hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group"
        >
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-2xl bg-sky-600 grid place-items-center shrink-0 shadow-soft">
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            </div>
            <div class="flex-1 min-w-0">
              <div class="font-bold text-ink-900 group-hover:text-sky-700 transition">Fantasy Premier League group</div>
              <div class="text-xs text-ink-500 mt-0.5">Join our official FPL mini-league for the season.</div>
            </div>
            <span class="pill bg-sky-100 text-sky-700 text-[10px] font-bold shrink-0">Join</span>
          </div>
        </a>
      </div>
    </section>

    <!-- Empty state -->
    <div v-if="!loading && myGroups.length === 0 && !selectedGroup" class="card p-12 sm:p-16 text-center animate-fade-up">
      <div class="w-20 h-20 mx-auto rounded-3xl bg-sky-100 grid place-items-center mb-5">
        <svg class="w-10 h-10 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
        </svg>
      </div>
      <h2 class="text-2xl font-extrabold text-ink-900 mb-2">No groups yet</h2>
      <p class="text-ink-500 max-w-md mx-auto leading-relaxed">
        Back a team to automatically join its club league, or create your own group to compete with friends, family, or colleagues.
      </p>
      <div class="flex items-center justify-center gap-3 mt-6">
        <button @click="showJoin = true" class="btn-secondary text-sm px-5 py-2.5">Join with code</button>
        <button @click="showCreate = true" class="btn-primary text-sm px-5 py-2.5">Create a group</button>
      </div>
    </div>

    <!-- Group list -->
    <div v-else-if="!selectedGroup" class="space-y-8 animate-fade-up">
      <!-- Club leagues (system) -->
      <section v-if="clubGroups.length">
        <div class="flex items-center gap-2 mb-3">
          <h2 class="text-sm font-bold uppercase tracking-wider text-emerald-700">Club leagues</h2>
          <span class="pill bg-emerald-100 text-emerald-700 text-[10px] font-bold">Official</span>
          <div class="h-px flex-1 bg-ink-100"></div>
        </div>
        <div class="grid sm:grid-cols-2 gap-4">
          <button
            v-for="group in clubGroups"
            :key="group.id"
            @click="loadGroupMembers(group)"
            class="relative text-left rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-soft hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group overflow-hidden"
          >
            <div class="absolute inset-y-0 left-0 w-1.5 bg-emerald-500"></div>
            <div class="flex items-center gap-4 pl-2">
              <div class="w-12 h-12 rounded-2xl bg-white ring-1 ring-emerald-200 grid place-items-center shrink-0">
                <img v-if="group.team?.logo_url" :src="group.team.logo_url" :alt="group.name" class="w-8 h-8 object-contain" />
                <span v-else class="text-2xl">{{ group.avatar_emoji }}</span>
              </div>
              <div class="flex-1 min-w-0">
                <div class="font-bold text-ink-900 truncate group-hover:text-emerald-700 transition">{{ group.name }}</div>
                <div class="text-xs text-ink-500 mt-0.5">{{ group.member_count }} fan{{ group.member_count === 1 ? '' : 's' }}</div>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <span class="pill bg-emerald-100 text-emerald-700 text-[10px] font-bold">Auto</span>
                <svg class="w-4 h-4 text-emerald-300 group-hover:text-emerald-500 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
              </div>
            </div>
          </button>
        </div>
      </section>

      <!-- User-created groups -->
      <section v-if="userGroups.length">
        <div class="flex items-center gap-2 mb-3">
          <h2 class="text-sm font-bold uppercase tracking-wider text-sky-700">Your groups</h2>
          <div class="h-px flex-1 bg-ink-100"></div>
        </div>
        <div class="grid sm:grid-cols-2 gap-4">
          <button
            v-for="group in userGroups"
            :key="group.id"
            @click="loadGroupMembers(group)"
            class="card p-5 text-left hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group"
          >
            <div class="flex items-center gap-4">
              <div class="w-12 h-12 rounded-2xl bg-sky-100 grid place-items-center text-2xl shrink-0">
                {{ group.avatar_emoji }}
              </div>
              <div class="flex-1 min-w-0">
                <div class="font-bold text-ink-900 truncate group-hover:text-sky-700 transition">{{ group.name }}</div>
                <div class="text-xs text-ink-500 mt-0.5">{{ group.member_count }} member{{ group.member_count === 1 ? '' : 's' }}</div>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <div class="pill bg-ink-100 text-ink-600 text-[10px] font-mono">{{ group.code }}</div>
                <svg class="w-4 h-4 text-ink-300 group-hover:text-sky-500 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
              </div>
            </div>
          </button>
        </div>
      </section>
    </div>

    <!-- Group detail / leaderboard -->
    <div v-if="selectedGroup" class="space-y-4 animate-fade-up">
      <button @click="selectedGroup = null" class="flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-700 transition font-semibold">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
        All groups
      </button>

      <!-- Group header -->
      <div :class="['card p-6 sm:p-8', selectedGroup.is_system ? 'border border-emerald-200 bg-gradient-to-br from-emerald-50/60 to-white' : '']">
        <div class="flex items-center gap-4 mb-4">
          <div :class="['w-14 h-14 rounded-2xl grid place-items-center text-3xl', selectedGroup.is_system ? 'bg-white ring-1 ring-emerald-200' : 'bg-sky-100']">
            <img v-if="selectedGroup.is_system && selectedGroup.team?.logo_url" :src="selectedGroup.team.logo_url" :alt="selectedGroup.name" class="w-9 h-9 object-contain" />
            <span v-else>{{ selectedGroup.avatar_emoji }}</span>
          </div>
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <h2 class="text-2xl font-extrabold text-ink-900">{{ selectedGroup.name }}</h2>
              <span v-if="selectedGroup.is_system" class="pill bg-emerald-100 text-emerald-700 text-[10px] font-bold">Official club league</span>
            </div>
            <div class="flex items-center gap-3 mt-1">
              <span class="text-xs text-ink-500">{{ groupMembers.length }} {{ selectedGroup.is_system ? 'fan' : 'member' }}{{ groupMembers.length === 1 ? '' : 's' }}</span>
              <template v-if="!selectedGroup.is_system">
                <span class="text-ink-200">|</span>
                <button
                  @click="handleCopyCode(selectedGroup!.code!)"
                  class="inline-flex items-center gap-1 text-xs font-mono text-sky-600 hover:text-sky-700 transition"
                >
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                  {{ copied === selectedGroup!.code ? 'Copied!' : selectedGroup!.code }}
                </button>
              </template>
            </div>
          </div>
          <button
            v-if="!selectedGroup.is_system && !isMyGroup(selectedGroup)"
            @click="leaveGroup(selectedGroup!.id)"
            class="pill bg-coral-50 text-coral-600 hover:bg-coral-100 transition text-xs cursor-pointer"
          >
            Leave
          </button>
        </div>

        <!-- System club note -->
        <div v-if="selectedGroup.is_system" class="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
          <div class="flex items-center gap-3">
            <svg class="w-5 h-5 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-bold text-emerald-800">Automatic club league</div>
              <div class="text-xs text-emerald-700 mt-0.5">You're here because you back {{ selectedGroup.team?.name || selectedGroup.name }}. Everyone backing this club is added automatically.</div>
            </div>
          </div>
        </div>

        <!-- Share invite -->
        <div v-else class="bg-sky-50 rounded-xl p-4 border border-sky-100">
          <div class="flex items-center gap-3">
            <svg class="w-5 h-5 text-sky-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-bold text-sky-800">Invite friends</div>
              <div class="text-xs text-sky-600 mt-0.5">Share the code <span class="font-mono font-bold">{{ selectedGroup.code }}</span> or send a one-tap join link.</div>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <button
                v-if="canNativeShare"
                @click="shareInvite(selectedGroup!)"
                class="pill bg-sky-600 text-white hover:bg-sky-700 transition cursor-pointer font-bold"
              >
                Share
              </button>
              <button
                @click="handleCopyLink(selectedGroup!)"
                class="pill bg-sky-600 text-white hover:bg-sky-700 transition cursor-pointer font-bold"
              >
                {{ copied === `${selectedGroup!.code}:link` ? 'Link copied!' : 'Copy link' }}
              </button>
              <button
                @click="handleCopyCode(selectedGroup!.code!)"
                class="pill bg-sky-200 text-sky-800 hover:bg-sky-300 transition cursor-pointer font-bold"
              >
                {{ copied === selectedGroup!.code ? 'Copied!' : 'Copy code' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Leaderboard -->
      <div class="card overflow-hidden">
        <div class="px-5 py-3 border-b border-ink-100 flex items-center justify-between">
          <h3 class="font-bold text-ink-900">Group Leaderboard</h3>
          <span class="text-xs text-ink-400">{{ campaign.name }}</span>
        </div>

        <div v-if="loadingMembers" class="p-8 text-center">
          <div class="w-6 h-6 mx-auto border-2 border-sky-200 border-t-sky-600 rounded-full animate-spin"></div>
        </div>

        <ul v-else class="divide-y divide-ink-100">
          <li
            v-for="(m, i) in groupMembers"
            :key="m.id"
            :class="[
              'flex items-center gap-4 px-5 py-3 transition',
              user && m.user_id === user.id ? 'bg-sky-50/60' : 'hover:bg-ink-50/50',
            ]"
          >
            <div
              :class="[
                'w-8 h-8 rounded-lg grid place-items-center text-sm font-bold',
                i === 0 ? 'bg-sun-100 text-sun-800'
                  : i === 1 ? 'bg-ink-100 text-ink-700'
                  : i === 2 ? 'bg-coral-100 text-coral-700'
                  : 'bg-ink-50 text-ink-500',
              ]"
            >
              {{ i + 1 }}
            </div>
            <div class="flex-1 min-w-0">
              <div class="font-semibold text-ink-900 truncate lowercase">
                {{ displayMemberName(m) }}
                <span v-if="user && m.user_id === user.id" class="ml-2 pill bg-sky-100 text-sky-700 text-[10px]">You</span>
                <span v-if="m.role === 'admin'" class="ml-1 pill bg-sun-100 text-sun-700 text-[10px]">Creator</span>
              </div>
              <div class="text-xs text-ink-500">
                {{ m.participation?.correct_predictions_count || 0 }} correct · {{ m.participation?.exact_scorelines_count || 0 }} exact
              </div>
            </div>
            <div class="font-extrabold text-ink-900 tabular-nums">
              {{ m.participation?.total_points || 0 }}
              <span class="text-xs font-semibold text-ink-400">pts</span>
            </div>
          </li>
        </ul>

        <div v-if="!loadingMembers && groupMembers.length === 0" class="p-8 text-center text-sm text-ink-500">
          No members yet. Share your code to invite friends!
        </div>
      </div>
    </div>

    <!-- Create group modal -->
    <Teleport to="body">
      <Transition name="banner">
        <div v-if="showCreate" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/50 backdrop-blur-sm" @click.self="showCreate = false">
          <div class="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-pop-in">
            <h3 class="text-xl font-extrabold text-ink-900 mb-4">Create a group</h3>

            <div class="space-y-4">
              <div>
                <label class="label">Group name</label>
                <input
                  v-model="newGroupName"
                  placeholder="e.g., Office Legends"
                  class="input"
                  maxlength="40"
                />
              </div>

              <div>
                <label class="label">Pick an icon</label>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="emoji in emojiOptions"
                    :key="emoji"
                    @click="newGroupEmoji = emoji"
                    :class="[
                      'w-10 h-10 rounded-xl text-xl grid place-items-center transition',
                      newGroupEmoji === emoji ? 'bg-sky-100 ring-2 ring-sky-500' : 'bg-ink-50 hover:bg-ink-100',
                    ]"
                  >
                    {{ emoji }}
                  </button>
                </div>
              </div>

              <p v-if="createError" class="text-sm text-coral-600 font-medium">{{ createError }}</p>

              <div class="flex items-center gap-3 pt-2">
                <button @click="showCreate = false" class="btn-secondary flex-1 py-2.5 text-sm">Cancel</button>
                <button
                  @click="createGroup"
                  :disabled="creating || !newGroupName.trim()"
                  class="btn-primary flex-1 py-2.5 text-sm"
                >
                  <span v-if="creating" class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  {{ creating ? 'Creating...' : 'Create' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Join group modal -->
    <Teleport to="body">
      <Transition name="banner">
        <div v-if="showJoin" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/50 backdrop-blur-sm" @click.self="showJoin = false">
          <div class="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-pop-in">
            <h3 class="text-xl font-extrabold text-ink-900 mb-4">Join a group</h3>

            <div class="space-y-4">
              <div>
                <label class="label">Invite code</label>
                <input
                  v-model="joinCode"
                  placeholder="e.g., ABC123"
                  class="input uppercase font-mono text-center text-lg tracking-widest"
                  maxlength="6"
                />
                <p class="text-xs text-ink-400 mt-1.5">Ask the group creator for their 6-character invite code.</p>
              </div>

              <p v-if="joinError" class="text-sm text-coral-600 font-medium">{{ joinError }}</p>

              <div class="flex items-center gap-3 pt-2">
                <button @click="showJoin = false" class="btn-secondary flex-1 py-2.5 text-sm">Cancel</button>
                <button
                  @click="joinGroup"
                  :disabled="joining || joinCode.trim().length < 4"
                  class="btn-primary flex-1 py-2.5 text-sm"
                >
                  <span v-if="joining" class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  {{ joining ? 'Joining...' : 'Join' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
