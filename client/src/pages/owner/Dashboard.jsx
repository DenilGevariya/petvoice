import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import OwnerLayout from '../../components/layout/OwnerLayout';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import {
    HiOutlineCurrencyRupee, HiOutlineShoppingBag, HiOutlineTrendingUp,
    HiOutlineTrendingDown, HiOutlineChartBar, HiOutlineRefresh,
} from 'react-icons/hi';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

// ── Colors for chart bars (up to 8 items) ──
const CHART_COLORS = [
    '#f97316', '#8b5cf6', '#22c55e', '#3b82f6',
    '#ef4444', '#eab308', '#06b6d4', '#ec4899',
];

// ── Helpers ──
function formatDate(d) {
    const dt = new Date(d);
    return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function buildChartData(trends) {
    // trends = [{ name, date, qty }]
    const dateMap = {};
    const items = new Set();
    for (const t of trends) {
        const key = t.date;
        if (!dateMap[key]) dateMap[key] = { date: formatDate(key) };
        dateMap[key][t.name] = (dateMap[key][t.name] || 0) + t.qty;
        items.add(t.name);
    }
    return { data: Object.values(dateMap), items: [...items] };
}

export default function Dashboard() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => { loadDashboard(); }, []);

    const loadDashboard = async () => {
        try {
            const res = await api.getMyRestaurant();
            if (!res.data) return navigate('/owner/setup');
            const dashRes = await api.getDashboard(res.data.id);
            setData(dashRes.data);
        } catch (err) {
            console.error('Dashboard error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        setLoading(true);
        await loadDashboard();
        setRefreshing(false);
    };

    if (loading) {
        return (
            <OwnerLayout>
                <div className="page-container">
                    <div className="dash-kpi-row">
                        {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 130, borderRadius: 'var(--radius-lg)' }} />)}
                    </div>
                    <div className="grid-2" style={{ marginTop: 20 }}>
                        <div className="skeleton" style={{ height: 320, borderRadius: 'var(--radius-lg)' }} />
                        <div className="skeleton" style={{ height: 320, borderRadius: 'var(--radius-lg)' }} />
                    </div>
                </div>
            </OwnerLayout>
        );
    }

    // Chart data
    const weeklyChart = buildChartData(data?.weeklyItemTrends || []);
    const monthlyChart = buildChartData(data?.monthlyItemTrends || []);

    const wa = data?.weeklyAnalysis || {};
    const ma = data?.monthlyAnalysis || {};

    return (
        <OwnerLayout>
            <div className="page-container">

                {/* Welcome Header */}
                <div className="page-header animate-fade-in-up" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1>Welcome back, {user?.fullName?.split(' ')[0]}! 👋</h1>
                        <p>Here's today's performance for {data?.restaurant?.name || 'your restaurant'}</p>
                    </div>
                    <button className="btn btn-secondary" onClick={handleRefresh} disabled={refreshing}>
                        <HiOutlineRefresh size={16} className={refreshing ? 'animate-spin' : ''} />
                        {refreshing ? 'Refreshing...' : 'Refresh'}
                    </button>
                </div>

                {/* ═══════════ TOP KPI CARDS ═══════════ */}
                <div className="dash-kpi-row stagger-children animate-fade-in-up">

                    {/* Today's Orders */}
                    <div className="dash-kpi-card">
                        <div className="dash-kpi-icon" style={{ background: 'var(--accent-50)', color: 'var(--accent-600)' }}>
                            <HiOutlineShoppingBag size={22} />
                        </div>
                        <div className="dash-kpi-value">{data?.today?.orders || 0}</div>
                        <div className="dash-kpi-label">Orders Today</div>
                        <div className="dash-kpi-sub">
                            This week: {data?.thisWeek?.orders || 0} &nbsp;·&nbsp; This month: {data?.thisMonth?.orders || 0}
                        </div>
                    </div>

                    {/* Today's Revenue */}
                    <div className="dash-kpi-card">
                        <div className="dash-kpi-icon" style={{ background: 'var(--brand-50)', color: 'var(--brand-600)' }}>
                            <HiOutlineCurrencyRupee size={22} />
                        </div>
                        <div className="dash-kpi-value">₹{(data?.today?.revenue || 0).toLocaleString()}</div>
                        <div className="dash-kpi-label">Revenue Today</div>
                        <div className="dash-kpi-sub">
                            This week: ₹{(data?.thisWeek?.revenue || 0).toLocaleString()} &nbsp;·&nbsp; Month: ₹{(data?.thisMonth?.revenue || 0).toLocaleString()}
                        </div>
                    </div>

                    {/* Today's Profit */}
                    <div className="dash-kpi-card">
                        <div className="dash-kpi-icon" style={{ background: 'var(--success-50)', color: 'var(--success-600)' }}>
                            <HiOutlineTrendingUp size={22} />
                        </div>
                        <div className="dash-kpi-value" style={{ color: 'var(--success-600)' }}>₹{(data?.today?.profit || 0).toLocaleString()}</div>
                        <div className="dash-kpi-label">Profit Today</div>
                        <div className="dash-kpi-sub">
                            This week: ₹{(data?.thisWeek?.profit || 0).toLocaleString()} &nbsp;·&nbsp; Month: ₹{(data?.thisMonth?.profit || 0).toLocaleString()}
                        </div>
                    </div>

                </div>

                {/* ═══════════ TREND CHARTS ═══════════ */}
                <div className="grid-2 animate-fade-in-up" style={{ marginTop: 24 }}>

                    {/* Weekly Trend Chart */}
                    <div className="card">
                        <div className="card-header">
                            <div>
                                <div className="card-title"><HiOutlineChartBar size={16} style={{ marginRight: 6 }} /> Weekly Item Trend</div>
                                <div className="card-subtitle">Units sold per item — last 7 days</div>
                            </div>
                        </div>
                        {weeklyChart.data.length > 0 ? (
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={weeklyChart.data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#888' }} />
                                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#888' }} />
                                    <Tooltip contentStyle={{ borderRadius: 10, fontSize: 12, border: '1px solid #eee' }} />
                                    <Legend wrapperStyle={{ fontSize: 12 }} />
                                    {weeklyChart.items.map((name, i) => (
                                        <Bar key={name} dataKey={name} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[4, 4, 0, 0]} />
                                    ))}
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="empty-state" style={{ padding: 40 }}>
                                <div className="empty-state-icon">📊</div>
                                <p>No weekly sales data yet. Orders will appear here.</p>
                            </div>
                        )}
                    </div>

                    {/* Monthly Trend Chart */}
                    <div className="card">
                        <div className="card-header">
                            <div>
                                <div className="card-title"><HiOutlineChartBar size={16} style={{ marginRight: 6 }} /> Monthly Item Trend</div>
                                <div className="card-subtitle">Units sold per item — last 30 days</div>
                            </div>
                        </div>
                        {monthlyChart.data.length > 0 ? (
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={monthlyChart.data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#888' }} />
                                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#888' }} />
                                    <Tooltip contentStyle={{ borderRadius: 10, fontSize: 12, border: '1px solid #eee' }} />
                                    <Legend wrapperStyle={{ fontSize: 12 }} />
                                    {monthlyChart.items.map((name, i) => (
                                        <Bar key={name} dataKey={name} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[4, 4, 0, 0]} />
                                    ))}
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="empty-state" style={{ padding: 40 }}>
                                <div className="empty-state-icon">📈</div>
                                <p>No monthly sales data yet.</p>
                            </div>
                        )}
                    </div>

                </div>

                {/* ═══════════ WEEKLY & MONTHLY ANALYSIS ═══════════ */}
                <div className="grid-2 animate-fade-in-up" style={{ marginTop: 24 }}>

                    {/* Weekly Analysis */}
                    <div className="card">
                        <div className="card-header">
                            <div>
                                <div className="card-title">📅 Weekly Analysis</div>
                                <div className="card-subtitle">Key insights from the past 7 days</div>
                            </div>
                        </div>
                        <div className="dash-analysis-body">
                            {/* Summary Row */}
                            <div className="dash-analysis-summary">
                                <div>
                                    <div className="dash-analysis-num">{data?.thisWeek?.orders || 0}</div>
                                    <div className="dash-analysis-numlabel">Orders</div>
                                </div>
                                <div>
                                    <div className="dash-analysis-num">₹{(data?.thisWeek?.revenue || 0).toLocaleString()}</div>
                                    <div className="dash-analysis-numlabel">Revenue</div>
                                </div>
                                <div>
                                    <div className="dash-analysis-num" style={{ color: 'var(--success-600)' }}>₹{(data?.thisWeek?.profit || 0).toLocaleString()}</div>
                                    <div className="dash-analysis-numlabel">Profit</div>
                                </div>
                            </div>

                            {/* Top Items */}
                            {wa.topItems?.length > 0 && (
                                <div className="dash-analysis-section">
                                    <div className="dash-analysis-heading">🏆 Most Ordered</div>
                                    {wa.topItems.slice(0, 3).map((item, i) => (
                                        <div key={i} className="dash-analysis-item">
                                            <span className="dash-rank">{i + 1}</span>
                                            <span>{item.name}</span>
                                            <span className="dash-qty">{item.qty} sold</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Trending */}
                            {wa.increasing?.length > 0 && (
                                <div className="dash-analysis-section">
                                    <div className="dash-analysis-heading" style={{ color: 'var(--success-600)' }}><HiOutlineTrendingUp size={14} /> Demand Increasing</div>
                                    {wa.increasing.slice(0, 3).map((name, i) => (
                                        <div key={i} className="dash-analysis-tag up">{name}</div>
                                    ))}
                                </div>
                            )}

                            {wa.decreasing?.length > 0 && (
                                <div className="dash-analysis-section">
                                    <div className="dash-analysis-heading" style={{ color: 'var(--error-500)' }}><HiOutlineTrendingDown size={14} /> Demand Decreasing</div>
                                    {wa.decreasing.slice(0, 3).map((name, i) => (
                                        <div key={i} className="dash-analysis-tag down">{name}</div>
                                    ))}
                                </div>
                            )}

                            {(!wa.topItems?.length && !wa.increasing?.length) && (
                                <div className="rec-empty">Not enough weekly data yet</div>
                            )}
                        </div>
                    </div>

                    {/* Monthly Analysis */}
                    <div className="card">
                        <div className="card-header">
                            <div>
                                <div className="card-title">📊 Monthly Analysis</div>
                                <div className="card-subtitle">Performance overview — past 30 days</div>
                            </div>
                        </div>
                        <div className="dash-analysis-body">
                            <div className="dash-analysis-summary">
                                <div>
                                    <div className="dash-analysis-num">{data?.thisMonth?.orders || 0}</div>
                                    <div className="dash-analysis-numlabel">Orders</div>
                                </div>
                                <div>
                                    <div className="dash-analysis-num">₹{(data?.thisMonth?.revenue || 0).toLocaleString()}</div>
                                    <div className="dash-analysis-numlabel">Revenue</div>
                                </div>
                                <div>
                                    <div className="dash-analysis-num" style={{ color: 'var(--success-600)' }}>₹{(data?.thisMonth?.profit || 0).toLocaleString()}</div>
                                    <div className="dash-analysis-numlabel">Profit</div>
                                </div>
                            </div>

                            {ma.topItems?.length > 0 && (
                                <div className="dash-analysis-section">
                                    <div className="dash-analysis-heading">🏆 Top Performing</div>
                                    {ma.topItems.slice(0, 3).map((item, i) => (
                                        <div key={i} className="dash-analysis-item">
                                            <span className="dash-rank">{i + 1}</span>
                                            <span>{item.name}</span>
                                            <span className="dash-qty">{item.qty} sold</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {ma.increasing?.length > 0 && (
                                <div className="dash-analysis-section">
                                    <div className="dash-analysis-heading" style={{ color: 'var(--success-600)' }}><HiOutlineTrendingUp size={14} /> Growing Items</div>
                                    {ma.increasing.slice(0, 3).map((name, i) => (
                                        <div key={i} className="dash-analysis-tag up">{name}</div>
                                    ))}
                                </div>
                            )}

                            {ma.decreasing?.length > 0 && (
                                <div className="dash-analysis-section">
                                    <div className="dash-analysis-heading" style={{ color: 'var(--error-500)' }}><HiOutlineTrendingDown size={14} /> Declining Items</div>
                                    {ma.decreasing.slice(0, 3).map((name, i) => (
                                        <div key={i} className="dash-analysis-tag down">{name}</div>
                                    ))}
                                </div>
                            )}

                            {(!ma.topItems?.length && !ma.increasing?.length) && (
                                <div className="rec-empty">Not enough monthly data yet</div>
                            )}
                        </div>
                    </div>

                </div>

                {/* ═══════════ ALL-TIME REVENUE FOOTER ═══════════ */}
                <div className="card mt-6 animate-fade-in-up">
                    <div className="dash-alltime-footer">
                        <div>
                            <div className="dash-alltime-label">Total Lifetime Revenue</div>
                            <div className="dash-alltime-value">₹{(data?.restaurant?.totalRevenue || 0).toLocaleString()}</div>
                        </div>
                        <div>
                            <div className="dash-alltime-label">Total Lifetime Orders</div>
                            <div className="dash-alltime-value">{data?.restaurant?.totalOrders || 0}</div>
                        </div>
                        <div>
                            <div className="dash-alltime-label">Menu Items</div>
                            <div className="dash-alltime-value">{data?.menuItemCount || 0}</div>
                        </div>
                    </div>
                </div>

            </div>
        </OwnerLayout>
    );
}
