-- =========================================================================
-- RestroBrain - Synthetic Order Data Generator (All Restaurants)
-- Compatible with Neon PostgreSQL
-- Instructions: Copy and paste this script into your Neon SQL editor and run it.
-- It will automatically find ALL restaurants, populate their menus (if empty),
-- and generate 30 days of realistic orders spanning all BCG quadrant classifications,
-- including complex co-purchase patterns (combos), BOGO targets, and weekend surges.
-- =========================================================================

DO $$
DECLARE
    v_restaurant RECORD;
    v_user_id UUID;
    v_cat_id UUID;
    v_menu_item RECORD;
    v_avg_sales NUMERIC;
    v_avg_margin NUMERIC;
    v_max_sales INTEGER := 0;
    
    -- Arrays for our menu items grouped by desired demand & margin
    v_high_demand_high_margin UUID[];
    v_low_demand_high_margin UUID[];
    v_high_demand_low_margin UUID[];
    v_low_demand_low_margin UUID[];
    
    v_item_id UUID;
    v_order_id UUID;
    v_combo_item1 UUID;
    v_combo_item2 UUID;
    v_bogo_item UUID;
    
    v_day INT;
    v_orders_today INT;
    v_order_date TIMESTAMPTZ;
    v_is_weekend BOOLEAN;
