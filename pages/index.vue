<script setup lang="ts">
const { user } = useAuth()
const router = useRouter()

onMounted(() => {
  if (user.value) router.replace('/predict')
})

const stats = [
  { pts: '5 pts', title: 'Pick the winner', desc: 'Lock in your prediction up to 3 hours before kickoff.' },
  { pts: '10 pts', title: 'First team to score', desc: 'Lock in your prediction up to 3 hours before kickoff.' },
  { pts: '15 pts', title: 'Exact scoreline', desc: 'Lock in your prediction up to 3 hours before kickoff.' },
]

const steps = [
  { num: '01', title: 'Get App & Verify', desc: 'Sign up and complete your BVN verification.', bg: 'bg-[#e2f7ee]', img: 'Group.png' },
  { num: '02', title: 'Transact', desc: 'Buy airtime, data, or fund your account', bg: 'bg-[#fef4dc]', img: 'Transfers-1.png' },
  { num: '03', title: 'Make Predictions', desc: 'Make predictions to advance on the leaderboard.', bg: 'bg-[#ddf4fb]', img: 'Transfers.png' },
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
          :src="getImgUrl('Ultra-clean_3D_render_of_the_202606060307_1.png')"
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
          <span class="text-[#5DC1E6] font-semibold">₦2,000,000 total prize pool</span>, paid straight to your Sycamore MFB account.
        </p>

        <!-- Buttons -->
        <div class="mt-8 flex flex-wrap gap-3">
          <NuxtLink
            to="/login"
            class="inline-flex items-center justify-center rounded-full bg-white text-[#0c2233] font-bold px-7 py-3.5 text-sm hover:bg-white/90 transition shadow-[0_4px_20px_rgba(255,255,255,0.15)]"
          >
            Get Started
          </NuxtLink>
          <NuxtLink
            to="/leaderboard"
            class="inline-flex items-center justify-center rounded-full bg-white/8 border border-white/20 text-white font-bold px-7 py-3.5 text-sm hover:bg-white/15 transition backdrop-blur-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
          >
            View leaderboard
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- Points Cards -->
    <section class="grid gap-4 sm:grid-cols-3">
      <div
        v-for="s in stats"
        :key="s.pts"
        class="relative bg-white rounded-[20px] p-6 border border-[#e8edf2] shadow-[0_2px_8px_rgba(0,0,0,0.03),0_12px_32px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.05),0_16px_40px_rgba(0,0,0,0.06)] transition-shadow duration-300"
      >
        <div class="inline-flex rounded-full border border-[#b0e5d0] px-3.5 py-1.5 text-xs font-bold text-[#1a8a5a] mb-4">
          {{ s.pts }}
        </div>
        <h3 class="text-lg font-extrabold text-ink-900">{{ s.title }}</h3>
        <p class="mt-2 text-sm text-ink-500 leading-relaxed">{{ s.desc }}</p>
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
            Winners are paid out across four cycles throughout the tournament. To qualify for prizes, download the Sycamore app, complete a transaction (airtime, data, or transfer), and maintain at least a ₦2,000 account balance.
          </p>
          <NuxtLink
            to="/login"
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
  </div>
</template>
