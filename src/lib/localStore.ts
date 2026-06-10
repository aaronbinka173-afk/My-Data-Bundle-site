import { Bundle, AdminSettings, Order, WithdrawalRequest, ResellerAccount, User } from '../types';

// Default initial data to populate if localStorage is empty
const DEFAULT_SETTINGS: AdminSettings = {
  registration_fee_ghs: 50.00,
  registration_fee_enabled: false,
  max_markup_percent: 50.00,
  admin_fee_percent: 5.00,
  admin_fee_source: 'order_margin',
  test_mode_enabled: true,
  withdrawal_fee_percent: 2.00,
  payment_gateway: 'paystack',
  whatsapp_community_link: 'https://chat.whatsapp.com/mock-community',
  whatsapp_channel_link: 'https://whatsapp.com/channel/mock-channel',
  site_name: 'Mac Data Hub',
  site_color: 'amber',
  global_font_style: 'Outfit',
  global_font_size: '16px',
  global_text_color_primary: '#f1f5f9',
  global_text_color_body: '#cbd5e1',
  global_text_color_muted: '#94a3b8',
  global_text_color_accent: '#fbbf24',
  site_bg_color: '#020617',
  site_bg_image: '',
  online_support_enabled: true,
  online_support_restrictions: 'None',
  reviews_popup_enabled: true,
  reviews_display_duration: 5,
  reviews_interval: 15,
  vtu_balance_threshold: 100
};

const DEFAULT_BUNDLES: Bundle[] = [
  {
    id: 1,
    name: 'MTN 1.5GB Data',
    network: 'MTN',
    data_amount: '1.5GB',
    validity_days: 30,
    admin_base_price_ghs: 10.00,
    provider_plan_code: 'mtn-1.5gb',
    status: 'active',
    created_at: new Date().toISOString()
  },
  {
    id: 2,
    name: 'MTN 5GB Mega',
    network: 'MTN',
    data_amount: '5GB',
    validity_days: 30,
    admin_base_price_ghs: 30.00,
    provider_plan_code: 'mtn-5gb',
    status: 'active',
    created_at: new Date().toISOString()
  },
  {
    id: 3,
    name: 'Telecel 2GB Flat',
    network: 'Vodafone',
    data_amount: '2GB',
    validity_days: 30,
    admin_base_price_ghs: 12.00,
    provider_plan_code: 'voda-2gb',
    status: 'active',
    created_at: new Date().toISOString()
  },
  {
    id: 4,
    name: 'AirtelTigo 3GB Super',
    network: 'AirtelTigo',
    data_amount: '3GB',
    validity_days: 30,
    admin_base_price_ghs: 11.00,
    provider_plan_code: 'tigo-3gb',
    status: 'active',
    created_at: new Date().toISOString()
  }
];

const DEFAULT_REVIEWS = [
  {
    id: 1,
    reseller_id: 2,
    author_name: 'Prince Boateng',
    rating: 5,
    comment: 'Instantly credited! High speed connection is beautiful.',
    created_at: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: 2,
    reseller_id: 2,
    author_name: 'Ama Serwaa',
    rating: 5,
    comment: 'Reliable service and cheapest price in Accra! Highly recommend.',
    created_at: new Date(Date.now() - 7200000).toISOString()
  }
];

const DEFAULT_ORDERS: Order[] = [
  {
    id: 1,
    order_ref: 'ORD-1001-A',
    customer_id: 1,
    customer_email: 'customer1@gmail.com',
    reseller_id: 7, // matches the seed reseller test@test.com
    reseller_store_name: 'Test Store',
    bundle_id: 1,
    bundle_name: 'MTN 1.5GB Data',
    bundle_network: 'MTN',
    bundle_data_amount: '1.5GB',
    customer_phone: '0249876543',
    admin_base_price_ghs: 10.00,
    reseller_markup_ghs: 2.00,
    final_price_ghs: 12.00,
    admin_fee_ghs: 0.50,
    net_to_reseller_ghs: 1.50,
    delivery_status: 'delivered',
    payment_status: 'paid',
    created_at: new Date(Date.now() - 86400000).toISOString()
  },
  {
    id: 2,
    order_ref: 'ORD-1002-B',
    customer_id: 2,
    customer_email: 'customer2@gmail.com',
    reseller_id: 7,
    reseller_store_name: 'Test Store',
    bundle_id: 2,
    bundle_name: 'MTN 5GB Mega',
    bundle_network: 'MTN',
    bundle_data_amount: '5GB',
    customer_phone: '0501112223',
    admin_base_price_ghs: 30.00,
    reseller_markup_ghs: 5.00,
    final_price_ghs: 35.00,
    admin_fee_ghs: 1.50,
    net_to_reseller_ghs: 3.50,
    delivery_status: 'delivered',
    payment_status: 'paid',
    created_at: new Date(Date.now() - 43200000).toISOString()
  }
];

