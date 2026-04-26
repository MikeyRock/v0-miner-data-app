'use client'

import { useEffect, useRef, useCallback } from 'react'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  rotation: number
  rotationSpeed: number
  shape: 'rect' | 'circle'
  opacity: number
}

interface BlockFoundCelebrationProps {
  coin: 'BCH' | 'BTC' | 'XEC' | null
  onClear: () => void
}

const BCH_COLORS = ['#0ac18e', '#ffffff', '#00ff99', '#00cc77', '#a8ffdf']
const BTC_COLORS = ['#f7931a', '#ffffff', '#ffb347', '#ff8c00', '#ffe0a0']
const XEC_COLORS = ['#00e5ff', '#ffffff', '#00bcd4', '#1e3a5f', '#7c3aed']

function createParticle(canvas: HTMLCanvasElement, colors: string[]): Particle {
  return {
    x:             Math.random() * canvas.width,
    y:             -10,
    vx:            (Math.random() - 0.5) * 4,
    vy:            Math.random() * 4 + 2,
    size:          Math.random() * 10 + 5,
    color:         colors[Math.floor(Math.random() * colors.length)],
    rotation:      Math.random() * Math.PI * 2,
    rotationSpeed: (Math.random() - 0.5) * 0.2,
    shape:         Math.random() > 0.5 ? 'rect' : 'circle',
    opacity:       1,
  }
}

export function BlockFoundCelebration({ coin, onClear }: BlockFoundCelebrationProps) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const rafRef     = useRef<number>(0)
  const particles  = useRef<Particle[]>([])
  const spawnRef   = useRef<number>(0)
  const activeRef  = useRef(false)

  const colors = coin === 'BCH' ? BCH_COLORS : coin === 'XEC' ? XEC_COLORS : BTC_COLORS
  const accentColor = coin === 'BCH' ? '#0ac18e' : coin === 'XEC' ? '#00e5ff' : '#f7931a'
  const label = coin ? `${coin} BLOCK FOUND!` : ''

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    activeRef.current = false
  }, [])

  const handleClear = useCallback(() => {
    stop()
    onClear()
  }, [stop, onClear])

  useEffect(() => {
    if (!coin) { stop(); return }

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    activeRef.current = true
    particles.current = []

    function resize() {
      if (!canvas) return
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    function loop() {
      if (!canvas || !ctx || !activeRef.current) return

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Spawn burst of particles
      spawnRef.current++
      if (spawnRef.current % 2 === 0 && particles.current.length < 400) {
        for (let i = 0; i < 8; i++) {
          particles.current.push(createParticle(canvas, colors))
        }
      }

      // Draw + update
      for (let i = particles.current.length - 1; i >= 0; i--) {
        const p = particles.current[i]
        p.x  += p.vx
        p.y  += p.vy
        p.vy += 0.08 // gravity
        p.rotation += p.rotationSpeed
        if (p.y > canvas.height * 0.85) {
          p.opacity -= 0.03
        }

        ctx.save()
        ctx.globalAlpha = Math.max(0, p.opacity)
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)
        ctx.fillStyle = p.color
        if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
        } else {
          ctx.beginPath()
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.restore()

        if (p.opacity <= 0 || p.y > canvas.height + 20) {
          particles.current.splice(i, 1)
        }
      }

      rafRef.current = requestAnimationFrame(loop)
    }

    loop()

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(rafRef.current)
      activeRef.current = false
    }
  }, [coin, colors, stop])

  if (!coin) return null

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* Confetti canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />

      {/* Flashing overlay text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div
          className="animate-pulse text-center select-none"
          style={{ animationDuration: '0.6s' }}
        >
          <div
            className="font-mono font-black tracking-widest uppercase drop-shadow-2xl"
            style={{
              fontSize: 'clamp(2.5rem, 8vw, 7rem)',
              color: accentColor,
              textShadow: `0 0 40px ${accentColor}, 0 0 80px ${accentColor}88, 0 4px 32px #000`,
              WebkitTextStroke: `2px ${accentColor}`,
            }}
          >
            {label}
          </div>
        </div>
      </div>

      {/* Clear button — pointer-events enabled */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 pointer-events-auto">
        <button
          onClick={handleClear}
          className="rounded-full border-2 px-8 py-3 font-mono text-sm font-bold uppercase tracking-widest transition-all hover:scale-105 active:scale-95"
          style={{
            borderColor: accentColor,
            color: accentColor,
            background: 'rgba(0,0,0,0.7)',
            boxShadow: `0 0 20px ${accentColor}55`,
          }}
        >
          Clear Win Notification
        </button>
      </div>
    </div>
  )
}
