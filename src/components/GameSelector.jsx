import { useState, useRef, useEffect, useCallback } from 'react'
import './GameSelector.css'

export default function GameSelector({ games, selectedGame, onSelect }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (!containerRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = useCallback(
    (game) => {
      onSelect(game)
      setOpen(false)
    },
    [onSelect]
  )

  return (
    <div className="game-selector" ref={containerRef}>
      <div
        className="selector-bar"
        onMouseDown={() => setOpen(o => !o)}
      >
        <svg className="selector-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="0" y="0" width="8" height="8" fill="#7c7cff" opacity="0.9" rx="1"/>
          <rect x="8" y="0" width="8" height="8" fill="#7c7cff" opacity="0.25" rx="1"/>
          <rect x="0" y="8" width="8" height="8" fill="#7c7cff" opacity="0.25" rx="1"/>
          <rect x="8" y="8" width="8" height="8" fill="#7c7cff" opacity="0.9" rx="1"/>
        </svg>
        <span className="selector-label">
          {selectedGame?.title ?? 'Select a game…'}
        </span>
        <span className="selector-chevron">{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <ul className="selector-dropdown">
          {games.map((game) => {
            const isSelected = game.id === selectedGame?.id
            return (
              <li
                key={game.id}
                className={`selector-option${isSelected ? ' selected' : ''}`}
                onMouseDown={isSelected ? undefined : () => handleSelect(game)}
                style={isSelected ? { pointerEvents: 'none' } : undefined}
              >
                <div className="option-title">
                  {game.title}
                  {isSelected && <span className="option-check">✓</span>}
                </div>
                <div className="option-meta">
                  <span className="option-white">♔ {game.white}</span>
                  <span className="option-vs">vs</span>
                  <span className="option-black">♚ {game.black}</span>
                  <span className="option-event">{game.event}</span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
