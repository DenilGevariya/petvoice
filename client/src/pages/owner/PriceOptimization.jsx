import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import OwnerLayout from '../../components/layout/OwnerLayout';
import { api } from '../../lib/api';
import { HiOutlineSparkles, HiOutlineTrendingUp, HiOutlineTrendingDown, HiOutlineSpeakerphone } from 'react-icons/hi';

const actionIcons = {
    increase: <HiOutlineTrendingUp style={{ color: 'var(--success-500)' }} />,
    decrease: <HiOutlineTrendingDown style={{ color: 'var(--error-500)' }} />,
    promote: <HiOutlineSpeakerphone style={{ color: 'var(--accent-500)' }} />,
    keep: <span>✓</span>,
};

const actionColors = {
    increase: 'success', decrease: 'error', promote: 'info', keep: 'neutral'
};

export default function PriceOptimization() {
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [comboData, setComboData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('price');

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const res = await api.getMyRestaurant();
            if (!res.data) return navigate('/owner/setup');

            const [priceRes, comboRes] = await Promise.all([
                api.getPriceOptimization(res.data.id),
                api.getComboSuggestions(res.data.id),
            ]);

            setData(priceRes.data);
            setComboData(comboRes.data);
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
                    <div className="skeleton" style={{ height: 400, borderRadius: 'var(--radius-lg)' }} />
                </div>
            </OwnerLayout>
        );
    }

    return (
        <OwnerLayout>
            <div className="page-container">
                <div className="page-header">
                    <h1>💰 Price Optimizer & Combo Engine</h1>
                    <p>AI-powered pricing suggestions and combo recommendations to maximize revenue</p>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-6">
                    <button className={`btn btn-sm ${activeTab === 'price' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('price')}>
                        <HiOutlineTrendingUp size={16} /> Price Optimization
                    </button>
                    <button className={`btn btn-sm ${activeTab === 'combos' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('combos')}>
                        <HiOutlineSparkles size={16} /> Combo Suggestions
                    </button>
                </div>

                {activeTab === 'price' && (
                    <div className="animate-fade-in-up">
                        {data?.aiAnalysis && data.aiAnalysis.length > 0 ? (
                            <div className="stagger-children" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                {data.aiAnalysis.map((suggestion, idx) => (
                                    <div key={idx} className="card" style={{ borderLeft: `4px solid var(--${actionColors[suggestion.action]}-500, var(--neutral-300))` }}>
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <span style={{ fontSize: 24 }}>{actionIcons[suggestion.action]}</span>
                                                <div>
                                                    <h3 style={{ fontSize: 16, fontWeight: 700 }}>{suggestion.itemName}</h3>
                                                    <span className={`badge badge-${actionColors[suggestion.action]}`} style={{ textTransform: 'capitalize' }}>
                                                        {suggestion.action} price
                                                    </span>
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontSize: 13, color: 'var(--neutral-500)' }}>Current → Suggested</div>
                                                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-display)' }}>
                                                    <span style={{ color: 'var(--neutral-400)', textDecoration: suggestion.action !== 'keep' ? 'line-through' : 'none' }}>
                                                        ₹{suggestion.currentPrice}
                                                    </span>
                                                    {suggestion.action !== 'keep' && (
                                                        <span style={{ color: 'var(--brand-600)', marginLeft: 8 }}>₹{suggestion.suggestedPrice}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <p style={{ fontSize: 13, color: 'var(--neutral-600)', lineHeight: 1.6 }}>{suggestion.reasoning}</p>
                                        {suggestion.expectedImpact && (
                                            <div style={{ marginTop: 8, padding: '8px 12px', background: 'var(--neutral-50)', borderRadius: 'var(--radius-sm)', fontSize: 12, color: 'var(--neutral-600)' }}>
                                                <strong>Expected Impact:</strong> {suggestion.expectedImpact}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="empty-state">
                                <div className="empty-state-icon">💡</div>
                                <h3>No price suggestions yet</h3>
                                <p>Add menu items and get some sales data for AI to generate pricing recommendations.</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'combos' && (
                    <div className="animate-fade-in-up">
                        {/* Co-purchase patterns */}
                        {comboData?.coPurchasePatterns?.length > 0 && (
                            <div className="card mb-6">
                                <div className="card-header">
                                    <div>
                                        <div className="card-title">🛒 Co-Purchase Patterns</div>
                                        <div className="card-subtitle">Items customers frequently buy together</div>
                                    </div>
                                </div>
                                {comboData.coPurchasePatterns.map((pattern, idx) => (
                                    <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: idx < comboData.coPurchasePatterns.length - 1 ? '1px solid var(--neutral-100)' : 'none' }}>
                                        <div className="flex items-center gap-2">
                                            <span className="badge badge-info">{pattern.items[0]}</span>
                                            <span style={{ color: 'var(--neutral-400)' }}>+</span>
                                            <span className="badge badge-info">{pattern.items[1]}</span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span style={{ fontSize: 13, color: 'var(--neutral-500)' }}>{pattern.frequency} times</span>
                                            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--brand-600)' }}>₹{pattern.totalPrice?.toFixed(2)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* AI Combo Suggestions */}
                        {comboData?.aiComboSuggestions && comboData.aiComboSuggestions.length > 0 ? (
                            <div className="stagger-children" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <h2 style={{ fontSize: 18, fontWeight: 700 }}>
                                    <HiOutlineSparkles style={{ color: 'var(--accent-500)', verticalAlign: 'middle' }} /> AI-Suggested Combos
                                </h2>
                                {comboData.aiComboSuggestions.map((combo, idx) => (
                                    <div key={idx} className="card animate-fade-in-up" style={{ borderLeft: '4px solid var(--accent-500)' }}>
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 style={{ fontSize: 16, fontWeight: 700 }}>{combo.comboName}</h3>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontSize: 13, color: 'var(--neutral-400)', textDecoration: 'line-through' }}>₹{combo.originalPrice}</div>
                                                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--brand-600)', fontFamily: 'var(--font-display)' }}>₹{combo.suggestedPrice}</div>
                                                <span className="badge badge-success">{combo.discount} OFF</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 mb-4" style={{ flexWrap: 'wrap' }}>
                                            {combo.items?.map((item, i) => (
                                                <span key={i} className="badge badge-neutral" style={{ fontSize: 13 }}>{item}</span>
                                            ))}
                                        </div>
                                        <p style={{ fontSize: 13, color: 'var(--neutral-600)' }}>{combo.reasoning}</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="empty-state">
                                <div className="empty-state-icon">🍔</div>
                                <h3>No combo suggestions yet</h3>
                                <p>As customers place orders, the AI will detect patterns and suggest lucrative combos.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </OwnerLayout>
    );
}
