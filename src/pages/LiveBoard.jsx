import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient.js'
import StatusBadge from '../components/StatusBadge.jsx'

export default function LiveBoard() {
  const [ideas, setIdeas] = useState([])
  const [eventState, setEventState] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let ideasChannel, stateChannel

    async function load() {
      const [{ data: rows }, { data: state }] = await Promise.all([
        supabase
          .from('submissions')
          .select('id, team_number, team_name, idea_title, idea_summary, updated_at')
          .eq('status', 'approved')
          .order('updated_at', { ascending: false }),
        supabase.from('event_state').select('*').eq('id', 1).single()
      ])
      setIdeas(rows || [])
      setEventState(state)
      setLoading(false)
    }
    load()

    const interval = setInterval(() => {
      load()
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="screen screen-wide">
      <div className="board-header">
        <div>
          <p className="eyebrow">IgniteX · Live board</p>
          <h1 className="headline" style={{ fontSize: 28 }}>Claimed ideas</h1>
        </div>
        <StatusBadge status={eventState?.status || 'not_started'} />
      </div>

      {loading ? (
        <p className="sub">Loading…</p>
      ) : ideas.length === 0 ? (
        <div className="board-empty">No ideas claimed yet. First approved submission shows up here instantly.</div>
      ) : (
        <div className="board-grid">
          {ideas.map((idea) => (
            <div className="board-card" key={idea.id}>
              <span className="team-tag">TEAM {idea.team_number} · {idea.team_name}</span>
              <h3>{idea.idea_title}</h3>
              <p>{idea.idea_summary}</p>
            </div>
          ))}
        </div>
      )}

      <p className="footer-note">{ideas.length} idea{ideas.length === 1 ? '' : 's'} claimed · updates live</p>
    </div>
  )
}
