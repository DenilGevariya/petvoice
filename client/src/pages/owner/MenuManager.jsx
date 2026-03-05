import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import OwnerLayout from '../../components/layout/OwnerLayout';
import { api } from '../../lib/api';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineCheck, HiOutlineX } from 'react-icons/hi';

const foodEmojis = ['🍕', '🍔', '🌮', '🍜', '🥗', '🍛', '🍣', '🥘', '☕', '🍰', '🧃', '🍟', '🥪', '🍱', '🥤'];

export default function MenuManager() {
    const navigate = useNavigate();
    const [restaurant, setRestaurant] = useState(null);
    const [categories, setCategories] = useState([]);
    const [menuItems, setMenuItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddItem, setShowAddItem] = useState(false);
    const [showAddCategory, setShowAddCategory] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [selectedCategory, setSelectedCategory] = useState(null);

    const [itemForm, setItemForm] = useState({
        name: '', description: '', price: '', costPrice: '', categoryId: '',
        isAvailable: true, isVeg: false, isBestseller: false, spiceLevel: 0, preparationTime: 15
    });

    const [categoryForm, setCategoryForm] = useState({ name: '', description: '' });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const res = await api.getMyRestaurant();
            if (!res.data) {
                navigate('/owner/setup');
                return;
            }
            setRestaurant(res.data);
            const [cats, items] = await Promise.all([
                api.getCategories(res.data.id),
                api.getMenuItems(res.data.id),
            ]);
            setCategories(cats.data || []);
            setMenuItems(items.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddCategory = async (e) => {
        e.preventDefault();
        if (!categoryForm.name) return toast.error('Category name is required');
        try {
            await api.createCategory({ restaurantId: restaurant.id, ...categoryForm });
            toast.success('Category added!');
            setCategoryForm({ name: '', description: '' });
            setShowAddCategory(false);
            loadData();
        } catch (err) {
            toast.error(err.message);
        }
    };

    const handleAddItem = async (e) => {
        e.preventDefault();
        if (!itemForm.name || !itemForm.price) return toast.error('Name and price are required');
        try {
            const body = {
                restaurantId: restaurant.id,
                ...itemForm,
                price: parseFloat(itemForm.price),
                costPrice: parseFloat(itemForm.costPrice) || 0,
                spiceLevel: parseInt(itemForm.spiceLevel),
                preparationTime: parseInt(itemForm.preparationTime),
            };

            if (editingItem) {
                await api.updateMenuItem(editingItem.id, body);
                toast.success('Item updated!');
            } else {
                await api.createMenuItem(body);
                toast.success('Item added!');
            }

            resetItemForm();
            loadData();
        } catch (err) {
            toast.error(err.message);
        }
    };

    const handleDeleteItem = async (id) => {
        if (!confirm('Delete this item?')) return;
        try {
            await api.deleteMenuItem(id);
            toast.success('Item deleted');
            loadData();
        } catch (err) {
            toast.error(err.message);
        }
    };

    const startEdit = (item) => {
        setEditingItem(item);
        setItemForm({
            name: item.name, description: item.description || '', price: item.price.toString(),
            costPrice: item.costPrice.toString(), categoryId: item.categoryId || '',
            isAvailable: item.isAvailable, isVeg: item.isVeg, isBestseller: item.isBestseller,
            spiceLevel: item.spiceLevel, preparationTime: item.preparationTime,
        });
        setShowAddItem(true);
    };

    const resetItemForm = () => {
        setItemForm({ name: '', description: '', price: '', costPrice: '', categoryId: '', isAvailable: true, isVeg: false, isBestseller: false, spiceLevel: 0, preparationTime: 15 });
        setEditingItem(null);
        setShowAddItem(false);
    };

    const filteredItems = selectedCategory
        ? menuItems.filter((i) => i.categoryId === selectedCategory)
        : menuItems;

    const getRandomEmoji = (name) => {
        const hash = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
        return foodEmojis[hash % foodEmojis.length];
    };

    if (loading) {
        return (
            <OwnerLayout>
                <div className="page-container">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="skeleton" style={{ height: 80, marginBottom: 16, borderRadius: 'var(--radius-lg)' }} />
                    ))}
                </div>
            </OwnerLayout>
        );
    }

    return (
        <OwnerLayout>
            <div className="page-container">
                <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1>Menu Manager</h1>
                        <p>Manage your menu items, categories, and pricing</p>
                    </div>
                    <div className="flex gap-2">
                        <button className="btn btn-secondary" onClick={() => setShowAddCategory(true)}>
                            <HiOutlinePlus size={16} /> Add Category
                        </button>
                        <button className="btn btn-primary" onClick={() => { resetItemForm(); setShowAddItem(true); }}>
                            <HiOutlinePlus size={16} /> Add Item
                        </button>
                    </div>
                </div>

                {/* Category Filter */}
                {categories.length > 0 && (
                    <div className="flex gap-2 mb-6" style={{ flexWrap: 'wrap' }}>
                        <button
                            className={`btn btn-sm ${!selectedCategory ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setSelectedCategory(null)}
                        >
                            All ({menuItems.length})
                        </button>
                        {categories.map((cat) => (
                            <button
                                key={cat.id}
                                className={`btn btn-sm ${selectedCategory === cat.id ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setSelectedCategory(cat.id)}
                            >
                                {cat.name} ({menuItems.filter((i) => i.categoryId === cat.id).length})
                            </button>
                        ))}
                    </div>
                )}

                {/* Menu Items */}
                {filteredItems.length > 0 ? (
                    <div className="stagger-children" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {filteredItems.map((item) => (
                            <div key={item.id} className="menu-item-card animate-fade-in-up">
                                <div className="menu-item-image">{getRandomEmoji(item.name)}</div>
                                <div className="menu-item-info">
                                    <div className="menu-item-name">
                                        {item.name}
                                        {item.isVeg && <span style={{ marginLeft: 6, color: 'var(--success-500)', fontSize: 12 }}>🟢 Veg</span>}
                                        {item.isBestseller && <span className="badge badge-star" style={{ marginLeft: 6 }}>⭐ Bestseller</span>}
                                    </div>
                                    {item.description && <div className="menu-item-desc">{item.description}</div>}
                                    <div className="menu-item-meta">
                                        {item.categoryName && <span className="badge badge-neutral">{item.categoryName}</span>}
                                        <span style={{ fontSize: 12, color: 'var(--neutral-500)' }}>Cost: ₹{item.costPrice}</span>
                                        <span style={{ fontSize: 12, color: 'var(--neutral-500)' }}>Margin: {item.marginPercentage}%</span>
                                        <span style={{ fontSize: 12, color: 'var(--neutral-500)' }}>Sales: {item.totalSales}</span>
                                        {!item.isAvailable && <span className="badge badge-error">Unavailable</span>}
                                    </div>
                                </div>
                                <div className="menu-item-price">₹{item.price}</div>
                                <div className="menu-item-actions">
                                    <button className="btn btn-ghost btn-icon sm" onClick={() => startEdit(item)}><HiOutlinePencil size={16} /></button>
                                    <button className="btn btn-ghost btn-icon sm" onClick={() => handleDeleteItem(item.id)} style={{ color: 'var(--error-500)' }}><HiOutlineTrash size={16} /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="empty-state">
                        <div className="empty-state-icon">🍽️</div>
                        <h3>No menu items yet</h3>
                        <p>Start by adding categories and menu items for your restaurant.</p>
                        <button className="btn btn-primary" onClick={() => setShowAddItem(true)}>
                            <HiOutlinePlus size={16} /> Add First Item
                        </button>
                    </div>
                )}

                {/* Add/Edit Item Modal */}
                {showAddItem && (
                    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && resetItemForm()}>
                        <div className="modal" style={{ maxWidth: 560 }}>
                            <div className="modal-header">
                                <h2>{editingItem ? 'Edit Item' : 'Add Menu Item'}</h2>
                                <button className="modal-close" onClick={resetItemForm}><HiOutlineX size={20} /></button>
                            </div>
                            <form className="modal-body" onSubmit={handleAddItem}>
                                <div className="form-group">
                                    <label className="form-label">Item Name *</label>
                                    <input className="form-input" placeholder="e.g., Margherita Pizza" value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Description</label>
                                    <textarea className="form-input form-textarea" placeholder="Brief description..." value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} />
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Selling Price (₹) *</label>
                                        <input className="form-input" type="number" step="0.01" placeholder="299.00" value={itemForm.price} onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Cost Price (₹) *</label>
                                        <input className="form-input" type="number" step="0.01" placeholder="150.00" value={itemForm.costPrice} onChange={(e) => setItemForm({ ...itemForm, costPrice: e.target.value })} />
                                    </div>
                                </div>
                                {categories.length > 0 && (
                                    <div className="form-group">
                                        <label className="form-label">Category</label>
                                        <select className="form-input form-select" value={itemForm.categoryId} onChange={(e) => setItemForm({ ...itemForm, categoryId: e.target.value })}>
                                            <option value="">No category</option>
                                            {categories.map((cat) => (
                                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Spice Level (0-5)</label>
                                        <input className="form-input" type="number" min="0" max="5" value={itemForm.spiceLevel} onChange={(e) => setItemForm({ ...itemForm, spiceLevel: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Prep Time (mins)</label>
                                        <input className="form-input" type="number" min="1" value={itemForm.preparationTime} onChange={(e) => setItemForm({ ...itemForm, preparationTime: e.target.value })} />
                                    </div>
                                </div>
                                <div className="flex gap-4 mb-4">
                                    <label className="form-checkbox">
                                        <input type="checkbox" checked={itemForm.isAvailable} onChange={(e) => setItemForm({ ...itemForm, isAvailable: e.target.checked })} />
                                        <span>Available</span>
                                    </label>
                                    <label className="form-checkbox">
                                        <input type="checkbox" checked={itemForm.isVeg} onChange={(e) => setItemForm({ ...itemForm, isVeg: e.target.checked })} />
                                        <span>Vegetarian</span>
                                    </label>
                                    <label className="form-checkbox">
                                        <input type="checkbox" checked={itemForm.isBestseller} onChange={(e) => setItemForm({ ...itemForm, isBestseller: e.target.checked })} />
                                        <span>Bestseller</span>
                                    </label>
                                </div>
                                <div className="modal-footer" style={{ padding: 0 }}>
                                    <button type="button" className="btn btn-secondary" onClick={resetItemForm}>Cancel</button>
                                    <button type="submit" className="btn btn-primary">
                                        <HiOutlineCheck size={16} /> {editingItem ? 'Update Item' : 'Add Item'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Add Category Modal */}
                {showAddCategory && (
                    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowAddCategory(false)}>
                        <div className="modal" style={{ maxWidth: 420 }}>
                            <div className="modal-header">
                                <h2>Add Category</h2>
                                <button className="modal-close" onClick={() => setShowAddCategory(false)}><HiOutlineX size={20} /></button>
                            </div>
                            <form className="modal-body" onSubmit={handleAddCategory}>
                                <div className="form-group">
                                    <label className="form-label">Category Name *</label>
                                    <input className="form-input" placeholder="e.g., Starters, Main Course" value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Description</label>
                                    <input className="form-input" placeholder="Brief description..." value={categoryForm.description} onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })} />
                                </div>
                                <div className="modal-footer" style={{ padding: 0 }}>
                                    <button type="button" className="btn btn-secondary" onClick={() => setShowAddCategory(false)}>Cancel</button>
                                    <button type="submit" className="btn btn-primary"><HiOutlineCheck size={16} /> Add Category</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </OwnerLayout>
    );
}
