import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        const token = localStorage.getItem('restrobrain_token');
        if (!token) {
            setLoading(false);
            return;
        }
        try {
            const res = await api.getMe();
            setUser(res.data);
        } catch {
            localStorage.removeItem('restrobrain_token');
        } finally {
            setLoading(false);
        }
    };

    const login = async (email, password) => {
        const res = await api.login({ email, password });
        localStorage.setItem('restrobrain_token', res.data.token);
        setUser(res.data.user);
        return res.data.user;
    };

    const register = async (data) => {
        const res = await api.register(data);
        localStorage.setItem('restrobrain_token', res.data.token);
        setUser(res.data.user);
        return res.data.user;
    };

    const logout = () => {
        localStorage.removeItem('restrobrain_token');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
};
