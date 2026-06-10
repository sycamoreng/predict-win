<script setup lang="ts">
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
        q: 'What does "Active Account" mean for the Predictor League?',
        a: 'All users who have successfully registered and maintain an active Sycamore account, verified through Bank Verification Number (BVN) authentication and in accordance with applicable Know Your Customer (KYC) requirements, shall be eligible to participate in the Sycamore Predictor League and related World Cup 2026 promotional campaign activities.\n\nFor the purpose of system integrity, fraud prevention, and responsible platform usage monitoring, Sycamore may classify an account as an "Active Account" where the account holder has performed at least one qualifying financial transaction with an aggregate value of \u20A62,000 (Two Thousand Naira) or more within the Sycamore application during the campaign period. Qualifying transactions may include eligible in-app financial activities such as bill payments, airtime or data purchases, and other permitted wallet-based transactions, excluding transfers, deposits, and loan disbursements where applicable.\n\nThe "Active Account" designation is an internal operational classification used strictly for analytical reporting, fraud detection, user engagement optimisation, and service improvement purposes. It does not, on its own, determine eligibility for participation in any prize allocation or reward mechanism under the campaign.',
      },
      {
        q: 'Are there any hidden fees or minimum balances required to open an account?',
        a: 'Account creation is completely free of charge. There are no maintenance penalties or hidden operational costs associated with maintaining a standard tier account. However, to stay eligible for the live Predictor League leaderboards and secure prize payouts, users must have performed a transaction (except Loans, Deposits and Transfers) of at least \u20A62,000 on the Sycamore app within the campaign period.',
      },
    ],
  },
  {
    title: 'The Sycamore Predictor League (Incentives & Gameplay Rules)',
    items: [
      {
        q: 'How do I enter the Sycamore Predictor League and what can I win?',
        a: 'The Predictor League is a tournament-long promotional campaign running from June 11 to July 19, 2026, offering a cumulative prize pool of \u20A62,000,000. To enter, you must complete your account registration and BVN verification. Once verified, an in-app popup banner will direct you to the Predictor League portal. To validate your entry on the live leaderboard, you must top up your wallet and perform a qualifying transaction of at least \u20A62,000 (such as buying airtime or data. Transfers are not considered transactions).',
      },
      {
        q: 'What is the exact breakdown of the \u20A62,000,000 prize pool?',
        a: 'Prizes are distributed via structural tiers:\n\n\u2022 Grand Prize (Tournament Champion): \u20A6500,000 \u2014 Once, at the close of the tournament\n\u2022 Weekly Winner (1st Place): \u20A6100,000 \u2014 Awarded weekly over 4 tournament cycles (\u20A6400,000 total)\n\u2022 Weekly Runners-Up (2nd to 5th Place): \u20A650,000 per user \u2014 Awarded weekly to 4 individuals over 4 cycles (\u20A6800,000 total)\n\u2022 Matchday Random Draw: \u20A610,000 per draw \u2014 2 winners drawn across 10 designated matchdays (\u20A6200,000 total)',
      },
      {
        q: 'How does the point calculation engine work?',
        a: 'Users accumulate points based on the structural accuracy of three distinct metrics submitted for each match:\n\n\u2022 Correct Match Result (5 Points): Successfully picking the outright match outcome (Win, Lose, or Draw).\n\u2022 Correct First Goalscorer (10 Points): Accurately identifying the team that scores the opening goal of the match.\n\u2022 Correct Exact Scoreline (15 Points): Accurately forecasting the final, official scoreline at the end of regular time (including injury time, excluding penalty shootouts).',
      },
      {
        q: 'What is the 3-Hour Lock-Out Rule and can I edit my entries?',
        a: 'The prediction system gives you the flexibility to view and predict the entire week\u2019s match slate in advance. You can freely modify your submitted choices for any match up until exactly three (3) hours prior to that match\u2019s official scheduled kickoff time. Once the countdown passes the 3-hour threshold, the editing capability for that specific match locks automatically. System entries lock entirely on an individual match-by-match cadence, and customer support representatives do not have the authorization to manually alter locked parameters.',
      },
    ],
  },
  {
    title: 'App Features (Back a Team & Investments)',
    items: [
      {
        q: 'How does the automated "Back a Team" savings plan work?',
        a: 'The "Back a Team" feature is an automated micro-savings nudge designed to turn emotional football milestones into structured financial assets. During setup, you select your preferred tournament team and explicitly authorize a fixed deduction amount from your primary wallet. Every time your selected team secures an official match victory, our backend systems automatically trigger a transfer of that designated amount from your active wallet into your dedicated savings plan within two hours of the match concluding. A push notification will alert you to review your growing balance.',
      },
      {
        q: 'When can I withdraw funds from my "Back a Team" savings plan?',
        a: 'Funds accumulated within the "Back a Team" module are securely locked for the selected duration at the point of registration to discourage premature liquidations. Early liquidations are subject to administrative processing parameters to ensure compliance with microfinance asset-liability rules.',
      },
      {
        q: 'What is the "Invest Like a Scout" feature launching in Week 3?',
        a: 'Launching on June 26, 2026, the "Invest Like a Scout" module introduces fractional in-app stock trading directly inside the Sycamore app, starting at a minimum entry threshold of just \u20A65,000. Much like an elite football scout identifying undervalued, high-potential athletic talent before market value surges, this feature enables users to buy shares of fractional domestic and international equities. Please note that all equity investments carry inherent market risks. Investment returns are not guaranteed, and past performance is not a reliable indicator of future market outcomes.',
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
      <p class="text-sm text-ink-500 mt-1">Everything you need to know about the Sycamore Predictor League and World Cup 2026 campaign.</p>
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
