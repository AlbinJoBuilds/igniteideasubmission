import { useState, useEffect } from 'react'
import StatusBadge from './StatusBadge.jsx'

const QUICK_PRESETS = {
  approved: [
    'Approved for live board',
    'Unique idea',
    'Verified with team'
  ],
  rejected: [
    'Duplicate idea already claimed',
    'Off-topic submission',
    'Incomplete idea details',
    'Requested by team'
  ]
}

export default function DecisionDialog({ submission, match, targetStatus, onClose, onConfirm, busy }) {
  const [reason, setReason] = useState('')
  const [feedbackState, setFeedbackState] = useState(null) // 'success' or null

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, busy])

  if (!submission || !targetStatus) return null

  const isApprove = targetStatus === 'approved'
  const isRevoke = submission.status === 'approved' && targetStatus === 'rejected'

  const titleText = isRevoke
    ? 'Revoke Submission'
    : isApprove
    ? 'Approve Submission'
    : 'Reject Submission'

  const actionText = isRevoke
    ? 'Revoke Approval'
    : isApprove
    ? 'Approve Idea'
    : 'Reject Idea'

  const dialogThemeClass = isRevoke
    ? 'dialog-revoke'
    : isApprove
    ? 'dialog-approve'
    : 'dialog-reject'

  async function handleExecute() {
    const success = await onConfirm(submission.id, targetStatus, reason)
    if (success !== false) {
      setFeedbackState(targetStatus)
      setTimeout(() => {
        onClose()
      }, 1200)
    }
  }

  function handlePresetClick(presetText) {
    setReason(presetText)
  }

  return (
    <div className="dialog-overlay" onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose() }}>
      <div className={`dialog-card ${dialogThemeClass}`}>
        <button className="dialog-close-btn" onClick={onClose} disabled={busy} aria-label="Close dialog">
          ✕
        </button>

        {feedbackState ? (
          <div className="dialog-feedback-content">
            <div className={`feedback-icon-wrap ${feedbackState === 'approved' ? 'icon-approved' : 'icon-rejected'}`}>
              {feedbackState === 'approved' ? (
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
              ) : (
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="15" y1="9" x2="9" y2="15"></line>
                  <line x1="9" y1="9" x2="15" y2="15"></line>
                </svg>
              )}
            </div>
            <h2 className="dialog-title" style={{ marginTop: 12 }}>
              {feedbackState === 'approved' ? 'Idea Approved!' : isRevoke ? 'Approval Revoked' : 'Idea Rejected'}
            </h2>
            <p className="dialog-subtitle">
              Submission status for <strong>"{submission.idea_title}"</strong> has been updated.
            </p>
          </div>
        ) : (
          <>
            <div className="dialog-header-wrap">
              <div className={`dialog-badge-icon ${dialogThemeClass}`}>
                {isApprove ? (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="15" y1="9" x2="9" y2="15"></line>
                    <line x1="9" y1="9" x2="15" y2="15"></line>
                  </svg>
                )}
              </div>
              <div>
                <span className="eyebrow" style={{ margin: 0 }}>CONFIRMation dialog</span>
                <h2 className="dialog-title">{titleText}</h2>
              </div>
            </div>

            <div className="dialog-body">
              <div className="dialog-submission-preview">
                <div className="preview-meta">
                  <span>TEAM {submission.team_number} · {submission.team_name}</span>
                  <StatusBadge status={submission.status} />
                </div>
                <h3 className="preview-title">{submission.idea_title}</h3>
                <p className="preview-summary">{submission.idea_summary}</p>

                {submission.status === 'flagged' && match && (
                  <div className="match-box" style={{ marginTop: 10 }}>
                    <div>
                      <div className="match-label">Matched against ({Math.round((submission.similarity_score || 0) * 100)}% similar)</div>
                      <strong>{match.idea_title}</strong>
                      <p style={{ margin: '2px 0 0', color: 'var(--ink-dim)' }}>Team {match.team_number} · {match.status}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="dialog-field-group">
                <label htmlFor="dialog-reason-input" className="dialog-label">
                  Reason for {isApprove ? 'approval' : 'rejection'} <span style={{ opacity: 0.6 }}>(optional, logged to audit)</span>
                </label>
                <input
                  id="dialog-reason-input"
                  className="dialog-input"
                  type="text"
                  placeholder={isApprove ? 'e.g. Meets topic sprint criteria' : 'e.g. Duplicate title already claimed'}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={busy}
                  autoFocus
                />

                {QUICK_PRESETS[targetStatus] && (
                  <div className="preset-chips">
                    <span className="preset-label">Quick presets:</span>
                    {QUICK_PRESETS[targetStatus].map((presetText) => (
                      <button
                        key={presetText}
                        type="button"
                        className={`chip-btn ${reason === presetText ? 'chip-active' : ''}`}
                        onClick={() => handlePresetClick(presetText)}
                        disabled={busy}
                      >
                        + {presetText}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="dialog-footer">
              <button className="btn-ghost btn-dialog-cancel" onClick={onClose} disabled={busy}>
                Cancel
              </button>
              <button
                className={`btn-dialog-confirm ${isApprove ? 'btn-approve' : 'btn-reject'}`}
                onClick={handleExecute}
                disabled={busy}
              >
                {busy ? (
                  <span className="btn-spinner-wrap">
                    <span className="spinner-dot"></span> Processing…
                  </span>
                ) : (
                  actionText
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
