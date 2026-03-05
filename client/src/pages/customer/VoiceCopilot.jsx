import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import toast from 'react-hot-toast';
import { HiOutlineMicrophone, HiOutlineShoppingBag, HiOutlineClock, HiOutlineLogout, HiOutlineX, HiOutlineCheck } from 'react-icons/hi';

export default function VoiceCopilot() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const chatEndRef = useRef(null);

    const [messages, setMessages] = useState([]);
    const [isListening, setIsListening] = useState(false);
    const [language, setLanguage] = useState('en');
    const [greeting, setGreeting] = useState(null);
    const [transcript, setTranscript] = useState('');

    // Order state
    const [currentOrder, setCurrentOrder] = useState({
        restaurantId: null,
        restaurantName: null,
        items: [],
    });
    const [upsellSuggestions, setUpsellSuggestions] = useState(null);
    const [showOrderSummary, setShowOrderSummary] = useState(false);
    const [processingOrder, setProcessingOrder] = useState(false);

    // Conversation context for AI
    const [conversationContext, setConversationContext] = useState([]);

    const recognitionRef = useRef(null);

    useEffect(() => {
        loadGreeting();
    }, [language]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const loadGreeting = async () => {
        try {
            const res = await api.getGreeting(language);
            setGreeting(res.data);
            if (messages.length === 0) {
                setMessages([{
                    type: 'ai',
                    text: res.data.title + '\n\n' + res.data.hint,
                    timestamp: new Date(),
                }]);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const addMessage = (type, text) => {
        const msg = { type, text, timestamp: new Date() };
        setMessages((prev) => [...prev, msg]);
        return msg;
    };

    const startListening = () => {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            toast.error('Speech recognition is not supported in this browser. Please use Chrome.');
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();

        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = language === 'hi' ? 'hi-IN' : language === 'gu' ? 'gu-IN' : 'en-US';

        recognition.onstart = () => {
            setIsListening(true);
            setTranscript('');
        };

        recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            setTranscript(finalTranscript || interimTranscript);

            if (finalTranscript) {
                processVoiceInput(finalTranscript);
            }
        };

        recognition.onerror = (event) => {
            console.error('Speech error:', event.error);
            setIsListening(false);
            if (event.error === 'not-allowed') {
                toast.error('Microphone access denied. Please allow microphone access.');
            }
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognitionRef.current = recognition;
        recognition.start();
    };

    const stopListening = () => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
        setIsListening(false);
    };

    const processVoiceInput = async (text) => {
        addMessage('user', text);

        // Update conversation context
        const newContext = [...conversationContext, { role: 'user', content: text }];
        setConversationContext(newContext);

        try {
            const res = await api.processVoice({
                transcript: text,
                language: language,
                conversationContext: newContext,
            });

            const aiData = res.data;

            // Update context with AI response
            setConversationContext((prev) => [...prev, { role: 'assistant', content: aiData.response }]);

            // Add AI response message
            addMessage('ai', aiData.response);

            // Handle different intents
            switch (aiData.intent) {
                case 'order':
                case 'select_item':
                    if (aiData.restaurantId && aiData.items?.length > 0) {
                        setCurrentOrder({
                            restaurantId: aiData.restaurantId,
                            restaurantName: aiData.restaurantName,
                            items: aiData.items.map((i) => ({
                                menuItemId: i.menuItemId,
                                name: i.name,
                                quantity: i.quantity || 1,
                            })),
                        });
                        // Get upsell suggestions
                        fetchUpsell(aiData.restaurantId, aiData.items);
                    } else if (aiData.restaurantName && !aiData.items?.length) {
                        setCurrentOrder((prev) => ({
                            ...prev,
                            restaurantId: aiData.restaurantId,
                            restaurantName: aiData.restaurantName,
                        }));
                    }
                    break;

                case 'select_restaurant':
                    if (aiData.restaurantId) {
                        setCurrentOrder((prev) => ({
                            ...prev,
                            restaurantId: aiData.restaurantId,
                            restaurantName: aiData.restaurantName,
                        }));
                    }
                    break;

                case 'confirm':
                    if (currentOrder.items.length > 0) {
                        placeOrder();
                    }
                    break;

                case 'cancel':
                    setCurrentOrder({ restaurantId: null, restaurantName: null, items: [] });
                    setUpsellSuggestions(null);
                    setShowOrderSummary(false);
                    addMessage('ai', 'Order cancelled. Feel free to start a new order anytime! 😊');
                    break;

                default:
                    break;
            }

            // Show order summary if we have items
            if (aiData.needsConfirmation && aiData.items?.length > 0) {
                setShowOrderSummary(true);
            }

        } catch (err) {
            console.error('AI processing error:', err);
            addMessage('ai', 'Sorry, I had trouble understanding that. Could you please try again? 🙏');
        }
    };

    const fetchUpsell = async (restaurantId, items) => {
        try {
            const res = await api.getUpsell({
                restaurantId,
                orderItems: items,
            });
            if (res.data?.suggestions?.length > 0) {
                setUpsellSuggestions(res.data);
                addMessage('ai', res.data.conversationalMessage || 'Would you like to add anything else?');
            }
        } catch (err) {
            console.error('Upsell error:', err);
        }
    };

    const addUpsellItem = (suggestion) => {
        setCurrentOrder((prev) => ({
            ...prev,
            items: [...prev.items, {
                menuItemId: suggestion.id,
                name: suggestion.name,
                quantity: 1,
                isUpsell: true,
                price: suggestion.price,
            }],
        }));
        addMessage('user', `Yes, add ${suggestion.name}`);
        addMessage('ai', `Great choice! ${suggestion.name} has been added to your order. ✅`);
        setUpsellSuggestions(null);
        setShowOrderSummary(true);
    };

    const dismissUpsell = () => {
        setUpsellSuggestions(null);
        setShowOrderSummary(true);
        addMessage('ai', 'No problem! Here\'s your order summary. Ready to confirm?');
    };

    const placeOrder = async () => {
        if (currentOrder.items.length === 0) {
            toast.error('No items in order');
            return;
        }

        setProcessingOrder(true);
        try {
            const orderData = {
                restaurantId: currentOrder.restaurantId,
                items: currentOrder.items.map((i) => ({
                    menuItemId: i.menuItemId,
                    quantity: i.quantity,
                    isUpsell: i.isUpsell || false,
                })),
                orderedVia: 'voice',
                aiUpsellAccepted: currentOrder.items.some((i) => i.isUpsell),
            };

            const res = await api.createOrder(orderData);

            addMessage('ai', `🎉 Order placed successfully!\n\nOrder #${res.data.orderNumber}\nTotal: ₹${res.data.total}\n\nYour food is being prepared!`);

            toast.success('Order placed successfully!');

            // Reset order state
            setCurrentOrder({ restaurantId: null, restaurantName: null, items: [] });
            setUpsellSuggestions(null);
            setShowOrderSummary(false);
            setConversationContext([]);
        } catch (err) {
            toast.error(err.message || 'Failed to place order');
            addMessage('ai', 'Sorry, there was an error placing your order. Please try again.');
        } finally {
            setProcessingOrder(false);
        }
    };

    const handleTextInput = (text) => {
        processVoiceInput(text);
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="voice-page">
            {/* Header */}
            <div className="voice-header">
                <div className="voice-header-left">
                    <div className="voice-header-logo">P</div>
                    <div>
                        <h1>PetVoice AI</h1>
                        <p>Voice Ordering Copilot</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button className="btn btn-ghost" onClick={() => navigate('/order-history')}>
                        <HiOutlineClock size={18} /> History
                    </button>
                    <button className="btn btn-ghost" onClick={handleLogout}>
                        <HiOutlineLogout size={18} /> Logout
                    </button>
                </div>
            </div>

            {/* Chat Area */}
            <div className="voice-main">
                <div className="voice-chat-area">
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`chat-message ${msg.type}`}>
                            <div className={`chat-avatar ${msg.type}`}>
                                {msg.type === 'ai' ? '🤖' : user?.fullName?.charAt(0)?.toUpperCase() || '👤'}
                            </div>
                            <div className="chat-bubble">
                                {msg.text.split('\n').map((line, i) => (
                                    <span key={i}>
                                        {line}
                                        {i < msg.text.split('\n').length - 1 && <br />}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ))}

                    {/* Upsell Suggestions */}
                    {upsellSuggestions && upsellSuggestions.suggestions?.length > 0 && (
                        <div className="chat-message ai animate-fade-in-up">
                            <div className="chat-avatar ai">✨</div>
                            <div style={{ maxWidth: '80%' }}>
                                <div className="upsell-card">
                                    <h4>💡 Would you like to add?</h4>
                                    <div className="upsell-items">
                                        {upsellSuggestions.suggestions.map((s, idx) => (
                                            <div key={idx} className="upsell-item">
                                                <div>
                                                    <div className="upsell-item-name">{s.name}</div>
                                                    <div style={{ fontSize: 11, color: 'var(--neutral-500)' }}>{s.reason}</div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="upsell-item-price">₹{s.price}</span>
                                                    <button className="btn btn-sm btn-primary" onClick={() => addUpsellItem(s)}>Add</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="upsell-actions">
                                        <button className="btn btn-sm btn-secondary" onClick={dismissUpsell}>No thanks</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Order Summary */}
                    {showOrderSummary && currentOrder.items.length > 0 && (
                        <div className="order-summary animate-fade-in-up">
                            <h3><HiOutlineShoppingBag /> Order Summary — {currentOrder.restaurantName || 'Restaurant'}</h3>
                            {currentOrder.items.map((item, idx) => (
                                <div key={idx} className="order-item-row">
                                    <span>{item.quantity}× {item.name} {item.isUpsell ? '✨' : ''}</span>
                                </div>
                            ))}
                            <div className="flex gap-3 mt-4">
                                <button
                                    className="btn btn-primary btn-lg"
                                    onClick={placeOrder}
                                    disabled={processingOrder}
                                    style={{ flex: 1 }}
                                >
                                    {processingOrder ? 'Placing Order...' : '✅ Confirm Order'}
                                </button>
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => {
                                        setCurrentOrder({ restaurantId: null, restaurantName: null, items: [] });
                                        setShowOrderSummary(false);
                                        addMessage('ai', 'Order cancelled. Feel free to start again! 😊');
                                    }}
                                >
                                    <HiOutlineX size={16} /> Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    <div ref={chatEndRef} />
                </div>

                {/* Voice Controls */}
                <div className="voice-controls">
                    {/* Live transcript */}
                    {isListening && transcript && (
                        <div style={{
                            padding: '10px 20px',
                            background: 'var(--neutral-100)',
                            borderRadius: 'var(--radius-full)',
                            fontSize: 14,
                            color: 'var(--neutral-700)',
                            maxWidth: '100%',
                            textAlign: 'center',
                        }}>
                            🎙️ {transcript}
                        </div>
                    )}

                    {/* Mic button */}
                    <button
                        className={`mic-button ${isListening ? 'listening' : ''}`}
                        onClick={isListening ? stopListening : startListening}
                    >
                        <HiOutlineMicrophone size={32} />
                    </button>

                    <div className={`mic-status ${isListening ? 'listening' : ''}`}>
                        {isListening ? '🔴 Listening...' : 'Tap to speak'}
                    </div>

                    {/* Language selector */}
                    <div className="voice-language-selector">
                        <button className={`lang-btn ${language === 'en' ? 'active' : ''}`} onClick={() => setLanguage('en')}>English</button>
                        <button className={`lang-btn ${language === 'hi' ? 'active' : ''}`} onClick={() => setLanguage('hi')}>हिंदी</button>
                        <button className={`lang-btn ${language === 'gu' ? 'active' : ''}`} onClick={() => setLanguage('gu')}>ગુજરાતી</button>
                    </div>

                    {/* Quick suggestions */}
                    {greeting?.examples && messages.length <= 2 && (
                        <div className="voice-suggestions">
                            {greeting.examples.map((example, idx) => (
                                <button key={idx} className="voice-suggestion-chip" onClick={() => handleTextInput(example)}>
                                    "{example}"
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
