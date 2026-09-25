import { useEffect, useRef } from 'react'

// PLACEHOLDER: the spec says PixelBlast is "provided" by you already.
// Drop your real component in at this path (same file name + default export)
// and this placeholder will be replaced automatically — nothing else in the
// app references PixelBlast's internals, only <PixelBlast /> as a fixed bg.
//
// This placeholder renders a slow-drifting grid of embers on canvas so the
// app looks and feels right without your component wired in yet.
export default function PixelBlast() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let raf
    let w, h
    const particles = []
    const COUNT = 60

    function resize() {
      w = canvas.width = window.innerWidth
      h = canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    for (let i = 0; i < COUNT; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        s: Math.random() * 2 + 1,
        vy: -(Math.random() * 0.25 + 0.05),
        vx: (Math.random() - 0.5) * 0.15,
        a: Math.random() * 0.5 + 0.1
      })
    }

    function tick() {
      ctx.clearRect(0, 0, w, h)
      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy
        if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w }
        if (p.x < -10) p.x = w + 10
        if (p.x > w + 10) p.x = -10
        ctx.fillStyle = `rgba(255, 90, 31, ${p.a})`
        ctx.fillRect(p.x, p.y, p.s, p.s)
      }
      raf = requestAnimationFrame(tick)
    }
    tick()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={canvasRef} className="pixel-blast-bg" aria-hidden="true" />
}
