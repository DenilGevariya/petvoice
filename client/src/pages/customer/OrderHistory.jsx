import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { HiOutlineMicrophone, HiOutlineArrowLeft, HiOutlineLogout } from 'react-icons/hi';

const statusLabels = {
    pending: '🕐 Pending',
    confirmed: '✅ Confirmed',
    preparing: '👨‍🍳 Preparing',
    ready: '🔔 Ready',
    delivered: '✅ Delivered',
    cancelled: '❌ Cancelled',
};

const statusColors = {
    pending: 'warning', confirmed: 'info', preparing: 'info',
    ready: 'success', delivered: 'success', cancelled: 'error'
};

export default function OrderHistory() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadOrders();
    }, []);

    const loadOrders = async () => {
        try {
            const res = await api.getMyOrders();
            setOrders(res.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="voice-page">
            <div className="voice-header">
                <div className="voice-header-left">
                    <div className="voice-header-logo">P</div>
                    <div>
                        <h1>Order History</h1>
                        <p>Your past orders</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button className="btn btn-primary" onClick={() => navigate('/order')}>
                        <HiOutlineMicrophone size={16} /> New Order
                    </button>
                    <button className="btn btn-ghost" onClick={() => { logout(); navigate('/login'); }}>
                        <HiOutlineLogout size={18} />
                    </button>
                </div>
            </div>

            <div style={{ padding: 32, maxWidth: 800, margin: '0 auto', width: '100%' }}>
                {loading ? (
                    <div>
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="skeleton" style={{ height: 120, marginBottom: 16, borderRadius: 'var(--radius-lg)' }} />
                        ))}
                    </div>
                ) : orders.length > 0 ? (
                    <div className="stagger-children" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {orders.map((order) => (
                            <div key={order.id} className="card animate-fade-in-up">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <span style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-display)' }}>{order.orderNumber}</span>
                                        <span style={{ marginLeft: 12, fontSize: 14, color: 'var(--neutral-600)' }}>{order.restaurantName}</span>
                                    </div>
                                    <span className={`badge badge-${statusColors[order.status]}`}>{statusLabels[order.status]}</span>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
                                    {order.items?.map((item, idx) => (
                                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--neutral-600)' }}>
                                            <span>
                                                {item.quantity}× {item.itemName}
                                                {item.isUpsell && <span style={{ color: 'var(--accent-500)', marginLeft: 4, fontSize: 11 }}>✨ AI suggestion</span>}
                                            </span>
                                            <span>₹{item.totalPrice}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex items-center justify-between" style={{ paddingTop: 12, borderTop: '1px solid var(--neutral-100)' }}>
                                    <div className="flex items-center gap-3">
                                        {order.orderedVia === 'voice' && <span className="badge badge-info">🎤 Voice Order</span>}
                                        {order.aiUpsellAccepted && <span className="badge badge-success">✨ Upsell Accepted</span>}
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--brand-600)', fontFamily: 'var(--font-display)' }}>₹{order.total}</div>
                                        <div style={{ fontSize: 11, color: 'var(--neutral-400)' }}>
                                            {new Date(order.createdAt).toLocaleDateString()} {new Date(order.createdAt).toLocaleTimeString()}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="empty-state">
                        <div className="empty-state-icon">📦</div>
                        <h3>No orders yet</h3>
                        <p>Your order history will appear here after you place your first order.</p>
                        <button className="btn btn-primary" onClick={() => navigate('/order')}>
                            <HiOutlineMicrophone size={16} /> Place an Order
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
