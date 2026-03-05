import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import toast from 'react-hot-toast';

export default function SetupRestaurant() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({
        name: '',
        description: '',
        cuisineType: '',
        address: '',
        city: '',
        phone: '',
        email: '',
        openingTime: '09:00',
        closingTime: '23:00',
    });

    const updateField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name) {
            toast.error('Restaurant name is required');
            return;
        }

        setLoading(true);
        try {
            await api.createRestaurant(form);
            toast.success('Restaurant created! Let\'s add your menu items.');
            navigate('/owner/menu');
        } catch (err) {
            toast.error(err.message || 'Failed to create restaurant');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, background: 'var(--surface-base)' }}>
            <div className="card animate-fade-in-up" style={{ maxWidth: 640, width: '100%' }}>
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>🏪</div>
                    <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Set Up Your Restaurant</h1>
                    <p style={{ color: 'var(--neutral-500)', fontSize: 15 }}>Tell us about your restaurant to get started</p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label" htmlFor="restName">Restaurant Name *</label>
                        <input id="restName" className="form-input" placeholder="e.g., Pizza Palace" value={form.name} onChange={(e) => updateField('name', e.target.value)} />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="restDesc">Description</label>
                        <textarea id="restDesc" className="form-input form-textarea" placeholder="Describe your restaurant..." value={form.description} onChange={(e) => updateField('description', e.target.value)} />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label" htmlFor="cuisine">Cuisine Type</label>
                            <input id="cuisine" className="form-input" placeholder="e.g., Italian, Indian" value={form.cuisineType} onChange={(e) => updateField('cuisineType', e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="restCity">City</label>
                            <input id="restCity" className="form-input" placeholder="e.g., Mumbai" value={form.city} onChange={(e) => updateField('city', e.target.value)} />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="restAddr">Address</label>
                        <input id="restAddr" className="form-input" placeholder="Full address" value={form.address} onChange={(e) => updateField('address', e.target.value)} />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label" htmlFor="restPhone">Phone</label>
                            <input id="restPhone" className="form-input" placeholder="+91 9876543210" value={form.phone} onChange={(e) => updateField('phone', e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="restEmail">Email</label>
                            <input id="restEmail" className="form-input" placeholder="restaurant@email.com" value={form.email} onChange={(e) => updateField('email', e.target.value)} />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label" htmlFor="openTime">Opening Time</label>
                            <input id="openTime" type="time" className="form-input" value={form.openingTime} onChange={(e) => updateField('openingTime', e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="closeTime">Closing Time</label>
                            <input id="closeTime" type="time" className="form-input" value={form.closingTime} onChange={(e) => updateField('closingTime', e.target.value)} />
                        </div>
                    </div>

                    <button type="submit" className="btn btn-primary btn-lg w-full mt-4" disabled={loading}>
                        {loading ? 'Creating...' : 'Create Restaurant'}
                    </button>
                </form>
            </div>
        </div>
    );
}
