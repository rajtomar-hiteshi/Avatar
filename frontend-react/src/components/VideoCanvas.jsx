import { useRef, useEffect, useState } from 'react'

export default function VideoCanvas({ videoChunks, isPlaying }) {
  const videoRef = useRef(null)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [lastSrc, setLastSrc] = useState(null)

  // Play video chunks sequentially
  useEffect(() => {
    if (!videoChunks || videoChunks.length === 0) return
    if (currentIdx >= videoChunks.length) return

    const b64 = videoChunks[currentIdx]
    const src = `data:video/mp4;base64,${b64}`
    setLastSrc(src)

    const video = videoRef.current
    if (!video) return

    video.src = src
    video.play().catch((err) => {
      console.warn('VideoCanvas: play() failed:', err)
      // Move to next chunk even if play fails
      setCurrentIdx((i) => i + 1)
    })
  }, [videoChunks, currentIdx])

  // When a video chunk ends, move to next
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const onEnded = () => {
      setCurrentIdx((i) => i + 1)
    }

    video.addEventListener('ended', onEnded)
    return () => video.removeEventListener('ended', onEnded)
  }, [])

  // Reset when new conversation starts
  useEffect(() => {
    if (videoChunks && videoChunks.length === 0) {
      setCurrentIdx(0)
      setLastSrc(null)
    }
  }, [videoChunks])

  return (
    <video
      ref={videoRef}
      playsInline
      muted
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        borderRadius: '50%',
        opacity: lastSrc ? 1 : 0,
        transition: 'opacity 0.2s ease',
      }}
    />
  )
}
