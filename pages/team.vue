<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const supabase = useSupabase()
const { user, isGuest, refreshUser } = useAuth()
const { config: campaign, load: loadCampaign } = useCampaign()
const { call } = useFunctions()

const teams = ref<any[]>([])
const saving = ref<string | null>(null)
const loading = ref(true)
const pickError = ref('')
const confirmTeam = ref<any | null>(null)

const showSavingsModal = ref(false)
const savingsAmount = ref(2000)
const savingsDuration = ref(30)
const savingsConsent = ref(false)
const savingsLoading = ref(false)
const savingsError = ref('')

const load = async () => {
  loading.value = true
  await loadCampaign()
  const { data } = await supabase.from('teams').select('*').order('name')
  teams.value = data || []
  loading.value = false
}

onMounted(load)

const hasTeam = computed(() => !!user.value?.backed_team_id)
const teamIsEliminated = computed(() => {
  if (!user.value?.backed_team_id) return false
  const t = teams.value.find((t) => t.id === user.value!.backed_team_id)
  return t?.is_eliminated === true
})

const startPick = (team: any) => {
  if (!user.value) return
  pickError.value = ''

  if (!campaign.value.team_picking_enabled) {
    pickError.value = 'Team picking is currently disabled.'
    return
  }

  if (hasTeam.value && user.value.backed_team_id === team.id) return

  if (hasTeam.value && !teamIsEliminated.value) {
    pickError.value = `You're locked in with ${user.value.backed_team?.name}. You can only switch if your team is eliminated.`
    return
  }

  confirmTeam.value = team
}

const confirmPick = async () => {
  if (!user.value || !confirmTeam.value) return
  saving.value = confirmTeam.value.id
  pickError.value = ''
  try {
    await call('predictions/back-team', { email: user.value.email, team_id: confirmTeam.value.id })
    await refreshUser()
    confirmTeam.value = null
  } catch (e: any) {
    pickError.value = e.message || 'Something went wrong'
  } finally {
    saving.value = null
  }
}

const enableAutoSavings = async () => {
  if (!user.value || !savingsConsent.value) return
  savingsLoading.value = true
  savingsError.value = ''
  try {
    await call('predictions/auto-savings', {
      email: user.value.email,
      enabled: true,
      amount: savingsAmount.value,
      duration: savingsDuration.value,
    })
    await refreshUser()
    showSavingsModal.value = false
    savingsConsent.value = false
  } catch (e: any) {
    savingsError.value = e.message || 'Something went wrong'
  } finally {
    savingsLoading.value = false
  }
}

const showDisableConfirm = ref(false)

const disableAutoSavings = async () => {
  if (!user.value) return
  savingsLoading.value = true
  showDisableConfirm.value = false
  try {
    await call('predictions/auto-savings', {
      email: user.value.email,
      enabled: false,
    })
    await refreshUser()
  } finally {
    savingsLoading.value = false
  }
}

const groups = computed(() => {
  const map: Record<string, any[]> = {}
  for (const t of teams.value) {
    const g = t.group_name || 'Other'
    if (!map[g]) map[g] = []
    map[g].push(t)
  }
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
})

const backedTeamName = computed(() => user.value?.backed_team?.name || 'your team')
const backedTeamWins = computed(() => (user.value as any)?.backed_team_wins || 0)
</script>

