const nouns = [
  'fox', 'hawk', 'wolf', 'lion', 'bear', 'elk', 'lynx',
  'orca', 'puma', 'cobra', 'tiger', 'eagle',
  'spark', 'storm', 'blaze', 'frost', 'comet', 'flare', 'pulse', 'surge',
  'bolt', 'dash', 'echo', 'flash', 'ace', 'goal', 'scout',
]

export const useRandomUsername = () => {
  const generate = (): string => {
    const noun = nouns[Math.floor(Math.random() * nouns.length)]
    const num = Math.floor(Math.random() * 99) + 1
    return `${noun}${num}`
  }

  return { generate }
}
