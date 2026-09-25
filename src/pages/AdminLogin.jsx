import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, setAdminToken } from '../supabaseClient.js'

export default function AdminLogin() {
  const navigate = useNavigate()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data, error: fnError } = await supabase.rpc('admin_login', {
      p_pin: pin
    })

    setLoading(false)

    if (fnError || !data?.token) {
      setError(fnError?.message || 'Incorrect PIN.')
      return
    }
    setAdminToken(data.token)
    navigate('/admin/panel')
  }

  return (
    <div className="screen">
      <div className="panel">
        <p className="eyebrow">IgniteX · Organizer</p>
        <h1 className="headline">Admin login</h1>
        <p className="sub">Enter the shared organizer PIN.</p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="pin">PIN</label>
          <input
            id="pin"
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            autoFocus
          />
          {error && <p className="error-text">{error}</p>}
          <button className="btn-primary" type="submit" disabled={loading || !pin}>
            {loading ? 'Checking…' : 'Enter'}
          </button>
        </form>
      </div>
    </div>
  )
}
