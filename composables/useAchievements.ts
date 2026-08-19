export interface Achievement {
  id: string
  title: string
  description: string
  icon: string
  shareText: string
  tier?: 'bronze' | 'silver' | 'gold' | 'legend'
}

export const useAchievements = () => {
  const {
    user,
    campaignPoints,
    campaignBackedTeamId,
    campaignBackedTeam,
    campaignBackedTeamWins,
    campaignCorrectPredictions,
    campaignExactScorelines,
    campaignLongestStreak,
    campaignChipsUsed,
  } = useAuth()
  const { config: campaign } = useCampaign()
  const dismissedKey = 'predictor_dismissed_achievements'

  const getDismissed = (): string[] => {
    if (!import.meta.client) return []
    try {
      return JSON.parse(localStorage.getItem(dismissedKey) || '[]')
    } catch { return [] }
  }

  const dismiss = (id: string) => {
    if (!import.meta.client) return
    const list = getDismissed()
    if (!list.includes(id)) {
      list.push(id)
      localStorage.setItem(dismissedKey, JSON.stringify(list))
    }
  }

  const allAchievements = computed((): Achievement[] => {
    if (!user.value) return []
    const points = campaignPoints.value
    const wins = campaignBackedTeamWins.value
    const correct = campaignCorrectPredictions.value
    const exact = campaignExactScorelines.value
    const streak = campaignLongestStreak.value
    const chips = campaignChipsUsed.value
    const teamName = campaignBackedTeam.value?.name || 'my club'
    const campaignName = campaign.value.name || 'Sycamore Predictor League'
    const tag = '#SycamorePredictor'
    const achievements: Achievement[] = []

    // Points milestones — climbing the table
    if (points >= 10) {
      achievements.push({
        id: 'first_10_pts',
        title: 'Off the Mark',
        description: 'Your first 10 points are on the board.',
        icon: '⚽',
        tier: 'bronze',
        shareText: `Off the mark on the ${campaignName} — first points on the board! ${tag}`,
      })
    }
    if (points >= 50) {
      achievements.push({
        id: 'fifty_pts',
        title: 'Europe Places',
        description: '50 points — you are pushing up the table.',
        icon: '⭐',
        tier: 'bronze',
        shareText: `50 points on the ${campaignName} and climbing the table. ${tag}`,
      })
    }
    if (points >= 100) {
      achievements.push({
        id: 'century',
        title: 'Century Maker',
        description: '100 points. A proper title challenger.',
        icon: '💯',
        tier: 'silver',
        shareText: `Just brought up my century on the ${campaignName} — 100 points! ${tag}`,
      })
    }
    if (points >= 250) {
      achievements.push({
        id: 'elite_250',
        title: 'Title Contender',
        description: '250 points. Top of the form table.',
        icon: '🏆',
        tier: 'gold',
        shareText: `250 points on the ${campaignName}. Genuine title contender. ${tag}`,
      })
    }
    if (points >= 500) {
      achievements.push({
        id: 'legend_500',
        title: 'Invincible',
        description: '500 points. Legendary, unbeaten form.',
        icon: '👑',
        tier: 'legend',
        shareText: `500 points on the ${campaignName} — Invincible status unlocked. ${tag}`,
      })
    }

    // Prediction accuracy
    if (correct >= 5) {
      achievements.push({
        id: 'correct_5',
        title: 'Reading the Game',
        description: '5 correct predictions. You know your football.',
        icon: '🎯',
        tier: 'bronze',
        shareText: `5 correct calls on the ${campaignName}. Reading the game nicely. ${tag}`,
      })
    }
    if (correct >= 25) {
      achievements.push({
        id: 'correct_25',
        title: 'Star Analyst',
        description: '25 correct predictions. The pundits are watching.',
        icon: '📊',
        tier: 'silver',
        shareText: `25 correct predictions on the ${campaignName}. Star analyst stuff. ${tag}`,
      })
    }
    if (exact >= 1) {
      achievements.push({
        id: 'exact_1',
        title: 'Crystal Ball',
        description: 'You nailed an exact scoreline!',
        icon: '🔮',
        tier: 'silver',
        shareText: `Called the exact scoreline on the ${campaignName}. Crystal ball vibes. ${tag}`,
      })
    }
    if (exact >= 5) {
      achievements.push({
        id: 'exact_5',
        title: 'Scoreline Whisperer',
        description: '5 exact scorelines. Uncanny.',
        icon: '🧠',
        tier: 'gold',
        shareText: `5 exact scorelines predicted on the ${campaignName}. Scoreline whisperer. ${tag}`,
      })
    }

    // Backing a club
    if (campaignBackedTeamId.value) {
      achievements.push({
        id: 'team_locked',
        title: 'True Colours',
        description: `You are backing ${teamName} for the season.`,
        icon: '🧣',
        tier: 'bronze',
        shareText: `Backing ${teamName} all season on the ${campaignName}. True colours. ${tag}`,
      })
    }
    if (wins >= 1) {
      achievements.push({
        id: 'first_team_win',
        title: 'Three Points',
        description: `${teamName} got you your first win!`,
        icon: '🎉',
        tier: 'bronze',
        shareText: `${teamName} banked me three points on the ${campaignName}! ${tag}`,
      })
    }
    if (wins >= 3) {
      achievements.push({
        id: 'three_team_wins',
        title: 'On a Run',
        description: `${teamName} are on a 3-win run. Top form.`,
        icon: '🔥',
        tier: 'silver',
        shareText: `${teamName} on a run — 3 wins on the ${campaignName}! ${tag}`,
      })
    }
    if (wins >= 6) {
      achievements.push({
        id: 'six_team_wins',
        title: 'Title Charge',
        description: `${teamName} have 6 wins. Championship pace.`,
        icon: '🚀',
        tier: 'gold',
        shareText: `${teamName} on championship pace — 6 wins on the ${campaignName}! ${tag}`,
      })
    }

    // Winning streaks — momentum
    if (streak >= 3) {
      achievements.push({
        id: 'streak_3',
        title: 'Purple Patch',
        description: '3 correct predictions in a row. Momentum is building.',
        icon: '\u26A1',
        tier: 'bronze',
        shareText: `On a 3-match winning run on the ${campaignName}. Purple patch! ${tag}`,
      })
    }
    if (streak >= 5) {
      achievements.push({
        id: 'streak_5',
        title: 'In the Zone',
        description: '5 correct predictions on the bounce. Unstoppable.',
        icon: '\uD83D\uDD25',
        tier: 'silver',
        shareText: `5 correct calls in a row on the ${campaignName}. In the zone. ${tag}`,
      })
    }
    if (streak >= 10) {
      achievements.push({
        id: 'streak_10',
        title: 'Ice Cold',
        description: '10-match prediction streak. Ruthless form.',
        icon: '\uD83E\uDDCA',
        tier: 'gold',
        shareText: `A 10-match prediction streak on the ${campaignName}. Ice cold. ${tag}`,
      })
    }

    // Chips — using the power-ups
    if (chips >= 1) {
      achievements.push({
        id: 'chip_1',
        title: 'Chip Off the Block',
        description: 'You played your first power-up chip.',
        icon: '\uD83C\uDCCF',
        tier: 'bronze',
        shareText: `Played my first power-up chip on the ${campaignName}. Game on. ${tag}`,
      })
    }
    if (chips >= 5) {
      achievements.push({
        id: 'chip_5',
        title: 'Master Tactician',
        description: '5 chips played. You are working every angle.',
        icon: '\u265F\uFE0F',
        tier: 'silver',
        shareText: `5 power-up chips played on the ${campaignName}. Master tactician. ${tag}`,
      })
    }

    if (user.value?.active_customer_flag) {
      achievements.push({
        id: 'qualified',
        title: 'Signed & Sealed',
        description: 'You are fully qualified for prizes. Game on!',
        icon: '✅',
        tier: 'silver',
        shareText: `Signed, sealed and qualified for prizes on the ${campaignName}! ${tag}`,
      })
    }

    return achievements
  })

  const unshownAchievements = computed(() => {
    const dismissed = getDismissed()
    return allAchievements.value.filter((a) => !dismissed.includes(a.id))
  })

  const latestUnshown = computed(() => unshownAchievements.value[unshownAchievements.value.length - 1] || null)

  return { allAchievements, unshownAchievements, latestUnshown, dismiss }
}
