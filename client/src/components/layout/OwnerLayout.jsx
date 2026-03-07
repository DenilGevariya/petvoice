import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
    HiOutlineHome, HiOutlineClipboardList, HiOutlineChartBar,
    HiOutlineStar, HiOutlineCurrencyDollar, HiOutlineLogout,
    HiOutlineMenu, HiOutlineX, HiOutlineTrendingUp,
    HiOutlineExclamationCircle, HiOutlineLightBulb, HiOutlineSparkles
} from 'react-icons/hi';
import { useState } from 'react';

const managementNav = [
    { path: '/owner/dashboard', label: 'Dashboard', icon: HiOutlineHome },
    { path: '/owner/menu', label: 'Menu Manager', icon: HiOutlineClipboardList },
];

const intelligenceNav = [
    { path: '/owner/recommendations', label: 'Recommendations', icon: HiOutlineLightBulb },
    { path: '/owner/suggestions', label: 'Suggestions', icon: HiOutlineSparkles },
    { path: '/owner/contribution-margin', label: 'Contribution Margin', icon: HiOutlineChartBar },
    { path: '/owner/risk-detection', label: 'Risk Detection', icon: HiOutlineExclamationCircle },
    { path: '/owner/popularity-score', label: 'Popularity Score', icon: HiOutlineTrendingUp },
    { path: '/owner/hidden-stars', label: 'Hidden Stars', icon: HiOutlineStar },
    // { path: '/owner/combo-pricing', label: 'Combo & Pricing', icon: HiOutlineCurrencyDollar },
];

export default function OwnerLayout({ children }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="app-layout">
            {/* Mobile menu button */}
            <button
                className="btn btn-ghost btn-icon"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                style={{
                    position: 'fixed',
                    top: 16,
                    left: 16,
                    zIndex: 200,
                    display: 'none',
                }}
                id="mobile-menu-btn"
            >
                {sidebarOpen ? <HiOutlineX size={24} /> : <HiOutlineMenu size={24} />}
            </button>

            <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <div className="sidebar-logo">R</div>
                    <div className="sidebar-brand">
                        <h1>RestroBrain</h1>
                        <p>Restaurant Intelligence</p>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    <div className="sidebar-section-label">Management</div>
                    {managementNav.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
                            onClick={() => setSidebarOpen(false)}
                        >
                            <item.icon className="nav-icon" />
                            {item.label}
                        </NavLink>
                    ))}

                    <div className="sidebar-section-label">AI Intelligence</div>
                    {intelligenceNav.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
                            onClick={() => setSidebarOpen(false)}
                        >
                            <item.icon className="nav-icon" />
                            {item.label}
                        </NavLink>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <div className="sidebar-user">
                        <div className="sidebar-avatar">
                            {user?.fullName?.charAt(0)?.toUpperCase() || 'O'}
                        </div>
                        <div className="sidebar-user-info" style={{ flex: 1 }}>
                            <h4>{user?.fullName || 'Owner'}</h4>
                            <p>{user?.email || ''}</p>
                        </div>
                        <button className="btn btn-ghost btn-icon sm" onClick={handleLogout} title="Logout">
                            <HiOutlineLogout size={18} />
                        </button>
                    </div>
                </div>
            </aside>

            <main className="main-content">
                {children}
            </main>
        </div>
    );
}
