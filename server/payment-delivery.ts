import { db } from './db';

const DATA_API_USERNAME = process.env.DATA_API_USERNAME || 'mock_username';
const DATA_API_KEY = process.env.DATA_API_KEY || 'mock_api_key';
const DATA_API_URL = process.env.DATA_API_URL || 'https://subandgain.com/api/data.php';

/**
 * Triggers automated data bundle delivery using SubAndGain API
 */
export async function deliverDataBundle(orderId: number): Promise<{ success: boolean; responseStr: string }> {
  try {
    const order = await db.getOrderById(orderId);
    if (!order) {
      return { success: false, responseStr: 'Order not found' };
    }

    const bundle = await db.getBundleById(order.bundle_id);
    if (!bundle) {
      return { success: false, responseStr: 'Bundle not found' };
    }

    // Check if we are running in mocked/sandbox settings or real API mode
    const settings = await db.getSettings();
    const apiUsername = settings.data_api_username || DATA_API_USERNAME;
    const apiKey = settings.data_api_key || DATA_API_KEY;
    const apiUrl = settings.data_api_url || DATA_API_URL;

    const payload = {
      username: apiUsername,
      apiKey: apiKey,
      network: mapNetworkName(bundle.network),
      dataPlan: bundle.provider_plan_code,
      phoneNumber: order.customer_phone
    };

    console.log(`Starting data bundle delivery for Order ${order.order_ref} to ${order.customer_phone}`);

    if (settings.test_mode_enabled || apiKey === 'mock_api_key' || !apiKey) {
      // SUCCESS SIMULATION
      const mockSuccessResponse = {
        status: 'Approved',
        trans_id: `SG-MOCK-${Math.floor(Math.random() * 900000 + 100000)}`,
        api_response: `Mocked success. Delivered ${bundle.data_amount} to ${order.customer_phone} via SubAndGain.`
      };

      const respStr = JSON.stringify(mockSuccessResponse);
      await db.createDeliveryLog({
        order_id: orderId,
        api_provider: 'subandgain-mock',
        request_payload: JSON.stringify(payload),
        response: respStr,
        status: 'success'
      });

      await db.updateOrderDeliveryStatus(orderId, 'delivered');
      return { success: true, responseStr: respStr };
    }

    // REAL CALL to SubAndGain:
    const params = new URLSearchParams();
    params.append('username', payload.username);
    params.append('apiKey', payload.apiKey);
    params.append('network', payload.network);
    params.append('dataPlan', payload.dataPlan);
    params.append('phoneNumber', payload.phoneNumber);

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 15000); // 15s timeout

    const fetchUrl = `${apiUrl}?${params.toString()}`;
    const response = await fetch(fetchUrl, {
      method: 'GET',
      signal: controller.signal
    });
    clearTimeout(id);

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    const responseText = await response.text();
    let apiResp: any = {};
    try {
      apiResp = JSON.parse(responseText);
    } catch {
      apiResp = { response_text: responseText };
    }

    // SubAndGain has "status": "Approved" on success
    const isSuccess = apiResp.status === 'Approved' || apiResp.status === 'success';
    const statusStr = isSuccess ? 'success' : 'failed';

    await db.createDeliveryLog({
      order_id: orderId,
      api_provider: 'subandgain',
      request_payload: JSON.stringify(payload),
      response: responseText,
      status: statusStr
    });

    if (isSuccess) {
      await db.updateOrderDeliveryStatus(orderId, 'delivered');
      return { success: true, responseStr: responseText };
    } else {
      await db.updateOrderDeliveryStatus(orderId, 'failed');
      return { success: false, responseStr: responseText };
    }
  } catch (err: any) {
    console.error(`Error delivering data bundle for Order #${orderId}:`, err);
    
    // Log failures
    await db.createDeliveryLog({
      order_id: orderId,
      api_provider: 'subandgain',
      request_payload: JSON.stringify({ orderId }),
      response: JSON.stringify({ error: err.message || 'Unknown network error' }),
      status: 'failed'
    });

    await db.updateOrderDeliveryStatus(orderId, 'failed');
    return { success: false, responseStr: err.message || 'Unknown error' };
  }
}

/**
 * Normalizes network values to matching SubAndGain representations
 */
function mapNetworkName(net: string): string {
  const norm = net.toUpperCase();
  if (norm.includes('MTN')) return 'MTN';
  if (norm.includes('VODA') || norm.includes('TELE')) return 'VODAFONE';
  if (norm.includes('TIGO') || norm.includes('AIRTEL')) return 'TIGO';
  if (norm.includes('GLO')) return 'GLO';
  return net;
}

/**
 * Webhook and Flutterwave/Paystack Order Settler
 */
export async function finalizePaidOrder(orderRef: string, transactionId: string, payload: any): Promise<boolean> {
  const order = await db.getOrderByRef(orderRef);
  if (!order) {
    console.error(`Cannot settle payment. Order ${orderRef} was not found.`);
    return false;
  }

  // If order is already paid, skip double allocation
  if (order.payment_status === 'paid') {
    return true;
  }

  console.log(`Setting Order #${order.id} [${orderRef}] to PAID via Reference: ${transactionId}`);

  // Update order status
  await db.updateOrderStatus(order.id, 'paid', 'pending');

  // Record payment in database
  await db.createPaymentLog({
    order_id: order.id,
    transaction_ref: transactionId,
    provider: orderRef.includes('FLW') ? 'flutterwave' : 'paystack',
    amount_ghs: order.final_price_ghs,
    customer_email: order.customer_email || 'guest@example.com',
    customer_phone: order.customer_phone,
    status: 'success',
    webhook_payload: JSON.stringify(payload)
  });

  // Credit Reseller storefront account if order placed via a reseller storefront
  if (order.reseller_id) {
    const profit = Number(order.net_to_reseller_ghs);
    if (profit > 0) {
      console.log(`Crediting Reseller User ID ${order.reseller_id} with ${profit} GHS margins`);
      await db.incrementResellerAccount(order.reseller_id, profit, true);
    }
  }

  // Trigger Async automated delivery
  // We invoke the promise but don't strictly await it to bypass slow timeouts during webhooks response lifecycle
  deliverDataBundle(order.id).catch(err => {
    console.error(`Failed async data delivery trigger during settlement:`, err);
  });

  return true;
}
