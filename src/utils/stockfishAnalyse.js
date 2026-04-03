/**
 * Stockfish WASM analysis service.
 * Runs stockfish-18-lite-single in a Web Worker, analyses each position,
 * and returns a win-probability array for the full game.
 */

const MOVETIME = 1500  // ms per position — enough to reach depth ~18-20

function evalToProb(cp) {
  // centipawns → white win probability using the Lichess/chess.com standard coefficient
  return 1 / (1 + Math.exp(-0.00368208 * cp))
}

function initEngine() {
  return new Promise((resolve, reject) => {
    const worker = new Worker('/stockfish-18-lite-single.js')

    const timeout = setTimeout(() => {
      worker.terminate()
      reject(new Error('Stockfish init timeout'))
    }, 15000)

    const handler = (e) => {
      if (e.data === 'readyok') {
        clearTimeout(timeout)
        worker.removeEventListener('message', handler)
        resolve(worker)
      }
    }
    worker.addEventListener('message', handler)
    worker.postMessage('uci')
    worker.postMessage('isready')
  })
}

function analysePosition(worker, fen) {
  // Stockfish always scores from the side-to-move's perspective.
  // Negate when it's black's turn so the result is always white's win probability.
  const isBlack = fen.split(' ')[1] === 'b'

  return new Promise((resolve) => {
    let cp   = 0
    let mate = null

    const handler = (e) => {
      const msg = e.data
      if (typeof msg !== 'string') return

      const cpMatch   = msg.match(/\bscore cp (-?\d+)/)
      const mateMatch = msg.match(/\bscore mate (-?\d+)/)
      if (cpMatch)   { cp = parseInt(cpMatch[1]); mate = null }
      if (mateMatch) { mate = parseInt(mateMatch[1]) }

      if (msg.startsWith('bestmove')) {
        worker.removeEventListener('message', handler)
        if (mate !== null) {
          const whiteWins = isBlack ? mate < 0 : mate > 0
          resolve(whiteWins ? 0.999 : 0.001)
        } else {
          resolve(evalToProb(isBlack ? -cp : cp))
        }
      }
    }

    worker.addEventListener('message', handler)
    worker.postMessage(`position fen ${fen}`)
    worker.postMessage(`go movetime ${MOVETIME}`)
  })
}

/**
 * Analyse a full game history.
 * @param {string[]} fens          - FEN for each position (length = moves + 1)
 * @param {function} onProgress    - called with (done, total) as positions complete
 * @param {function} isCancelled   - returns true when a newer analysis has started
 * @returns {Promise<number[]|null>} probs array, or null if cancelled/failed
 */
export async function analyseGame(fens, onProgress, isCancelled = () => false) {
  let worker
  try {
    worker = await initEngine()
  } catch (e) {
    console.error('Stockfish init failed:', e)
    return null
  }

  const probs = new Array(fens.length).fill(0.5)
  const total = fens.length - 1   // positions 1..n (skip starting position)

  for (let i = 1; i < fens.length; i++) {
    if (isCancelled()) {
      try { worker.terminate() } catch {}
      return null
    }

    try {
      probs[i] = await analysePosition(worker, fens[i])
    } catch {
      probs[i] = probs[i - 1]
    }

    onProgress(i, total)
  }

  try {
    worker.postMessage('quit')
    setTimeout(() => { try { worker.terminate() } catch {} }, 500)
  } catch {}

  return probs
}
