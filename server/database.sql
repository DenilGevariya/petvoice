-- =====================================================
-- PetVoice - AI Restaurant Ordering & Revenue Platform
-- Database Schema - Run this in pgAdmin
-- =====================================================

-- Create Database (run this separately if needed)
-- CREATE DATABASE petvoice;


-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS update_restaurants_updated_at ON restaurants;
DROP TRIGGER IF EXISTS update_menu_items_updated_at ON menu_items;
DROP TRIGGER IF EXISTS update_combos_updated_at ON combos;
DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
-- =====================================================
-- 1. USERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('customer', 'owner')),
    phone VARCHAR(20),
    avatar_url TEXT,
    preferred_language VARCHAR(10) DEFAULT 'en',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 2. RESTAURANTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS restaurants (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    cuisine_type VARCHAR(100),
    address TEXT,
    city VARCHAR(100),
    phone VARCHAR(20),
    email VARCHAR(255),
    logo_url TEXT,
    cover_image_url TEXT,
    opening_time TIME DEFAULT '09:00',
    closing_time TIME DEFAULT '23:00',
    is_active BOOLEAN DEFAULT true NOT NULL,
    avg_rating NUMERIC(3,2) DEFAULT 0.00,
    total_orders INTEGER DEFAULT 0,
    total_revenue NUMERIC(12,2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 3. MENU CATEGORIES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS menu_categories (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 4. MENU ITEMS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS menu_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    category_id UUID REFERENCES menu_categories(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price NUMERIC(10,2) NOT NULL,
    cost_price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    image_url TEXT,
    is_available BOOLEAN DEFAULT true NOT NULL,
    is_veg BOOLEAN DEFAULT false,
    is_bestseller BOOLEAN DEFAULT false,
    spice_level INTEGER DEFAULT 0 CHECK (spice_level >= 0 AND spice_level <= 5),
    preparation_time INTEGER DEFAULT 15, -- in minutes
    total_sales INTEGER DEFAULT 0,
    total_revenue NUMERIC(12,2) DEFAULT 0.00,
    avg_daily_sales NUMERIC(8,2) DEFAULT 0.00,
    popularity_score NUMERIC(5,2) DEFAULT 0.00,
    classification VARCHAR(20) DEFAULT 'unclassified' CHECK (classification IN ('star', 'workhorse', 'puzzle', 'dog', 'unclassified')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 5. COMBOS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS combos (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    combo_price NUMERIC(10,2) NOT NULL,
    original_price NUMERIC(10,2) NOT NULL,
    discount_percentage NUMERIC(5,2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT true NOT NULL,
    total_sales INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 6. COMBO ITEMS (Junction Table)
-- =====================================================
CREATE TABLE IF NOT EXISTS combo_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    combo_id UUID NOT NULL REFERENCES combos(id) ON DELETE CASCADE,
    menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    quantity INTEGER DEFAULT 1,
    UNIQUE(combo_id, menu_item_id)
);

-- =====================================================
-- 7. ORDERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS orders (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    order_number VARCHAR(20) NOT NULL,
    status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled')),
    subtotal NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    tax NUMERIC(10,2) DEFAULT 0.00,
    discount NUMERIC(10,2) DEFAULT 0.00,
    total NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    payment_method VARCHAR(30) DEFAULT 'cash',
    notes TEXT,
    ordered_via VARCHAR(20) DEFAULT 'voice' CHECK (ordered_via IN ('voice', 'manual', 'web')),
    ai_upsell_accepted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 8. ORDER ITEMS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS order_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id UUID REFERENCES menu_items(id) ON DELETE SET NULL,
    combo_id UUID REFERENCES combos(id) ON DELETE SET NULL,
    item_name VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price NUMERIC(10,2) NOT NULL,
    total_price NUMERIC(10,2) NOT NULL,
    is_upsell BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 9. ITEM CO-PURCHASE TABLE (for market basket analysis)
-- =====================================================
CREATE TABLE IF NOT EXISTS item_co_purchases (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    item_a_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    item_b_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    co_purchase_count INTEGER DEFAULT 1,
    confidence NUMERIC(5,4) DEFAULT 0.0000,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(restaurant_id, item_a_id, item_b_id)
);

-- =====================================================
-- 10. SALES ANALYTICS (Daily Snapshots)
-- =====================================================
CREATE TABLE IF NOT EXISTS daily_sales (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
    quantity_sold INTEGER DEFAULT 0,
    revenue NUMERIC(10,2) DEFAULT 0.00,
    cost NUMERIC(10,2) DEFAULT 0.00,
    profit NUMERIC(10,2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(restaurant_id, menu_item_id, sale_date)
);

-- =====================================================
-- 11. PRICE OPTIMIZATION HISTORY
-- =====================================================
CREATE TABLE IF NOT EXISTS price_suggestions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    current_price NUMERIC(10,2) NOT NULL,
    suggested_price NUMERIC(10,2) NOT NULL,
    reason TEXT,
    action VARCHAR(20) CHECK (action IN ('increase', 'decrease', 'promote', 'keep')),
    is_applied BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_restaurants_owner_id ON restaurants(owner_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant_id ON menu_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_classification ON menu_items(classification);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_id ON orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_menu_item_id ON order_items(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_daily_sales_restaurant_date ON daily_sales(restaurant_id, sale_date);
CREATE INDEX IF NOT EXISTS idx_daily_sales_item_date ON daily_sales(menu_item_id, sale_date);
CREATE INDEX IF NOT EXISTS idx_item_co_purchases_restaurant ON item_co_purchases(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_combos_restaurant_id ON combos(restaurant_id);

-- =====================================================
-- TRIGGER: Auto-update updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_restaurants_updated_at BEFORE UPDATE ON restaurants 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_menu_items_updated_at BEFORE UPDATE ON menu_items 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_combos_updated_at BEFORE UPDATE ON combos 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- SEED DATA: Sample Restaurant with Menu
-- =====================================================

-- Note: Run the application first and register a restaurant owner,
-- then the seed data below can be used for testing analytics.
-- The actual data will be populated through the application.

SELECT 'PetVoice Database Schema Created Successfully!' AS status;
