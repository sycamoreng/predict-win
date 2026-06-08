<script setup lang="ts">
definePageMeta({ middleware: 'admin-auth', layout: false })

const { admin } = useAuth()
const { call } = useFunctions()

interface StageRow { stage: string; total: number; completed: number }
interface LeaderRow {
  id: string
  email: string
  name: string
  account_number: string
  total_points: number
}

const stages = ref<StageRow[]>([])
const leaderboard = ref<LeaderRow[]>([])
const totalMatches = ref(0)
const completedMatches = ref(0)
const nextMatchAt = ref<string | null>(null)

const loading = ref(true)
const busy = ref<string | null>(null)
const error = ref('')
const lastAction = ref('')

const STAGE_LABEL: Record<string, string> = {
  group: 'Group stage',
  round_of_16: 'Round of 16',
  quarter_final: 'Quarter-finals',
  semi_final: 'Semi-finals',
  final: 'Final',
}

const refreshState = async () => {
  if (!admin.value) return
  const res = await call('sync-results/simulate', {
    email: admin.value.email,
    action: 'state',
  })
  stages.value = res.stages || []
  leaderboard.value = res.leaderboard || []
  totalMatches.value = res.total_matches || 0
  completedMatches.value = res.completed_matches || 0
  nextMatchAt.value = res.next_match_at
}

const run = async (label: string, payload: Record<string, unknown>) => {
  if (!admin.value) return
  busy.value = label
  error.value = ''
  lastAction.value = ''
  try {
    const res = await call('sync-results/simulate', {
      email: admin.value.email,
      ...payload,
    })
    if (res.revealed !== undefined) {
      lastAction.value = `Revealed ${res.revealed} match${res.revealed === 1 ? '' : 'es'}.`
    } else if (res.predictions_created !== undefined) {
      lastAction.value = `Generated ${res.predictions_created} predictions across ${res.users} users and ${res.matches} matches.`
    } else if (res.truth_snapshots_added !== undefined) {
      lastAction.value = `Reset complete. ${res.truth_snapshots_added} new truth snapshots stored.`
    } else if (res.shifted !== undefined) {
      const dir = res.offset_days >= 0 ? 'forward' : 'backward'
      lastAction.value = `Shifted ${res.shifted} matches ${dir} ${Math.abs(res.offset_days)} days. First kickoff now ${new Date(res.first_kickoff_at).toLocaleString()}.`
    }
    await refreshState()
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    busy.value = null
  }
}

const reset = () => run('reset', { action: 'reset' })
const predict = () => run('predict', { action: 'predict' })
const revealOne = () => run('reveal-1', { action: 'reveal-next', count: 1 })
const revealFour = () => run('reveal-4', { action: 'reveal-next', count: 4 })
const revealStage = (stage: string) => run(`reveal-${stage}`, { action: 'reveal-stage', stage })
const revealPast = () => run('reveal-past', { action: 'reveal-past' })

const shiftCustom = ref('')

const shiftTo = (iso: string) => run('shift', { action: 'shift', target: iso })

const shiftRelative = (hoursFromNow: number) => {
  const target = new Date(Date.now() + hoursFromNow * 3600000)
  return shiftTo(target.toISOString())
}

const shiftCustomGo = () => {
  if (!shiftCustom.value) return
  const target = new Date(shiftCustom.value)
  if (isNaN(target.getTime())) {
    error.value = 'Invalid date'
    return
  }
  return shiftTo(target.toISOString())
}

const stageProgressPct = (s: StageRow) => (s.total === 0 ? 0 : Math.round((s.completed / s.total) * 100))

const overallPct = computed(() =>
  totalMatches.value === 0 ? 0 : Math.round((completedMatches.value / totalMatches.value) * 100),
)

const phase = computed(() => {
  if (totalMatches.value === 0) return 'No fixtures loaded'
  if (completedMatches.value === 0) return 'Pre-tournament'
  const lastDone = [...stages.value].reverse().find((s) => s.completed > 0)
  if (!lastDone) return 'Pre-tournament'
  const fullyDone = stages.value.every((s) => s.completed === s.total)
  if (fullyDone) return 'Tournament complete'
  if (lastDone.completed < lastDone.total) return `Mid ${STAGE_LABEL[lastDone.stage] || lastDone.stage}`
  return `Just finished ${STAGE_LABEL[lastDone.stage] || lastDone.stage}`
})

const nextStage = computed(() => stages.value.find((s) => s.completed < s.total)?.stage || null)

