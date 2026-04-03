import { useState, useEffect, useCallback } from 'react'
import './VsIntro.css'

// (col, row): col 0=a,1=b,2=c; row 0=rank1,1=rank2,2=rank3
// Start: Q=a1, K=b3.  Odd steps = check (+), even steps = safe.
// 16-move cycle: Qb1+, Ka3, Qc1+, Ka2, Qc2+, Ka1, Qc3+, Kb1,
//                Qb3+, Kc1, Qa3+, Kc2, Qa2+, Kc3, Qa1+, Kb3 → repeat
const CHESS_CYCLE = [
  { q: [0, 0], k: [1, 2] },  //  0  start  Q=a1 K=b3  (safe)
  { q: [1, 0], k: [1, 2] },  //  1  Qb1+   Q=b1 K=b3  CHECK (file)
  { q: [1, 0], k: [0, 2] },  //  2  Ka3    Q=b1 K=a3  safe
  { q: [2, 0], k: [0, 2] },  //  3  Qc1+   Q=c1 K=a3  CHECK (diagonal)
  { q: [2, 0], k: [0, 1] },  //  4  Ka2    Q=c1 K=a2  safe
  { q: [2, 1], k: [0, 1] },  //  5  Qc2+   Q=c2 K=a2  CHECK (rank)
  { q: [2, 1], k: [0, 0] },  //  6  Ka1    Q=c2 K=a1  safe
  { q: [2, 2], k: [0, 0] },  //  7  Qc3+   Q=c3 K=a1  CHECK (diagonal)
  { q: [2, 2], k: [1, 0] },  //  8  Kb1    Q=c3 K=b1  safe
  { q: [1, 2], k: [1, 0] },  //  9  Qb3+   Q=b3 K=b1  CHECK (file)
  { q: [1, 2], k: [2, 0] },  // 10  Kc1    Q=b3 K=c1  safe
  { q: [0, 2], k: [2, 0] },  // 11  Qa3+   Q=a3 K=c1  CHECK (diagonal)
  { q: [0, 2], k: [2, 1] },  // 12  Kc2    Q=a3 K=c2  safe
  { q: [0, 1], k: [2, 1] },  // 13  Qa2+   Q=a2 K=c2  CHECK (rank)
  { q: [0, 1], k: [2, 2] },  // 14  Kc3    Q=a2 K=c3  safe
  { q: [0, 0], k: [2, 2] },  // 15  Qa1+   Q=a1 K=c3  CHECK (diagonal)
  // step 16 % 16 = 0 → Kb3 returns to start position
]

function getChessPos(step) {
  return CHESS_CYCLE[step % 16]
}

const CELL = 26  // px per cell

const LOADING_MSGS = [
  'Setting up the board',
  'Polishing the pieces',
  'Sharpening the bishops',
  'Oiling the rooks',
  'Consulting the grandmasters',
  'Dusting off the pawns',
  'Studying the opening book',
  'Warming up the engine',
  'Scouting for blunders',
  'Counting the pawns',
  'Checking for tactics',
  'Scanning for pins and forks',
  'Calculating variations',
  'Hunting for combinations',
  'Tracing the king\'s journey',
  'Mapping pawn structures',
  'Weighing the material',
  'Probing for weaknesses',
  'Examining piece activity',
  'Thinking several moves ahead',
  'Assessing the pawn islands',
  'Checking rook coordination',
  'Spotting the sacrifices',
  'Looking for the killer move',
  'Analysing pawn breaks',
  'Studying piece placement',
  'Reviewing the middlegame',
  'Evaluating each position',
  'Finding the best line',
  'Looking for forced sequences',
  'Sifting through the endgame',
  'Annotating the moves',
  'Reviewing the critical moments',
  'Double-checking every move',
  'Wrapping up the analysis',
  'Putting on the finishing touches',
  'Almost ready',
  'Almost there',
  'Final checks',
  'Ready in a moment',
]

const PLAYER_INFO = {
  'Paul Morphy':           { country: 'USA',      flag: '🇺🇸' },
  'Duke of Brunswick':     { country: 'Germany',  flag: '🇩🇪' },
  'Adolf Anderssen':       { country: 'Germany',  flag: '🇩🇪' },
  'Lionel Kieseritzky':    { country: 'Russia',   flag: '🇷🇺' },
  'Jean Dufresne':         { country: 'Germany',  flag: '🇩🇪' },
  'Bobby Fischer':         { country: 'USA',      flag: '🇺🇸' },
  'Donald Byrne':          { country: 'USA',      flag: '🇺🇸' },
  'Garry Kasparov':        { country: 'Russia',   flag: '🇷🇺' },
  'Veselin Topalov':       { country: 'Bulgaria', flag: '🇧🇬' },
  'Wilhelm Steinitz':      { country: 'Austria',  flag: '🇦🇹' },
  'Curt von Bardeleben':   { country: 'Germany',  flag: '🇩🇪' },
  'Louis Paulsen':         { country: 'Germany',  flag: '🇩🇪' },
  'Alexander Alekhine':    { country: 'France',   flag: '🇫🇷' },
  'Aaron Nimzowitsch':     { country: 'Denmark',  flag: '🇩🇰' },
  'Mikhail Botvinnik':     { country: 'USSR',     flag: '🇷🇺' },
  'Jose Raul Capablanca':  { country: 'Cuba',     flag: '🇨🇺' },
  'Boris Spassky':         { country: 'Russia',   flag: '🇷🇺' },
  'Anatoly Karpov':        { country: 'Russia',   flag: '🇷🇺' },
  'Alexei Shirov':         { country: 'Spain',    flag: '🇪🇸' },
  'Viswanathan Anand':     { country: 'India',    flag: '🇮🇳' },
  'Deep Blue':             { country: 'USA',      flag: '🇺🇸' },
  'Magnus Carlsen':        { country: 'Norway',   flag: '🇳🇴' },
  'Sergey Karjakin':       { country: 'Russia',   flag: '🇷🇺' },
}

