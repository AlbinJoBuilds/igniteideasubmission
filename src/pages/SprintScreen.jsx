import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient.js'
import StatusBadge from '../components/StatusBadge.jsx'

export default function SprintScreen() {
  const navigate = useNavigate()
  const [team, setTeam] = useState(null)
  const [eventState, setEventState] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = sessionStorage.getItem('ignitex_team')
    if (!stored) {
      navigate('/')
      return
    }
    setTeam(JSON.parse(stored))
  }, [navigate])

  useEffect(() => {
    let channel
    async function load() {
      const { data } = await supabase.from('event_state').select('*').eq('id', 1).single()
      setEventState(data)
      setLoading(false)
    }
    load()

    channel = supabase
      .channel('event_state_sprint')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'event_state', filter: 'id=eq.1' },
        (payload) => setEventState(payload.new)
      )
      .subscribe()

    return () => { if (channel) supabase.removeChannel(channel) }
  }, [])

  if (loading || !team) {
    return <div className="screen"><p className="sub">Loading sprint status…</p></div>
  }

  const status = eventState?.status || 'not_started'
  const canSubmit = status === 'running'

  return (
    <div className="screen">
      <div className="panel">
        <p className="eyebrow">Team {team.teamNumber} · {team.teamName}</p>
        <h1 className="headline">Topic Sprint</h1>
        <StatusBadge status={status} />

        <p className="sub" style={{ marginTop: 18 }}>
          {eventState?.brief_text || 'Claim a campus-innovation idea before another team beats you to it. One idea per team.'}
        </p>

        {status === 'not_started' && (
          <p className="sub">The sprint hasn't started yet. Sit tight — this screen updates automatically.</p>
        )}
        {status === 'closed' && (
          <p className="sub">Submissions are closed. Check the live board to see what got claimed.</p>
        )}

        <button
          className="btn-primary"
          disabled={!canSubmit}
          onClick={() => navigate('/submit')}
        >
          {canSubmit ? 'Submit your idea' : 'Waiting for sprint to open'}
        </button>

        <div className="link-row">
          <a href="/board">View live board →</a>
        </div>
      </div>
    </div>
  )
}
