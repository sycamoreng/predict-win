<script setup lang="ts">
const { trackPulseEvent } = useAuth()
onMounted(() => trackPulseEvent('faq_viewed'))

const sections = [
  {
    title: 'Account Setup & Your Sycamore Wallet',
    items: [
      {
        q: 'What is the Sycamore Wallet?',
        a: 'Your Sycamore Wallet is your account within the Sycamore app, linked to your verified Bank Verification Number (BVN). It is where you hold funds and from which savings, investments, bill payments, and any Predictor League prize payouts are processed. All financial rewards from the Predictor League are paid directly into your Sycamore Wallet.',
      },
      {
        q: 'How do I set up my Sycamore Wallet?',
        a: 'Getting set up takes four short steps:\n1. Download the official Sycamore app from the Apple App Store or Google Play Store.\n2. Complete the baseline registration process by providing your legal name, email, and mobile telephone number.\n3. Input your Bank Verification Number (BVN) through our secure identity pipeline to complete mandatory Know Your Customer (KYC) clearance.\n4. Upon successful identity validation, your Sycamore Wallet is ready to use directly within your account dashboard.',
      },
      {
        q: 'What unlocks the leaderboard and power-up chips?',
        a: 'All users who have successfully registered and maintain a verified Sycamore account (through Bank Verification Number authentication and applicable Know Your Customer requirements) can play and submit predictions.\n\nTo appear on the general leaderboard and to activate power-up chips, you also need to use Sycamore for value-adding activity. This means completing at least \u20a62,000 across one or more of the following: a savings deposit or contribution, an investment funding, or a bill payment (such as airtime, data, or electricity). Wallet-to-wallet transfers, transfers to other banks, and loans (disbursements or repayments) do NOT count.\n\nComplete at least \u20a62,000 in qualifying activity and you unlock all six power-up chips and your place on the leaderboard.',
      },
      {
        q: 'Can I play as a guest?',
        a: 'Yes. You can play in guest mode and submit predictions without a fully linked Sycamore account, and your predictions are saved. However, guests do not appear on the general leaderboard, are not eligible for prizes, and cannot activate power-up chips until they register, verify their account, and complete at least \u20a62,000 in qualifying value-adding activity (savings, investment, or bill payment).',
      },
      {
        q: 'Are there any hidden fees or minimum balances required to open an account?',
        a: 'Account creation is completely free of charge. There are no maintenance penalties or hidden operational costs associated with maintaining a standard tier account. To unlock the leaderboard and power-up chips, you simply need to complete at least \u20a62,000 in value-adding activity on the Sycamore app (savings, investment, or bill payment) during the season \u2014 transfers and loans do not count.',
      },
    ],
  },
  {
    title: 'The Sycamore Predictor League (Incentives & Gameplay Rules)',
    items: [
      {
        q: 'How do I enter the Sycamore Predictor League and what can I win?',
        a: 'The Predictor League runs across the Premier League 2026/27 season, matchweek by matchweek. To enter, complete your account registration and BVN verification, then head to the Predict screen to make your picks. To appear on the leaderboard and compete for prizes, unlock your account by completing at least \u20a62,000 in value-adding activity (savings, investment, or bill payment). The season prize pool is \u20a62,000,000, made up of a grand prize for the overall champion, a runner-up prize, and weekly prizes for top players each matchweek.',
      },
      {
        q: 'How are prizes and winners decided?',
        a: 'The season prize pool is \u20a62,000,000, awarded on two cadences:\n\n\u2022 Weekly standings reset every matchweek \u2014 top players each week can win weekly prizes, paid within a seven-day payout window after the matchweek ends.\n\u2022 Overall (all-time) standings run across the whole season and decide the grand prize (overall champion) and the runner-up prize, both paid after a full end-of-season audit, with a final payout date of 11 June 2027.\n\nEligible winners are the players who rank highest while meeting the eligibility requirements (verified account plus at least \u20a62,000 in qualifying value-adding activity).\n\nIf players are level on points, ties are broken by: most exact scorelines, then most correct predictions, then most matches predicted, and finally by the earliest cumulative prediction timestamp.',
      },
      {
        q: 'How does the point calculation engine work?',
        a: 'Users accumulate points based on the accuracy of three distinct metrics submitted for each match:\n\n\u2022 Correct Match Result (5 Points): Successfully picking the outright match outcome (Home Win, Away Win, or Draw).\n\u2022 Correct First Team to Score (10 Points): Accurately picking the team that scores the opening goal of the match.\n\u2022 Correct Exact Scoreline (15 Points): Accurately forecasting the final, official scoreline at full time (including injury time).\n\nPower-up chips can multiply or protect these points \u2014 see the chips guide on the home page.',
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
      {
        q: 'Can I play in a private league with friends?',
        a: 'Yes. You can create a private group and share the join code with friends, family, or colleagues, or join a group using a code someone shares with you. Your group runs on its own standalone leaderboard, so you can compete just among yourselves for bragging rights. Note that private-group standings are separate from the main campaign prizes \u2014 eligibility for weekly prizes, the grand prize, and the runner-up prize is still based on the general leaderboard rules, including completing at least \u20a62,000 in qualifying value-adding activity.',
      },
    ],
  },
  {
    title: 'App Features (Back Your Club)',
    items: [
      {
        q: 'How does the automated "Back Your Club" savings plan work?',
        a: 'The "Back Your Club" feature is an automated micro-savings nudge designed to turn football milestones into structured savings. During setup, you select the club you\u2019re backing for the season and authorize a fixed per-win saving amount \u2014 anywhere from \u20a61,000 up to \u20a61,000,000 (\u20a61,000, \u20a62,000, \u20a65,000, \u20a610,000, \u20a620,000, \u20a650,000, \u20a6100,000, \u20a6200,000, \u20a6500,000, or \u20a61,000,000). Every time your selected club secures an official match victory, our systems automatically move that designated amount from your wallet into your dedicated savings plan shortly after the match concludes, and a notification alerts you to review your growing balance. The plan runs until it matures on 31 May 2027.',
      },
      {
        q: 'When can I withdraw funds from my savings plan?',
        a: 'Your savings plan matures on 31 May 2027, when the full balance is available to withdraw or move within the app. You are not locked in until then, though: each amount you save has just a 10-day lockout, after which you are free to withdraw that money whenever you like.',
      },
    ],
  },
  {
    title: 'Security, Compliance & Regulatory Safeguards',
    items: [
      {
        q: 'Is my money safe with Sycamore? How are you regulated?',
        a: 'Sycamore Integrated Solutions Ltd operates under the applicable regulatory framework in Nigeria. Customer funds are safeguarded in line with statutory requirements, and all user accounts require mandatory Bank Verification Number (BVN) verification to satisfy robust Anti-Money Laundering (AML) and Counter-Financing of Terrorism (CFT) requirements, ensuring that your funds and identity remain strictly secure.',
      },
      {
        q: 'How does Sycamore protect my data privacy?',
        a: 'Sycamore Integrated Solutions Ltd maintains full operational compliance with the Nigeria Data Protection Regulation (NDPR) and the Nigeria Data Protection Act. Your biometric information, BVN records, transaction histories, prediction data and all other information are encrypted both in transit and at rest using industry-standard advanced encryption protocols. Sycamore never shares, sells, or exposes user data to unverified third-party platforms without explicit, documented user consent.',
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
