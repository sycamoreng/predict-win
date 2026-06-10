<script setup lang="ts">
const { user, trackPulseEvent } = useAuth()
const router = useRouter()

onMounted(() => {
  if (user.value) router.replace('/team')
})

const trackCta = (cta: string) => {
  trackPulseEvent('cta_clicked', { cta, page: 'landing' })
}

const steps = [
  { num: '01', title: 'Get App & Verify', desc: 'Sign up and complete your BVN verification.', bg: 'bg-[#e2f7ee]', img: 'Group.png' },
  { num: '02', title: 'Transact', desc: 'Buy airtime, data, or fund your account', bg: 'bg-[#fef4dc]', img: 'Transfers.png' },
  { num: '03', title: 'Make Predictions', desc: 'Make predictions to advance on the leaderboard.', bg: 'bg-[#ddf4fb]', img: 'Transfers-1.png' },
  { num: '04', title: 'Win Cash', desc: '₦500k Grand Prize & ₦100k Weekly Payouts up for grabs.', bg: 'bg-[#fce8e8]', img: 'Leaderboard_illustr_2.png' },
]

const getImgUrl = (filename: string) => `/${filename}`
</script>

<template>
  <div class="space-y-5">
    <!-- Hero Section -->
    <section class="relative overflow-hidden rounded-[28px] min-h-[400px]" style="background: linear-gradient(135deg, #091e2c 0%, #0d2d3d 35%, #133945 65%, #183f4d 100%);">
      <!-- Ambient glow effects -->
      <div class="absolute top-0 right-1/3 w-[400px] h-[400px] rounded-full bg-[#1a5a6e]/20 blur-[120px]"></div>
      <div class="absolute bottom-0 left-1/4 w-[300px] h-[300px] rounded-full bg-[#0d4a5e]/15 blur-[80px]"></div>

      <!-- 3D Football player -->
      <div class="absolute top-0 right-0 w-[55%] h-full hidden md:block pointer-events-none">
        <img
          :src="getImgUrl('baller.png')"
          alt=""
          class="absolute top-1/2 right-4 -translate-y-1/2 w-[90%] h-auto object-contain opacity-90 mix-blend-lighten"
        />
      </div>

      <!-- Sycamore World Cup emblem -->
      <div class="absolute bottom-5 right-5 sm:bottom-8 sm:right-8 z-10">
        <img
          :src="getImgUrl('Syca_world_cup_emblem@4x_1.png')"
          alt="Your Game Your Goals - Sycamore"
          class="w-20 sm:w-24 h-auto"
        />
      </div>

      <div class="relative px-6 sm:px-10 lg:px-14 py-10 sm:py-14 z-10">
        <!-- Pill badge with subtle glass border -->
        <div class="inline-flex items-center rounded-full border border-white/20 bg-white/8 backdrop-blur-md px-5 py-2 text-sm text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
          World Cup 2026: June 11 — July 19
        </div>

        <!-- SVG Heading -->
        <div class="mt-7 mb-7">
          <img src="/your-game-your-goals.svg" alt="YOUR GAME YOUR GOALS" class="h-20 sm:h-28 lg:h-[130px] w-auto" />
        </div>

        <!-- Description -->
        <p class="text-base sm:text-lg text-white/80 max-w-[480px] leading-relaxed">
          Predict every match, climb the live leaderboard, and win from a
          <span class="text-[#5DC1E6] font-semibold">₦2,000,000 total prize pool</span>, paid straight to your Sycamore account.
        </p>

        <!-- Buttons -->
        <div class="mt-8 flex flex-wrap gap-3">
          <NuxtLink
            to="/login"
            @click="trackCta('get_started')"
            class="inline-flex items-center justify-center rounded-full bg-white text-[#0c2233] font-bold px-7 py-3.5 text-sm hover:bg-white/90 transition shadow-[0_4px_20px_rgba(255,255,255,0.15)]"
          >
            Get Started
          </NuxtLink>
          <NuxtLink
            to="/leaderboard"
            @click="trackCta('view_leaderboard')"
            class="inline-flex items-center justify-center rounded-full bg-white/8 border border-white/20 text-white font-bold px-7 py-3.5 text-sm hover:bg-white/15 transition backdrop-blur-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
          >
            View leaderboard
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- How to Play & Points System -->
    <section class="relative bg-white rounded-[28px] p-6 sm:p-10 border border-[#e8edf2] shadow-[0_2px_8px_rgba(0,0,0,0.03),0_12px_32px_rgba(0,0,0,0.04)]">
      <div class="text-center mb-8">
        <div class="inline-flex rounded-full border border-[#dce2e8] bg-white px-4 py-2 text-sm font-semibold text-ink-800 shadow-[0_1px_3px_rgba(0,0,0,0.04)] mb-4">
          How to Play
        </div>
        <h2 class="text-2xl sm:text-3xl font-extrabold text-ink-900">Predict matches. Earn points. Win prizes.</h2>
        <p class="mt-2 text-ink-500 max-w-xl mx-auto">Each match gives you three chances to score points. The more accurate your prediction, the more you earn.</p>
      </div>

      <!-- Points breakdown -->
      <div class="grid gap-4 sm:grid-cols-3 mb-8">
        <div class="relative rounded-[20px] p-6 border border-[#e8edf2] bg-gradient-to-br from-white to-[#f0fdf4] overflow-hidden">
          <div class="absolute top-4 right-4 w-12 h-12 rounded-full bg-[#dcfce7] grid place-items-center">
            <span class="text-lg font-extrabold text-[#16a34a]">5</span>
          </div>
          <div class="inline-flex rounded-full border border-[#b0e5d0] px-3 py-1 text-xs font-bold text-[#1a8a5a] mb-3">
            Easy Points
          </div>
          <h3 class="text-lg font-extrabold text-ink-900">Match winner</h3>
          <p class="mt-2 text-sm text-ink-500 leading-relaxed">Predict which team wins or if it's a draw. Get it right and earn <strong class="text-ink-700">5 points</strong>.</p>
          <div class="mt-3 text-xs text-ink-400">Example: Nigeria beats Brazil -- you picked Nigeria</div>
        </div>

        <div class="relative rounded-[20px] p-6 border border-[#e8edf2] bg-gradient-to-br from-white to-[#eff6ff] overflow-hidden">
          <div class="absolute top-4 right-4 w-12 h-12 rounded-full bg-[#dbeafe] grid place-items-center">
            <span class="text-lg font-extrabold text-[#2563eb]">10</span>
          </div>
          <div class="inline-flex rounded-full border border-[#93c5fd] px-3 py-1 text-xs font-bold text-[#1d4ed8] mb-3">
            Bonus Points
          </div>
          <h3 class="text-lg font-extrabold text-ink-900">First team to score</h3>
          <p class="mt-2 text-sm text-ink-500 leading-relaxed">Pick which team scores the opening goal. Nail it for <strong class="text-ink-700">10 points</strong>.</p>
          <div class="mt-3 text-xs text-ink-400">Example: Brazil scores first -- you picked Brazil</div>
        </div>

        <div class="relative rounded-[20px] p-6 border border-[#e8edf2] bg-gradient-to-br from-white to-[#fefce8] overflow-hidden">
          <div class="absolute top-4 right-4 w-12 h-12 rounded-full bg-[#fef9c3] grid place-items-center">
            <span class="text-lg font-extrabold text-[#ca8a04]">15</span>
          </div>
          <div class="inline-flex rounded-full border border-[#fde047] px-3 py-1 text-xs font-bold text-[#a16207] mb-3">
            Max Points
          </div>
          <h3 class="text-lg font-extrabold text-ink-900">Exact scoreline</h3>
          <p class="mt-2 text-sm text-ink-500 leading-relaxed">Predict the exact final score. The hardest to get, but worth <strong class="text-ink-700">15 points</strong>.</p>
          <div class="mt-3 text-xs text-ink-400">Example: Nigeria 2 - 1 Brazil -- you guessed 2-1</div>
        </div>
      </div>

      <!-- Important details -->
      <div class="rounded-[16px] bg-[#f8fafc] border border-[#e8edf2] p-5 sm:p-6">
        <h4 class="font-bold text-ink-900 mb-3">Things to know</h4>
        <div class="grid sm:grid-cols-2 gap-x-8 gap-y-2.5">
          <div class="flex items-start gap-2.5">
            <svg class="w-4 h-4 text-sky-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <p class="text-sm text-ink-600">Predictions lock <strong>3 hours before kickoff</strong>. Get yours in early.</p>
          </div>
          <div class="flex items-start gap-2.5">
            <svg class="w-4 h-4 text-sky-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <p class="text-sm text-ink-600">All three predictions are <strong>independent</strong> -- you can earn up to <strong>30 points per match</strong>.</p>
          </div>
          <div class="flex items-start gap-2.5">
            <svg class="w-4 h-4 text-sky-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
            <p class="text-sm text-ink-600">Anyone can predict, but only <strong>Sycamore customers</strong> qualify for the leaderboard and prizes.</p>
          </div>
          <div class="flex items-start gap-2.5">
            <svg class="w-4 h-4 text-sky-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
            <p class="text-sm text-ink-600">To qualify for prizes, complete at least one <strong>₦2,000 transaction</strong> on the Sycamore app.</p>
          </div>
          <div class="flex items-start gap-2.5">
            <svg class="w-4 h-4 text-sky-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
            <p class="text-sm text-ink-600">Leaderboard resets in <strong>weekly cycles</strong>. Top predictors win each week.</p>
          </div>
          <div class="flex items-start gap-2.5">
            <svg class="w-4 h-4 text-sky-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>
            <p class="text-sm text-ink-600">Exact scoreline predictions also count as <strong>tiebreakers</strong> between players with equal points.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Prize Pool + How to Qualify -->
    <section class="relative bg-white rounded-[28px] p-6 sm:p-10 border border-[#e8edf2] shadow-[0_2px_8px_rgba(0,0,0,0.03),0_12px_32px_rgba(0,0,0,0.04)]">
      <div class="grid lg:grid-cols-2 gap-10 items-start">
        <!-- Left: Prize Pool -->
        <div class="flex flex-col justify-center py-4">
          <div class="inline-flex self-start rounded-full border border-[#dce2e8] bg-white px-4 py-2 text-sm font-semibold text-ink-800 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            ₦2M Prize Pool
          </div>
          <h2 class="mt-6 text-3xl sm:text-4xl font-extrabold text-ink-900 leading-tight text-[#073042]">
            Weekly payouts. <span class="text-[#26C165]">Real</span> <span class="text-[#00A0FF]">cash.</span>
          </h2>
          <p class="mt-4 text-ink-600 leading-relaxed max-w-md">
            Winners will be rewarded across four prize cycles throughout the tournament. To qualify for the prizes, simply download the Sycamore app and complete a transaction of at least ₦2,000 through airtime purchases, data subscriptions, savings, or investments.
          </p>
          <NuxtLink
            to="/login"
            @click="trackCta('start_predicting')"
            class="mt-7 self-start inline-flex items-center justify-center rounded-full bg-ink-900 text-white font-bold px-7 py-3.5 text-sm hover:bg-ink-800 transition shadow-[0_4px_12px_rgba(31,32,48,0.2)]"
          >
            Start Predicting
          </NuxtLink>
        </div>

        <!-- Right: How to Qualify -->
        <div>
          <h3 class="font-bold text-ink-900 text-lg mb-5 decoration-ink-200 underline-offset-8">How to Qualify</h3>
          <div class="grid grid-cols-2 gap-3">
            <div
              v-for="step in steps"
              :key="step.num"
              :class="[step.bg, 'rounded-[18px] p-5 relative']"
            >
              <div class="absolute top-4 right-4 text-xs font-bold text-ink-400/70">{{ step.num }}</div>
              <img :src="getImgUrl(step.img)" :alt="step.title" class="w-10 h-10 object-contain mb-3" />
              <h4 class="font-bold text-ink-900 text-sm">{{ step.title }}</h4>
              <p class="mt-1 text-xs text-ink-600 leading-snug">{{ step.desc }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Footer attribution -->
    <div class="text-center py-4">
      <a
        href="https://sycamore.ng"
        target="_blank"
        rel="noreferrer"
        class="inline-flex items-center gap-1.5 text-xs text-ink-400 hover:text-ink-600 transition"
      >
        <img src="/Group.png" alt="" class="w-3.5 h-3.5 opacity-50" />
        <span>A product by <span class="font-medium">Sycamore</span></span>
      </a>
    </div>
  </div>
</template>
