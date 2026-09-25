import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient.js'
import StatusBadge from '../components/StatusBadge.jsx'

const RESULT_COPY = {
  approved: 'Claimed. Your idea is live on the board.',
  pending: "Submitted. An organizer will review it shortly — this screen doesn't auto-refresh, check the board for updates.",
  flagged: "Submitted, but it's close to an existing idea. An organizer will review it against the match before deciding.",
  rejected: 'Rejected — that title is already claimed. Talk to an organizer if you think this is wrong.'
}

export default function SubmissionScreen() {
  const navigate = useNavigate()
  const [team, setTeam] = useState(null)
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  useEffect(() => {
    const stored = sessionStorage.getItem('ignitex_team')
    if (!stored) { navigate('/'); return }
    setTeam(JSON.parse(stored))
  }, [navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!title.trim() || !summary.trim()) {
      setError('Fill in both the title and the one-line summary.')
      return
    }
    setSubmitting(true)
    const { data, error: rpcError } = await supabase.rpc('submit_idea', {
      p_team_number: team.teamNumber,
      p_team_name: team.teamName,
      p_idea_title: title.trim(),
      p_idea_summary: summary.trim()
    })
    setSubmitting(false)

    if (rpcError) {
      setError(rpcError.message || 'Could not submit. Try again.')
      return
    }
    // Expect the function to return { status, id }
    setResult(data)
  }

  if (!team) return null

  if (result) {
    return (
      <div className="screen">
        <div className="panel">
          <p className="eyebrow">Team {team.teamNumber} · {team.teamName}</p>
          <h1 className="headline">Result</h1>
          <StatusBadge status={result.status} />
          <p className="sub" style={{ marginTop: 18 }}>{RESULT_COPY[result.status] || 'Submitted.'}</p>
          <button className="btn-ghost" onClick={() => navigate('/board')}>View live board</button>
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      <div className="panel">
        <p className="eyebrow">Team {team.teamNumber} · {team.teamName}</p>
        <h1 className="headline">Submit your idea</h1>
        <p className="sub">One shot per team — make it count. Duplicate titles are auto-rejected; close matches get flagged for review.</p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="title">Idea title</label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            placeholder="e.g. Smart Bike Rack Locator"
          />

          <label htmlFor="summary">One-line summary</label>
          <textarea
            id="summary"
            value={summary}
            onChange={(e) => setSummary(e.target.value.slice(0, 160))}
            maxLength={160}
            placeholder="What does it do, in one sentence?"
          />
          <div className="char-count">{summary.length}/160</div>

          {error && <p className="error-text">{error}</p>}

          <button className="btn-primary" type="submit" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Claim this idea'}
          </button>
        </form>
      </div>
    </div>
  )
}
