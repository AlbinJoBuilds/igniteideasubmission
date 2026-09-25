import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, getAdminToken, clearAdminToken } from '../supabaseClient.js'
import StatusBadge from '../components/StatusBadge.jsx'
import DecisionDialog from '../components/DecisionDialog.jsx'

const secondsToMinutes = (value) => {
  const seconds = Number(value)
  if (!Number.isFinite(seconds) || seconds <= 0) return 15
  return Math.max(1, Math.round(seconds / 60))
}

const minutesToSeconds = (value) => Number(value) * 60

export default function AdminPanel() {
  const navigate = useNavigate()
  const token = getAdminToken()

  const [eventState, setEventState] = useState(null)
  const [briefDraft, setBriefDraft] = useState('')
  const [durationDraft, setDurationDraft] = useState(15)
  const [queue, setQueue] = useState([])
  const [auditLog, setAuditLog] = useState([])
  const [matches, setMatches] = useState({}) // submission_id -> matched submission row
  const [tab, setTab] = useState('queue')
  const [reasons, setReasons] = useState({}) // submission_id -> reason text
  const [busyId, setBusyId] = useState(null)
  const [notice, setNotice] = useState('')
  const [activeDialog, setActiveDialog] = useState(null) // { submission, match, targetStatus }

  const loadEventState = useCallback(async () => {
    const { data } = await supabase.from('event_state').select('*').eq('id', 1).single()
    setEventState(data)
    if (data) {
      setBriefDraft(data.brief_text || '')
      setDurationDraft(secondsToMinutes(data.display_duration_seconds))
    }
  }, [])

  const loadQueue = useCallback(async () => {
    const { data, error } = await supabase.rpc('organizer_list_submissions', {
      p_admin_token: token,
      p_statuses: ['pending', 'flagged']
    })
    if (error) { if (/token|expired/i.test(error.message || '')) { clearAdminToken(); navigate('/admin') } return }
    setQueue(data || [])

    const matchIds = (data || []).filter((r) => r.similar_to_id).map((r) => r.similar_to_id)
    if (matchIds.length) {
      const { data: matchRows } = await supabase.rpc('organizer_get_submissions_by_id', {
        p_admin_token: token,
        p_ids: matchIds
      })
      const map = {}
      for (const row of data || []) {
        if (row.similar_to_id) {
          map[row.id] = (matchRows || []).find((m) => m.id === row.similar_to_id)
        }
      }
      setMatches(map)
    }
  }, [token, navigate])

  const loadAuditLog = useCallback(async () => {
    const { data, error } = await supabase.rpc('organizer_list_audit_log', {
      p_admin_token: token,
      p_limit: 100
    })
    if (error) { if (/token|expired/i.test(error.message || '')) { clearAdminToken(); navigate('/admin') } return }
    setAuditLog(data || [])
  }, [token, navigate])

  useEffect(() => {
    loadEventState()
    loadQueue()
    loadAuditLog()

    const interval = setInterval(() => {
      loadEventState()
      loadQueue()
      loadAuditLog()
    }, 3000)

    return () => clearInterval(interval)
  }, [loadEventState, loadQueue, loadAuditLog])

  async function callAdminRpc(name, params) {
    const { data, error } = await supabase.rpc(name, { ...params, p_admin_token: token })
    if (error) {
      if (/token|auth|expired/i.test(error.message || '')) {
        clearAdminToken()
        navigate('/admin')
        return null
      }
      setNotice(error.message)
      return null
    }
    return data
  }

  async function handleStart() {
    setNotice('')
    await callAdminRpc('organizer_set_event_state', {
      p_new_status: 'running',
      p_brief_text: briefDraft,
      p_display_duration_seconds: minutesToSeconds(durationDraft)
    })
  }

  async function handleClose() {
    setNotice('')
    await callAdminRpc('organizer_set_event_state', {
      p_new_status: 'closed',
      p_brief_text: briefDraft,
      p_display_duration_seconds: minutesToSeconds(durationDraft)
    })
  }

  async function handleSaveBrief() {
    setNotice('')
    await callAdminRpc('organizer_set_event_state', {
      p_new_status: eventState?.status || 'not_started',
      p_brief_text: briefDraft,
      p_display_duration_seconds: minutesToSeconds(durationDraft)
    })
    setNotice('Brief saved.')
  }

  async function handleDecision(submissionId, newStatus, customReason) {
    setBusyId(submissionId)
    const reasonToUse = customReason !== undefined ? customReason : (reasons[submissionId] || null)
    const res = await callAdminRpc('organizer_set_status', {
      p_submission_id: submissionId,
      p_new_status: newStatus,
      p_reason: reasonToUse
    })
    setBusyId(null)
    if (res !== null) {
      loadQueue()
      loadAuditLog()
      return true
    }
    return false
  }

  function openDialog(submission, targetStatus) {
    setActiveDialog({
      submission,
      match: matches[submission.id],
      targetStatus
    })
  }

  function handleLogout() {
    clearAdminToken()
    navigate('/admin')
  }

  const status = eventState?.status || 'not_started'

  return (
    <div className="screen screen-wide">
      <div className="admin-header">
        <div>
          <p className="eyebrow">IgniteX · Organizer</p>
          <h1 className="headline" style={{ fontSize: 26 }}>Admin panel</h1>
        </div>
        <div className="admin-controls">
          <StatusBadge status={status} />
          {status !== 'running' ? (
            <button className="btn-primary" style={{ width: 'auto', margin: 0 }} onClick={handleStart}>Start sprint</button>
          ) : (
            <button className="btn-danger btn-small" onClick={handleClose}>Close sprint</button>
          )}
          <button className="btn-ghost btn-small" onClick={handleLogout}>Log out</button>
        </div>
      </div>

      <div className="panel panel-wide" style={{ marginBottom: 24 }}>
        <label htmlFor="brief">Brief text (shown on the sprint screen)</label>
        <textarea id="brief" value={briefDraft} onChange={(e) => setBriefDraft(e.target.value)} />
        <label htmlFor="duration">Cosmetic countdown length (minutes)</label>
        <input
          id="duration"
          type="number"
          min="1"
          value={durationDraft}
          onChange={(e) => setDurationDraft(e.target.value)}
          style={{ maxWidth: 120 }}
        />
        <div className="row-actions">
          <button className="btn-ghost btn-small" onClick={handleSaveBrief}>Save brief &amp; timer</button>
        </div>
        {notice && <p className="error-text" style={{ color: 'var(--ok)' }}>{notice}</p>}
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'queue' ? 'active' : ''}`} onClick={() => setTab('queue')}>
          Review queue ({queue.length})
        </button>
        <button className={`tab ${tab === 'audit' ? 'active' : ''}`} onClick={() => setTab('audit')}>
          Audit log
        </button>
      </div>

      {tab === 'queue' && (
        <div style={{ width: '100%', maxWidth: 920 }}>
          {queue.length === 0 && <p className="sub">Nothing pending. New submissions land here in real time.</p>}
          {queue.map((row) => (
            <div className="queue-row" key={row.id}>
              <div className="queue-row-header">
                <div>
                  <h4>{row.idea_title}</h4>
                  <p className="queue-meta">TEAM {row.team_number} · {row.team_name} · {new Date(row.submitted_at).toLocaleTimeString()}</p>
                </div>
                <StatusBadge status={row.status} />
              </div>
              <p className="sub" style={{ margin: '8px 0 0' }}>{row.idea_summary}</p>

              {row.status === 'flagged' && matches[row.id] && (
                <div className="match-box">
                  <div>
                    <div className="match-label">This submission</div>
                    <strong>{row.idea_title}</strong>
                    <p style={{ margin: '4px 0 0', color: 'var(--ink-dim)' }}>{row.idea_summary}</p>
                  </div>
                  <div>
                    <div className="match-label">Matched against · {Math.round((row.similarity_score || 0) * 100)}% similar</div>
                    <strong>{matches[row.id].idea_title}</strong>
                    <p style={{ margin: '4px 0 0', color: 'var(--ink-dim)' }}>
                      Team {matches[row.id].team_number} · {matches[row.id].status}
                    </p>
                  </div>
                </div>
              )}

              <input
                className="reason-input"
                type="text"
                placeholder="Optional reason (saved to audit log)"
                value={reasons[row.id] || ''}
                onChange={(e) => setReasons((r) => ({ ...r, [row.id]: e.target.value }))}
              />

              <div className="row-actions">
                <button
                  className="btn-approve btn-small"
                  disabled={busyId === row.id}
                  onClick={() => openDialog(row, 'approved')}
                >
                  Approve
                </button>
                <button
                  className="btn-reject btn-small"
                  disabled={busyId === row.id}
                  onClick={() => openDialog(row, 'rejected')}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}

          <ApprovedList onOpenDialog={openDialog} busyId={busyId} reasons={reasons} setReasons={setReasons} />
        </div>
      )}

      {tab === 'audit' && (
        <div style={{ width: '100%', maxWidth: 920 }}>
          <div className="audit-row" style={{ color: 'var(--ink)', fontWeight: 600 }}>
            <span>Time</span><span>Submission → Action</span><span>Actor</span><span>Reason</span>
          </div>
          {auditLog.map((row) => (
            <div className="audit-row" key={row.id}>
              <span>{new Date(row.created_at).toLocaleTimeString()}</span>
              <span>#{row.submission_id} · <span className={`action-${row.action}`}>{row.action}</span></span>
              <span>{row.actor}</span>
              <span>{row.reason || '—'}</span>
            </div>
          ))}
        </div>
      )}

      {activeDialog && (
        <DecisionDialog
          submission={activeDialog.submission}
          match={activeDialog.match}
          targetStatus={activeDialog.targetStatus}
          busy={busyId === activeDialog.submission.id}
          onClose={() => setActiveDialog(null)}
          onConfirm={async (id, status, reason) => {
            return await handleDecision(id, status, reason)
          }}
        />
      )}
    </div>
  )
}

function ApprovedList({ onOpenDialog, busyId, reasons, setReasons }) {
  const [approved, setApproved] = useState([])
  const token = getAdminToken()

  const load = useCallback(async () => {
    const { data } = await supabase.rpc('organizer_list_submissions', {
      p_admin_token: token,
      p_statuses: ['approved']
    })
    setApproved((data || []).slice().sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)))
  }, [token])

  useEffect(() => {
    load()
    const interval = setInterval(load, 3000)
    return () => clearInterval(interval)
  }, [load])

  if (approved.length === 0) return null

  return (
    <>
      <h4 style={{ marginTop: 28, color: 'var(--ink-dim)', fontSize: 13, fontFamily: 'var(--mono)', textTransform: 'uppercase' }}>
        Approved — revoke if needed
      </h4>
      {approved.map((row) => (
        <div className="queue-row" key={row.id}>
          <div className="queue-row-header">
            <div>
              <h4>{row.idea_title}</h4>
              <p className="queue-meta">TEAM {row.team_number} · {row.team_name}</p>
            </div>
            <StatusBadge status={row.status} />
          </div>
          <input
            className="reason-input"
            type="text"
            placeholder="Optional revoke reason"
            value={reasons[row.id] || ''}
            onChange={(e) => setReasons((r) => ({ ...r, [row.id]: e.target.value }))}
          />
          <div className="row-actions">
            <button className="btn-revoke btn-small" disabled={busyId === row.id} onClick={() => onOpenDialog(row, 'rejected')}>
              Revoke
            </button>
          </div>
        </div>
      ))}
    </>
  )
}
