import { useMemo, useState, useEffect, useRef } from 'react'
import './ChessClock.css'

function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds))
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function AnimatedClock({ target, isActive, isLow, piece, label, countdownSeconds, isCountdownExpired }) {
  const [displayed, setDisplayed] = useState(target)
  const rafRef = useRef(null)
  const startRef = useRef({ from: target, time: 0 })

  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    const from = displayed
    const to = target
    if (from === to) return

    const DURATION = 500
    startRef.current = { from, time: performance.now() }

    const tick = (now) => {
      const elapsed = now - startRef.current.time
      const progress = Math.min(elapsed / DURATION, 1)
      // ease-out quad
      const eased = 1 - (1 - progress) * (1 - progress)
      const value = Math.round(from + (to - from) * eased)
      setDisplayed(value)
      if (progress < 1) rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={[
      'clock-face',
      isActive ? 'clock-active' : 'clock-idle',
      isLow    ? 'clock-low'    : '',
    ].join(' ')}>
      <div className="clock-led" />
      <div className="clock-player">
        <img src={piece} className="clock-piece" alt={label} />
        <span>{label}</span>
      </div>
      <div className="clock-label-text">Time Left</div>
      {countdownSeconds !== null ? (
        <div className={`clock-display ${isCountdownExpired ? 'clock-display-expired' : 'clock-display-countdown'}`}>
          {formatTime(countdownSeconds)}
        </div>
      ) : (
        <div className="clock-display">{formatTime(displayed)}</div>
      )}
    </div>
  )
}

export default function ChessClock({ moves, moveIndex, timeControl, countdownSeconds, isCountdownExpired }) {
  const { whiteRemaining, blackRemaining } = useMemo(() => {
    const played = moves.slice(0, moveIndex)
    const whiteUsed = played.filter(m => m.color === 'white').reduce((s, m) => s + m.timeSeconds, 0)
    const blackUsed = played.filter(m => m.color === 'black').reduce((s, m) => s + m.timeSeconds, 0)
    return {
      whiteRemaining: timeControl - whiteUsed,
      blackRemaining: timeControl - blackUsed,
    }
  }, [moves, moveIndex, timeControl])

  const activeColor = moveIndex < moves.length ? moves[moveIndex].color : (moveIndex % 2 === 0 ? 'white' : 'black')

  return (
    <div className="chess-clock">
      <AnimatedClock
        target={blackRemaining}
        isActive={activeColor === 'black'}
        isLow={blackRemaining < timeControl * 0.2}
        piece="/pieces/bK.svg"
        label="Black"
        countdownSeconds={activeColor === 'black' ? countdownSeconds : null}
        isCountdownExpired={activeColor === 'black' && isCountdownExpired}
      />
      <div className="clock-divider" />
      <AnimatedClock
        target={whiteRemaining}
        isActive={activeColor === 'white'}
        isLow={whiteRemaining < timeControl * 0.2}
        piece="/pieces/wK.svg"
        label="White"
        countdownSeconds={activeColor === 'white' ? countdownSeconds : null}
        isCountdownExpired={activeColor === 'white' && isCountdownExpired}
      />
    </div>
  )
}
