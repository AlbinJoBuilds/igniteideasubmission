import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient.js'
import StatusBadge from '../components/StatusBadge.jsx'

const RESULT_COPY = {
  approved: 'Claimed! Your idea is officially live on the board.',
  pending: "Submitted! An organizer will review it shortly — check the live board for status updates.",
  flagged: "Submitted, but it matched a similar existing idea. An organizer will review both before deciding.",
  rejected: 'Rejected — a matching or duplicate title was already claimed. Speak to an organizer if you need help.'
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
      setError('Please fill in both the title and the one-line summary.')
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
      setError(rpcError.message || 'Could not submit idea. Please try again.')
      return
    }
    setResult(data)
  }

  if (!team) return null

  if (result) {
    return (
      <div className="screen mobile-screen-padding">
        <div className="panel submission-panel mobile-panel">
          <div className="mobile-header-bar">
            <span className="team-pill">TEAM {team.teamNumber} · {team.teamName}</span>
          </div>

          <div className="result-hero-box">
            <div className={`result-icon-badge badge-${result.status}`}>
              {result.status === 'approved' && (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
              )}
              {result.status === 'pending' && (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
              )}
              {result.status === 'flagged' && (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
              )}
              {result.status === 'rejected' && (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="15" y1="9" x2="9" y2="15"></line>
                  <line x1="9" y1="9" x2="15" y2="15"></line>
                </svg>
              )}
            </div>

            <h1 className="headline" style={{ fontSize: 28, marginTop: 12 }}>Submission Result</h1>
            <StatusBadge status={result.status} />
            <p className="sub" style={{ marginTop: 16, marginBottom: 24, textAlign: 'center' }}>
              {RESULT_COPY[result.status] || 'Submission received.'}
            </p>

            <div className="mobile-actions-stack">
              <button className="btn-primary" onClick={() => navigate('/board')}>
                View Live Board →
              </button>
              <button className="btn-ghost" onClick={() => navigate('/sprint')}>
                ← Back to Sprint
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const titleLength = title.length
  const summaryLength = summary.length

  const getCharClass = (len, max) => {
    if (len >= max) return 'char-danger'
    if (len >= max - 20) return 'char-warn'
    return 'char-normal'
  }

  return (
    <div className="screen mobile-screen-padding">
      <div className="panel submission-panel mobile-panel">
        <div className="mobile-header-bar">
          <button className="back-link-btn" onClick={() => navigate('/sprint')}>
            ← Sprint
          </button>
          <span className="team-pill">TEAM {team.teamNumber} · {team.teamName}</span>
        </div>

        <h1 className="headline" style={{ marginTop: 8 }}>Submit Your Idea</h1>
        <p className="sub" style={{ marginBottom: 20 }}>
          One shot per team — make it count. Duplicate titles are auto-rejected; close matches get flagged for review.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="input-group">
            <div className="label-row">
              <label htmlFor="title">Idea title</label>
              <span className={`char-count-inline ${getCharClass(titleLength, 80)}`}>
                {titleLength}/80
              </span>
            </div>
            <input
              id="title"
              type="text"
              className="mobile-touch-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              placeholder="e.g. Smart Bike Rack Locator"
              disabled={submitting}
              autoComplete="off"
            />
          </div>

          <div className="input-group" style={{ marginTop: 16 }}>
            <div className="label-row">
              <label htmlFor="summary">One-line summary</label>
              <span className={`char-count-inline ${getCharClass(summaryLength, 160)}`}>
                {summaryLength}/160
              </span>
            </div>
            <textarea
              id="summary"
              className="mobile-touch-textarea"
              value={summary}
              onChange={(e) => setSummary(e.target.value.slice(0, 160))}
              maxLength={160}
              placeholder="What does it do, in one sentence?"
              disabled={submitting}
              rows={3}
            />
          </div>

          {error && (
            <div className="error-banner">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <span>{error}</span>
            </div>
          )}

          <button
            className="btn-primary btn-submit-mobile"
            type="submit"
            disabled={submitting || !title.trim() || !summary.trim()}
          >
            {submitting ? (
              <span className="btn-spinner-wrap">
                <span className="spinner-dot"></span> Submitting Idea…
              </span>
            ) : (
              'Claim This Idea 🔥'
            )}
          </button>
        </form>

        <div className="mobile-footer-links">
          <a href="/board" className="board-quick-link">View live board →</a>
        </div>
      </div>
    </div>
  )
}
