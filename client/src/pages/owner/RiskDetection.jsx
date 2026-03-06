import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import OwnerLayout from '../../components/layout/OwnerLayout';
import { api } from '../../lib/api';
import { HiOutlineExclamationCircle, HiOutlineShieldCheck, HiOutlineExclamation } from 'react-icons/hi';

function classifyMarginLevel(marginPct) {
    if (marginPct >= 50) return { label: 'High', color: 'var(--success-600)', bg: 'var(--success-50)' };
    if (marginPct >= 30) return { label: 'Medium', color: 'var(--warning-600)', bg: 'var(--warning-50)' };
    return { label: 'Low', color: 'var(--error-500)', bg: 'var(--error-50)' };
}

function classifyRisk(marginPct, ordersPerDay) {
    const lowMargin = marginPct < 30;
    const highMargin = marginPct >= 30;
    const lowOrders = ordersPerDay < 2;
    const highOrders = ordersPerDay >= 2;

    if (lowMargin && lowOrders) return { label: 'High', color: 'var(--error-500)', bg: 'var(--error-50, #fef2f2)', icon: '🔴' };
    if (highMargin && highOrders) return { label: 'Low', color: 'var(--success-600)', bg: 'var(--success-50)', icon: '🟢' };
    return { label: 'Medium', color: 'var(--warning-600)', bg: 'var(--warning-50)', icon: '🟡' };
}

