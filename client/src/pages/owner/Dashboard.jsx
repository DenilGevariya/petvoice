import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import OwnerLayout from '../../components/layout/OwnerLayout';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { HiOutlineCurrencyRupee, HiOutlineShoppingBag, HiOutlineClipboardList, HiOutlineTrendingUp, HiOutlineStar, HiOutlineExclamationCircle } from 'react-icons/hi';

const classificationEmojis = { star: '⭐', workhorse: '🐎', puzzle: '❓', dog: '🐶' };
const classificationLabels = { star: 'Stars', workhorse: 'Workhorses', puzzle: 'Puzzles', dog: 'Dogs' };

export default function Dashboard() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [restaurant, setRestaurant] = useState(null);

    useEffect(() => {
        loadDashboard();
    }, []);

    const loadDashboard = async () => {
        try {
            const res = await api.getMyRestaurant();
            if (!res.data) {
                navigate('/owner/setup');
                return;
            }
            setRestaurant(res.data);
            const dashRes = await api.getDashboard(res.data.id);
            setData(dashRes.data);
        } catch (err) {
            console.error('Dashboard error:', err);
        } finally {
            setLoading(false);
        }
    };

    // Derive quick-insight counts from data
    const hiddenStarCount = data?.classifications?.puzzle || 0;
    const riskCount = data?.classifications?.dog || 0;
    const starCount = data?.classifications?.star || 0;

    if (loading) {
        return (
            <OwnerLayout>
                <div className="page-container">
                    <div className="stats-grid">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="skeleton" style={{ height: 120, borderRadius: 'var(--radius-lg)' }} />
                        ))}
                    </div>
                    <div className="grid-2">
                        <div className="skeleton" style={{ height: 300, borderRadius: 'var(--radius-lg)' }} />
                        <div className="skeleton" style={{ height: 300, borderRadius: 'var(--radius-lg)' }} />
                    </div>
                </div>
            </OwnerLayout>
        );
    }

    return (
        <OwnerLayout>
            <div className="page-container">
                {/* Welcome Banner */}
                <div className="dashboard-welcome animate-fade-in-up">
                    <h2>Welcome back, {user?.fullName?.split(' ')[0]}! 👋</h2>
                    <p>Here's the intelligence overview for {data?.restaurant?.name || 'your restaurant'}.</p>
                </div>

                {/* Stats Grid */}
                <div className="stats-grid stagger-children">
                    <div className="stat-card animate-fade-in-up">
                        <div className="stat-icon brand"><HiOutlineCurrencyRupee /></div>
                        <div>
                            <div className="stat-value">₹{(data?.restaurant?.totalRevenue || 0).toLocaleString()}</div>
                            <div className="stat-label">Total Revenue</div>
                            <div className="stat-trend up">
                                <HiOutlineTrendingUp size={14} /> This month: ₹{(data?.thisMonth?.revenue || 0).toLocaleString()}
                            </div>
                        </div>
                    </div>

                    <div className="stat-card animate-fade-in-up">
                        <div className="stat-icon accent"><HiOutlineShoppingBag /></div>
                        <div>
                            <div className="stat-value">{data?.restaurant?.totalOrders || 0}</div>
                            <div className="stat-label">Total Orders</div>
                            <div className="stat-trend up">
                                Today: {data?.today?.orders || 0}
                            </div>
                        </div>
                    </div>

                    <div className="stat-card animate-fade-in-up">
                        <div className="stat-icon success"><HiOutlineClipboardList /></div>
                        <div>
                            <div className="stat-value">{data?.menuItemCount || 0}</div>
                            <div className="stat-label">Menu Items</div>
                            <div className="stat-trend up">
                                <HiOutlineStar size={14} /> {starCount} Stars
                            </div>
                        </div>
                    </div>

                    <div className="stat-card animate-fade-in-up">
                        <div className="stat-icon warning"><HiOutlineExclamationCircle /></div>
                        <div>
                            <div className="stat-value">{hiddenStarCount}</div>
                            <div className="stat-label">Hidden Stars</div>
                            <div className="stat-trend up">
                                {riskCount} Risk Items
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid-2">
                    {/* Top Selling Items */}
                    <div className="card animate-fade-in-up">
                        <div className="card-header">
                            <div>
                                <div className="card-title">Top Selling Items</div>
                                <div className="card-subtitle">Based on total sales volume</div>
                            </div>
                        </div>
                        {data?.topItems?.length > 0 ? (
                            data.topItems.map((item, idx) => (
                                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: idx < data.topItems.length - 1 ? '1px solid var(--neutral-100)' : 'none' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <span style={{ width: 28, height: 28, borderRadius: 'var(--radius-full)', background: 'var(--brand-50)', color: 'var(--brand-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>{idx + 1}</span>
                                        <div>
                                            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--neutral-800)' }}>{item.name}</div>
                                            <div style={{ fontSize: 12, color: 'var(--neutral-500)' }}>{item.totalSales} sold</div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--brand-600)' }}>₹{item.totalRevenue?.toLocaleString()}</span>
                                        {item.classification !== 'unclassified' && (
                                            <span className={`badge badge-${item.classification}`}>
                                                {classificationEmojis[item.classification]} {classificationLabels[item.classification]}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="empty-state" style={{ padding: 32 }}>
                                <div className="empty-state-icon">📊</div>
                                <p>No sales data yet. Add menu items and POS data to see insights.</p>
                            </div>
                        )}
                    </div>

                    {/* High Margin Items */}
                    <div className="card animate-fade-in-up">
                        <div className="card-header">
                            <div>
                                <div className="card-title">High Margin Items</div>
                                <div className="card-subtitle">Most profitable menu items</div>
                            </div>
                        </div>
                        {data?.topItems?.length > 0 ? (
                            [...data.topItems]
                                .sort((a, b) => (b.totalRevenue / (b.totalSales || 1)) - (a.totalRevenue / (a.totalSales || 1)))
                                .map((item, idx) => (
                                    <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: idx < data.topItems.length - 1 ? '1px solid var(--neutral-100)' : 'none' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <span style={{ width: 28, height: 28, borderRadius: 'var(--radius-full)', background: 'var(--success-50)', color: 'var(--success-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>{idx + 1}</span>
                                            <div>
                                                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--neutral-800)' }}>{item.name}</div>
                                                <div style={{ fontSize: 12, color: 'var(--neutral-500)' }}>Revenue: ₹{item.totalRevenue?.toLocaleString()}</div>
                                            </div>
                                        </div>
                                        {item.classification !== 'unclassified' && (
                                            <span className={`badge badge-${item.classification}`}>
                                                {classificationEmojis[item.classification]}
                                            </span>
                                        )}
                                    </div>
                                ))
                        ) : (
                            <div className="empty-state" style={{ padding: 32 }}>
                                <div className="empty-state-icon">💰</div>
                                <p>No margin data yet.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Classification Overview */}
                {data?.classifications && Object.keys(data.classifications).length > 0 && (
                    <div className="card mt-6 animate-fade-in-up">
                        <div className="card-header">
                            <div>
                                <div className="card-title">Menu Classification Overview</div>
                                <div className="card-subtitle">BCG Matrix — Sales vs Profitability</div>
                            </div>
                        </div>
                        <div className="classification-grid">
                            {Object.entries(classificationLabels).map(([key, label]) => (
                                <div key={key} className={`classification-card ${key}`}>
                                    <h3>
                                        {classificationEmojis[key]} {label}
                                        <span className={`badge badge-${key}`}>{data.classifications[key] || 0}</span>
                                    </h3>
                                    <p style={{ fontSize: 12, color: 'var(--neutral-600)' }}>
                                        {key === 'star' && 'High sales + High margin — Your best performers'}
                                        {key === 'workhorse' && 'High sales + Low margin — Popular but less profitable'}
                                        {key === 'puzzle' && 'Low sales + High margin — Hidden potential'}
                                        {key === 'dog' && 'Low sales + Low margin — Consider removing or repricing'}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Revenue Summary */}
                <div className="card mt-6 animate-fade-in-up">
                    <div className="card-header">
                        <div>
                            <div className="card-title">Revenue Summary</div>
                        </div>
                    </div>
                    <div className="stats-grid" style={{ marginBottom: 0 }}>
                        <div style={{ padding: '16px 0', textAlign: 'center' }}>
                            <div style={{ fontSize: 12, color: 'var(--neutral-500)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>Today</div>
                            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--neutral-900)', fontFamily: 'var(--font-display)' }}>₹{(data?.today?.revenue || 0).toLocaleString()}</div>
                            <div style={{ fontSize: 13, color: 'var(--neutral-500)' }}>{data?.today?.orders || 0} orders</div>
                        </div>
                        <div style={{ padding: '16px 0', textAlign: 'center' }}>
                            <div style={{ fontSize: 12, color: 'var(--neutral-500)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>This Week</div>
                            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--neutral-900)', fontFamily: 'var(--font-display)' }}>₹{(data?.thisWeek?.revenue || 0).toLocaleString()}</div>
                            <div style={{ fontSize: 13, color: 'var(--neutral-500)' }}>{data?.thisWeek?.orders || 0} orders</div>
                        </div>
                        <div style={{ padding: '16px 0', textAlign: 'center' }}>
                            <div style={{ fontSize: 12, color: 'var(--neutral-500)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>This Month</div>
                            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--neutral-900)', fontFamily: 'var(--font-display)' }}>₹{(data?.thisMonth?.revenue || 0).toLocaleString()}</div>
                            <div style={{ fontSize: 13, color: 'var(--neutral-500)' }}>{data?.thisMonth?.orders || 0} orders</div>
                        </div>
                        <div style={{ padding: '16px 0', textAlign: 'center' }}>
                            <div style={{ fontSize: 12, color: 'var(--neutral-500)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>All Time</div>
                            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--brand-600)', fontFamily: 'var(--font-display)' }}>₹{(data?.restaurant?.totalRevenue || 0).toLocaleString()}</div>
                            <div style={{ fontSize: 13, color: 'var(--neutral-500)' }}>{data?.restaurant?.totalOrders || 0} orders</div>
                        </div>
                    </div>
                </div>
            </div>
        </OwnerLayout>
    );
}
