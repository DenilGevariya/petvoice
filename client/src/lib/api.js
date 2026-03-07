const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const getToken = () => localStorage.getItem('petvoice_token');

const apiRequest = async (endpoint, options = {}) => {
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
    };

    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error?.message || 'Something went wrong');
    }

    return data;
};

export const api = {
    // Auth
    login: (body) => apiRequest('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
    register: (body) => apiRequest('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
    getMe: () => apiRequest('/auth/me'),

    // Restaurants
    getRestaurants: (params) => {
        const query = params ? '?' + new URLSearchParams(params).toString() : '';
        return apiRequest(`/restaurants${query}`);
    },
    getRestaurant: (id) => apiRequest(`/restaurants/${id}`),
    getMyRestaurant: () => apiRequest('/restaurants/my-restaurant'),
    createRestaurant: (body) => apiRequest('/restaurants', { method: 'POST', body: JSON.stringify(body) }),
    updateRestaurant: (id, body) => apiRequest(`/restaurants/${id}`, { method: 'PUT', body: JSON.stringify(body) }),

    // Menu
    getCategories: (restaurantId) => apiRequest(`/menu/categories/${restaurantId}`),
    createCategory: (body) => apiRequest('/menu/categories', { method: 'POST', body: JSON.stringify(body) }),
    getMenuItems: (restaurantId, params) => {
        const query = params ? '?' + new URLSearchParams(params).toString() : '';
        return apiRequest(`/menu/${restaurantId}${query}`);
    },
    createMenuItem: (body) => apiRequest('/menu', { method: 'POST', body: JSON.stringify(body) }),
    updateMenuItem: (id, body) => apiRequest(`/menu/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    deleteMenuItem: (id) => apiRequest(`/menu/${id}`, { method: 'DELETE' }),
    getCombos: (restaurantId) => apiRequest(`/menu/combos/${restaurantId}`),
    createCombo: (body) => apiRequest('/menu/combos', { method: 'POST', body: JSON.stringify(body) }),

    // Orders
    createOrder: (body) => apiRequest('/orders', { method: 'POST', body: JSON.stringify(body) }),
    voiceOrder: (body) => apiRequest('/orders/voice-order', { method: 'POST', body: JSON.stringify(body) }),
    getMyOrders: () => apiRequest('/orders/my-orders'),
    getRestaurantOrders: (restaurantId, params) => {
        const query = params ? '?' + new URLSearchParams(params).toString() : '';
        return apiRequest(`/orders/restaurant/${restaurantId}${query}`);
    },
    updateOrderStatus: (id, status) => apiRequest(`/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

    // Analytics
    getDashboard: (restaurantId) => apiRequest(`/analytics/dashboard/${restaurantId}`),
    getMargins: (restaurantId) => apiRequest(`/analytics/margins/${restaurantId}`),
    getOrderMargins: (restaurantId) => apiRequest(`/analytics/order-margins/${restaurantId}`),
    getClassification: (restaurantId) => apiRequest(`/analytics/classification/${restaurantId}`),
    getHiddenStars: (restaurantId) => apiRequest(`/analytics/hidden-stars/${restaurantId}`),
    getComboSuggestions: (restaurantId) => apiRequest(`/analytics/combo-suggestions/${restaurantId}`),
    getPriceOptimization: (restaurantId) => apiRequest(`/analytics/price-optimization/${restaurantId}`),
    getSalesTrends: (restaurantId, days) => apiRequest(`/analytics/sales-trends/${restaurantId}?days=${days || 30}`),

    // AI
    processVoice: (body) => apiRequest('/ai/process-voice', { method: 'POST', body: JSON.stringify(body) }),
    getUpsell: (body) => apiRequest('/ai/upsell', { method: 'POST', body: JSON.stringify(body) }),
    getGreeting: (language) => apiRequest(`/ai/greeting?language=${language || 'en'}`),

    // Upload
    uploadImage: async (file) => {
        const token = getToken();
        const formData = new FormData();
        formData.append('image', file);
        const response = await fetch(`${API_BASE}/upload/image`, {
            method: 'POST',
            headers: { ...(token && { Authorization: `Bearer ${token}` }) },
            body: formData,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || 'Upload failed');
        return data;
    },
};
