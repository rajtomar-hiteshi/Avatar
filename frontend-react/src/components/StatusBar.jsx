import '../styles/StatusBar.css'

const STATUS_MAP = {
  idle:       { label: 'Ready',                        colorClass: 'green'  },
  listening:  { label: 'Listening for your voice...',  colorClass: 'blue'   },
  recording:  { label: 'Hearing you...',               colorClass: 'red'    },
  processing: { label: 'Processing...',                colorClass: 'yellow' },
  speaking:   { label: 'Agent speaking...',            colorClass: 'purple' },
  error:      { label: null,                           colorClass: 'red'    },
}

export default function StatusBar({ status, errorMessage }) {
  const { label, colorClass } = STATUS_MAP[status] || STATUS_MAP.idle

  return (
    <div className="status-bar">
      <span className={`status-dot ${colorClass}`} />
      <span className="status-label">
        {status === 'error' ? errorMessage : label}
      </span>
    </div>
  )
}
