import { useState, useRef, useEffect, useCallback } from 'react'
import './GameSelector.css'

export default function GameSelector({ games, selectedGame, onSelect }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeId, setActiveId] = useState(selectedGame?.id ?? null)
  const containerRef = useRef(null)
  const inputRef = useRef(null)

  // Keep activeId in sync when parent changes the selected game externally
  useEffect(() => { setActiveId(selectedGame?.id ?? null) }, [selectedGame?.id])

  const filtered = query.trim()
    ? games.filter(
        (g) =>
          g.title.toLowerCase().includes(query.toLowerCase()) ||
          g.white.toLowerCase().includes(query.toLowerCase()) ||
          g.black.toLowerCase().includes(query.toLowerCase()) ||
          g.event.toLowerCase().includes(query.toLowerCase())
      )
    : games

  const handleSelect = useCallback(
    (game) => {
      if (game.id === activeId) {
        setActiveId(null)   // visually deselect
      } else {
        setActiveId(game.id)
        onSelect(game)
      }
      setQuery('')
      setOpen(false)
      inputRef.current?.blur()
    },
    [onSelect, activeId]
  )

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (!containerRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const displayValue = open ? query : (selectedGame?.title ?? '')

  return (
    <div className="game-selector" ref={containerRef}>
      <div
        className="selector-input-wrap"
        onMouseDown={(e) => {
          if (activeId !== null && !open) {
            e.preventDefault()
            setActiveId(null)
          }
        }}
      >
        <svg className="selector-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="0" y="0" width="8" height="8" fill="#7c7cff" opacity="0.9" rx="1"/>
          <rect x="8" y="0" width="8" height="8" fill="#7c7cff" opacity="0.25" rx="1"/>
          <rect x="0" y="8" width="8" height="8" fill="#7c7cff" opacity="0.25" rx="1"/>
          <rect x="8" y="8" width="8" height="8" fill="#7c7cff" opacity="0.9" rx="1"/>
        </svg>
        <input
          ref={inputRef}
          className="selector-input"
          value={displayValue}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => { setQuery(''); setOpen(true) }}
          placeholder="Search games…"
          spellCheck={false}
        />
        <span className="selector-chevron" onClick={() => setOpen((o) => !o)}>
          {open ? '▲' : '▼'}
        </span>
      </div>

      {open && (
        <ul className="selector-dropdown">
          {filtered.length === 0 && (
            <li className="selector-empty">No games found</li>
          )}
          {filtered.map((game) => (
            <li
              key={game.id}
              className={`selector-option ${game.id === activeId ? 'selected' : ''}`}
              onMouseDown={() => handleSelect(game)}
            >
              <div className="option-title">{game.title}</div>
              <div className="option-meta">
                <span className="option-white">♔ {game.white}</span>
                <span className="option-vs">vs</span>
                <span className="option-black">♚ {game.black}</span>
                <span className="option-event">{game.event}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
