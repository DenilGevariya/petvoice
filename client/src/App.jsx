import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import OwnerDashboard from './pages/owner/Dashboard';
import MenuManager from './pages/owner/MenuManager';
import ContributionMargin from './pages/owner/ContributionMargin';
import PopularityScore from './pages/owner/PopularityScore';
import HiddenStars from './pages/owner/HiddenStars';
import RiskDetection from './pages/owner/RiskDetection';
import Recommendations from './pages/owner/Recommendations';
import PriceOptimization from './pages/owner/PriceOptimization';
import VoiceCopilot from './pages/customer/VoiceCopilot';
import OrderHistory from './pages/customer/OrderHistory';
import SetupRestaurant from './pages/owner/SetupRestaurant';
import './index.css';

function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div className="animate-float" style={{ fontSize: 48 }}>🍽️</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" />;
  if (role && user.role !== role) {
    return <Navigate to={user.role === 'owner' ? '/owner/dashboard' : '/order'} />;
  }

  return children;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 16 }}>
        <div className="animate-float" style={{ fontSize: 56 }}>🍽️</div>
        <p style={{ color: 'var(--neutral-500)', fontSize: 14 }}>Loading PetVoice...</p>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={user.role === 'owner' ? '/owner/dashboard' : '/order'} /> : <LoginPage />} />
      <Route path="/register" element={user ? <Navigate to={user.role === 'owner' ? '/owner/dashboard' : '/order'} /> : <RegisterPage />} />

      {/* Owner Routes */}
      <Route path="/owner/dashboard" element={<ProtectedRoute role="owner"><OwnerDashboard /></ProtectedRoute>} />
      <Route path="/owner/menu" element={<ProtectedRoute role="owner"><MenuManager /></ProtectedRoute>} />
      <Route path="/owner/contribution-margin" element={<ProtectedRoute role="owner"><ContributionMargin /></ProtectedRoute>} />
      <Route path="/owner/popularity-score" element={<ProtectedRoute role="owner"><PopularityScore /></ProtectedRoute>} />
      <Route path="/owner/hidden-stars" element={<ProtectedRoute role="owner"><HiddenStars /></ProtectedRoute>} />
      <Route path="/owner/risk-detection" element={<ProtectedRoute role="owner"><RiskDetection /></ProtectedRoute>} />
      <Route path="/owner/recommendations" element={<ProtectedRoute role="owner"><Recommendations /></ProtectedRoute>} />
      <Route path="/owner/combo-pricing" element={<ProtectedRoute role="owner"><PriceOptimization /></ProtectedRoute>} />
      <Route path="/owner/setup" element={<ProtectedRoute role="owner"><SetupRestaurant /></ProtectedRoute>} />

      {/* Customer Routes */}
      <Route path="/order" element={<ProtectedRoute role="customer"><VoiceCopilot /></ProtectedRoute>} />
      <Route path="/order-history" element={<ProtectedRoute role="customer"><OrderHistory /></ProtectedRoute>} />

      {/* Default */}
      <Route path="/" element={<Navigate to="/login" />} />
      <Route path="*" element={<Navigate to="/login" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              fontFamily: 'var(--font-body)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)',
            },
          }}
        />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
