import { useEffect, useRef, useState, useCallback } from 'react'

export default function AvatarWebRTC({ runpodUrl, active, onStatusChange }) {
  const videoRef = useRef(null)
  const audioRef = useRef(null)
  const pcRef = useRef(null)
  const [status, setStatus] = useState('disconnected')

  const updateStatus = useCallback((s) => {
    setStatus(s)
    onStatusChange?.(s)
  }, [onStatusChange])

  const disconnect = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close()
      pcRef.current = null
    }
    if (videoRef.current) videoRef.current.srcObject = null
    if (audioRef.current) audioRef.current.srcObject = null
    updateStatus('disconnected')
  }, [updateStatus])

  const connect = useCallback(async () => {
    if (!runpodUrl) return
    disconnect()

    updateStatus('connecting')

    try {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      })
      pcRef.current = pc

      // Use sendrecv — aiortc crashes on recvonly direction negotiation
      pc.addTransceiver('video', { direction: 'sendrecv' })
      pc.addTransceiver('audio', { direction: 'sendrecv' })

      const streams = {}

      pc.ontrack = (event) => {
        const [stream] = event.streams
        if (!stream) return
        if (event.track.kind === 'video' && videoRef.current) {
          videoRef.current.srcObject = stream
        }
        if (event.track.kind === 'audio' && audioRef.current) {
          audioRef.current.srcObject = stream
        }
      }

      pc.oniceconnectionstatechange = () => {
        const s = pc.iceConnectionState
        if (s === 'connected' || s === 'completed') {
          updateStatus('connected')
        } else if (s === 'failed' || s === 'closed') {
          updateStatus('disconnected')
        }
      }

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      const res = await fetch(`/proxy/offer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sdp: offer.sdp, type: offer.type }),
      })

      if (!res.ok) throw new Error(`RunPod offer rejected: ${res.status}`)

      const answer = await res.json()
      await pc.setRemoteDescription(new RTCSessionDescription(answer))
    } catch (err) {
      console.error('[AvatarWebRTC] connect error:', err)
      updateStatus('error')
    }
  }, [runpodUrl, disconnect, updateStatus])

  useEffect(() => {
    if (active && runpodUrl) {
      connect()
    } else {
      disconnect()
    }
    return disconnect
  }, [active, runpodUrl])

  const label = {
    disconnected: 'Avatar offline',
    connecting: 'Connecting to avatar…',
    connected: null,
    error: 'Connection failed',
  }[status]

  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', background: '#111', borderRadius: '12px', overflow: 'hidden' }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
      {/* Separate audio element — required for sound output */}
      <audio ref={audioRef} autoPlay />

      {label && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.75)',
          color: status === 'error' ? '#ef4444' : '#888',
          fontSize: '15px',
          letterSpacing: '0.01em',
        }}>
          {status === 'connecting' && (
            <span style={{ marginRight: '8px', animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
          )}
          {label}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
