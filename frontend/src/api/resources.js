import client from './client'

export const authApi = {
  login: (email, password) =>
    client.post('/api/auth/login', { email, password }).then((r) => r.data),
  me: () => client.get('/api/auth/me').then((r) => r.data),
}

export const userApi = {
  list: () => client.get('/api/auth/users').then((r) => r.data),
  create: (data) => client.post('/api/auth/register', data).then((r) => r.data),
  update: (id, data) => client.patch(`/api/auth/users/${id}`, data).then((r) => r.data),
}

export const productApi = {
  list: (params) => client.get('/api/products', { params }).then((r) => r.data),
  create: (data) => client.post('/api/products', data).then((r) => r.data),
  update: (id, data) => client.patch(`/api/products/${id}`, data).then((r) => r.data),
  adjustStock: (id, data) =>
    client.post(`/api/products/${id}/adjust-stock`, data).then((r) => r.data),
  movements: (id) =>
    client.get(`/api/products/${id}/movements`).then((r) => r.data),
}

export const customerApi = {
  list: (params) => client.get('/api/customers', { params }).then((r) => r.data),
  create: (data) => client.post('/api/customers', data).then((r) => r.data),
  update: (id, data) => client.patch(`/api/customers/${id}`, data).then((r) => r.data),
}

export const orderApi = {
  list: (params) => client.get('/api/orders', { params }).then((r) => r.data),
  pending: () => client.get('/api/orders/pending').then((r) => r.data),
  get: (id) => client.get(`/api/orders/${id}`).then((r) => r.data),
  create: (data) => client.post('/api/orders', data).then((r) => r.data),
  approve: (id, notes) =>
    client.post(`/api/orders/${id}/approve`, { notes }).then((r) => r.data),
  reject: (id, notes) =>
    client.post(`/api/orders/${id}/reject`, { notes }).then((r) => r.data),
  cancel: (id) => client.post(`/api/orders/${id}/cancel`).then((r) => r.data),
  // Fetch the invoice PDF as a blob and trigger a browser download.
  downloadInvoice: async (id, orderNumber) => {
    const res = await client.get(`/api/orders/${id}/invoice`, { responseType: 'blob' })
    const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `invoice-${orderNumber}.pdf`
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(url)
  },
}

export const dashboardApi = {
  summary: () => client.get('/api/dashboard/summary').then((r) => r.data),
}

export const metaApi = {
  config: () => client.get('/api/config').then((r) => r.data),
}
