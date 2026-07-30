<script setup lang="ts">
const router = useRouter()

definePageMeta({ layout: false })
</script>

<template>
  <div class="min-h-screen flex flex-col md:flex-row">
    <!-- Left branding panel (desktop only) -->
    <div class="hidden md:flex md:w-[42%] lg:w-[38%] bg-gradient-to-br from-ink-900 via-ink-800 to-sky-900 relative overflow-hidden flex-col justify-between p-8 lg:p-10">
      <div class="absolute inset-0 opacity-[0.03]" style="background-image: url('/Group_(1).svg'); background-size: 280px; background-repeat: repeat;" />

      <div class="relative z-10">
        <div class="flex items-center gap-2.5">
          <img src="/logo-white.png" alt="Sycamore" class="h-9 w-auto" />
        </div>
      </div>

      <div class="relative z-10 space-y-5">
        <h2 class="text-2xl lg:text-3xl font-extrabold text-white leading-tight">
          Predict. Compete.<br />Win real rewards.
        </h2>
        <p class="text-ink-400 text-sm leading-relaxed max-w-xs">
          The FIFA World Cup 2026 Predictor League has concluded. Thank you to everyone who played!
        </p>
      </div>

      <p class="relative z-10 text-ink-500 text-[11px]">&copy; 2026 Sycamore. All rights reserved.</p>
    </div>

    <!-- Right panel -->
    <div class="flex-1 flex items-center justify-center px-5 py-8 sm:py-12">
      <div class="w-full max-w-sm text-center">
        <!-- Mobile logo -->
        <div class="md:hidden flex items-center justify-center gap-2 mb-8">
          <img src="/Group.png" alt="Sycamore" class="h-7 w-7" />
          <span class="text-sm font-extrabold text-ink-900">Predictor League</span>
        </div>

        <div class="animate-fade-up space-y-5">
          <div class="w-16 h-16 mx-auto rounded-2xl bg-ink-100 grid place-items-center">
            <svg class="w-8 h-8 text-ink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          <div>
            <h1 class="text-xl font-extrabold text-ink-900">Campaign has ended</h1>
            <p class="mt-2 text-sm text-ink-500 leading-relaxed">
              The FIFA World Cup 2026 Predictor League is no longer active. We're not accepting new sign-ups or predictions at this time.
            </p>
          </div>

          <div class="bg-ink-50 rounded-xl p-4 text-left space-y-2">
            <p class="text-xs font-semibold text-ink-700">What happened to my points?</p>
            <p class="text-xs text-ink-500 leading-relaxed">
              All leaderboard results and payouts have been finalized. If you were a winner, your payout has been processed to your Sycamore account.
            </p>
          </div>

          <a
            href="https://sycamore.ng"
            target="_blank"
            rel="noreferrer"
            class="inline-flex items-center gap-2 text-sm font-semibold text-sky-600 hover:text-sky-700 transition"
          >
            Visit Sycamore
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </a>
        </div>

        <!-- Mobile attribution -->
        <div class="md:hidden mt-10 text-center">
          <a
            href="https://sycamore.ng"
            target="_blank"
            rel="noreferrer"
            class="inline-flex items-center gap-1.5 text-[11px] text-ink-400 hover:text-ink-600 transition"
          >
            <img src="/Group.png" alt="" class="w-3 h-3 opacity-50" />
            <span>A product by <span class="font-medium">Sycamore</span></span>
          </a>
        </div>
      </div>
    </div>
  </div>
</template>
