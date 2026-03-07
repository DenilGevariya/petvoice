import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { HiOutlineMicrophone, HiOutlineChartBar, HiOutlineSparkles, HiOutlineGlobe } from 'react-icons/hi';

export default function RegisterPage() {
    const [form, setForm] = useState({
        fullName: '',
        email: '',
        password: '',
        confirmPassword: '',
        role: 'customer',
        phone: '',
    });
    const [loading, setLoading] = useState(false);
    const { register } = useAuth();
    const navigate = useNavigate();

    const updateField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.fullName || !form.email || !form.password) {
            toast.error('Please fill in all required fields');
            return;
        }
        if (form.password !== form.confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }
        if (form.password.length < 6) {
            toast.error('Password must be at least 6 characters');
            return;
        }

        setLoading(true);
        try {
            const user = await register({
                fullName: form.fullName,
                email: form.email,
                password: form.password,
                role: form.role,
                phone: form.phone,
            });
            toast.success('Account created successfully!');
            if (user.role === 'owner') {
                navigate('/owner/setup');
            } else {
                navigate('/voice-order');
            }
        } catch (err) {
            toast.error(err.message || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-left">
                <form className="auth-form animate-fade-in-up" onSubmit={handleSubmit}>
                    <div className="auth-form-header">
                        <div className="auth-form-logo">R</div>
                        <h1>Create Account</h1>
                        <p>Join RestroBrain — The future of restaurant ordering</p>
                    </div>

                    <div className="auth-role-selector">
                        <button
                            type="button"
                            className={`auth-role-btn ${form.role === 'customer' ? 'active' : ''}`}
                            onClick={() => updateField('role', 'customer')}
                        >
                            <div className="role-icon">🛒</div>
                            <div className="role-name">Customer</div>
                            <div className="role-desc">Order food via AI</div>
                        </button>
                        <button
                            type="button"
                            className={`auth-role-btn ${form.role === 'owner' ? 'active' : ''}`}
                            onClick={() => updateField('role', 'owner')}
                        >
                            <div className="role-icon">🏪</div>
                            <div className="role-name">Restaurant Owner</div>
                            <div className="role-desc">Manage & optimize</div>
                        </button>
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="fullName">Full Name</label>
                        <input
                            id="fullName"
                            type="text"
                            className="form-input"
                            placeholder="John Doe"
                            value={form.fullName}
                            onChange={(e) => updateField('fullName', e.target.value)}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="regEmail">Email Address</label>
                        <input
                            id="regEmail"
                            type="email"
                            className="form-input"
                            placeholder="you@example.com"
                            value={form.email}
                            onChange={(e) => updateField('email', e.target.value)}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="phone">Phone (optional)</label>
                        <input
                            id="phone"
                            type="tel"
                            className="form-input"
                            placeholder="+91 9876543210"
                            value={form.phone}
                            onChange={(e) => updateField('phone', e.target.value)}
                        />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label" htmlFor="regPassword">Password</label>
                            <input
                                id="regPassword"
                                type="password"
                                className="form-input"
                                placeholder="••••••••"
                                value={form.password}
                                onChange={(e) => updateField('password', e.target.value)}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="confirmPassword">Confirm</label>
                            <input
                                id="confirmPassword"
                                type="password"
                                className="form-input"
                                placeholder="••••••••"
                                value={form.confirmPassword}
                                onChange={(e) => updateField('confirmPassword', e.target.value)}
                            />
                        </div>
                    </div>

                    <button type="submit" className="btn btn-primary btn-lg w-full" disabled={loading}>
                        {loading ? 'Creating account...' : 'Create Account'}
                    </button>

                    <div className="auth-footer">
                        Already have an account? <Link to="/login">Sign in</Link>
                    </div>
                </form>
            </div>

            <div className="auth-right">
                <div className="auth-right-content animate-fade-in">
                    <h2>AI-Powered Restaurant Intelligence</h2>
                    <p>
                        Transform your restaurant with voice ordering, revenue analytics,
                        and AI-powered menu optimization.
                    </p>
                    <div className="auth-right-features">
                        <div className="auth-right-feature">
                            <span className="auth-right-feature-icon"><HiOutlineMicrophone /></span>
                            <span>Voice-powered food ordering</span>
                        </div>
                        <div className="auth-right-feature">
                            <span className="auth-right-feature-icon"><HiOutlineChartBar /></span>
                            <span>Revenue intelligence dashboard</span>
                        </div>
                        <div className="auth-right-feature">
                            <span className="auth-right-feature-icon"><HiOutlineSparkles /></span>
                            <span>AI upselling & combo suggestions</span>
                        </div>
                        <div className="auth-right-feature">
                            <span className="auth-right-feature-icon"><HiOutlineGlobe /></span>
                            <span>Multi-language support</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
