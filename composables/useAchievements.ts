export interface Achievement {
  id: string
  title: string
  description: string
  icon: string
  shareText: string
}

export const useAchievements = () => {
  const { user } = useAuth()
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
    const u = user.value as any
    const points = u.total_points || 0
    const achievements: Achievement[] = []

    if (points >= 10) {
      achievements.push({
        id: 'first_10_pts',
        title: 'Getting Started',
        description: 'You earned your first 10 points!',
        icon: '🌟',
        shareText: `Just hit 10 points on the Sycamore Predictor League! The journey begins. #SycamorePredictor #WorldCup2026`,
      })
    }
    if (points >= 50) {
      achievements.push({
        id: 'fifty_pts',
        title: 'Rising Star',
        description: 'You broke through 50 points!',
        icon: '⭐',
        shareText: `50 points on the Sycamore Predictor League! My predictions are heating up. #SycamorePredictor #WorldCup2026`,
      })
    }
    if (points >= 100) {
      achievements.push({
        id: 'century',
        title: 'Century Club',
        description: '100 points! You are a prediction machine.',
        icon: '💯',
        shareText: `I just hit 100 points on the Sycamore Predictor League! Who can beat that? #SycamorePredictor #WorldCup2026`,
      })
    }
    if (points >= 250) {
      achievements.push({
        id: 'elite_250',
        title: 'Elite Predictor',
        description: '250 points. You see the game differently.',
        icon: '🏆',
        shareText: `250 points on the Sycamore Predictor League! I'm seeing the future clearly. #SycamorePredictor #WorldCup2026`,
      })
    }
    if (points >= 500) {
      achievements.push({
        id: 'legend_500',
        title: 'Legendary Status',
        description: '500 points. A true football oracle.',
        icon: '👑',
        shareText: `500 points! I've reached legendary status on the Sycamore Predictor League. #SycamorePredictor #WorldCup2026`,
      })
    }

    if (u.backed_team_id) {
      achievements.push({
        id: 'team_locked',
        title: 'Ride or Die',
        description: `You locked in with ${u.backed_team?.name || 'your team'}!`,
        icon: '🔒',
        shareText: `I've locked in with ${u.backed_team?.flag_emoji || ''} ${u.backed_team?.name || 'my team'} for the World Cup on Sycamore Predictor League! #SycamorePredictor #WorldCup2026`,
      })
    }

    if ((u.backed_team_wins || 0) >= 1) {
      achievements.push({
        id: 'first_team_win',
        title: 'Winning Feels Good',
        description: 'Your backed team got their first win!',
        icon: '🎉',
        shareText: `My team just won their first match in the World Cup! Let's gooo! #SycamorePredictor #WorldCup2026`,
      })
    }

    if ((u.backed_team_wins || 0) >= 3) {
      achievements.push({
        id: 'three_team_wins',
        title: 'On a Roll',
        description: 'Your team has 3 wins. Champions material!',
        icon: '🔥',
        shareText: `My team is ON FIRE - 3 wins in the World Cup! Are we going all the way? #SycamorePredictor #WorldCup2026`,
      })
    }

    if (u.active_customer_flag) {
      achievements.push({
        id: 'qualified',
        title: 'Fully Qualified',
        description: 'You are eligible for prizes. Game on!',
        icon: '✅',
        shareText: `I'm fully qualified for prizes on the Sycamore Predictor League! Let the games begin. #SycamorePredictor #WorldCup2026`,
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
