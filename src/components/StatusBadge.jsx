const LABELS = {
  not_started: 'Not started',
  running: 'Running',
  closed: 'Closed',
  pending: 'Pending review',
  flagged: 'Flagged — similar idea found',
  approved: 'Approved',
  rejected: 'Rejected'
}

export default function StatusBadge({ status }) {
  return (
    <span className={`badge badge-${status}`}>
      <span className="badge-dot" />
      {LABELS[status] || status}
    </span>
  )
}
