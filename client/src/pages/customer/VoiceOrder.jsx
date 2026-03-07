import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import toast from 'react-hot-toast';
import Vapi from '@vapi-ai/web';
import {
    HiOutlineMicrophone, HiOutlineStop, HiOutlineShoppingBag,
    HiOutlineCheck, HiOutlineRefresh, HiOutlineLogout,
    HiOutlineClock, HiOutlinePhotograph,
} from 'react-icons/hi';
import { useNavigate } from 'react-router-dom';

const VAPI_PUBLIC_KEY = import.meta.env.VITE_VAPI_PUBLIC_KEY || '';

export default function VoiceOrder() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const messagesEndRef = useRef(null);

    // State
    const [restaurants, setRestaurants] = useState([]);
    const [selectedRestaurant, setSelectedRestaurant] = useState(null);
    const [menuItems, setMenuItems] = useState([]);
    const [callStatus, setCallStatus] = useState('idle'); // idle | connecting | active | ended
    const [transcripts, setTranscripts] = useState([]);
    const [orderResult, setOrderResult] = useState(null);
    const [placingOrder, setPlacingOrder] = useState(false);

    const vapiRef = useRef(null);

    useEffect(() => {
        loadRestaurants();
        return () => {
            if (vapiRef.current) {
                try { vapiRef.current.stop(); } catch (e) { /* ignore */ }
            }
        };
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [transcripts]);

    const loadRestaurants = async () => {
        try {
            const res = await api.getRestaurants();
            setRestaurants(res.data || []);
        } catch (err) {
            console.error(err);
        }
    };

    const handleSelectRestaurant = async (restaurant) => {
        setSelectedRestaurant(restaurant);
        setTranscripts([]);
        setOrderResult(null);
        try {
            const res = await api.getMenuItems(restaurant.id);
            setMenuItems(res.data || []);
        } catch (err) {
            console.error(err);
        }
    };

    const buildSystemPrompt = useCallback(() => {
        if (!selectedRestaurant || menuItems.length === 0) return '';

        const menuStr = menuItems.map(mi =>
            `• ${mi.name} — ₹${mi.price}${mi.isVeg ? ' (Veg)' : ''}`
        ).join('\n');

        return `You are a friendly voice ordering assistant for "${selectedRestaurant.name}" restaurant.

MENU (only these items can be ordered):
${menuStr}

RULES:
1. Greet the customer warmly and ask what they'd like to order.
2. Only accept items from the menu above. If customer asks for something not on menu, politely say it's not available and suggest alternatives.
3. Allow customers to specify quantities (e.g., "2 veg burgers").
4. After the customer finishes ordering, summarize the order clearly with item names and quantities.
5. Ask for confirmation: "Would you like to confirm this order?"
6. If customer confirms, respond with EXACTLY this JSON format and nothing else:
{"confirmed":true,"items":[{"name":"EXACT_MENU_ITEM_NAME","quantity":NUMBER}]}
7. If customer wants to cancel, say goodbye politely.
8. You may suggest popular combos or additional items briefly, but don't be pushy.
9. Keep responses conversational, warm and concise.
10. Always speak in the same language the customer uses.`;
    }, [selectedRestaurant, menuItems]);

    const startCall = async () => {
        if (!VAPI_PUBLIC_KEY) {
            toast.error('Vapi public key is missing. Add VITE_VAPI_PUBLIC_KEY to your .env');
            return;
        }
        if (!selectedRestaurant) {
            toast.error('Please select a restaurant first');
            return;
        }
        if (menuItems.length === 0) {
            toast.error('No menu items available for this restaurant');
            return;
        }

        setCallStatus('connecting');
        setTranscripts([]);
        setOrderResult(null);

        try {
            const vapi = new Vapi(VAPI_PUBLIC_KEY);
            vapiRef.current = vapi;

            // ── Event listeners ──

            vapi.on('call-start', () => {
                setCallStatus('active');
                setTranscripts(prev => [...prev, {
                    role: 'system',
                    text: '🟢 Call connected — start speaking!',
                    ts: Date.now(),
                }]);
            });

            vapi.on('call-end', () => {
                setCallStatus('ended');
                setTranscripts(prev => [...prev, {
                    role: 'system',
                    text: '🔴 Call ended',
                    ts: Date.now(),
                }]);
            });

            vapi.on('speech-start', () => {
                // assistant started speaking
            });

            vapi.on('speech-end', () => {
                // assistant stopped speaking
            });

            vapi.on('message', (msg) => {
                // Transcript messages
                if (msg.type === 'transcript') {
                    if (msg.transcriptType === 'final') {
                        setTranscripts(prev => [...prev, {
                            role: msg.role, // 'user' or 'assistant'
                            text: msg.transcript,
                            ts: Date.now(),
                        }]);

                        // Check if assistant returned JSON order
                        if (msg.role === 'assistant') {
                            tryParseOrder(msg.transcript);
                        }
                    }
                }

                // Function call or tool result from assistant
                if (msg.type === 'function-call' || msg.type === 'tool-calls') {
                    // handle if needed
                }
            });

            vapi.on('error', (err) => {
                console.error('Vapi error:', err);
                setCallStatus('idle');
                toast.error('Voice call error. Please try again.');
            });

            // ── Start the call ──
            await vapi.start({
                model: {
                    provider: 'google',
                    model: 'gemini-2.0-flash',
                    messages: [
                        { role: 'system', content: buildSystemPrompt() },
                    ],
                },
                voice: {
                    provider: '11labs',
                    voiceId: 'sarah',
                },
                name: `PetVoice Order - ${selectedRestaurant.name}`,
                firstMessage: `Hello! Welcome to ${selectedRestaurant.name}. I'm your AI ordering assistant. What would you like to order today?`,
            });

        } catch (err) {
            console.error('Start call error:', err);
            setCallStatus('idle');
            toast.error(err.message || 'Failed to start voice call');
        }
    };

    const stopCall = () => {
        if (vapiRef.current) {
            try { vapiRef.current.stop(); } catch (e) { /* ignore */ }
        }
        setCallStatus('ended');
    };

    const tryParseOrder = (text) => {
        try {
            // Try to extract JSON from the text
            const jsonMatch = text.match(/\{[\s\S]*"confirmed"[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                if (parsed.confirmed && Array.isArray(parsed.items) && parsed.items.length > 0) {
                    setOrderResult(parsed);
                    toast.success('Order detected! Review and confirm below.');
                }
            }
        } catch (e) {
            // Not JSON, ignore
        }
    };

    const confirmOrder = async () => {
        if (!orderResult || !selectedRestaurant) return;

        setPlacingOrder(true);
        try {
            const res = await api.voiceOrder({
                restaurantId: selectedRestaurant.id,
                items: orderResult.items,
            });

            toast.success(`Order #${res.data.orderNumber} placed — ₹${res.data.total}!`);

            setTranscripts(prev => [...prev, {
                role: 'system',
                text: `✅ Order #${res.data.orderNumber} placed successfully! Total: ₹${res.data.total}`,
                ts: Date.now(),
            }]);

            setOrderResult(null);
        } catch (err) {
            toast.error(err.message || 'Failed to place order');
        } finally {
            setPlacingOrder(false);
        }
    };

    const resetSession = () => {
        if (vapiRef.current) {
            try { vapiRef.current.stop(); } catch (e) { /* ignore */ }
        }
        setCallStatus('idle');
        setTranscripts([]);
        setOrderResult(null);
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    // ── Render ──

    return (
        <div className="vo-page">
            {/* Header */}
            <div className="vo-header">
                <div className="vo-header-left">
                    <div className="vo-logo">P</div>
                    <div>
                        <h1>PetVoice AI</h1>
                        <p>Voice Ordering</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button className="btn btn-ghost" onClick={() => navigate('/order-history')}>
                        <HiOutlineClock size={16} /> History
                    </button>
                    <button className="btn btn-ghost" onClick={handleLogout}>
                        <HiOutlineLogout size={16} /> Logout
                    </button>
                </div>
            </div>

            <div className="vo-body">
                {/* Left — Restaurant Selector */}
                <div className="vo-sidebar">
                    <div className="vo-sidebar-title">Select Restaurant</div>
                    <div className="vo-restaurant-list">
                        {restaurants.map(r => (
                            <button
                                key={r.id}
                                className={`vo-restaurant-item ${selectedRestaurant?.id === r.id ? 'vo-restaurant-item--active' : ''}`}
                                onClick={() => handleSelectRestaurant(r)}
                            >
                                <div className="vo-restaurant-avatar">{r.name?.charAt(0)}</div>
                                <div>
                                    <div className="vo-restaurant-name">{r.name}</div>
                                    <div className="vo-restaurant-meta">{r.cuisine || 'Restaurant'}</div>
                                </div>
                            </button>
                        ))}
                        {restaurants.length === 0 && (
                            <div style={{ padding: 20, textAlign: 'center', color: 'var(--neutral-400)', fontSize: 13 }}>
                                No restaurants found
                            </div>
                        )}
                    </div>

                    {/* Menu preview */}
                    {selectedRestaurant && menuItems.length > 0 && (
                        <div className="vo-menu-preview">
                            <div className="vo-sidebar-title">Menu — {menuItems.length} items</div>
                            <div className="vo-menu-list">
                                {menuItems.slice(0, 8).map(mi => (
                                    <div key={mi.id} className="vo-menu-chip">
                                        {mi.name} <span>₹{mi.price}</span>
                                    </div>
                                ))}
                                {menuItems.length > 8 && (
                                    <div className="vo-menu-chip" style={{ opacity: 0.5 }}>
                                        +{menuItems.length - 8} more
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right — Voice Interface */}
                <div className="vo-main">
                    {/* Transcripts */}
                    <div className="vo-transcripts">
                        {transcripts.length === 0 && (
                            <div className="vo-empty-state">
                                <HiOutlineMicrophone size={48} />
                                <h3>Ready to Take Your Order</h3>
                                <p>
                                    {selectedRestaurant
                                        ? `Select "${selectedRestaurant.name}" ✓ — Click "Start AI Order" to begin`
                                        : 'Please select a restaurant from the left panel first'}
                                </p>
                            </div>
                        )}

                        {transcripts.map((t, i) => (
                            <div key={i} className={`vo-msg vo-msg--${t.role}`}>
                                <div className={`vo-msg-avatar vo-msg-avatar--${t.role}`}>
                                    {t.role === 'user' ? (user?.fullName?.charAt(0)?.toUpperCase() || '👤') :
                                        t.role === 'assistant' ? '🤖' : 'ℹ️'}
                                </div>
                                <div className="vo-msg-bubble">
                                    <div className="vo-msg-role">
                                        {t.role === 'user' ? 'You' : t.role === 'assistant' ? 'AI Assistant' : 'System'}
                                    </div>
                                    <div className="vo-msg-text">{t.text}</div>
                                </div>
                            </div>
                        ))}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Order confirmation card */}
                    {orderResult && (
                        <div className="vo-order-card animate-fade-in-up">
                            <h3><HiOutlineShoppingBag size={18} /> Order Summary</h3>
                            <div className="vo-order-items">
                                {orderResult.items.map((item, i) => (
                                    <div key={i} className="vo-order-item">
                                        <span>{item.quantity}× {item.name}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="vo-order-actions">
                                <button
                                    className="btn btn-primary btn-lg"
                                    onClick={confirmOrder}
                                    disabled={placingOrder}
                                    style={{ flex: 1 }}
                                >
                                    {placingOrder ? 'Placing Order...' : '✅ Confirm & Place Order'}
                                </button>
                                <button className="btn btn-secondary" onClick={() => setOrderResult(null)}>
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Controls */}
                    <div className="vo-controls">
                        {callStatus === 'idle' || callStatus === 'ended' ? (
                            <button
                                className="vo-mic-btn vo-mic-btn--start"
                                onClick={startCall}
                                disabled={!selectedRestaurant || !VAPI_PUBLIC_KEY}
                            >
                                <HiOutlineMicrophone size={28} />
                                <span>Start AI Order</span>
                            </button>
                        ) : callStatus === 'connecting' ? (
                            <button className="vo-mic-btn vo-mic-btn--connecting" disabled>
                                <div className="vo-pulse" />
                                <span>Connecting...</span>
                            </button>
                        ) : (
                            <button className="vo-mic-btn vo-mic-btn--active" onClick={stopCall}>
                                <HiOutlineStop size={28} />
                                <span>End Call</span>
                            </button>
                        )}

                        {callStatus === 'ended' && (
                            <button className="btn btn-secondary" onClick={resetSession}>
                                <HiOutlineRefresh size={16} /> New Session
                            </button>
                        )}

                        {callStatus === 'active' && (
                            <div className="vo-live-indicator">
                                <span className="vo-live-dot" /> LIVE — Speak naturally
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
