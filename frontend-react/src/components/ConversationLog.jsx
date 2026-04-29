import { useEffect, useRef } from 'react'
import '../styles/ConversationLog.css'

function TypingIndicator({ isVisible }) {
  if (!isVisible) return null
  return (
    <div className="typing-indicator">
      <span /><span /><span />
    </div>
  )
}

export default function ConversationLog({ messages, isTyping }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  return (
    <div className="conversation-log">
      {messages.map((msg, i) => (
        <div key={i} className={`bubble ${msg.role}`}>
          {msg.text}
        </div>
      ))}
      <TypingIndicator isVisible={isTyping} />
      <div ref={bottomRef} />
    </div>
  )
}
