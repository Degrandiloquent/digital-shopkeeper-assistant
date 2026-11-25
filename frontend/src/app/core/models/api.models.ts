// Shapes returned by the API. They mirror backend/app/schemas.

export type ShopStatus = 'open' | 'closed' | 'temporarily_unavailable';
export type StockState = 'in_stock' | 'low_stock' | 'out_of_stock';
export type UserRole = 'owner' | 'staff';
export type AnnouncementTone = 'info' | 'promo' | 'warning';

export type Permission =
  | 'dashboard.view'
  | 'products.view'
  | 'products.manage'
  | 'sales.create'
  | 'sales.view_all'
  | 'sales.view_own'
  | 'business.view'
  | 'business.manage'
  | 'announcements.manage'
  | 'activity.view';

export interface BusinessSummary {
  id: string;
  slug: string;
  name: string;
  area_label: string;
  status: ShopStatus;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  last_login_at: string | null;
}

export interface CurrentUser {
  user: UserProfile;
  business: BusinessSummary;
  permissions: Permission[];
}

export interface LoginResponse extends CurrentUser {
  access_token: string;
  refresh_token: string;
  token_type: string;
  access_token_expires_in: number;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  access_token_expires_in: number;
}

export interface DayHours {
  closed: boolean;
  open: string | null;
  close: string | null;
}

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type OpeningHours = Record<DayKey, DayHours>;

export const DAY_KEYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export const DAY_NAMES: Record<DayKey, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday'
};

export interface Business {
  id: string;
  slug: string;
  name: string;
  area_label: string;
  timezone: string;
  hours: OpeningHours;
  status: ShopStatus;
  status_message: string | null;
  contact_note: string | null;
  status_updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  price_cents: number;
  stock_qty: number;
  low_stock_threshold: number;
  is_active: boolean;
  is_featured: boolean;
  updated_at: string;
  stock_state: StockState;
}

export interface ProductInput {
  name: string;
  category: string;
  price_cents: number;
  stock_qty?: number;
  low_stock_threshold: number;
  is_featured: boolean;
}

export interface StockAdjustmentInput {
  delta: number;
  reason: 'restock' | 'correction' | 'damaged';
  note?: string | null;
}

export interface SaleItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
  stock_after: number | null;
  stock_state: StockState | null;
}

export interface Sale {
  id: string;
  created_at: string;
  total_cents: number;
  unit_count: number;
  cashier_name: string;
  items: SaleItem[];
  replayed: boolean;
}

export type SalesPeriod = 'today' | '7d' | '30d' | 'all';

export interface SaleList {
  items: Sale[];
  sale_count: number;
  total_cents: number;
  period: SalesPeriod;
}

export interface DashboardSummary {
  business: { name: string; status: ShopStatus; status_message: string | null };
  kpis: {
    active_products: number;
    low_stock_count: number;
    out_of_stock_count: number;
    sales_today_count: number;
    sales_today_cents: number;
    units_sold_today: number;
  };
  low_stock_items: Product[];
  top_sellers_today: { product_id: string; name: string; quantity: number; revenue_cents: number }[];
  sales_last_7_days: { date: string; label: string; total_cents: number; sale_count: number; is_today: boolean }[];
  recent_sales: Sale[];
  generated_at: string;
}

export type AnnouncementState = 'live' | 'scheduled' | 'expired' | 'ended';

export interface Announcement {
  id: string;
  title: string;
  body: string;
  tone: AnnouncementTone;
  active_from: string;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  state: AnnouncementState;
}

export interface AnnouncementInput {
  title: string;
  body: string;
  tone: AnnouncementTone;
  expires_at: string | null;
}

export interface ActivityItem {
  id: string;
  created_at: string;
  actor_name: string | null;
  action: string;
  entity_type: string;
  summary: string;
}

export interface PublicProduct {
  name: string;
  category: string;
  price_cents: number;
  availability: StockState;
}

export interface PublicShop {
  slug: string;
  name: string;
  area_label: string;
  status: ShopStatus;
  status_message: string | null;
  hours: OpeningHours;
  today_key: DayKey;
  today: DayHours;
  contact_note: string | null;
  announcement: { title: string; body: string; tone: AnnouncementTone; expires_at: string | null } | null;
  products: PublicProduct[];
  categories: string[];
  updated_at: string;
  generated_at: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
    correlation_id?: string;
  };
}

export interface OrderItem {
  name: string;
  quantity: number;
  price_cents: number;
  category: string;
}

export interface Order {
  id: string;
  customer_name: string;
  customer_phone: string;
  items: OrderItem[];
  total_price_cents: number;
  status: 'pending' | 'done';
  created_at: string;
}