function PlayerCard({ name, rating, side }) {
  const info = PLAYER_INFO[name] || {}
  const pieceImg = side === 'white' ? '/pieces/wK.svg' : '/pieces/bK.svg'

  return (
    <div className={`vs-player-card vs-card-${side}`}>
      <div className="vs-card-shine" />
      <div className="vs-avatar-ring">
        <img src={pieceImg} className="vs-avatar-piece" alt={side} />
      </div>
      <div className="vs-player-name">{name}</div>
      <div className="vs-player-meta">
        {info.flag && <span className="vs-flag">{info.flag}</span>}
        {info.country && <span className="vs-country">{info.country}</span>}
        {rating && <span className="vs-rating">{rating}</span>}
      </div>
      <div className={`vs-color-badge vs-color-${side}`}>{side}</div>
    </div>
  )
}

// analysisProgress: null = no analysis, 0..1 = in progress/done
export default function VsIntro({ game, onComplete, analysisProgress }) {
  const [phase, setPhase]         = useState('enter')
  const [timerDone, setTimerDone] = useState(false)
  const [chessStep, setChessStep] = useState(0)

  const analysing      = analysisProgress !== null
  const analysisDone   = analysisProgress === null || analysisProgress >= 1
  const canExit        = timerDone && analysisDone

  // 2.6 s display timer (always runs)
  useEffect(() => {
    const t = setTimeout(() => setTimerDone(true), 2600)
    return () => clearTimeout(t)
  }, [])

  // Exit when timer AND analysis both done
  useEffect(() => {
    if (!canExit) return
    setPhase('exit')
  }, [canExit])

  // Call onComplete after exit animation
  useEffect(() => {
    if (phase !== 'exit') return
    const t = setTimeout(onComplete, 700)
    return () => clearTimeout(t)
  }, [phase, onComplete])

  // Click skips the wait — only allowed once analysis is fully done
  const handleClick = useCallback(() => {
    if (analysisDone && phase !== 'exit') setPhase('exit')
  }, [analysisDone, phase])

  // Advance chess by 1 step on every Stockfish position completion (every non-zero progress update)
  useEffect(() => {
    if (!analysisProgress) return
    setChessStep(prev => prev + 1)
  }, [analysisProgress])

  const pct = analysisProgress ?? 0

  return (
    <div className={`vs-overlay vs-phase-${phase}`} onClick={handleClick}>
      {/* Left half — white player */}
      <div className="vs-half vs-half-left">
        <PlayerCard name={game.white} rating={game.whiteRating} side="white" />
      </div>

      {/* Right half — black player */}
      <div className="vs-half vs-half-right">
        <PlayerCard name={game.black} rating={game.blackRating} side="black" />
      </div>

      {/* Center badge — VS text + game info, always vertically centered */}
      <div className="vs-center-badge">
        <div className="vs-divider-line" />
        <div className="vs-vs-text">VS</div>
        <div className="vs-divider-line" />
        {game.title && <div className="vs-game-title">{game.title}</div>}
        <div className="vs-event-label">{game.event}</div>
        {!analysing && <div className="vs-skip-hint">click to skip</div>}
      </div>

      {/* Analysis section — chess board + progress, anchored below center */}
      {analysing && (() => {
        const pos = getChessPos(chessStep)
        return (
          <div className="vs-analysis-section">
            <div className="vs-chess-board">
              {Array.from({ length: 3 }, (_, vRow) =>
                Array.from({ length: 3 }, (_, col) => {
                  const rank = 2 - vRow
                  const isDark = (col + vRow) % 2 === 0
                  const isCheck = chessStep % 2 === 1
                    && pos.k[0] === col && pos.k[1] === rank
                  return (
                    <div
                      key={`${col}-${vRow}`}
                      className={`vs-cell ${isDark ? 'vs-cell-dark' : 'vs-cell-light'}${isCheck ? ' vs-cell-check' : ''}`}
                    />
                  )
                })
              )}
              <img
                src="/pieces/wQ.svg"
                className="vs-chess-piece"
                style={{ left: pos.q[0] * CELL, top: (2 - pos.q[1]) * CELL }}
                alt=""
              />
              <img
                src="/pieces/bK.svg"
                className="vs-chess-piece"
                style={{ left: pos.k[0] * CELL, top: (2 - pos.k[1]) * CELL }}
                alt=""
              />
            </div>
            <div className="vs-progress-group">
              <div className="vs-progress-track">
                <div className="vs-progress-fill" style={{ width: `${Math.round(pct * 100)}%` }} />
              </div>
              <div className="vs-analysis-label">
                <span className="vs-label-pct">
                  {pct < 1 ? `${Math.round(pct * 100)}%` : '100%'}
                </span>
                <span className="vs-label-msg">
                  {pct < 1
                    ? LOADING_MSGS[Math.min(LOADING_MSGS.length - 1, Math.floor(pct * LOADING_MSGS.length))]
                    : 'Ready to play'}
                </span>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
