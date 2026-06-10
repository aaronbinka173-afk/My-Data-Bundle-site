import fs from 'fs';
import path from 'path';
import { initializeApp } from 'firebase/app';
import { 
  initializeFirestore, doc, getDoc, getDocs, setDoc, updateDoc, 
  collection, query, where, deleteDoc 
} from 'firebase/firestore';
import bcrypt from 'bcryptjs';
import firebaseConfigDoc from '../firebase-applet-config.json';

let firebaseApp: any = null;
export let firestoreDb: any = null;
export let isFirestore = false;

let firebaseConfig: any = null;

function parseFirebaseConfig(val: string): any {
  if (!val) return null;
  const trimmed = val.trim();
  
  // 1. Try standard JSON
  try {
    return JSON.parse(trimmed);
  } catch (e) {
    // Fallback
  }

  // 2. Try extract via Regex if it's a JS/TS constant block or similar
  try {
    const config: any = {};
    const keys = [
      'apiKey', 'authDomain', 'projectId', 'storageBucket', 
      'messagingSenderId', 'appId', 'measurementId', 'firestoreDatabaseId'
    ];
    let matched = false;
    for (const key of keys) {
      // Matches both "key": "value" and key: "value", handling single/double quotes or backticks
      const regex = new RegExp(`['"]?${key}['"]?\\s*:\\s*['"\`]([^'"\`]+)['"\`]`);
      const match = trimmed.match(regex);
      if (match && match[1]) {
        config[key] = match[1];
        matched = true;
      }
    }
    // If we matched at least projectId and apiKey, we are good
    if (matched && config.projectId && config.apiKey) {
      return config;
    }
  } catch (err) {
    console.warn('Regex fallback extraction failed:', err);
  }

  // 3. Try step-by-step eval function block with clean scopes to avoid redeclaration issues
  try {
    const cleanEval = new Function(`
      return (function() {
        try {
          ${trimmed}
          if (typeof firebaseConfig !== "undefined") return firebaseConfig;
        } catch(e){}
        try {
          ${trimmed.replace(/^(const|let|var)\s+/gm, '')}
          if (typeof firebaseConfig !== "undefined") return firebaseConfig;
        } catch(e){}
        return null;
      })()
    `);
    const res = cleanEval();
    if (res && typeof res === 'object' && res.projectId) {
      return res;
    }
  } catch (e) {
    // Fallback
  }

  try {
    const fnLiteral = new Function(`return (${trimmed});`);
    const literalResult = fnLiteral();
    if (literalResult && typeof literalResult === 'object' && literalResult.projectId) {
      return literalResult;
    }
  } catch (e) {
    // Fallback
  }

  return null;
}

if (process.env.FIREBASE_CONFIG) {
  firebaseConfig = parseFirebaseConfig(process.env.FIREBASE_CONFIG);
}

if (!firebaseConfig) {
  firebaseConfig = firebaseConfigDoc;
} else if (firebaseConfigDoc && firebaseConfigDoc.firestoreDatabaseId && !firebaseConfig.firestoreDatabaseId) {
  // Always copy firestoreDatabaseId if it exists in the fallback applet config to prevent defaulting to (default)
  firebaseConfig.firestoreDatabaseId = firebaseConfigDoc.firestoreDatabaseId;
}

if (firebaseConfig) {
  try {
    firebaseApp = initializeApp(firebaseConfig);
    firestoreDb = initializeFirestore(firebaseApp, {
      experimentalForceLongPolling: true,
    }, firebaseConfig.firestoreDatabaseId);
    isFirestore = true;
    console.log('Firebase initialized in server/firebaseDb.ts using config database:', firebaseConfig.firestoreDatabaseId || '(default)');
  } catch (err) {
    console.error('Failed to initialize Firebase in server/firebaseDb.ts:', err);
  }
}

