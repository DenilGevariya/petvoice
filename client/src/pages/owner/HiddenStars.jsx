import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import OwnerLayout from '../../components/layout/OwnerLayout';
import { api } from '../../lib/api';
import { HiOutlineSparkles, HiOutlineLightBulb, HiOutlineTrendingUp } from 'react-icons/hi';

export default function HiddenStars() {
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const res = await api.getMyRestaurant();
            if (!res.data) return navigate('/owner/setup');
            const result = await api.getHiddenStars(res.data.id);
            setData(result.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <OwnerLayout>
                <div className="page-container">
                    <div className="skeleton" style={{ height: 300, borderRadius: 'var(--radius-lg)' }} />
                </div>
            </OwnerLayout>
        );
    }

    return (
        <OwnerLayout>
            <div className="page-container">
                <div className="page-header">
                    <h1>🌟 Hidden Stars Detection</h1>
                    <p>Discover high-margin items that are under-promoted and have untapped profit potential</p>
                </div>

                {/* Overview */}
                <div className="stats-grid">
                    <div className="stat-card">
                        <div className="stat-icon brand"><HiOutlineSparkles /></div>
                        <div>
                            <div className="stat-value">{data?.hiddenStars?.length || 0}</div>
                            <div className="stat-label">Hidden Stars Found</div>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon accent"><HiOutlineTrendingUp /></div>
                        <div>
                            <div className="stat-value">{data?.avgSales || 0}</div>
                            <div className="stat-label">Avg Sales / Item</div>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon success"><HiOutlineLightBulb /></div>
                        <div>
                            <div className="stat-value">₹{data?.avgMargin || 0}</div>
                            <div className="stat-label">Avg Margin / Item</div>
                        </div>
                    </div>
                </div>

                {/* Hidden Stars List */}
                {data?.hiddenStars?.length > 0 ? (
                    <div className="stagger-children" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {data.hiddenStars.map((item, idx) => (
                            <div key={idx} className="card animate-fade-in-up" style={{ borderLeft: '4px solid var(--brand-500)' }}>
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h3 style={{ fontSize: 18, fontWeight: 700 }}>{item.name}</h3>
                                        <p className="text-sm text-muted">{item.potential}</p>
                                    </div>
                                    <div className="badge badge-star" style={{ fontSize: 14, padding: '8px 16px' }}>
                                        ⭐ Hidden Star
                                    </div>
                                </div>

                                <div className="stats-grid" style={{ marginBottom: 16 }}>
                                    <div style={{ textAlign: 'center', padding: 12, background: 'var(--neutral-50)', borderRadius: 'var(--radius-sm)' }}>
                                        <div style={{ fontSize: 12, color: 'var(--neutral-500)', marginBottom: 4 }}>Price</div>
                                        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--neutral-900)' }}>₹{item.price}</div>
                                    </div>
                                    <div style={{ textAlign: 'center', padding: 12, background: 'var(--success-50)', borderRadius: 'var(--radius-sm)' }}>
                                        <div style={{ fontSize: 12, color: 'var(--neutral-500)', marginBottom: 4 }}>Margin</div>
                                        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--success-600)' }}>₹{item.margin?.toFixed(2)}</div>
                                    </div>
                                    <div style={{ textAlign: 'center', padding: 12, background: 'var(--brand-50)', borderRadius: 'var(--radius-sm)' }}>
                                        <div style={{ fontSize: 12, color: 'var(--neutral-500)', marginBottom: 4 }}>Margin %</div>
                                        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--brand-600)' }}>{item.marginPercentage}%</div>
                                    </div>
                                    <div style={{ textAlign: 'center', padding: 12, background: 'var(--error-50)', borderRadius: 'var(--radius-sm)' }}>
                                        <div style={{ fontSize: 12, color: 'var(--neutral-500)', marginBottom: 4 }}>Sales</div>
                                        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--error-500)' }}>{item.totalSales}</div>
                                    </div>
                                </div>

                                {/* AI Recommendations */}
                                {/* {data.aiRecommendations && data.aiRecommendations[idx] && (
                                    <div style={{ background: 'linear-gradient(135deg, var(--accent-50), var(--brand-50))', borderRadius: 'var(--radius-md)', padding: 16 }}>
                                        <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-700)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <HiOutlineSparkles /> AI Recommendations
                                        </h4>
                                        <p style={{ fontSize: 13, color: 'var(--neutral-700)', marginBottom: 8 }}>
                                            {data.aiRecommendations[idx].analysis}
                                        </p>
                                        {data.aiRecommendations[idx].strategies && (
                                            <div>
                                                <strong style={{ fontSize: 12, color: 'var(--neutral-600)' }}>Strategies:</strong>
                                                <ul style={{ marginTop: 4, paddingLeft: 20 }}>
                                                    {data.aiRecommendations[idx].strategies.map((s, i) => (
                                                        <li key={i} style={{ fontSize: 13, color: 'var(--neutral-600)', marginBottom: 4 }}>{s}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        {data.aiRecommendations[idx].pairWith && (
                                            <div style={{ marginTop: 8 }}>
                                                <strong style={{ fontSize: 12, color: 'var(--neutral-600)' }}>Pair with:</strong>
                                                <div className="flex gap-2 mt-2">
                                                    {data.aiRecommendations[idx].pairWith.map((p, i) => (
                                                        <span key={i} className="badge badge-info">{p}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )} */}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="empty-state">
                        <div className="empty-state-icon">🔍</div>
                        <h3>No hidden stars detected</h3>
                        <p>Add menu items and get some sales data for the AI to analyze and detect hidden opportunities.</p>
                    </div>
                )}
            </div>
        </OwnerLayout>
    );
}
