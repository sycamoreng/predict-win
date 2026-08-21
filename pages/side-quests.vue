<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const supabase = useSupabase()
const { user, trackPulseEvent } = useAuth()
const { config: campaign, load: loadCampaign, campaignId } = useCampaign()

const quests = ref<any[]>([])
const entries = ref<Record<string, any>>({})
const loading = ref(true)
const submitting = ref<string | null>(null)
const selectedAnswers = ref<Record<string, string>>({})

const loadQuests = async () => {
  loading.value = true
  await loadCampaign()
  if (!campaignId.value) { loading.value = false; return }

  const { data: q } = await supabase
    .from('side_quests')
    .select('*')
    .eq('campaign_id', campaignId.value)
    .order('matchweek', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  quests.value = q || []

  if (user.value) {
    const { data: e } = await supabase
      .from('side_quest_entries')
      .select('*')
      .eq('user_id', user.value.id)
      .eq('campaign_id', campaignId.value)
    entries.value = (e || []).reduce((acc: Record<string, any>, entry: any) => {
      acc[entry.quest_id] = entry
      return acc
    }, {})
  }
  loading.value = false
}

onMounted(() => {
  loadQuests()
  trackPulseEvent('side_quests_viewed')
})

const activeQuests = computed(() => quests.value.filter((q) => q.status === 'open'))
const resolvedQuests = computed(() => quests.value.filter((q) => q.status === 'resolved'))

const isLocked = (quest: any) => {
  if (quest.status !== 'open') return true
  if (quest.locks_at && new Date(quest.locks_at).getTime() <= Date.now()) return true
  return false
}

const getOptionLabel = (quest: any, option: string) => {
  if (quest.options_meta?.labels && quest.options_meta.labels[option]) {
    return quest.options_meta.labels[option]
  }
  if (option === 'over') return `Over ${quest.options_meta?.line || ''}`
  if (option === 'under') return `Under ${quest.options_meta?.line || ''}`
  return option
}

const submitAnswer = async (questId: string) => {
  const answer = selectedAnswers.value[questId]
  if (!answer || !user.value) return
  submitting.value = questId
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    }
    if (import.meta.client) {
      const token = localStorage.getItem(APP_TOKEN_KEY)
      if (token) headers['x-app-token'] = token
    }
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/side-quests/submit`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email: user.value.email, quest_id: questId, answer }),
    })
    if (res.ok) {
      entries.value[questId] = { quest_id: questId, answer, points_awarded: 0, is_correct: null }
      trackPulseEvent('side_quest_submitted', { quest_id: questId, answer })
    }
  } finally {
    submitting.value = null
  }
}

const questTypeIcon = (type: string) => {
  switch (type) {
    case 'total_goals_over_under': return '⚽'
    case 'clean_sheet_count': return '🧤'
    case 'both_teams_score_count': return '🎯'
    case 'highest_scoring_match': return '🏟️'
    case 'player_to_score': return '👟'
    case 'player_to_assist': return '🎁'
    case 'player_pick': return '👟'
    default: return '🎮'
  }
}

const totalQuestPoints = computed(() => Object.values(entries.value).reduce((sum: number, e: any) => sum + (e.points_awarded || 0), 0))
const totalAnswered = computed(() => Object.keys(entries.value).length)
const totalCorrect = computed(() => Object.values(entries.value).filter((e: any) => e.is_correct).length)
const correctRate = computed(() => totalAnswered.value ? Math.round((totalCorrect.value / totalAnswered.value) * 100) : 0)
</script>

<template>
  <div class="space-y-6 pb-24">
    <div>
      <h1 class="text-2xl font-black text-ink-900">Side Quests</h1>
      <p class="text-sm text-ink-500 mt-1">Bonus challenges beyond regular predictions. Earn extra points for the leaderboard!</p>
    </div>

    <div v-if="loading" class="space-y-4">
      <div v-for="i in 3" :key="i" class="card h-32 animate-pulse bg-ink-100/40"></div>
    </div>

    <template v-else>
        <!-- Stats summary -->
        <div v-if="quests.length" class="grid grid-cols-3 gap-3">
          <div class="card p-3 text-center">
            <p class="text-lg font-black text-emerald-600">+{{ totalQuestPoints }}</p>
            <p class="text-[11px] text-ink-500 font-medium">Points earned</p>
          </div>
          <div class="card p-3 text-center">
            <p class="text-lg font-black text-ink-900">{{ totalCorrect }}/{{ totalAnswered }}</p>
            <p class="text-[11px] text-ink-500 font-medium">Correct</p>
          </div>
          <div class="card p-3 text-center">
            <p class="text-lg font-black text-ink-900">{{ correctRate }}%</p>
            <p class="text-[11px] text-ink-500 font-medium">Hit rate</p>
          </div>
        </div>

        <!-- Active Quests -->
        <div v-if="activeQuests.length" class="space-y-4">
          <h2 class="text-sm font-bold text-ink-700 uppercase tracking-wide">Active This Week</h2>
          <div v-for="quest in activeQuests" :key="quest.id" class="card p-4 space-y-3">
            <div class="flex items-start justify-between">
              <div class="flex items-center gap-2">
                <img v-if="quest.options_meta?.player?.photo_url" :src="quest.options_meta.player.photo_url" :alt="quest.options_meta.player.name" class="w-9 h-9 rounded-full object-cover ring-2 ring-emerald-200" />
                <span v-else class="text-xl">{{ questTypeIcon(quest.quest_type) }}</span>
                <div>
                  <p class="text-sm font-bold text-ink-900">{{ quest.title }}</p>
                  <p class="text-xs text-ink-500">MW {{ quest.matchweek }}</p>
                </div>
              </div>
              <span class="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">+{{ quest.point_value }} pts</span>
            </div>
            <p class="text-xs text-ink-600">{{ quest.description }}</p>

            <!-- Already submitted -->
            <div v-if="entries[quest.id]" class="bg-sky-50 rounded-xl px-3 py-2 flex items-center gap-2">
              <svg class="w-4 h-4 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
              <span class="text-xs font-semibold text-sky-700">Your pick: {{ getOptionLabel(quest, entries[quest.id].answer) }}</span>
            </div>

            <!-- Pick options -->
            <div v-else-if="!isLocked(quest)" class="space-y-2">
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="opt in quest.options"
                  :key="opt"
                  @click="selectedAnswers[quest.id] = opt"
                  :class="selectedAnswers[quest.id] === opt ? 'bg-ink-900 text-white' : 'bg-ink-100 text-ink-700 hover:bg-ink-200'"
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                >
                  <img v-if="quest.options_meta?.players?.[opt]?.photo_url" :src="quest.options_meta.players[opt].photo_url" :alt="getOptionLabel(quest, opt)" class="w-5 h-5 rounded-full object-cover" />
                  {{ getOptionLabel(quest, opt) }}
                </button>
              </div>
              <button
                v-if="selectedAnswers[quest.id]"
                @click="submitAnswer(quest.id)"
                :disabled="submitting === quest.id"
                class="w-full py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition disabled:opacity-50"
              >
                {{ submitting === quest.id ? 'Submitting...' : 'Lock in answer' }}
              </button>
            </div>

            <div v-else class="text-xs text-ink-400 italic">Locked — entries are closed.</div>
          </div>
        </div>

        <!-- No active quests -->
        <div v-else-if="!resolvedQuests.length" class="card p-8 text-center">
          <p class="text-4xl mb-3">🎮</p>
          <p class="text-sm font-semibold text-ink-700">No side quests yet</p>
          <p class="text-xs text-ink-500 mt-1">Side quests are generated at the start of each matchweek. Check back soon!</p>
        </div>

        <!-- Resolved Quests History -->
        <div v-if="resolvedQuests.length" class="space-y-4">
          <h2 class="text-sm font-bold text-ink-700 uppercase tracking-wide">Completed</h2>
          <div v-for="quest in resolvedQuests" :key="quest.id" class="card p-4 space-y-2 opacity-90">
            <div class="flex items-start justify-between">
              <div class="flex items-center gap-2">
                <span class="text-lg">{{ questTypeIcon(quest.quest_type) }}</span>
                <div>
                  <p class="text-sm font-semibold text-ink-800">{{ quest.title }}</p>
                  <p class="text-xs text-ink-500">MW {{ quest.matchweek }}</p>
                </div>
              </div>
              <div v-if="entries[quest.id]">
                <span v-if="entries[quest.id].is_correct" class="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">+{{ entries[quest.id].points_awarded }} pts</span>
                <span v-else class="text-xs font-bold text-red-500 bg-red-50 px-2 py-1 rounded-lg">Missed</span>
              </div>
              <span v-else class="text-xs text-ink-400 bg-ink-50 px-2 py-1 rounded-lg">No entry</span>
            </div>
            <div class="flex items-center gap-2 text-xs text-ink-600">
              <span>Answer: <strong>{{ getOptionLabel(quest, quest.correct_answer) }}</strong></span>
              <span v-if="entries[quest.id]" class="text-ink-400">|</span>
              <span v-if="entries[quest.id]" class="text-ink-500">Your pick: {{ getOptionLabel(quest, entries[quest.id].answer) }}</span>
            </div>
          </div>
        </div>
      </template>
  </div>
</template>
