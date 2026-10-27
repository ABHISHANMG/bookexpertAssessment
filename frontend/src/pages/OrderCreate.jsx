import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { customerApi, metaApi, orderApi, productApi } from '../api/resources'
import { errorMessage } from '../api/client'
import { Alert, Loading, Money, Spinner } from '../components/ui'

export default function OrderCreate() {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState(null)
  const [products, setProducts] = useState(null)
  const [threshold, setThreshold] = useState(null)
  const [customerId, setCustomerId] = useState('')
  const [lines, setLines] = useState([{ product_id: '', quantity: 1 }])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    Promise.all([customerApi.list(), productApi.list({ active_only: true }), metaApi.config()])
      .then(([c, p, cfg]) => { setCustomers(c); setProducts(p); setThreshold(cfg.approval_threshold) })
      .catch((e) => setError(errorMessage(e)))
  }, [])

  const productMap = useMemo(
    () => Object.fromEntries((products || []).map((p) => [String(p.id), p])), [products])

  const total = useMemo(() => lines.reduce((sum, l) => {
    const p = productMap[String(l.product_id)]
    return sum + (p ? Number(p.price) * Number(l.quantity || 0) : 0)
  }, 0), [lines, productMap])

  const needsApproval = threshold != null && total > threshold

  function setLine(i, patch) {
    setLines(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  }
  function addLine() { setLines([...lines, { product_id: '', quantity: 1 }]) }
  function removeLine(i) { setLines(lines.filter((_, idx) => idx !== i)) }

  function stockWarning(l) {
    const p = productMap[String(l.product_id)]
    if (p && Number(l.quantity) > p.stock_quantity) return `Only ${p.stock_quantity} in stock`
    return null
  }

  async function submit(e) {
    e.preventDefault(); setError('')
    const items = lines
      .filter((l) => l.product_id && Number(l.quantity) > 0)
      .map((l) => ({ product_id: Number(l.product_id), quantity: Number(l.quantity) }))
    if (!customerId) return setError('Please select a customer.')
    if (items.length === 0) return setError('Add at least one product line.')

    setBusy(true)
    try {
      const order = await orderApi.create({ customer_id: Number(customerId), items })
      const msg = order.status === 'PENDING_APPROVAL'
        ? `Order ${order.order_number} created and sent for manager approval.`
        : `Order ${order.order_number} created and completed.`
      navigate('/orders', { state: { flash: msg } })
    } catch (err) { setError(errorMessage(err)) } finally { setBusy(false) }
  }

  if (!customers || !products) return <Loading />

  return (
    <div style={{ maxWidth: 760 }}>
      <Alert kind="error">{error}</Alert>
      <form onSubmit={submit} className="card card-pad">
        <div className="field">
          <label>Customer</label>
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
            <option value="">Select a customer…</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <label style={{ fontSize: 13, fontWeight: 600, display: 'block', margin: '16px 0 8px' }}>
          Order Lines</label>
        <div className="line-item-row muted" style={{ fontSize: 12 }}>
          <div>Product</div><div>Qty</div><div className="right">Line total</div><div />
        </div>
        {lines.map((l, i) => {
          const p = productMap[String(l.product_id)]
          const warn = stockWarning(l)
          return (
            <div key={i}>
              <div className="line-item-row">
                <select value={l.product_id} onChange={(e) => setLine(i, { product_id: e.target.value })}>
                  <option value="">Select product…</option>
                  {products.map((prod) => (
                    <option key={prod.id} value={prod.id}>
                      {prod.name} — ${Number(prod.price).toFixed(2)} ({prod.stock_quantity} in stock)
                    </option>
                  ))}
                </select>
                <input type="number" min="1" value={l.quantity}
                  onChange={(e) => setLine(i, { quantity: e.target.value })} />
                <div className="right" style={{ paddingBottom: 10 }}>
                  {p ? <Money value={Number(p.price) * Number(l.quantity || 0)} /> : '—'}
                </div>
                <button type="button" className="icon-btn" title="Remove"
                  onClick={() => removeLine(i)} disabled={lines.length === 1}>🗑</button>
              </div>
              {warn && <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: -6, marginBottom: 8 }}>{warn}</div>}
            </div>
          )
        })}
        <button type="button" className="btn btn-ghost btn-sm" onClick={addLine}>+ Add line</button>

        <div style={{ borderTop: '1px solid var(--border)', margin: '18px 0', paddingTop: 16 }}>
          <div className="flex between">
            <span className="muted">Order total</span>
            <strong style={{ fontSize: 22 }}><Money value={total} /></strong>
          </div>
          {needsApproval && (
            <Alert kind="info">
              This order exceeds the approval threshold of <Money value={threshold} />.
              It will be sent to a manager for approval before completion.
            </Alert>
          )}
        </div>

        <div className="flex" style={{ gap: 10 }}>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? <Spinner /> : 'Create Order'}</button>
          <button type="button" className="btn btn-ghost" onClick={() => navigate('/orders')}>Cancel</button>
        </div>
      </form>
    </div>
  )
}
