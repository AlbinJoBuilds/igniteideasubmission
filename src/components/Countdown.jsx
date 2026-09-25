import { useEffect, useState } from 'react'

// Purely cosmetic — never gates submission. The server checks
// event_state.status = 'running' on every submit_idea() call; closing is
// an explicit organizer action, not something this timer can trigger.
export default function Countdown({ startedAt, durationSeconds }) {
  const [remaining, setRemaining] = useState(null)

  useEffect(() => {
    if (!startedAt || !durationSeconds) {
      setRemaining(null)
      return
    }
    const endsAt = new Date(startedAt).getTime() + durationSeconds * 1000

    function update() {
      const diff = Math.max(0, Math.round((endsAt - Date.now()) / 1000))
      setRemaining(diff)
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [startedAt, durationSeconds])

  if (remaining === null) return null

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0')
  const ss = String(remaining % 60).padStart(2, '0')
  const isLow = remaining <= 60

  return (
    <div className={`countdown ${isLow ? 'countdown-low' : ''}`}>
      <span className="countdown-time">{mm}:{ss}</span>
      <span className="countdown-label">Sprint clock · display only</span>
    </div>
  )
}
