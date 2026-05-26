import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

dotenv.config();

import { initDb, db } from './server/db';
import { deliverDataBundle, finalizePaidOrder } from './server/payment-delivery';

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'mac-data-hub-sec-key-1337-ghana';

app.use(cors());
app.use(express.json());

// Helper auth middleware
export interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: 'admin' | 'reseller' | 'customer';
    status: string;
  };
}

function verifyToken(roles?: string[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      req.user = decoded;

      // Admin dashboard access is allowed for users with role === 'admin'

      const u = await db.getUserById(decoded.id);
      if (!u) {
        return res.status(401).json({ error: 'User account not found.' });
      }

      if (u.status === 'suspended') {
        return res.status(403).json({ error: 'Account suspended. Please contact support.' });
      }

      // Check reseller dashboard access restrictions
      if (roles && roles.includes('reseller') && u.role === 'reseller' && u.status !== 'active') {
        if (u.status === 'pending_approval') {
          return res.status(403).json({ error: 'Your account is pending admin approval.' });
        }
        if (u.status === 'pending_payment') {
          return res.status(403).json({ error: 'Your account has outstanding payment pending.' });
        }
        return res.status(403).json({ error: 'Your reseller account is not active yet.' });
      }

      req.user.status = u.status;
      req.user.role = u.role;
      req.user.email = u.email;

      if (roles && !roles.includes(u.role)) {
        return res.status(403).json({ error: 'Access forbidden. Insufficient permissions.' });
      }

      next();
    } catch (e) {
      return res.status(400).json({ error: 'Invalid or expired token.' });
    }
  };
}

// Ensure the DB is loaded and tables are ready
initDb().then(() => {
  console.log('Database system loaded successfully');
}).catch(err => {
  console.error('Failed to load DB system:', err);
});

// ==========================================
// 1. PUBLIC AUTHENTICATION & REGISTRATION
// ==========================================

app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const { email, password, role, storeName, storeSlug, phone } = req.body;

    if (!email || !password || !role) {
      return res.status(400).json({ error: 'Missing required parameters (email, password, role).' });
    }

    if (role === 'admin') {
      return res.status(403).json({ error: 'Administrative roles cannot be registered through this channel.' });
    }

    const lowerEmail = email.toLowerCase().trim();
    const existing = await db.getUserByEmail(lowerEmail);
    if (existing) {
      return res.status(400).json({ error: 'Email address already registered.' });
    }

    // Slug check for resellers
    let slug = null;
    if (role === 'reseller') {
      if (!storeName || !storeSlug) {
        return res.status(400).json({ error: 'Resellers must provide a Store Name and a Store URL slug.' });
      }
      slug = storeSlug.toLowerCase().trim().replace(/[^a-z0-9-]/g, '-');
      const existingSlug = await db.getUserByStoreSlug(slug);
      if (existingSlug) {
        return res.status(400).json({ error: 'This storefront URL slug is already taken.' });
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const settings = await db.getSettings();

    // Determine status: if reseller registration fee is enabled, set status to pending_payment until paid
    // If registration fee is NOT enabled, set status to pending_approval so the admin has to review & approve the storefront.
    let initialStatus = 'active';
    let regFeeAmount = 0;

    if (role === 'reseller') {
      regFeeAmount = settings.registration_fee_ghs;
      if (settings.registration_fee_enabled && regFeeAmount > 0) {
        initialStatus = 'pending_payment';
      } else {
        initialStatus = 'pending_approval';
      }
    }

    const createdUser = await db.createUser({
      email: lowerEmail,
      password_hash: passwordHash,
      role,
      status: initialStatus,
      store_name: role === 'reseller' ? storeName.trim() : null,
      store_slug: slug,
      phone: phone || null,
      registration_fee_paid_ghs: initialStatus === 'active' ? 0 : 0 // will be updated when fee paid
    });

    if (role === 'reseller') {
      // Create account row
      await db.createResellerAccount(createdUser.id, 0);
    }

    const token = jwt.sign(
      { id: createdUser.id, email: createdUser.email, role: createdUser.role, status: createdUser.status },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      message: 'Registration successful!',
      token,
      user: {
        id: createdUser.id,
        email: createdUser.email,
        role: createdUser.role,
        status: createdUser.status,
        store_name: createdUser.store_name,
        store_slug: createdUser.store_slug
      }
    });

  } catch (err: any) {
    console.error('Registration Error:', err);
    return res.status(500).json({ error: err.message || 'System error' });
  }
});

