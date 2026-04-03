import { useCallback } from 'react'
import { playSound } from '../utils/audio'

export function useChessSound() {
  const play = useCallback((move) => {
    if (!move) return
    let key = 'move'
    if      (move.san?.includes('#') || move.san?.includes('+'))     key = 'check'
    else if (move.flags?.includes('c') || move.flags?.includes('e')) key = 'capture'
    else if (move.flags?.includes('k') || move.flags?.includes('q')) key = 'castle'
    else if (move.flags?.includes('p'))                               key = 'promote'
    playSound(key, 1.0)
  }, [])

  return { play }
}