const formattedNext = computed(() => {
  if (!nextMatchAt.value) return ''
  const d = new Date(nextMatchAt.value)
  return d.toLocaleString('en-NG', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
})

onMounted(async () => {
  try {
    await refreshState()
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="min-h-screen bg-slate-50">
    <header class="sticky top-0 z-30 bg-slate-900 border-b border-slate-700">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <NuxtLink to="/admin" class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-teal-400 grid place-items-center">
            <span class="text-white font-extrabold text-sm">A</span>
          </div>
          <div class="text-white font-bold text-sm">Predictor League <span class="text-slate-400 font-normal">Admin</span></div>
        </NuxtLink>
        <NuxtLink to="/admin" class="text-xs text-slate-400 hover:text-white transition">
          Back to console
        </NuxtLink>
      </div>
    </header>

    <main class="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div class="space-y-8">
        <div>
          <h1 class="text-2xl font-extrabold text-ink-900">Simulator</h1>
          <p class="mt-1 text-ink-500">
            Replay a full tournament with auto-generated predictions to validate scoring, leaderboard movement and stage progression.
          </p>
        </div>

        <div v-if="loading" class="card h-64 animate-pulse bg-ink-100/40"></div>

        <template v-else>
      <div class="card p-6 bg-gradient-to-br from-sky-50 via-white to-mint-50 border-0">
        <div class="flex flex-wrap items-center gap-6">
          <div class="flex-1 min-w-[220px]">
            <div class="text-xs uppercase tracking-wider font-semibold text-ink-400">Current phase</div>
            <div class="text-2xl font-extrabold text-ink-900">{{ phase }}</div>
            <div v-if="formattedNext" class="text-sm text-ink-500 mt-1">Next match: {{ formattedNext }}</div>
          </div>
          <div class="text-center px-4">
            <div class="text-3xl font-extrabold text-sky-600">{{ completedMatches }}<span class="text-ink-300">/{{ totalMatches }}</span></div>
            <div class="text-xs text-ink-500 font-semibold uppercase tracking-wider">Matches revealed</div>
          </div>
          <div class="w-full">
            <div class="h-2 rounded-full bg-ink-100 overflow-hidden">
              <div class="h-full bg-gradient-to-r from-sky-500 to-mint-500 transition-all" :style="{ width: `${overallPct}%` }"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="card p-5 space-y-4">
        <div>
          <h2 class="font-bold text-ink-900">Schedule</h2>
          <p class="text-sm text-ink-500">
            Shift every kickoff so the tournament feels live. Use this so testers can sign in and predict like the matches are coming up.
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button @click="shiftRelative(4)" :disabled="!!busy" class="rounded-xl bg-sky-100 text-sky-800 font-bold py-2 px-4 text-sm hover:bg-sky-200 transition disabled:opacity-50">
            Start in 4 hours
          </button>
          <button @click="shiftRelative(24)" :disabled="!!busy" class="rounded-xl bg-sky-100 text-sky-800 font-bold py-2 px-4 text-sm hover:bg-sky-200 transition disabled:opacity-50">
            Start tomorrow
          </button>
          <button @click="shiftRelative(24 * 7)" :disabled="!!busy" class="rounded-xl bg-sky-100 text-sky-800 font-bold py-2 px-4 text-sm hover:bg-sky-200 transition disabled:opacity-50">
            Start in a week
          </button>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <input
            v-model="shiftCustom"
            type="datetime-local"
            class="input !py-2 max-w-xs"
          />
          <button @click="shiftCustomGo" :disabled="!!busy || !shiftCustom" class="rounded-xl bg-ink-100 text-ink-800 font-bold py-2 px-4 text-sm hover:bg-ink-200 transition disabled:opacity-50">
            Set first kickoff
          </button>
        </div>
        <div class="rounded-xl bg-mint-50 border border-mint-100 p-3 text-sm text-mint-800">
          <p class="font-semibold">Recommended demo flow</p>
          <ol class="list-decimal pl-5 space-y-0.5 mt-1">
            <li>Reset to pre-tournament.</li>
            <li>Shift the schedule so the first match starts in a few hours.</li>
            <li>Have testers sign in and submit predictions on the Predict page.</li>
            <li>When you want to fast-forward, use Reveal next match or Reveal the entire group stage.</li>
          </ol>
        </div>
      </div>

      <div class="card p-5 space-y-4">
        <div>
          <h2 class="font-bold text-ink-900">Controls</h2>
          <p class="text-sm text-ink-500">Reset, populate predictions, or reveal results to drive the leaderboard.</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button @click="reset" :disabled="!!busy" class="rounded-xl bg-coral-50 text-coral-700 font-bold py-2 px-4 text-sm hover:bg-coral-100 transition disabled:opacity-50">
            {{ busy === 'reset' ? 'Resetting...' : 'Reset to pre-tournament' }}
          </button>
          <button @click="predict" :disabled="!!busy" class="btn-primary !py-2 !px-4 text-sm">
            {{ busy === 'predict' ? 'Generating...' : 'Auto-predict for all users' }}
          </button>
          <button @click="revealOne" :disabled="!!busy" class="rounded-xl bg-ink-100 text-ink-800 font-bold py-2 px-4 text-sm hover:bg-ink-200 transition disabled:opacity-50">
            {{ busy === 'reveal-1' ? 'Revealing...' : 'Reveal next match' }}
          </button>
          <button @click="revealFour" :disabled="!!busy" class="rounded-xl bg-ink-100 text-ink-800 font-bold py-2 px-4 text-sm hover:bg-ink-200 transition disabled:opacity-50">
            {{ busy === 'reveal-4' ? 'Revealing...' : 'Reveal next 4' }}
          </button>
          <button @click="revealPast" :disabled="!!busy" class="rounded-xl bg-sun-100 text-sun-800 font-bold py-2 px-4 text-sm hover:bg-sun-200 transition disabled:opacity-50">
            {{ busy === 'reveal-past' ? 'Catching up...' : 'Reveal all past kickoffs' }}
          </button>
          <button
            v-if="nextStage"
            @click="revealStage(nextStage)"
            :disabled="!!busy"
            class="rounded-xl bg-mint-100 text-mint-800 font-bold py-2 px-4 text-sm hover:bg-mint-200 transition disabled:opacity-50"
          >
            {{ busy === `reveal-${nextStage}` ? 'Revealing...' : `Reveal all of ${STAGE_LABEL[nextStage] || nextStage}` }}
          </button>
        </div>
        <p v-if="lastAction" class="text-sm text-mint-700 font-medium">{{ lastAction }}</p>
        <p v-if="error" class="text-sm text-coral-600">{{ error }}</p>
      </div>

      <div class="grid md:grid-cols-2 gap-6">
        <div class="card p-5">
          <h2 class="font-bold text-ink-900 mb-3">Stage progression</h2>
          <div v-if="stages.length === 0" class="text-sm text-ink-500">No matches loaded. Run an Import first.</div>
          <div v-else class="space-y-3">
            <div v-for="s in stages" :key="s.stage">
              <div class="flex items-center justify-between text-sm mb-1">
                <span class="font-semibold text-ink-800">{{ STAGE_LABEL[s.stage] || s.stage }}</span>
                <span class="text-ink-500">{{ s.completed }} / {{ s.total }}</span>
              </div>
              <div class="h-2 rounded-full bg-ink-100 overflow-hidden">
                <div
                  class="h-full transition-all"
                  :class="s.completed === s.total ? 'bg-mint-500' : 'bg-sky-500'"
                  :style="{ width: `${stageProgressPct(s)}%` }"
                ></div>
              </div>
            </div>
          </div>
        </div>

        <div class="card p-5">
          <h2 class="font-bold text-ink-900 mb-3">Live leaderboard</h2>
          <div v-if="leaderboard.length === 0" class="text-sm text-ink-500">No users yet.</div>
          <ol v-else class="space-y-2">
            <li
              v-for="(u, i) in leaderboard"
              :key="u.id"
              class="flex items-center gap-3 rounded-xl px-3 py-2"
              :class="i === 0 ? 'bg-sun-50' : 'bg-ink-50'"
            >
              <div
                class="w-7 h-7 rounded-full grid place-items-center text-xs font-extrabold"
                :class="i === 0 ? 'bg-sun-400 text-white' : i === 1 ? 'bg-ink-200 text-ink-800' : i === 2 ? 'bg-coral-300 text-white' : 'bg-white text-ink-600'"
              >{{ i + 1 }}</div>
              <div class="flex-1 min-w-0">
                <div class="font-semibold text-ink-900 text-sm truncate">{{ u.name }}</div>
                <div class="text-xs text-ink-500 truncate">{{ u.email }}</div>
              </div>
              <div class="font-extrabold text-sky-700">{{ u.total_points }} pts</div>
            </li>
          </ol>
        </div>
      </div>
        </template>
      </div>
    </main>
  </div>
</template>
