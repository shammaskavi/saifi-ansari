-- ======================================
-- 1. CREATE CUSTOMERS TABLE
-- ======================================
CREATE TABLE
    public.customers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
        outlet_id UUID NOT NULL REFERENCES public.outlets (id),
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        address TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now (),
        UNIQUE (outlet_id, phone)
    );

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Admin full control
CREATE POLICY "Admin can do all on customers" ON public.customers FOR ALL TO authenticated USING (public.has_role (auth.uid (), 'admin'));

-- Staff view own outlet customers
CREATE POLICY "Staff can view own outlet customers" ON public.customers FOR
SELECT
    TO authenticated USING (outlet_id = public.get_user_outlet (auth.uid ()));

-- Staff insert customers
CREATE POLICY "Staff can insert customers" ON public.customers FOR INSERT TO authenticated
WITH
    CHECK (outlet_id = public.get_user_outlet (auth.uid ()));

-- Staff update customers
CREATE POLICY "Staff can update customers" ON public.customers FOR
UPDATE TO authenticated USING (outlet_id = public.get_user_outlet (auth.uid ()));

-- ======================================
-- 2. REFACTOR INVOICES TABLE
-- ======================================
-- Add customer_id
ALTER TABLE public.invoices
ADD COLUMN customer_id UUID REFERENCES public.customers (id);

-- Remove old customer fields
ALTER TABLE public.invoices
DROP COLUMN customer_name,
DROP COLUMN customer_phone,
DROP COLUMN customer_address;

-- Remove redundant financial fields
ALTER TABLE public.invoices
DROP COLUMN amount_paid,
DROP COLUMN balance_amount,
DROP COLUMN payment_status;

-- Make customer_id mandatory
ALTER TABLE public.invoices
ALTER COLUMN customer_id
SET
    NOT NULL;

-- ======================================
-- 3. FIX PAYMENTS RLS (STAFF INSERT + VIEW)
-- ======================================
DROP POLICY IF EXISTS "Admin can do all on payments" ON public.payments;

-- SELECT
CREATE POLICY "Staff and admin can view payments" ON public.payments FOR
SELECT
    TO authenticated USING (
        public.has_role (auth.uid (), 'admin')
        OR EXISTS (
            SELECT
                1
            FROM
                public.invoices i
            WHERE
                i.id = payments.invoice_id
                AND i.outlet_id = public.get_user_outlet (auth.uid ())
        )
    );

-- INSERT
CREATE POLICY "Staff and admin can insert payments" ON public.payments FOR INSERT TO authenticated
WITH
    CHECK (
        public.has_role (auth.uid (), 'admin')
        OR EXISTS (
            SELECT
                1
            FROM
                public.invoices i
            WHERE
                i.id = payments.invoice_id
                AND i.outlet_id = public.get_user_outlet (auth.uid ())
        )
    );

-- UPDATE (admin only)
CREATE POLICY "Admin can update payments" ON public.payments FOR
UPDATE TO authenticated USING (public.has_role (auth.uid (), 'admin'));

-- DELETE (admin only)
CREATE POLICY "Admin can delete payments" ON public.payments FOR DELETE TO authenticated USING (public.has_role (auth.uid (), 'admin'));

-- ======================================
-- 4. FINANCIAL VIEWS
-- ======================================
CREATE VIEW
    public.invoice_financials AS
SELECT
    i.id,
    i.customer_id,
    i.outlet_id,
    i.total_amount,
    COALESCE(SUM(p.amount), 0) AS total_paid,
    i.total_amount - COALESCE(SUM(p.amount), 0) AS total_due
FROM
    public.invoices i
    LEFT JOIN public.payments p ON p.invoice_id = i.id
GROUP BY
    i.id;

CREATE VIEW
    public.customer_financial_summary AS
SELECT
    c.id,
    c.name,
    c.phone,
    c.outlet_id,
    COALESCE(SUM(i.total_amount), 0) AS total_billed,
    COALESCE(SUM(p.amount), 0) AS total_paid,
    COALESCE(SUM(i.total_amount), 0) - COALESCE(SUM(p.amount), 0) AS total_due
FROM
    public.customers c
    LEFT JOIN public.invoices i ON i.customer_id = c.id
    LEFT JOIN public.payments p ON p.invoice_id = i.id
GROUP BY
    c.id;