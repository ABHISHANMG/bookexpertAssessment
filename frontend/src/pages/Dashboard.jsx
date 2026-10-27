import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { dashboardApi } from '../api/resources'
import { errorMessage } from '../api/client'
import { Alert, Loading, Money, StatusBadge } from '../components/ui'

function Stat({ label, value, sub, accent }) {
  return (
    <div className={`card stat ${accent ? 'accent' : ''}`}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  )
}

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    dashboardApi.summary().then(setData).catch((e) => setError(errorMessage(e)))
  }, [])

  if (error) return <Alert kind="error">{error}</Alert>
  if (!data) return <Loading />

  return (
    <>
      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        <Stat label="Total Sales (completed)" value={<Money value={data.total_sales} />} accent />
        <Stat label="Total Orders" value={data.total_orders}
          sub={`${data.completed_orders} completed`} />
        <Stat label="Pending Approvals" value={data.pending_approvals}
          sub={data.pending_approvals > 0 ? 'Needs attention' : 'All clear'} />
        <Stat label="Low-stock Products" value={data.low_stock_count}
          sub={`of ${data.total_products} active`} />
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-head"><h3>Recent Orders</h3>
            <Link to="/orders" className="btn btn-ghost btn-sm">View all</Link></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Order</th><th>Customer</th><th className="right">Total</th><th>Status</th></tr></thead>
              <tbody>
                {data.recent_orders.length === 0 && (
                  <tr><td colSpan={4} className="muted">No orders yet.</td></tr>
                )}
                {data.recent_orders.map((o) => (
                  <tr key={o.id}>
                    <td><strong>{o.order_number}</strong></td>
                    <td>{o.customer.name}</td>
                    <td className="right"><Money value={o.total_amount} /></td>
                    <td><StatusBadge status={o.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h3>Orders by Status</h3></div>
          <div className="card-pad">
            {data.orders_by_status.length === 0 && <span className="muted">No data.</span>}
            {data.orders_by_status.map((s) => (
              <div key={s.status} className="flex between" style={{ padding: '7px 0' }}>
                <StatusBadge status={s.status} />
                <strong>{s.count}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h3>Low Stock Alerts</h3>
            <Link to="/products" className="btn btn-ghost btn-sm">Manage</Link></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Product</th><th>SKU</th><th className="right">In stock</th><th className="right">Reorder at</th></tr></thead>
              <tbody>
                {data.low_stock_products.length === 0 && (
                  <tr><td colSpan={4} className="muted">Everything is well stocked. 🎉</td></tr>
                )}
                {data.low_stock_products.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td className="muted">{p.sku}</td>
                    <td className="right"><span className="badge low">{p.stock_quantity}</span></td>
                    <td className="right muted">{p.reorder_level}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h3>Top Selling Products</h3></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Product</th><th className="right">Units</th><th className="right">Revenue</th></tr></thead>
              <tbody>
                {data.top_products.length === 0 && (
                  <tr><td colSpan={3} className="muted">No completed sales yet.</td></tr>
                )}
                {data.top_products.map((p) => (
                  <tr key={p.product_id}>
                    <td>{p.name}</td>
                    <td className="right">{p.units_sold}</td>
                    <td className="right"><Money value={p.revenue} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}