export default function RiskDetection() {
    const navigate = useNavigate();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // all, high, medium, low

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const res = await api.getMyRestaurant();
            if (!res.data) return navigate('/owner/setup');

            const [marginsRes, trendsRes] = await Promise.all([
                api.getMargins(res.data.id),
                api.getSalesTrends(res.data.id, 30),
            ]);

            const margins = marginsRes.data || [];
            const dailyTrends = trendsRes.data?.dailyTrends || [];
            const numDays = Math.max(dailyTrends.length, 1);

            const riskData = margins.map(item => {
                const marginPct = parseFloat(item.marginPercentage);
                const ordersPerDay = item.totalSales / numDays;
                const marginLevel = classifyMarginLevel(marginPct);
                const risk = classifyRisk(marginPct, ordersPerDay);

                return {
                    ...item,
                    ordersPerDay: parseFloat(ordersPerDay.toFixed(2)),
                    marginLevel,
                    risk,
                };
            });

            // Sort: High Risk first
            riskData.sort((a, b) => {
                const riskOrder = { 'High': 0, 'Medium': 1, 'Low': 2 };
                return (riskOrder[a.risk.label] || 2) - (riskOrder[b.risk.label] || 2);
            });

            setItems(riskData);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const highRiskCount = items.filter(i => i.risk.label === 'High').length;
    const medRiskCount = items.filter(i => i.risk.label === 'Medium').length;
    const lowRiskCount = items.filter(i => i.risk.label === 'Low').length;

    const filtered = filter === 'all' ? items : items.filter(i => {
        if (filter === 'high') return i.risk.label === 'High';
        if (filter === 'medium') return i.risk.label === 'Medium';
        return i.risk.label === 'Low';
    });

    if (loading) {
        return (
            <OwnerLayout>
                <div className="page-container">
                    <div className="skeleton" style={{ height: 400, borderRadius: 'var(--radius-lg)' }} />
                </div>
            </OwnerLayout>
        );
    }

    return (
        <OwnerLayout>
            <div className="page-container">
                <div className="page-header">
                    <h1>⚠️ Risk Detection</h1>
                    <p>Identify menu items that are financially risky — low margin and low demand</p>
                </div>

                {/* Risk Summary */}
                <div className="stats-grid stagger-children">
                    <div className="stat-card animate-fade-in-up" onClick={() => setFilter('high')} style={{ cursor: 'pointer', border: filter === 'high' ? '2px solid var(--error-500)' : undefined }}>
                        <div className="stat-icon error"><HiOutlineExclamationCircle /></div>
                        <div>
                            <div className="stat-value">{highRiskCount}</div>
                            <div className="stat-label">High Risk</div>
                            <div className="stat-trend" style={{ color: 'var(--error-500)' }}>Low margin + Low demand</div>
                        </div>
                    </div>
                    <div className="stat-card animate-fade-in-up" onClick={() => setFilter('medium')} style={{ cursor: 'pointer', border: filter === 'medium' ? '2px solid var(--warning-600)' : undefined }}>
                        <div className="stat-icon warning"><HiOutlineExclamation /></div>
                        <div>
                            <div className="stat-value">{medRiskCount}</div>
                            <div className="stat-label">Medium Risk</div>
                            <div className="stat-trend" style={{ color: 'var(--warning-600)' }}>Needs attention</div>
                        </div>
                    </div>
                    <div className="stat-card animate-fade-in-up" onClick={() => setFilter('low')} style={{ cursor: 'pointer', border: filter === 'low' ? '2px solid var(--success-600)' : undefined }}>
                        <div className="stat-icon success"><HiOutlineShieldCheck /></div>
                        <div>
                            <div className="stat-value">{lowRiskCount}</div>
                            <div className="stat-label">Low Risk</div>
                            <div className="stat-trend" style={{ color: 'var(--success-600)' }}>Healthy performers</div>
                        </div>
                    </div>
                </div>

                {/* Filter Buttons */}
                <div className="flex gap-2 mb-6" style={{ flexWrap: 'wrap' }}>
                    <button className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter('all')}>
                        All ({items.length})
                    </button>
                    <button className={`btn btn-sm ${filter === 'high' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter('high')}>
                        🔴 High Risk ({highRiskCount})
                    </button>
                    <button className={`btn btn-sm ${filter === 'medium' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter('medium')}>
                        🟡 Medium Risk ({medRiskCount})
                    </button>
                    <button className={`btn btn-sm ${filter === 'low' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter('low')}>
                        🟢 Low Risk ({lowRiskCount})
                    </button>
                </div>

                {/* Risk Table */}
                {filtered.length > 0 ? (
                    <div className="card animate-fade-in-up">
                        <div style={{ overflowX: 'auto' }}>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Item</th>
                                        <th>Margin (₹)</th>
                                        <th>Margin Level</th>
                                        <th>Orders / Day</th>
                                        <th>Risk Level</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((item) => (
                                        <tr key={item.id}>
                                            <td>
                                                <div style={{ fontWeight: 600, color: 'var(--neutral-800)' }}>{item.name}</div>
                                                {item.category && <div style={{ fontSize: 12, color: 'var(--neutral-500)' }}>{item.category}</div>}
                                            </td>
                                            <td style={{ fontWeight: 600 }}>
                                                ₹{item.contributionMargin.toFixed(2)}
                                                <div style={{ fontSize: 11, color: 'var(--neutral-400)' }}>{item.marginPercentage}%</div>
                                            </td>
                                            <td>
                                                <span style={{
                                                    display: 'inline-block',
                                                    padding: '4px 12px',
                                                    borderRadius: 'var(--radius-full)',
                                                    fontSize: 12,
                                                    fontWeight: 700,
                                                    color: item.marginLevel.color,
                                                    background: item.marginLevel.bg,
                                                }}>
                                                    {item.marginLevel.label}
                                                </span>
                                            </td>
                                            <td style={{ fontWeight: 600, color: 'var(--neutral-700)' }}>{item.ordersPerDay}</td>
                                            <td>
                                                <span style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: 6,
                                                    padding: '6px 14px',
                                                    borderRadius: 'var(--radius-full)',
                                                    fontSize: 12,
                                                    fontWeight: 700,
                                                    color: item.risk.color,
                                                    background: item.risk.bg,
                                                }}>
                                                    {item.risk.icon} {item.risk.label}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="empty-state">
                        <div className="empty-state-icon">🛡️</div>
                        <h3>No items match this filter</h3>
                        <p>Try selecting a different risk filter above.</p>
                    </div>
                )}
            </div>
        </OwnerLayout>
    );
}
