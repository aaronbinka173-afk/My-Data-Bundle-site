import { getLocalSettings, saveLocalSettings, getLocalBundles, saveLocalBundle, deleteLocalBundle, saveLocalBundles, getLocalOrders, createLocalOrder, getLocalWithdrawals, createLocalWithdrawal, updateLocalWithdrawalStatus, getLocalNotifications, readAllLocalNotifications, createLocalNotification, getLocalReviews, saveResellerMarkupSettings, getResellerMarkupSettings, getResellerAccountStats, saveResellerAccountStats } from './localStore';
import { Bundle } from '../types';
import { db as firestoreDb } from './firebase';
import { collection, getDocs, query, where, updateDoc, doc } from 'firebase/firestore';

const originalFetch = window.fetch;

// Helper to construct a Response object
const createJsonResponse = (data: any, status = 200) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
};

window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const urlStr = typeof input === 'string' ? input : (input as any).url || input.toString();
  
  // If the path does not start with /api/, route using the default global fetch
  if (!urlStr.includes('/api/')) {
    return originalFetch(input, init);
  }

  // Parse path and query
  const urlObj = new URL(urlStr, window.location.origin);
  const path = urlObj.pathname;
  const method = (init?.method || 'GET').toUpperCase();
  const bodyData = init?.body ? JSON.parse(init.body as string) : {};

  console.log(`[Mock Fetch Interceptor] ${method} ${path}`, bodyData);

  try {
    // -----------------------------------------------------------------
    // NOTIFICATIONS
    // -----------------------------------------------------------------
    if (path.startsWith('/api/notifications')) {
      const storedUserRaw = localStorage.getItem('mac_hub_user');
      const currentUser = storedUserRaw ? JSON.parse(storedUserRaw) : null;
      const uId = currentUser ? currentUser.id : null;

      if (path === '/api/notifications' && method === 'GET') {
        const list = getLocalNotifications(uId);
        return createJsonResponse(list);
      }
      if (path.endsWith('/read') && method === 'POST') {
        readAllLocalNotifications(uId);
        return createJsonResponse({ success: true });
      }
      if (path === '/api/notifications/clear' && method === 'POST') {
        localStorage.setItem('machub_notifications', JSON.stringify([]));
        return createJsonResponse({ success: true });
      }
    }

    // -----------------------------------------------------------------
    // ADMIN SIGNED ENDPOINTS
    // -----------------------------------------------------------------
    if (path.startsWith('/api/admin/')) {
      // Admin Dashboard Analytic metrics
      if (path === '/api/admin/dashboard' && method === 'GET') {
        const orders = getLocalOrders();
        const settings = getLocalSettings();
        const withdrawals = getLocalWithdrawals();
        
        const totalProfitBytes = orders.reduce((sum, o) => sum + Number(o.reseller_markup_ghs || 0), 0);
        const revenueBytes = orders.reduce((sum, o) => sum + Number(o.final_price_ghs || 0), 0);

        return createJsonResponse({
          vtu_balance_ghs: 1450.50,
          system_total_markup_ghs: totalProfitBytes,
          sub_and_gain_balance_digits: "₵785.40",
          stats_today: {
            revenue_ghs: Number((revenueBytes * 0.1).toFixed(2)),
            profit_ghs: Number((totalProfitBytes * 0.1).toFixed(2)),
            orders_count: Math.ceil(orders.length * 0.1),
            resellers_count: 2
          },
          stats_month: {
            revenue_ghs: Number((revenueBytes * 0.8).toFixed(2)),
            profit_ghs: Number((totalProfitBytes * 0.8).toFixed(2)),
            orders_count: Math.ceil(orders.length * 0.8),
            resellers_count: 5
          },
          stats_alltime: {
            revenue_ghs: revenueBytes,
            profit_ghs: totalProfitBytes,
            orders_count: orders.length,
            resellers_count: 7
          }
        });
      }

      // Settings Rows
      if (path === '/api/admin/settings' && method === 'GET') {
        return createJsonResponse(getLocalSettings());
      }

      // Admin actions with registration-fee
      if (path === '/api/admin/settings/registration-fee' && method === 'POST') {
        const updated = saveLocalSettings({
          registration_fee_ghs: Number(bodyData.feeGhs || 50),
          registration_fee_enabled: bodyData.enabled !== false
        });
        return createJsonResponse({ settings: updated });
      }

      if (path === '/api/admin/settings/max-markup' && method === 'POST') {
        const updated = saveLocalSettings({
          max_markup_percent: Number(bodyData.percent || 50)
        });
        return createJsonResponse({ settings: updated });
      }

      if (path === '/api/admin/settings/admin-fee' && method === 'POST') {
        const updated = saveLocalSettings({
          admin_fee_percent: Number(bodyData.percent || 5),
          admin_fee_source: bodyData.source || 'order_margin'
        });
        return createJsonResponse({ settings: updated });
      }

      if (path === '/api/admin/settings/withdrawal-fee' && method === 'POST') {
        const updated = saveLocalSettings({
          withdrawal_fee_percent: Number(bodyData.percent || 2)
        });
        return createJsonResponse({ settings: updated });
      }

      if (path === '/api/admin/settings/gateway' && method === 'POST') {
        const updated = saveLocalSettings({
          payment_gateway: bodyData.gateway || 'paystack'
        });
        return createJsonResponse({ settings: updated });
      }

      if (path === '/api/admin/settings/test-mode' && method === 'POST') {
        const updated = saveLocalSettings({
          test_mode_enabled: bodyData.enabled !== false
        });
        return createJsonResponse({ settings: updated });
      }

      if (path === '/api/admin/settings/whatsapp-community' && method === 'POST') {
        const updated = saveLocalSettings({
          whatsapp_community_link: bodyData.link || ''
        });
        return createJsonResponse({ settings: updated });
      }

      if (path === '/api/admin/settings/whatsapp-channel' && method === 'POST') {
        const updated = saveLocalSettings({
          whatsapp_channel_link: bodyData.link || ''
        });
        return createJsonResponse({ settings: updated });
      }

      if (path === '/api/admin/settings/branding' && method === 'POST') {
        const updated = saveLocalSettings({
          site_name: bodyData.siteName || 'Mac Data Hub',
          site_color: bodyData.themeColor || 'amber'
        });
        return createJsonResponse({ settings: updated });
      }

      if (path === '/api/admin/settings/typography' && method === 'POST') {
        const updated = saveLocalSettings({
          global_font_style: bodyData.fontFamily || 'Inter',
          global_font_size: bodyData.fontSize || '16px'
        });
        return createJsonResponse({ settings: updated });
      }

      if (path === '/api/admin/settings/customer-tax' && method === 'POST') {
        const updated = saveLocalSettings({
          tax: {
            enabled: bodyData.enabled !== false,
            percent: Number(bodyData.percent || 0),
            flatGhs: Number(bodyData.flatValue || 0)
          }
        });
        return createJsonResponse({ settings: updated });
      }

      if (path === '/api/admin/settings/support' && method === 'POST') {
        const updated = saveLocalSettings({
          online_support_enabled: bodyData.enabled !== false,
          online_support_restrictions: bodyData.restrictions || 'None'
        });
        return createJsonResponse({ settings: updated });
      }

      if (path === '/api/admin/settings/reviews-popup' && method === 'POST') {
        const updated = saveLocalSettings({
          reviews_popup_enabled: bodyData.enabled !== false,
          reviews_display_duration: Number(bodyData.duration || 5),
          reviews_interval: Number(bodyData.interval || 15)
        });
        return createJsonResponse({ settings: updated });
      }

      // Preload / Database resets
      if (path === '/api/admin/settings/preload-sandbox' && method === 'POST') {
        return createJsonResponse({ success: true, message: 'Sandbox logs populated.' });
      }

      if (path === '/api/admin/settings/reset-database' && method === 'POST') {
        localStorage.clear();
        return createJsonResponse({ success: true });
      }

      // Admin Bundles Catalog
      if (path === '/api/admin/bundles' && method === 'GET') {
        return createJsonResponse(getLocalBundles());
      }

      if (path === '/api/admin/bundles/reset' && method === 'POST') {
        const defaultList: Bundle[] = [
          { id: 1, name: 'MTN 1.5GB Data', network: 'MTN', data_amount: '1.5GB', validity_days: 30, admin_base_price_ghs: 10.00, provider_plan_code: 'mtn-1.5gb', status: 'active', created_at: new Date().toISOString() },
          { id: 2, name: 'MTN 5GB Mega', network: 'MTN', data_amount: '5GB', validity_days: 30, admin_base_price_ghs: 30.00, provider_plan_code: 'mtn-5gb', status: 'active', created_at: new Date().toISOString() },
          { id: 3, name: 'Telecel 2GB Flat', network: 'Vodafone', data_amount: '2GB', validity_days: 30, admin_base_price_ghs: 12.00, provider_plan_code: 'voda-2gb', status: 'active', created_at: new Date().toISOString() },
          { id: 4, name: 'AirtelTigo 3GB Super', network: 'AirtelTigo', data_amount: '3GB', validity_days: 30, admin_base_price_ghs: 11.00, provider_plan_code: 'tigo-3gb', status: 'active', created_at: new Date().toISOString() }
        ];
        saveLocalBundles(defaultList);
        return createJsonResponse(defaultList);
      }

      if (path === '/api/admin/bundles' && method === 'POST') {
        const added = saveLocalBundle(bodyData);
        return createJsonResponse({ bundle: added });
      }

      if (path.startsWith('/api/admin/bundles/') && method === 'POST') {
        const rawParts = path.split('/');
        const id = Number(rawParts[rawParts.length - 1]);
        const updated = saveLocalBundle({ ...bodyData, id });
        return createJsonResponse({ bundle: updated });
      }

      if (path.startsWith('/api/admin/bundles/') && method === 'DELETE') {
        const rawParts = path.split('/');
        const id = Number(rawParts[rawParts.length - 1]);
        deleteLocalBundle(id);
        return createJsonResponse({ success: true });
      }

      // Admin Resellers Lists directly from Firestore!
      if (path === '/api/admin/resellers' && method === 'GET') {
        const colRef = collection(firestoreDb, 'users');
        const snap = await getDocs(colRef);
        const list: any[] = [];
        snap.forEach(doc => {
          const ud = doc.data();
          if (ud.role === 'reseller' || ud.role === 'pending_reseller') {
            list.push({ id: ud.id || 7, ...ud });
          }
        });
        // fallback sample if Firestore fails or empty
        if (list.length === 0) {
          list.push({
            id: 7,
            email: 'test@test.com',
            role: 'reseller',
            status: 'active',
            store_name: 'Test Store',
            store_slug: 'test-store',
            phone: '0241234567',
            registration_fee_paid_ghs: 50
          });
        }
        return createJsonResponse(list);
      }

      // Reseller interactive states: Status Approval direct in Firestore!
      if (path.includes('/resellers/') && method === 'POST') {
        const parts = path.split('/');
        const rIdStr = parts[parts.indexOf('resellers') + 1];
        const action = parts[parts.length - 1]; // approve, status actions, toggle-admin
        
        const qUsers = query(collection(firestoreDb, 'users'));
        const snap = await getDocs(qUsers);
        let targetDocId: string | null = null;
        let userData: any = null;

        snap.forEach(d => {
          const val = d.data();
          if (String(val.id) === rIdStr || val.email === rIdStr) {
            targetDocId = d.id;
            userData = val;
          }
        });

        if (targetDocId) {
          const docRef = doc(firestoreDb, 'users', targetDocId);
          let nextStatus = 'active';
          if (action === 'suspend') nextStatus = 'suspended';
          if (action === 'approve') nextStatus = 'active';
          
          await updateDoc(docRef, { status: nextStatus, role: 'reseller' });
          return createJsonResponse({ success: true });
        }

        return createJsonResponse({ success: true });
      }

      // Withdrawals Approval
      if (path.startsWith('/api/admin/withdrawals/') && method === 'POST') {
        const parts = path.split('/');
        const wId = Number(parts[parts.indexOf('withdrawals') + 1]);
        const action = parts[parts.length - 1]; // approve, decline

        if (action === 'approve') {
          updateLocalWithdrawalStatus(wId, 'approved');
        } else if (action === 'decline') {
          updateLocalWithdrawalStatus(wId, 'declined', bodyData.reason || 'Verification failed');
        }
        return createJsonResponse({ success: true });
      }

      if (path === '/api/admin/withdrawals' && method === 'GET') {
        return createJsonResponse(getLocalWithdrawals());
      }

      // Orders and Logs
      if (path === '/api/admin/orders' && method === 'GET') {
        return createJsonResponse(getLocalOrders());
      }

      if (path === '/api/admin/delivery-logs' && method === 'GET') {
        return createJsonResponse([
          { id: 1, order_ref: 'ORD-1001-A', provider_ref: 'SUBGAIN-98711', raw_response: '{"status":"success"}', created_at: new Date().toISOString() }
        ]);
      }

      if (path === '/api/admin/sms-logs' && method === 'GET') {
        return createJsonResponse([]);
      }

      if (path === '/api/admin/email-logs' && method === 'GET') {
        return createJsonResponse([]);
      }

      if (path === '/api/admin/db-export' && method === 'GET') {
        return createJsonResponse({ backup: 'local_storage_active' });
      }

      if (path === '/api/admin/send-sms' && method === 'POST') {
        return createJsonResponse({ success: true });
      }

      if (path === '/api/admin/send-email' && method === 'POST') {
        return createJsonResponse({ success: true });
      }
    }

    // -----------------------------------------------------------------
    // RESELLER SIGNED ENDPOINTS
    // -----------------------------------------------------------------
    if (path.startsWith('/api/reseller/')) {
      const storedUserRaw = localStorage.getItem('mac_hub_user');
      const currentUser = storedUserRaw ? JSON.parse(storedUserRaw) : null;
      const rId = currentUser ? currentUser.id || 7 : 7;

      if (path === '/api/reseller/dashboard' && method === 'GET') {
        const stats = getResellerAccountStats(rId);
        const orders = getLocalOrders().filter(o => o.reseller_id === rId);
        const profit = orders.reduce((sum, o) => sum + Number(o.net_to_reseller_ghs || 0), 0);

        return createJsonResponse({
          balance_ghs: stats.balance_ghs,
          total_earned_ghs: profit,
          total_customers: new Set(orders.map(o => o.customer_phone)).size,
          storefront_views: 45
        });
      }

      if (path === '/api/reseller/bundles' && method === 'GET') {
        const markups = getResellerMarkupSettings(rId);
        const general = getLocalBundles();
        
        const mapped = general.map(b => {
          const setting = markups.find((m: any) => m.bundle_id === b.id);
          return {
            ...b,
            markup_type: setting?.markup_type || 'fixed',
            markup_value: setting?.markup_value || 2.00,
            final_price_ghs: b.admin_base_price_ghs + (setting?.markup_value || 2.00)
          };
        });
        return createJsonResponse(mapped);
      }

      if (path === '/api/reseller/pricing' && method === 'POST') {
        saveResellerMarkupSettings(rId, bodyData.pricing);
        return createJsonResponse({ success: true });
      }

      if (path === '/api/reseller/orders' && method === 'GET') {
        const owned = getLocalOrders().filter(o => o.reseller_id === rId);
        return createJsonResponse(owned);
      }

      if (path === '/api/reseller/withdrawals' && method === 'GET') {
        const owned = getLocalWithdrawals().filter(w => w.reseller_id === rId);
        return createJsonResponse(owned);
      }

      if (path === '/api/reseller/withdraw' && method === 'POST') {
        const stats = getResellerAccountStats(rId);
        const withdrawAmt = Number(bodyData.amountGhs || 0);

        if (withdrawAmt > stats.balance_ghs) {
          return createJsonResponse({ error: 'Insufficient balance available for requesting payout.' }, 400);
        }

        const added = createLocalWithdrawal({
          reseller_id: rId,
          reseller_store_name: stats.store_name || 'Reseller Store',
          reseller_email: currentUser?.email || 'reseller@machub.com',
          amount_ghs: withdrawAmt
        });

        // Deduct from mock stats balance
        saveResellerAccountStats(rId, { balance_ghs: Number((stats.balance_ghs - withdrawAmt).toFixed(2)) });
        return createJsonResponse({ withdrawal: added });
      }

      if (path === '/api/reseller/reviews' && method === 'GET') {
        return createJsonResponse(getLocalReviews(rId));
      }
    }

    // -----------------------------------------------------------------
    // GENERAL UTILITIES & MOCK FALLBACKS
    // -----------------------------------------------------------------
    if (path === '/api/registration-fee' && method === 'GET') {
      const settings = getLocalSettings();
      return createJsonResponse({ fee_ghs: settings.registration_fee_ghs || 50.00 });
    }

    if (path === '/api/bundles' && method === 'GET') {
      return createJsonResponse(getLocalBundles());
    }

    // Default Fallback
    return createJsonResponse({ success: true, message: 'Default client simulation bypass' });

  } catch (err: any) {
    console.error('[Mock Fetch Handler Error]', err);
    return createJsonResponse({ error: 'Local offline simulation issue.' }, 500);
  }
};
