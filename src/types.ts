/**
 * Shared Type Definitions for Mac Data Hub
 */

export type UserRole = 'admin' | 'reseller' | 'customer';
export type UserStatus = 'active' | 'suspended' | 'pending_payment';

export interface User {
  id: number;
  email: string;
  role: UserRole;
  status: UserStatus;
  store_name?: string;
  store_slug?: string;
  phone?: string;
  registration_fee_paid_ghs: number;
  created_at: string;
}

export interface Bundle {
  id: number;
  name: string;
  network: 'MTN' | 'Vodafone' | 'AirtelTigo' | 'Glo';
  data_amount: string; // e.g. "5 GB" or "500 MB"
  validity_days: number;
  admin_base_price_ghs: number;
  provider_plan_code: string;
  status: 'active' | 'inactive';
  created_at: string;
}

export interface ResellerPricing {
  id: number;
  reseller_id: number;
  bundle_id: number;
  markup_type: 'fixed' | 'percentage';
  markup_value: number;
  final_price_ghs: number;
}

export interface Order {
  id: number;
  order_ref: string;
  customer_id: number;
  customer_email?: string;
  reseller_id: number | null; // null means direct purchase from main storefront
  reseller_store_name?: string;
  bundle_id: number;
  bundle_name?: string;
  bundle_network?: string;
  bundle_data_amount?: string;
  customer_phone: string;
  admin_base_price_ghs: number;
  reseller_markup_ghs: number;
  final_price_ghs: number;
  admin_fee_ghs: number;
  net_to_reseller_ghs: number;
  delivery_status: 'pending' | 'delivered' | 'failed';
  payment_status: 'pending' | 'paid' | 'failed';
  created_at: string;
}

export interface PaymentLog {
  id: number;
  order_id: number;
  transaction_ref: string;
  provider: 'flutterwave' | 'paystack';
  amount_ghs: number;
  customer_email: string;
  customer_phone: string;
  status: string;
  webhook_payload?: string;
  created_at: string;
}

export interface ResellerAccount {
  user_id: number;
  store_name: string;
  store_slug: string;
  email: string;
  status: UserStatus;
  balance_ghs: number;
  total_earned_ghs: number;
  total_customers: number;
  deduction_source: 'storefront_earnings' | 'registration_balance';
  role?: string;
}

export interface WithdrawalRequest {
  id: number;
  reseller_id: number;
  reseller_store_name?: string;
  reseller_email?: string;
  amount_ghs: number;
  status: 'pending' | 'approved' | 'declined';
  decline_reason?: string;
  processed_at?: string;
  created_at: string;
}

export interface DataDeliveryLog {
  id: number;
  order_id: number;
  order_ref?: string;
  customer_phone?: string;
  bundle_name?: string;
  api_provider: string;
  request_payload: string;
  response: string;
  status: 'success' | 'failed';
  retry_count: number;
  created_at: string;
}

export interface AdminSettings {
  registration_fee_ghs: number;
  registration_fee_enabled: boolean;
  max_markup_percent: number;
  admin_fee_percent: number;
  admin_fee_source: 'earnings_deduction' | 'order_margin'; // how admin fee flows
  test_mode_enabled: boolean;
  withdrawal_fee_percent?: number;
  payment_gateway?: 'flutterwave' | 'paystack';
  paystack_public_key?: string;
  paystack_secret_key?: string;
  flutterwave_public_key?: string;
  flutterwave_secret_key?: string;
  data_api_username?: string;
  data_api_key?: string;
  data_api_url?: string;
  whatsapp_community_link?: string;
  whatsapp_channel_link?: string;
  site_name?: string;
  site_color?: string;
  global_font_style?: string;
  global_font_size?: string;
  global_text_color_primary?: string;
  global_text_color_body?: string;
  global_text_color_muted?: string;
  global_text_color_accent?: string;
  admin_total_withdrawn_ghs?: number;
  admin_withdrawal_logs?: string;
  site_bg_color?: string;
  site_bg_image?: string;
  online_support_enabled?: boolean;
  online_support_restrictions?: string;
  reviews_popup_enabled?: boolean;
  reviews_display_duration?: number;
  reviews_interval?: number;
  vtu_balance_threshold?: number;
  tax?: {
    enabled: boolean;
    percent: number;
    flatGhs: number;
  };
}