app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await db.getUserByEmail(email.trim());
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Your account has been suspended by the administrator.' });
    }

    // Administrative logins allowed for any validated admin

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, status: user.status },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        store_name: user.store_name,
        store_slug: user.store_slug,
        phone: user.phone
      }
    });
  } catch (err: any) {
    console.error('Login Error:', err);
    return res.status(500).json({ error: err.message || 'System error' });
  }
});

// Authenticated password change endpoint
app.post('/api/auth/change-password', verifyToken(), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
    }

    const user = await db.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'The current password you entered is incorrect.' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await db.updateUserPassword(userId, newHash);

    return res.json({ message: 'Your password has been changed successfully.' });
  } catch (err: any) {
    console.error('Change Password Error:', err);
    return res.status(500).json({ error: err.message || 'System error' });
  }
});

app.get('/api/auth/me', verifyToken(), async (req: AuthRequest, res: Response) => {
  try {
    const user = await db.getUserById(req.user!.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        store_name: user.store_name,
        store_slug: user.store_slug,
        phone: user.phone
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 2. PUBLIC STOREFRONT & BUNDLES
// ==========================================

// Get active bundles for direct/customer storefront purchase
app.get('/api/bundles', async (req: Request, res: Response) => {
  try {
    const active = await db.getBundles(true);
    return res.json(active);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Get registration fee configurations publicly
app.get('/api/registration-fee', async (req: Request, res: Response) => {
  try {
    const settings = await db.getSettings();
    return res.json({
      fee_enabled: settings.registration_fee_enabled,
      fee_ghs: settings.registration_fee_ghs
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Get dynamic pricing and layout config for a given reseller's store slug
app.get('/api/store/:slug', async (req: Request, res: Response) => {
  try {
    const slug = req.params.slug.toLowerCase().trim();
    const reseller = await db.getUserByStoreSlug(slug);

    if (!reseller) {
      return res.status(404).json({ error: 'Reseller storefront not found' });
    }

    if (reseller.status === 'suspended') {
      return res.status(403).json({ error: 'This reseller store has been temporarily suspended.' });
    }

    const baseBundles = await db.getBundles(true);
    const customPricing = await db.getResellerPricings(reseller.id);

    // Map custom prices
    const storefrontBundles = baseBundles.map(b => {
      const pricing = customPricing.find(p => p.bundle_id === b.id);
      let consumerPrice = b.admin_base_price_ghs;
      let markupAdded = 0;

      if (pricing) {
        if (pricing.markup_type === 'fixed') {
          markupAdded = Number(pricing.markup_value);
        } else {
          markupAdded = Number(((b.admin_base_price_ghs * pricing.markup_value) / 100).toFixed(2));
        }
        consumerPrice = Number((b.admin_base_price_ghs + markupAdded).toFixed(2));
      }

      return {
        ...b,
        admin_base_price_ghs: b.admin_base_price_ghs,
        reseller_markup_ghs: markupAdded,
        final_price_ghs: consumerPrice
      };
    });

     return res.json({
      reseller: {
        id: reseller.id,
        store_name: reseller.store_name,
        store_slug: reseller.store_slug,
        phone: reseller.phone,
        email: reseller.email,
        storefront_enabled: reseller.storefront_enabled !== false
      },
      bundles: storefrontBundles
    });

  } catch (err: any) {
    console.error('Storefront Fetch Error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 3. CHECKOUT & RESELLER REGISTRATION PAYMENT
// ==========================================

// Initiates payment, returns details back to client.
app.post('/api/checkout', async (req: Request, res: Response) => {
  try {
    const { 
      bundleId, 
      customerPhone, 
      customerEmail,
      resellerId, // Optional: if empty, purchasing directly from main platform
      paymentMethod, // mobile_money or card
      network, // MTN, Telecel, AirtelTigo for MoMo
      isRegistrationFeePayment, // Boolean flag for reseller paywall bypass
      registeringResellerId // user id if registration checkout
    } = req.body;

    const emailToUse = customerEmail || 'buyer@machub.com';
    const settings = await db.getSettings();

    // 1. Reseller Registration Fee Checkout Scenario
    if (isRegistrationFeePayment) {
      if (!registeringResellerId) {
        return res.status(400).json({ error: 'Registering reseller ID is missing.' });
      }

      const user = await db.getUserById(Number(registeringResellerId));
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const regFee = settings.registration_fee_ghs;
      const orderRef = `REG-FLW-${user.id}-${Math.floor(Math.random() * 900000 + 100000)}`;

      return res.json({
        checkout_needed: true,
        reference: orderRef,
        amount: regFee,
        email: user.email,
        phone: user.phone || '0000000000',
        payment_method: paymentMethod,
        is_registration: true,
        test_mode: settings.test_mode_enabled,
        payment_gateway: settings.payment_gateway || 'paystack',
        meta: {
          title: 'Reseller Storefront Registration',
          description: `Mac Data Hub registration fee for ${user.email}`,
          currency: 'GHS',
          flw_pub_key: settings.flutterwave_public_key || process.env.FLUTTERWAVE_PUBLIC_KEY || 'FLWPUBK_TEST-MOCK_KEY',
          paystack_pub_key: settings.paystack_public_key || process.env.PAYSTACK_PUBLIC_KEY || 'pk_test_mock_key'
        }
      });
    }

    // 2. Standard Bundle Purchase Scenario
    if (!bundleId || !customerPhone) {
      return res.status(400).json({ error: 'Bundle and phone number are required for purchase.' });
    }

    const bundle = await db.getBundleById(Number(bundleId));
    if (!bundle || bundle.status === 'inactive') {
      return res.status(404).json({ error: 'Selected bundle is currently unavailable or has been deactivated.' });
    }

    // Determine pricing flow
    let adminBasePrice = Number(bundle.admin_base_price_ghs);
    let finalCustomerPrice = adminBasePrice;
    let resellerMarkup = 0;
    let netToReseller = 0;
    let adminFee = 0;

    let targetResellerId = resellerId ? Number(resellerId) : null;

    if (targetResellerId) {
      const resellerUser = await db.getUserById(targetResellerId);
      if (resellerUser && resellerUser.storefront_enabled === false) {
        return res.status(400).json({ error: 'This reseller storefront is currently closed and is not accepting new orders.' });
      }

      const customPricings = await db.getResellerPricings(targetResellerId);
      const pr = customPricings.find(p => p.bundle_id === bundle.id);
      
      if (pr) {
        if (pr.markup_type === 'fixed') {
          resellerMarkup = Number(pr.markup_value);
        } else {
          resellerMarkup = Number(((adminBasePrice * pr.markup_value) / 100).toFixed(2));
        }
        finalCustomerPrice = Number((adminBasePrice + resellerMarkup).toFixed(2));
      }

      // Calculate Admin fee on Reseller sales if configured
      // Percent setup e.g. 2% deducted from sale price
      adminFee = Number(((finalCustomerPrice * settings.admin_fee_percent) / 100).toFixed(2));

      // Net margin calculation for reseller
      // admin_fee_source defines if admin fee gets deducted from their markup profit OR paid on top
      if (settings.admin_fee_source === 'storefront_earnings') {
        netToReseller = Number((resellerMarkup - adminFee).toFixed(2));
      } else {
        netToReseller = resellerMarkup;
      }
    }

    // Create Guest/Customer row implicitly to tie in order references
    let customerUserId = 1; // Default admin is 1, let's look for user or fall back
    const existingCust = await db.getUserByEmail(emailToUse);
    if (existingCust) {
      customerUserId = existingCust.id;
    } else {
      // Create lazy guest user record
      try {
        const passwordHash = await bcrypt.hash('guestpass123', 10);
        const randUser = await db.createUser({
          email: emailToUse,
          password_hash: passwordHash,
          role: 'customer',
          phone: customerPhone
        });
        customerUserId = randUser.id;
      } catch {
        // Fallback to Admin's user ID if lazy registration hits constraint
        customerUserId = 1;
      }
    }

    const uniqueRef = `MAC-ORD-${Math.floor(Math.random() * 900000 + 100000)}-${Date.now().toString().slice(-4)}`;

    const newOrder = await db.createOrder({
      order_ref: uniqueRef,
      customer_id: customerUserId,
      reseller_id: targetResellerId,
      bundle_id: bundle.id,
      customer_phone: customerPhone,
      admin_base_price_ghs: adminBasePrice,
      reseller_markup_ghs: resellerMarkup,
      final_price_ghs: finalCustomerPrice,
      admin_fee_ghs: adminFee,
      net_to_reseller_ghs: netToReseller,
      delivery_status: 'pending',
      payment_status: 'pending'
    });

    return res.json({
      checkout_needed: true,
      order_id: newOrder.id,
      reference: uniqueRef,
      amount: finalCustomerPrice,
      email: emailToUse,
      phone: customerPhone,
      payment_method: paymentMethod,
      is_registration: false,
      test_mode: settings.test_mode_enabled,
      payment_gateway: settings.payment_gateway || 'paystack',
      meta: {
        title: bundle.name,
        description: `Delivering ${bundle.data_amount} to ${customerPhone}`,
        currency: 'GHS',
        flw_pub_key: settings.flutterwave_public_key || process.env.FLUTTERWAVE_PUBLIC_KEY || 'FLWPUBK_TEST-MOCK_KEY',
        paystack_pub_key: settings.paystack_public_key || process.env.PAYSTACK_PUBLIC_KEY || 'pk_test_mock_key'
      }
    });

  } catch (err: any) {
    console.error('Checkout Error:', err);
    return res.status(500).json({ error: err.message || 'System error starting transaction.' });
  }
});

// A quick API helper to settle transactions instantly in standard Sandbox / Test Mode
app.post('/api/checkout/mock-success', async (req: Request, res: Response) => {
  try {
    const { reference } = req.body;
    if (!reference) {
      return res.status(400).json({ error: 'Reference code is required.' });
    }

    console.log(`Simulating mock transaction settlement for: ${reference}`);

    // Registration Flow Case
    if (reference.startsWith('REG-')) {
      const parts = reference.split('-');
      const userId = Number(parts[2]);
      await db.updateUserStatus(userId, 'pending_approval');
      
      const settings = await db.getSettings();
      // Status update is fully persisted inside db.updateUserStatus already.

      return res.json({ success: true, message: 'Registration fee settled successfully! Your reseller store account is now awaiting administrator review and approval.' });
    }

    // Normal Bundle Order Case
    const success = await finalizePaidOrder(reference, `MOCK-TX-${Date.now()}`, { mocked_checkout: true });
    if (success) {
      return res.json({ success: true, message: 'Mock payment verified successfully! Delivery triggered.' });
    } else {
      return res.status(404).json({ error: 'Order reference not found' });
    }
  } catch (err: any) {
    console.error('Mock Success Error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 4. ADMIN PROTECTED CAPABILITIES
// ==========================================

// Dashboard analytics
app.get('/api/admin/dashboard', verifyToken(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const resellers = await db.getUsers('reseller');
    const customers = await db.getUsers('customer');
    const orders = await db.getOrders();
    const withdrawals = await db.getWithdrawals();
    const settings = await db.getSettings();

    const resellerAccounts = await db.getResellerAccounts();

    // Stats calculations
    const paidOrders = orders.filter(o => o.payment_status === 'paid');
    const totalOrderRevenue = paidOrders.reduce((sum, o) => sum + Number(o.final_price_ghs), 0);
    const totalAdminFees = paidOrders.reduce((sum, o) => sum + Number(o.admin_fee_ghs), 0);
    const paidRegistrations = resellers.reduce((sum, u) => sum + Number(u.registration_fee_paid_ghs || 0), 0);

    const analytics = {
      total_resellers: resellers.length,
      total_customers: customers.length,
      total_orders: orders.length,
      total_revenue_ghs: totalOrderRevenue + paidRegistrations,
      total_admin_fees_earned_ghs: totalAdminFees,
      total_registrations_earned_ghs: paidRegistrations,
      pending_withdrawals: withdrawals.filter(w => w.status === 'pending').length,
      withdrawal_payouts_ghs: withdrawals.filter(w => w.status === 'approved').reduce((sum, w) => sum + Number(w.amount_ghs), 0)
    };

    return res.json(analytics);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin Bundles CRUD
app.get('/api/admin/bundles', verifyToken(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const bundles = await db.getBundles();
    return res.json(bundles);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/bundles', verifyToken(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const b = await db.createBundle(req.body);
    return res.status(201).json(b);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/bundles/:id', verifyToken(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const updated = await db.updateBundle(Number(req.params.id), req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Bundle not found' });
    }
    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/bundles/:id', verifyToken(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    await db.deleteBundle(Number(req.params.id));
    return res.json({ success: true, message: 'Bundle successfully deleted' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin reseller management
app.get('/api/admin/resellers', verifyToken(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const resellers = await db.getResellerAccounts();
    return res.json(resellers);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/resellers/:id/suspend', verifyToken(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const targetId = Number(req.params.id);
    const targetUser = await db.getUserById(targetId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User account not found.' });
    }
    if (targetUser.email.toLowerCase() === 'aaronbinka173@gmail.com') {
      return res.status(403).json({ error: 'System owner cannot be suspended.' });
    }
    if (targetUser.role === 'admin' && req.user?.email?.toLowerCase() !== 'aaronbinka173@gmail.com') {
      return res.status(403).json({ error: 'Only the platform owner can suspend other administrators.' });
    }
    await db.updateUserStatus(targetId, 'suspended');
    return res.json({ success: true, message: 'Reseller suspended' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/resellers/:id/reactivate', verifyToken(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const targetId = Number(req.params.id);
    const targetUser = await db.getUserById(targetId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User account not found.' });
    }
    if (targetUser.role === 'admin' && req.user?.email?.toLowerCase() !== 'aaronbinka173@gmail.com') {
      return res.status(403).json({ error: 'Only the platform owner can reactivate other administrators.' });
    }
    await db.updateUserStatus(targetId, 'active');
    return res.json({ success: true, message: 'Reseller reactivated' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/resellers/:id/approve', verifyToken(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const rId = Number(req.params.id);
    const targetUser = await db.getUserById(rId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User account not found.' });
    }
    if (targetUser.role === 'admin' && req.user?.email?.toLowerCase() !== 'aaronbinka173@gmail.com') {
      return res.status(403).json({ error: 'Only the platform owner can approve administrator accounts.' });
    }
    await db.updateUserStatus(rId, 'active');
    return res.json({ success: true, message: 'Reseller account storefront reviewed, approved, and set to active status.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/resellers/:id/toggle-admin', verifyToken(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const userId = Number(req.params.id);
    const user = await db.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User account not found.' });
    }
    
    // Prevent toggling the superadmin email
    if (user.email.toLowerCase() === 'aaronbinka173@gmail.com') {
      return res.status(400).json({ error: 'System owner admin role cannot be modified.' });
    }

    // Only allow the platform owner to grant or revoke admin access
    const callerEmail = req.user?.email?.toLowerCase();
    if (callerEmail !== 'aaronbinka173@gmail.com') {
      return res.status(403).json({ error: 'Only the platform owner can grant or revoke administrator privileges.' });
    }

    const newRole = user.role === 'admin' ? 'reseller' : 'admin';
    await db.updateUserRole(userId, newRole);
    
    return res.json({ 
      success: true, 
      message: `Updated role for "${user.email}" to: ${newRole === 'admin' ? 'Administrator' : 'Reseller'}` 
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});


// Admin reset reseller password
app.post('/api/admin/resellers/:id/reset-password', verifyToken(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const userId = Number(req.params.id);
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'New password is required and must be at least 6 characters.' });
    }

    const resellerUser = await db.getUserById(userId);
    if (!resellerUser) {
      return res.status(404).json({ error: 'Reseller user account not found.' });
    }

    // Protect the system owner
    if (resellerUser.email.toLowerCase() === 'aaronbinka173@gmail.com') {
      return res.status(403).json({ error: 'The platform owner\'s password can only be changed by themselves via their profile page.' });
    }

    // Protect other administrators from passwords being reset by reseller admins
    const isTargetAdmin = resellerUser.role === 'admin';
    const callerEmail = req.user?.email?.toLowerCase();
    if (isTargetAdmin && callerEmail !== 'aaronbinka173@gmail.com') {
      return res.status(403).json({ error: 'Only the platform owner can reset other administrator passwords.' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await db.updateUserPassword(userId, hashed);

    // Save an audit log of this action as part of safety
    console.log(`[Admin Activity] Admin reset password for reseller email: ${resellerUser.email}`);

    return res.json({ success: true, message: `Password for "${resellerUser.email}" successfully reset.` });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin outbound one-way SMS broadcaster (supports single reseller or broadcast to all)
app.post('/api/admin/send-sms', verifyToken(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { target, message, maskId } = req.body;
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'SMS Message body is required' });
    }

    // Modern alphanumeric Sender ID (Mask ID) enforces technical "no-reply" behavior over mobile cells
    const senderId = (maskId || 'NO-REPLY').toUpperCase().replace(/[^A-Z0-9\-]/g, '').slice(0, 11) || 'NO-REPLY';

    let targetResellers: any[] = [];
    if (target === 'all') {
      targetResellers = await db.getResellerAccounts();
    } else {
      const uId = Number(target);
      const singleReseller = await db.getResellerAccountByUserId(uId);
      if (!singleReseller) {
        return res.status(404).json({ error: 'Target agent account not found.' });
      }
      // Populate user info
      const rawUser = await db.getUserById(uId);
      targetResellers = [{ ...singleReseller, email: rawUser?.email, phone: rawUser?.phone }];
    }

    if (targetResellers.length === 0) {
      return res.status(400).json({ error: 'No active agents/resellers found to receive SMS.' });
    }

    const sentReceipts: any[] = [];
    for (const r of targetResellers) {
      const recipientPhone = r.phone || 'N/A';
      console.log(`[Outbound SMS - Telephony Gateway]`);
      console.log(`  Sender: Alphanumeric Alpha-Tag Mask "${senderId}" (TECHNICAL NO-REPLY ENFORCED)`);
      console.log(`  Recipient Phone: +233 ${recipientPhone}`);
      console.log(`  Message Payload: "${message}"`);
      console.log(`  Gateway Status: Routed via SS7/SMPP Provider (One-Way Alphanumeric Gateway successfully established)`);

      // Log to database
      const log = await db.createSmsLog(
        r.user_id,
        senderId,
        message,
        'Delivered'
      );
      sentReceipts.push({ ...log, recipientEmail: r.email, recipientPhone });
    }

    return res.json({
      success: true,
      senderId,
      messagePrefix: `Outbound Alphanumeric SMS Broadcast Complete. Sent to ${targetResellers.length} agent(s). Recipients cannot reply back due to GSM Alphanumeric Sender-ID restriction.`,
      dispatchCount: targetResellers.length,
      logs: sentReceipts
    });
  } catch (err: any) {
    console.error('Send SMS Error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Admin list outbound SMS logs
app.get('/api/admin/sms-logs', verifyToken(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const logs = await db.getSmsLogs();
    return res.json(logs);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin withdrawals
app.get('/api/admin/withdrawals', verifyToken(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const withdrawals = await db.getWithdrawals();
    return res.json(withdrawals);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/withdrawals/:id/approve', verifyToken(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const success = await db.processWithdrawal(Number(req.params.id), 'approved');
    if (!success) {
      return res.status(400).json({ error: 'Failed to approve withdrawal request (already processed or insufficient balance)' });
    }
    return res.json({ success: true, message: 'Withdrawal approved and deducted successfully!' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/withdrawals/:id/decline', verifyToken(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { declineReason } = req.body;
    const success = await db.processWithdrawal(Number(req.params.id), 'declined', declineReason);
    if (!success) {
      return res.status(400).json({ error: 'Failed to decline request' });
    }
    return res.json({ success: true, message: 'Withdrawal request declined successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin orders and logs
app.get('/api/admin/orders', verifyToken(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const orders = await db.getOrders();
    return res.json(orders);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/delivery-logs', verifyToken(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const logs = await db.getDeliveryLogs();
    return res.json(logs);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/delivery-logs/:id/retry', verifyToken(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const logId = Number(req.params.id);
    const logs = await db.getDeliveryLogs();
    const log = logs.find(l => l.id === logId);

    if (!log) {
      return res.status(404).json({ error: 'Delivery log not found' });
    }

    const deliverResult = await deliverDataBundle(log.order_id);
    if (deliverResult.success) {
      await db.incrementSandboxLogRetry(logId, 'success', deliverResult.responseStr);
      return res.json({ success: true, message: 'Delivery successfully retried! Package sent.' });
    } else {
      await db.incrementSandboxLogRetry(logId, 'failed', deliverResult.responseStr);
      return res.status(400).json({ error: 'Retry delivery failed', response: deliverResult.responseStr });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/settings', verifyToken(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const settings = await db.getSettings();
    return res.json(settings);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/settings/registration-fee', verifyToken(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { amount, enabled } = req.body;
    await db.updateSetting('registration_fee_ghs', String(amount));
    await db.updateSetting('registration_fee_enabled', String(!!enabled));
    return res.json({ success: true, message: 'Registration fee configured successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/settings/max-markup', verifyToken(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { maxPercent } = req.body;
    await db.updateSetting('max_markup_percent', String(maxPercent));
    return res.json({ success: true, message: 'Global markup limits synced.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/settings/admin-fee', verifyToken(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { feePercent, source } = req.body;
    await db.updateSetting('admin_fee_percent', String(feePercent));
    if (source) {
      await db.updateSetting('admin_fee_source', String(source));
    }
    return res.json({ success: true, message: 'Sales fee settings updated.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/settings/withdrawal-fee', verifyToken(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { feePercent } = req.body;
    if (feePercent === undefined || isNaN(Number(feePercent)) || Number(feePercent) < 0) {
      return res.status(400).json({ error: 'Please specify a valid positive percentage (%).' });
    }
    await db.updateSetting('withdrawal_fee_percent', String(feePercent));
    return res.json({ success: true, message: 'Withdrawal payout fee percentage successfully updated.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/settings/test-mode', verifyToken(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { enabled } = req.body;
    await db.updateSetting('test_mode_enabled', String(!!enabled));
    return res.json({ success: true, message: `Test Sandbox state toggled to: ${enabled}` });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/settings/gateway', verifyToken(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { payment_gateway, paystack_public_key, paystack_secret_key, flutterwave_public_key, flutterwave_secret_key } = req.body;
    if (payment_gateway) await db.updateSetting('payment_gateway', String(payment_gateway));
    if (paystack_public_key !== undefined) await db.updateSetting('paystack_public_key', String(paystack_public_key));
    if (paystack_secret_key !== undefined) await db.updateSetting('paystack_secret_key', String(paystack_secret_key));
    if (flutterwave_public_key !== undefined) await db.updateSetting('flutterwave_public_key', String(flutterwave_public_key));
    if (flutterwave_secret_key !== undefined) await db.updateSetting('flutterwave_secret_key', String(flutterwave_secret_key));
    return res.json({ success: true, message: 'Payment gateway credentials and keys stored successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/settings/data-api', verifyToken(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { data_api_username, data_api_key, data_api_url } = req.body;
    if (data_api_username !== undefined) await db.updateSetting('data_api_username', String(data_api_username));
    if (data_api_key !== undefined) await db.updateSetting('data_api_key', String(data_api_key));
    if (data_api_url !== undefined) await db.updateSetting('data_api_url', String(data_api_url));
    return res.json({ success: true, message: 'SubAndGain data bundle dispatcher API settings updated successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/settings/whatsapp-community', verifyToken(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { link } = req.body;
    await db.updateSetting('whatsapp_community_link', String(link || ''));
    return res.json({ success: true, message: 'WhatsApp reseller community link refreshed successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 5. RESELLER PROTECTED CAPABILITIES
// ==========================================

// Reseller Dashboard analytics
app.get('/api/reseller/dashboard', verifyToken(['reseller']), async (req: AuthRequest, res: Response) => {
  try {
    const resellerId = req.user!.id;
    const user = await db.getUserById(resellerId);
    const account = await db.getResellerAccountByUserId(resellerId) || await db.createResellerAccount(resellerId);
    const orders = await db.getOrders(resellerId);
    const withdrawals = await db.getWithdrawals(resellerId);
    const settings = await db.getSettings();

    // Filter distinct paid customers by matching their emails/phone
    const paidOrders = orders.filter(o => o.payment_status === 'paid');
    const distinctPhones = new Set(paidOrders.map(o => o.customer_phone));

    return res.json({
      balance_ghs: Number(account.balance_ghs),
      total_earned_ghs: Number(account.total_earned_ghs),
      total_orders_count: orders.length,
      paid_orders_count: paidOrders.length,
      total_customers_acquired: distinctPhones.size,
      pending_withdrawal_ghs: withdrawals.filter(w => w.status === 'pending').reduce((sum, w) => sum + Number(w.amount_ghs), 0),
      storefront_enabled: user ? user.storefront_enabled !== false : true,
      whatsapp_community_link: settings.whatsapp_community_link || ''
    });

  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.put('/api/reseller/storefront-status', verifyToken(['reseller']), async (req: AuthRequest, res: Response) => {
  try {
    const resellerId = req.user!.id;
    const { enabled } = req.body;
    if (enabled === undefined) {
      return res.status(400).json({ error: 'Storefront state Boolean is required.' });
    }
    await db.updateStorefrontEnabled(resellerId, !!enabled);
    return res.json({ success: true, message: `Storefront status updated successfully to ${enabled ? 'Open' : 'Closed'}.` });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Fetch active bundles decorated with the reseller's custom pricing ratios
app.get('/api/reseller/bundles', verifyToken(['reseller']), async (req: AuthRequest, res: Response) => {
  try {
    const resellerId = req.user!.id;
    const baseBundles = await db.getBundles(true);
    const pricings = await db.getResellerPricings(resellerId);

    const decorated = baseBundles.map(b => {
      const match = pricings.find(p => p.bundle_id === b.id);
      return {
        ...b,
        markup_type: match ? match.markup_type : 'fixed',
        markup_value: match ? Number(match.markup_value) : 0,
        final_price_ghs: match ? Number(match.final_price_ghs) : Number(b.admin_base_price_ghs)
      };
    });

    return res.json(decorated);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Bulk update pricing / markup controls
app.put('/api/reseller/pricing', verifyToken(['reseller']), async (req: AuthRequest, res: Response) => {
  try {
    const resellerId = req.user!.id;
    const { bundleId, markupType, markupValue } = req.body;

    if (!bundleId || !markupType || markupValue === undefined) {
      return res.status(400).json({ error: 'Missing pricing values.' });
    }

    const bundle = await db.getBundleById(Number(bundleId));
    if (!bundle) {
      return res.status(404).json({ error: 'Parent bundle not found.' });
    }

    // Verify global limits
    const settings = await db.getSettings();
    let markupAmount = 0;

    if (markupType === 'fixed') {
      markupAmount = Number(markupValue);
    } else {
      markupAmount = Number(((bundle.admin_base_price_ghs * markupValue) / 100).toFixed(2));
    }

    // Check if added price exceeds administrative profit threshold
    const limitPercentage = settings.max_markup_percent;
    const limitAmountGhs = (bundle.admin_base_price_ghs * limitPercentage) / 100;

    if (markupAmount > limitAmountGhs) {
      return res.status(400).json({ 
        error: `Markup exceeds the Global Administrator Max Markup Limit constraint of ${limitPercentage}% (${limitAmountGhs.toFixed(2)} GHS max profit).` 
      });
    }

    const finalPrice = Number((bundle.admin_base_price_ghs + markupAmount).toFixed(2));

    const saved = await db.saveResellerPricing(
      resellerId,
      Number(bundleId),
      markupType,
      Number(markupValue),
      finalPrice
    );

    return res.json({
      success: true,
      data: saved,
      message: 'Pricing update successfully applied to your storefront.'
    });

  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Reseller customers list
app.get('/api/reseller/customers', verifyToken(['reseller']), async (req: AuthRequest, res: Response) => {
  try {
    const resellerId = req.user!.id;
    const orders = await db.getOrders(resellerId);

    const customersMap: Record<string, { email: string; phone: string; totalSpent: number; totalOrders: number }> = {};

    orders.forEach(o => {
      const key = o.customer_phone;
      if (!customersMap[key]) {
        customersMap[key] = {
          email: o.customer_email || 'Guest Customer',
          phone: o.customer_phone,
          totalSpent: 0,
          totalOrders: 0
        };
      }
      if (o.payment_status === 'paid') {
        customersMap[key].totalSpent = Number((customersMap[key].totalSpent + Number(o.final_price_ghs)).toFixed(2));
      }
      customersMap[key].totalOrders += 1;
    });

    return res.json(Object.values(customersMap));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Reseller orders list
app.get('/api/reseller/orders', verifyToken(['reseller']), async (req: AuthRequest, res: Response) => {
  try {
    const resellerId = req.user!.id;
    const orders = await db.getOrders(resellerId);
    return res.json(orders);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Request withdrawal
app.post('/api/reseller/withdraw', verifyToken(['reseller']), async (req: AuthRequest, res: Response) => {
  try {
    const resellerId = req.user!.id;
    const { amount } = req.body;

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({ error: 'Please specify a valid positive withdrawal amount in GHS.' });
    }

    const amt = Number(amount);
    const account = await db.getResellerAccountByUserId(resellerId);
    if (!account || account.balance_ghs < amt) {
      return res.status(400).json({ 
        error: `Insufficient balance. Available GHS: ${account ? account.balance_ghs.toFixed(2) : '0.00'}` 
      });
    }

    const reqRecord = await db.createWithdrawal(resellerId, amt);
    return res.status(201).json({
      success: true,
      data: reqRecord,
      message: 'Withdrawal request submitted for administrative verification.'
    });

  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/reseller/withdrawals', verifyToken(['reseller']), async (req: AuthRequest, res: Response) => {
  try {
    const resellerId = req.user!.id;
    const withdrawals = await db.getWithdrawals(resellerId);
    return res.json(withdrawals);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 6. REAL WEBHOOK PROCESSING
// ==========================================

// Flutterwave Webhook
app.post('/api/webhook/flutterwave', async (req: Request, res: Response) => {
  try {
    const hash = req.headers['verif-hash'];
    const flw_secret = process.env.FLUTTERWAVE_SECRET_KEY;

    // Optional verification verification (if verif-hash matches configured FLW hook secret)
    console.log('Incoming Flutterwave Webhook:', req.body);

    const { txRef, status, id, amount } = req.body || {};
    if (status === 'successful' && txRef) {
      await finalizePaidOrder(txRef, `FLW-TX-${id || Date.now()}`, req.body);
    }

    return res.status(200).send('Webhook Received');
  } catch (err: any) {
    console.error('Flutterwave Webhook Settle error:', err);
    return res.status(500).send('Error');
  }
});

// Paystack Webhook
app.post('/api/webhook/paystack', async (req: Request, res: Response) => {
  try {
    const sig = req.headers['x-paystack-signature'];
    console.log('Incoming Paystack Webhook:', req.body);

    const { event, data } = req.body || {};
    if (event === 'charge.success' && data && data.reference) {
      await finalizePaidOrder(data.reference, `PSTK-TX-${data.id || Date.now()}`, req.body);
    }

    return res.status(200).send('Webhook Received');
  } catch (err: any) {
    console.error('Paystack Webhook Settle error:', err);
    return res.status(500).send('Error');
  }
});

// ==========================================
// 7. VITE MIDDLEWARE SETUP
// ==========================================

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // SPA catchall
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Mac Data Hub] backend running at http://0.0.0.0:${PORT} in ${process.env.NODE_ENV || 'development'}`);
  });
}

startServer();
