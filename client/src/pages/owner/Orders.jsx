import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import OwnerLayout from '../../components/layout/OwnerLayout';
import { api } from '../../lib/api';
import toast from 'react-hot-toast';

const statusColors = {
    pending: 'warning', confirmed: 'info', preparing: 'info',
    ready: 'success', delivered: 'success', cancelled: 'error'
};

export default function Orders() {
    const navigate = useNavigate();
    const [restaurant, setRestaurant] = useState(null);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('');

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const res = await api.getMyRestaurant();
            if (!res.data) return navigate('/owner/setup');
            setRestaurant(res.data);
            const ordersRes = await api.getRestaurantOrders(res.data.id, { limit: 100 });
            setOrders(ordersRes.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const updateStatus = async (orderId, status) => {
        try {
            await api.updateOrderStatus(orderId, status);
            toast.success(`Order ${status}`);
            loadData();
        } catch (err) {
            toast.error(err.message);
        }
    };

    const filteredOrders = statusFilter
        ? orders.filter((o) => o.status === statusFilter)
        : orders;

    if (loading) {
        return (
            <OwnerLayout>
                <div className="page-container">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="skeleton" style={{ height: 100, marginBottom: 16, borderRadius: 'var(--radius-lg)' }} />
                    ))}
                </div>
            </OwnerLayout>
        );
    }

    return (
        <OwnerLayout>
            <div className="page-container">
                <div className="page-header">
                    <h1>Orders</h1>
                    <p>Manage and track all incoming orders</p>
                </div>

                <div className="flex gap-2 mb-6" style={{ flexWrap: 'wrap' }}>
                    {['', 'pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'].map((s) => (
                        <button
                            key={s}
                            className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setStatusFilter(s)}
                        >
                            {s || 'All'} {s ? `(${orders.filter((o) => o.status === s).length})` : `(${orders.length})`}
                        </button>
                    ))}
                </div>

                {filteredOrders.length > 0 ? (
                    <div className="stagger-children" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {filteredOrders.map((order) => (
                            <div key={order.id} className="card animate-fade-in-up" style={{ padding: 20 }}>
                                <div className="flex items-center justify-between mb-2">
                                    <div>
                                        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--neutral-900)', fontFamily: 'var(--font-display)' }}>{order.orderNumber}</span>
                                        <span style={{ marginLeft: 12, fontSize: 13, color: 'var(--neutral-500)' }}>{order.customerName}</span>
                                        {order.orderedVia === 'voice' && <span className="badge badge-info" style={{ marginLeft: 8 }}>🎤 Voice</span>}
                                        {order.aiUpsellAccepted && <span className="badge badge-success" style={{ marginLeft: 4 }}>✨ Upsell</span>}
                                    </div>
                                    <span className={`badge badge-${statusColors[order.status]}`}>{order.status}</span>
                                </div>

                                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
                                    {order.items?.map((item, idx) => (
                                        <div key={idx} style={{ fontSize: 13, color: 'var(--neutral-600)' }}>
                                            {item.quantity}× {item.itemName}
                                            <span style={{ color: 'var(--neutral-400)' }}> (₹{item.totalPrice})</span>
                                            {item.isUpsell && <span style={{ color: 'var(--accent-500)', fontSize: 11, marginLeft: 4 }}>upsell</span>}
                                        </div>
                                    ))}
                                </div>

                                <div className="flex items-center justify-between">
                                    <div>
                                        <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--brand-600)', fontFamily: 'var(--font-display)' }}>₹{order.total}</span>
                                        <span style={{ fontSize: 12, color: 'var(--neutral-400)', marginLeft: 8 }}>
                                            {new Date(order.createdAt).toLocaleString()}
                                        </span>
                                    </div>
                                    {order.status !== 'delivered' && order.status !== 'cancelled' && (
                                        <div className="flex gap-2">
                                            {order.status === 'pending' && (
                                                <button className="btn btn-sm btn-primary" onClick={() => updateStatus(order.id, 'confirmed')}>Confirm</button>
                                            )}
                                            {order.status === 'confirmed' && (
                                                <button className="btn btn-sm btn-accent" onClick={() => updateStatus(order.id, 'preparing')}>Preparing</button>
                                            )}
                                            {order.status === 'preparing' && (
                                                <button className="btn btn-sm btn-success" onClick={() => updateStatus(order.id, 'ready')}>Ready</button>
                                            )}
                                            {order.status === 'ready' && (
                                                <button className="btn btn-sm btn-success" onClick={() => updateStatus(order.id, 'delivered')}>Delivered</button>
                                            )}
                                            <button className="btn btn-sm btn-danger" onClick={() => updateStatus(order.id, 'cancelled')}>Cancel</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="empty-state">
                        <div className="empty-state-icon">🛒</div>
                        <h3>No orders yet</h3>
                        <p>Orders placed by customers will appear here.</p>
                    </div>
                )}
            </div>
        </OwnerLayout>
    );
}