BEGIN
    -- Loop over all restaurants in the database
    FOR v_restaurant IN (SELECT id, owner_id FROM restaurants) LOOP
        v_user_id := v_restaurant.owner_id;

        -- 1. Clear existing synthetic order/analytics data for this restaurant
        DELETE FROM item_co_purchases WHERE restaurant_id = v_restaurant.id;
        DELETE FROM daily_sales WHERE restaurant_id = v_restaurant.id;
        DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE restaurant_id = v_restaurant.id);
        DELETE FROM orders WHERE restaurant_id = v_restaurant.id;
        
        UPDATE menu_items 
        SET total_sales = 0, total_revenue = 0, avg_daily_sales = 0, popularity_score = 0 
        WHERE restaurant_id = v_restaurant.id;
        
        UPDATE restaurants 
        SET total_orders = 0, total_revenue = 0 
        WHERE id = v_restaurant.id;

        -- 2. If no menu items exist for this restaurant, create standard dummy data
        IF (SELECT count(*) FROM menu_items WHERE restaurant_id = v_restaurant.id) < 8 THEN
            -- create category
            IF NOT EXISTS (SELECT 1 FROM menu_categories WHERE restaurant_id = v_restaurant.id AND name = 'Popular Items') THEN
                INSERT INTO menu_categories (restaurant_id, name) VALUES (v_restaurant.id, 'Popular Items') RETURNING id INTO v_cat_id;
            ELSE
                SELECT id INTO v_cat_id FROM menu_categories WHERE restaurant_id = v_restaurant.id AND name = 'Popular Items' LIMIT 1;
            END IF;
            
            INSERT INTO menu_items (restaurant_id, category_id, name, price, cost_price) VALUES 
            (v_restaurant.id, v_cat_id, 'Margherita Pizza', 15.00, 3.00),
            (v_restaurant.id, v_cat_id, 'Truffle Pasta', 22.00, 6.00),
            (v_restaurant.id, v_cat_id, 'Garlic Bread', 6.00, 4.00),
            (v_restaurant.id, v_cat_id, 'House Salad', 8.00, 6.00),
            (v_restaurant.id, v_cat_id, 'Chicken Wings', 12.00, 9.00),
            (v_restaurant.id, v_cat_id, 'Chocolate Lava Cake', 9.00, 2.00),
            (v_restaurant.id, v_cat_id, 'Coke', 3.00, 1.00),
            (v_restaurant.id, v_cat_id, 'French Fries', 5.00, 3.50)
            ON CONFLICT DO NOTHING;
        END IF;

        -- 3. Adjust margins to guarantee BCG classification for this restaurant
        DROP TABLE IF EXISTS temp_menu;
        CREATE TEMP TABLE temp_menu AS
        SELECT id, row_number() over (order by id) as rn
        FROM menu_items WHERE restaurant_id = v_restaurant.id;
        
        -- Stars: High Demand, High Margin (Cost is 20% of Price) -> price increase candidate
        UPDATE menu_items SET cost_price = price * 0.2 
        WHERE id IN (SELECT id FROM temp_menu WHERE rn % 4 = 1);
        
        -- Puzzles/Hidden Stars: Low Demand, High Margin (Cost is 15% of Price) -> promote candidate
        UPDATE menu_items SET cost_price = price * 0.15 
        WHERE id IN (SELECT id FROM temp_menu WHERE rn % 4 = 2);
        
        -- Workhorses: High Demand, Low Margin (Cost is 75% of Price) -> optimize cost/discount candidate
        UPDATE menu_items SET cost_price = price * 0.75 
        WHERE id IN (SELECT id FROM temp_menu WHERE rn % 4 = 3);
        
        -- Dogs: Low Demand, Low Margin (Cost is 85% of Price) -> drop candidate
        UPDATE menu_items SET cost_price = price * 0.85 
        WHERE id IN (SELECT id FROM temp_menu WHERE rn % 4 = 0);
        
        -- Gather items into arrays
        SELECT array_agg(id) INTO v_high_demand_high_margin FROM temp_menu WHERE rn % 4 = 1;
        SELECT array_agg(id) INTO v_low_demand_high_margin FROM temp_menu WHERE rn % 4 = 2;
        SELECT array_agg(id) INTO v_high_demand_low_margin FROM temp_menu WHERE rn % 4 = 3;
        SELECT array_agg(id) INTO v_low_demand_low_margin FROM temp_menu WHERE rn % 4 = 0;
        
        -- Handle edge cases if arrays are null
        IF v_high_demand_high_margin IS NULL THEN v_high_demand_high_margin := ARRAY[]::UUID[]; END IF;
        IF v_low_demand_high_margin IS NULL THEN v_low_demand_high_margin := ARRAY[]::UUID[]; END IF;
        IF v_high_demand_low_margin IS NULL THEN v_high_demand_low_margin := ARRAY[]::UUID[]; END IF;
        IF v_low_demand_low_margin IS NULL THEN v_low_demand_low_margin := ARRAY[]::UUID[]; END IF;

        -- Select items for frequent Combos / BOGOs
        v_combo_item1 := NULL;
        v_combo_item2 := NULL;
        v_bogo_item := NULL;

        -- 1 Star item, 1 Workhorse item = Great Combo Candidate
        IF array_length(v_high_demand_high_margin, 1) > 0 THEN
             v_combo_item1 := v_high_demand_high_margin[1];
        END IF;

        IF array_length(v_high_demand_low_margin, 1) > 0 THEN
             v_combo_item2 := v_high_demand_low_margin[1];
        END IF;

        -- Puzzle item (high margin, low demand) = Great BOGO/Promote candidate
        IF array_length(v_low_demand_high_margin, 1) > 0 THEN
             v_bogo_item := v_low_demand_high_margin[1];
        END IF;

        -- 4. Generate Orders for the past 30 days
        FOR v_day IN 0..30 LOOP
            v_order_date := (CURRENT_DATE - INTERVAL '1 day' * (30 - v_day)) + INTERVAL '12 hours';
            v_is_weekend := EXTRACT(DOW FROM v_order_date) IN (0, 6);
            
            -- Generate between 8 and 25 orders per day on weekdays
            v_orders_today := floor(random() * 18 + 8);
            
            -- Boost volume by 50% on weekends to trigger weekend promotion intelligence
            IF v_is_weekend THEN
                v_orders_today := floor(v_orders_today * 1.5);
            END IF;
            
            FOR i IN 1..v_orders_today LOOP
                -- Create the root order utilizing gen_random_uuid logic mapped to hex
                INSERT INTO orders (user_id, restaurant_id, order_number, status, subtotal, tax, total, created_at, updated_at, ai_upsell_accepted)
                VALUES (v_user_id, v_restaurant.id, 'SYNTH-' || substr(md5(random()::text), 1, 8) || '-' || v_day || '-' || i, 'delivered', 0, 0, 0, v_order_date, v_order_date, (random() > 0.8))
                RETURNING id INTO v_order_id;
                
                -- High Demand High Margin (Stars) -> 75% chance (90% on weekends)
                IF random() < (CASE WHEN v_is_weekend THEN 0.90 ELSE 0.75 END) AND array_length(v_high_demand_high_margin, 1) > 0 THEN
                    v_item_id := v_high_demand_high_margin[ floor(random() * array_length(v_high_demand_high_margin, 1)) + 1 ];
                    INSERT INTO order_items (order_id, menu_item_id, item_name, quantity, unit_price, total_price, created_at)
                    SELECT v_order_id, id, name, floor(random()*2)+1, price, price * (floor(random()*2)+1), v_order_date FROM menu_items WHERE id = v_item_id;
                END IF;
                
                -- High Demand Low Margin (Workhorses) -> 85% chance
                IF random() < 0.85 AND array_length(v_high_demand_low_margin, 1) > 0 THEN
                    v_item_id := v_high_demand_low_margin[ floor(random() * array_length(v_high_demand_low_margin, 1)) + 1 ];
                    INSERT INTO order_items (order_id, menu_item_id, item_name, quantity, unit_price, total_price, created_at)
                    SELECT v_order_id, id, name, floor(random()*3)+1, price, price * (floor(random()*3)+1), v_order_date FROM menu_items WHERE id = v_item_id;
                END IF;
                
                -- Low Demand High Margin (Puzzles / Hidden Stars) -> 12% chance
                IF random() < 0.12 AND array_length(v_low_demand_high_margin, 1) > 0 THEN
                    v_item_id := v_low_demand_high_margin[ floor(random() * array_length(v_low_demand_high_margin, 1)) + 1 ];
                    INSERT INTO order_items (order_id, menu_item_id, item_name, quantity, unit_price, total_price, created_at)
                    SELECT v_order_id, id, name, 1, price, price * 1, v_order_date FROM menu_items WHERE id = v_item_id;
                END IF;
                
                -- Low Demand Low Margin (Dogs) -> 8% chance (good candidate for drop suggestions)
                IF random() < 0.08 AND array_length(v_low_demand_low_margin, 1) > 0 THEN
                    v_item_id := v_low_demand_low_margin[ floor(random() * array_length(v_low_demand_low_margin, 1)) + 1 ];
                    INSERT INTO order_items (order_id, menu_item_id, item_name, quantity, unit_price, total_price, created_at)
                    SELECT v_order_id, id, name, 1, price, price * 1, v_order_date FROM menu_items WHERE id = v_item_id;
                END IF;
                
                -- Frequent Combo Injector: Guarantee that specific items are bought together often! (45% chance)
                IF random() < 0.45 AND v_combo_item1 IS NOT NULL AND v_combo_item2 IS NOT NULL THEN
                    IF NOT EXISTS (SELECT 1 FROM order_items WHERE order_id = v_order_id AND menu_item_id = v_combo_item1) THEN
                        INSERT INTO order_items (order_id, menu_item_id, item_name, quantity, unit_price, total_price, created_at)
                        SELECT v_order_id, id, name, 1, price, price * 1, v_order_date FROM menu_items WHERE id = v_combo_item1;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM order_items WHERE order_id = v_order_id AND menu_item_id = v_combo_item2) THEN
                        INSERT INTO order_items (order_id, menu_item_id, item_name, quantity, unit_price, total_price, created_at)
                        SELECT v_order_id, id, name, 1, price, price * 1, v_order_date FROM menu_items WHERE id = v_combo_item2;
                    END IF;
                END IF;

                -- BOGO Injector: 30% chance to buy multiple of the bogo_item (forces BOGO pattern recognition)
                IF random() < 0.30 AND v_bogo_item IS NOT NULL THEN
                     IF NOT EXISTS (SELECT 1 FROM order_items WHERE order_id = v_order_id AND menu_item_id = v_bogo_item) THEN
                        INSERT INTO order_items (order_id, menu_item_id, item_name, quantity, unit_price, total_price, created_at)
                        SELECT v_order_id, id, name, 2, price, price * 2, v_order_date FROM menu_items WHERE id = v_bogo_item;
                    END IF;
                END IF;
                
                -- Compute accurate order subtotals and taxes
                UPDATE orders 
                SET subtotal = COALESCE((SELECT SUM(total_price) FROM order_items WHERE order_id = v_order_id), 0),
                    tax = COALESCE((SELECT SUM(total_price) * 0.05 FROM order_items WHERE order_id = v_order_id), 0),
                    total = COALESCE((SELECT SUM(total_price) * 1.05 FROM order_items WHERE order_id = v_order_id), 0)
                WHERE id = v_order_id;
                
                -- Safety catch: if an order accidentally generated 0 items, delete it
                DELETE FROM orders WHERE id = v_order_id AND total = 0;
                
            END LOOP;
        END LOOP;

        -- 5. Populate Aggregation Tables (daily_sales, item_co_purchases)
        
        -- Insert into daily_sales
        INSERT INTO daily_sales (restaurant_id, menu_item_id, sale_date, quantity_sold, revenue, cost, profit)
        SELECT 
            o.restaurant_id,
            oi.menu_item_id,
            DATE(o.created_at) as sale_date,
            SUM(oi.quantity) as quantity_sold,
            SUM(oi.total_price) as revenue,
            SUM(mi.cost_price * oi.quantity) as cost,
            SUM(oi.total_price - (mi.cost_price * oi.quantity)) as profit
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        JOIN menu_items mi ON oi.menu_item_id = mi.id
        WHERE o.restaurant_id = v_restaurant.id
        GROUP BY o.restaurant_id, oi.menu_item_id, DATE(o.created_at);
        
        -- Update menu_items with rolling stats
        UPDATE menu_items mi
        SET total_sales = COALESCE((SELECT SUM(quantity_sold) FROM daily_sales WHERE menu_item_id = mi.id), 0),
            total_revenue = COALESCE((SELECT SUM(revenue) FROM daily_sales WHERE menu_item_id = mi.id), 0)
        WHERE restaurant_id = v_restaurant.id;
            
        -- Update restaurant total stats
        UPDATE restaurants r
        SET total_orders = (SELECT count(*) FROM orders WHERE restaurant_id = r.id),
            total_revenue = (SELECT sum(total) FROM orders WHERE restaurant_id = r.id)
        WHERE id = v_restaurant.id;

        -- Compile exact item_co_purchases (for Market Basket Analysis)
        INSERT INTO item_co_purchases (restaurant_id, item_a_id, item_b_id, co_purchase_count)
        SELECT 
            o.restaurant_id,
            LEAST(oi1.menu_item_id, oi2.menu_item_id),
            GREATEST(oi1.menu_item_id, oi2.menu_item_id),
            count(distinct o.id)
        FROM orders o
        JOIN order_items oi1 ON o.id = oi1.order_id
        JOIN order_items oi2 ON o.id = oi2.order_id AND oi1.menu_item_id != oi2.menu_item_id
        WHERE o.restaurant_id = v_restaurant.id
        GROUP BY 1, 2, 3;
        
        -- 6. Trigger BCG Classifications (Star, Workhorse, Puzzle, Dog)
        
        SELECT COALESCE(AVG(total_sales), 0) INTO v_avg_sales FROM menu_items WHERE restaurant_id = v_restaurant.id AND total_sales > 0;
        SELECT COALESCE(AVG(price - cost_price), 0) INTO v_avg_margin FROM menu_items WHERE restaurant_id = v_restaurant.id;
        SELECT COALESCE(MAX(total_sales), 1) INTO v_max_sales FROM menu_items WHERE restaurant_id = v_restaurant.id;
        
        IF v_max_sales = 0 THEN v_max_sales = 1; END IF;
        
        FOR v_menu_item IN (SELECT id, price, cost_price, total_sales FROM menu_items WHERE restaurant_id = v_restaurant.id) LOOP
            DECLARE
                v_margin NUMERIC := v_menu_item.price - v_menu_item.cost_price;
                v_sales INT := v_menu_item.total_sales;
                v_class VARCHAR;
                v_score NUMERIC;
            BEGIN
                -- Classification Logic Match
                IF v_sales >= v_avg_sales AND v_margin >= v_avg_margin THEN
                    v_class := 'star';
                ELSIF v_sales >= v_avg_sales AND v_margin < v_avg_margin THEN
                    v_class := 'workhorse';
                ELSIF v_sales < v_avg_sales AND v_margin >= v_avg_margin THEN
                    v_class := 'puzzle';
                ELSE
                    v_class := 'dog';
                END IF;
                
                v_score := (v_sales::NUMERIC / v_max_sales::NUMERIC) * 100.0;
                
                UPDATE menu_items SET classification = v_class, popularity_score = v_score WHERE id = v_menu_item.id;
            END;
        END LOOP;
        
    END LOOP; -- End restaurant loop
    
    DROP TABLE IF EXISTS temp_menu;
END $$;
