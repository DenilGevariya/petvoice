import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import OwnerLayout from '../../components/layout/OwnerLayout';
import { api } from '../../lib/api';
import { HiOutlineSparkles, HiOutlineLightBulb, HiOutlineRefresh } from 'react-icons/hi';

function classifyVelocity(ordersPerDay) {
    if (ordersPerDay >= 5) return 'Fast';
    if (ordersPerDay >= 2) return 'Medium';
    return 'Slow';
}

function getMarginLevel(marginPct) {
    if (marginPct >= 50) return 'High';
    if (marginPct >= 30) return 'Medium';
    return 'Low';
}

function isWeekendApproaching() {
    const day = new Date().getDay();
    return day >= 4 || day === 0;
}

function getUpcomingFestival() {
    const now = new Date();
    const month = now.getMonth() + 1;
    const date = now.getDate();
    if (month === 1 && date >= 10 && date <= 20) return 'Makar Sankranti / Pongal';
    if (month === 3 && date >= 15 && date <= 31) return 'Holi';
    if (month === 4 && date >= 10 && date <= 18) return 'Baisakhi / Vishu';
    if (month === 8 && date >= 15 && date <= 31) return 'Independence Day / Raksha Bandhan';
    if (month === 9 && date >= 1 && date <= 15) return 'Ganesh Chaturthi';
    if (month === 10 && date >= 1 && date <= 25) return 'Navratri / Dussehra';
    if ((month === 10 && date >= 25) || (month === 11 && date <= 15)) return 'Diwali';
    if (month === 12 && date >= 20 && date <= 31) return 'Christmas / New Year';
    return null;
}

