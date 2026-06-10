<script setup lang="ts">
</script>

<template>
  <div class="max-w-3xl mx-auto space-y-8">
    <div>
      <h1 class="text-2xl font-extrabold text-ink-900">Campaign Terms and Conditions</h1>
      <p class="text-sm text-ink-500 mt-1">Legal framework governing the Sycamore World Cup 2026 Promotional Campaigns.</p>
      <p class="text-xs text-ink-400 mt-2">
        This document is drafted in accordance with the Central Bank of Nigeria (CBN) consumer protection guidelines,
        the Banks and Other Financial Institutions Act (BOFIA 2020), and the Nigeria Data Protection Regulation (NDPR).
      </p>
    </div>

    <!-- Section 1 -->
    <section class="card p-6 space-y-4">
      <h2 class="text-lg font-bold text-ink-900">1. Definition of Terms</h2>
      <ul class="space-y-3 text-sm text-ink-700 leading-relaxed">
        <li><strong>"The Company"</strong> refers to Sycamore (a licensed Microfinance Bank regulated by the Central Bank of Nigeria).</li>
        <li><strong>"The Campaign"</strong> refers collectively to the 5-week promotional suite running from June 1, 2026, through July 31, 2026, consisting of the Predictor League, Back a Team Savings, World Cup Wallet utility drives, and Invest Like a Scout modules.</li>
        <li><strong>"Eligible Account"</strong> refers to a successfully registered Sycamore account linked to a verified Bank Verification Number (BVN) that has performed a transaction of at least Two Thousand Naira (&#x20A6;2,000).</li>
        <li><strong>"NUBAN Account Number"</strong> refers to the customer-facing Sycamore account number issued under the statutory guidelines of the Nigeria Uniform Bank Account Number scheme.</li>
      </ul>
    </section>

    <!-- Section 2 -->
    <section class="card p-6 space-y-4">
      <h2 class="text-lg font-bold text-ink-900">2. Eligibility Criteria for Participants</h2>
      <div class="space-y-3 text-sm text-ink-700 leading-relaxed">
        <p><strong>2.1.</strong> Participation is strictly restricted to natural persons who are legal citizens or legal residents of the Federal Republic of Nigeria, possessing full legal capacity to enter into binding contractual obligations, and who are aged 18 years or older at the date of campaign registration.</p>
        <p><strong>2.2.</strong> Employees, independent contractors, board directors, regulatory compliance partners, and immediate family members of Sycamore or its designated brand affiliates, promotional agencies, and tech infrastructure providers are strictly barred from participating in the Predictor League prize allocations.</p>
        <p><strong>2.3.</strong> To qualify for any weekly, grand, or matchday financial payouts, you must top up your wallet and perform a qualifying transaction of at least &#x20A6;2,000 (such as buying airtime or data). Accounts that fall below this &#x20A6;2,000 transaction value count at the exact moment of point computation or random selection will forfeit all claims to outstanding payouts, and points will be nullified on the live database engine.</p>
        <p><strong>2.4.</strong> All users who have successfully registered and maintain an active Sycamore account, verified through Bank Verification Number (BVN) authentication and in accordance with applicable Know Your Customer (KYC) requirements, shall be eligible to participate in the Sycamore Predictor League and related World Cup 2026 promotional campaign activities.</p>
      </div>
    </section>

    <!-- Section 3 -->
    <section class="card p-6 space-y-4">
      <h2 class="text-lg font-bold text-ink-900">3. Predictor League Mechanics and Strict Lock-Out Rules</h2>
      <div class="space-y-3 text-sm text-ink-700 leading-relaxed">
        <p><strong>3.1. System Logging:</strong> The prediction engine will capture precisely three discrete variables per match via the prediction_submitted database event: (a) outright match result, (b) identity of the first goalscorer, and (c) the exact final scoreline at the end of regular time.</p>
        <p><strong>3.2. The 3-Hour Lock-Out Clause:</strong> Participants may edit their predictions for an upcoming match slate at any time up until exactly three (3) hours prior to the official, localized kickoff time of that individual match. The system will automatically execute a hard-lock on editing capabilities at the 3-hour mark. The company accepts no liability for network latency, mobile device failures, or data connectivity disruptions that prevent a user from altering predictions before the lock-out window closes.</p>
        <p><strong>3.3. Scoring Finality:</strong> All point scoring metrics (5 points for result, 10 points for first goalscorer, 15 points for exact scoreline) are compiled programmatically using verified official match logs provided by the tournament's governing body. The company will not entertain disputes, manual reviews, or independent video-assisted appeals regarding offsides, deflected goals, or post-match administrative reversals.</p>
      </div>
    </section>

    <!-- Section 4 -->
    <section class="card p-6 space-y-4">
      <h2 class="text-lg font-bold text-ink-900">4. Prize Distribution, Tax Obligations, and Financial Payouts</h2>
      <div class="space-y-3 text-sm text-ink-700 leading-relaxed">
        <p><strong>4.1. Payout Routing:</strong> All financial rewards originating from the &#x20A6;2,000,000 cumulative prize pool will be paid directly and exclusively into the verified winner's Sycamore account number. Rewards cannot be routed, assigned, or transferred to third-party commercial bank accounts, electronic wallets, or alternative consumer names.</p>
        <p><strong>4.2. Timeline for Payouts:</strong> Weekly cash distributions (including the &#x20A6;100,000 top prize and the &#x20A6;50,000 runner-up allocations) will undergo rigorous compliance and fraud-detection auditing, and will be credited to accounts within seven (7) business days following the conclusion of each tournament week. The &#x20A6;500,000 Grand Prize will be distributed following a comprehensive audit of the entire leaderboard database during the post-tournament window, no later than July 31, 2026.</p>
        <p><strong>4.3. Taxation:</strong> All payouts are subject to applicable statutory deductions and withholding taxes as mandated by the Federal Inland Revenue Service (FIRS) of Nigeria and relevant State Boards of Internal Revenue. Winners explicitly authorize Sycamore to deduct required withholding taxes at source prior to credit notification where applicable by law.</p>
      </div>
    </section>

    <!-- Section 5 -->
    <section class="card p-6 space-y-4">
      <h2 class="text-lg font-bold text-ink-900">5. Automated "Back a Team" Micro-Savings Mandate</h2>
      <div class="space-y-3 text-sm text-ink-700 leading-relaxed">
        <p><strong>5.1. Authorization Contract:</strong> By activating the "Back a Team" savings module, the user grants an explicit, continuous direct-debit mandate authorizing Sycamore to programmatically deduct the user's pre-defined saving amount from their primary liquid wallet balance. This trigger executes automatically within two (2) hours of the user's selected team winning an official match.</p>
        <p><strong>5.2. Insufficient Balance Penalties:</strong> If a user's liquid wallet balance lacks sufficient funds to cover the micro-savings deduction at the moment of the automated trigger, the transaction will fail, the automated push notification will not fire, and the savings streak will be paused. The company will not execute partial deductions or overdrafts against the customer's account to fulfill a savings balance mandate.</p>
        <p><strong>5.3. Maturity Restrictions:</strong> Capital accumulated via the automated "Back a Team" engine remains locked as a statutory reserve for the length of the campaign. Funds will become fully unrestricted and available for liquid withdrawal or internal app transfer solely during the formal retention phase spanning July 20 to July 31, 2026.</p>
      </div>
    </section>

    <!-- Section 6 -->
    <section class="card p-6 space-y-4">
      <h2 class="text-lg font-bold text-ink-900">6. Wealth Management, Equities, and Investment Disclaimers</h2>
      <div class="space-y-3 text-sm text-ink-700 leading-relaxed">
        <p><strong>6.1. Non-Guarantee Clause:</strong> The launch of the fractional stock trading feature ("Invest Like a Scout") in Week 3 provides an educational and technical gateway for equity capital market interaction. It does not constitute formal financial, fiscal, or personalized investment advice. Sycamore makes no representation, warranty, or explicit guarantee regarding the future capital appreciation, dividend yield, or stability of any asset listed within the investment module.</p>
        <p><strong>6.2. Mandatory Compliance Warning:</strong> <em>Investment returns are not guaranteed. Past performance is not a reliable indicator of future results. Capital market assets are fundamentally exposed to market volatility, liquidity changes, and currency exchange risks. Customers acknowledge that they may lose a portion or the entirety of their invested principal when trading fractional equities.</em></p>
      </div>
    </section>

    <!-- Section 7 -->
    <section class="card p-6 space-y-4">
      <h2 class="text-lg font-bold text-ink-900">7. Data Protection, Biometric Data, and Privacy Consents</h2>
      <div class="space-y-3 text-sm text-ink-700 leading-relaxed">
        <p><strong>7.1. NDPR Compliance:</strong> Sycamore processes all customer data in strict compliance with the Nigeria Data Protection Regulation (NDPR) and the Nigeria Data Protection Act. By enrolling in this campaign, inputting a BVN, and uploading historical prediction configurations, the participant gives explicit consent for the automated collection, programmatic analysis, and internal storage of their transactional and personal identifiable information (PII).</p>
        <p><strong>7.2. Marketing Publicity Rights:</strong> Grand Prize and Weekly First Place winners grant Sycamore an unrestrictive, royalty-free, perpetual license to utilize their legal names, anonymized leaderboard aliases, photographs, and video testimonies in public relation distributions, social media broadcasts, and corporate marketing campaigns without requiring secondary approvals or extra financial compensation.</p>
      </div>
    </section>

    <!-- Section 8 -->
    <section class="card p-6 space-y-4">
      <h2 class="text-lg font-bold text-ink-900">8. Anti-Fraud, Account Security, and Disqualification Protocols</h2>
      <div class="space-y-3 text-sm text-ink-700 leading-relaxed">
        <p><strong>8.1. Account Monogamy:</strong> Each distinct legal participant is entitled to maintain exactly one (1) verified Sycamore account number. The creation of duplicate accounts, synthetic profiles, or multi-wallet instances utilizing variations of a single BVN or phone number to manipulate the Predictor League leaderboard is strictly prohibited.</p>
        <p><strong>8.2. Sybil Attacks and Bot Penalties:</strong> Any account suspected of leveraging programmatic scripts, reverse-engineered API access, automated bots, or coordinated collusive betting structures to bypass the 3-hour lock-out rule or extract points artificially will be immediately blacklisted. Upon detection, the associated predictor_league_registration event will be cancelled, all accumulated leaderboard points will be permanently deleted, and the underlying Sycamore account will be locked pending a formal investigation.</p>
        <p><strong>8.3. Account Security Responsibility:</strong> Customers bear sole operational responsibility for securing their mobile device access parameters, account passwords, security pins, and transaction tokens. Sycamore assumes no civil or criminal liability for financial losses or leaderboard point distortions arising from unauthorized account access, phone cloning, token theft, or credential sharing executed by the end-user.</p>
      </div>
    </section>

    <!-- Section 9 -->
    <section class="card p-6 space-y-4">
      <h2 class="text-lg font-bold text-ink-900">9. Limitation of Liability and Indemnification</h2>
      <div class="space-y-3 text-sm text-ink-700 leading-relaxed">
        <p><strong>9.1.</strong> Sycamore, its corporate affiliates, regulatory partners, directors, and tech infrastructure suppliers shall not be held liable for any direct, indirect, incidental, consequential, special, or exemplary damages&#x2014;including but not limited to loss of profits, goodwill, transactional data, or prediction points&#x2014;arising from technical system downtimes, network latency, cyber security breaches, forced server restarts, or general acts of God outside the reasonable control of the institution.</p>
        <p><strong>9.2.</strong> Participants agree to fully indemnify, defend, and hold harmless Sycamore from any third-party legal claims, financial liabilities, administrative penalties, civil litigations, or regulatory enforcement actions stemming from the participant's explicit breach of these terms, fraudulent misrepresentation of identity, or violation of applicable Nigerian financial service statutes.</p>
      </div>
    </section>

    <!-- Section 10 -->
    <section class="card p-6 space-y-4">
      <h2 class="text-lg font-bold text-ink-900">10. Amendment of Terms, Jurisdiction, and Dispute Resolution</h2>
      <div class="space-y-3 text-sm text-ink-700 leading-relaxed">
        <p><strong>10.1. Right to Amend:</strong> Sycamore reserves the absolute right, subject to necessary notifications under CBN consumer protection principles, to amend, extend, alter, or terminate these campaign frameworks, prize matrix structures, or eligibility criteria at any time without prior specific consent from participants.</p>
        <p><strong>10.2. Governing Law:</strong> These Terms and Conditions shall be interpreted, governed, and legally enforced in strict accordance with the federal laws of the Federal Republic of Nigeria.</p>
        <p><strong>10.3. Dispute Resolution Process:</strong> Any grievance, legal contestation, or claim arising from this campaign must first be submitted formally to the Sycamore Compliance and Customer Experience Desk via written or electronic mail. If an amicable resolution is not reached within thirty (30) business days from the receipt of the formal grievance, the dispute shall be referred to Mediation in the Lagos multi-door court house in Lagos, Nigeria, in accordance with the provisions of the Mediation and Conciliation Act of 2023.</p>
      </div>
    </section>

    <div class="text-center py-6 border-t border-ink-100">
      <p class="text-sm text-ink-500">
        Questions about these terms? Contact
        <a href="mailto:support@sycamore.ng" class="text-sky-600 font-semibold hover:underline">support@sycamore.ng</a>
      </p>
      <NuxtLink to="/faq" class="inline-block mt-2 text-sm font-semibold text-ink-600 hover:text-ink-800">
        View FAQs
      </NuxtLink>
    </div>
  </div>
</template>
