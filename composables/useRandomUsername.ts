const adjectives = [
  'swift', 'bold', 'keen', 'cool', 'epic', 'fair', 'fast', 'gold',
  'iron', 'jade', 'nova', 'pure', 'rare', 'sage', 'vast', 'wise',
  'aqua', 'blue', 'calm', 'dawn', 'ever', 'free', 'glow', 'haze',
  'lush', 'mint', 'opal', 'peak', 'rich', 'silk', 'true', 'warm',
  'brave', 'crisp', 'deft', 'fleet', 'grand', 'lunar', 'prime', 'royal',
  'sleek', 'solar', 'vivid', 'agile', 'chill', 'noble', 'rapid', 'sonic',
]

const nouns = [
  'fox', 'hawk', 'wolf', 'lion', 'bear', 'dove', 'elk', 'lynx',
  'orca', 'puma', 'raven', 'viper', 'falcon', 'cobra', 'tiger', 'eagle',
  'spark', 'storm', 'blaze', 'frost', 'comet', 'flare', 'pulse', 'surge',
  'drift', 'ridge', 'stone', 'crest', 'flame', 'shade', 'trail', 'creek',
  'bolt', 'dash', 'echo', 'flash', 'glyph', 'nexus', 'prism', 'quest',
  'scout', 'striker', 'keeper', 'winger', 'ace', 'goal', 'pitch', 'volley',
]

export const useRandomUsername = () => {
  const generate = (): string => {
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
    const noun = nouns[Math.floor(Math.random() * nouns.length)]
    const num = Math.floor(Math.random() * 99) + 1
    return `${adj}-${noun}-${num}`
  }

  return { generate }
}
