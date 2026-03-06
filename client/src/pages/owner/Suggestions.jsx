import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import OwnerLayout from '../../components/layout/OwnerLayout';
import { api } from '../../lib/api';
import toast from 'react-hot-toast';
import {
    HiOutlinePhotograph, HiOutlineRefresh, HiOutlineLightBulb,
    HiOutlineGift, HiOutlineCalendar, HiOutlineCollection,
} from 'react-icons/hi';

// ── Tab IDs ──
const TABS = [
    { id: 'combos', label: 'Combo Suggestions', icon: HiOutlineCollection },
    { id: 'bogo', label: 'BOGO Offers', icon: HiOutlineGift },
    { id: 'trends', label: 'Weekend & Festival', icon: HiOutlineCalendar },
];

function classifyVelocity(ordersPerDay) {
    if (ordersPerDay >= 5) return 'Fast';
    if (ordersPerDay >= 2) return 'Medium';
    return 'Slow';
}

function getUpcomingFestival() {
    const now = new Date();
    const m = now.getMonth() + 1;
    const d = now.getDate();
    if (m === 1 && d >= 10 && d <= 20) return 'Makar Sankranti / Pongal';
    if (m === 3 && d >= 15 && d <= 31) return 'Holi';
    if (m === 4 && d >= 10 && d <= 18) return 'Baisakhi / Vishu';
    if (m === 8 && d >= 15 && d <= 31) return 'Independence Day / Raksha Bandhan';
    if (m === 9 && d >= 1 && d <= 15) return 'Ganesh Chaturthi';
    if (m === 10 && d >= 1 && d <= 25) return 'Navratri / Dussehra';
    if ((m === 10 && d >= 25) || (m === 11 && d <= 15)) return 'Diwali';
    if (m === 12 && d >= 20 && d <= 31) return 'Christmas / New Year';
    return null;
}

function isWeekendApproaching() {
    const day = new Date().getDay();
    return day >= 4 || day === 0;
}

const ItemImg = ({ src, name }) => (
    <div className="sug-item-img">
        {src ? <img src={src} alt={name} /> : <div className="sug-item-img-placeholder"><HiOutlinePhotograph size={20} /></div>}
    </div>
);

