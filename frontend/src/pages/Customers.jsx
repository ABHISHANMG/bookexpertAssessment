import { useEffect, useState } from 'react'
import { customerApi } from '../api/resources'
import { errorMessage } from '../api/client'
import { Alert, Loading, Modal } from '../components/ui'

const EMPTY = { name: '', email: '', phone: '', address: '' }

export default function Customers() {
  const [customers, setCustomers] = useState(null)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [busy, setBusy] = useState(false)

  async function load() {
    try { setCustomers(await customerApi.list({ search: search || undefined })) }
    catch (e) { setError(errorMessage(e)) }
  }
  useEffect(() => { load() }, []) // eslint-disable-line

  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('')
    try {
      await customerApi.create(form)
      setOpen(false); setForm(EMPTY); await load()
    } catch (err) { setError(errorMessage(err)) } finally { setBusy(false) }
  }

  if (!customers) return <Loading />

  return (
    <>
      {!open && <Alert kind="error">{error}</Alert>}
      <div className="toolbar">
        <input className="grow" placeholder="Search customers…" value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()} style={{ maxWidth: 360 }} />
        <button className="btn btn-ghost" onClick={load}>Search</button>
        <div style={{ flex: 1 }} />
        <button className="btn btn-primary" onClick={() => { setForm(EMPTY); setError(''); setOpen(true) }}>
          + New Customer</button>
      </div>

      <div className="card table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Address</th></tr></thead>
          <tbody>
            {customers.length === 0 && <tr><td colSpan={4} className="muted">No customers found.</td></tr>}
            {customers.map((c) => (
              <tr key={c.id}>
                <td><strong>{c.name}</strong></td>
                <td>{c.email}</td>
                <td className="muted">{c.phone || '—'}</td>
                <td className="muted">{c.address || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <Modal title="New Customer" onClose={() => setOpen(false)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={submit} disabled={busy}>Create</button>
          </>}>
          <Alert kind="error">{error}</Alert>
          <form onSubmit={submit}>
            <div className="field"><label>Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div className="field"><label>Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
            <div className="row">
              <div className="field"><label>Phone</label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div className="field"><label>Address</label>
              <textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          </form>
        </Modal>
      )}
    </>
  )
}
