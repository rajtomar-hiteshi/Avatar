import { useEffect, useRef } from 'react'

export default function ConversationLog({ messages }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (!messages.length) {
    return (
      <div style={{ textAlign: 'center', color: '#444', fontSize: '14px', padding: '32px 0' }}>
        Start talking to begin the conversation
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', maxHeight: '260px', padding: '4px 0' }}>
      {messages.map((msg, i) => (
        <div key={i} style={{
          display: 'flex',
          justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
        }}>
          <div style={{
            maxWidth: '75%',
            padding: '10px 14px',
            borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
            background: msg.role === 'user' ? '#1d4ed8' : '#1a1a1a',
            color: '#e5e5e5',
            fontSize: '14px',
            lineHeight: 1.5,
            border: msg.role === 'agent' ? '1px solid #2a2a2a' : 'none',
          }}>
            {msg.text}
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
