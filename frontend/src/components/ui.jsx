export function Spinner() {
  return <span className="spinner" aria-label="loading" />
}

export function Loading({ label = 'Loading…' }) {
  return (
    <div className="center-state">
      <Spinner />
      <div style={{ marginTop: 10 }}>{label}</div>
    </div>
  )
}

export function Money({ value }) {
  const n = Number(value || 0)
  return <>${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>
}

const STATUS_CLASS = {
  PENDING_APPROVAL: 'pending',
  COMPLETED: 'completed',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
  APPROVED: 'approved',
}

export function StatusBadge({ status }) {
  const cls = STATUS_CLASS[status] || 'cancelled'
  return <span className={`badge ${cls}`}>{status.replace('_', ' ')}</span>
}

export function Modal({ title, children, onClose, footer }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function Alert({ kind = 'info', children }) {
  if (!children) return null
  return <div className={`alert alert-${kind}`}>{children}</div>
}
