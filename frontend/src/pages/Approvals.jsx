import { useEffect, useState } from 'react'
import { orderApi } from '../api/resources'
import { errorMessage } from '../api/client'
import { Alert, Loading, Modal, Money, StatusBadge } from '../components/ui'

export default function Approvals() {
  const [orders, setOrders] = useState(null)
  const [error, setError] = useState('')
  const [flash, setFlash] = useState('')
  const [modal, setModal] = useState(null) // {order, action: 'approve'|'reject'}
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    try { setOrders(await orderApi.pending()) }
    catch (e) { setError(errorMessage(e)) }
  }
  useEffect(() => { load() }, [])

  function open(order, action) { setNotes(''); setError(''); setModal({ order, action }) }

  async function confirm() {
    setBusy(true); setError('')
    const { order, action } = modal
    try {
      if (action === 'approve') await orderApi.approve(order.id, notes || null)
      else await orderApi.reject(order.id, notes || null)
      setFlash(`Order ${order.order_number} ${action === 'approve' ? 'approved' : 'rejected'}. `
        + 'The sales rep has been notified by email.')
      setModal(null); await load()
    } catch (err) { setError(errorMessage(err)) } finally { setBusy(false) }
  }

  if (!orders) return <Loading />

  return (
    <>
      {!modal && <Alert kind="error">{error}</Alert>}
      {flash && <Alert kind="success">{flash}</Alert>}

      {orders.length === 0 ? (
        <div className="card center-state">No orders are waiting for approval. 🎉</div>
      ) : (
        <div className="grid grid-2">
          {orders.map((o) => (
            <div key={o.id} className="card">
              <div className="card-head">
                <h3>{o.order_number}</h3>
                <strong style={{ fontSize: 18 }}><Money value={o.total_amount} /></strong>
              </div>
              <div className="card-pad">
                <p className="muted" style={{ marginTop: 0 }}>
                  Customer: <strong>{o.customer.name}</strong><br />
                  Raised by {o.created_by.name} · {new Date(o.created_at).toLocaleString()}
                </p>
                <table style={{ marginBottom: 14 }}>
                  <thead><tr><th>Product</th><th className="right">Qty</th><th className="right">Line</th></tr></thead>
                  <tbody>
                    {o.items.map((it) => (
                      <tr key={it.id}>
                        <td>{it.product.name}</td>
                        <td className="right">{it.quantity}</td>
                        <td className="right"><Money value={it.line_total} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex" style={{ gap: 10 }}>
                  <button className="btn btn-success" onClick={() => open(o, 'approve')}>Approve</button>
                  <button className="btn btn-danger" onClick={() => open(o, 'reject')}>Reject</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <Modal title={`${modal.action === 'approve' ? 'Approve' : 'Reject'} ${modal.order.order_number}`}
          onClose={() => setModal(null)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
            <button className={`btn ${modal.action === 'approve' ? 'btn-success' : 'btn-danger'}`}
              onClick={confirm} disabled={busy}>
              Confirm {modal.action}</button>
          </>}>
          <Alert kind="error">{error}</Alert>
          <p className="muted" style={{ marginTop: 0 }}>
            {modal.action === 'approve'
              ? 'Approving will deduct inventory and complete the order.'
              : 'Rejecting leaves inventory untouched.'} The sales rep will be emailed.
          </p>
          <div className="flex between" style={{ marginBottom: 12 }}>
            <StatusBadge status={modal.order.status} />
            <strong><Money value={modal.order.total_amount} /></strong>
          </div>
          <div className="field">
            <label>Notes (optional)</label>
            <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Add a note for the sales rep…" />
          </div>
        </Modal>
      )}
    </>
  )
}
