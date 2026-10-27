import { useEffect, useState } from 'react'
import { userApi } from '../api/resources'
import { errorMessage } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { Alert, Loading, Modal } from '../components/ui'

const ROLES = ['SALES', 'MANAGER', 'ADMIN']
const EMPTY = { name: '', email: '', role: 'SALES', password: '' }

function RoleBadge({ role }) {
  const cls = role === 'ADMIN' ? 'approved' : role === 'MANAGER' ? 'pending' : 'ok'
  return <span className={`badge ${cls}`}>{role}</span>
}

export default function Users() {
  const { user: me } = useAuth()
  const [users, setUsers] = useState(null)
  const [error, setError] = useState('')
  const [flash, setFlash] = useState('')
  const [modal, setModal] = useState(null) // {type:'create'|'edit', user?}
  const [form, setForm] = useState(EMPTY)
  const [edit, setEdit] = useState({ role: 'SALES', is_active: true, password: '' })
  const [busy, setBusy] = useState(false)

  async function load() {
    try { setUsers(await userApi.list()) } catch (e) { setError(errorMessage(e)) }
  }
  useEffect(() => { load() }, [])

  function openCreate() { setForm(EMPTY); setError(''); setModal({ type: 'create' }) }
  function openEdit(u) {
    setEdit({ role: u.role, is_active: u.is_active, password: '' })
    setError(''); setModal({ type: 'edit', user: u })
  }

  async function submitCreate(e) {
    e.preventDefault(); setBusy(true); setError('')
    try {
      await userApi.create(form)
      setFlash(`User ${form.email} created.`); setModal(null); await load()
    } catch (err) { setError(errorMessage(err)) } finally { setBusy(false) }
  }

  async function submitEdit(e) {
    e.preventDefault(); setBusy(true); setError('')
    try {
      const patch = { role: edit.role, is_active: edit.is_active }
      if (edit.password) patch.password = edit.password
      await userApi.update(modal.user.id, patch)
      setFlash(`User ${modal.user.email} updated.`); setModal(null); await load()
    } catch (err) { setError(errorMessage(err)) } finally { setBusy(false) }
  }

  if (!users) return <Loading />

  return (
    <>
      {!modal && <Alert kind="error">{error}</Alert>}
      {flash && <Alert kind="success">{flash}</Alert>}
      <div className="toolbar">
        <div style={{ flex: 1 }} />
        <button className="btn btn-primary" onClick={openCreate}>+ New User</button>
      </div>

      <div className="card table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td><strong>{u.name}</strong>{u.id === me.id && <span className="muted"> (you)</span>}</td>
                <td>{u.email}</td>
                <td><RoleBadge role={u.role} /></td>
                <td><span className={`badge ${u.is_active ? 'ok' : 'cancelled'}`}>
                  {u.is_active ? 'Active' : 'Disabled'}</span></td>
                <td className="right">
                  <button className="btn btn-ghost btn-sm" onClick={() => openEdit(u)}>Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal?.type === 'create' && (
        <Modal title="New User" onClose={() => setModal(null)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={submitCreate} disabled={busy}>Create</button>
          </>}>
          <Alert kind="error">{error}</Alert>
          <form onSubmit={submitCreate}>
            <div className="field"><label>Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div className="field"><label>Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
            <div className="row">
              <div className="field"><label>Role</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select></div>
              <div className="field"><label>Password</label>
                <input type="password" value={form.password} minLength={6}
                  onChange={(e) => setForm({ ...form, password: e.target.value })} required /></div>
            </div>
          </form>
        </Modal>
      )}

      {modal?.type === 'edit' && (
        <Modal title={`Edit ${modal.user.name}`} onClose={() => setModal(null)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={submitEdit} disabled={busy}>Save</button>
          </>}>
          <Alert kind="error">{error}</Alert>
          <form onSubmit={submitEdit}>
            <div className="field"><label>Role</label>
              <select value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value })}>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select></div>
            <div className="field">
              <label className="flex" style={{ gap: 8 }}>
                <input type="checkbox" style={{ width: 'auto' }} checked={edit.is_active}
                  disabled={modal.user.id === me.id}
                  onChange={(e) => setEdit({ ...edit, is_active: e.target.checked })} />
                Active {modal.user.id === me.id && <span className="muted">(can't disable yourself)</span>}
              </label>
            </div>
            <div className="field"><label>Reset password (optional)</label>
              <input type="password" value={edit.password} placeholder="Leave blank to keep current"
                onChange={(e) => setEdit({ ...edit, password: e.target.value })} /></div>
          </form>
        </Modal>
      )}
    </>
  )
}
