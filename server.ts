import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from "@google/genai";

dotenv.config();

import { initDb, db } from './server/db';
import { deliverDataBundle, finalizePaidOrder } from './server/payment-delivery';
import { sendRealSms, sendRealEmail } from './server/notification';

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'mac-data-hub-sec-key-1337-ghana';

// Lazy initializer for Gemini client to prevent crashing on boot if no API Key is present.
let aiClient: any = null;
function getGeminiClient() {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY environment variable is missing.');
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

const isVideoMedia = (src: string): boolean => {
  if (!src) return false;
  const lowercase = src.toLowerCase();
  return src.startsWith('data:video/') || 
         lowercase.endsWith('.mp4') || 
         lowercase.endsWith('.webm') || 
         lowercase.endsWith('.ogg') ||
         lowercase.includes('video');
};

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

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

      // Auto-reconcile pending_payment reseller status to pending_approval if registration fee is disabled or set to 0
      if (u.role === 'reseller' && u.status === 'pending_payment') {
        const settings = await db.getSettings();
        const isFeeEnabled = settings.registration_fee_enabled === true || String(settings.registration_fee_enabled) === 'true';
        const regFeeAmount = Number(settings.registration_fee_ghs) || 0;
        if (!isFeeEnabled || regFeeAmount <= 0) {
          await db.updateUserStatus(u.id, 'pending_approval');
          u.status = 'pending_approval';
        }
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

app.post('/api/support/chat', async (req: Request, res: Response) => {
  try {
    const { message, history, isResellerStorefront, storeName, userRole } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const ai = getGeminiClient();
    const settings = await db.getSettings();
    const customRestrictions = settings.online_support_restrictions 
      ? `\n\n5. CUSTOM ADMIN-DEFINED SAFETY RESTRICTIONS (Statically Enforced):\n   - ${settings.online_support_restrictions}` 
      : '';

    const systemInstruction = `You are the automated Online Support desk assistant for "Mac Data Hub" (a premium telecom VTU data bundle platform in Ghana).
Your job is to answer visitor or user questions ABOUT THE SITE, services, prices, networks, manual/automated orders, bulk delivery, or features.

=== CRITICAL BOUNDARY & SECURITY DIRECTIVES ===

1. STRICTLY REJECT UNRELATED QUESTIONS:
   - You are programmed ONLY to answer questions directly related to Mac Data Hub, reseller storefronts, Ghanaian data packages (MTN, Telecel, AirtelTigo), custom margins, and order fulfillment.
   - If a customer asks questions unrelated to the website, its services, or its systems (e.g., general knowledge, recipes, general coding, sports, weather, math equations, or trivia), you MUST politely refuse to answer. Explain that you are only authorized to assist with inquiries about Mac Data Hub.
   - Example Redirection: "I am only programmed to assist with inquiries about Mac Data Hub services, data bundles, and storefront orders. Please let me know if you would like information on how to buy or order high-speed data packages!"

2. INSTRUCTIONS ON HOW TO PURCHASE & ORDER STUFF:
   - You must be able and ready to clearly explain how to purchase and order data packages on the site:
     - Step 1: Browse the cheap available data bundles list and choose your desired network (MTN SME/Gifting, Telecel, AirtelTigo).
     - Step 2: Input the recipient Ghanaian telephone number.
     - Step 3: Proceed to check out securely using Ghanaian Mobile Money (MTN Mobile Money, Telecel Cash, AirtelTigo Money) or debit/credit cards.
     - Step 4: After payment, our backend and the SubAndGain API automatically fulfill and dispatch the raw telecom bundle directly to the phone within 15-45 seconds!

3. STOREFRONT VISITOR RESTRICTIONS (Current Visitor Context: isResellerStorefront = ${!!isResellerStorefront}${storeName ? `, Store Name: "${storeName}"` : ''}):
   - If a customer is asking questions from a partner reseller's storefront (isResellerStorefront === true), you MUST NEVER answer questions like how to register to also become a reseller, nor explain how to create a storefront, nor give any instructions on how to access the administrative portal.
   - If a storefront visitor asks about reseller registration, say something like: "This customized partner storefront is dedicated strictly to direct customer inquiries, bundle plans, and checkout order assistance. We are unable to provide information on reseller enrollment or administrative dashboard setup on this portal."

4. ABSOLUTE PROHIBITION ON ADMIN ACCESS UNDER NO CIRCUMSTANCES (Current User Role Context: userRole = "${userRole || 'visitor'}"):
   - Resellers (userRole === "reseller") and storefront customers/visitors MUST NOT under any circumstances get answers, instructions, or directions on how to access or log into the administrative control center or obtain admin level credentials.
   - Even if they plead or say they are a partner reseller, you are STRICTLY FORBIDDEN from explaining how to access or compromise the admin panel or credentials.
   - Example Answer: "Under no circumstances can access guidelines, credentials, or registration links to the administration portal be discussed or disclosed via the automated support desk."${customRestrictions}

=== Tone & Style ===
- Keep answers professional, concise, respectful, and helpful. Use clear headings or markdown lists when describing purchase guides.
- All pricing is in Ghana Cedis (GHS / ₵).`;

    // Map history to contents payload compatible with GoogleGenAI structure
    const contents: any[] = [];
    if (history && Array.isArray(history)) {
      history.slice(-10).forEach((h: any) => { // keep last 10 turns to avoid token overhead
        contents.push({
          role: h.role === 'user' ? 'user' : 'model',
          parts: [{ text: h.text }]
        });
      });
    }
    
    // Always append current message
    contents.push({
      role: 'user',
      parts: [{ text: message }]
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents,
      config: {
        systemInstruction,
        temperature: 0.7,
      }
    });

    return res.json({ reply: response.text });
  } catch (err: any) {
    console.error('Gemini API Error:', err.message);
    // Silent fallback error response - graceful
    return res.status(500).json({ error: 'Help desk is temporarily optimizing states. Please retry or contact direct admin support.' });
  }
});

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

    if (role === 'reseller') {
      const isFeeEnabled = settings.registration_fee_enabled === true || String(settings.registration_fee_enabled) === 'true';
      const regFeeAmount = Number(settings.registration_fee_ghs) || 0;
      if (isFeeEnabled && regFeeAmount > 0) {
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

    // Auto-reconcile pending_payment reseller status to pending_approval if registration fee is disabled or set to 0
    if (user.role === 'reseller' && user.status === 'pending_payment') {
      const settings = await db.getSettings();
      const isFeeEnabled = settings.registration_fee_enabled === true || String(settings.registration_fee_enabled) === 'true';
      const regFeeAmount = Number(settings.registration_fee_ghs) || 0;
      if (!isFeeEnabled || regFeeAmount <= 0) {
        await db.updateUserStatus(user.id, 'pending_approval');
        user.status = 'pending_approval';
      }
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
      fee_ghs: settings.registration_fee_ghs,
      site_name: settings.site_name || 'Mac Data Hub',
      site_color: settings.site_color || 'amber',
      global_font_style: settings.global_font_style || 'Outfit',
      global_font_size: settings.global_font_size || '16px',
      global_text_color_primary: settings.global_text_color_primary || '',
      global_text_color_body: settings.global_text_color_body || '',
      global_text_color_muted: settings.global_text_color_muted || '',
      global_text_color_accent: settings.global_text_color_accent || '',
      site_bg_color: settings.site_bg_color || '',
      site_bg_image: settings.site_bg_image ? `/api/settings/bg-image?h=${settings.site_bg_image.length}${isVideoMedia(settings.site_bg_image) ? '&type=video' : ''}` : '',
      whatsapp_community_link: settings.whatsapp_community_link || '',
      whatsapp_channel_link: settings.whatsapp_channel_link || '',
      online_support_enabled: settings.online_support_enabled !== false,
      online_support_restrictions: settings.online_support_restrictions || '',
      reviews_popup_enabled: settings.reviews_popup_enabled !== false,
      reviews_display_duration: settings.reviews_display_duration,
      reviews_interval: settings.reviews_interval,
      tax: {
        enabled: settings.customer_tax_enabled,
        percent: settings.customer_tax_percent,
        flatGhs: settings.customer_tax_flat_ghs
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Stream background image or video separately to prevent freezing during settings load
app.get('/api/settings/bg-image', async (req: Request, res: Response) => {
  try {
    const settings = await db.getSettings();
    const bg = settings.site_bg_image;
    if (!bg) {
      return res.status(404).send('No background asset configured');
    }

    if (bg.startsWith('data:')) {
      const match = bg.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        const contentType = match[1];
        const base64Data = match[2];
        const buffer = Buffer.from(base64Data, 'base64');
        
        // Cache the response for 1 year (31536000 seconds) in the browser
        res.set({
          'Content-Type': contentType,
          'Content-Length': buffer.length,
          'Cache-Control': 'public, max-age=31536000, immutable'
        });
        return res.send(buffer);
      }
    } else if (bg.startsWith('http')) {
      return res.redirect(bg);
    }

    return res.status(404).send('Invalid background configuration');
  } catch (err: any) {
    return res.status(500).send(err.message);
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

    const settings = await db.getSettings();
    const storefrontReviews = await db.getReviews(reseller.id);

     return res.json({
      reseller: {
        id: reseller.id,
        store_name: reseller.store_name,
        store_slug: reseller.store_slug,
        phone: reseller.phone,
        email: reseller.email,
        storefront_enabled: reseller.storefront_enabled !== false
      },
      bundles: storefrontBundles,
      reviews: storefrontReviews,
      site_bg_color: settings.site_bg_color || '',
      site_bg_image: settings.site_bg_image ? `/api/settings/bg-image?h=${settings.site_bg_image.length}${isVideoMedia(settings.site_bg_image) ? '&type=video' : ''}` : '',
      whatsapp_community_link: settings.whatsapp_community_link || '',
      whatsapp_channel_link: settings.whatsapp_channel_link || '',
      online_support_enabled: settings.online_support_enabled !== false,
      online_support_restrictions: settings.online_support_restrictions || '',
      reviews_popup_enabled: settings.reviews_popup_enabled !== false,
      reviews_display_duration: settings.reviews_display_duration,
      reviews_interval: settings.reviews_interval,
      tax: {
        enabled: settings.customer_tax_enabled,
        percent: settings.customer_tax_percent,
        flatGhs: settings.customer_tax_flat_ghs
      }
    });

  } catch (err: any) {
    console.error('Storefront Fetch Error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Create a review for a storefront
app.post('/api/store/:resellerId/reviews', async (req: Request, res: Response) => {
  try {
    const resellerId = Number(req.params.resellerId);
    const { author_name, rating, comment } = req.body;

    if (!author_name || !author_name.trim()) {
      return res.status(400).json({ error: 'Your name is required.' });
    }
    if (!rating || isNaN(Number(rating)) || Number(rating) < 1 || Number(rating) > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5 stars.' });
    }
    if (!comment || !comment.trim()) {
      return res.status(400).json({ error: 'Review comment is required.' });
    }

    const review = await db.createReview({
      reseller_id: resellerId,
      author_name: author_name.trim(),
      rating: Number(rating),
      comment: comment.trim()
    });

    return res.json({ success: true, message: 'Thank you! Your 5-star rating & review was logged successfully.', review });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Fetch reviews for logged in reseller
app.get('/api/reseller/reviews', verifyToken(['reseller']), async (req: AuthRequest, res: Response) => {
  try {
    const resellerId = req.user!.id;
    const reviews = await db.getReviews(resellerId);
    return res.json(reviews);
  } catch (err: any) {
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

    // Calculate customer storefront tax/transaction fee if configured dynamically
    let customerTaxFee = 0;
    if (settings.customer_tax_enabled) {
      const percentageTaxOnBundlePrice = settings.customer_tax_percent > 0 
        ? Number(((finalCustomerPrice * settings.customer_tax_percent) / 100).toFixed(2)) 
        : 0;
      const flatTaxOnBundlePrice = Number(settings.customer_tax_flat_ghs || 0);
      customerTaxFee = Number((percentageTaxOnBundlePrice + flatTaxOnBundlePrice).toFixed(2));
    }

    const finalAmountToCharge = Number((finalCustomerPrice + customerTaxFee).toFixed(2));

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
      tax_fee_ghs: customerTaxFee,
      delivery_status: 'pending',
      payment_status: 'pending'
    });

    return res.json({
      checkout_needed: true,
      order_id: newOrder.id,
      reference: uniqueRef,
      amount: finalAmountToCharge,
      tax_fee_ghs: customerTaxFee,
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

    // last 7 days calculations
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      // Calculate date in current context
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const keyStr = d.toISOString().split('T')[0];
      last7Days.push({ label: dateStr, key: keyStr, revenue: 0, admin_fees: 0, orders: 0 });
    }

    paidOrders.forEach(o => {
      if (!o.created_at) return;
      const orderDate = new Date(o.created_at);
      const dateKey = orderDate.toISOString().split('T')[0];
      const match = last7Days.find(day => day.key === dateKey);
      if (match) {
        match.revenue = Number((match.revenue + Number(o.final_price_ghs || 0)).toFixed(2));
        match.admin_fees = Number((match.admin_fees + Number(o.admin_fee_ghs || 0)).toFixed(2));
        match.orders += 1;
      }
    });

    const forfeitedProfit = settings.admin_forfeited_reseller_profit !== undefined ? Number(settings.admin_forfeited_reseller_profit) : 0;
    const vtuBalance = settings.vtu_provider_balance !== undefined ? Number(settings.vtu_provider_balance) : 124.50;

    const analytics = {
      total_resellers: resellers.length,
      total_customers: customers.length,
      total_orders: orders.length,
      total_revenue_ghs: totalOrderRevenue + paidRegistrations + forfeitedProfit,
      total_admin_fees_earned_ghs: totalAdminFees + forfeitedProfit,
      total_forfeited_reseller_profit_ghs: forfeitedProfit,
      total_registrations_earned_ghs: paidRegistrations,
      pending_withdrawals: withdrawals.filter(w => w.status === 'pending').length,
      withdrawal_payouts_ghs: withdrawals.filter(w => w.status === 'approved').reduce((sum, w) => sum + Number(w.amount_ghs), 0),
      vtu_provider_balance_ghs: vtuBalance,
      daily_revenue_trends: last7Days
    };

    return res.json(analytics);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin Top Up VTU API balance (simulated)
app.post('/api/admin/subandgain/topup', verifyToken(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { amount } = req.body;
    if (!amount || Number(amount) <= 0 || isNaN(Number(amount))) {
      return res.status(400).json({ error: 'Please enter a valid positive top up amount.' });
    }
    const settings = await db.getSettings();
    const current = settings.vtu_provider_balance !== undefined ? Number(settings.vtu_provider_balance) : 124.50;
    const updated = Number((current + Number(amount)).toFixed(2));
    await db.updateSetting('vtu_provider_balance', String(updated));
    return res.json({ 
      success: true, 
      message: `Successfully topped up SubAndGain VTU developer wallet by GHS ${Number(amount).toFixed(2)}. New balance is GHS ${updated.toFixed(2)}.`, 
      new_balance: updated 
    });
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

app.post('/api/admin/bundles/reset', verifyToken(['admin']), async (req: AuthRequest, res: Response) => {
  if (!req.user || req.user.email.toLowerCase() !== 'aaronbinka173@gmail.com') {
    return res.status(403).json({ error: 'Only the platform owner (aaronbinka173@gmail.com) is authorized to reset the data packages.' });
  }
  try {
    const defaultBundles = [
      { name: 'MTN 1.5GB Data', network: 'MTN', data_amount: '1.5GB', validity_days: 30, admin_base_price_ghs: 10.00, provider_plan_code: 'mtn-1.5gb', status: 'active' },
      { name: 'MTN 5GB Mega', network: 'MTN', data_amount: '5GB', validity_days: 30, admin_base_price_ghs: 30.00, provider_plan_code: 'mtn-5gb', status: 'active' },
      { name: 'Telecel 2GB Flat', network: 'Vodafone', data_amount: '2GB', validity_days: 30, admin_base_price_ghs: 12.00, provider_plan_code: 'voda-2gb', status: 'active' },
      { name: 'AirtelTigo 3GB Super', network: 'AirtelTigo', data_amount: '3GB', validity_days: 30, admin_base_price_ghs: 11.00, provider_plan_code: 'tigo-3gb', status: 'active' },
    ];

    // Wipe existing bundles
    const currentBundles = await db.getBundles();
    for (const b of currentBundles) {
      await db.deleteBundle(b.id);
    }

    // Insert default list
    for (const b of defaultBundles) {
      await db.createBundle(b);
    }

    return res.json({ success: true, message: 'Data packages successfully reset to defaults.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin Database Backup & Restore Endpoints
app.get('/api/admin/db-export', verifyToken(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const backup = await db.exportDatabase();
    res.setHeader('Content-disposition', 'attachment; filename=machub_database_backup.json');
    res.setHeader('Content-type', 'application/json');
    return res.send(JSON.stringify(backup, null, 2));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/db-import', verifyToken(['admin']), express.json({ limit: '50mb' }), async (req: AuthRequest, res: Response) => {
  try {
    const payload = req.body;
    const ok = await db.importDatabase(payload);
    if (!ok) {
      return res.status(400).json({ error: 'Failed to import backup. Please make sure the JSON format contains mandatory arrays like users, bundles and orders.' });
    }
    return res.json({ success: true, message: 'Database was successfully restored from backup.' });
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

    // Auto-promote any customer account to reseller upon approval
    if (targetUser.role === 'customer') {
      await db.updateUserRole(rId, 'reseller');
      if (!targetUser.store_name || !targetUser.store_slug) {
        const emailPrefix = targetUser.email.split('@')[0].toLowerCase().replace(/[^a-z0-9-]/g, '-');
        const storeName = targetUser.store_name || `${emailPrefix.toUpperCase()} Store`.trim();
        const storeSlug = targetUser.store_slug || emailPrefix;
        await db.updateUserStoreInfo(rId, storeName, storeSlug);
      }
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


// Admin delete reseller account completely
app.delete('/api/admin/resellers/:id', verifyToken(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const userId = Number(req.params.id);
    const user = await db.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User account not found.' });
    }

    if (user.email.toLowerCase() === 'aaronbinka173@gmail.com') {
      return res.status(400).json({ error: 'The platform owner account cannot be deleted.' });
    }

    // Capture the reseller's outstanding balance, and transfer it to the admin forfeited balance setting
    const acc = await db.getResellerAccountByUserId(userId);
    const balance = acc ? Number(acc.balance_ghs || 0) : 0;

    let confiscatedMessage = "";
    if (balance > 0) {
      const settings = await db.getSettings();
      const currentForfeited = settings.admin_forfeited_reseller_profit !== undefined ? Number(settings.admin_forfeited_reseller_profit) : 0;
      const newForfeitedTotal = Number((currentForfeited + balance).toFixed(2));
      await db.updateSetting('admin_forfeited_reseller_profit', String(newForfeitedTotal));
      confiscatedMessage = ` Their outstanding balance of ₵${balance.toFixed(2)} GHS has been confiscated and credited to your Administrative Momo profit claims balance successfully!`;
    }

    await db.deleteUser(userId);
    return res.json({
      success: true,
      message: `The reseller account for "${user.email}" has been permanently purged.${confiscatedMessage}`
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
      
      // Dispatch real live SMS
      const smsSent = await sendRealSms(recipientPhone, message, senderId);

      // Log to database
      const log = await db.createSmsLog(
        r.user_id,
        senderId,
        message,
        smsSent ? 'Delivered' : 'Simulated'
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

// Admin outbound premium Email broadcaster to target resellers or all partners on Mac Hub
app.post('/api/admin/send-email', verifyToken(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { target, subject, message } = req.body;
    if (!subject || subject.trim().length === 0) {
      return res.status(400).json({ error: 'Email Subject line is required' });
    }
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Email Message content is required' });
    }

    let targetResellers: any[] = [];
    if (target === 'all') {
      targetResellers = await db.getResellerAccounts();
    } else {
      const uId = Number(target);
      const singleReseller = await db.getResellerAccountByUserId(uId);
      if (!singleReseller) {
        return res.status(404).json({ error: 'Target reseller account not found' });
      }
      const rawUser = await db.getUserById(uId);
      targetResellers = [{ ...singleReseller, email: rawUser?.email, phone: rawUser?.phone }];
    }

    if (targetResellers.length === 0) {
      return res.status(400).json({ error: 'No active partners/resellers registered to receive emails.' });
    }

    const sentReceipts: any[] = [];
    for (const r of targetResellers) {
      const recipientEmail = r.email || 'customer@example.com';
      const emailSent = await sendRealEmail(recipientEmail, subject, message);
      
      const log = await db.createEmailLog(
        r.user_id,
        subject,
        message,
        emailSent ? 'Delivered' : 'Simulated'
      );
      sentReceipts.push({ ...log, recipientEmail, store_name: r.store_name });
    }

    return res.json({
      success: true,
      messagePrefix: `Admin Outbound Email Broadcast successfully processed for ${targetResellers.length} partner(s). Check delivery states below (either Direct SMTP or Active Sandbox Simulation)!`,
      dispatchCount: targetResellers.length,
      logs: sentReceipts
    });
  } catch (err: any) {
    console.error('Send Reseller Email Error:', err);
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

// Admin list outbound Email logs
app.get('/api/admin/email-logs', verifyToken(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const logs = await db.getEmailLogs();
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
    const wrId = Number(req.params.id);
    const withdrawals = await db.getWithdrawals();
    const wr = withdrawals.find((w: any) => w.id === wrId);

    const success = await db.processWithdrawal(wrId, 'approved');
    if (!success) {
      return res.status(400).json({ error: 'Failed to approve withdrawal request (already processed or insufficient balance)' });
    }

    if (wr) {
      const reseller = await db.getUserById(wr.reseller_id);
      if (reseller) {
        // 1. In-app notification
        await db.createNotification({
          user_id: reseller.id,
          title: 'Withdrawal Approved',
          message: `Your withdrawal request of GHS ${Number(wr.amount_ghs).toFixed(2)} has been successfully approved and cleared.`,
          type: 'withdrawal_success'
        }).catch((e: any) => console.log('In-app skip:', e));

        // 2. SMTP Email notification
        const emailSubject = `Withdrawal Approved - Mac Data Hub`;
        const emailBody = `
          Hello ${reseller.store_name || reseller.email},

          We are pleased to notify you that your withdrawal request of GHS ${Number(wr.amount_ghs).toFixed(2)} has been approved and cleared by the platform administrators.

          Withdrawal Details:
          Amount: GHS ${Number(wr.amount_ghs).toFixed(2)}
          Status: Approved and Dispatched
          Date Code: ${new Date().toLocaleString()}

          Thank you for choosing Mac Data Hub!
          Best regards,
          Site Administration Support
        `;
        await sendRealEmail(reseller.email, emailSubject, emailBody).catch((e: any) => console.log('Mail skip:', e));
      }
    }

    return res.json({ success: true, message: 'Withdrawal approved and deducted successfully!' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/withdrawals/:id/decline', verifyToken(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const wrId = Number(req.params.id);
    const { declineReason } = req.body;
    const withdrawals = await db.getWithdrawals();
    const wr = withdrawals.find((w: any) => w.id === wrId);

    const success = await db.processWithdrawal(wrId, 'declined', declineReason);
    if (!success) {
      return res.status(400).json({ error: 'Failed to decline request' });
    }

    if (wr) {
      const reseller = await db.getUserById(wr.reseller_id);
      if (reseller) {
        // 1. In-app notification
        await db.createNotification({
          user_id: reseller.id,
          title: 'Withdrawal Request Declined',
          message: `Your withdrawal request of GHS ${Number(wr.amount_ghs).toFixed(2)} was declined. Reason specified: ${declineReason || 'No reason provided'}.`,
          type: 'withdrawal_declined'
        }).catch((e: any) => console.log('In-app skip:', e));

        // 2. SMTP Email notification
        const emailSubject = `Withdrawal Declined - Mac Data Hub`;
        const emailBody = `
          Hello ${reseller.store_name || reseller.email},

          Your withdrawal request of GHS ${Number(wr.amount_ghs).toFixed(2)} has been declined.

          Withdrawal Details:
          Amount: GHS ${Number(wr.amount_ghs).toFixed(2)}
          Status: Declined
          Reason: ${declineReason || 'No response reason entered'}
          Date Code: ${new Date().toLocaleString()}

          Please contact the platform support desk or adjust your active balance details if you feel this is in error.

          Best regards,
          Site Administration Support
        `;
        await sendRealEmail(reseller.email, emailSubject, emailBody).catch((e: any) => console.log('Mail skip:', e));
      }
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

app.post('/api/admin/withdraw', verifyToken(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { amount, details } = req.body;

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({ error: 'Please specify a valid, positive withdrawal amount in GHS.' });
    }

    if (!details || details.trim() === '') {
      return res.status(400).json({ error: 'Please provide withdrawal receiving details (e.g. MTN Mobile Money number or Bank Account details).' });
    }

    const amt = Number(amount);
    const settings = await db.getSettings();

    // Calculate gross profit balance dynamically from real orders and registrations
    const orders = await db.getOrders();
    const resellers = await db.getUsers('reseller');

    const paidOrders = orders.filter(o => o.payment_status === 'paid');
    const totalAdminFees = paidOrders.reduce((sum, o) => sum + Number(o.admin_fee_ghs || 0), 0);
    const paidRegistrations = resellers.reduce((sum, u) => sum + Number(u.registration_fee_paid_ghs || 0), 0);

    const forfeitedProfit = settings.admin_forfeited_reseller_profit !== undefined ? Number(settings.admin_forfeited_reseller_profit) : 0;
    const grossProfit = totalAdminFees + paidRegistrations + forfeitedProfit;
    const currentWithdrawn = Number(settings.admin_total_withdrawn_ghs || 0);
    const availableBalance = Number((grossProfit - currentWithdrawn).toFixed(2));

    if (amt > availableBalance) {
      return res.status(400).json({ 
        error: `Insufficient admin profit. You requested ₵${amt.toFixed(2)}, but only ₵${availableBalance.toFixed(2)} of accumulated royalties is currently available.` 
      });
    }

    // Save updated total withdrawn amount
    const newWithdrawnTotal = Number((currentWithdrawn + amt).toFixed(2));
    await db.updateSetting('admin_total_withdrawn_ghs', String(newWithdrawnTotal));

    // Save and serialize the withdrawal logs
    let logsList: any[] = [];
    try {
      logsList = JSON.parse(settings.admin_withdrawal_logs || '[]');
      if (!Array.isArray(logsList)) {
        logsList = [];
      }
    } catch {
      logsList = [];
    }

    const newLog = {
      id: "AW-" + Math.floor(100000 + Math.random() * 900000),
      amount_ghs: amt,
      details: details.trim(),
      created_at: new Date().toISOString()
    };

    logsList.unshift(newLog); // Prepend new log to show newest first
    await db.updateSetting('admin_withdrawal_logs', JSON.stringify(logsList));

    return res.status(200).json({
      success: true,
      message: 'Admin manual payout successfully processed and recorded!',
      withdrawn_amount: amt,
      new_total_withdrawn: newWithdrawnTotal,
      available_balance_left: Number((availableBalance - amt).toFixed(2))
    });

  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/settings/registration-fee', verifyToken(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { amount, enabled } = req.body;
    await db.updateSetting('registration_fee_ghs', String(amount));
    await db.updateSetting('registration_fee_enabled', String(!!enabled));

    // Auto-promote any stuck resellers with 'pending_payment' if registration fee is disabled or set to 0
    const isFeeEnabled = enabled === true || String(enabled) === 'true';
    const regFeeAmount = Number(amount) || 0;
    if (!isFeeEnabled || regFeeAmount <= 0) {
      const resellers = await db.getUsers('reseller');
      for (const r of resellers) {
        if (r.status === 'pending_payment') {
          await db.updateUserStatus(r.id, 'pending_approval');
        }
      }
    }

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

app.post('/api/admin/settings/preload-sandbox', verifyToken(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    await db.updateSetting('payment_gateway', 'paystack');
    await db.updateSetting('paystack_public_key', 'pk_test_mac_data_hub_demo_sandbox_888');
    await db.updateSetting('paystack_secret_key', 'sk_test_mac_data_hub_demo_sandbox_888');
    await db.updateSetting('flutterwave_public_key', 'FLWPUBK_test_mac_data_hub_demo_sandbox_888');
    await db.updateSetting('flutterwave_secret_key', 'FLWSECK_test_mac_data_hub_demo_sandbox_888');
    await db.updateSetting('data_api_username', 'mac_data_hub_vtu25');
    await db.updateSetting('data_api_key', 'mock_api_key_sandbox_demo');
    await db.updateSetting('data_api_url', 'https://subandgain.com/api/data.php');
    await db.updateSetting('test_mode_enabled', 'true');
    await db.updateSetting('online_support_restrictions', 'You are the virtual customer support AI for Mac Data Hub in Ghana. Help visitors choose appropriate high-speed MTN or Telecel or AT data bundles at highly subsidized reseller prices. Instruct customers to checkout with Mobile Money (Momo) instantly.');
    return res.json({ success: true, message: 'All sandbox mock credentials and active simulator parameters loaded successfully!' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/settings/reset-database', verifyToken(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const callerEmail = req.user?.email?.toLowerCase();
    if (callerEmail !== 'aaronbinka173@gmail.com') {
      return res.status(403).json({ error: 'Only the platform owner Aaron Binka can trigger a complete production level database wipe.' });
    }

    await db.resetToProduction();
    return res.json({ 
      success: true, 
      message: 'Database successfully purged and reset to active production mode! All demo values, mock purchases, sandbox logs, and test reseller balances have been erased. Test mode is now deactivated.' 
    });
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
    const { data_api_username, data_api_key, data_api_url, vtu_balance_threshold } = req.body;
    if (data_api_username !== undefined) await db.updateSetting('data_api_username', String(data_api_username));
    if (data_api_key !== undefined) await db.updateSetting('data_api_key', String(data_api_key));
    if (data_api_url !== undefined) await db.updateSetting('data_api_url', String(data_api_url));
    if (vtu_balance_threshold !== undefined) await db.updateSetting('vtu_balance_threshold', String(vtu_balance_threshold));
    return res.json({ success: true, message: 'SubAndGain data bundle dispatcher API settings updated successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/settings/notifications', verifyToken(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { 
      mnotify_api_key, 
      arkesel_api_key, 
      sms_sender_id, 
      smtp_host, 
      smtp_port, 
      smtp_user, 
      smtp_pass, 
      smtp_from, 
      smtp_from_name,
      smtp_secure
    } = req.body;

    if (mnotify_api_key !== undefined) await db.updateSetting('mnotify_api_key', String(mnotify_api_key));
    if (arkesel_api_key !== undefined) await db.updateSetting('arkesel_api_key', String(arkesel_api_key));
    if (sms_sender_id !== undefined) await db.updateSetting('sms_sender_id', String(sms_sender_id));
    if (smtp_host !== undefined) await db.updateSetting('smtp_host', String(smtp_host));
    if (smtp_port !== undefined) await db.updateSetting('smtp_port', String(smtp_port));
    if (smtp_user !== undefined) await db.updateSetting('smtp_user', String(smtp_user));
    if (smtp_pass !== undefined) await db.updateSetting('smtp_pass', String(smtp_pass));
    if (smtp_from !== undefined) await db.updateSetting('smtp_from', String(smtp_from));
    if (smtp_from_name !== undefined) await db.updateSetting('smtp_from_name', String(smtp_from_name));
    if (smtp_secure !== undefined) await db.updateSetting('smtp_secure', String(smtp_secure));

    return res.json({ success: true, message: 'All notification (Email/SMS) API credentials and Sender IDs configured successfully.' });
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

app.put('/api/admin/settings/whatsapp-channel', verifyToken(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { link } = req.body;
    await db.updateSetting('whatsapp_channel_link', String(link || ''));
    return res.json({ success: true, message: 'WhatsApp reseller channel link refreshed successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/settings/branding', verifyToken(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { site_name, site_color, site_bg_color, site_bg_image } = req.body;
    if (site_name !== undefined) await db.updateSetting('site_name', String(site_name || 'Mac Data Hub'));
    if (site_color !== undefined) await db.updateSetting('site_color', String(site_color || 'amber'));
    if (site_bg_color !== undefined) await db.updateSetting('site_bg_color', String(site_bg_color || ''));
    if (site_bg_image !== undefined) await db.updateSetting('site_bg_image', String(site_bg_image || ''));
    return res.json({ success: true, message: 'Platform branding name, theme colors, background configurations, and custom background images updated.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/settings/support', verifyToken(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { online_support_enabled, online_support_restrictions } = req.body;
    if (online_support_enabled !== undefined) {
      await db.updateSetting('online_support_enabled', String(online_support_enabled));
    }
    if (online_support_restrictions !== undefined) {
      await db.updateSetting('online_support_restrictions', String(online_support_restrictions));
    }
    return res.json({ success: true, message: 'Online live support and safety restrictions configuration updated successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/settings/reviews-popup', verifyToken(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { reviews_popup_enabled, reviews_display_duration, reviews_interval } = req.body;
    if (reviews_popup_enabled !== undefined) {
      await db.updateSetting('reviews_popup_enabled', String(reviews_popup_enabled));
    }
    if (reviews_display_duration !== undefined) {
      await db.updateSetting('reviews_display_duration', String(reviews_display_duration));
    }
    if (reviews_interval !== undefined) {
      await db.updateSetting('reviews_interval', String(reviews_interval));
    }
    return res.json({ success: true, message: '5-Star reviews popup global display settings updated successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/settings/typography', verifyToken(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { 
      global_font_style, 
      global_font_size, 
      global_text_color_primary, 
      global_text_color_body, 
      global_text_color_muted, 
      global_text_color_accent 
    } = req.body;

    if (global_font_style !== undefined) await db.updateSetting('global_font_style', String(global_font_style));
    if (global_font_size !== undefined) await db.updateSetting('global_font_size', String(global_font_size));
    if (global_text_color_primary !== undefined) await db.updateSetting('global_text_color_primary', String(global_text_color_primary));
    if (global_text_color_body !== undefined) await db.updateSetting('global_text_color_body', String(global_text_color_body));
    if (global_text_color_muted !== undefined) await db.updateSetting('global_text_color_muted', String(global_text_color_muted));
    if (global_text_color_accent !== undefined) await db.updateSetting('global_text_color_accent', String(global_text_color_accent));

    return res.json({ success: true, message: 'Platform typography, text sizes, and writing colors updated successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/settings/customer-tax', verifyToken(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { enabled, percent, flatGhs } = req.body;
    await db.updateSetting('customer_tax_enabled', String(!!enabled));
    await db.updateSetting('customer_tax_percent', String(Number(percent || 0)));
    await db.updateSetting('customer_tax_flat_ghs', String(Number(flatGhs || 0)));
    return res.json({ success: true, message: 'Storefront customer tax/transaction fee settings updated successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/subandgain/plans', verifyToken(['admin']), async (req: AuthRequest, res: Response) => {
  if (!req.user || req.user.email.toLowerCase() !== 'aaronbinka173@gmail.com') {
    return res.status(403).json({ error: 'Only the platform owner (aaronbinka173@gmail.com) is authorized to fetch or inspect data API plans.' });
  }
  try {
    const settings = await db.getSettings();
    const isMock = settings.data_api_key === 'mock_api_key' || !settings.data_api_key;

    // Predefined exact Ghanaian networks base price packages from SubAndGain/DataHustle/GigzHub rates in GHS
    const isGigzHub = settings.data_api_url && settings.data_api_url.toLowerCase().includes('gigzhub');
    const isDataHustle = settings.data_api_url && settings.data_api_url.toLowerCase().includes('datahustle');
    
    const referencePlans = isGigzHub ? [
      // MTN SME (Non-Expiry) on GigzHub
      { name: "MTN SME 500 MB (GigzHub)", network: "MTN", data_amount: "500MB", validity_days: 30, base_price_ghs: 1.95, provider_plan_code: "mtn-sme-500mb" },
      { name: "MTN SME 1.0 GB (GigzHub)", network: "MTN", data_amount: "1GB", validity_days: 30, base_price_ghs: 3.85, provider_plan_code: "mtn-sme-1gb" },
      { name: "MTN SME 2.0 GB (GigzHub)", network: "MTN", data_amount: "2GB", validity_days: 30, base_price_ghs: 7.70, provider_plan_code: "mtn-sme-2gb" },
      { name: "MTN SME 3.0 GB (GigzHub)", network: "MTN", data_amount: "3GB", validity_days: 30, base_price_ghs: 11.55, provider_plan_code: "mtn-sme-3gb" },
      { name: "MTN SME 5.0 GB (GigzHub)", network: "MTN", data_amount: "5GB", validity_days: 30, base_price_ghs: 19.25, provider_plan_code: "mtn-sme-5gb" },
      { name: "MTN SME 10.0 GB (GigzHub)", network: "MTN", data_amount: "10GB", validity_days: 30, base_price_ghs: 38.50, provider_plan_code: "mtn-sme-10gb" },
      { name: "MTN SME 20.0 GB (GigzHub)", network: "MTN", data_amount: "20GB", validity_days: 30, base_price_ghs: 77.00, provider_plan_code: "mtn-sme-20gb" },
      { name: "MTN SME 50.0 GB (GigzHub)", network: "MTN", data_amount: "50GB", validity_days: 30, base_price_ghs: 192.50, provider_plan_code: "mtn-sme-50gb" },
      { name: "MTN SME 100.0 GB (GigzHub)", network: "MTN", data_amount: "100GB", validity_days: 30, base_price_ghs: 385.00, provider_plan_code: "mtn-sme-100gb" },
      // MTN Gifting on GigzHub
      { name: "MTN Gifting 1.0 GB (GigzHub)", network: "MTN", data_amount: "1GB", validity_days: 30, base_price_ghs: 4.10, provider_plan_code: "mtn-gft-1gb" },
      { name: "MTN Gifting 2.0 GB (GigzHub)", network: "MTN", data_amount: "2GB", validity_days: 30, base_price_ghs: 8.20, provider_plan_code: "mtn-gft-2gb" },
      { name: "MTN Gifting 3.0 GB (GigzHub)", network: "MTN", data_amount: "3GB", validity_days: 30, base_price_ghs: 12.30, provider_plan_code: "mtn-gft-3gb" },
      { name: "MTN Gifting 5.0 GB (GigzHub)", network: "MTN", data_amount: "5GB", validity_days: 30, base_price_ghs: 20.50, provider_plan_code: "mtn-gft-5gb" },
      { name: "MTN Gifting 10.0 GB (GigzHub)", network: "MTN", data_amount: "10GB", validity_days: 30, base_price_ghs: 41.00, provider_plan_code: "mtn-gft-10gb" },
      // Telecel / Vodafone Ghana on GigzHub
      { name: "Telecel 1.0 GB Standard (GigzHub)", network: "Vodafone", data_amount: "1GB", validity_days: 30, base_price_ghs: 3.20, provider_plan_code: "voda-std-1gb" },
      { name: "Telecel 2.0 GB Standard (GigzHub)", network: "Vodafone", data_amount: "2GB", validity_days: 30, base_price_ghs: 6.40, provider_plan_code: "voda-std-2gb" },
      { name: "Telecel 3.0 GB Standard (GigzHub)", network: "Vodafone", data_amount: "3GB", validity_days: 30, base_price_ghs: 9.60, provider_plan_code: "voda-std-3gb" },
      { name: "Telecel 5.0 GB Standard (GigzHub)", network: "Vodafone", data_amount: "5GB", validity_days: 30, base_price_ghs: 16.00, provider_plan_code: "voda-std-5gb" },
      { name: "Telecel 10.0 GB Standard (GigzHub)", network: "Vodafone", data_amount: "10GB", validity_days: 30, base_price_ghs: 32.00, provider_plan_code: "voda-std-10gb" },
      { name: "Telecel 20.0 GB Standard (GigzHub)", network: "Vodafone", data_amount: "20GB", validity_days: 30, base_price_ghs: 64.00, provider_plan_code: "voda-std-20gb" },
      { name: "Telecel 50.0 GB Standard (GigzHub)", network: "Vodafone", data_amount: "50GB", validity_days: 30, base_price_ghs: 160.00, provider_plan_code: "voda-std-50gb" },
      { name: "Telecel 100.0 GB Standard (GigzHub)", network: "Vodafone", data_amount: "100GB", validity_days: 30, base_price_ghs: 320.00, provider_plan_code: "voda-std-100gb" },
      // AirtelTigo / AT Ghana on GigzHub
      { name: "AirtelTigo 1.0 GB Classic (GigzHub)", network: "AirtelTigo", data_amount: "1GB", validity_days: 30, base_price_ghs: 3.10, provider_plan_code: "at-classic-1gb" },
      { name: "AirtelTigo 2.0 GB Classic (GigzHub)", network: "AirtelTigo", data_amount: "2GB", validity_days: 30, base_price_ghs: 6.20, provider_plan_code: "at-classic-2gb" },
      { name: "AirtelTigo 3.0 GB Classic (GigzHub)", network: "AirtelTigo", data_amount: "3GB", validity_days: 30, base_price_ghs: 9.30, provider_plan_code: "at-classic-3gb" },
      { name: "AirtelTigo 5.0 GB Classic (GigzHub)", network: "AirtelTigo", data_amount: "5GB", validity_days: 30, base_price_ghs: 15.50, provider_plan_code: "at-classic-5gb" },
      { name: "AirtelTigo 10.0 GB Classic (GigzHub)", network: "AirtelTigo", data_amount: "10GB", validity_days: 30, base_price_ghs: 31.00, provider_plan_code: "at-classic-10gb" },
      { name: "AirtelTigo 20.0 GB Classic (GigzHub)", network: "AirtelTigo", data_amount: "20GB", validity_days: 30, base_price_ghs: 62.00, provider_plan_code: "at-classic-20gb" },
      { name: "AirtelTigo 50.0 GB Classic (GigzHub)", network: "AirtelTigo", data_amount: "50GB", validity_days: 30, base_price_ghs: 155.00, provider_plan_code: "at-classic-50gb" },
      { name: "AirtelTigo 100.0 GB Classic (GigzHub)", network: "AirtelTigo", data_amount: "100GB", validity_days: 30, base_price_ghs: 310.00, provider_plan_code: "at-classic-100gb" }
    ] : (isDataHustle ? [
      // MTN SME (Non-Expiry)
      { name: "MTN SME 500 MB (DataHustle)", network: "MTN", data_amount: "500MB", validity_days: 30, base_price_ghs: 2.10, provider_plan_code: "mtn-sme-500mb" },
      { name: "MTN SME 1.0 GB (DataHustle)", network: "MTN", data_amount: "1GB", validity_days: 30, base_price_ghs: 4.20, provider_plan_code: "mtn-sme-1gb" },
      { name: "MTN SME 2.0 GB (DataHustle)", network: "MTN", data_amount: "2GB", validity_days: 30, base_price_ghs: 8.40, provider_plan_code: "mtn-sme-2gb" },
      { name: "MTN SME 3.0 GB (DataHustle)", network: "MTN", data_amount: "3GB", validity_days: 30, base_price_ghs: 12.60, provider_plan_code: "mtn-sme-3gb" },
      { name: "MTN SME 5.0 GB (DataHustle)", network: "MTN", data_amount: "5GB", validity_days: 30, base_price_ghs: 21.00, provider_plan_code: "mtn-sme-5gb" },
      { name: "MTN SME 10.0 GB (DataHustle)", network: "MTN", data_amount: "10GB", validity_days: 30, base_price_ghs: 42.00, provider_plan_code: "mtn-sme-10gb" },
      { name: "MTN SME 20.0 GB (DataHustle)", network: "MTN", data_amount: "20GB", validity_days: 30, base_price_ghs: 84.00, provider_plan_code: "mtn-sme-20gb" },
      { name: "MTN SME 50.0 GB (DataHustle)", network: "MTN", data_amount: "50GB", validity_days: 30, base_price_ghs: 210.00, provider_plan_code: "mtn-sme-5gb" },
      { name: "MTN SME 100.0 GB (DataHustle)", network: "MTN", data_amount: "100GB", validity_days: 30, base_price_ghs: 420.00, provider_plan_code: "mtn-sme-100gb" },
      // MTN Gifting
      { name: "MTN Gifting 1.0 GB (DataHustle)", network: "MTN", data_amount: "1GB", validity_days: 30, base_price_ghs: 4.50, provider_plan_code: "mtn-gft-1gb" },
      { name: "MTN Gifting 1.5 GB (DataHustle)", network: "MTN", data_amount: "1.5GB", validity_days: 30, base_price_ghs: 9.90, provider_plan_code: "mtn-gft-1.5gb" },
      { name: "MTN Gifting 2.0 GB (DataHustle)", network: "MTN", data_amount: "2GB", validity_days: 30, base_price_ghs: 9.00, provider_plan_code: "mtn-gft-2gb" },
      { name: "MTN Gifting 3.0 GB (DataHustle)", network: "MTN", data_amount: "3GB", validity_days: 30, base_price_ghs: 18.50, provider_plan_code: "mtn-gft-3gb" },
      { name: "MTN Gifting 5.0 GB (DataHustle)", network: "MTN", data_amount: "5GB", validity_days: 30, base_price_ghs: 22.50, provider_plan_code: "mtn-gft-5gb" },
      { name: "MTN Gifting 10.0 GB (DataHustle)", network: "MTN", data_amount: "10GB", validity_days: 30, base_price_ghs: 45.00, provider_plan_code: "mtn-gft-10gb" },
      // Telecel / Vodafone Ghana
      { name: "Telecel 1.0 GB Standard (DataHustle)", network: "Vodafone", data_amount: "1GB", validity_days: 30, base_price_ghs: 3.90, provider_plan_code: "voda-std-1gb" },
      { name: "Telecel 2.0 GB Standard (DataHustle)", network: "Vodafone", data_amount: "2GB", validity_days: 30, base_price_ghs: 7.80, provider_plan_code: "voda-std-2gb" },
      { name: "Telecel 3.0 GB Standard (DataHustle)", network: "Vodafone", data_amount: "3GB", validity_days: 30, base_price_ghs: 11.70, provider_plan_code: "voda-std-3gb" },
      { name: "Telecel 5.0 GB Standard (DataHustle)", network: "Vodafone", data_amount: "5GB", validity_days: 30, base_price_ghs: 19.50, provider_plan_code: "voda-std-5gb" },
      { name: "Telecel 10.0 GB Standard (DataHustle)", network: "Vodafone", data_amount: "10GB", validity_days: 30, base_price_ghs: 39.00, provider_plan_code: "voda-std-10gb" },
      { name: "Telecel 20.0 GB Standard (DataHustle)", network: "Vodafone", data_amount: "20GB", validity_days: 30, base_price_ghs: 78.00, provider_plan_code: "voda-std-20gb" },
      { name: "Telecel 30.0 GB Standard (DataHustle)", network: "Vodafone", data_amount: "30GB", validity_days: 30, base_price_ghs: 117.00, provider_plan_code: "voda-std-30gb" },
      { name: "Telecel 50.0 GB Standard (DataHustle)", network: "Vodafone", data_amount: "50GB", validity_days: 30, base_price_ghs: 195.00, provider_plan_code: "voda-std-50gb" },
      { name: "Telecel 100.0 GB Standard (DataHustle)", network: "Vodafone", data_amount: "100GB", validity_days: 30, base_price_ghs: 390.00, provider_plan_code: "voda-std-100gb" },
      // AirtelTigo / AT Ghana
      { name: "AirtelTigo 1.0 GB Classic (DataHustle)", network: "AirtelTigo", data_amount: "1GB", validity_days: 30, base_price_ghs: 3.95, provider_plan_code: "at-classic-1gb" },
      { name: "AirtelTigo 2.0 GB Classic (DataHustle)", network: "AirtelTigo", data_amount: "2GB", validity_days: 30, base_price_ghs: 7.90, provider_plan_code: "at-classic-2gb" },
      { name: "AirtelTigo 3.0 GB Classic (DataHustle)", network: "AirtelTigo", data_amount: "3GB", validity_days: 30, base_price_ghs: 11.85, provider_plan_code: "at-classic-3gb" },
      { name: "AirtelTigo 5.0 GB Classic (DataHustle)", network: "AirtelTigo", data_amount: "5GB", validity_days: 30, base_price_ghs: 19.75, provider_plan_code: "at-classic-5gb" },
      { name: "AirtelTigo 10.0 GB Classic (DataHustle)", network: "AirtelTigo", data_amount: "10GB", validity_days: 30, base_price_ghs: 39.50, provider_plan_code: "at-classic-10gb" },
      { name: "AirtelTigo 20.0 GB Classic (DataHustle)", network: "AirtelTigo", data_amount: "20GB", validity_days: 30, base_price_ghs: 79.00, provider_plan_code: "at-classic-20gb" },
      { name: "AirtelTigo 50.0 GB Classic (DataHustle)", network: "AirtelTigo", data_amount: "50GB", validity_days: 30, base_price_ghs: 197.50, provider_plan_code: "at-classic-50gb" },
      { name: "AirtelTigo 100.0 GB Classic (DataHustle)", network: "AirtelTigo", data_amount: "100GB", validity_days: 30, base_price_ghs: 395.00, provider_plan_code: "at-classic-100gb" }
    ] : [
      { name: "MTN SME 1.0 GB", network: "MTN", data_amount: "1GB", validity_days: 30, base_price_ghs: 6.00, provider_plan_code: "mtn-sme-1gb" },
      { name: "MTN SME 2.0 GB", network: "MTN", data_amount: "2GB", validity_days: 30, base_price_ghs: 11.50, provider_plan_code: "mtn-sme-2gb" },
      { name: "MTN SME 5.0 GB", network: "MTN", data_amount: "5GB", validity_days: 30, base_price_ghs: 28.00, provider_plan_code: "mtn-sme-5gb" },
      { name: "MTN SME 10.0 GB", network: "MTN", data_amount: "10GB", validity_days: 30, base_price_ghs: 55.00, provider_plan_code: "mtn-sme-10gb" },
      { name: "MTN SME 20.0 GB", network: "MTN", data_amount: "20GB", validity_days: 30, base_price_ghs: 105.00, provider_plan_code: "mtn-sme-20gb" },
      { name: "MTN Gifting 1.5 GB", network: "MTN", data_amount: "1.5GB", validity_days: 30, base_price_ghs: 11.00, provider_plan_code: "mtn-gft-1.5gb" },
      { name: "MTN Gifting 3.0 GB", network: "MTN", data_amount: "3GB", validity_days: 30, base_price_ghs: 21.00, provider_plan_code: "mtn-gft-3gb" },
      { name: "Telecel 1.0 GB Standard", network: "Vodafone", data_amount: "1GB", validity_days: 30, base_price_ghs: 7.00, provider_plan_code: "voda-std-1gb" },
      { name: "Telecel 2.0 GB Standard", network: "Vodafone", data_amount: "2GB", validity_days: 30, base_price_ghs: 13.00, provider_plan_code: "voda-std-2gb" },
      { name: "Telecel 5.0 GB Standard", network: "Vodafone", data_amount: "5GB", validity_days: 30, base_price_ghs: 31.00, provider_plan_code: "voda-std-5gb" },
      { name: "AirtelTigo 1.0 GB Classic", network: "AirtelTigo", data_amount: "1GB", validity_days: 30, base_price_ghs: 5.50, provider_plan_code: "at-classic-1gb" },
      { name: "AirtelTigo 2.5 GB Classic", network: "AirtelTigo", data_amount: "2.5GB", validity_days: 30, base_price_ghs: 12.50, provider_plan_code: "at-classic-2.5gb" },
      { name: "AirtelTigo 6.0 GB Classic", network: "AirtelTigo", data_amount: "6GB", validity_days: 30, base_price_ghs: 27.00, provider_plan_code: "at-classic-6gb" }
    ]);

    if (isMock) {
      return res.json({ provider: 'subandgain-simulated', plans: referencePlans });
    }

    try {
      let rawUrl = settings.data_api_url || 'https://subandgain.com/api/data.php';
      if (rawUrl && !rawUrl.endsWith('.php') && !rawUrl.includes('/api/')) {
        const base = rawUrl.endsWith('/') ? rawUrl.slice(0, -1) : rawUrl;
        rawUrl = `${base}/api/data.php`;
      }
      const apiUrl = `${rawUrl}?username=${encodeURIComponent(settings.data_api_username || '')}&apiKey=${encodeURIComponent(settings.data_api_key || '')}&query=plans`;
      
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 6000);
      const resp = await fetch(apiUrl, { signal: controller.signal });
      clearTimeout(id);

      if (resp.ok) {
        const text = await resp.text();
        if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html') || text.trim().startsWith('<div')) {
          console.log(`SubAndGain live plans fetch returned HTML response from ${rawUrl}. Please make sure you have mapped the correct VTU API endpoint in settings.`);
        } else {
          try {
            const json = JSON.parse(text);
            if (json && (Array.isArray(json) || json.plans || json.data)) {
              const liveList = Array.isArray(json) ? json : (json.plans || json.data || []);
              const mapped = liveList.map((item: any) => ({
                name: item.name || `${item.network} ${item.size || item.plan_size}`,
                network: item.network || 'MTN',
                data_amount: item.size || item.plan_size || '1GB',
                validity_days: Number(item.validity) || 30,
                base_price_ghs: Number(item.price || item.cost || 10),
                provider_plan_code: String(item.code || item.plan_id || item.plan_code)
              }));
              return res.json({ provider: 'subandgain-live', plans: mapped });
            }
          } catch (parseErr) {
            console.log('SubAndGain live plans response parsing failed (expected JSON but received raw response):', text.slice(0, 100));
          }
        }
      } else {
        console.log(`SubAndGain live plans fetch returned HTTP status ${resp.status}`);
      }
    } catch (fetchErr) {
      console.log('SubAndGain live plans fetch bypassed (using fallback lists):', fetchErr);
    }

    return res.json({ provider: 'subandgain-preset', plans: referencePlans });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/subandgain/import', verifyToken(['admin']), async (req: AuthRequest, res: Response) => {
  if (!req.user || req.user.email.toLowerCase() !== 'aaronbinka173@gmail.com') {
    return res.status(403).json({ error: 'Only the platform owner (aaronbinka173@gmail.com) is authorized to reset or synchronize data packages.' });
  }
  try {
    const { plans } = req.body;
    if (!Array.isArray(plans)) {
      return res.status(400).json({ error: 'Payload must contain a plans array' });
    }

    let createdCount = 0;
    let updatedCount = 0;

    for (const plan of plans) {
      const existingBundles = await db.getBundles();
      const match = existingBundles.find((b: any) => b.provider_plan_code === plan.provider_plan_code);
      if (match) {
        await db.updateBundle(match.id, {
          name: plan.name,
          network: plan.network,
          data_amount: plan.data_amount,
          validity_days: Number(plan.validity_days || 30),
          admin_base_price_ghs: Number(plan.admin_base_price_ghs),
          provider_plan_code: plan.provider_plan_code,
          status: match.status || 'active'
        });
        updatedCount++;
      } else {
        await db.createBundle({
          name: plan.name,
          network: plan.network,
          data_amount: plan.data_amount,
          validity_days: Number(plan.validity_days || 30),
          admin_base_price_ghs: Number(plan.admin_base_price_ghs),
          provider_plan_code: plan.provider_plan_code,
          status: 'active'
        });
        createdCount++;
      }
    }

    return res.json({
      success: true,
      message: `Import complete. Handled ${plans.length} bundle specifications (created ${createdCount}, modified ${updatedCount}).`
    });
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
      whatsapp_community_link: settings.whatsapp_community_link || '',
      whatsapp_channel_link: settings.whatsapp_channel_link || ''
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
    if (amt <= 5.00) {
      return res.status(400).json({ error: 'Resellers can only withdraw profits above 5 GHS (minimum 5.01 GHS).' });
    }

    const account = await db.getResellerAccountByUserId(resellerId);
    if (!account || account.balance_ghs < amt) {
      return res.status(400).json({ 
        error: `Insufficient balance. Available GHS: ${account ? account.balance_ghs.toFixed(2) : '0.00'}` 
      });
    }

    const reqRecord = await db.createWithdrawal(resellerId, amt);

    // Alert admin of a new withdrawal request (user_id is null for administrative alerts)
    const resellerUser = await db.getUserById(resellerId);
    const resellerLabel = resellerUser ? `${resellerUser.store_name || resellerUser.email} (UID: ${resellerId})` : `Reseller UID #${resellerId}`;
    await db.createNotification({
      user_id: null,
      title: 'New Withdrawal Requested',
      message: `${resellerLabel} has submitted a new withdrawal request for GHS ${amt.toFixed(2)}.`,
      type: 'new_withdrawal_request'
    }).catch((e: any) => console.log('Admin notification skip:', e));

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
// 6.5. IN-APP NOTIFICATIONS API
// ==========================================

// Get all notifications for logged-in user / admin
app.get('/api/notifications', verifyToken(['admin', 'reseller']), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;
    
    // Admins get administrative warnings/alerts (user_id IS NULL)
    // Resellers get their own order and withdrawal statuses
    const targetUserId = role === 'admin' ? null : Number(userId);
    const list = await db.getNotifications(targetUserId);
    return res.json(list);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Mark a single notification as read
app.put('/api/notifications/:id/read', verifyToken(['admin', 'reseller']), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    await db.markNotificationAsRead(id);
    return res.json({ success: true, message: 'Notification marked as read.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Clear all notifications for user/admin
app.delete('/api/notifications/clear', verifyToken(['admin', 'reseller']), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;
    const targetUserId = role === 'admin' ? null : Number(userId);
    await db.clearNotifications(targetUserId);
    return res.json({ success: true, message: 'All notifications cleared.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 7. VITE MIDDLEWARE SETUP
// ==========================================

async function startServer() {
  if (process.env.VERCEL || process.env.NOW_REGION || process.env.VERCEL_ENV) {
    // Skip dev server or port listening under Vercel serverless functions
    return;
  }
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

export default app;
