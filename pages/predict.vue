<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const supabase = useSupabase()
const { user, isGuest, hasAccount, displayName, refreshUser, trackPulseEvent, campaignPoints, isEnrolled, joinCampaign, campaignCorrectPredictions, campaignExactScorelines, campaignBackedTeam } = useAuth()
const { config: campaign, load: loadCampaign, campaignId, isLeague, isTournament } = useCampaign()
const copiedAccount = ref(false)
const joining = ref(false)
const handleJoin = async () => {
  if (!campaignId.value) return
  joining.value = true
  await joinCampaign(campaignId.value)
  joining.value = false
}

const matches = ref<any[]>([])
const predictions = ref<Record<string, any>>({})
const loading = ref(true)
const view = ref<'upcoming' | 'today' | 'completed'>('upcoming')

const recentWins = ref<Array<{ id: string; title: string; body: string; type: string; metadata: any }>>([])
const dismissedBanners = ref<Set<string>>(new Set())

const visibleBanners = computed(() => recentWins.value.filter((n) => !dismissedBanners.value.has(n.id)))

const dismissBanner = async (id: string) => {
  dismissedBanners.value.add(id)
  await supabase.from('notifications').update({ read: true }).eq('id', id)
}

const loadRecentWins = async () => {
  if (!user.value) return
  const { data } = await supabase
    .from('notifications')
    .select('id, title, body, type, metadata')
    .eq('user_id', user.value.id)
    .eq('read', false)
    .in('type', ['prediction_correct', 'team_won'])
    .order('created_at', { ascending: false })
    .limit(5)
  recentWins.value = data || []
}

const loadData = async () => {
  loading.value = true
  await loadCampaign()
  await refreshUser()
  if (!campaignId.value) {
    loading.value = false
    return
  }
  const { data: m } = await supabase
    .from('matches')
    .select('*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)')
    .eq('campaign_id', campaignId.value)
    .order('kickoff_at', { ascending: true })
  matches.value = m || []

  if (user.value) {
    const { data: p } = await supabase
      .from('predictions')
      .select('*')
      .eq('user_id', user.value.id)
      .eq('campaign_id', campaignId.value)
    predictions.value = (p || []).reduce((acc, pred) => {
      acc[pred.match_id] = pred
      return acc
    }, {} as Record<string, any>)
  }
  loading.value = false
}

onMounted(() => {
  loadData()
  loadRecentWins()
  loadChipsAndStreak()
  loadSideQuests()
  trackPulseEvent('predictions_viewed')
})

const now = ref(Date.now())
let ticker: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  ticker = setInterval(() => { now.value = Date.now() }, 30_000)
})
onUnmounted(() => { if (ticker) clearInterval(ticker) })

const upcomingMatches = computed(() => {
  return matches.value.filter((m) => {
    return m.status === 'scheduled' || m.status === 'postponed'
  })
})

const todayMatches = computed(() => {
  const todayStr = new Date().toISOString().slice(0, 10)
  return matches.value.filter((m) => {
    const matchDay = m.kickoff_at?.slice(0, 10)
    return matchDay === todayStr
  })
})

const completedMatches = computed(() => {
  return matches.value.filter((m) => m.status === 'completed').reverse()
})

const UPCOMING_PREVIEW_LIMIT = 10

// Group matches by their DB matchweek
const upcomingByWeek = computed(() => {
  const groups: Record<number, any[]> = {}
  for (const m of upcomingMatches.value) {
    const wk = m.matchweek || 0
    if (!groups[wk]) groups[wk] = []
    groups[wk].push(m)
  }
  return groups
})

// Only allow predictions for current matchweek and next matchweek
const predictableMatches = computed(() => {
  const cur = currentWeekNumber.value
  const weeks = Object.keys(upcomingByWeek.value).map(Number).sort((a, b) => a - b)
  const allowed = weeks.filter((w) => w === cur)
  const result: { week: number; matches: any[] }[] = []
  for (const wk of allowed) {
    if (upcomingByWeek.value[wk]?.length) {
      result.push({ week: wk, matches: upcomingByWeek.value[wk] })
    }
  }
  return result
})

const completedByWeek = computed(() => {
  const byWk: Record<number, any[]> = {}
  for (const m of matches.value.filter((m) => m.status === 'completed')) {
    const wk = m.matchweek || 0
    if (!byWk[wk]) byWk[wk] = []
    byWk[wk].push(m)
  }
  const weeks = Object.keys(byWk).map(Number).sort((a, b) => b - a)
  return weeks.map((wk) => ({ week: wk, matches: byWk[wk] }))
})

const visibleUpcoming = computed(() => {
  return upcomingMatches.value.slice(0, UPCOMING_PREVIEW_LIMIT)
})

const hasMoreUpcoming = computed(() => upcomingMatches.value.length > UPCOMING_PREVIEW_LIMIT)

const filteredMatches = computed(() => {
  if (view.value === 'upcoming') return visibleUpcoming.value
  if (view.value === 'today') return todayMatches.value
  return completedMatches.value
})

const tabs = computed(() => [
  { id: 'upcoming' as const, label: 'Upcoming', count: upcomingMatches.value.length },
  { id: 'today' as const, label: 'Today', count: todayMatches.value.length },
  { id: 'completed' as const, label: 'Results', count: completedMatches.value.length },
])

const onSaved = (pred: any) => {
  predictions.value[pred.match_id] = pred
}

const predictionsList = computed(() => Object.values(predictions.value) as any[])
const totalPredictions = computed(() => predictionsList.value.length)
const scoredPredictionsCount = computed(() => predictionsList.value.filter((p) => p.scored).length)

const nextMatch = computed(() => {
  const upcoming = upcomingMatches.value.filter((m) => new Date(m.kickoff_at).getTime() > now.value)
  return upcoming[0] || null
})

const countdownText = computed(() => {
  if (!nextMatch.value) return ''
  const diff = new Date(nextMatch.value.kickoff_at).getTime() - now.value
  if (diff <= 0) return 'Starting now'
  const hours = Math.floor(diff / 3_600_000)
  const mins = Math.floor((diff % 3_600_000) / 60_000)
  if (hours > 24) {
    const days = Math.floor(hours / 24)
    return `${days}d ${hours % 24}h`
  }
  return `${hours}h ${mins}m`
})

// Chip logic — only 1 chip (DD or TC) per matchweek
const chipActivations = ref<any[]>([])
const tripleCaptainActivations = ref<any[]>([])
const allChipActivations = ref<any[]>([])
const userStreak = ref<{ current_streak: number; longest_streak: number } | null>(null)
const activatingChip = ref(false)
const cancellingChip = ref(false)
const chipInfoModal = ref<{ name: string; uses: string; description: string; note: string; bgClass: string; iconClass: string } | null>(null)

