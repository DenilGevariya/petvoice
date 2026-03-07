import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import OwnerLayout from '../../components/layout/OwnerLayout';
import { api } from '../../lib/api';
import {
    HiOutlineChartBar, HiOutlineSortDescending, HiOutlineSortAscending,
    HiOutlineCurrencyRupee, HiOutlineShoppingBag, HiOutlineTrendingUp,
} from 'react-icons/hi';

export default function ContributionMargin() {
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [sortField, setSortField] = useState('createdAt');
    const [sortDir, setSortDir] = useState('desc');

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const res = await api.getMyRestaurant();
            if (!res.data) return navigate('/owner/setup');
            const result = await api.getOrderMargins(res.data.id);
            setOrders(result.data?.orders || []);
            setSummary(result.data?.summary || null);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSort = (field) => {
        if (sortField === field) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir('desc');
        }
    };

    const sorted = [...orders].sort((a, b) => {
        let aVal, bVal;
        if (sortField === 'createdAt') {
            aVal = new Date(a.createdAt).getTime();
            bVal = new Date(b.createdAt).getTime();
        } else {
            aVal = parseFloat(a[sortField]) || 0;
            bVal = parseFloat(b[sortField]) || 0;
        }
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });

    const SortIcon = ({ field }) => {
        if (sortField !== field) return null;
        return sortDir === 'desc' ? <HiOutlineSortDescending size={14} /> : <HiOutlineSortAscending size={14} />;
    };

    const formatDate = (d) => {
        const dt = new Date(d);
        return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) +
            ' ' + dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    };

    const profitColor = (profit) => {
        if (profit >= 100) return 'var(--success-600)';
        if (profit >= 30) return 'var(--brand-600)';
        if (profit >= 0) return 'var(--warning-600, #d97706)';
        return 'var(--error-500)';
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
                    <h1>📊 Contribution Margin — Order Level</h1>
                    <p>See the profit generated from each customer order</p>
                </div>

                {/* Summary Cards */}
                {summary && (
                    <div className="stats-grid stagger-children">
                        <div className="stat-card animate-fade-in-up">
                            <div className="stat-icon brand"><HiOutlineShoppingBag /></div>
                            <div>
                                <div className="stat-value">{summary.totalOrders}</div>
                                <div className="stat-label">Total Orders</div>
                            </div>
                        </div>
                        <div className="stat-card animate-fade-in-up">
                            <div className="stat-icon accent"><HiOutlineCurrencyRupee /></div>
                            <div>
                                <div className="stat-value">₹{summary.totalRevenue.toLocaleString()}</div>
                                <div className="stat-label">Total Revenue</div>
                            </div>
                        </div>
                        <div className="stat-card animate-fade-in-up">
                            <div className="stat-icon success"><HiOutlineTrendingUp /></div>
                            <div>
                                <div className="stat-value" style={{ color: 'var(--success-600)' }}>₹{summary.totalProfit.toLocaleString()}</div>
                                <div className="stat-label">Total Profit</div>
                            </div>
                        </div>
                        <div className="stat-card animate-fade-in-up">
                            <div className="stat-icon warning"><HiOutlineChartBar /></div>
                            <div>
                                <div className="stat-value">₹{summary.avgProfitPerOrder.toLocaleString()}</div>
                                <div className="stat-label">Avg Profit / Order</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Order Margin Table */}
                {orders.length > 0 ? (
                    <div className="card animate-fade-in-up">
                        <div className="card-header">
                            <div>
                                <div className="card-title">Order-wise Contribution Margin</div>
                                <div className="card-subtitle">Click column headers to sort • Profit = Selling Price − Cost Price</div>
                            </div>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th style={{ cursor: 'pointer' }} onClick={() => handleSort('createdAt')}>
                                            Order <SortIcon field="createdAt" />
                                        </th>
                                        <th>Items Ordered</th>
                                        <th style={{ cursor: 'pointer' }} onClick={() => handleSort('sellingTotal')}>
                                            Total Selling Price <SortIcon field="sellingTotal" />
                                        </th>
                                        <th style={{ cursor: 'pointer' }} onClick={() => handleSort('costTotal')}>
                                            Total Cost Price <SortIcon field="costTotal" />
                                        </th>
                                        <th style={{ cursor: 'pointer' }} onClick={() => handleSort('profit')}>
                                            Profit <SortIcon field="profit" />
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sorted.map((order) => (
                                        <tr key={order.orderId}>
                                            <td>
                                                <div style={{ fontWeight: 600, color: 'var(--neutral-800)' }}>#{order.orderNumber}</div>
                                                <div style={{ fontSize: 11, color: 'var(--neutral-400)' }}>{formatDate(order.createdAt)}</div>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                    {order.items.map((item, i) => (
                                                        <span key={i} style={{ fontSize: 13, color: 'var(--neutral-700)' }}>
                                                            {item.name} {item.qty > 1 ? `×${item.qty}` : ''}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td style={{ fontWeight: 600 }}>₹{order.sellingTotal.toLocaleString()}</td>
                                            <td style={{ color: 'var(--neutral-500)' }}>₹{order.costTotal.toLocaleString()}</td>
                                            <td style={{ fontWeight: 700, color: profitColor(order.profit) }}>
                                                ₹{order.profit.toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="empty-state">
                        <div className="empty-state-icon">📊</div>
                        <h3>No orders yet</h3>
                        <p>Once customers place orders, you'll see the profit breakdown for each order here.</p>
                    </div>
                )}
            </div>
        </OwnerLayout>
    );
}
