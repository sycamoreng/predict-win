<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
const { trackPulseEvent } = useAuth()
onMounted(() => trackPulseEvent('faq_viewed'))

const sections = [
  {
    title: 'Account Setup & The New Sycamore Account Number',
    items: [
      {
        q: 'What is the new Sycamore Account Number feature?',
        a: 'Your Sycamore Account Number is a full-fledged, unique NUBAN (Bank Verification Number-linked) account issued directly to you by Sycamore Microfinance Bank. Unlike temporary electronic wallets, this unique account number allows you to receive direct money transfers, fund transfers, and bill payments instantly from any commercial or microfinance bank operating within Nigeria, effectively establishing Sycamore as your primary engine for daily transaction flows.',
      },
      {
        q: 'How do I get my unique Sycamore Account Number?',
        a: 'Activating your account requires four short steps:\n1. Download the official Sycamore app from the Apple App Store or Google Play Store.\n2. Complete the baseline registration process by providing your legal name, email, and mobile telephone number.\n3. Input your Bank Verification Number (BVN) through our secure identity pipeline to complete mandatory Know Your Customer (KYC) clearance.\n4. Upon successful identity validation, the system will automatically generate and display your custom Sycamore Account Number directly within your account dashboard.',
      },
      {
        q: 'What unlocks the leaderboard and power-up chips?',
        a: 'All users who have successfully registered and maintain a verified Sycamore account (through Bank Verification Number authentication and applicable Know Your Customer requirements) can play and submit predictions.\n\nTo appear on the general leaderboard and to activate power-up chips, you also need to use Sycamore for value-adding activity. This means completing at least one of the following: a savings deposit or contribution, an investment funding, or a bill payment (such as airtime, data, or electricity). Wallet-to-wallet transfers, transfers to other banks, and loans (disbursements or repayments) do NOT count.\n\nComplete any one qualifying activity and you unlock all six power-up chips and your place on the leaderboard.',
      },
      {
        q: 'Can I play as a guest?',
        a: 'Yes. You can play in guest mode and submit predictions without a fully linked Sycamore account, and your predictions are saved. However, guests do not appear on the general leaderboard, are not eligible for prizes, and cannot activate power-up chips until they register, verify their account, and complete a qualifying value-adding activity (savings, investment, or bill payment).',
      },
      {
        q: 'Are there any hidden fees or minimum balances required to open an account?',
        a: 'Account creation is completely free of charge. There are no maintenance penalties or hidden operational costs associated with maintaining a standard tier account. To unlock the leaderboard and power-up chips, you simply need to complete a value-adding activity on the Sycamore app (savings, investment, or bill payment) during the season \u2014 transfers and loans do not count.',
      },
    ],
  },
  {
    title: 'The Sycamore Predictor League (Incentives & Gameplay Rules)',
    items: [
      {
        q: 'How do I enter the Sycamore Predictor League and what can I win?',
        a: 'The Predictor League runs across the Premier League 2026/27 season, matchweek by matchweek. To enter, complete your account registration and BVN verification, then head to the Predict screen to make your picks. To appear on the leaderboard and compete for prizes, unlock your account by completing a value-adding activity (savings, investment, or bill payment). Weekly winners and an overall season champion are rewarded \u2014 the exact prizes for the current season are shown in the app.',
      },
      {
        q: 'How are prizes and winners decided?',
        a: 'Prizes are awarded on two cadences:\n\n\u2022 Weekly standings reset every matchweek \u2014 top players each week can win weekly rewards.\n\u2022 Overall (all-time) standings run across the whole season and count towards the grand champion prize, awarded at the end of the season.\n\nEligible winners are the players who rank highest while meeting the eligibility requirements (verified account plus a qualifying value-adding activity). Exact prize amounts for the current season are displayed in the app.',
      },
      {
        q: 'How does the point calculation engine work?',
        a: 'Users accumulate points based on the accuracy of three distinct metrics submitted for each match:\n\n\u2022 Correct Match Result (5 Points): Successfully picking the outright match outcome (Win, Lose, or Draw).\n\u2022 Correct First Goalscorer (10 Points): Accurately identifying the team that scores the opening goal of the match.\n\u2022 Correct Exact Scoreline (15 Points): Accurately forecasting the final, official scoreline at full time (including injury time).\n\nPower-up chips can multiply or protect these points \u2014 see the chips guide on the home page.',
      },
      {
        q: 'When do predictions lock and can I edit my entries?',
        a: 'You can view and predict the whole matchweek\u2019s fixtures in advance, and freely modify your picks for any match up until one (1) hour before that match\u2019s official scheduled kickoff time. Once the countdown passes the 1-hour threshold, editing for that specific match locks automatically. Matches lock individually on a match-by-match basis, and customer support representatives cannot manually alter locked entries.',
      },
      {
        q: 'What are power-up chips and how often can I use them?',
        a: 'Power-up chips let you multiply your points, protect your streak, or go for a big bonus. There are six chips (including Double Down, Triple Captain, First Blood, Streak Shield, Perfect Week, and Last Stand). You can activate only one chip per matchweek, and a chip cannot be activated once that matchweek\u2019s predictions have locked. Chips are unlocked once your account meets the eligibility requirements. See the chips guide on the home page for what each one does.',
      },
      {
        q: 'How do prediction streaks work?',
        a: 'String correct predictions together to build a streak. The longer your streak runs, the higher it climbs, and reaching certain milestones can unlock rewards. The Streak Shield chip protects your streak for a matchweek so a wrong prediction won\u2019t reset your counter.',
      },
    ],
  },
  {
    title: 'App Features (Back Your Club & Investments)',
    items: [
      {
        q: 'How does the automated "Back Your Club" savings plan work?',
        a: 'The "Back Your Club" feature is an automated micro-savings nudge designed to turn football milestones into structured savings. During setup, you select the club you\u2019re backing for the season and authorize a fixed deduction amount from your primary wallet. Every time your selected club secures an official match victory, our systems automatically move that designated amount from your wallet into your dedicated savings plan shortly after the match concludes, and a notification alerts you to review your growing balance.',
      },
      {
        q: 'When can I withdraw funds from my savings plan?',
        a: 'Funds accumulated within the savings module are held for the duration you selected at setup to discourage premature liquidations. Early liquidations are subject to standard administrative processing to ensure compliance with microfinance asset-liability rules.',
      },
      {
        q: 'What is the "Invest Like a Scout" feature?',
        a: 'The "Invest Like a Scout" module offers fractional in-app stock trading directly inside the Sycamore app. Much like a football scout spotting undervalued, high-potential talent before their value rises, this feature lets you buy fractional shares of domestic and international equities. Please note that all equity investments carry market risk: returns are not guaranteed, and past performance is not a reliable indicator of future results.',
      },
    ],
  },
  {
    title: 'Security, Compliance & Regulatory Safeguards',
    items: [
      {
        q: 'Is my money safe with Sycamore? How are you regulated?',
        a: 'Sycamore operates as a fully licensed Microfinance Bank under the regulatory purview of the Central Bank of Nigeria (CBN). Customer deposits are fundamentally protected under the statutory frameworks of the Nigeria Deposit Insurance Corporation (NDIC). Furthermore, all user accounts require mandatory Bank Verification Number (BVN) verification to satisfy robust Anti-Money Laundering (AML) and Counter-Financing of Terrorism (CFT) requirements, ensuring that your funds and identity remain strictly secure.',
      },
      {
        q: 'How does Sycamore protect my data privacy?',
        a: 'Sycamore maintains full operational compliance with the Nigeria Data Protection Regulation (NDPR) and the Nigeria Data Protection Act. Your biometric information, BVN records, transaction histories, prediction data and all other information are encrypted both in transit and at rest using industry-standard advanced encryption protocols. Sycamore never shares, sells, or exposes user data to unverified third-party platforms without explicit, documented user consent.',
      },
    ],
  },
]

