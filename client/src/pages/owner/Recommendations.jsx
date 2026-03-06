import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import OwnerLayout from '../../components/layout/OwnerLayout';
import { api } from '../../lib/api';
import toast from 'react-hot-toast';
import {
    HiOutlineRefresh, HiOutlineLightBulb, HiOutlinePhotograph,
    HiOutlineTrendingUp, HiOutlineTrash, HiOutlineSpeakerphone, HiOutlineTag,
} from 'react-icons/hi';

function classifyVelocity(ordersPerDay) {
    if (ordersPerDay >= 5) return 'Fast';
    if (ordersPerDay >= 2) return 'Medium';
    return 'Slow';
}

function getMarginLevel(pct) {
    if (pct >= 50) return 'High';
    if (pct >= 30) return 'Medium';
    return 'Low';
}

export default function Recommendations() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [actionLoading, setActionLoading] = useState({});
    const [restaurantId, setRestaurantId] = useState(null);

    // The 4 recommendation buckets — max 2 items each
    const [increasePrice, setIncreasePrice] = useState([]);
    const [dropItems, setDropItems] = useState([]);
    const [promoteItems, setPromoteItems] = useState([]);
    const [discountItems, setDiscountItems] = useState([]);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const res = await api.getMyRestaurant();
            if (!res.data) return navigate('/owner/setup');
            const rid = res.data.id;
            setRestaurantId(rid);

            const [marginsRes, menuRes, trendsRes] = await Promise.all([
                api.getMargins(rid),
                api.getMenuItems(rid),
                api.getSalesTrends(rid, 30),
            ]);

            const margins = marginsRes.data || [];
            const menuItems = menuRes.data || [];
            const dailyTrends = trendsRes.data?.dailyTrends || [];
            const itemHalfTrends = trendsRes.data?.itemHalfTrends || [];
            const numDays = Math.max(dailyTrends.length, 1);

            // Build a map of menu items by name for imageUrl lookup
            const imageMap = {};
            menuItems.forEach(mi => { imageMap[mi.name] = mi; });

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
                const menuItem = imageMap[item.name] || {};
                return {
                    ...item,
                    imageUrl: menuItem.imageUrl || null,
                    menuItemId: menuItem.id || item.id,
                    marginPct,
                    ordersPerDay: parseFloat(ordersPerDay.toFixed(2)),
                    velocity: classifyVelocity(ordersPerDay),
                    marginLevel: getMarginLevel(marginPct),
                    trend,
                };
            });

            // 1. INCREASE PRICE — High demand items (Fast/Medium) with good margin
            const priceUp = items
                .filter(i => (i.velocity === 'Fast' || i.velocity === 'Medium') && i.marginLevel !== 'Low')
                .sort((a, b) => b.ordersPerDay - a.ordersPerDay)
                .slice(0, 2)
                .map(item => {
                    const bump = item.price <= 100 ? 10 : item.price <= 300 ? 20 : 30;
                    return { ...item, suggestedPrice: Math.round(item.price + bump) };
                });

            // 2. DROP ITEMS — Low margin + Slow + optionally declining
            const drops = items
                .filter(i => i.marginLevel === 'Low' && i.velocity === 'Slow')
                .sort((a, b) => a.ordersPerDay - b.ordersPerDay)
                .slice(0, 2);

            // 3. PROMOTE — High margin but Slow (hidden gems)
            const promos = items
                .filter(i => i.marginLevel === 'High' && i.velocity === 'Slow')
                .sort((a, b) => b.contributionMargin - a.contributionMargin)
                .slice(0, 2);

            // 4. DISCOUNT — Medium margin/velocity or declining, not in drops
            const dropIds = new Set(drops.map(d => d.menuItemId));
            const discounts = items
                .filter(i => !dropIds.has(i.menuItemId) && (i.trend === 'down' || (i.marginLevel === 'Medium' && i.velocity === 'Slow')))
                .sort((a, b) => a.ordersPerDay - b.ordersPerDay)
                .slice(0, 2)
                .map(item => {
                    const discountPct = item.marginPct >= 40 ? 15 : 10;
                    return { ...item, discountPct, discountedPrice: Math.round(item.price * (1 - discountPct / 100)) };
                });

            setIncreasePrice(priceUp);
            setDropItems(drops);
            setPromoteItems(promos);
            setDiscountItems(discounts);
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

    // ------- Actions -------

    const handleIncreasePrice = async (item) => {
        const key = `price-${item.menuItemId}`;
        setActionLoading(prev => ({ ...prev, [key]: true }));
        try {
            await api.updateMenuItem(item.menuItemId, {
                name: item.name,
                price: item.suggestedPrice,
                costPrice: item.costPrice,
                isAvailable: true,
                isVeg: item.isVeg ?? false,
                isBestseller: item.isBestseller ?? false,
                spiceLevel: item.spiceLevel ?? 0,
                preparationTime: item.preparationTime ?? 15,
                imageUrl: item.imageUrl,
            });
            toast.success(`"${item.name}" price updated to ₹${item.suggestedPrice}!`);
            setIncreasePrice(prev => prev.filter(i => i.menuItemId !== item.menuItemId));
        } catch (err) {
            toast.error(err.message);
        } finally {
            setActionLoading(prev => ({ ...prev, [key]: false }));
        }
    };

    const handleDropItem = async (item) => {
        if (!confirm(`Remove "${item.name}" from your menu?`)) return;
        const key = `drop-${item.menuItemId}`;
        setActionLoading(prev => ({ ...prev, [key]: true }));
        try {
            await api.updateMenuItem(item.menuItemId, {
                name: item.name,
                price: item.price,
                costPrice: item.costPrice,
                isAvailable: false,
                isVeg: item.isVeg ?? false,
                isBestseller: item.isBestseller ?? false,
                spiceLevel: item.spiceLevel ?? 0,
                preparationTime: item.preparationTime ?? 15,
                imageUrl: item.imageUrl,
            });
            toast.success(`"${item.name}" removed from menu`);
            setDropItems(prev => prev.filter(i => i.menuItemId !== item.menuItemId));
        } catch (err) {
            toast.error(err.message);
        } finally {
            setActionLoading(prev => ({ ...prev, [key]: false }));
        }
    };

    // ------- Render -------

    const ItemImage = ({ src, name }) => (
        <div className="rec-card-img">
            {src ? (
                <img src={src} alt={name} />
            ) : (
                <div className="rec-card-img-placeholder"><HiOutlinePhotograph size={24} /></div>
            )}
        </div>
    );

    const totalRecs = increasePrice.length + dropItems.length + promoteItems.length + discountItems.length;

    if (loading) {
        return (
            <OwnerLayout>
                <div className="page-container">
                    <div className="rec-grid">
                        {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: 320, borderRadius: 'var(--radius-lg)' }} />)}
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
                        <h1>💡 Recommendations</h1>
                        <p>Smart suggestions to improve pricing, menu, and revenue</p>
                    </div>
                    <button className="btn btn-secondary" onClick={handleRefresh} disabled={refreshing}>
                        <HiOutlineRefresh size={16} className={refreshing ? 'animate-spin' : ''} />
                        {refreshing ? 'Refreshing...' : 'Refresh'}
                    </button>
                </div>

                {totalRecs === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon"><HiOutlineLightBulb size={48} /></div>
                        <h3>No recommendations yet</h3>
                        <p>Add menu items and start taking orders to receive actionable suggestions.</p>
                    </div>
                ) : (
                    <div className="rec-grid animate-fade-in-up">

                        {/* =============== 1. INCREASE PRICE =============== */}
                        <div className="rec-section rec-section--green">
                            <div className="rec-section-header">
                                <div className="rec-section-icon" style={{ background: 'var(--success-50)', color: 'var(--success-600)' }}>
                                    <HiOutlineTrendingUp size={20} />
                                </div>
                                <div>
                                    <h3>Increase Price</h3>
                                    <p>High-demand items that can earn you more</p>
                                </div>
                            </div>
                            <div className="rec-cards">
                                {increasePrice.length > 0 ? increasePrice.map(item => (
                                    <div key={item.menuItemId} className="rec-card">
                                        <ItemImage src={item.imageUrl} name={item.name} />
                                        <div className="rec-card-body">
                                            <div className="rec-card-name">{item.name}</div>
                                            <div className="rec-card-pricing">
                                                <span className="rec-price-old">₹{item.price}</span>
                                                <span className="rec-arrow">→</span>
                                                <span className="rec-price-new">₹{item.suggestedPrice}</span>
                                            </div>
                                            <div className="rec-card-reason">
                                                {item.ordersPerDay}/day orders • {item.marginPercentage}% margin
                                            </div>
                                            <button
                                                className="btn btn-sm rec-action-btn rec-action-btn--green"
                                                disabled={actionLoading[`price-${item.menuItemId}`]}
                                                onClick={() => handleIncreasePrice(item)}
                                            >
                                                {actionLoading[`price-${item.menuItemId}`] ? 'Updating...' : `Increase ${item.name} Price`}
                                            </button>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="rec-empty">No price increase suggestions right now</div>
                                )}
                            </div>
                        </div>

                        {/* =============== 2. DROP ITEM =============== */}
                        <div className="rec-section rec-section--red">
                            <div className="rec-section-header">
                                <div className="rec-section-icon" style={{ background: 'var(--error-50, #fef2f2)', color: 'var(--error-500)' }}>
                                    <HiOutlineTrash size={20} />
                                </div>
                                <div>
                                    <h3>Drop from Menu</h3>
                                    <p>Low demand, high risk — not worth keeping</p>
                                </div>
                            </div>
                            <div className="rec-cards">
                                {dropItems.length > 0 ? dropItems.map(item => (
                                    <div key={item.menuItemId} className="rec-card">
                                        <ItemImage src={item.imageUrl} name={item.name} />
                                        <div className="rec-card-body">
                                            <div className="rec-card-name">{item.name}</div>
                                            <div className="rec-card-reason" style={{ color: 'var(--error-500)' }}>
                                                Only {item.ordersPerDay}/day • ₹{item.contributionMargin.toFixed(0)} profit per sale
                                            </div>
                                            <div className="rec-card-reason">
                                                Low orders and low margin — not contributing to revenue
                                            </div>
                                            <button
                                                className="btn btn-sm rec-action-btn rec-action-btn--red"
                                                disabled={actionLoading[`drop-${item.menuItemId}`]}
                                                onClick={() => handleDropItem(item)}
                                            >
                                                {actionLoading[`drop-${item.menuItemId}`] ? 'Removing...' : `Remove ${item.name}`}
                                            </button>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="rec-empty">No items to drop right now</div>
                                )}
                            </div>
                        </div>

                        {/* =============== 3. PROMOTE ITEM =============== */}
                        <div className="rec-section rec-section--purple">
                            <div className="rec-section-header">
                                <div className="rec-section-icon" style={{ background: 'var(--accent-50)', color: 'var(--accent-600)' }}>
                                    <HiOutlineSpeakerphone size={20} />
                                </div>
                                <div>
                                    <h3>Promote Item</h3>
                                    <p>Hidden gems with good profit — advertise them</p>
                                </div>
                            </div>
                            <div className="rec-cards">
                                {promoteItems.length > 0 ? promoteItems.map(item => (
                                    <div key={item.menuItemId} className="rec-card">
                                        <ItemImage src={item.imageUrl} name={item.name} />
                                        <div className="rec-card-body">
                                            <div className="rec-card-name">{item.name}</div>
                                            <div className="rec-card-pricing">
                                                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent-600)' }}>₹{item.contributionMargin.toFixed(0)} profit</span>
                                            </div>
                                            <div className="rec-card-reason">
                                                Great margin ({item.marginPercentage}%) but only {item.ordersPerDay} orders/day. Feature on menu, add photos, or promote on social media.
                                            </div>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="rec-empty">No promotion suggestions right now</div>
                                )}
                            </div>
                        </div>

                        {/* =============== 4. ADD DISCOUNT =============== */}
                        <div className="rec-section rec-section--amber">
                            <div className="rec-section-header">
                                <div className="rec-section-icon" style={{ background: 'var(--warning-50)', color: 'var(--warning-600, #d97706)' }}>
                                    <HiOutlineTag size={20} />
                                </div>
                                <div>
                                    <h3>Add Discount</h3>
                                    <p>Boost slowing items with limited-time offers</p>
                                </div>
                            </div>
                            <div className="rec-cards">
                                {discountItems.length > 0 ? discountItems.map(item => (
                                    <div key={item.menuItemId} className="rec-card">
                                        <ItemImage src={item.imageUrl} name={item.name} />
                                        <div className="rec-card-body">
                                            <div className="rec-card-name">{item.name}</div>
                                            <div className="rec-card-pricing">
                                                <span className="rec-price-old">₹{item.price}</span>
                                                <span className="rec-discount-badge">-{item.discountPct}%</span>
                                                <span className="rec-price-new" style={{ color: 'var(--warning-600, #d97706)' }}>₹{item.discountedPrice}</span>
                                            </div>
                                            <div className="rec-card-reason">
                                                {item.trend === 'down' ? 'Demand is declining' : 'Moderate demand'} — a {item.discountPct}% discount can attract more customers and increase order volume.
                                            </div>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="rec-empty">No discount suggestions right now</div>
                                )}
                            </div>
                        </div>

                    </div>
                )}
            </div>
        </OwnerLayout>
    );
}