const chipInfoData: Record<string, { name: string; uses: string; description: string; note: string; bgClass: string; iconClass: string }> = {
  double_down: {
    name: 'Double Down',
    uses: '2 uses per season',
    description: 'All your predictions for this matchweek earn double points. If you predict the correct result, first scorer, or exact score — each one is worth 2x. Best used when you feel confident about the entire fixture list.',
    note: 'Applies to all matches in the matchweek automatically. You cannot stack it with any other chip.',
    bgClass: 'bg-sky-100',
    iconClass: 'text-sky-600',
  },
  triple_captain: {
    name: 'Triple Captain',
    uses: '1 use per season',
    description: 'Pick one specific match and earn triple points on that prediction. Unlike Double Down which covers all matches, this focuses all your bonus power on a single fixture you are most confident about.',
    note: 'After activating, choose your match from the fixture list below. The 3x multiplier applies only to that match.',
    bgClass: 'bg-amber-100',
    iconClass: 'text-amber-600',
  },
  first_blood: {
    name: 'First Blood',
    uses: '3 uses per season',
    description: 'A momentum chip. If the first match of the matchweek (by kickoff time) results in a correct prediction for you, a 1.5x bonus carries across all your remaining predictions that week.',
    note: 'The bonus only kicks in if your FIRST prediction is correct. If it\'s wrong, no bonus applies to the rest.',
    bgClass: 'bg-red-100',
    iconClass: 'text-red-500',
  },
  streak_shield: {
    name: 'Streak Shield',
    uses: '1 use per season',
    description: 'Protects your winning streak for the entire matchweek. Normally, a wrong prediction resets your streak counter to zero. With this chip active, wrong predictions that week are ignored.',
    note: 'Best used when you have a long streak going and face a tough set of fixtures. Your streak stays intact no matter what.',
    bgClass: 'bg-teal-100',
    iconClass: 'text-teal-600',
  },
  perfect_week: {
    name: 'Perfect Week',
    uses: '1 use per season',
    description: 'A bonus challenge: if you predict every single match in the matchweek correctly while this chip is active, you earn an extra +50 bonus points on top of your normal scoring.',
    note: 'You must predict ALL matches in the matchweek and get them ALL right. Even one wrong prediction means no bonus.',
    bgClass: 'bg-violet-100',
    iconClass: 'text-violet-600',
  },
  last_stand: {
    name: 'Last Stand',
    uses: '1 use · final 5 weeks only',
    description: 'The ultimate endgame chip. All your predictions for the matchweek earn 4x points. It can only be activated in the final 5 matchweeks of the season, making it a powerful tool for late leaderboard pushes.',
    note: 'Only unlocks from matchweek 34 onwards. Use it when you are chasing someone on the leaderboard in the final stretch.',
    bgClass: 'bg-orange-100',
    iconClass: 'text-orange-600',
  },
}

const showChipInfo = (chipType: string) => {
  const data = chipInfoData[chipType]
  if (!data) return
  chipInfoModal.value = { ...data }
}

const currentWeekNumber = computed(() => {
  const today = new Date()
  const scheduled = matches.value.filter((m) => m.status === 'scheduled' || m.status === 'postponed')
  if (scheduled.length && scheduled[0].matchweek) {
    return scheduled[0].matchweek
  }
  const completed = matches.value.filter((m) => m.status === 'completed')
  if (completed.length) {
    const last = completed.reduce((a, b) => (a.matchweek || 0) > (b.matchweek || 0) ? a : b)
    return (last.matchweek || 0) + 1
  }
  return 1
})

const chipsUsed = computed(() => chipActivations.value.length)
const maxChips = computed(() => campaign.value?.max_double_down_uses || 2)
const chipsRemaining = computed(() => Math.max(0, maxChips.value - chipsUsed.value))
const isDoubleDownActiveThisWeek = computed(() =>
  chipActivations.value.some((c) => c.week_number === currentWeekNumber.value)
)

// Any chip active this week (DD, TC, or new chips)
const chipActiveThisWeek = computed(() => {
  const dd = chipActivations.value.find((c) => c.week_number === currentWeekNumber.value)
  if (dd) return { type: 'double_down', ...dd }
  const tc = tripleCaptainActivations.value.find((c) => c.week_number === currentWeekNumber.value)
  if (tc) return { type: 'triple_captain', ...tc }
  const other = allChipActivations.value.find((c) => c.week_number === currentWeekNumber.value)
  if (other) return { type: other.chip_type, ...other }
  return null
})

// Whether the current week is still unlocked (first match lock time not passed)
const isWeekLocked = computed(() => {
  const lockMinutes = campaign.value?.prediction_lock_minutes || 60
  const weekMatches = matches.value.filter((m) => m.matchweek === currentWeekNumber.value && (m.status === 'scheduled' || m.status === 'postponed'))
  if (weekMatches.length === 0) return true
  const firstKickoff = weekMatches.reduce((min, m) => {
    const t = new Date(m.kickoff_at).getTime()
    return t < min ? t : min
  }, Infinity)
  return Date.now() >= (firstKickoff - lockMinutes * 60 * 1000)
})

const chipsLocked = computed(() => {
  return !!campaign.value?.require_eligibility_chips && !user.value?.active_customer_flag
})

const canActivateDoubleDown = computed(() => {
  if (chipsLocked.value) return false
  if (chipsRemaining.value <= 0) return false
  if (chipActiveThisWeek.value) return false
  if (isWeekLocked.value) return false
  return true
})

const activateDoubleDown = async () => {
  if (!canActivateDoubleDown.value || !campaignId.value) return
  activatingChip.value = true
  try {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/predictions/activate-chip`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        email: user.value?.email,
        chip_type: 'double_down',
        week_number: currentWeekNumber.value,
        campaign_id: campaignId.value,
      }),
    })
    if (res.ok) {
      chipActivations.value.push({ week_number: currentWeekNumber.value, chip_type: 'double_down' })
      trackPulseEvent('double_down_activated', { week: currentWeekNumber.value })
    }
  } finally {
    activatingChip.value = false
  }
}

// Triple Captain chip logic
const tcUsed = computed(() => tripleCaptainActivations.value.length)
const maxTc = computed(() => campaign.value?.max_triple_captain_uses || 1)
const tcRemaining = computed(() => Math.max(0, maxTc.value - tcUsed.value))
const tripleCaptainMatchId = computed(() => {
  const tc = tripleCaptainActivations.value.find((c) => c.week_number === currentWeekNumber.value)
  return tc?.match_id || null
})

const canActivateTripleCaptain = computed(() => {
  if (chipsLocked.value) return false
  if (tcRemaining.value <= 0) return false
  if (chipActiveThisWeek.value) return false
  if (isWeekLocked.value) return false
  return true
})

const activateTripleCaptain = async (matchId: string) => {
  if (!canActivateTripleCaptain.value || !campaignId.value) return
  activatingChip.value = true
  try {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/predictions/activate-chip`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        email: user.value?.email,
        chip_type: 'triple_captain',
        match_id: matchId,
        campaign_id: campaignId.value,
      }),
    })
    if (res.ok) {
      const json = await res.json()
      tripleCaptainActivations.value.push({ match_id: matchId, chip_type: 'triple_captain', week_number: json.week_number || currentWeekNumber.value })
      trackPulseEvent('triple_captain_activated', { match_id: matchId })
    }
  } finally {
    activatingChip.value = false
  }
}

