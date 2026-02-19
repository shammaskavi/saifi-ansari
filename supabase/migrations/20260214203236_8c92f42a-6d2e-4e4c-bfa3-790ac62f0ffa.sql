
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'staff');

-- Create outlets table
CREATE TABLE public.outlets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  prefix TEXT NOT NULL UNIQUE,
  address TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'staff',
  outlet_id UUID REFERENCES public.outlets(id),
  UNIQUE(user_id, role)
);

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create invoices table
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  outlet_id UUID NOT NULL REFERENCES public.outlets(id),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_address TEXT,
  delivery_date DATE NOT NULL,
  order_type TEXT NOT NULL DEFAULT 'Normal' CHECK (order_type IN ('Normal', 'Urgent')),
  notes TEXT,
  total_pieces INT NOT NULL DEFAULT 0,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(10,2) NOT NULL DEFAULT 0,
  balance_amount NUMERIC(10,2) GENERATED ALWAYS AS (total_amount - amount_paid) STORED,
  invoice_status TEXT NOT NULL DEFAULT 'Open' CHECK (invoice_status IN ('Open', 'Partial', 'Delivered')),
  payment_status TEXT NOT NULL DEFAULT 'Unpaid' CHECK (payment_status IN ('Unpaid', 'Partially Paid', 'Paid')),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create invoice_items table
CREATE TABLE public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  product_category TEXT NOT NULL CHECK (product_category IN ('Saree', 'Garment')),
  product_type TEXT NOT NULL,
  service TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  rate NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) GENERATED ALWAYS AS (quantity * rate) STORED,
  status TEXT NOT NULL DEFAULT 'Received' CHECK (status IN ('Received', 'In Process', 'Ready', 'Delivered')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create payments table
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  payment_mode TEXT NOT NULL CHECK (payment_mode IN ('Cash', 'UPI', 'Bank')),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create invoice sequence table for per-outlet numbering
CREATE TABLE public.invoice_sequences (
  outlet_id UUID PRIMARY KEY REFERENCES public.outlets(id),
  last_number INT NOT NULL DEFAULT 0
);

-- Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Get user outlet
CREATE OR REPLACE FUNCTION public.get_user_outlet(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT outlet_id FROM public.user_roles
  WHERE user_id = _user_id LIMIT 1
$$;

-- Generate next invoice number
CREATE OR REPLACE FUNCTION public.generate_invoice_number(_outlet_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _prefix TEXT;
  _next_num INT;
BEGIN
  SELECT prefix INTO _prefix FROM public.outlets WHERE id = _outlet_id;
  
  INSERT INTO public.invoice_sequences (outlet_id, last_number)
  VALUES (_outlet_id, 1)
  ON CONFLICT (outlet_id) DO UPDATE SET last_number = invoice_sequences.last_number + 1
  RETURNING last_number INTO _next_num;
  
  RETURN _prefix || '-' || LPAD(_next_num::TEXT, 4, '0');
END;
$$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS on all tables
ALTER TABLE public.outlets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_sequences ENABLE ROW LEVEL SECURITY;

-- Outlets: all authenticated can read
CREATE POLICY "Authenticated users can view outlets" ON public.outlets
  FOR SELECT TO authenticated USING (true);

-- User roles: users can read their own
CREATE POLICY "Users can view own role" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Admin can manage roles
CREATE POLICY "Admin can manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Profiles: users can read/update own
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Admin can view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Invoices: staff sees own outlet, admin sees all
CREATE POLICY "Admin can do all on invoices" ON public.invoices
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can view own outlet invoices" ON public.invoices
  FOR SELECT TO authenticated
  USING (outlet_id = public.get_user_outlet(auth.uid()) AND is_deleted = false);

CREATE POLICY "Staff can insert own outlet invoices" ON public.invoices
  FOR INSERT TO authenticated
  WITH CHECK (outlet_id = public.get_user_outlet(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Staff can update own outlet invoices" ON public.invoices
  FOR UPDATE TO authenticated
  USING (outlet_id = public.get_user_outlet(auth.uid()));

-- Invoice items: follow invoice access
CREATE POLICY "Admin can do all on items" ON public.invoice_items
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can view own outlet items" ON public.invoice_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.invoices 
    WHERE id = invoice_items.invoice_id 
    AND outlet_id = public.get_user_outlet(auth.uid())
    AND is_deleted = false
  ));

CREATE POLICY "Staff can insert items" ON public.invoice_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.invoices 
    WHERE id = invoice_items.invoice_id 
    AND outlet_id = public.get_user_outlet(auth.uid())
  ));

CREATE POLICY "Staff can update items" ON public.invoice_items
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.invoices 
    WHERE id = invoice_items.invoice_id 
    AND outlet_id = public.get_user_outlet(auth.uid())
  ));

-- Payments: admin only
CREATE POLICY "Admin can do all on payments" ON public.payments
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Invoice sequences: admin only
CREATE POLICY "Admin can manage sequences" ON public.invoice_sequences
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Seed outlets
INSERT INTO public.outlets (name, prefix, address, phone) VALUES
  ('Alkapuri Arcade', 'A', 'Alkapuri Arcade, R.C Dutt Road, Vadodara - 390 007', '+91 99984 08644'),
  ('Branch B', 'B', 'Branch B Address, Vadodara', '+91 99984 08645');
