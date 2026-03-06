import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import OwnerLayout from '../../components/layout/OwnerLayout';
import { api } from '../../lib/api';
import { HiOutlineSparkles, HiOutlineLightBulb, HiOutlineRefresh } from 'react-icons/hi';

export default function Recommendations() {
    const navigate = useNavigate();
    const [recommendations, setRecommendations] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [menuSummary, setMenuSummary] = useState(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const res = await api.getMyRestaurant();
            if (!res.data) return navigate('/owner/setup');

            // Get all the intelligence data in parallel
            const [marginsRes, hiddenRes, classRes, trendsRes] = await Promise.all([
                api.getMargins(res.data.id),
                api.getHiddenStars(res.data.id),
                api.getClassification(res.data.id),
                api.getSalesTrends(res.data.id, 30),
            ]);

            const margins = marginsRes.data || [];
            const hiddenStars = hiddenRes.data?.hiddenStars || [];
            const classification = classRes.data || {};
            const trends = trendsRes.data || {};

            // Build a menu summary for AI
            const summary = {
                totalItems: margins.length,
                avgMargin: margins.length > 0 ? (margins.reduce((s, m) => s + m.contributionMargin, 0) / margins.length).toFixed(2) : 0,
                stars: classification.stars?.length || 0,
                workhorses: classification.workhorses?.length || 0,
                puzzles: classification.puzzles?.length || 0,
                dogs: classification.dogs?.length || 0,
                hiddenStars: hiddenStars.length,
                topItems: margins.slice(0, 5).map(m => m.name),
                lowMarginItems: margins.filter(m => parseFloat(m.marginPercentage) < 25).map(m => m.name),
                highMarginLowSales: hiddenStars.map(h => h.name),
            };
            setMenuSummary(summary);

            // Generate recommendations (use AI endpoint if no cached recommendations)
            await generateRecommendations(res.data.id, margins, hiddenStars, classification, trends);

        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const generateRecommendations = async (restaurantId, margins, hiddenStars, classification, trends) => {
        // Build local rule-based recommendations
        const recs = [];

        // 1. Promote hidden stars
        if (hiddenStars.length > 0) {
            hiddenStars.forEach(item => {
                recs.push({
                    type: 'promote',
                    priority: 'high',
                    icon: '🌟',
                    title: `Promote "${item.name}"`,
                    description: `This item has a margin of ₹${item.margin?.toFixed(2)} (${item.marginPercentage}%) but only ${item.totalSales} sales. Increase visibility on the menu, create social media promotions, or pair it with popular items.`,
                    category: 'Hidden Star',
                });
            });
        }

        // 2. Remove or reprice dogs
        const dogs = classification.dogs || [];
        dogs.forEach(item => {
            const margin = item.margin;
            if (margin < 20) {
                recs.push({
                    type: 'remove',
                    priority: 'high',
                    icon: '🗑️',
                    title: `Consider removing "${item.name}"`,
                    description: `Low sales (${item.totalSales}) and low margin (₹${margin.toFixed(2)}). This item may be taking up menu space without contributing to profitability.`,
                    category: 'Risk Item',
                });
            } else {
                recs.push({
                    type: 'reprice',
                    priority: 'medium',
                    icon: '💰',
                    title: `Reprice "${item.name}"`,
                    description: `Low sales (${item.totalSales}) but moderate margin. Consider a price decrease to boost volume, or bundle it with popular items.`,
                    category: 'Price Adjustment',
                });
            }
        });

        // 3. Create combos from workhorses
        const workhorses = classification.workhorses || [];
        if (workhorses.length >= 2) {
            recs.push({
                type: 'combo',
                priority: 'medium',
                icon: '🍔',
                title: 'Create combo offers from Workhorses',
                description: `Items like ${workhorses.slice(0, 3).map(w => `"${w.name}"`).join(', ')} are popular but low margin. Bundle them with high-margin items to improve overall profitability.`,
                category: 'Combo Opportunity',
            });
        }

        // 4. Adjust menu layout for Stars
        const stars = classification.stars || [];
        if (stars.length > 0) {
            recs.push({
                type: 'layout',
                priority: 'low',
                icon: '⭐',
                title: 'Highlight Star items on your menu',
                description: `Items like ${stars.slice(0, 3).map(s => `"${s.name}"`).join(', ')} are your top performers. Place them prominently at the top of each category on your menu.`,
                category: 'Menu Layout',
            });
        }

        // 5. Margin improvement
        const lowMargin = margins.filter(m => parseFloat(m.marginPercentage) < 25);
        if (lowMargin.length > 0) {
            recs.push({
                type: 'margin',
                priority: 'medium',
                icon: '📉',
                title: `${lowMargin.length} items have margins below 25%`,
                description: `Items like ${lowMargin.slice(0, 3).map(m => `"${m.name}"`).join(', ')} have low contribution percentages. Negotiate better ingredient costs or increase prices slightly.`,
                category: 'Margin Improvement',
            });
        }

        // Sort by priority
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        recs.sort((a, b) => (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2));

        setRecommendations(recs);
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    const priorityColors = {
        high: { color: 'var(--error-500)', bg: 'var(--error-50)', label: 'High Priority' },
        medium: { color: 'var(--warning-600)', bg: 'var(--warning-50)', label: 'Medium Priority' },
        low: { color: 'var(--success-600)', bg: 'var(--success-50)', label: 'Low Priority' },
    };

    if (loading) {
        return (
            <OwnerLayout>
                <div className="page-container">
                    <div className="stats-grid">
                        {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 100, borderRadius: 'var(--radius-lg)' }} />)}
                    </div>
                    <div className="skeleton" style={{ height: 400, borderRadius: 'var(--radius-lg)', marginTop: 24 }} />
                </div>
            </OwnerLayout>
        );
    }

    return (
        <OwnerLayout>
            <div className="page-container">
                <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1>💡 Recommendations</h1>
                        <p>AI-driven business insights based on sales velocity, margin analysis, and order trends</p>
                    </div>
                    <button className="btn btn-secondary" onClick={handleRefresh} disabled={refreshing}>
                        <HiOutlineRefresh size={16} className={refreshing ? 'animate-spin' : ''} />
                        {refreshing ? 'Refreshing...' : 'Refresh'}
                    </button>
                </div>

                {/* Summary */}
                {menuSummary && (
                    <div className="card mb-6 animate-fade-in-up" style={{ background: 'linear-gradient(135deg, var(--brand-50), var(--accent-50))', border: 'none' }}>
                        <div className="flex items-center gap-3 mb-4">
                            <HiOutlineSparkles size={20} style={{ color: 'var(--accent-600)' }} />
                            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--neutral-800)' }}>Menu Intelligence Summary</h3>
                        </div>
                        <div className="stats-grid" style={{ marginBottom: 0 }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--neutral-900)' }}>{menuSummary.totalItems}</div>
                                <div style={{ fontSize: 12, color: 'var(--neutral-500)' }}>Total Items</div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--success-600)' }}>⭐ {menuSummary.stars}</div>
                                <div style={{ fontSize: 12, color: 'var(--neutral-500)' }}>Stars</div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--brand-600)' }}>🌟 {menuSummary.hiddenStars}</div>
                                <div style={{ fontSize: 12, color: 'var(--neutral-500)' }}>Hidden Stars</div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--error-500)' }}>🐶 {menuSummary.dogs}</div>
                                <div style={{ fontSize: 12, color: 'var(--neutral-500)' }}>Risk (Dogs)</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Recommendations List */}
                {recommendations && recommendations.length > 0 ? (
                    <div className="stagger-children" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {recommendations.map((rec, idx) => {
                            const prio = priorityColors[rec.priority] || priorityColors.low;
                            return (
                                <div key={idx} className="card animate-fade-in-up" style={{ borderLeft: `4px solid ${prio.color}` }}>
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <span style={{ fontSize: 24 }}>{rec.icon}</span>
                                            <div>
                                                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--neutral-800)' }}>{rec.title}</h3>
                                                <span className="badge badge-neutral" style={{ fontSize: 11 }}>{rec.category}</span>
                                            </div>
                                        </div>
                                        <span style={{
                                            display: 'inline-block',
                                            padding: '4px 12px',
                                            borderRadius: 'var(--radius-full)',
                                            fontSize: 11,
                                            fontWeight: 700,
                                            color: prio.color,
                                            background: prio.bg,
                                        }}>
                                            {prio.label}
                                        </span>
                                    </div>
                                    <p style={{ fontSize: 13, color: 'var(--neutral-600)', lineHeight: 1.7 }}>{rec.description}</p>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="empty-state">
                        <div className="empty-state-icon"><HiOutlineLightBulb size={48} /></div>
                        <h3>No recommendations available</h3>
                        <p>Add menu items and POS data so the AI can generate actionable business insights.</p>
                    </div>
                )}
            </div>
        </OwnerLayout>
    );
}
