-- ============================================================
-- 007_shop.sql
-- BCC Shop & Membership Schema
-- ============================================================

-- 1. Add 'shop' role to user_roles constraint
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;
ALTER TABLE user_roles ADD CONSTRAINT user_roles_role_check
  CHECK (role IN ('scorer', 'admin', 'shop'));

-- 2. Update has_role() so admin implies shop
CREATE OR REPLACE FUNCTION has_role(user_uuid uuid, required_role text)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = user_uuid
      AND (role = required_role OR role = 'admin')
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- 3. products table
CREATE TABLE IF NOT EXISTS products (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  image_url   text,
  category    text NOT NULL DEFAULT 'kit' CHECK (category IN ('kit','membership')),
  price_zar   integer NOT NULL,
  sizes       text[] DEFAULT '{}',
  benefits    text[] DEFAULT '{}',
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- 4. orders table
CREATE TABLE IF NOT EXISTS orders (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference        text NOT NULL UNIQUE,
  user_id          uuid REFERENCES auth.users(id),
  order_type       text NOT NULL DEFAULT 'kit' CHECK (order_type IN ('kit','membership')),
  status           text NOT NULL DEFAULT 'pending_eft'
                     CHECK (status IN ('pending_eft','paid','fulfilled','canceled')),
  amount_total     integer NOT NULL,
  line_items       jsonb NOT NULL DEFAULT '[]',
  shipping_address jsonb,
  customer_name    text,
  customer_email   text,
  notes            text,
  created_at       timestamptz DEFAULT now(),
  paid_at          timestamptz
);

-- 5. memberships table
CREATE TABLE IF NOT EXISTS memberships (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id    uuid REFERENCES orders(id),
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','expired')),
  tier        text NOT NULL DEFAULT 'standard',
  valid_from  timestamptz,
  valid_until timestamptz,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (user_id)
);

-- 6. RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;

-- products: public read, shop/admin write
CREATE POLICY "products_public_read" ON products FOR SELECT USING (true);
CREATE POLICY "products_shop_insert" ON products FOR INSERT WITH CHECK (has_role(auth.uid(), 'shop'));
CREATE POLICY "products_shop_update" ON products FOR UPDATE USING (has_role(auth.uid(), 'shop'));
CREATE POLICY "products_admin_delete" ON products FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- orders: anyone can insert their own, shop/admin can read all + update
CREATE POLICY "orders_insert" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "orders_own_select" ON orders FOR SELECT USING (user_id = auth.uid() OR has_role(auth.uid(), 'shop'));
CREATE POLICY "orders_shop_update" ON orders FOR UPDATE USING (has_role(auth.uid(), 'shop'));

-- memberships: own read, shop/admin manage
CREATE POLICY "memberships_own_select" ON memberships FOR SELECT USING (user_id = auth.uid() OR has_role(auth.uid(), 'shop'));
CREATE POLICY "memberships_insert" ON memberships FOR INSERT WITH CHECK (true);
CREATE POLICY "memberships_shop_update" ON memberships FOR UPDATE USING (has_role(auth.uid(), 'shop'));

-- 7. Seed default products
INSERT INTO products (name, description, category, price_zar, sizes, sort_order) VALUES
  ('BCC Playing Shirt', 'Official Bedfordview CC playing shirt', 'kit', 45000, ARRAY['XS','S','M','L','XL','XXL'], 1),
  ('BCC Playing Pants', 'Official Bedfordview CC playing pants', 'kit', 38000, ARRAY['XS','S','M','L','XL','XXL'], 2);

INSERT INTO products (name, description, category, price_zar, benefits, sort_order) VALUES
  ('Club Member', 'Standard season membership for Bedfordview CC', 'membership', 75000,
   ARRAY['Access to all home matches', 'Club newsletter', 'Member discount on kit', 'Vote at AGM'], 1),
  ('Family Membership', 'Season membership for your whole family', 'membership', 120000,
   ARRAY['Access to all home matches for the family', 'Club newsletter', 'Member discount on kit', 'Vote at AGM', 'Up to 4 family members'], 2);
