import { SOUND_URIS } from './soundData'

// One pre-created Audio element per sound — data URIs mean zero network.
// Calling play() on the same element can interrupt itself; for rapid-fire
// use cases (move navigation) we keep a tiny pool per key.
const POOL = 3
const pools = {}

function getPool(key) {
  if (!pools[key]) {
    pools[key] = {
      els: Array.from({ length: POOL }, () => new Audio(SOUND_URIS[key])),
      idx: 0,
    }
  }
  return pools[key]
}

export function playSound(key, volume = 1.0) {
  const uri = SOUND_URIS[key]
  if (!uri) return
  const p   = getPool(key)
  const el  = p.els[p.idx]
  p.idx     = (p.idx + 1) % POOL
  el.volume = volume
  el.currentTime = 0
  el.play().catch(() => {})
}