export default function Recommendations() {
    const navigate = useNavigate();
    const [recommendations, setRecommendations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [summary, setSummary] = useState(null);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const res = await api.getMyRestaurant();
            if (!res.data) return navigate('/owner/setup');
            const restaurantId = res.data.id;

            const [marginsRes, hiddenRes, trendsRes] = await Promise.all([
                api.getMargins(restaurantId),
                api.getHiddenStars(restaurantId),
                api.getSalesTrends(restaurantId, 30),
            ]);

            const margins = marginsRes.data || [];
            const dailyTrends = trendsRes.data?.dailyTrends || [];
            const itemHalfTrends = trendsRes.data?.itemHalfTrends || [];
            const numDays = Math.max(dailyTrends.length, 1);

            // Enrich every item with velocity, margin level, trend
            const items = margins.map(item => {
                const marginPct = parseFloat(item.marginPercentage);
                const ordersPerDay = numDays > 0 ? item.totalSales / numDays : 0;
                const halfTrend = itemHalfTrends.find(t => t.name === item.name);
                let trend = 'flat';
                if (halfTrend) {
                    if (halfTrend.secondHalf > halfTrend.firstHalf) trend = 'up';
                    else if (halfTrend.secondHalf < halfTrend.firstHalf) trend = 'down';
                }
                return {
                    ...item,
                    marginPct,
                    ordersPerDay: parseFloat(ordersPerDay.toFixed(2)),
                    velocity: classifyVelocity(ordersPerDay),
                    marginLevel: getMarginLevel(marginPct),
                    trend,
                };
            });

            const fastItems = items.filter(i => i.velocity === 'Fast' || i.velocity === 'Medium');
            const slowItems = items.filter(i => i.velocity === 'Slow');
            const highMarginItems = items.filter(i => i.marginLevel === 'High');
            const lowMarginItems = items.filter(i => i.marginLevel === 'Low');

            // ---- Build one unified list of recommendations ----
            const recs = [];

            items.forEach(item => {
                const isHigh = item.marginLevel === 'High';
                const isLow = item.marginLevel === 'Low';
                const isSlow = item.velocity === 'Slow';
                const isFastMed = item.velocity === 'Fast' || item.velocity === 'Medium';
                const isDeclining = item.trend === 'down';

                // High risk: low margin + slow + possibly declining → remove or rework
                if (isLow && isSlow) {
                    recs.push({
                        priority: 0,
                        icon: '🗑️',
                        title: `Remove "${item.name}" from your menu`,
                        description: `This item has low profit (₹${item.contributionMargin.toFixed(0)} margin) and very few orders (${item.ordersPerDay}/day). It's not contributing to your revenue. Consider removing it or replacing with something new.`,
                    });
                    return; // skip other rules for this item
                }

                // Declining demand + moderate/low margin → take action
                if (isDeclining && !isHigh) {
                    recs.push({
                        priority: 1,
                        icon: '�',
                        title: `"${item.name}" is losing customers`,
                        description: `Orders for this item are going down. Try improving the recipe, changing the presentation, or running a limited-time discount to bring attention back.`,
                    });
                }

                // Low margin + popular → bundle into combos
                if (isLow && isFastMed) {
                    recs.push({
                        priority: 2,
                        icon: '�',
                        title: `Create a combo with "${item.name}"`,
                        description: `This is a popular item but the profit is low (${item.marginPercentage}%). Add it to a combo with a higher-margin item to increase your overall earnings per order.`,
                    });
                }

                // High margin + popular → increase price
                if (isHigh && isFastMed) {
                    recs.push({
                        priority: 3,
                        icon: '💰',
                        title: `Increase the price of "${item.name}"`,
                        description: `Customers love this item and it already has great profit (${item.marginPercentage}%). A small price increase of ₹10–₹20 won't affect demand but will boost your revenue.`,
                    });
                }

                // High margin + slow → promote it
                if (isHigh && isSlow) {
                    recs.push({
                        priority: 4,
                        icon: '�',
                        title: `Promote "${item.name}" more`,
                        description: `This item earns you good profit (₹${item.contributionMargin.toFixed(0)} per sale) but not many people are ordering it. Place it at the top of your menu, add a photo, or feature it on social media.`,
                    });
                }
            });

            // Slow items → pair with fast items
            slowItems.forEach(slow => {
                const pair = fastItems.find(f => f.name !== slow.name);
                if (pair && !recs.find(r => r.title.includes(slow.name) && r.title.includes('combo'))) {
                    recs.push({
                        priority: 5,
                        icon: '�',
                        title: `Bundle "${slow.name}" with "${pair.name}"`,
                        description: `"${slow.name}" doesn't sell much on its own. Pair it with your popular "${pair.name}" as a combo deal — this can increase your average order value.`,
                    });
                }
            });

            // Weekend offers
            if (isWeekendApproaching()) {
                recs.push({
                    priority: 6,
                    icon: '🎉',
                    title: 'Create weekend combo deals',
                    description: 'The weekend is approaching — a great time to offer family packs, buy-one-get-one deals, or special combo offers to drive more orders.',
                });

                if (fastItems.length >= 2) {
                    recs.push({
                        priority: 6,
                        icon: '🍕',
                        title: `Weekend Special: "${fastItems[0].name}" + "${fastItems[1].name}"`,
                        description: `Both items are customer favorites. Offer them together at a 10–15% discount this weekend to attract more orders.`,
                    });
                }
            }

            // Festival offers
            const festival = getUpcomingFestival();
            if (festival) {
                recs.push({
                    priority: 6,
                    icon: '🪔',
                    title: `${festival} is coming — plan festive offers!`,
                    description: `Create special festive combos, limited-time menu items, or themed packaging for ${festival}. Promote on social media to attract more customers.`,
                });
            }

            // General strategic tip
            recs.push({
                priority: 7,
                icon: '📅',
                title: 'Run weekly specials to build habits',
                description: 'Schedule recurring promotions like "Taco Tuesday" or "Fry-day Deals". This builds repeat customer habits and creates predictable revenue bumps.',
            });

            // Sort by priority (most important first)
            recs.sort((a, b) => a.priority - b.priority);

            setRecommendations(recs);
            setSummary({
                totalItems: items.length,
                totalRecs: recs.length,
                highMargin: highMarginItems.length,
                lowMargin: lowMarginItems.length,
                fast: fastItems.length,
                slow: slowItems.length,
            });
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        setLoading(true);
        await loadData();
        setRefreshing(false);
    };

    if (loading) {
        return (
            <OwnerLayout>
                <div className="page-container">
                    <div className="card mb-6 skeleton" style={{ height: 100, borderRadius: 'var(--radius-lg)' }} />
                    {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 'var(--radius-lg)', marginTop: 12 }} />)}
                </div>
            </OwnerLayout>
        );
    }

    return (
        <OwnerLayout>
            <div className="page-container">
                {/* Header */}
                <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1>💡 Recommendations</h1>
                        <p>Actionable suggestions to improve your menu, pricing, and revenue</p>
                    </div>
                    <button className="btn btn-secondary" onClick={handleRefresh} disabled={refreshing}>
                        <HiOutlineRefresh size={16} className={refreshing ? 'animate-spin' : ''} />
                        {refreshing ? 'Refreshing...' : 'Refresh'}
                    </button>
                </div>

                {/* Summary Banner */}
                {summary && (
                    <div className="card mb-6 animate-fade-in-up" style={{ background: 'linear-gradient(135deg, var(--brand-50), var(--accent-50))', border: 'none' }}>
                        <div className="flex items-center gap-3 mb-4">
                            <HiOutlineSparkles size={20} style={{ color: 'var(--accent-600)' }} />
                            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--neutral-800)' }}>
                                {summary.totalRecs} recommendations for your {summary.totalItems} menu items
                            </h3>
                        </div>
                        <div className="stats-grid" style={{ marginBottom: 0 }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--neutral-900)' }}>{summary.totalItems}</div>
                                <div style={{ fontSize: 12, color: 'var(--neutral-500)' }}>Menu Items</div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--success-600)' }}>{summary.highMargin}</div>
                                <div style={{ fontSize: 12, color: 'var(--neutral-500)' }}>High Profit Items</div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--error-500)' }}>{summary.lowMargin}</div>
                                <div style={{ fontSize: 12, color: 'var(--neutral-500)' }}>Low Profit Items</div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--warning-600)' }}>{summary.slow}</div>
                                <div style={{ fontSize: 12, color: 'var(--neutral-500)' }}>Slow Sellers</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Unified Recommendation List */}
                {recommendations.length > 0 ? (
                    <div className="card animate-fade-in-up">
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {recommendations.map((rec, idx) => (
                                <div
                                    key={idx}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: 16,
                                        padding: '18px 4px',
                                        borderBottom: idx < recommendations.length - 1 ? '1px solid var(--neutral-100)' : 'none',
                                    }}
                                >
                                    <span style={{ fontSize: 24, flexShrink: 0, marginTop: 2 }}>{rec.icon}</span>
                                    <div style={{ flex: 1 }}>
                                        <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--neutral-800)', marginBottom: 4, lineHeight: 1.4 }}>
                                            {rec.title}
                                        </h4>
                                        <p style={{ fontSize: 13, color: 'var(--neutral-600)', lineHeight: 1.7, margin: 0 }}>
                                            {rec.description}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="empty-state">
                        <div className="empty-state-icon"><HiOutlineLightBulb size={48} /></div>
                        <h3>No recommendations yet</h3>
                        <p>Add menu items and start taking orders to receive actionable business suggestions.</p>
                    </div>
                )}
            </div>
        </OwnerLayout>
    );
}
