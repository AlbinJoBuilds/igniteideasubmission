import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function TeamEntry() {
  const navigate = useNavigate()
  const [teamNumber, setTeamNumber] = useState('')
  const [teamName, setTeamName] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    const num = Number(teamNumber)
    if (!teamNumber || !Number.isInteger(num) || num <= 0) {
      setError('Enter your team number as a whole number.')
      return
    }
    if (!teamName.trim()) {
      setError('Enter your team name.')
      return
    }
    sessionStorage.setItem('ignitex_team', JSON.stringify({ teamNumber: num, teamName: teamName.trim() }))
    navigate('/sprint')
  }

  return (
    <div className="screen">
      <div className="panel">
        <p className="eyebrow">IgniteX · Topic Sprint</p>
        <h1 className="headline">Claim your team</h1>
        <p className="sub">Enter the team number and name you were assigned at check-in.</p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="teamNumber">Team number</label>
          <input
            id="teamNumber"
            type="number"
            inputMode="numeric"
            value={teamNumber}
            onChange={(e) => setTeamNumber(e.target.value)}
            placeholder="e.g. 7"
          />

          <label htmlFor="teamName">Team name</label>
          <input
            id="teamName"
            type="text"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="e.g. Night Owls"
            maxLength={60}
          />

          {error && <p className="error-text">{error}</p>}

          <button className="btn-primary" type="submit">Enter sprint</button>
        </form>

        <div className="link-row">
          <a href="/board">View live board →</a>
          <a href="/admin" style={{ color: 'var(--flame-dim)' }}>Organizer login →</a>
        </div>
      </div>
    </div>
  )
}