<template>
  <div class="space-y-8">
    <!-- Guest block -->
    <div v-if="isGuest" class="card p-8 sm:p-12 text-center max-w-lg mx-auto">
      <div class="w-16 h-16 rounded-2xl bg-sun-100 mx-auto grid place-items-center mb-5">
        <svg class="w-8 h-8 text-sun-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
        </svg>
      </div>
      <h1 class="text-2xl font-extrabold text-ink-900 mb-2">Sycamore account required</h1>
      <p class="text-sm text-ink-600 mb-6 max-w-sm mx-auto leading-relaxed">
        To back a team and enable auto-savings, you need a verified Sycamore account. Your predictions are still safe -- once you sign up, everything syncs automatically.
      </p>
      <a
        href="https://sycamore.ng"
        target="_blank"
        rel="noreferrer"
        class="btn-primary px-8 py-3 text-sm inline-block"
      >
        Get the Sycamore App
      </a>
    </div>

    <template v-else>
    <div>
      <h1 class="text-3xl font-extrabold text-ink-900">My Team</h1>
      <p class="mt-1 text-ink-500">
        {{ hasTeam ? 'You\'re riding with your team for the tournament.' : 'Choose wisely -- this is a one-time decision for the tournament.' }}
      </p>
    </div>

    <!-- Locked Team Card -->
    <div v-if="user && hasTeam" class="card p-6 sm:p-8 bg-gradient-to-br from-sky-50 via-white to-mint-50 border-0">
      <div class="flex flex-wrap items-center gap-6">
        <div class="w-20 h-20 rounded-2xl bg-white shadow-soft grid place-items-center text-5xl relative">
          {{ user.backed_team?.flag_emoji || '&#9917;' }}
          <span class="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-sky-500 text-white text-xs font-bold grid place-items-center shadow">
            &#10003;
          </span>
        </div>
        <div class="flex-1 min-w-[200px]">
          <div class="text-xs uppercase tracking-wider font-semibold text-ink-400">Backing since the start</div>
          <div class="text-2xl font-extrabold text-ink-900">
            {{ user.backed_team?.name }}
          </div>
          <div class="flex items-center gap-3 mt-2">
            <span class="inline-flex items-center gap-1.5 pill bg-sky-50 text-sky-700 text-sm font-semibold">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/></svg>
              {{ backedTeamWins }} {{ backedTeamWins === 1 ? 'win' : 'wins' }}
            </span>
            <span v-if="teamIsEliminated" class="pill bg-coral-50 text-coral-700 text-sm font-semibold">Eliminated</span>
            <span v-else class="pill bg-mint-50 text-mint-700 text-sm font-semibold">In Tournament</span>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="text-center px-4">
            <div class="text-2xl font-extrabold text-sky-600">{{ user.total_points }}</div>
            <div class="text-xs text-ink-500 font-semibold uppercase tracking-wider">Points</div>
          </div>
          <div class="text-center px-4">
            <div :class="['text-2xl font-extrabold', user.active_customer_flag ? 'text-mint-600' : 'text-coral-600']">
              {{ user.active_customer_flag ? 'Active' : 'Pending' }}
            </div>
            <div class="text-xs text-ink-500 font-semibold uppercase tracking-wider">Customer</div>
          </div>
        </div>
      </div>

      <!-- Lock notice -->
      <div v-if="!teamIsEliminated" class="mt-4 flex items-start gap-2 text-xs text-ink-500 bg-ink-50 rounded-xl p-3">
        <svg class="w-4 h-4 shrink-0 mt-0.5 text-ink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
        <span>Your team choice is locked for the tournament. If {{ backedTeamName }} gets eliminated, you'll be able to pick a new team.</span>
      </div>
      <div v-else class="mt-4 flex items-start gap-2 text-xs text-coral-700 bg-coral-50 rounded-xl p-3">
        <svg class="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        <span>{{ backedTeamName }} has been eliminated. You can pick a new team below.</span>
      </div>
    </div>

    <!-- No Team Yet prompt -->
    <div v-else-if="user" class="card p-6 sm:p-8 border-2 border-dashed border-sky-200 bg-sky-50/30">
      <div class="text-center space-y-3">
        <div class="text-5xl">&#9917;</div>
        <h2 class="text-xl font-extrabold text-ink-900">Pick your team</h2>
        <p class="text-sm text-ink-600 max-w-sm mx-auto">
          Choose the team you'll back for the entire World Cup. This is a <strong>one-time decision</strong> --
          you can't change it unless your team gets eliminated.
        </p>
      </div>
    </div>

    <!-- Auto-Savings Section -->
    <div v-if="user && hasTeam && !teamIsEliminated" class="card p-6 sm:p-8">
      <div class="flex items-start justify-between gap-4">
        <div>
          <h2 class="font-bold text-ink-900 text-lg">Team Win Auto-Savings</h2>
          <p class="text-sm text-ink-500 mt-1 max-w-md">
            Automatically save when {{ backedTeamName }} wins. Funds move from your Sycamore account into a locked savings plan.
          </p>
        </div>
        <div v-if="(user as any).auto_savings_enabled" class="pill bg-mint-50 text-mint-700 shrink-0">
          Active
        </div>
      </div>

      <div v-if="(user as any).auto_savings_enabled" class="mt-4 p-4 rounded-xl bg-mint-50/50 border border-mint-200">
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <div class="text-ink-500 text-xs font-semibold uppercase">Amount</div>
            <div class="font-bold text-ink-900">₦{{ ((user as any).auto_savings_amount || 0).toLocaleString() }}</div>
          </div>
          <div>
            <div class="text-ink-500 text-xs font-semibold uppercase">Lock Period</div>
            <div class="font-bold text-ink-900">{{ (user as any).auto_savings_duration }} days</div>
          </div>
          <div>
            <div class="text-ink-500 text-xs font-semibold uppercase">Plan Name</div>
            <div class="font-bold text-ink-900 text-xs">World Cup 2026 -- {{ backedTeamName }}</div>
          </div>
        </div>
        <button
          @click="showDisableConfirm = true"
          :disabled="savingsLoading"
          class="mt-4 btn text-sm px-4 py-2 bg-coral-50 text-coral-700 border border-coral-200 hover:bg-coral-100"
        >
          {{ savingsLoading ? 'Disabling...' : 'Disable Auto-Savings' }}
        </button>

        <!-- Disable confirm -->
        <div v-if="showDisableConfirm" class="mt-3 p-3 rounded-xl bg-coral-50 border border-coral-200 flex items-center justify-between gap-3">
          <p class="text-xs text-coral-700">Are you sure you want to disable auto-savings?</p>
          <div class="flex gap-2 shrink-0">
            <button @click="disableAutoSavings" :disabled="savingsLoading" class="pill bg-coral-600 text-white text-xs hover:bg-coral-700">Yes, disable</button>
            <button @click="showDisableConfirm = false" class="pill bg-white text-ink-700 border border-ink-200 text-xs hover:bg-ink-50">Cancel</button>
          </div>
        </div>
      </div>

      <button
        v-else
        @click="showSavingsModal = true"
        class="mt-4 btn-primary text-sm px-5 py-2.5"
      >
        Enable Auto-Savings
      </button>
    </div>

    <!-- Error banner -->
    <div v-if="pickError" class="flex items-start gap-2 p-4 rounded-xl bg-coral-50 border border-coral-200 text-sm text-coral-700">
      <svg class="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
      <span>{{ pickError }}</span>
    </div>

    <!-- Team picking disabled banner -->
    <div v-if="!campaign.team_picking_enabled && (!hasTeam || teamIsEliminated)" class="card p-6 sm:p-8 text-center bg-ink-50 border-ink-200">
      <div class="w-12 h-12 rounded-2xl bg-ink-200 mx-auto grid place-items-center mb-4">
        <svg class="w-6 h-6 text-ink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
      </div>
      <h3 class="text-lg font-extrabold text-ink-900 mb-1">Team picking is not available right now</h3>
      <p class="text-sm text-ink-600 max-w-sm mx-auto">Team selection will open when the next round begins. Check back soon!</p>
    </div>

    <!-- Team grid -->
    <div v-if="loading" class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div v-for="n in 8" :key="n" class="card h-28 animate-pulse bg-ink-100/40"></div>
    </div>

    <div v-else-if="(!hasTeam || teamIsEliminated) && campaign.team_picking_enabled" class="space-y-6">
      <div v-for="[group, items] in groups" :key="group">
        <div class="flex items-center gap-2 mb-3">
          <h2 class="font-bold text-ink-900">Group {{ group }}</h2>
          <div class="h-px flex-1 bg-ink-100"></div>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            v-for="t in items"
            :key="t.id"
            @click="startPick(t)"
            :disabled="saving === t.id || t.is_eliminated"
            :class="[
              'card p-4 text-left transition relative overflow-hidden group',
              t.is_eliminated ? 'opacity-50 cursor-not-allowed' : 'hover:-translate-y-0.5 hover:shadow-pop',
              user?.backed_team_id === t.id ? 'ring-2 ring-sky-500 ring-offset-2' : '',
            ]"
          >
            <div class="text-3xl mb-1">{{ t.flag_emoji }}</div>
            <div class="font-bold text-ink-900 text-sm">{{ t.name }}</div>
            <div class="text-xs text-ink-400 font-semibold uppercase tracking-wider">{{ t.code }}</div>
            <div v-if="t.is_eliminated" class="absolute top-2 right-2 text-[10px] font-bold uppercase text-coral-500">Out</div>
            <div
              v-if="saving === t.id"
              class="absolute inset-0 bg-white/70 grid place-items-center text-xs font-semibold text-sky-700"
            >
              Saving...
            </div>
          </button>
        </div>
      </div>
    </div>

    <!-- Confirmation Modal -->
    <Teleport to="body">
      <div v-if="confirmTeam" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
        <div class="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 sm:p-8 space-y-5 text-center">
          <div class="text-6xl">{{ confirmTeam.flag_emoji }}</div>
          <h3 class="text-xl font-extrabold text-ink-900">
            Back {{ confirmTeam.name }}?
          </h3>
          <p class="text-sm text-ink-600 leading-relaxed">
            This is a <strong>permanent choice</strong> for the tournament. You won't be able to switch
            unless {{ confirmTeam.name }} gets eliminated. Are you sure?
          </p>
          <div class="flex gap-3">
            <button
              @click="confirmPick"
              :disabled="!!saving"
              class="btn-primary flex-1 py-3 text-sm"
            >
              {{ saving ? 'Locking in...' : 'Lock it in' }}
            </button>
            <button
              @click="confirmTeam = null"
              class="btn-secondary flex-1 py-3 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Auto-Savings Consent Modal -->
    <Teleport to="body">
      <div v-if="showSavingsModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
        <div class="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 sm:p-8 space-y-5">
          <h3 class="text-xl font-extrabold text-ink-900">
            Save automatically when {{ backedTeamName }} wins
          </h3>
          <p class="text-sm text-ink-600 leading-relaxed">
            Turn your team's wins into savings. Each time {{ backedTeamName }} wins a match,
            we'll move the chosen amount from your Sycamore account into a savings plan.
            This is a real savings product provided by Sycamore.
          </p>

          <div class="space-y-4">
            <div>
              <label class="label">Amount per win</label>
              <select v-model.number="savingsAmount" class="input">
                <option :value="2000">₦2,000</option>
                <option :value="5000">₦5,000</option>
                <option :value="10000">₦10,000</option>
              </select>
            </div>
            <div>
              <label class="label">Lock period</label>
              <select v-model.number="savingsDuration" class="input">
                <option :value="30">30 days</option>
                <option :value="60">60 days</option>
                <option :value="90">90 days</option>
              </select>
            </div>
            <div class="text-xs text-ink-500">
              Plan name: <span class="font-semibold">World Cup 2026 -- {{ backedTeamName }}</span>
            </div>
          </div>

          <div class="p-3 rounded-xl bg-ink-50 text-xs text-ink-600 leading-relaxed space-y-2">
            <p>By ticking the box below, you authorise Sycamore to:</p>
            <ul class="list-disc pl-4 space-y-1">
              <li>Automatically move ₦{{ savingsAmount.toLocaleString() }} from your account into savings each time your team wins.</li>
              <li>Lock those funds for {{ savingsDuration }} days in a plan named "World Cup 2026 -- {{ backedTeamName }}".</li>
            </ul>
            <p>If your account doesn't have enough, we'll simply skip that win -- nothing happens and you're not charged. This is optional, and you can turn it off anytime in your team settings.</p>
          </div>

          <label class="flex items-start gap-3 cursor-pointer">
            <input v-model="savingsConsent" type="checkbox" class="mt-0.5 w-4 h-4 rounded border-ink-300 text-sky-600 focus:ring-sky-500" />
            <span class="text-sm text-ink-700 font-medium">I understand and authorise these automatic savings transfers.</span>
          </label>

          <div v-if="savingsError" class="text-sm text-coral-600 font-medium">{{ savingsError }}</div>

          <div class="flex gap-3">
            <button
              @click="enableAutoSavings"
              :disabled="!savingsConsent || savingsLoading"
              class="btn-primary flex-1 py-3 text-sm"
            >
              {{ savingsLoading ? 'Enabling...' : 'Enable' }}
            </button>
            <button
              @click="showSavingsModal = false"
              class="btn-secondary flex-1 py-3 text-sm"
            >
              No thanks
            </button>
          </div>
        </div>
      </div>
    </Teleport>
    </template>
  </div>
</template>
