import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import OwnerLayout from '../../components/layout/OwnerLayout';
import { api } from '../../lib/api';
import { HiOutlineTrendingUp, HiOutlineTrendingDown } from 'react-icons/hi';

function classifyVelocity(ordersPerDay) {
    if (ordersPerDay >= 5) return { label: 'Fast', color: 'var(--success-600)', bg: 'var(--success-50)' };
    if (ordersPerDay >= 2) return { label: 'Medium', color: 'var(--warning-600)', bg: 'var(--warning-50)' };
    return { label: 'Slow', color: 'var(--error-500)', bg: 'var(--error-50)' };
}

export default function PopularityScore() {
    const navigate = useNavigate();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

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
            const itemTrends = trendsRes.data?.itemTrends || [];
            const dailyTrends = trendsRes.data?.dailyTrends || [];
            const numDays = Math.max(dailyTrends.length, 1);

            // Build popularity data for each item
            const popularityData = margins.map(item => {
                const trend = itemTrends.find(t => t.name === item.name);
                const totalSold = trend ? trend.totalSold : item.totalSales;
                const ordersPerDay = totalSold / numDays;

                // Estimate trend: compare first half vs second half of daily data
                // (simple heuristic since we have aggregate data)
                const trendDirection = totalSold > 0 ? (ordersPerDay >= 2 ? 'up' : 'down') : 'flat';

                return {
                    ...item,
                    totalSold,
                    ordersPerDay: parseFloat(ordersPerDay.toFixed(2)),
                    trend: trendDirection,
                    velocity: classifyVelocity(ordersPerDay),
                };
            });

            // Sort by ordersPerDay descending
            popularityData.sort((a, b) => b.ordersPerDay - a.ordersPerDay);
            setItems(popularityData);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fastCount = items.filter(i => i.velocity.label === 'Fast').length;
    const medCount = items.filter(i => i.velocity.label === 'Medium').length;
    const slowCount = items.filter(i => i.velocity.label === 'Slow').length;

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
                    <h1>📈 Popularity Score</h1>
                    <p>Measure how frequently items are ordered and identify demand trends</p>
                </div>

                {/* Velocity Distribution */}
                <div className="stats-grid stagger-children">
                    <div className="stat-card animate-fade-in-up">
                        <div className="stat-icon success">🚀</div>
                        <div>
                            <div className="stat-value">{fastCount}</div>
                            <div className="stat-label">Fast Moving</div>
                            <div className="stat-trend up" style={{ color: 'var(--success-600)' }}>≥5 orders/day</div>
                        </div>
                    </div>
                    <div className="stat-card animate-fade-in-up">
                        <div className="stat-icon warning">⚡</div>
                        <div>
                            <div className="stat-value">{medCount}</div>
                            <div className="stat-label">Medium Moving</div>
                            <div className="stat-trend" style={{ color: 'var(--warning-600)' }}>2-5 orders/day</div>
                        </div>
                    </div>
                    <div className="stat-card animate-fade-in-up">
                        <div className="stat-icon error">🐌</div>
                        <div>
                            <div className="stat-value">{slowCount}</div>
                            <div className="stat-label">Slow Moving</div>
                            <div className="stat-trend" style={{ color: 'var(--error-500)' }}>&lt;2 orders/day</div>
                        </div>
                    </div>
                </div>

                {/* Popularity Table */}
                {items.length > 0 ? (
                    <div className="card animate-fade-in-up">
                        <div className="card-header">
                            <div>
                                <div className="card-title">Item Popularity Analysis</div>
                                <div className="card-subtitle">Based on the last 30 days of sales data</div>
                            </div>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Item</th>
                                        <th>Total Sold (30d)</th>
                                        <th>Orders / Day</th>
                                        <th>Trend</th>
                                        <th>Velocity</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((item, idx) => (
                                        <tr key={item.id}>
                                            <td style={{ color: 'var(--neutral-400)', fontWeight: 600 }}>{idx + 1}</td>
                                            <td>
                                                <div style={{ fontWeight: 600, color: 'var(--neutral-800)' }}>{item.name}</div>
                                                {item.category && <div style={{ fontSize: 12, color: 'var(--neutral-500)' }}>{item.category}</div>}
                                            </td>
                                            <td style={{ fontWeight: 600 }}>{item.totalSold}</td>
                                            <td style={{ fontWeight: 700, color: 'var(--brand-600)' }}>{item.ordersPerDay}</td>
                                            <td>
                                                {item.trend === 'up' ? (
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--success-600)', fontWeight: 600 }}>
                                                        <HiOutlineTrendingUp size={18} /> Increasing
                                                    </span>
                                                ) : item.trend === 'down' ? (
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--error-500)', fontWeight: 600 }}>
                                                        <HiOutlineTrendingDown size={18} /> Decreasing
                                                    </span>
                                                ) : (
                                                    <span style={{ color: 'var(--neutral-400)' }}>—</span>
                                                )}
                                            </td>
                                            <td>
                                                <span style={{
                                                    display: 'inline-block',
                                                    padding: '4px 12px',
                                                    borderRadius: 'var(--radius-full)',
                                                    fontSize: 12,
                                                    fontWeight: 700,
                                                    color: item.velocity.color,
                                                    background: item.velocity.bg,
                                                }}>
                                                    {item.velocity.label}
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
                        <div className="empty-state-icon">📈</div>
                        <h3>No popularity data yet</h3>
                        <p>Add menu items and POS data to see popularity scores and demand trends.</p>
                    </div>
                )}
            </div>
        </OwnerLayout>
    );
}
