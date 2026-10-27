import { useEffect, useState } from 'react'
import { productApi } from '../api/resources'
import { errorMessage } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { Alert, Loading, Modal, Money } from '../components/ui'

const EMPTY = { sku: '', name: '', description: '', price: '', stock_quantity: 0, reorder_level: 10 }

export default function Products() {
  const { isManager } = useAuth()
  const [products, setProducts] = useState(null)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [modal, setModal] = useState(null) // {type: 'create'|'adjust'|'history', product}
  const [form, setForm] = useState(EMPTY)
  const [adjust, setAdjust] = useState({ quantity: 0, note: '' })
  const [movements, setMovements] = useState(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    try {
      setProducts(await productApi.list({ search: search || undefined, active_only: true }))
    } catch (e) { setError(errorMessage(e)) }
  }
  useEffect(() => { load() }, []) // eslint-disable-line

  function openCreate() { setForm(EMPTY); setError(''); setModal({ type: 'create' }) }
  function openAdjust(p) { setAdjust({ quantity: 0, note: '' }); setError(''); setModal({ type: 'adjust', product: p }) }
  async function openHistory(p) {
    setError(''); setMovements(null); setModal({ type: 'history', product: p })
    try { setMovements(await productApi.movements(p.id)) }
    catch (e) { setError(errorMessage(e)) }
  }

  async function submitCreate(e) {
    e.preventDefault(); setBusy(true); setError('')
    try {
      await productApi.create({
        ...form,
        price: Number(form.price),
        stock_quantity: Number(form.stock_quantity),
        reorder_level: Number(form.reorder_level),
      })
      setModal(null); await load()
    } catch (err) { setError(errorMessage(err)) } finally { setBusy(false) }
  }

  async function submitAdjust(e) {
    e.preventDefault(); setBusy(true); setError('')
    try {
      await productApi.adjustStock(modal.product.id, {
        quantity: Number(adjust.quantity), note: adjust.note || null,
      })
      setModal(null); await load()
    } catch (err) { setError(errorMessage(err)) } finally { setBusy(false) }
  }

  if (!products) return <Loading />

  return (
    <>
      {!modal && <Alert kind="error">{error}</Alert>}
      <div className="toolbar">
        <input className="grow" placeholder="Search by name or SKU…" value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()} style={{ maxWidth: 360 }} />
        <button className="btn btn-ghost" onClick={load}>Search</button>
        <div style={{ flex: 1 }} />
        {isManager && <button className="btn btn-primary" onClick={openCreate}>+ New Product</button>}
      </div>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr><th>SKU</th><th>Name</th><th className="right">Price</th>
              <th className="right">Stock</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {products.length === 0 && <tr><td colSpan={6} className="muted">No products found.</td></tr>}
            {products.map((p) => {
              const low = p.stock_quantity <= p.reorder_level
              return (
                <tr key={p.id}>
                  <td className="muted">{p.sku}</td>
                  <td><strong>{p.name}</strong></td>
                  <td className="right"><Money value={p.price} /></td>
                  <td className="right">{p.stock_quantity}</td>
                  <td><span className={`badge ${low ? 'low' : 'ok'}`}>{low ? 'Low stock' : 'In stock'}</span></td>
                  <td className="right">
                    <div className="flex" style={{ gap: 6, justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openHistory(p)}>History</button>
                      {isManager && <button className="btn btn-ghost btn-sm" onClick={() => openAdjust(p)}>Adjust</button>}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {modal?.type === 'create' && (
        <Modal title="New Product" onClose={() => setModal(null)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={submitCreate} disabled={busy}>Create</button>
          </>}>
          <Alert kind="error">{error}</Alert>
          <form onSubmit={submitCreate}>
            <div className="row">
              <div className="field"><label>SKU</label>
                <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} required /></div>
              <div className="field"><label>Price</label>
                <input type="number" step="0.01" min="0.01" value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })} required /></div>
            </div>
            <div className="field"><label>Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div className="field"><label>Description</label>
              <textarea rows={2} value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="row">
              <div className="field"><label>Initial stock</label>
                <input type="number" min="0" value={form.stock_quantity}
                  onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })} /></div>
              <div className="field"><label>Reorder level</label>
                <input type="number" min="0" value={form.reorder_level}
                  onChange={(e) => setForm({ ...form, reorder_level: e.target.value })} /></div>
            </div>
          </form>
        </Modal>
      )}

      {modal?.type === 'adjust' && (
        <Modal title={`Adjust stock — ${modal.product.name}`} onClose={() => setModal(null)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={submitAdjust} disabled={busy}>Apply</button>
          </>}>
          <Alert kind="error">{error}</Alert>
          <p className="muted">Current stock: <strong>{modal.product.stock_quantity}</strong>.
            Use a positive number to restock, negative to reduce.</p>
          <form onSubmit={submitAdjust}>
            <div className="field"><label>Quantity change</label>
              <input type="number" value={adjust.quantity}
                onChange={(e) => setAdjust({ ...adjust, quantity: e.target.value })} required /></div>
            <div className="field"><label>Note (optional)</label>
              <input value={adjust.note} onChange={(e) => setAdjust({ ...adjust, note: e.target.value })} /></div>
          </form>
        </Modal>
      )}

      {modal?.type === 'history' && (
        <Modal title={`Stock history — ${modal.product.name}`} onClose={() => setModal(null)}
          footer={<button className="btn btn-ghost" onClick={() => setModal(null)}>Close</button>}>
          <Alert kind="error">{error}</Alert>
          {!movements ? <Loading /> : movements.length === 0 ? (
            <p className="muted">No stock movements recorded yet.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Date</th><th>Change</th><th>Reason</th><th>Ref</th><th>Note</th></tr></thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id}>
                      <td className="muted">{new Date(m.created_at).toLocaleString()}</td>
                      <td><strong style={{ color: m.change < 0 ? 'var(--danger)' : 'var(--success)' }}>
                        {m.change > 0 ? `+${m.change}` : m.change}</strong></td>
                      <td>{m.reason.replace(/_/g, ' ').toLowerCase()}</td>
                      <td className="muted">{m.order_id ? `Order #${m.order_id}` : '—'}</td>
                      <td className="muted">{m.note || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      )}
    </>
  )
}
