import { useState, useRef, useCallback } from 'react'
import { Room, RoomEvent, Track, createLocalAudioTrack } from 'livekit-client'

const ROOM_NAME = 'avatar-room'

export function useLiveKit() {
  const [lkStatus, setLkStatus] = useState('disconnected') // disconnected | connecting | connected | error
  const [lkError, setLkError] = useState('')
  const roomRef = useRef(null)

  const connectLiveKit = useCallback(async (identity = 'user-' + Date.now()) => {
    try {
      setLkStatus('connecting')
      setLkError('')

      // 1. Fetch token + server URL from our backend
      const res = await fetch(`/livekit-token?room=${ROOM_NAME}&identity=${encodeURIComponent(identity)}`)
      if (!res.ok) {
        const body = await res.text()
        throw new Error(`Token fetch failed (${res.status}): ${body}`)
      }
      const { token, url } = await res.json()

      // 2. Create and connect room
      const room = new Room()
      roomRef.current = room

      room.on(RoomEvent.Disconnected, () => {
        setLkStatus('disconnected')
      })
      room.on(RoomEvent.Reconnecting, () => {
        setLkStatus('connecting')
      })
      room.on(RoomEvent.Reconnected, () => {
        setLkStatus('connected')
      })

      await room.connect(url, token)

      // 3. Capture mic and publish audio track to the room
      const audioTrack = await createLocalAudioTrack({ echoCancellation: true, noiseSuppression: true })
      await room.localParticipant.publishTrack(audioTrack, {
        source: Track.Source.Microphone,
      })

      setLkStatus('connected')
    } catch (err) {
      console.error('useLiveKit: connect error', err)
      setLkError(err.message)
      setLkStatus('error')
    }
  }, [])

  const disconnectLiveKit = useCallback(async () => {
    if (roomRef.current) {
      await roomRef.current.disconnect()
      roomRef.current = null
    }
    setLkStatus('disconnected')
    setLkError('')
  }, [])

  return { lkStatus, lkError, connectLiveKit, disconnectLiveKit }
}
