import { useState } from 'react'
import '../styles/TalkButton.css'

const STATE_CONFIG = {
  idle:       { label: 'Start Conversation', hint: null },
  listening:  { label: 'Listening...',        hint: 'click to stop' },
  recording:  { label: 'Speaking detected',   hint: 'click to stop' },
  processing: { label: 'Processing...',       hint: 'click to stop' },
  speaking:   { label: 'Agent speaking...',   hint: 'click to stop' },
  error:      { label: 'Start Conversation',  hint: null },
}

export default function TalkButton({
  isSessionActive,
  onStart,
  onStop,
  displayStatus,
  volumeLevel,
  sessionState,
  onSensitivityChange,
}) {
  const [sensitivity, setSensitivity] = useState(4)

  const config = STATE_CONFIG[displayStatus] || STATE_CONFIG.idle
  const showVolume = sessionState === 'listening' || sessionState === 'speaking'

  function volumeColor() {
    if (volumeLevel < 30) return '#22c55e'
    if (volumeLevel < 65) return '#eab308'
    return '#ef4444'
  }

  function handleClick() {
    if (isSessionActive) onStop()
    else onStart()
  }

  function handleSensitivity(e) {
    const val = Number(e.target.value)
    setSensitivity(val)
    onSensitivityChange?.(val)
  }

  return (
    <div className="talk-btn-container">
      <button
        className={`talk-btn ${displayStatus}`}
        onClick={handleClick}
        aria-label={config.label}
      >
        {displayStatus === 'processing' && <span className="btn-spinner" />}
        <span className="btn-label">{config.label}</span>
        {config.hint && <span className="btn-hint">{config.hint}</span>}
      </button>

      <div className="volume-bar-track" style={{ opacity: showVolume ? 1 : 0 }}>
        <div
          className="volume-bar-fill"
          style={{
            width: `${volumeLevel}%`,
            backgroundColor: volumeColor(),
          }}
        />
      </div>

      <div className="sensitivity-control">
        <label className="sensitivity-label">
          Mic Sensitivity: {sensitivity.toFixed(1)}x
        </label>
        <input
          type="range"
          className="sensitivity-slider"
          min={1}
          max={10}
          step={0.5}
          value={sensitivity}
          onChange={handleSensitivity}
        />
      </div>
    </div>
  )
}
