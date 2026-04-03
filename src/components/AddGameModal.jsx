import { useState, useRef, useEffect, useCallback } from 'react'
import { importFromPgn } from '../utils/parseChessCom'
import './AddGameModal.css'

export default function AddGameModal({ onAdd, onClose }) {
  const [pgn, setPgn]       = useState('')
  const [error, setError]   = useState('')
  const textareaRef = useRef(null)

  useEffect(() => {
    textareaRef.current?.focus()
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleSubmit = useCallback((e) => {
    e?.preventDefault()
    if (!pgn.trim()) return
    setError('')
    try {
      const game = importFromPgn(pgn)
      onAdd(game)
      onClose()
    } catch (err) {
      setError(err.message)
    }
  }, [pgn, onAdd, onClose])

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-panel">
        <div className="modal-sheen" />

        <div className="modal-header">
          <span className="modal-title">Import Game</span>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <svg width="11" height="11" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <line x1="1.5" y1="1.5" x2="8.5" y2="8.5"/>
              <line x1="8.5" y1="1.5" x2="1.5" y2="8.5"/>
            </svg>
          </button>
        </div>

        <form className="modal-body" onSubmit={handleSubmit}>
          <label className="modal-label">Paste PGN</label>
          <textarea
            ref={textareaRef}
            className={`modal-textarea${error ? ' modal-textarea-error' : ''}`}
            placeholder={'[Event "Live Chess"]\n[White "..."]\n[Black "..."]\n\n1. e4 {[%clk 0:10:00]} 1... e5 ...'}
            value={pgn}
            onChange={(e) => { setPgn(e.target.value); setError('') }}
            spellCheck={false}
          />

          {error && (
            <div className="modal-error">
              {error.split('\n').map((line, i) => <div key={i}>{line}</div>)}
            </div>
          )}

          <div className="modal-hint">
            <strong>How to get PGN with clock data from chess.com:</strong>
            {' '}Open the game → <strong>⋯</strong> → <strong>Share &amp; Export</strong> → <strong>Copy PGN</strong> → make sure <strong>Include time stamps</strong> is enabled → copy and paste above.
          </div>

          <button
            type="submit"
            className="modal-submit"
            disabled={!pgn.trim()}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Import Game
          </button>
        </form>
      </div>
    </div>
  )
}