const openIndex = ref<number | null>(null)

function toggle(flatIdx: number) {
  openIndex.value = openIndex.value === flatIdx ? null : flatIdx
}

let globalIdx = 0
function nextIdx() {
  return globalIdx++
}
</script>

<template>
  <div class="max-w-3xl mx-auto space-y-8">
    <div>
      <h1 class="text-2xl font-extrabold text-ink-900">Frequently Asked Questions</h1>
      <p class="text-sm text-ink-500 mt-1">Everything you need to know about the Sycamore Predictor League.</p>
    </div>

    <div v-for="section in sections" :key="section.title" class="space-y-3">
      <h2 class="text-base font-bold text-ink-800 border-b border-ink-100 pb-2">{{ section.title }}</h2>

      <div
        v-for="(item, idx) in section.items"
        :key="idx"
        class="card overflow-hidden"
      >
        <button
          @click="toggle(sections.slice(0, sections.indexOf(section)).reduce((a, s) => a + s.items.length, 0) + idx)"
          class="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-ink-50 transition"
        >
          <span class="font-semibold text-sm text-ink-800">{{ item.q }}</span>
          <svg
            class="w-4 h-4 text-ink-400 shrink-0 transition-transform"
            :class="{ 'rotate-180': openIndex === sections.slice(0, sections.indexOf(section)).reduce((a, s) => a + s.items.length, 0) + idx }"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <div
          v-if="openIndex === sections.slice(0, sections.indexOf(section)).reduce((a, s) => a + s.items.length, 0) + idx"
          class="px-4 pb-4 text-sm text-ink-600 leading-relaxed whitespace-pre-line"
        >
          {{ item.a }}
        </div>
      </div>
    </div>

    <div class="text-center py-6 border-t border-ink-100">
      <p class="text-sm text-ink-500">
        Still have questions? Reach us at
        <a href="mailto:complaints@sycamore.ng" class="text-sky-600 font-semibold hover:underline">complaints@sycamore.ng</a>
        or via the in-app chat.
      </p>
      <NuxtLink to="/terms" class="inline-block mt-2 text-sm font-semibold text-ink-600 hover:text-ink-800">
        View Terms & Conditions
      </NuxtLink>
    </div>
  </div>
</template>
