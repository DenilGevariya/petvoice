# 🎙️ PetVoice (AI-Powered Restaurant Ordering & Revenue Platform)

![PetVoice Banner](https://via.placeholder.com/1200x400/0f172a/ffffff?text=PetVoice+AI+-+Restaurant+Ordering+Reimagined)

## 📖 Project Overview
**PetVoice** is a next-generation AI-powered restaurant ordering and revenue intelligence platform. Designed to bridge the gap between seamless customer ordering and deep merchant analytics, PetVoice leverages **Gemini 2.0 Flash** and **Vapi** to create state-of-the-art voice ordering assistants. For restaurant owners, it functions as a comprehensive co-pilot, surfacing actionable insights on menu performance, intelligent pricing optimization, and market basket combinations.

## 🚨 Problem Statement
1. **Inefficient Ordering & Lost Upsell Opportunities:** Traditional online ordering relies heavily on manual touch-based UI navigating through dozens of nested menus. Staff-taken orders are prone to human error and frequently miss critical upselling opportunities.
2. **Blind Spots in Restaurant Analytics:** Most restaurant owners rely on gut instinct rather than databacked insights when pricing items, designing combos, or deciding which menu items to promote or drop.
3. **Menu Optimization Guesswork:** Without understanding "what is bought together" or classifying items as *Stars, Workhorses, Puzzles, or Dogs*, owners bleed potential revenue.

## 💡 Solution
PetVoice transforms the restaurant ecosystem by introducing:
- **For Customers:** A real-time, zero-latency **Voice Ordering AI** that understands natural language, context, quantities, and dietary preferences. It automatically places the order securely into the restaurant’s POS backend.
- **For Owners:** An advanced **Revenue Intelligence Dashboard** that analyzes every transaction, tracks item co-purchases (market basket analysis), classifies menu performance, and provides automated, AI-driven price optimization suggestions (increase, decrease, promote, or keep).

---

## ✨ Key Features

### Consumer-Facing (Voice AI)
- **Conversational AI Ordering:** Utilizes Vapi and Gemini for instantaneous, highly-contextual voice interactions.
- **Automated Cart Management:** Automatically extracts ordered items, parses quantities, calculates totals, and seamlessly records the entire cart into the database via background function calls.
- **Smart AI Upselling:** Suggests complementary items dynamically based on the current order context.
- **Live Transcript & Feedback:** Customers see a real-time speech-to-text transcript and an order review card to confirm order accuracy.

### Owner-Facing (Revenue Intelligence)
- **Menu Performance Matrix (BCG Matrix):** Automatically classifies menu items into:
  - ⭐️ **Stars** (High Sales, High Profit)
  - 🐎 **Workhorses** (High Sales, Low Profit)
  - 🧩 **Puzzles** (Low Sales, High Profit)
  - 🐕 **Dogs** (Low Sales, Low Profit)
- **Market Basket Analysis:** Tracks historical item co-purchases to reveal which items have high confidence of being bought together. Ideal for designing high-conversion combos.
- **AI Price Optimization:** Recommends precise pricing adjustments based on real-time sales velocity and historical data trends to maximize profit margins.
- **Comprehensive Daily Snapshots:** Tracks restaurant revenue, item-level costs, and overall profit margins across date ranges.

---

## 🛠️ Technology Stack

### Frontend Architecture
- **Framework:** React 19 + Vite
- **Routing:** React Router DOM v7
- **Voice AI Engine:** `@vapi-ai/web` (Vapi for real-time WebRTC audio streaming)
- **Data Visualization:** Recharts (for revenue and performance analytics)
- **UI Components:** Tailwind CSS (Custom Design System with CSS variables), React Icons, React Hot Toast

### Backend Architecture
- **Runtime:** Node.js + Express
- **Database:** PostgreSQL (Hosted on Neon DB) + `pg` client
- **Database Schema:** Custom normalized tables with junction tables for market basket analysis and UUIDs.
- **AI Core:** `@google/generative-ai` (Gemini 2.0 Flash) for data synthesis and order extraction.
- **Authentication:** JWT (JSON Web Tokens) + bcryptjs
- **Media Uploads:** Cloudinary + Multer

---

## 🏗️ System Architecture & Workflow

1. **User Interaction:** A customer opens the web application and presses "Start AI Order".
2. **Voice Processing:** Audio is streamed via **Vapi** to an LLM provider (**Gemini**), keeping latency under 500ms.
3. **Intent Recognition:** The System Prompt strictly governs the AI behavior, locking it to the restaurant's live menu.
4. **Function Execution:** Once the user says "Yes, confirm order", the LLM triggers a structured JSON `confirm_order` function call containing the items and quantities.
5. **Backend Processing:** Express receives the confirmed order, validates stock, calculates tax/subtotals, and commits the transaction to **PostgreSQL**.
6. **Analytics Hook:** Background triggers update `daily_sales`, recompute item classification scores, and update `item_co_purchases` for market basket analysis.
7. **Owner Presentation:** The owner logs in and views the updated Data Visualization dashboard.

---

## 📂 Project Structure

```text
PetVoice/
├── client/                 # React 19 Frontend
│   ├── src/
│   │   ├── components/     # Reusable UI elements (Charts, Buttons, Layouts)
│   │   ├── context/        # React Context (Auth State)
│   │   ├── lib/            # Axios API configurations and utilities
│   │   └── pages/          # Full page views (VoiceOrder, Dashboard, Auth)
│   └── package.json
│
├── server/                 # Node.js + Express Backend
│   ├── src/
│   │   ├── config/         # PostgreSQL pool, Cloudinary set up
│   │   ├── middleware/     # JWT Auth guards, Multer upload configs
│   │   └── routes/         # Express routers (api/auth, api/orders, api/analytics, etc.)
│   ├── database.sql        # Complete DB schema & triggers
│   └── package.json
└── README.md
```

---

## 🚀 Installation & Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- PostgreSQL Database (Or a free tier serverless DB like [Neon](https://neon.tech))
- API Keys: 
  - [Google Gemini API Key](https://aistudio.google.com/)
  - [Vapi Dashboard Key](https://vapi.ai/)
  - [Cloudinary Account](https://cloudinary.com/)

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/PetVoice.git
cd PetVoice
```

### 2. Database Setup
1. Create a PostgreSQL database.
2. Execute the `server/database.sql` script in your database to generate tables, indexes, and triggers.

### 3. Backend Setup
```bash
cd server
npm install
```
Create a `.env` file in the `server` directory:
```env
PORT=5000
DATABASE_URL=postgresql://user:password@host:port/dbname
JWT_SECRET=your_jwt_secret_key
GEMINI_API_KEY=your_gemini_api_key
CLOUDINARY_CLOUD_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_cloudinary_api
CLOUDINARY_API_SECRET=your_cloudinary_secret
```
Run the server:
```bash
npm run dev
```

### 4. Frontend Setup
```bash
cd ../client
npm install
```
Create a `.env` file in the `client` directory:
```env
VITE_API_URL=http://localhost:5000/api
VITE_VAPI_PUBLIC_KEY=your_vapi_public_key
```
Run the frontend:
```bash
npm run dev
```
Navigate to `http://localhost:5173` in your browser.

---

## 🌐 API & Core Components

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/register` | `POST` | Register a new user (`owner` or `customer`). |
| `/api/auth/login` | `POST` | Authenticate user and return JWT. |
| `/api/restaurants` | `GET` | Fetch active restaurants for customers. |
| `/api/menu/:restaurantId` | `GET` | Fetch available menu items and categories. |
| `/api/orders/voice` | `POST` | Secure backend endpoint that finalizes a completed Vapi voice order. |
| `/api/analytics/dashboard` | `GET` | Fetches owner's top-level metrics (revenue, orders). |
| `/api/analytics/menu-performance`| `GET` | Returns BCG matrix classification for all menu items. |

---

## 🔮 Future Improvements
1. **Multi-Lingual Voice Support:** Automatically detect customer language and respond in Hindi, Spanish, or French seamlessly utilizing Vapi's deep integrations.
2. **Predictive Inventory:** Alert restaurant owners before ingredients run out based on AI sales volume predictions.
3. **Hardware Integration:** Push incoming voice orders directly to a physical Kitchen Display System (KDS) or a thermal receipt printer via WebSocket.
4. **WhatsApp Bot Integration:** Allow customers to perform the same conversational ordering directly via WhatsApp Audio messages.

