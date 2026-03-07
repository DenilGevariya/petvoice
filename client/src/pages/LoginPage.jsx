import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { HiOutlineMicrophone, HiOutlineChartBar, HiOutlineSparkles, HiOutlineGlobe } from 'react-icons/hi';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!email || !password) {
            toast.error('Please fill in all fields');
            return;
        }
        setLoading(true);
        try {
            const user = await login(email, password);
            toast.success(`Welcome back, ${user.fullName}!`);
            navigate(user.role === 'owner' ? '/owner/dashboard' : '/voice-order');
        } catch (err) {
            toast.error(err.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-left">
                <form className="auth-form animate-fade-in-up" onSubmit={handleSubmit}>
                    <div className="auth-form-header">
                        <div className="auth-form-logo">P</div>
                        <h1>Welcome Back</h1>
                        <p>Sign in to your PetVoice account</p>
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="email">Email Address</label>
                        <input
                            id="email"
                            type="email"
                            className="form-input"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            autoComplete="email"
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            className="form-input"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="current-password"
                        />
                    </div>

                    <button type="submit" className="btn btn-primary btn-lg w-full" disabled={loading}>
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>

                    <div className="auth-footer">
                        Don't have an account? <Link to="/register">Create one</Link>
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
