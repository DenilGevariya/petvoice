const express = require('express');
const { query } = require('../config/db');
const { generateJSON, generateContent } = require('../config/gemini');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// ================== PROCESS VOICE ORDER ==================
router.post('/process-voice', authMiddleware, async (req, res) => {
    try {
        const { transcript, language, conversationContext } = req.body;

        if (!transcript) {
            return res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'Voice transcript is required' }
            });
        }

        // Get all active restaurants and their menus for context
        const restaurants = await query(
            `SELECT r.id, r.name, r.cuisine_type, r.city
       FROM restaurants r WHERE r.is_active = true`
        );

        const restaurantMenus = {};
        for (const r of restaurants.rows) {
            const items = await query(
                `SELECT id, name, price, description, is_available, is_veg, category_id
         FROM menu_items WHERE restaurant_id = $1 AND is_available = true`,
                [r.id]
            );
            restaurantMenus[r.name] = {
                restaurantId: r.id,
                cuisineType: r.cuisine_type,
                items: items.rows.map(i => ({
                    id: i.id,
                    name: i.name,
                    price: parseFloat(i.price),
                    description: i.description,
                    isVeg: i.is_veg
                }))
            };
        }

        // Build Gemini prompt for intent parsing
        const prompt = `You are an AI food ordering assistant. Parse the customer's voice order and extract structured information.

Available Restaurants and their menus:
${JSON.stringify(restaurantMenus, null, 2)}

Previous conversation context:
${conversationContext ? JSON.stringify(conversationContext) : 'None - this is the start of the conversation'}

Customer said (in ${language || 'English'}): "${transcript}"

Analyze the customer's intent and return a JSON object:
{
  "intent": "order|select_restaurant|select_item|confirm|cancel|greeting|unclear",
  "restaurantName": "detected restaurant name or null",
  "restaurantId": "restaurant UUID or null",
  "items": [
    {
      "menuItemId": "item UUID or null",
      "name": "item name",
      "quantity": 1,
      "matchConfidence": 0.95
    }
  ],
  "needsRestaurant": true/false,
  "needsItems": true/false,
  "needsConfirmation": true/false,
  "response": "A friendly, conversational response message to show the customer in ${language || 'English'}",
  "availableRestaurants": ["list of matching restaurant names if customer needs to choose"],
  "availableItems": ["list of matching item names if customer needs to choose"]
}

Rules:
- Match restaurant and item names using fuzzy matching (similar sounding names)
- If the customer mentions a restaurant, resolve it to the exact restaurant name from the database
- If the customer mentions food items, resolve them to exact menu items
- If the customer says both restaurant and items, set needsConfirmation to true
- If only restaurant is mentioned, set needsItems to true
- If only food items are mentioned, set needsRestaurant to true
- If nothing is clear, set intent to "unclear" and ask for clarification
- The response should be warm, helpful, and conversational
- Support English, Hindi, and Gujarati languages
- If customer says yes/confirm/haan/ha, set intent to "confirm"
- If customer says no/cancel/nahi, set intent to "cancel"`;

        const aiResponse = await generateJSON(prompt);

        res.json({
            success: true,
            data: aiResponse
        });
    } catch (error) {
        console.error('Process voice error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: error.message, stack: error.stack }
        });
    }
});

