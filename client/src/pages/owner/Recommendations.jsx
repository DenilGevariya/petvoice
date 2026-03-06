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

// Check if this weekend is approaching (today is Thu/Fri or it's Sat/Sun)
function isWeekendApproaching() {
    const day = new Date().getDay(); // 0=Sun, 6=Sat
    return day >= 4 || day === 0; // Thu, Fri, Sat, Sun
}

// Simple festival detection (Indian festivals)
function getUpcomingFestival() {
    const now = new Date();
    const month = now.getMonth() + 1;
    const date = now.getDate();

    // Approximate Indian festival windows
    if (month === 1 && date >= 10 && date <= 20) return 'Makar Sankranti / Pongal';
    if (month === 3 && date >= 15 && date <= 31) return 'Holi';
    if (month === 4 && date >= 10 && date <= 18) return 'Baisakhi / Vishu';
    if (month === 8 && date >= 15 && date <= 31) return 'Independence Day / Raksha Bandhan';
    if (month === 9 && date >= 1 && date <= 15) return 'Ganesh Chaturthi';
    if (month === 10 && date >= 1 && date <= 25) return 'Navratri / Dussehra';
    if (month === 10 && date >= 25 || (month === 11 && date <= 15)) return 'Diwali';
    if (month === 12 && date >= 20 && date <= 31) return 'Christmas / New Year';
    return null;
}