const cancelChip = async () => {
  if (!chipActiveThisWeek.value || !campaignId.value || isWeekLocked.value) return
  cancellingChip.value = true
  try {
    const chip = chipActiveThisWeek.value
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/predictions/cancel-chip`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        email: user.value?.email,
        campaign_id: campaignId.value,
        chip_type: chip.type,
        week_number: currentWeekNumber.value,
        match_id: chip.match_id || undefined,
      }),
    })
    if (res.ok) {
      if (chip.type === 'double_down') {
        chipActivations.value = chipActivations.value.filter((c) => c.week_number !== currentWeekNumber.value)
      } else if (chip.type === 'triple_captain') {
        tripleCaptainActivations.value = tripleCaptainActivations.value.filter((c) => c.week_number !== currentWeekNumber.value)
      } else {
        allChipActivations.value = allChipActivations.value.filter((c) => c.week_number !== currentWeekNumber.value)
      }
      trackPulseEvent('chip_cancelled', { chip_type: chip.type, week: currentWeekNumber.value })
    }
  } finally {
    cancellingChip.value = false
  }
}

const streakMilestones = ref<Array<{ id: string; threshold: number; bonus_points: number }>>([])
const milestoneClaims = ref<Array<{ milestone_id: string }>>([])

const loadChipsAndStreak = async () => {
  if (!user.value || !campaignId.value) return
  const [chipsRes, tcRes, otherChipsRes, streakRes, msRes, claimsRes] = await Promise.all([
    supabase.from('chip_activations').select('*').eq('user_id', user.value.id).eq('campaign_id', campaignId.value).eq('chip_type', 'double_down'),
    supabase.from('chip_activations').select('*').eq('user_id', user.value.id).eq('campaign_id', campaignId.value).eq('chip_type', 'triple_captain'),
    supabase.from('chip_activations').select('*').eq('user_id', user.value.id).eq('campaign_id', campaignId.value).in('chip_type', ['first_blood', 'streak_shield', 'last_stand', 'perfect_week']),
    supabase.from('user_streaks').select('current_streak, longest_streak').eq('user_id', user.value.id).eq('campaign_id', campaignId.value).maybeSingle(),
    supabase.from('streak_milestones').select('id, threshold, bonus_points').eq('campaign_id', campaignId.value).order('threshold', { ascending: true }),
    supabase.from('streak_milestone_claims').select('milestone_id').eq('user_id', user.value.id).eq('campaign_id', campaignId.value),
  ])
  chipActivations.value = chipsRes.data || []
  tripleCaptainActivations.value = tcRes.data || []
  allChipActivations.value = otherChipsRes.data || []
  userStreak.value = streakRes.data
  streakMilestones.value = msRes.data || []
  milestoneClaims.value = claimsRes.data || []
}

const nextMilestone = computed(() => {
  const current = userStreak.value?.current_streak || 0
  const claimed = new Set(milestoneClaims.value.map((c) => c.milestone_id))
  return streakMilestones.value.find((ms) => ms.threshold > current && !claimed.has(ms.id)) || null
})

const streakProgress = computed(() => {
  if (!nextMilestone.value || !userStreak.value) return 0
  const current = userStreak.value.current_streak
  const target = nextMilestone.value.threshold
  const prevMilestones = streakMilestones.value.filter((ms) => ms.threshold <= current)
  const prevTarget = prevMilestones.length ? prevMilestones[prevMilestones.length - 1].threshold : 0
  const range = target - prevTarget
  if (range <= 0) return 0
  return Math.min(100, Math.round(((current - prevTarget) / range) * 100))
})

// Side Quests preview on predict page
const activeSideQuests = ref<any[]>([])
const sideQuestEntries = ref<Record<string, any>>({})

const loadSideQuests = async () => {
  if (!campaignId.value) return
  const { data: q } = await supabase
    .from('side_quests')
    .select('*')
    .eq('campaign_id', campaignId.value)
    .eq('status', 'open')
    .order('matchweek', { ascending: true })
    .limit(4)
  activeSideQuests.value = q || []

  if (user.value && q?.length) {
    const questIds = q.map((quest: any) => quest.id)
    const { data: e } = await supabase
      .from('side_quest_entries')
      .select('quest_id, answer')
      .eq('user_id', user.value.id)
      .in('quest_id', questIds)
    sideQuestEntries.value = (e || []).reduce((acc: Record<string, any>, entry: any) => {
      acc[entry.quest_id] = entry
      return acc
    }, {})
  }
}

const unansweredSideQuests = computed(() => activeSideQuests.value.filter((q) => !sideQuestEntries.value[q.id]))

// New chip computed properties
const firstBloodUsed = computed(() => allChipActivations.value.filter((c) => c.chip_type === 'first_blood').length)
const maxFirstBlood = computed(() => campaign.value?.max_first_blood_uses || 3)
const firstBloodRemaining = computed(() => Math.max(0, maxFirstBlood.value - firstBloodUsed.value))

const streakShieldUsed = computed(() => allChipActivations.value.filter((c) => c.chip_type === 'streak_shield').length)
const maxStreakShield = computed(() => campaign.value?.max_streak_shield_uses || 1)
const streakShieldRemaining = computed(() => Math.max(0, maxStreakShield.value - streakShieldUsed.value))

const lastStandUsed = computed(() => allChipActivations.value.filter((c) => c.chip_type === 'last_stand').length)
const maxLastStand = computed(() => campaign.value?.max_last_stand_uses || 1)
const lastStandRemaining = computed(() => Math.max(0, maxLastStand.value - lastStandUsed.value))
const totalMatchweeks = computed(() => campaign.value?.total_matchweeks || 38)
const isLastStandWindow = computed(() => currentWeekNumber.value > totalMatchweeks.value - 5)

const perfectWeekUsed = computed(() => allChipActivations.value.filter((c) => c.chip_type === 'perfect_week').length)
const maxPerfectWeek = computed(() => campaign.value?.max_perfect_week_uses || 1)
const perfectWeekRemaining = computed(() => Math.max(0, maxPerfectWeek.value - perfectWeekUsed.value))

const canActivateChip = (chipType: string) => {
  if (chipsLocked.value) return false
  if (chipActiveThisWeek.value) return false
  if (isWeekLocked.value) return false
  switch (chipType) {
    case 'first_blood': return firstBloodRemaining.value > 0
    case 'streak_shield': return streakShieldRemaining.value > 0
    case 'last_stand': return lastStandRemaining.value > 0 && isLastStandWindow.value
    case 'perfect_week': return perfectWeekRemaining.value > 0
    default: return false
  }
}

const activateNewChip = async (chipType: string) => {
  if (!canActivateChip(chipType) || !campaignId.value) return
  activatingChip.value = true
  try {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/predictions/activate-chip`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        email: user.value?.email,
        chip_type: chipType,
        week_number: currentWeekNumber.value,
        campaign_id: campaignId.value,
      }),
    })
    if (res.ok) {
      allChipActivations.value.push({ week_number: currentWeekNumber.value, chip_type: chipType })
      trackPulseEvent(`${chipType}_activated`, { week: currentWeekNumber.value })
    }
  } finally {
    activatingChip.value = false
  }
}


const hasPredictionForNext = computed(() => {
  if (!nextMatch.value) return false
  return !!predictions.value[nextMatch.value.id]
})

const copyAccountNumber = async () => {
  if (!user.value?.account_number) return
  await navigator.clipboard.writeText(user.value.account_number)
  copiedAccount.value = true
  setTimeout(() => (copiedAccount.value = false), 2000)
}

const accuracy = computed(() => {
  if (scoredPredictionsCount.value === 0) return 0
  return Math.round((campaignCorrectPredictions.value / scoredPredictionsCount.value) * 100)
})