// ================== GET UPSELL SUGGESTIONS ==================
router.post('/upsell', authMiddleware, async (req, res) => {
    try {
        const { restaurantId, orderItems } = req.body;

        if (!restaurantId || !orderItems || orderItems.length === 0) {
            return res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'Restaurant and order items are required' }
            });
        }

        // Get restaurant menu
        const menuItems = await query(
            `SELECT id, name, price, description, is_veg, total_sales, classification
       FROM menu_items WHERE restaurant_id = $1 AND is_available = true`,
            [restaurantId]
        );

        // Get co-purchase patterns
        const orderItemIds = orderItems.map(i => i.menuItemId).filter(Boolean);
        let coPurchaseData = [];

        if (orderItemIds.length > 0) {
            const coPurchases = await query(
                `SELECT cp.*, 
          CASE WHEN cp.item_a_id = ANY($1::uuid[]) THEN b.name ELSE a.name END as suggested_item_name,
          CASE WHEN cp.item_a_id = ANY($1::uuid[]) THEN b.id ELSE a.id END as suggested_item_id,
          CASE WHEN cp.item_a_id = ANY($1::uuid[]) THEN b.price ELSE a.price END as suggested_item_price
         FROM item_co_purchases cp
         JOIN menu_items a ON cp.item_a_id = a.id
         JOIN menu_items b ON cp.item_b_id = b.id
         WHERE cp.restaurant_id = $2
         AND (cp.item_a_id = ANY($1::uuid[]) OR cp.item_b_id = ANY($1::uuid[]))
         ORDER BY cp.co_purchase_count DESC
         LIMIT 5`,
                [orderItemIds, restaurantId]
            );
            coPurchaseData = coPurchases.rows;
        }

        // Get combos that include ordered items
        let relevantCombos = [];
        if (orderItemIds.length > 0) {
            const combos = await query(
                `SELECT DISTINCT c.id, c.name, c.combo_price, c.original_price, c.discount_percentage
         FROM combos c
         JOIN combo_items ci ON c.id = ci.combo_id
         WHERE ci.menu_item_id = ANY($1::uuid[]) AND c.is_active = true AND c.restaurant_id = $2`,
                [orderItemIds, restaurantId]
            );
            relevantCombos = combos.rows;
        }

        // AI-powered upsell suggestions
        let aiSuggestions = null;
        try {
            const prompt = `You are a restaurant upselling AI assistant. Based on the customer's current order, suggest complementary items to increase order value.

Current order:
${JSON.stringify(orderItems, null, 2)}

Available menu items:
${JSON.stringify(menuItems.rows.map(i => ({
                id: i.id,
                name: i.name,
                price: parseFloat(i.price),
                isVeg: i.is_veg,
                popularity: i.total_sales || 0,
                classification: i.classification
            })), null, 2)}

Co-purchase patterns (items frequently bought with current order):
${JSON.stringify(coPurchaseData.map(cp => ({
                item: cp.suggested_item_name,
                frequency: cp.co_purchase_count
            })), null, 2)}

Available combos matching order:
${JSON.stringify(relevantCombos, null, 2)}

Rules:
- Suggest 1-3 items maximum
- Prioritize items that are frequently co-purchased
- Suggest combos if they offer good value
- Don't suggest items already in the order
- Keep suggestions natural and helpful, not pushy
- Include item IDs for direct adding

Return JSON:
{
  "suggestions": [
    {
      "type": "item|combo",
      "id": "uuid",
      "name": "Item Name",
      "price": 0.00,
      "reason": "Most customers also add this with their burger!",
      "confidence": 0.85
    }
  ],
  "conversationalMessage": "A friendly upsell message to show the customer"
}`;

            aiSuggestions = await generateJSON(prompt);
        } catch (err) {
            console.error('AI upsell error:', err);
            // Fallback to basic suggestions
            aiSuggestions = {
                suggestions: coPurchaseData.slice(0, 2).map(cp => ({
                    type: 'item',
                    id: cp.suggested_item_id,
                    name: cp.suggested_item_name,
                    price: parseFloat(cp.suggested_item_price),
                    reason: 'Frequently ordered together',
                    confidence: 0.7
                })),
                conversationalMessage: 'Would you like to add anything else to your order?'
            };
        }

        res.json({ success: true, data: aiSuggestions });
    } catch (error) {
        console.error('Upsell error:', error);
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get upsell suggestions' } });
    }
});

// ================== GENERATE GREETING ==================
router.get('/greeting', authMiddleware, async (req, res) => {
    try {
        const { language } = req.query;
        const lang = language || 'en';

        const greetings = {
            en: {
                title: 'Hello! Welcome to RestroBrain AI Ordering',
                subtitle: 'Your intelligent food ordering assistant',
                hint: 'Try saying: "I want a burger from Food Hub" or "Order a pizza from Pizza Palace"',
                examples: [
                    'I want a cheese pizza from Pizza Palace',
                    'Order me a burger',
                    'What restaurants are available?'
                ]
            },
            hi: {
                title: 'नमस्ते! RestroBrain AI ऑर्डरिंग में आपका स्वागत है',
                subtitle: 'आपका बुद्धिमान फूड ऑर्डरिंग सहायक',
                hint: 'कहकर देखें: "मुझे Food Hub से बर्गर चाहिए" या "Pizza Palace से पिज़्ज़ा ऑर्डर करो"',
                examples: [
                    'मुझे Pizza Palace से चीज़ पिज़्ज़ा चाहिए',
                    'एक बर्गर ऑर्डर करो',
                    'कौन से रेस्टोरेंट उपलब्ध हैं?'
                ]
            },
            gu: {
                title: 'નમસ્તે! RestroBrain AI ઓર્ડરિંગમાં આપનું સ્વાગત છે',
                subtitle: 'તમારા બુદ્ધિશાળી ફૂડ ઓર્ડરિંગ સહાયક',
                hint: 'કહો: "મને Food Hub માંથી બર્ગર જોઈએ છે"',
                examples: [
                    'મને Pizza Palace માંથી ચીઝ પિઝ્ઝા જોઈએ છે',
                    'એક બર્ગર ઓર્ડર કરો',
                    'કયા રેસ્ટોરેન્ટ ઉપલબ્ધ છે?'
                ]
            }
        };

        res.json({
            success: true,
            data: greetings[lang] || greetings.en
        });
    } catch (error) {
        console.error('Greeting error:', error);
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get greeting' } });
    }
});

module.exports = router;
