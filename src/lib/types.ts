export type AppRole = 'admin' | 'staff';

export interface Outlet {
  id: string;
  name: string;
  prefix: string;
  address: string | null;
  phone: string | null;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  outlet_id: string | null;
}

export interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  outlet_id: string;
  date: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string | null;
  delivery_date: string;
  order_type: 'Normal' | 'Urgent';
  notes: string | null;
  total_pieces: number;
  total_amount: number;
  amount_paid: number;
  balance_amount: number;
  invoice_status: 'Open' | 'Partial' | 'Delivered';
  payment_status: 'Unpaid' | 'Partially Paid' | 'Paid';
  created_by: string;
  delivery_notes: string | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  product_category: 'Saree' | 'Garment';
  product_type: string;
  service: string;
  quantity: number;
  rate: number;
  total: number;
  status: 'Received' | 'In Process' | 'Ready' | 'Delivered';
  created_at: string;
}

export interface Payment {
  id: string;
  invoice_id: string;
  amount: number;
  payment_mode: 'Cash' | 'UPI' | 'Bank';
  payment_date: string;
  notes: string | null;
  created_at: string;
}

export interface AuthContextType {
  user: any | null;
  profile: Profile | null;
  role: AppRole | null;
  outletId: string | null;
  outlets: Outlet[];
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}