const DEFAULT_WITHDRAWALS: WithdrawalRequest[] = [
  {
    id: 1,
    reseller_id: 7,
    reseller_store_name: 'Test Store',
    reseller_email: 'test@test.com',
    amount_ghs: 15.00,
    status: 'approved',
    processed_at: new Date(Date.now() - 36000000).toISOString(),
    created_at: new Date(Date.now() - 40000000).toISOString()
  }
];

const DEFAULT_NOTIFICATIONS = [
  {
    id: 1,
    user_id: 7,
    title: 'Store Activated',
    message: 'Welcome! Your reseller storefront has been initialized with 100 GHS demo balance.',
    type: 'system',
    read: false,
    created_at: new Date().toISOString()
  }
];

// LocalStorage Helper Get/Set
const getJson = (key: string, def: any) => {
  const val = localStorage.getItem(key);
  if (!val) {
    localStorage.setItem(key, JSON.stringify(def));
    return def;
  }
  try {
    return JSON.parse(val);
  } catch {
    return def;
  }
};

const setJson = (key: string, data: any) => {
  localStorage.setItem(key, JSON.stringify(data));
};

// State initializers
export const initLocalStore = () => {
  getJson('machub_settings', DEFAULT_SETTINGS);
  getJson('machub_bundles', DEFAULT_BUNDLES);
  getJson('machub_reviews', DEFAULT_REVIEWS);
  getJson('machub_orders', DEFAULT_ORDERS);
  getJson('machub_withdrawals', DEFAULT_WITHDRAWALS);
  getJson('machub_notifications', DEFAULT_NOTIFICATIONS);
};

// Settings
export const getLocalSettings = (): AdminSettings => getJson('machub_settings', DEFAULT_SETTINGS);
export const saveLocalSettings = (s: Partial<AdminSettings>): AdminSettings => {
  const current = getLocalSettings();
  const next = { ...current, ...s };
  setJson('machub_settings', next);
  return next;
};

// Bundles
export const getLocalBundles = (): Bundle[] => getJson('machub_bundles', DEFAULT_BUNDLES);
export const saveLocalBundles = (b: Bundle[]): void => setJson('machub_bundles', b);
export const saveLocalBundle = (b: Partial<Bundle>): Bundle => {
  const current = getLocalBundles();
  let result: Bundle;
  if (b.id) {
    const list = current.map(item => {
      if (item.id === b.id) {
        result = { ...item, ...b } as Bundle;
        return result;
      }
      return item;
    });
    setJson('machub_bundles', list);
  } else {
    result = {
      ...b,
      id: Math.max(...current.map(x => x.id), 0) + 1,
      created_at: new Date().toISOString()
    } as Bundle;
    setJson('machub_bundles', [...current, result]);
  }
  return result!;
};
export const deleteLocalBundle = (id: number): void => {
  const current = getLocalBundles();
  setJson('machub_bundles', current.filter(x => x.id !== id));
};

// Reviews
export const getLocalReviews = (resellerId?: number) => {
  const r = getJson('machub_reviews', DEFAULT_REVIEWS);
  if (resellerId) {
    return r.filter((x: any) => x.reseller_id === resellerId);
  }
  return r;
};
export const addLocalReview = (resellerId: number, authorName: string, rating: number, comment: string) => {
  const reviews = getLocalReviews();
  const rawId = Math.max(...reviews.map((x: any) => x.id), 0) + 1;
  const newReview = {
    id: rawId,
    reseller_id: resellerId,
    author_name: authorName,
    rating,
    comment,
    created_at: new Date().toISOString()
  };
  setJson('machub_reviews', [newReview, ...reviews]);
  return newReview;
};