const formatKickoff = (iso: string) => {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

const formatTime = (iso: string) => {
  const d = new Date(iso)
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="space-y-6">
    <!-- Not eligible / guest upgrade banner -->
    <div v-if="user && !loading && (isGuest || !hasAccount)" class="card p-0 overflow-hidden">
      <div class="bg-gradient-to-r from-sun-50 via-sun-50 to-sky-50 p-5 sm:p-6">
        <div class="flex flex-col sm:flex-row sm:items-center gap-4">
          <div class="w-12 h-12 rounded-2xl bg-sun-200 grid place-items-center shrink-0">
            <svg class="w-6 h-6 text-sun-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-bold text-ink-900">{{ isGuest ? "You're playing as a guest" : "You're not fully eligible yet" }}</p>
            <p class="text-sm text-ink-600 mt-0.5">
              Your predictions are saved, but to appear on the leaderboard, pick a team, and win prizes, you need a Sycamore account. Sign up with <span class="font-bold">{{ user?.email }}</span> so everything links up.
            </p>
          </div>
          <a
            href="https://appsflyer.sycamore.ng/Qthc/EPL"
            target="_blank"
            rel="noreferrer"
            class="btn-primary text-sm px-5 py-2.5 shrink-0 text-center"
          >
            Sign up on Sycamore
          </a>
        </div>
      </div>
    </div>

    <!-- No active campaign -->
    <div v-if="!loading && !campaignId" class="card p-12 text-center animate-fade-up">
      <div class="w-20 h-20 mx-auto rounded-3xl bg-ink-100 grid place-items-center mb-5">
        <svg class="w-10 h-10 text-ink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h3 class="text-2xl font-extrabold text-ink-900">No active campaign</h3>
      <p class="text-ink-500 mt-2 max-w-sm mx-auto">There is no competition running right now. Check back soon for the next prediction challenge!</p>
      <NuxtLink to="/leaderboard" class="btn-secondary mt-6 text-sm">View past leaderboards</NuxtLink>
    </div>

    <!-- Not enrolled in campaign -->
    <div v-else-if="!loading && campaignId && !isEnrolled" class="card p-0 overflow-hidden animate-fade-up">
      <div class="bg-gradient-to-r from-ink-900 via-ink-800 to-sky-900 text-white p-8 sm:p-12 text-center">
        <div class="w-16 h-16 mx-auto rounded-2xl bg-white/10 grid place-items-center mb-5">
          <svg class="w-8 h-8 text-sky-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/>
          </svg>
        </div>
        <h2 class="text-2xl font-extrabold">{{ campaign.name }}</h2>
        <p class="text-ink-300 mt-2 max-w-md mx-auto">Join this campaign to start making predictions, compete on the leaderboard, and win prizes.</p>
        <button
          @click="handleJoin"
          :disabled="joining"
          class="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold px-8 py-3.5 shadow-lg shadow-sky-900/30 hover:shadow-sky-900/40 transition active:scale-[0.98] disabled:opacity-50"
        >
          <svg v-if="!joining" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
          <span v-if="joining" class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
          {{ joining ? 'Joining...' : 'Join campaign' }}
        </button>
      </div>
    </div>

    <template v-else-if="isEnrolled">
      <!-- Campaign header strip -->
      <div class="card p-0 overflow-hidden animate-fade-up">
        <div class="bg-gradient-to-r from-ink-900 via-ink-800 to-sky-900 text-white p-5 sm:p-6">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-mint-400 animate-pulse"></span>
                <span class="text-xs font-semibold text-ink-300 uppercase tracking-wider">
                  {{ isTournament ? 'Tournament' : 'League' }} active
                </span>
              </div>
              <h1 class="text-xl sm:text-2xl font-extrabold leading-tight">{{ campaign.name }}</h1>
              <p class="text-sm text-ink-400">
                Hello, <span class="font-semibold text-white">{{ displayName.split(' ')[0] }}</span> — every pick counts.
              </p>
            </div>

            <!-- Quick stats -->
            <div class="flex items-center gap-3 sm:gap-4">
              <div class="text-center px-3 sm:px-4">
                <div class="text-2xl sm:text-3xl font-extrabold tabular-nums">{{ campaignPoints }}</div>
                <div class="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mt-0.5">Points</div>
              </div>
              <div class="w-px h-10 bg-white/10"></div>
              <div class="text-center px-3 sm:px-4">
                <div class="text-2xl sm:text-3xl font-extrabold tabular-nums">{{ totalPredictions }}</div>
                <div class="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mt-0.5">Picks</div>
              </div>
              <div class="w-px h-10 bg-white/10"></div>
              <div class="text-center px-3 sm:px-4">
                <div class="text-2xl sm:text-3xl font-extrabold tabular-nums">{{ accuracy }}<span class="text-base text-ink-400">%</span></div>
                <div class="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mt-0.5">Accuracy</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Next match countdown -->
        <div v-if="nextMatch && !loading" class="px-5 sm:px-6 py-3 bg-ink-50 border-t border-ink-100 flex items-center justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0">
            <div class="flex items-center gap-1.5 text-sm">
              <img v-if="nextMatch.home_team.logo_url" :src="nextMatch.home_team.logo_url" :alt="nextMatch.home_team.code" class="w-5 h-5 object-contain" />
              <span v-else class="text-lg">{{ nextMatch.home_team.flag_emoji }}</span>
              <span class="font-bold text-ink-900">{{ nextMatch.home_team.code }}</span>
              <span class="text-ink-300 mx-1">vs</span>
              <span class="font-bold text-ink-900">{{ nextMatch.away_team.code }}</span>
              <img v-if="nextMatch.away_team.logo_url" :src="nextMatch.away_team.logo_url" :alt="nextMatch.away_team.code" class="w-5 h-5 object-contain" />
              <span v-else class="text-lg">{{ nextMatch.away_team.flag_emoji }}</span>
            </div>
            <span class="hidden sm:inline text-xs text-ink-400">{{ formatKickoff(nextMatch.kickoff_at) }} at {{ formatTime(nextMatch.kickoff_at) }}</span>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <div class="pill" :class="hasPredictionForNext ? 'bg-mint-100 text-mint-700' : 'bg-sun-100 text-sun-700'">
              <svg v-if="hasPredictionForNext" class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
              <svg v-else class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              {{ hasPredictionForNext ? 'Predicted' : countdownText }}
            </div>
          </div>
        </div>
      </div>

      <!-- Celebratory banners -->
      <TransitionGroup name="banner" tag="div" class="space-y-3">
        <div
          v-for="banner in visibleBanners"
          :key="banner.id"
          :class="[
            'relative rounded-2xl p-4 sm:p-5 border overflow-hidden',
            banner.metadata?.points >= 15
              ? 'bg-gradient-to-r from-sun-50 via-sun-100/50 to-mint-50 border-sun-200'
              : banner.type === 'team_won'
                ? 'bg-gradient-to-r from-sky-50 to-mint-50 border-sky-200'
                : 'bg-gradient-to-r from-mint-50 to-sky-50 border-mint-200',
          ]"
        >
          <button
            @click="dismissBanner(banner.id)"
            class="absolute top-3 right-3 w-6 h-6 rounded-full bg-white/80 hover:bg-white text-ink-400 hover:text-ink-600 grid place-items-center transition"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
          <div class="flex items-center gap-4">
            <div :class="[
              'w-12 h-12 rounded-xl grid place-items-center shrink-0',
              banner.metadata?.points >= 15 ? 'bg-sun-200' : banner.type === 'team_won' ? 'bg-sky-200' : 'bg-mint-200',
            ]">
              <span v-if="banner.metadata?.points >= 15" class="text-2xl">&#127942;</span>
              <span v-else-if="banner.type === 'team_won'" class="text-2xl">&#11088;</span>
              <span v-else class="text-2xl">&#9989;</span>
            </div>
            <div class="min-w-0 flex-1">
              <div :class="[
                'font-extrabold text-base leading-tight',
                banner.metadata?.points >= 15 ? 'text-sun-800' : banner.type === 'team_won' ? 'text-sky-800' : 'text-mint-800',
              ]">
                {{ banner.title }}
              </div>
              <div v-if="banner.body" class="text-sm text-ink-600 mt-0.5">{{ banner.body }}</div>
            </div>
          </div>
        </div>
      </TransitionGroup>

      <!-- Performance cards row -->
      <div v-if="!loading && scoredPredictionsCount > 0" class="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-fade-up" style="animation-delay: 0.1s">
        <div class="card p-4 text-center hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
          <div class="text-2xl font-extrabold text-sky-600 tabular-nums">{{ campaignCorrectPredictions }}</div>
          <div class="text-[11px] font-semibold text-ink-500 uppercase tracking-wider mt-1">Correct calls</div>
        </div>
        <div class="card p-4 text-center hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
          <div class="text-2xl font-extrabold text-mint-600 tabular-nums">{{ campaignExactScorelines }}</div>
          <div class="text-[11px] font-semibold text-ink-500 uppercase tracking-wider mt-1">Exact scores</div>
        </div>
        <div class="card p-4 text-center hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
          <div class="text-2xl font-extrabold text-sun-600 tabular-nums">{{ scoredPredictionsCount }}</div>
          <div class="text-[11px] font-semibold text-ink-500 uppercase tracking-wider mt-1">Scored</div>
        </div>
        <div v-if="campaignBackedTeam" class="card p-4 text-center hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
          <img v-if="campaignBackedTeam.logo_url" :src="campaignBackedTeam.logo_url" :alt="campaignBackedTeam.name" class="w-8 h-8 object-contain" />
          <div v-else class="text-2xl">{{ campaignBackedTeam.flag_emoji }}</div>
          <div class="text-[11px] font-semibold text-ink-500 uppercase tracking-wider mt-1">Your team</div>
        </div>
        <div v-else class="card p-4 text-center hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
          <NuxtLink to="/team" class="text-sky-600 hover:text-sky-700 transition">
            <div class="text-2xl">&#9917;</div>
            <div class="text-[11px] font-semibold uppercase tracking-wider mt-1">Pick a team</div>
          </NuxtLink>
        </div>
      </div>

      <!-- Account details card -->
      <div v-if="user && user.account_number && !isGuest" class="card p-4 bg-gradient-to-r from-sky-50 to-ink-50 border-sky-100">
        <div class="flex items-center justify-between gap-3">
          <div>
            <div class="text-[10px] uppercase tracking-wider font-semibold text-ink-400">Your Account</div>
            <div class="text-xs text-ink-500 mt-0.5">{{ user.bank_name || 'Bank Account' }}</div>
            <div class="font-mono text-lg font-bold text-ink-900 mt-0.5">{{ user.account_number }}</div>
          </div>
          <button
            @click="copyAccountNumber"
            class="flex items-center gap-1.5 pill bg-white text-sky-700 hover:bg-sky-100 border border-sky-200 text-xs font-semibold transition"
          >
            <svg v-if="!copiedAccount" class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
            <svg v-else class="w-3.5 h-3.5 text-mint-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
            {{ copiedAccount ? 'Copied!' : 'Copy' }}
          </button>
        </div>
      </div>

      <!-- Shareable Stats Card -->
      <ShareStatsCard
        v-if="user && !loading && scoredPredictionsCount > 0"
        :total-points="campaignPoints"
        :predictions-count="scoredPredictionsCount"
        :correct-predictions="campaignCorrectPredictions"
        :exact-scorelines="campaignExactScorelines"
        :backed-team="campaignBackedTeam"
      />

      <!-- Predictions paused banner -->
      <div v-if="!campaign.predictions_enabled" class="card p-6 sm:p-8 text-center bg-ink-50 border-ink-200">
        <div class="w-14 h-14 rounded-2xl bg-ink-200 mx-auto grid place-items-center mb-4">
          <svg class="w-7 h-7 text-ink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        </div>
        <h3 class="text-lg font-extrabold text-ink-900 mb-1">Predictions paused</h3>
        <p class="text-sm text-ink-600 max-w-sm mx-auto">Predictions are currently disabled. Check back when the next round of matches opens!</p>
      </div>

      <template v-if="campaign.predictions_enabled">
        <!-- Chip info modal -->
        <Teleport to="body">
          <div v-if="chipInfoModal" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="chipInfoModal = null">
            <div class="absolute inset-0 bg-ink-900/50 backdrop-blur-sm" @click="chipInfoModal = null"></div>
            <div class="relative bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4 animate-fade-up">
              <div class="flex items-center gap-3">
                <div class="w-11 h-11 rounded-xl grid place-items-center" :class="chipInfoModal.bgClass">
                  <svg class="w-5 h-5" :class="chipInfoModal.iconClass" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                </div>
                <div>
                  <h3 class="font-bold text-ink-900">{{ chipInfoModal.name }}</h3>
                  <p class="text-xs text-ink-500">{{ chipInfoModal.uses }}</p>
                </div>
              </div>
              <p class="text-sm text-ink-600 leading-relaxed">{{ chipInfoModal.description }}</p>
              <div class="rounded-xl bg-ink-50 p-3">
                <p class="text-xs text-ink-500 font-medium">{{ chipInfoModal.note }}</p>
              </div>
              <button @click="chipInfoModal = null" class="w-full py-2.5 rounded-xl bg-ink-900 text-white text-sm font-bold hover:bg-ink-800 transition">Got it</button>
            </div>
          </div>
        </Teleport>

        <!-- Streak display with milestone progress -->
        <div v-if="userStreak && (userStreak.current_streak >= 3 || nextMilestone)" class="card p-4 space-y-3 border-l-4 border-amber-400">
          <div class="flex items-center gap-3">
            <div class="text-2xl">
              <span v-if="userStreak.current_streak >= 10">&#x1F31F;&#x1F525;</span>
              <span v-else-if="userStreak.current_streak >= 5">&#x1F535;&#x1F525;</span>
              <span v-else>&#x1F525;</span>
            </div>
            <div class="flex-1">
              <p class="text-sm font-bold text-ink-900">{{ userStreak.current_streak }} streak!</p>
              <p class="text-xs text-ink-500">Best: {{ userStreak.longest_streak }}</p>
            </div>
          </div>
          <div v-if="nextMilestone" class="space-y-1.5">
            <div class="flex justify-between items-center">
              <span class="text-xs font-semibold text-ink-600">Next reward at {{ nextMilestone.threshold }}</span>
              <span class="text-xs font-bold text-emerald-600">+{{ nextMilestone.bonus_points }} pts</span>
            </div>
            <div class="w-full h-2 bg-ink-100 rounded-full overflow-hidden">
              <div class="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-500" :style="{ width: streakProgress + '%' }"></div>
            </div>
            <p class="text-[11px] text-ink-400">{{ nextMilestone.threshold - userStreak.current_streak }} more to go</p>
          </div>
        </div>

        <!-- Chips locked notice -->
        <div v-if="chipsLocked" class="rounded-xl border border-sun-200 bg-sun-50 p-3 flex items-start gap-3">
          <div class="w-8 h-8 rounded-lg bg-sun-100 grid place-items-center shrink-0">
            <svg class="w-4 h-4 text-sun-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
          </div>
          <div>
            <p class="text-xs font-bold text-ink-900">Power-up chips are for active customers</p>
            <p class="text-[11px] text-ink-600 mt-0.5">Chips and leaderboard entry are unlocked for customers who use Sycamore for value-adding activity &mdash; savings, investments, or bill payments. Complete any one of these and you'll unlock all six chips and your place on the leaderboard. (Transfers and loans don't count.) Full details in our <NuxtLink to="/terms" class="font-bold text-sky-600 hover:underline">Terms &amp; Conditions</NuxtLink>.</p>
          </div>
        </div>

        <!-- Chips grid -->
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3" :class="chipsLocked ? 'opacity-50 pointer-events-none select-none' : ''">
          <!-- Double Down -->
          <div class="card p-3 space-y-2" :class="isDoubleDownActiveThisWeek ? 'ring-2 ring-emerald-400 bg-emerald-50/50' : ''">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-lg grid place-items-center" :class="isDoubleDownActiveThisWeek ? 'bg-emerald-100' : 'bg-sky-100'">
                <svg class="w-4 h-4" :class="isDoubleDownActiveThisWeek ? 'text-emerald-600' : 'text-sky-600'" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
              </div>
              <button @click="showChipInfo('double_down')" class="ml-auto w-5 h-5 rounded-full bg-ink-100 hover:bg-ink-200 grid place-items-center transition">
                <svg class="w-3 h-3 text-ink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              </button>
            </div>
            <div>
              <p class="text-xs font-bold text-ink-900">Double Down</p>
              <p class="text-[11px] text-ink-500">{{ chipsRemaining }}/{{ maxChips }} left</p>
            </div>
            <button v-if="isDoubleDownActiveThisWeek && !isWeekLocked" @click="cancelChip" :disabled="cancellingChip" class="w-full py-1.5 rounded-lg bg-coral-50 border border-coral-200 text-coral-600 text-[11px] font-bold transition hover:bg-coral-100 disabled:opacity-50">{{ cancellingChip ? '...' : 'Cancel' }}</button>
            <button v-else-if="canActivateDoubleDown" @click="activateDoubleDown" :disabled="activatingChip" class="w-full py-1.5 rounded-lg bg-sky-600 text-white text-[11px] font-bold transition hover:bg-sky-700 disabled:opacity-50">{{ activatingChip ? '...' : 'Activate' }}</button>
            <span v-else-if="isDoubleDownActiveThisWeek" class="block text-center text-[11px] font-bold text-emerald-600">2x Active</span>
            <span v-else class="block text-center text-[11px] text-ink-400">{{ chipActiveThisWeek ? 'Slot used' : chipsRemaining <= 0 ? 'Used up' : 'Locked' }}</span>
          </div>

          <!-- Triple Captain -->
          <div class="card p-3 space-y-2" :class="tripleCaptainMatchId ? 'ring-2 ring-amber-400 bg-amber-50/50' : ''">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-lg grid place-items-center" :class="tripleCaptainMatchId ? 'bg-amber-100' : 'bg-amber-50'">
                <svg class="w-4 h-4" :class="tripleCaptainMatchId ? 'text-amber-600' : 'text-amber-500'" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>
              </div>
              <button @click="showChipInfo('triple_captain')" class="ml-auto w-5 h-5 rounded-full bg-ink-100 hover:bg-ink-200 grid place-items-center transition">
                <svg class="w-3 h-3 text-ink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              </button>
            </div>
            <div>
              <p class="text-xs font-bold text-ink-900">Triple Captain</p>
              <p class="text-[11px] text-ink-500">{{ tcRemaining }}/{{ maxTc }} left</p>
            </div>
            <button v-if="tripleCaptainMatchId && !isWeekLocked" @click="cancelChip" :disabled="cancellingChip" class="w-full py-1.5 rounded-lg bg-coral-50 border border-coral-200 text-coral-600 text-[11px] font-bold transition hover:bg-coral-100 disabled:opacity-50">{{ cancellingChip ? '...' : 'Cancel' }}</button>
            <span v-else-if="tripleCaptainMatchId" class="block text-center text-[11px] font-bold text-amber-600">3x Active</span>
            <span v-else-if="canActivateTripleCaptain" class="block text-center text-[11px] font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded-lg py-1.5">Pick a match below</span>
            <span v-else class="block text-center text-[11px] text-ink-400">{{ chipActiveThisWeek ? 'Slot used' : tcRemaining <= 0 ? 'Used up' : 'Locked' }}</span>
          </div>

          <!-- First Blood -->
          <div class="card p-3 space-y-2" :class="chipActiveThisWeek?.type === 'first_blood' ? 'ring-2 ring-red-400 bg-red-50/50' : ''">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-lg grid place-items-center" :class="chipActiveThisWeek?.type === 'first_blood' ? 'bg-red-100' : 'bg-red-50'">
                <svg class="w-4 h-4" :class="chipActiveThisWeek?.type === 'first_blood' ? 'text-red-600' : 'text-red-400'" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
              </div>
              <button @click="showChipInfo('first_blood')" class="ml-auto w-5 h-5 rounded-full bg-ink-100 hover:bg-ink-200 grid place-items-center transition">
                <svg class="w-3 h-3 text-ink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              </button>
            </div>
            <div>
              <p class="text-xs font-bold text-ink-900">First Blood</p>
              <p class="text-[11px] text-ink-500">{{ firstBloodRemaining }}/{{ maxFirstBlood }} left</p>
            </div>
            <button v-if="chipActiveThisWeek?.type === 'first_blood' && !isWeekLocked" @click="cancelChip" :disabled="cancellingChip" class="w-full py-1.5 rounded-lg bg-coral-50 border border-coral-200 text-coral-600 text-[11px] font-bold transition hover:bg-coral-100 disabled:opacity-50">{{ cancellingChip ? '...' : 'Cancel' }}</button>
            <button v-else-if="!chipActiveThisWeek && canActivateChip('first_blood')" @click="activateNewChip('first_blood')" :disabled="activatingChip" class="w-full py-1.5 rounded-lg bg-red-500 text-white text-[11px] font-bold transition hover:bg-red-600 disabled:opacity-50">{{ activatingChip ? '...' : 'Activate' }}</button>
            <span v-else-if="chipActiveThisWeek?.type === 'first_blood'" class="block text-center text-[11px] font-bold text-red-600">Active</span>
            <span v-else class="block text-center text-[11px] text-ink-400">{{ chipActiveThisWeek ? 'Slot used' : firstBloodRemaining <= 0 ? 'Used up' : 'Locked' }}</span>
          </div>

          <!-- Streak Shield -->
          <div class="card p-3 space-y-2" :class="chipActiveThisWeek?.type === 'streak_shield' ? 'ring-2 ring-teal-400 bg-teal-50/50' : ''">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-lg grid place-items-center" :class="chipActiveThisWeek?.type === 'streak_shield' ? 'bg-teal-100' : 'bg-teal-50'">
                <svg class="w-4 h-4" :class="chipActiveThisWeek?.type === 'streak_shield' ? 'text-teal-600' : 'text-teal-400'" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
              </div>
              <button @click="showChipInfo('streak_shield')" class="ml-auto w-5 h-5 rounded-full bg-ink-100 hover:bg-ink-200 grid place-items-center transition">
                <svg class="w-3 h-3 text-ink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              </button>
            </div>
            <div>
              <p class="text-xs font-bold text-ink-900">Streak Shield</p>
              <p class="text-[11px] text-ink-500">{{ streakShieldRemaining }}/{{ maxStreakShield }} left</p>
            </div>
            <button v-if="chipActiveThisWeek?.type === 'streak_shield' && !isWeekLocked" @click="cancelChip" :disabled="cancellingChip" class="w-full py-1.5 rounded-lg bg-coral-50 border border-coral-200 text-coral-600 text-[11px] font-bold transition hover:bg-coral-100 disabled:opacity-50">{{ cancellingChip ? '...' : 'Cancel' }}</button>
            <button v-else-if="!chipActiveThisWeek && canActivateChip('streak_shield')" @click="activateNewChip('streak_shield')" :disabled="activatingChip" class="w-full py-1.5 rounded-lg bg-teal-500 text-white text-[11px] font-bold transition hover:bg-teal-600 disabled:opacity-50">{{ activatingChip ? '...' : 'Activate' }}</button>
            <span v-else-if="chipActiveThisWeek?.type === 'streak_shield'" class="block text-center text-[11px] font-bold text-teal-600">Active</span>
            <span v-else class="block text-center text-[11px] text-ink-400">{{ chipActiveThisWeek ? 'Slot used' : streakShieldRemaining <= 0 ? 'Used up' : 'Locked' }}</span>
          </div>

          <!-- Perfect Week -->
          <div class="card p-3 space-y-2" :class="chipActiveThisWeek?.type === 'perfect_week' ? 'ring-2 ring-violet-400 bg-violet-50/50' : ''">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-lg grid place-items-center" :class="chipActiveThisWeek?.type === 'perfect_week' ? 'bg-violet-100' : 'bg-violet-50'">
                <svg class="w-4 h-4" :class="chipActiveThisWeek?.type === 'perfect_week' ? 'text-violet-600' : 'text-violet-400'" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/></svg>
              </div>
              <button @click="showChipInfo('perfect_week')" class="ml-auto w-5 h-5 rounded-full bg-ink-100 hover:bg-ink-200 grid place-items-center transition">
                <svg class="w-3 h-3 text-ink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              </button>
            </div>
            <div>
              <p class="text-xs font-bold text-ink-900">Perfect Week</p>
              <p class="text-[11px] text-ink-500">{{ perfectWeekRemaining }}/{{ maxPerfectWeek }} left</p>
            </div>
            <button v-if="chipActiveThisWeek?.type === 'perfect_week' && !isWeekLocked" @click="cancelChip" :disabled="cancellingChip" class="w-full py-1.5 rounded-lg bg-coral-50 border border-coral-200 text-coral-600 text-[11px] font-bold transition hover:bg-coral-100 disabled:opacity-50">{{ cancellingChip ? '...' : 'Cancel' }}</button>
            <button v-else-if="!chipActiveThisWeek && canActivateChip('perfect_week')" @click="activateNewChip('perfect_week')" :disabled="activatingChip" class="w-full py-1.5 rounded-lg bg-violet-500 text-white text-[11px] font-bold transition hover:bg-violet-600 disabled:opacity-50">{{ activatingChip ? '...' : 'Activate' }}</button>
            <span v-else-if="chipActiveThisWeek?.type === 'perfect_week'" class="block text-center text-[11px] font-bold text-violet-600">Active</span>
            <span v-else class="block text-center text-[11px] text-ink-400">{{ chipActiveThisWeek ? 'Slot used' : perfectWeekRemaining <= 0 ? 'Used up' : 'Locked' }}</span>
          </div>

          <!-- Last Stand -->
          <div class="card p-3 space-y-2" :class="[
            chipActiveThisWeek?.type === 'last_stand' ? 'ring-2 ring-orange-400 bg-orange-50/50' : '',
            !isLastStandWindow ? 'opacity-40' : ''
          ]">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-lg grid place-items-center" :class="chipActiveThisWeek?.type === 'last_stand' ? 'bg-orange-100' : 'bg-orange-50'">
                <svg class="w-4 h-4" :class="chipActiveThisWeek?.type === 'last_stand' ? 'text-orange-600' : 'text-orange-400'" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z"/></svg>
              </div>
              <button @click="showChipInfo('last_stand')" class="ml-auto w-5 h-5 rounded-full bg-ink-100 hover:bg-ink-200 grid place-items-center transition">
                <svg class="w-3 h-3 text-ink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              </button>
            </div>
            <div>
              <p class="text-xs font-bold text-ink-900">Last Stand</p>
              <p class="text-[11px] text-ink-500">
                <template v-if="!isLastStandWindow">Final 5 weeks only</template>
                <template v-else>{{ lastStandRemaining }}/{{ maxLastStand }} left</template>
              </p>
            </div>
            <button v-if="chipActiveThisWeek?.type === 'last_stand' && !isWeekLocked" @click="cancelChip" :disabled="cancellingChip" class="w-full py-1.5 rounded-lg bg-coral-50 border border-coral-200 text-coral-600 text-[11px] font-bold transition hover:bg-coral-100 disabled:opacity-50">{{ cancellingChip ? '...' : 'Cancel' }}</button>
            <button v-else-if="!chipActiveThisWeek && canActivateChip('last_stand')" @click="activateNewChip('last_stand')" :disabled="activatingChip" class="w-full py-1.5 rounded-lg bg-orange-500 text-white text-[11px] font-bold transition hover:bg-orange-600 disabled:opacity-50">{{ activatingChip ? '...' : 'Activate' }}</button>
            <span v-else-if="chipActiveThisWeek?.type === 'last_stand'" class="block text-center text-[11px] font-bold text-orange-600">4x Active</span>
            <span v-else class="block text-center text-[11px] text-ink-400">{{ !isLastStandWindow ? 'Not yet' : chipActiveThisWeek ? 'Slot used' : 'Locked' }}</span>
          </div>
        </div>

        <!-- Tab navigation -->
        <div class="flex items-center gap-3 flex-wrap">
          <div class="card p-1.5 inline-flex">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              @click="view = tab.id; trackPulseEvent('predictions_tab_switched', { tab: tab.id })"
              :class="[
                'relative px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2',
                view === tab.id ? 'bg-sky-600 text-white shadow-pop' : 'text-ink-600 hover:bg-ink-100',
              ]"
            >
              {{ tab.label }}
              <span
                v-if="tab.count > 0"
                :class="[
                  'text-[10px] font-bold tabular-nums rounded-full px-1.5 py-0.5 leading-none',
                  view === tab.id ? 'bg-white/20 text-white' : 'bg-ink-100 text-ink-500',
                  tab.id === 'today' && tab.count > 0 && view !== tab.id ? 'bg-coral-100 text-coral-600' : '',
                ]"
              >
                {{ tab.count }}
              </span>
            </button>
          </div>

          <!-- Quick actions -->
          <div class="ml-auto flex items-center gap-2">
            <NuxtLink to="/leaderboard" class="pill bg-ink-100 text-ink-600 hover:bg-ink-200 transition">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
              Leaderboard
            </NuxtLink>
            <NuxtLink to="/history" class="pill bg-ink-100 text-ink-600 hover:bg-ink-200 transition">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              History
            </NuxtLink>
          </div>
        </div>

        <!-- Loading skeleton -->
        <div v-if="loading" class="grid sm:grid-cols-2 gap-4">
          <div v-for="n in 4" :key="n" class="card h-72 animate-pulse bg-ink-100/40"></div>
        </div>

        <!-- Side Quests Teaser -->
        <div v-if="activeSideQuests.length && !loading" class="card p-4 space-y-3 border-l-4 border-teal-400">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-xl">🎮</span>
              <div>
                <p class="text-sm font-bold text-ink-900">Side Quests</p>
                <p class="text-xs text-ink-500">{{ unansweredSideQuests.length }} unanswered this week</p>
              </div>
            </div>
            <NuxtLink to="/side-quests" class="text-xs font-bold text-teal-600 hover:text-teal-700 transition">
              View all &rarr;
            </NuxtLink>
          </div>
          <div v-if="unansweredSideQuests.length" class="flex flex-wrap gap-2">
            <div v-for="sq in unansweredSideQuests.slice(0, 3)" :key="sq.id" class="bg-teal-50 rounded-lg px-2.5 py-1.5 text-xs text-teal-700 font-medium">
              {{ sq.title.length > 30 ? sq.title.slice(0, 30) + '...' : sq.title }}
              <span class="ml-1 text-teal-500">(+{{ sq.point_value }})</span>
            </div>
          </div>
          <div v-else class="text-xs text-teal-600 font-medium">All answered! Results after the matchweek ends.</div>
        </div>

        <!-- Match grid grouped by matchweek -->
        <div v-if="view === 'upcoming' && !loading" class="space-y-8">
          <div v-if="predictableMatches.length === 0" class="card p-12 text-center">
            <div class="w-16 h-16 mx-auto rounded-2xl grid place-items-center mb-4 bg-sky-100">
              <svg class="w-8 h-8 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
            </div>
            <h3 class="text-xl font-bold text-ink-900">No upcoming matches</h3>
            <p class="text-ink-500 mt-1 max-w-sm mx-auto">New fixtures are added regularly. Check back soon!</p>
          </div>
          <div v-for="group in predictableMatches" :key="group.week" class="space-y-3">
            <div class="flex items-center gap-3">
              <h3 class="font-bold text-ink-900">Matchweek {{ group.week }}</h3>
              <span class="text-[11px] font-bold uppercase tracking-wide bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full">Current</span>
              <span class="text-xs text-ink-400 ml-auto">{{ group.matches.length }} match{{ group.matches.length === 1 ? '' : 'es' }}</span>
            </div>
            <div class="grid sm:grid-cols-2 gap-4">
              <MatchCard
                v-for="m in group.matches"
                :key="m.id"
                :match="m"
                :prediction="predictions[m.id]"
                :campaign="campaign"
                :triple-captain-match-id="tripleCaptainMatchId"
                :triple-captain-available="canActivateTripleCaptain"
                @saved="onSaved"
                @activate-triple-captain="activateTripleCaptain"
                @cancel-triple-captain="cancelChip"
              />
            </div>
          </div>
          <div v-if="upcomingMatches.length > predictableMatches.reduce((s, g) => s + g.matches.length, 0)" class="text-center pt-2">
            <NuxtLink
              to="/fixtures"
              class="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-ink-50 hover:bg-ink-100 text-sm font-semibold text-ink-700 transition"
            >
              See all fixtures
              <span class="text-xs text-ink-400">(future matchweeks)</span>
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
            </NuxtLink>
          </div>
        </div>

        <!-- Today matches -->
        <div v-else-if="view === 'today' && todayMatches.length === 0" class="card p-12 text-center">
          <div class="w-16 h-16 mx-auto rounded-2xl grid place-items-center mb-4 bg-coral-100">
            <svg class="w-8 h-8 text-coral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <h3 class="text-xl font-bold text-ink-900">No matches today</h3>
          <p class="text-ink-500 mt-1 max-w-sm mx-auto">There are no matches scheduled for today. Check the upcoming tab!</p>
        </div>
        <div v-else-if="view === 'today'" class="grid sm:grid-cols-2 gap-4">
          <MatchCard
            v-for="m in todayMatches"
            :key="m.id"
            :match="m"
            :prediction="predictions[m.id]"
            :campaign="campaign"
            :triple-captain-match-id="tripleCaptainMatchId"
            :triple-captain-available="canActivateTripleCaptain"
            @saved="onSaved"
            @activate-triple-captain="activateTripleCaptain"
            @cancel-triple-captain="cancelChip"
          />
        </div>

        <!-- Completed matches grouped by matchweek -->
        <div v-else-if="view === 'completed' && completedByWeek.length === 0" class="card p-12 text-center">
          <div class="w-16 h-16 mx-auto rounded-2xl grid place-items-center mb-4 bg-ink-100">
            <svg class="w-8 h-8 text-ink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
            </svg>
          </div>
          <h3 class="text-xl font-bold text-ink-900">No results yet</h3>
          <p class="text-ink-500 mt-1 max-w-sm mx-auto">Completed match results will appear here after scoring.</p>
        </div>
        <div v-else-if="view === 'completed'" class="space-y-8">
          <div v-for="group in completedByWeek" :key="group.week" class="space-y-3">
            <div class="flex items-center gap-3">
              <h3 class="font-bold text-ink-900">Matchweek {{ group.week }}</h3>
              <span class="text-xs text-ink-400 ml-auto">{{ group.matches.length }} match{{ group.matches.length === 1 ? '' : 'es' }}</span>
            </div>
            <div class="grid sm:grid-cols-2 gap-4">
              <MatchCard
                v-for="m in group.matches"
                :key="m.id"
                :match="m"
                :prediction="predictions[m.id]"
                :campaign="campaign"
                :triple-captain-match-id="tripleCaptainMatchId"
                :triple-captain-available="canActivateTripleCaptain"
                @saved="onSaved"
                @activate-triple-captain="activateTripleCaptain"
                @cancel-triple-captain="cancelChip"
              />
            </div>
          </div>
        </div>
      </template>

      <!-- Not qualified warning -->
      <div v-if="user && !loading && !user.active_customer_flag && hasAccount && !isGuest" class="card p-4 border-sun-200 bg-sun-50/50">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-sun-200 grid place-items-center shrink-0">
            <svg class="w-5 h-5 text-sun-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"/>
            </svg>
          </div>
          <div>
            <p class="font-bold text-ink-900 text-sm">Unlock with a value-adding activity</p>
            <p class="text-xs text-ink-500 mt-0.5">Use Sycamore for savings, investments, or bill payments to unlock everything &mdash; transfers and loans don't count.<template v-if="chipsLocked"> This unlocks all six power-up chips</template><template v-if="chipsLocked && campaign.require_eligibility_leaderboard"> and your spot on the general leaderboard</template>.</p>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
