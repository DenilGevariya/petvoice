import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import OwnerLayout from '../../components/layout/OwnerLayout';
import { api } from '../../lib/api';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineCheck, HiOutlineX, HiOutlinePhotograph } from 'react-icons/hi';

export default function MenuManager() {
    const navigate = useNavigate();
    const fileInputRef = useRef(null);
    const [restaurant, setRestaurant] = useState(null);
    const [categories, setCategories] = useState([]);
    const [menuItems, setMenuItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddItem, setShowAddItem] = useState(false);
    const [showAddCategory, setShowAddCategory] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [imagePreview, setImagePreview] = useState(null);

    const [itemForm, setItemForm] = useState({
        name: '', description: '', price: '', costPrice: '', categoryId: '',
        isAvailable: true, isVeg: false, isBestseller: false, spiceLevel: 0, preparationTime: 15, imageUrl: ''
    });

    const [categoryForm, setCategoryForm] = useState({ name: '', description: '' });

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const res = await api.getMyRestaurant();
            if (!res.data) { navigate('/owner/setup'); return; }
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

    const handleImageChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return; }

        // Show preview immediately
        setImagePreview(URL.createObjectURL(file));

        // Upload to Cloudinary
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

    const startEdit = (item) => {
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

    const filteredItems = selectedCategory
        ? menuItems.filter((i) => i.categoryId === selectedCategory)
        : menuItems;

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
                        <p>Add, edit, and manage your menu items</p>
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

                {/* Menu Item Cards */}
                {filteredItems.length > 0 ? (
                    <div className="menu-cards-grid stagger-children">
                        {filteredItems.map((item) => {
                            const profit = item.price - item.costPrice;
                            const profitColor = profit >= 100 ? 'var(--success-600)' : profit >= 50 ? 'var(--brand-600)' : profit > 0 ? 'var(--warning-600)' : 'var(--error-500)';
                            return (
                                <div key={item.id} className="menu-card animate-fade-in-up">
                                    {/* Image */}
                                    <div className="menu-card-image">
                                        {item.imageUrl ? (
                                            <img src={item.imageUrl} alt={item.name} />
                                        ) : (
                                            <div className="menu-card-placeholder">
                                                <HiOutlinePhotograph size={32} />
                                                <span>No image</span>
                                            </div>
                                        )}
                                        {!item.isAvailable && (
                                            <div className="menu-card-unavailable">Unavailable</div>
                                        )}
                                        {item.isBestseller && (
                                            <div className="menu-card-badge">⭐ Bestseller</div>
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="menu-card-body">
                                        <div className="menu-card-name">
                                            {item.isVeg && <span className="veg-dot">●</span>}
                                            {item.name}
                                        </div>

                                        {item.categoryName && (
                                            <div className="menu-card-category">{item.categoryName}</div>
                                        )}

                                        <div className="menu-card-pricing">
                                            <div className="menu-card-price">₹{item.price}</div>
                                            <div className="menu-card-profit" style={{ color: profitColor }}>
                                                Profit: ₹{profit.toFixed(0)}
                                            </div>
                                        </div>

                                        <div className="menu-card-actions">
                                            <button className="btn btn-sm btn-secondary" onClick={() => startEdit(item)}>
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

                {/* Add/Edit Item Modal */}
                {showAddItem && (
                    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && resetItemForm()}>
                        <div className="modal" style={{ maxWidth: 560 }}>
                            <div className="modal-header">
                                <h2>{editingItem ? 'Edit Item' : 'Add Menu Item'}</h2>
                                <button className="modal-close" onClick={resetItemForm}><HiOutlineX size={20} /></button>
                            </div>
                            <form className="modal-body" onSubmit={handleAddItem}>
                                {/* Image Upload */}
                                <div className="form-group">
                                    <label className="form-label">Item Image</label>
                                    <div
                                        className="image-upload-zone"
                                        onClick={() => fileInputRef.current?.click()}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        {imagePreview || itemForm.imageUrl ? (
                                            <img
                                                src={imagePreview || itemForm.imageUrl}
                                                alt="Preview"
                                                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'var(--radius-md)' }}
                                            />
                                        ) : (
                                            <div className="image-upload-placeholder">
                                                <HiOutlinePhotograph size={32} />
                                                <span>{uploading ? 'Uploading...' : 'Click to upload image'}</span>
                                                <span style={{ fontSize: 11, color: 'var(--neutral-400)' }}>JPG, PNG or WebP • Max 5MB</span>
                                            </div>
                                        )}
                                        {uploading && (
                                            <div className="image-upload-overlay">
                                                <div className="animate-spin" style={{ width: 24, height: 24, border: '3px solid var(--neutral-200)', borderTopColor: 'var(--brand-500)', borderRadius: '50%' }} />
                                            </div>
                                        )}
                                    </div>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        style={{ display: 'none' }}
                                        onChange={handleImageChange}
                                    />
                                    {(imagePreview || itemForm.imageUrl) && (
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-ghost"
                                            style={{ marginTop: 8, color: 'var(--error-500)' }}
                                            onClick={() => { setImagePreview(null); setItemForm(prev => ({ ...prev, imageUrl: '' })); }}
                                        >
                                            Remove image
                                        </button>
                                    )}
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

                                {/* Live profit preview */}
                                {itemForm.price && itemForm.costPrice && (
                                    <div style={{
                                        padding: '10px 14px', borderRadius: 'var(--radius-md)',
                                        background: 'var(--success-50)', marginBottom: 20,
                                        fontSize: 13, fontWeight: 600, color: 'var(--success-700)',
                                        display: 'flex', justifyContent: 'space-between',
                                    }}>
                                        <span>Profit: ₹{(parseFloat(itemForm.price) - parseFloat(itemForm.costPrice)).toFixed(2)}</span>
                                        <span>{parseFloat(itemForm.price) > 0 ? (((parseFloat(itemForm.price) - parseFloat(itemForm.costPrice)) / parseFloat(itemForm.price)) * 100).toFixed(1) : 0}% margin</span>
                                    </div>
                                )}

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
                                    <button type="submit" className="btn btn-primary" disabled={uploading}>
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
