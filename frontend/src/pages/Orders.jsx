import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { orderApi } from '../api/resources'
import { errorMessage } from '../api/client'
import { Alert, Loading, Modal, Money, StatusBadge } from '../components/ui'

const STATUSES = ['', 'PENDING_APPROVAL', 'COMPLETED', 'REJECTED', 'CANCELLED']

export default function Orders() {
  const location = useLocation()
  const [orders, setOrders] = useState(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [flash, setFlash] = useState(location.state?.flash || '')
  const [detail, setDetail] = useState(null)
  const [busy, setBusy] = useState(false)

  // Clear the one-time flash from history so it doesn't reappear on refresh.
  useEffect(() => {
    if (location.state?.flash) window.history.replaceState({}, '')
  }, []) // eslint-disable-line

  async function load() {
    try { setOrders(await orderApi.list({ status: status || undefined })) }
    catch (e) { setError(errorMessage(e)) }
  }
  useEffect(() => { load() }, [status]) // eslint-disable-line

  async function cancel(order) {
    setBusy(true); setError('')
    try {
      await orderApi.cancel(order.id)
      setDetail(null); await load()
    } catch (err) { setError(errorMessage(err)) } finally { setBusy(false) }
  }

  async function downloadInvoice(order) {
    setBusy(true); setError('')
    try { await orderApi.downloadInvoice(order.id, order.order_number) }
    catch (err) { setError(errorMessage(err)) } finally { setBusy(false) }
  }

  if (!orders) return <Loading />

  return (
    <>
      {!detail && <Alert kind="error">{error}</Alert>}
      {flash && <Alert kind="success">{flash}</Alert>}
      <div className="toolbar">
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ maxWidth: 220 }}>
          {STATUSES.map((s) => <option key={s} value={s}>{s ? s.replace('_', ' ') : 'All statuses'}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <Link to="/orders/new" className="btn btn-primary">+ New Order</Link>
      </div>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr><th>Order #</th><th>Customer</th><th>Items</th><th className="right">Total</th>
              <th>Status</th><th>Created by</th><th></th></tr>
          </thead>
          <tbody>
            {orders.length === 0 && <tr><td colSpan={7} className="muted">No orders found.</td></tr>}
            {orders.map((o) => (
              <tr key={o.id}>
                <td><strong>{o.order_number}</strong>{o.requires_approval &&
                  <span className="muted" title="Required approval"> ★</span>}</td>
                <td>{o.customer.name}</td>
                <td className="muted">{o.items.length}</td>
                <td className="right"><Money value={o.total_amount} /></td>
                <td><StatusBadge status={o.status} /></td>
                <td className="muted">{o.created_by.name}</td>
                <td className="right">
                  <button className="btn btn-ghost btn-sm" onClick={() => { setError(''); setDetail(o) }}>View</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detail && (
        <Modal title={`Order ${detail.order_number}`} onClose={() => setDetail(null)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => downloadInvoice(detail)} disabled={busy}>
              ⬇ Invoice PDF</button>
            {detail.status === 'PENDING_APPROVAL'
              ? <button className="btn btn-danger" onClick={() => cancel(detail)} disabled={busy}>Cancel order</button>
              : <button className="btn btn-ghost" onClick={() => setDetail(null)}>Close</button>}
          </>}>
          <Alert kind="error">{error}</Alert>
          <div className="flex between" style={{ marginBottom: 12 }}>
            <StatusBadge status={detail.status} />
            <strong style={{ fontSize: 18 }}><Money value={detail.total_amount} /></strong>
          </div>
          <p className="muted" style={{ marginTop: 0 }}>
            Customer: <strong>{detail.customer.name}</strong> ({detail.customer.email})<br />
            Created by {detail.created_by.name}
            {detail.approved_by && <> · Decided by {detail.approved_by.name}</>}
          </p>
          {detail.decision_notes && <Alert kind="info">Notes: {detail.decision_notes}</Alert>}
          <table style={{ marginTop: 10 }}>
            <thead><tr><th>Product</th><th className="right">Qty</th><th className="right">Unit</th><th className="right">Line</th></tr></thead>
            <tbody>
              {detail.items.map((it) => (
                <tr key={it.id}>
                  <td>{it.product.name} <span className="muted">({it.product.sku})</span></td>
                  <td className="right">{it.quantity}</td>
                  <td className="right"><Money value={it.unit_price} /></td>
                  <td className="right"><Money value={it.line_total} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Modal>
      )}
    </>
  )
}