// Orders
export const getLocalOrders = (): Order[] => getJson('machub_orders', DEFAULT_ORDERS);
export const createLocalOrder = (o: Partial<Order>): Order => {
  const list = getLocalOrders();
  const idValue = Math.max(...list.map(x => x.id), 0) + 1;
  const item: Order = {
    id: idValue,
    order_ref: o.order_ref || `ORD-${idValue}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
    customer_id: o.customer_id || Math.floor(Math.random() * 10000),
    customer_email: o.customer_email || 'guest@example.com',
    reseller_id: o.reseller_id || null,
    reseller_store_name: o.reseller_store_name || '',
    bundle_id: o.bundle_id || 1,
    bundle_name: o.bundle_name || 'MTN Bundle',
    bundle_network: o.bundle_network || 'MTN',
    bundle_data_amount: o.bundle_data_amount || '1GB',
    customer_phone: o.customer_phone || '',
    admin_base_price_ghs: o.admin_base_price_ghs || 10,
    reseller_markup_ghs: o.reseller_markup_ghs || 0,
    final_price_ghs: o.final_price_ghs || 10,
    admin_fee_ghs: o.admin_fee_ghs || 0,
    net_to_reseller_ghs: o.net_to_reseller_ghs || 0,
    delivery_status: o.delivery_status || 'pending',
    payment_status: o.payment_status || 'pending',
    created_at: new Date().toISOString()
  };
  const updatedList = [item, ...list];
  setJson('machub_orders', updatedList);
  return item;
};

// Withdrawals
export const getLocalWithdrawals = (): WithdrawalRequest[] => getJson('machub_withdrawals', DEFAULT_WITHDRAWALS);
export const createLocalWithdrawal = (w: Partial<WithdrawalRequest>): WithdrawalRequest => {
  const list = getLocalWithdrawals();
  const idValue = Math.max(...list.map(x => x.id), 0) + 1;
  const item: WithdrawalRequest = {
    id: idValue,
    reseller_id: w.reseller_id || 0,
    reseller_store_name: w.reseller_store_name || '',
    reseller_email: w.reseller_email || '',
    amount_ghs: w.amount_ghs || 0,
    status: 'pending',
    created_at: new Date().toISOString()
  };
  setJson('machub_withdrawals', [item, ...list]);
  return item;
};
export const updateLocalWithdrawalStatus = (id: number, status: 'approved' | 'declined', declineReason?: string): void => {
  const list = getLocalWithdrawals();
  const next = list.map(item => {
    if (item.id === id) {
      return {
        ...item,
        status,
        decline_reason: declineReason,
        processed_at: new Date().toISOString()
      };
    }
    return item;
  });
  setJson('machub_withdrawals', next);
};

// Notifications
export const getLocalNotifications = (userId: number | null): any[] => {
  const all = getJson('machub_notifications', DEFAULT_NOTIFICATIONS);
  return all.filter((x: any) => x.user_id === userId);
};
export const readAllLocalNotifications = (userId: number | null): void => {
  const all = getJson('machub_notifications', DEFAULT_NOTIFICATIONS);
  const next = all.map((x: any) => {
    if (x.user_id === userId) {
      return { ...x, read: true };
    }
    return x;
  });
  setJson('machub_notifications', next);
};
export const createLocalNotification = (userId: number | null, title: string, message: string, type = 'system'): any => {
  const all = getJson('machub_notifications', DEFAULT_NOTIFICATIONS);
  const rawId = Math.max(...all.map((x: any) => x.id), 0) + 1;
  const item = {
    id: rawId,
    user_id: userId,
    title,
    message,
    type,
    read: false,
    created_at: new Date().toISOString()
  };
  setJson('machub_notifications', [item, ...all]);
  return item;
};

// Reseller Markups / Account info
export const getResellerMarkupSettings = (resellerId: number): any[] => {
  return getJson(`markup_settings_${resellerId}`, []);
};
export const saveResellerMarkupSettings = (resellerId: number, pricing: any[]): void => {
  setJson(`markup_settings_${resellerId}`, pricing);
};

// Reseller profile balance state
export const getResellerAccountStats = (resellerId: number): ResellerAccount => {
  const defaultAct: ResellerAccount = {
    user_id: resellerId,
    store_name: 'Reseller Store',
    store_slug: `store-${resellerId}`,
    email: 'reseller@machub.com',
    status: 'active',
    balance_ghs: 100.00,
    total_earned_ghs: 15.00,
    total_customers: 2,
    deduction_source: 'storefront_earnings'
  };
  return getJson(`reseller_stats_${resellerId}`, defaultAct);
};
export const saveResellerAccountStats = (resellerId: number, partial: Partial<ResellerAccount>): ResellerAccount => {
  const current = getResellerAccountStats(resellerId);
  const next = { ...current, ...partial };
  setJson(`reseller_stats_${resellerId}`, next);
  return next;
};