export default function Recommendations() {
    const navigate = useNavigate();
    const [sections, setSections] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

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
            const hiddenStarsData = hiddenRes.data || {};
            const dailyTrends = trendsRes.data?.dailyTrends || [];
            const itemHalfTrends = trendsRes.data?.itemHalfTrends || [];
            const numDays = Math.max(dailyTrends.length, 1);

            // Classify all items
            const enrichedItems = margins.map(item => {
                const marginPct = parseFloat(item.marginPercentage);
                const ordersPerDay = numDays > 0 ? item.totalSales / numDays : 0;
                const halfTrend = itemHalfTrends.find(t => t.name === item.name);
                let trendDirection = 'flat';
                if (halfTrend) {
                    if (halfTrend.secondHalf > halfTrend.firstHalf) trendDirection = 'up';
                    else if (halfTrend.secondHalf < halfTrend.firstHalf) trendDirection = 'down';
                }
                return {
                    ...item,
                    marginPct,
                    ordersPerDay: parseFloat(ordersPerDay.toFixed(2)),
                    velocity: classifyVelocity(ordersPerDay),
                    marginLevel: getMarginLevel(marginPct),
                    trend: trendDirection,
                };
            });

            // -------- SECTION A: Contribution Margin Recommendations --------
            const marginRecs = [];
            const highMarginItems = enrichedItems.filter(i => i.marginLevel === 'High');
            const lowMarginItems = enrichedItems.filter(i => i.marginLevel === 'Low');

            highMarginItems.forEach(item => {
                marginRecs.push({
                    icon: '💎',
                    title: `Increase price of "${item.name}"`,
                    description: `This item has a high margin of ${item.marginPercentage}% (₹${item.contributionMargin.toFixed(2)}). Consider increasing the price by ₹10–₹20 to maximize revenue.`,
                    badge: 'High Margin',
                    badgeColor: 'success',
                });
            });

            lowMarginItems.forEach(item => {
                marginRecs.push({
                    icon: '📦',
                    title: `Bundle "${item.name}" into a combo`,
                    description: `This item has a low margin of ${item.marginPercentage}% (₹${item.contributionMargin.toFixed(2)}). Consider adding it to a combo offer, bundling with popular items, or offering limited-time discounts.`,
                    badge: 'Low Margin',
                    badgeColor: 'error',
                });
            });

            // -------- SECTION B: Popularity Score Recommendations --------
            const popularityRecs = [];
            const slowItems = enrichedItems.filter(i => i.velocity === 'Slow');
            const fastItems = enrichedItems.filter(i => i.velocity === 'Fast' || i.velocity === 'Medium');

            slowItems.forEach(slow => {
                const pairWith = fastItems.length > 0 ? fastItems[Math.floor(Math.random() * fastItems.length)] : null;
                popularityRecs.push({
                    icon: '🐌',
                    title: `Boost sales of "${slow.name}"`,
                    description: pairWith
                        ? `"${slow.name}" is slow moving (${slow.ordersPerDay} orders/day). Bundle it with "${pairWith.name}" (${pairWith.velocity} mover) to increase average order value.`
                        : `"${slow.name}" is slow moving (${slow.ordersPerDay} orders/day). Consider promoting it with special offers or placing it prominently on the menu.`,
                    badge: 'Slow Moving',
                    badgeColor: 'warning',
                });
            });

            // -------- SECTION C: Hidden Stars Recommendations --------
            const hiddenRecs = [];
            enrichedItems.forEach(item => {
                const isHighMargin = item.marginLevel === 'High';
                const isMedMargin = item.marginLevel === 'Medium';
                const isLowMargin = item.marginLevel === 'Low';
                const isSlowVelocity = item.velocity === 'Slow';
                const isMedFastVelocity = item.velocity === 'Medium' || item.velocity === 'Fast';

                if (isLowMargin && isSlowVelocity) {
                    hiddenRecs.push({
                        icon: '🗑️',
                        title: `Remove "${item.name}" from menu`,
                        description: `Low margin (${item.marginPercentage}%) and low demand (${item.ordersPerDay} orders/day). This item is not contributing to revenue.`,
                        badge: 'Remove',
                        badgeColor: 'error',
                    });
                } else if (isLowMargin && isMedFastVelocity) {
                    hiddenRecs.push({
                        icon: '📣',
                        title: `Promote "${item.name}" with a combo`,
                        description: `"${item.name}" sells frequently (${item.ordersPerDay} orders/day) but has low margin (${item.marginPercentage}%). Promote it with a combo to improve value per transaction.`,
                        badge: 'Promote',
                        badgeColor: 'info',
                    });
                } else if (isHighMargin && isMedFastVelocity) {
                    hiddenRecs.push({
                        icon: '💰',
                        title: `Increase price of "${item.name}"`,
                        description: `Strong demand (${item.ordersPerDay} orders/day) and high margin (${item.marginPercentage}%). Consider a small price increase of ₹10–₹15 to capitalize on demand.`,
                        badge: 'Price Up',
                        badgeColor: 'success',
                    });
                }
            });

            // -------- SECTION D: Risk Detection Recommendations --------
            const riskRecs = [];
            enrichedItems.forEach(item => {
                const isRisky = item.marginLevel === 'Low' && item.velocity === 'Slow';
                const isDeclining = item.trend === 'down';

                if (isRisky) {
                    riskRecs.push({
                        icon: '🔴',
                        title: `High risk: "${item.name}"`,
                        description: `Low margin (${item.marginPercentage}%), low demand (${item.ordersPerDay} orders/day)${isDeclining ? ', and declining trend' : ''}. Consider: improving the recipe/presentation, reducing ingredient cost, or removing from menu.`,
                        badge: 'High Risk',
                        badgeColor: 'error',
                    });
                } else if (isDeclining && item.marginPct < 40) {
                    riskRecs.push({
                        icon: '🟡',
                        title: `Declining demand: "${item.name}"`,
                        description: `"${item.name}" is showing decreasing demand with moderate margin (${item.marginPercentage}%). Monitor closely and consider promotional strategies.`,
                        badge: 'Watch',
                        badgeColor: 'warning',
                    });
                }
            });

            // -------- SECTION E: Event / Festival / Weekend Offers --------
            const eventRecs = [];
            if (isWeekendApproaching()) {
                eventRecs.push({
                    icon: '🎉',
                    title: 'Weekend is approaching!',
                    description: 'Create special weekend combo deals to increase order value. Consider offering family packs or buy-one-get-one deals on popular items.',
                    badge: 'Weekend',
                    badgeColor: 'info',
                });

                // If there are fast-moving items, suggest specific combos
                if (fastItems.length >= 2) {
                    eventRecs.push({
                        icon: '🍕',
                        title: `Weekend Combo: "${fastItems[0].name}" + "${fastItems[1].name}"`,
                        description: `Both are popular items. Offer them as a weekend bundle at a 10-15% discount to drive volume.`,
                        badge: 'Combo',
                        badgeColor: 'success',
                    });
                }
            }

            const festival = getUpcomingFestival();
            if (festival) {
                eventRecs.push({
                    icon: '🪔',
                    title: `${festival} is approaching!`,
                    description: `Create special festive combos and limited-time menu items. Consider themed packaging and social media promotions for ${festival}.`,
                    badge: 'Festival',
                    badgeColor: 'info',
                });
            }

            // Always show a general seasonal tip
            eventRecs.push({
                icon: '📅',
                title: 'Schedule regular promotional events',
                description: 'Plan weekly specials (e.g., "Taco Tuesday", "Fry-day Deals") to create repeat customer habits and increase predictable revenue.',
                badge: 'Strategy',
                badgeColor: 'neutral',
            });

            setSections({
                margin: marginRecs,
                popularity: popularityRecs,
                hidden: hiddenRecs,
                risk: riskRecs,
                events: eventRecs,
                summary: {
                    totalItems: margins.length,
                    highMargin: highMarginItems.length,
                    lowMargin: lowMarginItems.length,
                    fastMoving: fastItems.length,
                    slowMoving: slowItems.length,
                    hiddenStars: hiddenStarsData.hiddenStars?.length || 0,
                }
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

    const badgeStyles = {
        success: { color: 'var(--success-600)', bg: 'var(--success-50)' },
        error: { color: 'var(--error-500)', bg: 'var(--error-50)' },
        warning: { color: 'var(--warning-600)', bg: 'var(--warning-50)' },
        info: { color: 'var(--accent-600)', bg: 'var(--accent-50)' },
        neutral: { color: 'var(--neutral-600)', bg: 'var(--neutral-100)' },
    };

    const renderSection = (title, icon, recs, emptyMsg) => (
        <div className="card mb-6 animate-fade-in-up">
            <div className="card-header">
                <div>
                    <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 22 }}>{icon}</span> {title}
                        <span className="badge badge-neutral" style={{ fontSize: 11 }}>{recs.length}</span>
                    </div>
                </div>
            </div>
            {recs.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 0 8px' }}>
                    {recs.map((rec, idx) => {
                        const bs = badgeStyles[rec.badgeColor] || badgeStyles.neutral;
                        return (
                            <div key={idx} style={{
                                display: 'flex', alignItems: 'flex-start', gap: 14,
                                padding: '14px 0',
                                borderBottom: idx < recs.length - 1 ? '1px solid var(--neutral-100)' : 'none'
                            }}>
                                <span style={{ fontSize: 22, flexShrink: 0, marginTop: 2 }}>{rec.icon}</span>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                                        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--neutral-800)' }}>{rec.title}</span>
                                        <span style={{
                                            display: 'inline-block', padding: '2px 10px', borderRadius: 'var(--radius-full)',
                                            fontSize: 11, fontWeight: 700, color: bs.color, background: bs.bg,
                                        }}>
                                            {rec.badge}
                                        </span>
                                    </div>
                                    <p style={{ fontSize: 13, color: 'var(--neutral-600)', lineHeight: 1.7, margin: 0 }}>{rec.description}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--neutral-400)', fontSize: 13 }}>
                    {emptyMsg}
                </div>
            )}
        </div>
    );

    if (loading) {
        return (
            <OwnerLayout>
                <div className="page-container">
                    <div className="stats-grid">
                        {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: 100, borderRadius: 'var(--radius-lg)' }} />)}
                    </div>
                    {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 200, borderRadius: 'var(--radius-lg)', marginTop: 24 }} />)}
                </div>
            </OwnerLayout>
        );
    }

    const totalRecs = sections
        ? sections.margin.length + sections.popularity.length + sections.hidden.length + sections.risk.length + sections.events.length
        : 0;

    return (
        <OwnerLayout>
            <div className="page-container">
                <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1>💡 Recommendations</h1>
                        <p>Central intelligence hub — actionable insights from all analytics modules</p>
                    </div>
                    <button className="btn btn-secondary" onClick={handleRefresh} disabled={refreshing}>
                        <HiOutlineRefresh size={16} className={refreshing ? 'animate-spin' : ''} />
                        {refreshing ? 'Refreshing...' : 'Refresh'}
                    </button>
                </div>

                {/* Summary Bar */}
                {sections?.summary && (
                    <div className="card mb-6 animate-fade-in-up" style={{ background: 'linear-gradient(135deg, var(--brand-50), var(--accent-50))', border: 'none' }}>
                        <div className="flex items-center gap-3 mb-4">
                            <HiOutlineSparkles size={20} style={{ color: 'var(--accent-600)' }} />
                            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--neutral-800)' }}>
                                {totalRecs} Recommendations Generated
                            </h3>
                        </div>
                        <div className="stats-grid" style={{ marginBottom: 0 }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--neutral-900)' }}>{sections.summary.totalItems}</div>
                                <div style={{ fontSize: 12, color: 'var(--neutral-500)' }}>Menu Items</div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--success-600)' }}>{sections.summary.highMargin}</div>
                                <div style={{ fontSize: 12, color: 'var(--neutral-500)' }}>High Margin</div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--error-500)' }}>{sections.summary.lowMargin}</div>
                                <div style={{ fontSize: 12, color: 'var(--neutral-500)' }}>Low Margin</div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--warning-600)' }}>{sections.summary.slowMoving}</div>
                                <div style={{ fontSize: 12, color: 'var(--neutral-500)' }}>Slow Moving</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* A. Contribution Margin Recommendations */}
                {sections && renderSection(
                    'Based on Contribution Margin',
                    '📊',
                    sections.margin,
                    'No margin-based recommendations — all items have healthy margins.'
                )}

                {/* B. Popularity Score Recommendations */}
                {sections && renderSection(
                    'Based on Popularity Score',
                    '📈',
                    sections.popularity,
                    'No popularity-based recommendations — all items are performing well.'
                )}

                {/* C. Hidden Stars Recommendations */}
                {sections && renderSection(
                    'Based on Hidden Stars Analysis',
                    '🌟',
                    sections.hidden,
                    'No hidden star insights available.'
                )}

                {/* D. Risk Detection Recommendations */}
                {sections && renderSection(
                    'Based on Risk Detection',
                    '⚠️',
                    sections.risk,
                    'No risk items detected — your menu is in great shape!'
                )}

                {/* E. Event / Festival / Weekend Offers */}
                {sections && renderSection(
                    'Event & Festival Offers',
                    '🎊',
                    sections.events,
                    'No seasonal recommendations at this time.'
                )}
            </div>
        </OwnerLayout>
    );
}
