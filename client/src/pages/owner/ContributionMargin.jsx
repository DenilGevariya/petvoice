import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import OwnerLayout from '../../components/layout/OwnerLayout';
import { api } from '../../lib/api';
import { HiOutlineChartBar, HiOutlineSortDescending, HiOutlineSortAscending } from 'react-icons/hi';

export default function ContributionMargin() {
    const navigate = useNavigate();
    const [margins, setMargins] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sortField, setSortField] = useState('contributionMargin');
    const [sortDir, setSortDir] = useState('desc');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const res = await api.getMyRestaurant();
            if (!res.data) return navigate('/owner/setup');
            const result = await api.getMargins(res.data.id);
            setMargins(result.data || []);
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

    const sorted = [...margins].sort((a, b) => {
        const aVal = a[sortField] || 0;
        const bVal = b[sortField] || 0;
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });

    const SortIcon = ({ field }) => {
        if (sortField !== field) return null;
        return sortDir === 'desc' ? <HiOutlineSortDescending size={14} /> : <HiOutlineSortAscending size={14} />;
    };

    // Summary stats
    const avgMargin = margins.length > 0 ? (margins.reduce((s, m) => s + m.contributionMargin, 0) / margins.length).toFixed(2) : 0;
    const avgContribution = margins.length > 0 ? (margins.reduce((s, m) => s + parseFloat(m.marginPercentage), 0) / margins.length).toFixed(1) : 0;
    const totalProfit = margins.reduce((s, m) => s + m.totalProfit, 0);

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
                    <h1>📊 Contribution Margin Analysis</h1>
                    <p>Analyze the profitability of each menu item based on selling price and cost price</p>
                </div>

                {/* Summary Cards */}
                <div className="stats-grid stagger-children">
                    <div className="stat-card animate-fade-in-up">
                        <div className="stat-icon brand"><HiOutlineChartBar /></div>
                        <div>
                            <div className="stat-value">{margins.length}</div>
                            <div className="stat-label">Menu Items</div>
                        </div>
                    </div>
                    <div className="stat-card animate-fade-in-up">
                        <div className="stat-icon success">₹</div>
                        <div>
                            <div className="stat-value">₹{avgMargin}</div>
                            <div className="stat-label">Avg Margin / Item</div>
                        </div>
                    </div>
                    <div className="stat-card animate-fade-in-up">
                        <div className="stat-icon accent">%</div>
                        <div>
                            <div className="stat-value">{avgContribution}%</div>
                            <div className="stat-label">Avg Contribution %</div>
                        </div>
                    </div>
                    <div className="stat-card animate-fade-in-up">
                        <div className="stat-icon warning">💰</div>
                        <div>
                            <div className="stat-value">₹{totalProfit.toLocaleString()}</div>
                            <div className="stat-label">Total Profit (All Time)</div>
                        </div>
                    </div>
                </div>

                {/* Margin Table */}
                {margins.length > 0 ? (
                    <div className="card animate-fade-in-up">
                        <div className="card-header">
                            <div>
                                <div className="card-title">Item-wise Contribution Margin</div>
                                <div className="card-subtitle">Click column headers to sort</div>
                            </div>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Item</th>
                                        <th style={{ cursor: 'pointer' }} onClick={() => handleSort('price')}>
                                            Selling Price <SortIcon field="price" />
                                        </th>
                                        <th style={{ cursor: 'pointer' }} onClick={() => handleSort('costPrice')}>
                                            Cost Price <SortIcon field="costPrice" />
                                        </th>
                                        <th style={{ cursor: 'pointer' }} onClick={() => handleSort('contributionMargin')}>
                                            Margin (₹) <SortIcon field="contributionMargin" />
                                        </th>
                                        <th style={{ cursor: 'pointer' }} onClick={() => handleSort('marginPercentage')}>
                                            Contribution % <SortIcon field="marginPercentage" />
                                        </th>
                                        <th style={{ cursor: 'pointer' }} onClick={() => handleSort('totalSales')}>
                                            Total Sales <SortIcon field="totalSales" />
                                        </th>
                                        <th style={{ cursor: 'pointer' }} onClick={() => handleSort('totalProfit')}>
                                            Total Profit <SortIcon field="totalProfit" />
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sorted.map((item) => {
                                        const marginPct = parseFloat(item.marginPercentage);
                                        const marginColor = marginPct >= 60 ? 'var(--success-600)' : marginPct >= 40 ? 'var(--brand-600)' : marginPct >= 20 ? 'var(--warning-600)' : 'var(--error-500)';
                                        return (
                                            <tr key={item.id}>
                                                <td>
                                                    <div style={{ fontWeight: 600, color: 'var(--neutral-800)' }}>{item.name}</div>
                                                    {item.category && <div style={{ fontSize: 12, color: 'var(--neutral-500)' }}>{item.category}</div>}
                                                </td>
                                                <td style={{ fontWeight: 600 }}>₹{item.price.toFixed(2)}</td>
                                                <td style={{ color: 'var(--neutral-500)' }}>₹{item.costPrice.toFixed(2)}</td>
                                                <td style={{ fontWeight: 700, color: marginColor }}>₹{item.contributionMargin.toFixed(2)}</td>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <div style={{
                                                            width: 60, height: 6, borderRadius: 3,
                                                            background: 'var(--neutral-100)', overflow: 'hidden'
                                                        }}>
                                                            <div style={{
                                                                width: `${Math.min(marginPct, 100)}%`, height: '100%',
                                                                borderRadius: 3, background: marginColor
                                                            }} />
                                                        </div>
                                                        <span style={{ fontWeight: 600, color: marginColor, fontSize: 13 }}>
                                                            {item.marginPercentage}%
                                                        </span>
                                                    </div>
                                                </td>
                                                <td style={{ color: 'var(--neutral-600)' }}>{item.totalSales}</td>
                                                <td style={{ fontWeight: 600, color: 'var(--success-600)' }}>₹{item.totalProfit.toFixed(2)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="empty-state">
                        <div className="empty-state-icon">📊</div>
                        <h3>No menu items yet</h3>
                        <p>Add menu items with cost prices to see contribution margin analysis.</p>
                    </div>
                )}
            </div>
        </OwnerLayout>
    );
}