export default function Suggestions() {
    const navigate = useNavigate();
    const [tab, setTab] = useState('combos');
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState({});
    const [restaurantId, setRestaurantId] = useState(null);

    // Data
    const [comboSuggestions, setComboSuggestions] = useState([]);
    const [bogoSuggestions, setBogoSuggestions] = useState([]);
    const [trendSuggestions, setTrendSuggestions] = useState([]);
    const [menuItemsMap, setMenuItemsMap] = useState({});

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const res = await api.getMyRestaurant();
            if (!res.data) return navigate('/owner/setup');
            const rid = res.data.id;
            setRestaurantId(rid);

            const [menuRes, marginsRes, trendsRes, comboRes] = await Promise.all([
                api.getMenuItems(rid),
                api.getMargins(rid),
                api.getSalesTrends(rid, 30),
                api.getComboSuggestions(rid),
            ]);

            const menuItems = menuRes.data || [];
            const imgMap = {};
            menuItems.forEach(mi => { imgMap[mi.name] = mi; });
            setMenuItemsMap(imgMap);

            const margins = marginsRes.data || [];
            const dailyTrends = trendsRes.data?.dailyTrends || [];
            const numDays = Math.max(dailyTrends.length, 1);
            const itemHalfTrends = trendsRes.data?.itemHalfTrends || [];

            // Enrich items
            const items = margins.map(item => {
                const marginPct = parseFloat(item.marginPercentage);
                const ordersPerDay = numDays > 0 ? item.totalSales / numDays : 0;
                const halfTrend = itemHalfTrends.find(t => t.name === item.name);
                let trend = 'flat';
                if (halfTrend) {
                    if (halfTrend.secondHalf > halfTrend.firstHalf) trend = 'up';
                    else if (halfTrend.secondHalf < halfTrend.firstHalf) trend = 'down';
                }
                const mi = imgMap[item.name] || {};
                return {
                    ...item,
                    imageUrl: mi.imageUrl || null,
                    menuItemId: mi.id || item.id,
                    marginPct,
                    ordersPerDay: parseFloat(ordersPerDay.toFixed(2)),
                    velocity: classifyVelocity(ordersPerDay),
                    trend,
                };
            });

            // ═══ 1. COMBO SUGGESTIONS ═══
            const coPurchases = comboRes.data?.coPurchasePatterns || [];
            const combos = coPurchases.slice(0, 4).map(cp => {
                const itemA = imgMap[cp.items[0]] || {};
                const itemB = imgMap[cp.items[1]] || {};
                const totalPrice = cp.totalPrice || ((itemA.price || 0) + (itemB.price || 0));
                const comboPrice = Math.round(totalPrice * 0.85); // ~15% off
                return {
                    id: `${cp.items[0]}-${cp.items[1]}`,
                    items: cp.items,
                    itemA, itemB,
                    frequency: cp.frequency,
                    totalPrice: Math.round(totalPrice),
                    comboPrice,
                    discount: Math.round(((totalPrice - comboPrice) / totalPrice) * 100),
                };
            });
            setComboSuggestions(combos);

            // ═══ 2. BOGO SUGGESTIONS ═══
            const bogo = items
                .filter(i => (i.velocity === 'Slow' || i.trend === 'down') && i.marginPct >= 25)
                .sort((a, b) => b.marginPct - a.marginPct)
                .slice(0, 4)
                .map(item => ({
                    ...item,
                    reason: item.trend === 'down'
                        ? `Demand is declining — a BOGO offer can drive volume back up`
                        : `Low order frequency (${item.ordersPerDay}/day) but healthy ${item.marginPercentage}% margin — BOGO won't cause a loss`,
                }));
            setBogoSuggestions(bogo);

            // ═══ 3. WEEKEND & FESTIVAL TRENDS ═══
            const trendsList = [];
            const festival = getUpcomingFestival();
            const weekend = isWeekendApproaching();
            const fastItems = items.filter(i => i.velocity === 'Fast' || i.velocity === 'Medium');

            if (weekend && fastItems.length >= 2) {
                trendsList.push({
                    id: 'weekend-combo',
                    type: 'weekend',
                    title: 'Weekend Combo Deal',
                    description: `Offer "${fastItems[0].name}" + "${fastItems[1].name}" together at 15% off for the weekend — both are customer favorites.`,
                    items: [fastItems[0], fastItems[1]],
                    discountPct: 15,
                    totalPrice: Math.round(fastItems[0].price + fastItems[1].price),
                    dealPrice: Math.round((fastItems[0].price + fastItems[1].price) * 0.85),
                });
            }

            if (weekend) {
                trendsList.push({
                    id: 'weekend-promo',
                    type: 'weekend',
                    title: 'Weekend Family Pack',
                    description: 'Weekends see higher group orders. Offer a family pack or bundle deal to capture larger orders.',
                    items: fastItems.slice(0, 2),
                    discountPct: 10,
                });
            }

            if (festival) {
                const festiveItems = items.filter(i => i.isVeg || i.velocity === 'Fast').slice(0, 2);
                trendsList.push({
                    id: 'festival-special',
                    type: 'festival',
                    title: `${festival} Special Offer`,
                    description: `Create a festive combo or themed menu item for ${festival}. Promote on social media to attract more customers during the celebration.`,
                    items: festiveItems,
                    discountPct: 20,
                });
            }

            // slow items discount suggestions
            const slowDecliners = items.filter(i => i.velocity === 'Slow' && i.trend === 'down').slice(0, 2);
            if (slowDecliners.length > 0) {
                trendsList.push({
                    id: 'revive-items',
                    type: 'promo',
                    title: 'Flash Sale — Revive Slow Items',
                    description: `Run a limited-time 20% discount on slowing items to clear attention and test if demand can be revived.`,
                    items: slowDecliners,
                    discountPct: 20,
                });
            }

            setTrendSuggestions(trendsList);

        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async () => { setLoading(true); await loadData(); };

    // ── Actions ──

    const handleCreateCombo = async (combo) => {
        const key = `combo-${combo.id}`;
        setActionLoading(prev => ({ ...prev, [key]: true }));
        try {
            const comboItems = [];
            if (combo.itemA?.id) comboItems.push({ menuItemId: combo.itemA.id, quantity: 1 });
            if (combo.itemB?.id) comboItems.push({ menuItemId: combo.itemB.id, quantity: 1 });
            if (comboItems.length < 2) throw new Error('Could not resolve item IDs');

            await api.createCombo({
                restaurantId,
                name: `${combo.items[0]} + ${combo.items[1]} Combo`,
                description: `Ordered together ${combo.frequency} times`,
                comboPrice: combo.comboPrice,
                items: comboItems,
            });
            toast.success(`Combo created: ${combo.items[0]} + ${combo.items[1]}!`);
            setComboSuggestions(prev => prev.filter(c => c.id !== combo.id));
        } catch (err) {
            toast.error(err.message);
        } finally {
            setActionLoading(prev => ({ ...prev, [key]: false }));
        }
    };

    const handleApplyBogo = async (item) => {
        const key = `bogo-${item.menuItemId}`;
        setActionLoading(prev => ({ ...prev, [key]: true }));
        try {
            // BOGO = effectively 50% off → set price to half for the promo
            const bogoPrice = Math.round(item.price * 0.5);
            await api.updateMenuItem(item.menuItemId, {
                name: item.name,
                price: bogoPrice,
                costPrice: item.costPrice,
                isAvailable: true,
                isVeg: item.isVeg ?? false,
                isBestseller: true, // highlight as promo
                imageUrl: item.imageUrl,
            });
            toast.success(`BOGO applied! "${item.name}" price set to ₹${bogoPrice}`);
            setBogoSuggestions(prev => prev.filter(i => i.menuItemId !== item.menuItemId));
        } catch (err) {
            toast.error(err.message);
        } finally {
            setActionLoading(prev => ({ ...prev, [key]: false }));
        }
    };

    const handleApplyTrend = async (trend) => {
        const key = `trend-${trend.id}`;
        setActionLoading(prev => ({ ...prev, [key]: true }));
        try {
            if (trend.items?.length >= 2 && trend.items[0]?.id && trend.items[1]?.id) {
                // Create combo from trend
                const comboPrice = trend.dealPrice || Math.round((trend.items[0].price + trend.items[1].price) * (1 - (trend.discountPct || 10) / 100));
                await api.createCombo({
                    restaurantId,
                    name: trend.title,
                    description: trend.description,
                    comboPrice,
                    items: trend.items.map(i => ({ menuItemId: i.id || i.menuItemId, quantity: 1 })),
                });
                toast.success(`"${trend.title}" combo created!`);
            } else if (trend.items?.length === 1 && trend.items[0]?.menuItemId) {
                // Apply discount on single item
                const item = trend.items[0];
                const newPrice = Math.round(item.price * (1 - (trend.discountPct || 10) / 100));
                await api.updateMenuItem(item.menuItemId, {
                    name: item.name,
                    price: newPrice,
                    costPrice: item.costPrice,
                    isAvailable: true,
                    isVeg: item.isVeg ?? false,
                    imageUrl: item.imageUrl,
                });
                toast.success(`${trend.discountPct}% discount applied to "${item.name}"`);
            } else {
                toast.success(`"${trend.title}" — promotion strategy noted!`);
            }
            setTrendSuggestions(prev => prev.filter(t => t.id !== trend.id));
        } catch (err) {
            toast.error(err.message);
        } finally {
            setActionLoading(prev => ({ ...prev, [key]: false }));
        }
    };

    // ── Render ──

    if (loading) {
        return (
            <OwnerLayout>
                <div className="page-container">
                    <div className="skeleton" style={{ height: 50, borderRadius: 'var(--radius-lg)', marginBottom: 16 }} />
                    <div className="grid-2">
                        {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: 200, borderRadius: 'var(--radius-lg)' }} />)}
                    </div>
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
                        <h1>✨ Suggestions & Recommendations</h1>
                        <p>Smart promotional strategies powered by your restaurant data</p>
                    </div>
                    <button className="btn btn-secondary" onClick={handleRefresh} disabled={loading}>
                        <HiOutlineRefresh size={16} /> Refresh
                    </button>
                </div>

                {/* Tabs */}
                <div className="sug-tabs animate-fade-in-up">
                    {TABS.map(t => (
                        <button
                            key={t.id}
                            className={`sug-tab ${tab === t.id ? 'sug-tab--active' : ''}`}
                            onClick={() => setTab(t.id)}
                        >
                            <t.icon size={16} />
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* ═══════════ TAB: COMBO SUGGESTIONS ═══════════ */}
                {tab === 'combos' && (
                    <div className="sug-grid animate-fade-in-up">
                        {comboSuggestions.length > 0 ? comboSuggestions.map(combo => (
                            <div key={combo.id} className="sug-card">
                                <div className="sug-card-images">
                                    <ItemImg src={combo.itemA?.imageUrl} name={combo.items[0]} />
                                    <div className="sug-plus">+</div>
                                    <ItemImg src={combo.itemB?.imageUrl} name={combo.items[1]} />
                                </div>
                                <div className="sug-card-body">
                                    <div className="sug-card-title">{combo.items[0]} + {combo.items[1]}</div>
                                    <div className="sug-card-meta">
                                        Ordered together <strong>{combo.frequency}×</strong>
                                    </div>
                                    <div className="sug-card-pricing">
                                        <span className="rec-price-old">₹{combo.totalPrice}</span>
                                        <span className="rec-discount-badge">-{combo.discount}%</span>
                                        <span className="rec-price-new">₹{combo.comboPrice}</span>
                                    </div>
                                    <div className="sug-card-reason">
                                        These items are frequently ordered together — bundling them at a {combo.discount}% discount will increase average order value.
                                    </div>
                                    <button
                                        className="btn btn-sm rec-action-btn rec-action-btn--green"
                                        disabled={actionLoading[`combo-${combo.id}`]}
                                        onClick={() => handleCreateCombo(combo)}
                                    >
                                        {actionLoading[`combo-${combo.id}`] ? 'Creating...' : 'Create This Combo'}
                                    </button>
                                </div>
                            </div>
                        )) : (
                            <div className="sug-empty-full">
                                <HiOutlineCollection size={40} />
                                <h3>No combo suggestions yet</h3>
                                <p>As customers place more orders, the system will detect items frequently bought together and suggest combos.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* ═══════════ TAB: BOGO OFFERS ═══════════ */}
                {tab === 'bogo' && (
                    <div className="sug-grid animate-fade-in-up">
                        {bogoSuggestions.length > 0 ? bogoSuggestions.map(item => (
                            <div key={item.menuItemId} className="sug-card">
                                <div className="sug-card-hero">
                                    <ItemImg src={item.imageUrl} name={item.name} />
                                    <div className="sug-bogo-badge">BOGO</div>
                                </div>
                                <div className="sug-card-body">
                                    <div className="sug-card-title">{item.name}</div>
                                    <div className="sug-card-pricing">
                                        <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--neutral-900)' }}>₹{item.price}</span>
                                        <span className="sug-card-margin">{item.marginPercentage}% margin</span>
                                    </div>
                                    <div className="sug-card-reason">{item.reason}</div>
                                    <button
                                        className="btn btn-sm rec-action-btn rec-action-btn--amber"
                                        disabled={actionLoading[`bogo-${item.menuItemId}`]}
                                        onClick={() => handleApplyBogo(item)}
                                    >
                                        {actionLoading[`bogo-${item.menuItemId}`] ? 'Applying...' : `Apply BOGO on ${item.name}`}
                                    </button>
                                </div>
                            </div>
                        )) : (
                            <div className="sug-empty-full">
                                <HiOutlineGift size={40} />
                                <h3>No BOGO suggestions right now</h3>
                                <p>The system recommends BOGO offers for items with slowing demand but healthy margins.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* ═══════════ TAB: WEEKEND & FESTIVAL ═══════════ */}
                {tab === 'trends' && (
                    <div className="sug-grid animate-fade-in-up">
                        {trendSuggestions.length > 0 ? trendSuggestions.map(trend => (
                            <div key={trend.id} className="sug-card">
                                <div className="sug-card-images">
                                    {trend.items?.slice(0, 2).map((it, i) => (
                                        <ItemImg key={i} src={it.imageUrl} name={it.name} />
                                    ))}
                                </div>
                                <div className="sug-card-body">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span className={`sug-type-badge sug-type-badge--${trend.type}`}>
                                            {trend.type === 'weekend' ? '🎉 Weekend' : trend.type === 'festival' ? '🪔 Festival' : '⚡ Promo'}
                                        </span>
                                    </div>
                                    <div className="sug-card-title">{trend.title}</div>
                                    <div className="sug-card-reason">{trend.description}</div>
                                    {trend.dealPrice && (
                                        <div className="sug-card-pricing">
                                            <span className="rec-price-old">₹{trend.totalPrice}</span>
                                            <span className="rec-discount-badge">-{trend.discountPct}%</span>
                                            <span className="rec-price-new">₹{trend.dealPrice}</span>
                                        </div>
                                    )}
                                    <button
                                        className="btn btn-sm rec-action-btn rec-action-btn--green"
                                        disabled={actionLoading[`trend-${trend.id}`]}
                                        onClick={() => handleApplyTrend(trend)}
                                    >
                                        {actionLoading[`trend-${trend.id}`] ? 'Applying...' : 'Apply This Promotion'}
                                    </button>
                                </div>
                            </div>
                        )) : (
                            <div className="sug-empty-full">
                                <HiOutlineCalendar size={40} />
                                <h3>No trend-based suggestions right now</h3>
                                <p>As more orders come in, the system will suggest weekend and festival promotions based on your data.</p>
                            </div>
                        )}
                    </div>
                )}

            </div>
        </OwnerLayout>
    );
}
