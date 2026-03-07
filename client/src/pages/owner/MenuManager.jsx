import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import OwnerLayout from '../../components/layout/OwnerLayout';
import { api } from '../../lib/api';
import toast from 'react-hot-toast';
import {
    HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineCheck,
    HiOutlineX, HiOutlinePhotograph, HiOutlineViewGrid,
    HiOutlineCollection, HiOutlineGift, HiOutlineTag
} from 'react-icons/hi';

export default function MenuManager() {
    const navigate = useNavigate();
    const fileInputRef = useRef(null);
    const [restaurant, setRestaurant] = useState(null);
    const [categories, setCategories] = useState([]);
    const [menuItems, setMenuItems] = useState([]);
    const [combos, setCombos] = useState([]);
    const [loading, setLoading] = useState(true);

    // UI State
    const [activeTab, setActiveTab] = useState('items'); // 'items', 'combos', 'bogo'
    const [selectedCategory, setSelectedCategory] = useState(null);

    // Items Form State
    const [showAddItem, setShowAddItem] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [showAddCategory, setShowAddCategory] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [imagePreview, setImagePreview] = useState(null);
    const [itemForm, setItemForm] = useState({
        name: '', description: '', price: '', costPrice: '', categoryId: '',
        isAvailable: true, isVeg: false, isBestseller: false, spiceLevel: 0, preparationTime: 15, imageUrl: ''
    });
    const [categoryForm, setCategoryForm] = useState({ name: '', description: '' });

    // Combos Form State
    const [showAddCombo, setShowAddCombo] = useState(false);
    const [editingCombo, setEditingCombo] = useState(null);
    const [comboForm, setComboForm] = useState({ name: '', description: '', comboPrice: '', items: [] });

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const res = await api.getMyRestaurant();
            if (!res.data) { navigate('/owner/setup'); return; }
            setRestaurant(res.data);
            const [cats, items, combosRes] = await Promise.all([
                api.getCategories(res.data.id),
                api.getMenuItems(res.data.id),
                api.getCombos(res.data.id),
            ]);
            setCategories(cats.data || []);
            setMenuItems(items.data || []);
            setCombos(combosRes.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // ================= MENU ITEMS LOGIC =================

    const handleImageChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return; }
        setImagePreview(URL.createObjectURL(file));
        setUploading(true);
        try {
            const result = await api.uploadImage(file);
            setItemForm(prev => ({ ...prev, imageUrl: result.data.url }));
            toast.success('Image uploaded!');
        } catch (err) {
            toast.error('Image upload failed: ' + err.message);
            setImagePreview(null);
        } finally {
            setUploading(false);
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
                name: itemForm.name,
                description: itemForm.description || null,
                price: parseFloat(itemForm.price),
                costPrice: parseFloat(itemForm.costPrice) || 0,
                categoryId: itemForm.categoryId || null,
                isAvailable: itemForm.isAvailable,
                isVeg: itemForm.isVeg,
                isBestseller: itemForm.isBestseller,
                spiceLevel: parseInt(itemForm.spiceLevel) || 0,
                preparationTime: parseInt(itemForm.preparationTime) || 15,
                imageUrl: itemForm.imageUrl || null,
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

    const startEditItem = (item) => {
        setEditingItem(item);
        setItemForm({
            name: item.name, description: item.description || '', price: item.price.toString(),
            costPrice: item.costPrice.toString(), categoryId: item.categoryId || '',
            isAvailable: item.isAvailable, isVeg: item.isVeg, isBestseller: item.isBestseller,
            spiceLevel: item.spiceLevel, preparationTime: item.preparationTime,
            imageUrl: item.imageUrl || '',
        });
        setImagePreview(item.imageUrl || null);
        setShowAddItem(true);
    };

    const resetItemForm = () => {
        setItemForm({ name: '', description: '', price: '', costPrice: '', categoryId: '', isAvailable: true, isVeg: false, isBestseller: false, spiceLevel: 0, preparationTime: 15, imageUrl: '' });
        setEditingItem(null);
        setShowAddItem(false);
        setImagePreview(null);
    };

    // ================= COMBOS LOGIC =================

    const resetComboForm = () => {
        setComboForm({ name: '', description: '', comboPrice: '', items: [] });
        setEditingCombo(null);
        setShowAddCombo(false);
    };

    const startEditCombo = (combo) => {
        setEditingCombo(combo);
        setComboForm({
            name: combo.name,
            description: combo.description || '',
            comboPrice: combo.comboPrice.toString(),
            items: combo.items.map(i => ({ menuItemId: i.id, quantity: i.quantity }))
        });
        setShowAddCombo(true);
    };

    const handleSaveCombo = async (e) => {
        e.preventDefault();
        if (!comboForm.name || !comboForm.comboPrice || comboForm.items.length === 0) {
            return toast.error('Name, price and at least one item are required');
        }
        try {
            const body = {
                restaurantId: restaurant.id,
                name: comboForm.name,
                description: comboForm.description,
                comboPrice: parseFloat(comboForm.comboPrice),
                items: comboForm.items
            };

            if (editingCombo) {
                await api.updateCombo(editingCombo.id, body);
                toast.success('Combo updated!');
            } else {
                await api.createCombo(body);
                toast.success('Combo created!');
            }
            resetComboForm();
            loadData();
        } catch (err) {
            toast.error(err.message);
        }
    };

    const handleDeleteCombo = async (id) => {
        if (!confirm('Delete this combo?')) return;
        try {
            await api.deleteCombo(id);
            toast.success('Combo deleted');
            loadData();
        } catch (err) {
            toast.error(err.message);
        }
    };

    // ================= BOGO LOGIC =================

    const toggleBogoStatus = async (item) => {
        try {
            await api.updateMenuItem(item.id, {
                ...item,
                isBogo: !item.isBogo
            });
            toast.success(item.isBogo ? 'BOGO offer removed' : 'BOGO offer activated');
            loadData();
        } catch (err) {
            toast.error(err.message);
        }
    };

    const filteredItems = selectedCategory ? menuItems.filter((i) => i.categoryId === selectedCategory) : menuItems;
    const bogoItems = menuItems.filter(i => i.isBogo);

    if (loading) {
        return (
            <OwnerLayout>
                <div className="page-container">
                    <div className="menu-cards-grid">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <div key={i} className="skeleton" style={{ height: 280, borderRadius: 'var(--radius-lg)' }} />
                        ))}
                    </div>
                </div>
            </OwnerLayout>
        );
    }

    return (
        <OwnerLayout>
            <div className="page-container">
                <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1>🍽️ Menu Manager</h1>
                        <p>Manage items, combos, and promotions</p>
                    </div>
                    {activeTab === 'items' && (
                        <div className="flex gap-2">
                            <button className="btn btn-secondary" onClick={() => setShowAddCategory(true)}>
                                <HiOutlinePlus size={16} /> Add Category
                            </button>
                            <button className="btn btn-primary" onClick={() => { resetItemForm(); setShowAddItem(true); }}>
                                <HiOutlinePlus size={16} /> Add Item
                            </button>
                        </div>
                    )}
                    {activeTab === 'combos' && (
                        <button className="btn btn-primary" onClick={() => { resetComboForm(); setShowAddCombo(true); }}>
                            <HiOutlinePlus size={16} /> Add Combo
                        </button>
                    )}
                </div>

                {/* Tabs UI */}
                <div className="sug-tabs mb-6" style={{ marginTop: '20px' }}>
                    <button className={`sug-tab ${activeTab === 'items' ? 'sug-tab--active' : ''}`} onClick={() => setActiveTab('items')}>
                        <HiOutlineViewGrid size={16} /> Menu Items
                    </button>
                    <button className={`sug-tab ${activeTab === 'combos' ? 'sug-tab--active' : ''}`} onClick={() => setActiveTab('combos')}>
                        <HiOutlineCollection size={16} /> Combos
                    </button>
                    <button className={`sug-tab ${activeTab === 'bogo' ? 'sug-tab--active' : ''}`} onClick={() => setActiveTab('bogo')}>
                        <HiOutlineGift size={16} /> BOGO Offers
                    </button>
                </div>

                {/* ================= TAB: ITEMS ================= */}
                {activeTab === 'items' && (
                    <>
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

                        {filteredItems.length > 0 ? (
                            <div className="menu-cards-grid stagger-children">
                                {filteredItems.map((item) => {
                                    const profit = item.price - item.costPrice;
                                    const profitColor = profit >= 100 ? 'var(--success-600)' : profit >= 50 ? 'var(--brand-600)' : profit > 0 ? 'var(--warning-600)' : 'var(--error-500)';
                                    return (
                                        <div key={item.id} className="menu-card animate-fade-in-up">
                                            <div className="menu-card-image">
                                                {item.imageUrl ? (
                                                    <img src={item.imageUrl} alt={item.name} />
                                                ) : (
                                                    <div className="menu-card-placeholder">
                                                        <HiOutlinePhotograph size={32} />
                                                        <span>No image</span>
                                                    </div>
                                                )}
                                                {!item.isAvailable && <div className="menu-card-unavailable">Unavailable</div>}
                                                {item.isBestseller && <div className="menu-card-badge">⭐ Bestseller</div>}
                                            </div>

                                            <div className="menu-card-body">
                                                <div className="menu-card-name">
                                                    {item.isVeg && <span className="veg-dot">●</span>}
                                                    {item.name}
                                                </div>

                                                {item.categoryName && <div className="menu-card-category">{item.categoryName}</div>}

                                                <div className="menu-card-pricing">
                                                    <div className="menu-card-price">₹{item.price}</div>
                                                    <div className="menu-card-profit" style={{ color: profitColor }}>
                                                        Profit: ₹{profit.toFixed(0)}
                                                    </div>
                                                </div>

                                                <div className="menu-card-actions">
                                                    <button className="btn btn-sm btn-secondary" onClick={() => startEditItem(item)}>
                                                        <HiOutlinePencil size={14} /> Edit
                                                    </button>
                                                    <button className="btn btn-sm btn-ghost" onClick={() => handleDeleteItem(item.id)} style={{ color: 'var(--error-500)' }}>
                                                        <HiOutlineTrash size={14} /> Delete
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
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
                    </>
                )}

                {/* ================= TAB: COMBOS ================= */}
                {activeTab === 'combos' && (
                    <>
                        {combos.length > 0 ? (
                            <div className="menu-cards-grid stagger-children">
                                {combos.map((combo) => (
                                    <div key={combo.id} className="menu-card animate-fade-in-up">
                                        <div className="menu-card-body">
                                            <div className="menu-card-name">{combo.name}</div>
                                            <div className="menu-card-category">{combo.items.length} Items Included</div>

                                            <div className="menu-card-pricing" style={{ marginTop: '12px', borderTop: '1px solid var(--neutral-200)', paddingTop: '12px' }}>
                                                <div>
                                                    <div style={{ fontSize: '11px', color: 'var(--neutral-500)' }}>Original: <span style={{ textDecoration: 'line-through' }}>₹{combo.originalPrice}</span></div>
                                                    <div className="menu-card-price">₹{combo.comboPrice}</div>
                                                </div>
                                                <div className="menu-card-profit" style={{ color: 'var(--success-600)', fontWeight: 600 }}>
                                                    {combo.discountPercentage}% OFF
                                                </div>
                                            </div>

                                            <div style={{ fontSize: '12px', color: 'var(--neutral-500)', marginTop: '8px' }}>
                                                {combo.items.map(i => `${i.quantity}x ${i.name}`).join(' + ')}
                                            </div>

                                            <div className="menu-card-actions" style={{ marginTop: '16px' }}>
                                                <button className="btn btn-sm btn-secondary" onClick={() => startEditCombo(combo)}>
                                                    <HiOutlinePencil size={14} /> Edit
                                                </button>
                                                <button className="btn btn-sm btn-ghost" onClick={() => handleDeleteCombo(combo.id)} style={{ color: 'var(--error-500)' }}>
                                                    <HiOutlineTrash size={14} /> Delete
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="empty-state">
                                <div className="empty-state-icon">🛍️</div>
                                <h3>No combos created yet</h3>
                                <p>Bundle items together at a discount to drive higher ticket sizes.</p>
                                <button className="btn btn-primary" onClick={() => { resetComboForm(); setShowAddCombo(true); }}>
                                    <HiOutlinePlus size={16} /> Create Combo
                                </button>
                            </div>
                        )}
                    </>
                )}

                {/* ================= TAB: BOGO OFFERS ================= */}
                {activeTab === 'bogo' && (
                    <>
                        <div className="menu-cards-grid stagger-children">
                            {menuItems.map((item) => (
                                <div key={item.id} className="menu-card animate-fade-in-up" style={{
                                    border: item.isBogo ? '2px solid var(--brand-500)' : '1px solid var(--neutral-200)'
                                }}>
                                    <div className="menu-card-image">
                                        {item.imageUrl ? (
                                            <img src={item.imageUrl} alt={item.name} />
                                        ) : (
                                            <div className="menu-card-placeholder">
                                                <HiOutlinePhotograph size={32} />
                                                <span>No image</span>
                                            </div>
                                        )}
                                        {item.isBogo && (
                                            <div className="menu-card-badge" style={{ background: 'var(--brand-500)' }}>⭐ ACTIVE BOGO</div>
                                        )}
                                    </div>

                                    <div className="menu-card-body">
                                        <div className="menu-card-name">
                                            {item.name}
                                        </div>
                                        <div className="menu-card-pricing">
                                            <div className="menu-card-price">₹{item.price}</div>
                                        </div>

                                        {item.isBogo && (
                                            <div style={{ fontSize: '13px', color: 'var(--brand-600)', background: 'var(--brand-50)', padding: '6px', borderRadius: '4px', margin: '8px 0', textAlign: 'center', fontWeight: 'bold' }}>
                                                Buy 1, Get 1 Free!
                                            </div>
                                        )}

                                        <div className="menu-card-actions" style={{ marginTop: '12px' }}>
                                            {item.isBogo ? (
                                                <button className="btn btn-sm w-full" style={{ background: 'var(--error-50)', color: 'var(--error-600)' }} onClick={() => toggleBogoStatus(item)}>
                                                    <HiOutlineX size={14} /> Remove Offer
                                                </button>
                                            ) : (
                                                <button className="btn btn-sm btn-secondary w-full" onClick={() => toggleBogoStatus(item)}>
                                                    <HiOutlineGift size={14} /> Activate BOGO
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {/* ================= MODALS ================= */}

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
                                    <label className="form-label">Item Image</label>
                                    <div className="image-upload-zone" onClick={() => fileInputRef.current?.click()} style={{ cursor: 'pointer' }}>
                                        {imagePreview || itemForm.imageUrl ? (
                                            <img src={imagePreview || itemForm.imageUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'var(--radius-md)' }} />
                                        ) : (
                                            <div className="image-upload-placeholder">
                                                <HiOutlinePhotograph size={32} />
                                                <span>{uploading ? 'Uploading...' : 'Click to upload'}</span>
                                            </div>
                                        )}
                                    </div>
                                    <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageChange} />
                                </div>

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
                                            {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                                        </select>
                                    </div>
                                )}
                                <div className="modal-footer" style={{ padding: 0, marginTop: '20px' }}>
                                    <button type="button" className="btn btn-secondary" onClick={resetItemForm}>Cancel</button>
                                    <button type="submit" className="btn btn-primary" disabled={uploading}><HiOutlineCheck size={16} /> Save Item</button>
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
                                    <input className="form-input" value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} />
                                </div>
                                <div className="modal-footer" style={{ padding: 0 }}>
                                    <button type="button" className="btn btn-secondary" onClick={() => setShowAddCategory(false)}>Cancel</button>
                                    <button type="submit" className="btn btn-primary"><HiOutlineCheck size={16} /> Save</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Add/Edit Combo Modal */}
                {showAddCombo && (
                    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && resetComboForm()}>
                        <div className="modal" style={{ maxWidth: 560 }}>
                            <div className="modal-header">
                                <h2>{editingCombo ? 'Edit Combo' : 'Add Combo'}</h2>
                                <button className="modal-close" onClick={resetComboForm}><HiOutlineX size={20} /></button>
                            </div>
                            <form className="modal-body" onSubmit={handleSaveCombo}>
                                <div className="form-group">
                                    <label className="form-label">Combo Name *</label>
                                    <input className="form-input" placeholder="e.g., Weekend Family Pack" value={comboForm.name} onChange={(e) => setComboForm({ ...comboForm, name: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Description</label>
                                    <input className="form-input" placeholder="Brief description..." value={comboForm.description} onChange={(e) => setComboForm({ ...comboForm, description: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Combo Price (₹) *</label>
                                    <input className="form-input" type="number" step="0.01" placeholder="499.00" value={comboForm.comboPrice} onChange={(e) => setComboForm({ ...comboForm, comboPrice: e.target.value })} />
                                    <div style={{ fontSize: '11px', color: 'var(--neutral-500)', marginTop: '4px' }}>
                                        Set a price lower than the total price of included items to offer a discount.
                                    </div>
                                </div>

                                <label className="form-label">Included Items</label>
                                {comboForm.items.map((item, index) => (
                                    <div key={index} className="flex gap-2 mb-2">
                                        <select
                                            className="form-input form-select"
                                            value={item.menuItemId}
                                            onChange={(e) => {
                                                const newItems = [...comboForm.items];
                                                newItems[index].menuItemId = e.target.value;
                                                setComboForm({ ...comboForm, items: newItems });
                                            }}
                                            style={{ flex: 1 }}
                                        >
                                            <option value="">Select Item</option>
                                            {menuItems.map(mi => (
                                                <option key={mi.id} value={mi.id}>{mi.name} (₹{mi.price})</option>
                                            ))}
                                        </select>
                                        <input
                                            type="number"
                                            className="form-input"
                                            min="1"
                                            value={item.quantity}
                                            onChange={(e) => {
                                                const newItems = [...comboForm.items];
                                                newItems[index].quantity = parseInt(e.target.value) || 1;
                                                setComboForm({ ...comboForm, items: newItems });
                                            }}
                                            style={{ width: '80px' }}
                                        />
                                        <button type="button" className="btn btn-secondary px-2" onClick={() => {
                                            const newItems = comboForm.items.filter((_, i) => i !== index);
                                            setComboForm({ ...comboForm, items: newItems });
                                        }}>
                                            <HiOutlineTrash size={16} color="var(--error-500)" />
                                        </button>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    className="btn btn-sm btn-ghost mt-2"
                                    onClick={() => setComboForm({ ...comboForm, items: [...comboForm.items, { menuItemId: '', quantity: 1 }] })}
                                >
                                    <HiOutlinePlus size={14} /> Add Another Item
                                </button>

                                <div className="modal-footer" style={{ padding: 0, marginTop: '20px' }}>
                                    <button type="button" className="btn btn-secondary" onClick={resetComboForm}>Cancel</button>
                                    <button type="submit" className="btn btn-primary"><HiOutlineCheck size={16} /> Save Combo</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

            </div>
        </OwnerLayout>
    );
}
