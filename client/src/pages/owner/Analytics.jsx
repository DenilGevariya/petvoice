import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import OwnerLayout from '../../components/layout/OwnerLayout';
import { api } from '../../lib/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['#f97316', '#8b5cf6', '#22c55e', '#ef4444', '#f59e0b', '#06b6d4'];
const classificationEmojis = { star: '⭐', workhorse: '🐎', puzzle: '❓', dog: '🐶' };

export default function Analytics() {
    const navigate = useNavigate();
    const [restaurant, setRestaurant] = useState(null);
    const [margins, setMargins] = useState([]);
    const [classification, setClassification] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('margins');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const res = await api.getMyRestaurant();
            if (!res.data) return navigate('/owner/setup');
            setRestaurant(res.data);

            const [marginsRes, classRes] = await Promise.all([
                api.getMargins(res.data.id),
                api.getClassification(res.data.id),
            ]);
            setMargins(marginsRes.data || []);
            setClassification(classRes.data || null);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const marginChartData = margins.slice(0, 12).map((m) => ({
        name: m.name.length > 15 ? m.name.substring(0, 15) + '...' : m.name,
        margin: m.contributionMargin,
        profit: m.totalProfit,
    }));

    const classificationPieData = classification
        ? Object.entries({
            Stars: classification.stars?.length || 0,
            Workhorses: classification.workhorses?.length || 0,
            Puzzles: classification.puzzles?.length || 0,
            Dogs: classification.dogs?.length || 0,
        }).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }))
        : [];

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
                    <h1>Revenue Analytics</h1>
                    <p>Deep insights into your menu performance and profitability</p>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-6">
                    <button className={`btn btn-sm ${activeTab === 'margins' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('margins')}>
                        Contribution Margins
                    </button>
                    <button className={`btn btn-sm ${activeTab === 'classification' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('classification')}>
                        Item Classification
                    </button>
                    <button className={`btn btn-sm ${activeTab === 'profitability' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('profitability')}>
                        Profitability Table
                    </button>
                </div>

                {/* Contribution Margins Chart */}
                {activeTab === 'margins' && (
                    <div className="animate-fade-in-up">
                        <div className="card mb-6">
                            <div className="card-header">
                                <div>
                                    <div className="card-title">Contribution Margin by Item</div>
                                    <div className="card-subtitle">Selling Price − Cost Price per item</div>
                                </div>
                            </div>
                            {marginChartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={360}>
                                    <BarChart data={marginChartData} margin={{ top: 20, right: 20, bottom: 60, left: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--neutral-150)" />
                                        <XAxis dataKey="name" angle={-35} textAnchor="end" fontSize={12} tick={{ fill: 'var(--neutral-500)' }} />
                                        <YAxis fontSize={12} tick={{ fill: 'var(--neutral-500)' }} />
                                        <Tooltip
                                            contentStyle={{ borderRadius: 12, border: '1px solid var(--neutral-200)', boxShadow: 'var(--shadow-lg)' }}
                                            formatter={(value) => [`₹${value.toFixed(2)}`, '']}
                                        />
                                        <Bar dataKey="margin" fill="var(--brand-500)" radius={[6, 6, 0, 0]} name="Margin" />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="empty-state"><p>No margin data available yet.</p></div>
                            )}
                        </div>

                        {marginChartData.length > 0 && (
                            <div className="card">
                                <div className="card-header">
                                    <div>
                                        <div className="card-title">Total Profit by Item</div>
                                        <div className="card-subtitle">Margin × Sales Quantity</div>
                                    </div>
                                </div>
                                <ResponsiveContainer width="100%" height={360}>
                                    <BarChart data={marginChartData} margin={{ top: 20, right: 20, bottom: 60, left: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--neutral-150)" />
                                        <XAxis dataKey="name" angle={-35} textAnchor="end" fontSize={12} tick={{ fill: 'var(--neutral-500)' }} />
                                        <YAxis fontSize={12} tick={{ fill: 'var(--neutral-500)' }} />
                                        <Tooltip
                                            contentStyle={{ borderRadius: 12, border: '1px solid var(--neutral-200)', boxShadow: 'var(--shadow-lg)' }}
                                            formatter={(value) => [`₹${value.toFixed(2)}`, '']}
                                        />
                                        <Bar dataKey="profit" fill="var(--accent-500)" radius={[6, 6, 0, 0]} name="Total Profit" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>
                )}

                {/* Classification */}
                {activeTab === 'classification' && (
                    <div className="animate-fade-in-up">
                        <div className="grid-2 mb-6">
                            <div className="card">
                                <div className="card-header">
                                    <div>
                                        <div className="card-title">Menu Classification Distribution</div>
                                        <div className="card-subtitle">BCG Matrix breakdown</div>
                                    </div>
                                </div>
                                {classificationPieData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={300}>
                                        <PieChart>
                                            <Pie data={classificationPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value">
                                                {classificationPieData.map((_, idx) => (
                                                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                            <Legend />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="empty-state"><p>No classification data yet. Orders will update classifications.</p></div>
                                )}
                            </div>

                            <div className="card">
                                <div className="card-header">
                                    <div className="card-title">Classification Guide</div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {[
                                        { key: 'star', label: 'Stars', desc: 'High sales + High margin — Keep promoting these! They are your best performers.' },
                                        { key: 'workhorse', label: 'Workhorses', desc: 'High sales + Low margin — Popular but consider increasing price or reducing cost.' },
                                        { key: 'puzzle', label: 'Puzzles', desc: 'Low sales + High margin — High profit potential. Promote and position better.' },
                                        { key: 'dog', label: 'Dogs', desc: 'Low sales + Low margin — Consider removing or completely revamping these items.' },
                                    ].map((c) => (
                                        <div key={c.key} className={`classification-card ${c.key}`} style={{ padding: 14 }}>
                                            <h3 style={{ fontSize: 13, marginBottom: 4 }}>{classificationEmojis[c.key]} {c.label} ({classification?.[c.key + 's']?.length || classification?.[c.label.toLowerCase()]?.length || 0})</h3>
                                            <p style={{ fontSize: 12, color: 'var(--neutral-600)', margin: 0 }}>{c.desc}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Classification Details */}
                        <div className="classification-grid">
                            {[
                                { key: 'stars', label: 'Stars', emoji: '⭐', type: 'star' },
                                { key: 'workhorses', label: 'Workhorses', emoji: '🐎', type: 'workhorse' },
                                { key: 'puzzles', label: 'Puzzles', emoji: '❓', type: 'puzzle' },
                                { key: 'dogs', label: 'Dogs', emoji: '🐶', type: 'dog' },
                            ].map((c) => (
                                <div key={c.key} className={`classification-card ${c.type}`}>
                                    <h3>{c.emoji} {c.label}</h3>
                                    {classification?.[c.key]?.length > 0 ? (
                                        classification[c.key].map((item, idx) => (
                                            <div key={idx} className="classification-item">
                                                <span>{item.name}</span>
                                                <span style={{ fontWeight: 600 }}>₹{item.margin?.toFixed(0)} margin • {item.totalSales} sold</span>
                                            </div>
                                        ))
                                    ) : (
                                        <p style={{ fontSize: 12, color: 'var(--neutral-500)' }}>No items in this category</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Profitability Table */}
                {activeTab === 'profitability' && (
                    <div className="animate-fade-in-up">
                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Item</th>
                                        <th>Category</th>
                                        <th>Price</th>
                                        <th>Cost</th>
                                        <th>Margin</th>
                                        <th>Margin %</th>
                                        <th>Sales</th>
                                        <th>Total Profit</th>
                                        <th>Class</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {margins.map((item) => (
                                        <tr key={item.id}>
                                            <td style={{ fontWeight: 600 }}>{item.name}</td>
                                            <td>{item.category || '—'}</td>
                                            <td>₹{item.price.toFixed(2)}</td>
                                            <td>₹{item.costPrice.toFixed(2)}</td>
                                            <td style={{ color: 'var(--success-600)', fontWeight: 600 }}>₹{item.contributionMargin.toFixed(2)}</td>
                                            <td>
                                                <span className={`badge ${parseFloat(item.marginPercentage) > 50 ? 'badge-success' : parseFloat(item.marginPercentage) > 30 ? 'badge-warning' : 'badge-error'}`}>
                                                    {item.marginPercentage}%
                                                </span>
                                            </td>
                                            <td>{item.totalSales}</td>
                                            <td style={{ fontWeight: 600 }}>₹{item.totalProfit.toFixed(2)}</td>
                                            <td>
                                                {item.classification !== 'unclassified' && (
                                                    <span className={`badge badge-${item.classification}`}>
                                                        {classificationEmojis[item.classification]}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {margins.length === 0 && (
                                <div className="empty-state"><p>Add menu items to see profitability analysis.</p></div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </OwnerLayout>
    );
}
