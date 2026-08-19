<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const supabase = useSupabase()
const { user, participation, loadParticipation, trackPulseEvent, refreshUser } = useAuth()
const { config: campaign, load: loadCampaign, campaignId } = useCampaign()
const router = useRouter()

const pastCampaigns = ref<any[]>([])
const pastParticipations = ref<any[]>([])
const loading = ref(true)
const joining = ref(false)

const loadData = async () => {
  loading.value = true
  await loadCampaign()
  await refreshUser()

  if (user.value) {
    const { data: allCampaigns } = await supabase
      .from('campaigns')
      .select('*')
      .order('created_at', { ascending: false })
    const { data: myParticipations } = await supabase
      .from('campaign_participants')
      .select('*, campaign:campaigns(*), backed_team:teams!campaign_participants_backed_team_id_fkey(name, flag_emoji, code)')
      .eq('user_id', user.value.id)
      .order('joined_at', { ascending: false })

    const activeCampaignId = campaignId.value
    pastCampaigns.value = (allCampaigns || []).filter(c => c.id !== activeCampaignId)
    pastParticipations.value = (myParticipations || []).filter(p => p.campaign_id !== activeCampaignId)
  }
  loading.value = false
}

const joinCampaign = async () => {
  if (!user.value || !campaignId.value) return
  joining.value = true
  const { error } = await supabase.from('campaign_participants').insert({
    campaign_id: campaignId.value,
    user_id: user.value.id,
  })
  if (!error) {
    await loadParticipation(campaignId.value)
    trackPulseEvent('campaign_joined', { campaign_id: campaignId.value, campaign_name: campaign.value.name })
    router.push('/predict')
  }
  joining.value = false
}

const isEnrolledInActive = computed(() => !!participation.value)

onMounted(loadData)
</script>

<template>
  <div class="max-w-2xl mx-auto space-y-8">
    <div>
      <h1 class="text-3xl font-extrabold text-ink-900">Campaigns</h1>
      <p class="mt-1 text-ink-500">Your prediction competitions — past, present, and future.</p>
    </div>

    <div v-if="loading" class="space-y-4">
      <div v-for="n in 3" :key="n" class="card h-28 animate-pulse bg-ink-100/40"></div>
    </div>

    <template v-else>
      <!-- Active campaign card -->
      <div v-if="campaign.id" class="card overflow-hidden">
        <div class="bg-gradient-to-r from-sky-600 to-sky-700 px-6 py-4">
          <div class="flex items-center justify-between">
            <div>
              <div class="text-sky-200 text-xs font-semibold uppercase tracking-wider">Active Campaign</div>
              <h2 class="text-xl font-extrabold text-white mt-1">{{ campaign.name }}</h2>
            </div>
            <span class="pill bg-white/20 text-white text-xs font-semibold">
              {{ campaign.competition_type === 'league' ? 'League' : 'Tournament' }}
            </span>
          </div>
        </div>
        <div class="p-6">
          <div v-if="isEnrolledInActive" class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-mint-100 grid place-items-center">
              <svg class="w-5 h-5 text-mint-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div class="flex-1">
              <div class="font-bold text-ink-900">You're in!</div>
              <div class="text-sm text-ink-500">
                {{ participation?.total_points ?? 0 }} points so far
              </div>
            </div>
            <NuxtLink to="/predict" class="btn-primary text-sm px-5 py-2.5">
              Predict
            </NuxtLink>
          </div>

          <div v-else class="space-y-4">
            <p class="text-sm text-ink-600">
              You haven't joined this campaign yet. Join now to start making predictions and competing for prizes!
            </p>
            <button @click="joinCampaign" :disabled="joining" class="btn-primary w-full py-3">
              {{ joining ? 'Joining...' : `Join ${campaign.name}` }}
            </button>
          </div>
        </div>
      </div>

      <div v-else class="card p-8 text-center bg-ink-50">
        <div class="w-14 h-14 mx-auto rounded-2xl bg-ink-200 grid place-items-center mb-4">
          <svg class="w-7 h-7 text-ink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 class="text-lg font-bold text-ink-900">No active campaign</h3>
        <p class="text-sm text-ink-500 mt-1">Check back soon for the next prediction challenge!</p>
      </div>

      <!-- Past campaigns -->
      <div v-if="pastParticipations.length > 0">
        <h2 class="text-xl font-extrabold text-ink-900 mb-4">Past Campaigns</h2>
        <div class="space-y-3">
          <div v-for="pp in pastParticipations" :key="pp.id" class="card p-5">
            <div class="flex items-center justify-between gap-4">
              <div class="min-w-0">
                <h3 class="font-bold text-ink-900 truncate">{{ pp.campaign?.name }}</h3>
                <div class="flex items-center gap-3 mt-1.5 text-sm text-ink-500">
                  <span class="font-semibold text-sky-600">{{ pp.total_points }} pts</span>
                  <span>{{ pp.correct_predictions_count }} correct</span>
                  <span>{{ pp.exact_scorelines_count }} exact</span>
                </div>
              </div>
              <div v-if="pp.backed_team" class="flex items-center gap-2 shrink-0">
                <span class="text-lg">{{ pp.backed_team.flag_emoji }}</span>
                <span class="text-xs font-semibold text-ink-500">{{ pp.backed_team.code }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