// Auto-increment sequence emulator for Firestore
export async function getNextId(collectionName: string): Promise<number> {
  if (!isFirestore || !firestoreDb) return 1;
  const counterRef = doc(firestoreDb, '_counters', collectionName);
  try {
    const counterSnap = await getDoc(counterRef);
    if (counterSnap.exists()) {
      const current = counterSnap.data().current || 0;
      const nextVal = current + 1;
      await setDoc(counterRef, { current: nextVal });
      return nextVal;
    } else {
      // Self-heal: Scan collection for max ID
      const colRef = collection(firestoreDb, collectionName);
      const snap = await getDocs(colRef);
      let maxId = 0;
      snap.forEach((d) => {
        const data = d.data();
        const idVal = data.id || data.user_id;
        if (typeof idVal === 'number' && idVal > maxId) {
          maxId = idVal;
        }
      });
      const nextVal = maxId + 1;
      await setDoc(counterRef, { current: nextVal });
      return nextVal;
    }
  } catch (err) {
    console.error(`Failed to get next ID for ${collectionName}, defaulting to random ID`, err);
    return Math.floor(Math.random() * 900000) + 100000;
  }
}

// Core Firebase Database implementation
export const firebaseDb = {
  async getUsers(role?: string): Promise<any[]> {
    const colRef = collection(firestoreDb, 'users');
    let q = query(colRef);
    if (role) {
      q = query(colRef, where('role', '==', role));
    }
    const snap = await getDocs(q);
    const list: any[] = [];
    snap.forEach(d => {
      list.push(d.data());
    });
    return list.sort((a, b) => b.id - a.id);
  },

  async getUserById(id: number): Promise<any | null> {
    const docSnap = await getDoc(doc(firestoreDb, 'users', String(id)));
    return docSnap.exists() ? docSnap.data() : null;
  },

  async getUserByEmail(email: string): Promise<any | null> {
    const colRef = collection(firestoreDb, 'users');
    const q = query(colRef, where('email', '==', email.toLowerCase()));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs[0].data();
    }
    return null;
  },

  async getUserByStoreSlug(slug: string): Promise<any | null> {
    const colRef = collection(firestoreDb, 'users');
    const q = query(colRef, where('store_slug', '==', slug));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs[0].data();
    }
    return null;
  },

  async createUser(user: {
    email: string;
    password_hash: string;
    role: string;
    status?: string;
    store_name?: string;
    store_slug?: string;
    phone?: string;
    registration_fee_paid_ghs?: number;
  }): Promise<any> {
    const nextId = await getNextId('users');
    const newUser = {
      id: nextId,
      email: user.email.toLowerCase(),
      password_hash: user.password_hash,
      role: user.role,
      status: user.status || 'active',
      store_name: user.store_name || null,
      store_slug: user.store_slug || null,
      phone: user.phone || null,
      registration_fee_paid_ghs: user.registration_fee_paid_ghs || 0,
      storefront_enabled: true,
      created_at: new Date().toISOString()
    };
    await setDoc(doc(firestoreDb, 'users', String(nextId)), newUser);
    return newUser;
  },

  async updateUserStatus(id: number, status: string): Promise<boolean> {
    await updateDoc(doc(firestoreDb, 'users', String(id)), { status });
    return true;
  },

  async updateStorefrontEnabled(id: number, enabled: boolean): Promise<boolean> {
    await updateDoc(doc(firestoreDb, 'users', String(id)), { storefront_enabled: enabled });
    return true;
  },

  async updateUserRole(id: number, role: string): Promise<boolean> {
    await updateDoc(doc(firestoreDb, 'users', String(id)), { role });
    return true;
  },

  async updateUserStoreInfo(id: number, storeName: string, storeSlug: string): Promise<boolean> {
    await updateDoc(doc(firestoreDb, 'users', String(id)), {
      store_name: storeName,
      store_slug: storeSlug
    });
    return true;
  },

  async updateUserPassword(id: number, passwordHash: string): Promise<boolean> {
    await updateDoc(doc(firestoreDb, 'users', String(id)), {
      password_hash: passwordHash
    });
    return true;
  },

  async deleteUser(id: number): Promise<boolean> {
    await deleteDoc(doc(firestoreDb, 'users', String(id)));
    try {
      await deleteDoc(doc(firestoreDb, 'reseller_accounts', String(id)));
    } catch (err) {
      console.warn('Reseller account cleanup failed:', err);
    }
    try {
      const rpRef = collection(firestoreDb, 'reseller_pricing');
      const snap = await getDocs(query(rpRef, where('reseller_id', '==', id)));
      for (const d of snap.docs) {
        await deleteDoc(doc(firestoreDb, 'reseller_pricing', d.id));
      }
    } catch (err) {
      console.warn('Pricing cleanup skipped or failed during user deletion:', err);
    }
    return true;
  },

  async createSmsLog(resellerId: number | null, senderId: string, message: string, status: string): Promise<any> {
    const nextId = await getNextId('sms_logs');
    const newLog = {
      id: nextId,
      reseller_id: resellerId,
      sender_id: senderId,
      message,
      status,
      created_at: new Date().toISOString()
    };
    await setDoc(doc(firestoreDb, 'sms_logs', String(nextId)), newLog);
    return newLog;
  },

  async getSmsLogs(): Promise<any[]> {
    const snap = await getDocs(collection(firestoreDb, 'sms_logs'));
    const list: any[] = [];
    snap.forEach(d => {
      list.push(d.data());
    });
    return list.sort((a, b) => b.id - a.id);
  },

  async createEmailLog(resellerId: number | null, subject: string, message: string, status: string): Promise<any> {
    const nextId = await getNextId('email_logs');
    const newLog = {
      id: nextId,
      reseller_id: resellerId,
      subject,
      message,
      status,
      created_at: new Date().toISOString()
    };
    await setDoc(doc(firestoreDb, 'email_logs', String(nextId)), newLog);
    return newLog;
  },

  async getEmailLogs(): Promise<any[]> {
    const snap = await getDocs(collection(firestoreDb, 'email_logs'));
    const list: any[] = [];
    snap.forEach(d => {
      list.push(d.data());
    });
    return list.sort((a, b) => b.id - a.id);
  },

  async getBundles(statusOnlyActive?: boolean): Promise<any[]> {
    const colRef = collection(firestoreDb, 'bundles');
    const snap = await getDocs(colRef);
    const list: any[] = [];
    snap.forEach(d => {
      const data = d.data();
      if (!statusOnlyActive || data.status === 'active') {
        list.push(data);
      }
    });
    return list.sort((a, b) => a.id - b.id);
  },

  async getBundleById(id: number): Promise<any | null> {
    const docSnap = await getDoc(doc(firestoreDb, 'bundles', String(id)));
    return docSnap.exists() ? docSnap.data() : null;
  },

  async createBundle(bundle: {
    name: string;
    network: string;
    data_amount: string;
    validity_days: number;
    admin_base_price_ghs: number;
    provider_plan_code: string;
    status?: string;
  }): Promise<any> {
    const nextId = await getNextId('bundles');
    const newBundle = {
      id: nextId,
      name: bundle.name,
      network: bundle.network,
      data_amount: bundle.data_amount,
      validity_days: Number(bundle.validity_days || 30),
      admin_base_price_ghs: Number(bundle.admin_base_price_ghs),
      provider_plan_code: bundle.provider_plan_code,
      status: bundle.status || 'active',
      created_at: new Date().toISOString()
    };
    await setDoc(doc(firestoreDb, 'bundles', String(nextId)), newBundle);
    return newBundle;
  },

  async updateBundle(id: number, bundle: {
    name: string;
    network: string;
    data_amount: string;
    validity_days: number;
    admin_base_price_ghs: number;
    provider_plan_code: string;
    status: string;
  }): Promise<any | null> {
    const ref = doc(firestoreDb, 'bundles', String(id));
    const payload = {
      name: bundle.name,
      network: bundle.network,
      data_amount: bundle.data_amount,
      validity_days: Number(bundle.validity_days || 30),
      admin_base_price_ghs: Number(bundle.admin_base_price_ghs),
      provider_plan_code: bundle.provider_plan_code,
      status: bundle.status
    };
    await updateDoc(ref, payload);
    const updatedSnap = await getDoc(ref);
    return updatedSnap.exists() ? updatedSnap.data() : null;
  },

  async deleteBundle(id: number): Promise<boolean> {
    await deleteDoc(doc(firestoreDb, 'bundles', String(id)));
    return true;
  },

  async getResellerPricings(resellerId: number): Promise<any[]> {
    const colRef = collection(firestoreDb, 'reseller_pricing');
    const q = query(colRef, where('reseller_id', '==', resellerId));
    const snap = await getDocs(q);
    const list: any[] = [];
    snap.forEach(d => {
      list.push(d.data());
    });
    return list;
  },

  async saveResellerPricing(
    resellerId: number, 
    bundleId: number, 
    markupType: 'fixed' | 'percentage', 
    markupValue: number, 
    finalPrice: number
  ): Promise<any> {
    const pricingId = `${resellerId}_${bundleId}`;
    const docRef = doc(firestoreDb, 'reseller_pricing', pricingId);
    const docSnap = await getDoc(docRef);
    let id = 1;
    if (docSnap.exists()) {
      id = docSnap.data().id || 1;
    } else {
      id = await getNextId('reseller_pricing');
    }
    const data = {
      id,
      reseller_id: Number(resellerId),
      bundle_id: Number(bundleId),
      markup_type: markupType,
      markup_value: Number(markupValue),
      final_price_ghs: Number(finalPrice)
    };
    await setDoc(docRef, data);
    return data;
  },

  async getOrders(resellerId?: number | null): Promise<any[]> {
    const colRef = collection(firestoreDb, 'orders');
    const snap = await getDocs(colRef);
    const list: any[] = [];
    snap.forEach(d => {
      const data = d.data();
      if (resellerId === undefined || data.reseller_id === resellerId) {
        list.push(data);
      }
    });
    return list.sort((a, b) => b.id - a.id);
  },

  async getOrderById(id: number): Promise<any | null> {
    const docSnap = await getDoc(doc(firestoreDb, 'orders', String(id)));
    return docSnap.exists() ? docSnap.data() : null;
  },

  async getOrderByRef(ref: string): Promise<any | null> {
    const colRef = collection(firestoreDb, 'orders');
    const q = query(colRef, where('order_ref', '==', ref));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs[0].data();
    }
    return null;
  },

  async createOrder(order: {
    order_ref: string;
    customer_id?: number | null;
    reseller_id?: number | null;
    bundle_id: number;
    customer_phone: string;
    admin_base_price_ghs?: number;
    reseller_markup_ghs?: number;
    final_price_ghs: number;
    admin_fee_ghs?: number;
    net_to_reseller_ghs?: number;
    delivery_status?: string;
    payment_status?: string;
    tax_fee_ghs?: number;
  }): Promise<any> {
    const nextId = await getNextId('orders');
    const newOrder = {
      id: nextId,
      order_ref: order.order_ref,
      customer_id: order.customer_id || null,
      reseller_id: order.reseller_id || null,
      bundle_id: Number(order.bundle_id),
      customer_phone: order.customer_phone,
      admin_base_price_ghs: Number(order.admin_base_price_ghs || 0),
      reseller_markup_ghs: Number(order.reseller_markup_ghs || 0),
      final_price_ghs: Number(order.final_price_ghs),
      admin_fee_ghs: Number(order.admin_fee_ghs || 0),
      net_to_reseller_ghs: Number(order.net_to_reseller_ghs || 0),
      delivery_status: order.delivery_status || 'pending',
      payment_status: order.payment_status || 'pending',
      tax_fee_ghs: Number(order.tax_fee_ghs || 0),
      created_at: new Date().toISOString()
    };
    await setDoc(doc(firestoreDb, 'orders', String(nextId)), newOrder);
    return newOrder;
  },

  async updateOrderStatus(id: number, paymentStatus: string, deliveryStatus: string): Promise<boolean> {
    await updateDoc(doc(firestoreDb, 'orders', String(id)), {
      payment_status: paymentStatus,
      delivery_status: deliveryStatus
    });
    return true;
  },

  async updateOrderDeliveryStatus(id: number, deliveryStatus: string): Promise<boolean> {
    await updateDoc(doc(firestoreDb, 'orders', String(id)), {
      delivery_status: deliveryStatus
    });
    return true;
  },

  async getResellerAccountByUserId(userId: number): Promise<any | null> {
    const docSnap = await getDoc(doc(firestoreDb, 'reseller_accounts', String(userId)));
    return docSnap.exists() ? docSnap.data() : null;
  },

  async createResellerAccount(userId: number, initialBalance: number = 0): Promise<any> {
    const docRef = doc(firestoreDb, 'reseller_accounts', String(userId));
    const act = {
      user_id: Number(userId),
      balance_ghs: Number(initialBalance),
      total_earned_ghs: 0,
      total_customers: 0,
      deduction_source: 'storefront_earnings'
    };
    await setDoc(docRef, act);
    return act;
  },

  async incrementResellerAccount(userId: number, amountGhs: number, isNewCustomer: boolean): Promise<any> {
    const docRef = doc(firestoreDb, 'reseller_accounts', String(userId));
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      const nextBal = Number(data.balance_ghs || 0) + Number(amountGhs);
      const nextEarned = Number(data.total_earned_ghs || 0) + Number(amountGhs);
      const nextCust = Number(data.total_customers || 0) + (isNewCustomer ? 1 : 0);
      await updateDoc(docRef, {
        balance_ghs: nextBal,
        total_earned_ghs: nextEarned,
        total_customers: nextCust
      });
      return {
        user_id: userId,
        balance_ghs: nextBal,
        total_earned_ghs: nextEarned,
        total_customers: nextCust
      };
    } else {
      const act = {
        user_id: Number(userId),
        balance_ghs: Number(amountGhs),
        total_earned_ghs: Number(amountGhs),
        total_customers: isNewCustomer ? 1 : 0,
        deduction_source: 'storefront_earnings'
      };
      await setDoc(docRef, act);
      return act;
    }
  },

  async deductResellerBalance(userId: number, amountGhs: number): Promise<boolean> {
    const docRef = doc(firestoreDb, 'reseller_accounts', String(userId));
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const currentBal = Number(docSnap.data().balance_ghs || 0);
      await updateDoc(docRef, { balance_ghs: currentBal - Number(amountGhs) });
      return true;
    }
    return false;
  },

  async updateResellerDeductionSource(userId: number, source: string): Promise<boolean> {
    await updateDoc(doc(firestoreDb, 'reseller_accounts', String(userId)), {
      deduction_source: source
    });
    return true;
  },

  async getWithdrawals(resellerId?: number): Promise<any[]> {
    const colRef = collection(firestoreDb, 'withdrawal_requests');
    const snap = await getDocs(colRef);
    const list: any[] = [];
    snap.forEach(d => {
      const data = d.data();
      if (resellerId === undefined || data.reseller_id === resellerId) {
        list.push(data);
      }
    });
    return list.sort((a, b) => b.id - a.id);
  },

  async createWithdrawal(resellerId: number, amountGhs: number): Promise<any> {
    const nextId = await getNextId('withdrawal_requests');
    const newRequest = {
      id: nextId,
      reseller_id: Number(resellerId),
      amount_ghs: Number(amountGhs),
      status: 'pending',
      decline_reason: null,
      processed_at: null,
      fee_ghs: 0,
      net_amount_ghs: Number(amountGhs),
      created_at: new Date().toISOString()
    };
    await setDoc(doc(firestoreDb, 'withdrawal_requests', String(nextId)), newRequest);
    return newRequest;
  },

  async processWithdrawal(id: number, status: 'approved' | 'declined', reason?: string): Promise<boolean> {
    await updateDoc(doc(firestoreDb, 'withdrawal_requests', String(id)), {
      status,
      decline_reason: reason || null,
      processed_at: new Date().toISOString()
    });
    return true;
  },

  async getPayments(): Promise<any[]> {
    const snap = await getDocs(collection(firestoreDb, 'payments'));
    const list: any[] = [];
    snap.forEach(d => {
      list.push(d.data());
    });
    return list.sort((a, b) => b.id - a.id);
  },

  async createPaymentLog(log: {
    order_id: number;
    transaction_ref: string;
    provider: string;
    amount_ghs: number;
    customer_email: string;
    customer_phone: string;
    status: string;
    webhook_payload?: string;
  }): Promise<any> {
    const nextId = await getNextId('payments');
    const newPy = {
      id: nextId,
      order_id: Number(log.order_id),
      transaction_ref: log.transaction_ref,
      provider: log.provider,
      amount_ghs: Number(log.amount_ghs),
      customer_email: log.customer_email || null,
      customer_phone: log.customer_phone || null,
      status: log.status,
      webhook_payload: log.webhook_payload || null,
      created_at: new Date().toISOString()
    };
    await setDoc(doc(firestoreDb, 'payments', String(nextId)), newPy);
    return newPy;
  },

  async getDeliveryLogs(): Promise<any[]> {
    const snap = await getDocs(collection(firestoreDb, 'data_delivery_logs'));
    const list: any[] = [];
    snap.forEach(d => {
      list.push(d.data());
    });
    return list.sort((a, b) => b.id - a.id);
  },

  async createDeliveryLog(log: {
    order_id: number;
    api_provider: string;
    request_payload: string;
    response: string;
    status: string;
  }): Promise<any> {
    const nextId = await getNextId('data_delivery_logs');
    const newLog = {
      id: nextId,
      order_id: Number(log.order_id),
      api_provider: log.api_provider,
      request_payload: log.request_payload,
      response: log.response,
      status: log.status,
      retry_count: 0,
      created_at: new Date().toISOString()
    };
    await setDoc(doc(firestoreDb, 'data_delivery_logs', String(nextId)), newLog);
    return newLog;
  },

  async incrementSandboxLogRetry(logId: number, status: string, response: string): Promise<boolean> {
    const docRef = doc(firestoreDb, 'data_delivery_logs', String(logId));
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const nextRetry = (docSnap.data().retry_count || 0) + 1;
      await updateDoc(docRef, {
        retry_count: nextRetry,
        status,
        response
      });
      return true;
    }
    return false;
  },

  async getSettings(): Promise<any> {
    const snap = await getDocs(collection(firestoreDb, 'admin_settings'));
    const settings: Record<string, any> = {};
    snap.forEach(d => {
      const data = d.data();
      if (data.setting_key) {
        const val = data.setting_value;
        if (val === '') {
          settings[data.setting_key] = '';
        } else {
          settings[data.setting_key] = val === 'true' ? true : (val === 'false' ? false : (isNaN(Number(val)) ? val : Number(val)));
        }
      }
    });
    return settings;
  },

  async updateSetting(key: string, value: string): Promise<boolean> {
    await setDoc(doc(firestoreDb, 'admin_settings', key), {
      setting_key: key,
      setting_value: String(value)
    });
    return true;
  },

  async getReviews(resellerId?: number): Promise<any[]> {
    const snap = await getDocs(collection(firestoreDb, 'ratings_reviews'));
    const list: any[] = [];
    snap.forEach(d => {
      const data = d.data();
      if (!resellerId || Number(data.reseller_id) === Number(resellerId)) {
        list.push(data);
      }
    });
    return list.sort((a, b) => b.id - a.id);
  },

  async createReview(review: { reseller_id: number; author_name: string; rating: number; comment: string }): Promise<any> {
    const nextId = await getNextId('ratings_reviews');
    const newDoc = {
      id: nextId,
      reseller_id: Number(review.reseller_id),
      author_name: review.author_name,
      rating: Number(review.rating),
      comment: review.comment,
      created_at: new Date().toISOString()
    };
    await setDoc(doc(firestoreDb, 'ratings_reviews', String(nextId)), newDoc);
    return newDoc;
  },

  async getNotifications(userId: number | null): Promise<any[]> {
    const colRef = collection(firestoreDb, 'notifications');
    let q = query(colRef);
    if (userId !== null) {
      q = query(colRef, where('user_id', '==', Number(userId)));
    } else {
      q = query(colRef, where('user_id', '==', null));
    }
    const snap = await getDocs(q);
    const list: any[] = [];
    snap.forEach(d => {
      list.push(d.data());
    });
    return list.sort((a, b) => b.id - a.id);
  },

  async createNotification(notification: { user_id: number | null; title: string; message: string; type: string }): Promise<any> {
    const nextId = await getNextId('notifications');
    const newNotif = {
      id: nextId,
      user_id: notification.user_id !== null ? Number(notification.user_id) : null,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      is_read: false,
      created_at: new Date().toISOString()
    };
    await setDoc(doc(firestoreDb, 'notifications', String(nextId)), newNotif);
    return newNotif;
  },

  async markNotificationAsRead(id: number): Promise<boolean> {
    await updateDoc(doc(firestoreDb, 'notifications', String(id)), { is_read: true });
    return true;
  },

  async clearNotifications(userId: number | null): Promise<boolean> {
    const colRef = collection(firestoreDb, 'notifications');
    let q = query(colRef);
    if (userId !== null) {
      q = query(colRef, where('user_id', '==', Number(userId)));
    } else {
      q = query(colRef, where('user_id', '==', null));
    }
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      await deleteDoc(doc(firestoreDb, 'notifications', d.id));
    }
    return true;
  },

  async resetToProduction(): Promise<void> {
    const collectionsToClear = [
      'orders',
      'payments',
      'withdrawal_requests',
      'sms_logs',
      'email_logs',
      'data_delivery_logs',
      'ratings_reviews',
      'notifications'
    ];

    for (const c of collectionsToClear) {
      try {
        const snap = await getDocs(collection(firestoreDb, c));
        for (const d of snap.docs) {
          await deleteDoc(doc(firestoreDb, c, d.id));
        }
      } catch (err) {
        console.warn(`Error clearing Firestore collection ${c}:`, err);
      }
    }

    // Zero out all existing reseller accounts' balances and statistics
    try {
      const snap = await getDocs(collection(firestoreDb, 'reseller_accounts'));
      for (const d of snap.docs) {
        await updateDoc(doc(firestoreDb, 'reseller_accounts', d.id), {
          balance_ghs: 0,
          total_earned_ghs: 0,
          total_customers: 0
        });
      }
    } catch (err) {
      console.warn('Error resetting reseller_accounts balances:', err);
    }

    // Preserve all registered user accounts, but reset their registration fee paid record to 0
    // so previous simulated fees do not skew live administrative earnings calculation.
    try {
      const usersSnap = await getDocs(collection(firestoreDb, 'users'));
      for (const d of usersSnap.docs) {
        const userData = d.data();
        const email = (userData.email || '').toLowerCase().trim();
        if (email === 'aaronbinka173@gmail.com') {
          await updateDoc(doc(firestoreDb, 'users', d.id), {
            role: 'admin',
            status: 'active',
            registration_fee_paid_ghs: 0
          });
        } else {
          await updateDoc(doc(firestoreDb, 'users', d.id), {
            registration_fee_paid_ghs: 0
          });
        }
      }
    } catch (err) {
      console.warn('Error resetting user registration fee metrics:', err);
    }

    // Reset VTU Gateway Wallet balance, admin claims, and test mode status
    try {
      await this.updateSetting('vtu_provider_balance', '0.00');
      await this.updateSetting('admin_total_withdrawn_ghs', '0.00');
      await this.updateSetting('admin_forfeited_reseller_profit', '0.00');
      await this.updateSetting('admin_withdrawal_logs', '[]');
      await this.updateSetting('test_mode_enabled', 'false');
    } catch (err) {
      console.warn('Error resetting setting parameters:', err);
    }
  }
};
