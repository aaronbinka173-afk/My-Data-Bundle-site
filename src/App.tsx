/**
 * Mac Data Hub — Complete Data Bundle Reseller Platform (Ghana)
 */

import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, ArrowRight, Store, Smartphone, Landmark, CheckCircle, 
  ChevronRight, RefreshCw, UserCheck, Key, ShoppingBag, Eye, LogOut, Sparkles, Send,
  Sun, Moon, Search, MessageSquare, Headphones, X, Clock, HelpCircle, Bot, Star
} from 'lucide-react';

import AuthWindow from './components/AuthWindow';
import CheckoutModal from './components/CheckoutModal';
import DashboardAdmin from './components/DashboardAdmin';
import DashboardReseller from './components/DashboardReseller';
import { auth } from './lib/firebase';

const isVideoMedia = (src: string) => {
  if (!src) return false;
  const lowercase = src.toLowerCase();
  return src.startsWith('data:video/') || 
         lowercase.endsWith('.mp4') || 
         lowercase.endsWith('.webm') || 
         lowercase.endsWith('.ogg') ||
         lowercase.includes('video') ||
         lowercase.includes('type=video');
};

export default function App() {
  // Navigation states
  const [view, setView] = useState<'home' | 'store' | 'dashboard' | 'auth' | 'my_purchases'>('home');
  const [storeSlug, setStoreSlug] = useState<string | null>(null);
  const [authWindowMode, setAuthWindowMode] = useState<'login' | 'register'>('login');
  const [authWindowRole, setAuthWindowRole] = useState<'customer' | 'reseller'>('reseller');

  const triggerAuth = (mode: 'login' | 'register' = 'login', role: 'customer' | 'reseller' = 'reseller') => {
    setAuthWindowMode(mode);
    setAuthWindowRole(role);
    setView('auth');
  };
  
  // Session details
  const [token, setToken] = useState<string | null>(localStorage.getItem('mac_hub_token'));
  const [user, setUser] = useState<any>(null); // { id, email, role, status, store_name, store_slug }

  // App settings/catalogs
  const [generalBundles, setGeneralBundles] = useState<any[]>([]);
  const [selectedResellerStore, setSelectedResellerStore] = useState<any | null>(null);
  const [storefrontBundles, setStorefrontBundles] = useState<any[]>([]);

  // Selected checkout state
  const [checkoutBundle, setCheckoutBundle] = useState<any | null>(null);

  // Active customer orders (tied to entered phone on this session/localStorage)
  const [customerOrderLogs, setCustomerOrderLogs] = useState<any[]>([]);
  const [checkingPastOrders, setCheckingPastOrders] = useState<boolean>(false);
  const [pastOrdersPhone, setPastOrdersPhone] = useState<string>(localStorage.getItem('mac_hub_history_phone') || '');

  // Registration fee modal helper if blocked at register paywall
  const [regFeePaymentDetails, setRegFeePaymentDetails] = useState<any | null>(null);

  // Theme state ('light' | 'dark')
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('mac_hub_theme') as 'light' | 'dark') || 'dark';
  });

  // Dynamic branding configurations
  const [siteName, setSiteName] = useState<string>('Mac Data Hub');
  const [siteColor, setSiteColor] = useState<string>('amber');
  
  // Dynamic typography configurations
  const [siteFontFamily, setSiteFontFamily] = useState<string>('Outfit');
  const [siteFontSize, setSiteFontSize] = useState<string>('16px');
  const [textColorPrimary, setTextColorPrimary] = useState<string>('');
  const [textColorBody, setTextColorBody] = useState<string>('');
  const [textColorMuted, setTextColorMuted] = useState<string>('');
  const [textColorAccent, setTextColorAccent] = useState<string>('');

  // Dynamic Background and Support state options
  const [siteBgColor, setSiteBgColor] = useState<string>('');
  const [siteBgImage, setSiteBgImage] = useState<string>('');
  const [supportEnabled, setSupportEnabled] = useState<boolean>(true);
  const [supportRestrictions, setSupportRestrictions] = useState<string>('');

  // Customer care support & Search States
  const [bundleSearchQuery, setBundleSearchQuery] = useState<string>('');
  const [selectedNetwork, setSelectedNetwork] = useState<'All' | 'MTN' | 'Telecel' | 'AirtelTigo'>('All');
  const [globalTax, setGlobalTax] = useState<any>(null);
  const [whatsappCommunityLink, setWhatsappCommunityLink] = useState<string>('');
  const [whatsappChannelLink, setWhatsappChannelLink] = useState<string>('');
  
  // Storefront reviews and rating states
  const [storefrontReviews, setStorefrontReviews] = useState<any[]>([]);
  const [newReviewAuthor, setNewReviewAuthor] = useState<string>('');
  const [newReviewRating, setNewReviewRating] = useState<number>(5);
  const [newReviewComment, setNewReviewComment] = useState<string>('');
  const [submittingReview, setSubmittingReview] = useState<boolean>(false);
  const [reviewSuccessMsg, setReviewSuccessMsg] = useState<string>('');
  const [reviewErrorMsg, setReviewErrorMsg] = useState<string>('');

  const [isSupportOpen, setIsSupportOpen] = useState<boolean>(false);
  const [reviewsPopupEnabled, setReviewsPopupEnabled] = useState<boolean>(true);
  const [reviewsDisplayDuration, setReviewsDisplayDuration] = useState<number>(5);
  const [reviewsInterval, setReviewsInterval] = useState<number>(20);
  const [activeReviewPopup, setActiveReviewPopup] = useState<any | null>(null);

  useEffect(() => {
    if (!reviewsPopupEnabled) {
      setActiveReviewPopup(null);
      return;
    }

    const reviewFeed = [
      { name: "Isaac O.", rating: 5, text: "Extremely fast delivery, bundle received in less than 2 minutes! Highly recommend.", product: "MTN 10GB Data Bundle" },
      { name: "Emelia A.", rating: 5, text: "Very convenient, much cheaper rates than other vendors. Love this site!", product: "Telecel 5GB Data Bundle" },
      { name: "Kojo M.", rating: 5, text: "Setup was instant. The storefront is perfect for my side business.", product: "Reseller Partner Catalog" },
      { name: "Blessing T.", rating: 5, text: "Amazing support desk and excellent rates. Will buy again and again.", product: "MTN 20GB Data Bundle" },
      { name: "Richmond Y.", rating: 5, text: "Transactions are extremely secure and delivery is fully automated. Perfect service.", product: "MTN 5GB Data Bundle" },
      { name: "Abigail F.", rating: 5, text: "Fastest response I've ever experienced in Ghana. 5 stars easily!", product: "Telecel 10GB Data Bundle" },
      { name: "Daniel K.", rating: 5, text: "Great interface, super easy to pay and get credited automatically.", product: "MTN 50GB Big Pack" },
      { name: "Jennifer E.", rating: 5, text: "The reseller tools are top tier. I made 300 GHS in my first week!", product: "Reseller Pro Licence" }
    ];

    let counter = 0;

    const showNextReview = () => {
      const idx = counter % reviewFeed.length;
      setActiveReviewPopup(reviewFeed[idx]);
      counter++;

      // Dismiss after custom display stay duration
      setTimeout(() => {
        setActiveReviewPopup(null);
      }, reviewsDisplayDuration * 1000);
    };

    // Repeat every custom interval
    const intervalId = setInterval(showNextReview, reviewsInterval * 1000);
    const firstTriggerTimeout = setTimeout(showNextReview, Math.min(10000, reviewsInterval * 1000));

    return () => {
      clearInterval(intervalId);
      clearTimeout(firstTriggerTimeout);
    };
  }, [reviewsPopupEnabled, reviewsDisplayDuration, reviewsInterval]);

  const [supportMessages, setSupportMessages] = useState<any[]>([
    {
      id: 1,
      sender: 'care',
      text: "Hello! Welcome to our 24/7 Digital Operations Desk. I am your automated Customer Care concierge. How can I assist you with your data connectivity needs today? 🇬🇭",
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [userSupportMsg, setUserSupportMsg] = useState<string>('');
  const [supportTyping, setSupportTyping] = useState<boolean>(false);

  const fetchGlobalSettings = async () => {
    try {
      const resp = await fetch(`/api/registration-fee?t=${Date.now()}`);
      if (!resp.ok) throw new Error('Failed to retrieve settings');
      const data = await resp.json();
      if (data.site_name) {
        let name = data.site_name;
        if (name.includes('ACCREDITATION') || name.includes('admin123')) {
          name = 'Mac Data Hub';
        }
        setSiteName(name);
      }
      if (data.site_color) setSiteColor(data.site_color);
      if (data.global_font_style) setSiteFontFamily(data.global_font_style);
      if (data.global_font_size) setSiteFontSize(data.global_font_size);
      if (data.global_text_color_primary !== undefined) setTextColorPrimary(data.global_text_color_primary);
      if (data.global_text_color_body !== undefined) setTextColorBody(data.global_text_color_body);
      if (data.global_text_color_muted !== undefined) setTextColorMuted(data.global_text_color_muted);
      if (data.global_text_color_accent !== undefined) setTextColorAccent(data.global_text_color_accent);
      if (data.site_bg_color !== undefined) setSiteBgColor(data.site_bg_color);
      if (data.site_bg_image !== undefined) {
        const imgVal = String(data.site_bg_image);
        setSiteBgImage(imgVal === '0' || imgVal === 'null' || imgVal === 'undefined' ? '' : imgVal);
      }
      if (data.online_support_enabled !== undefined) setSupportEnabled(data.online_support_enabled !== false);
      if (data.online_support_restrictions !== undefined) setSupportRestrictions(data.online_support_restrictions);
      if (data.whatsapp_community_link !== undefined) setWhatsappCommunityLink(data.whatsapp_community_link);
      if (data.whatsapp_channel_link !== undefined) setWhatsappChannelLink(data.whatsapp_channel_link);
      if (data.reviews_popup_enabled !== undefined) setReviewsPopupEnabled(data.reviews_popup_enabled !== false);
      if (data.reviews_display_duration !== undefined) setReviewsDisplayDuration(Number(data.reviews_display_duration));
      if (data.reviews_interval !== undefined) setReviewsInterval(Number(data.reviews_interval));
      if (data.tax) setGlobalTax(data.tax);
    } catch (err) {
      console.error('Failed to load settings from server:', err);
    }
  };

  useEffect(() => {
    fetchGlobalSettings();
  }, []);

  const typographyCss = React.useMemo(() => {
    const parsedFont = siteFontFamily ? siteFontFamily.trim().replace(/\s+/g, '+') : 'Outfit';
    const hasCustomFont = !!siteFontFamily && siteFontFamily !== 'Outfit';
    const importRule = hasCustomFont ? `@import url('https://fonts.googleapis.com/css2?family=${parsedFont}:wght@300;400;500;600;700;800;900&display=swap');` : '';

    return `
      ${importRule}
      
      html, body {
        font-family: "${siteFontFamily || 'Outfit'}", ui-sans-serif, system-ui, sans-serif !important;
        font-size: ${siteFontSize || '16px'} !important;
        overflow-x: hidden !important;
        max-width: 100vw !important;
      }
      
      body {
        background-color: ${siteBgColor || '#020617'} !important;
        ${siteBgImage && !isVideoMedia(siteBgImage)
          ? `background-image: url("${siteBgImage}") !important; background-size: cover !important; background-position: center !important; background-attachment: fixed !important; background-repeat: no-repeat !important;` 
          : 'background-image: none !important;'
        }
      }
      
      :root, .light {
        ${siteFontFamily ? `--font-sans: "${siteFontFamily}", ui-sans-serif, system-ui, sans-serif !important;` : ''}
        ${textColorPrimary ? `--slate-100: ${textColorPrimary} !important; --slate-200: ${textColorPrimary} !important;` : ''}
        ${textColorBody ? `--slate-300: ${textColorBody} !important; --slate-50: ${textColorBody} !important;` : ''}
        ${textColorMuted ? `--slate-400: ${textColorMuted} !important; --slate-500: ${textColorMuted} !important;` : ''}
        ${textColorAccent ? `--accent-400: ${textColorAccent} !important; --accent-500: ${textColorAccent} !important; --accent-600: ${textColorAccent} !important;` : ''}
      }

      /* Base text color assignments for robust backup override */
      ${textColorPrimary ? `h1, h2, h3, h4, h5, h6, .text-slate-100, .text-slate-200, .text-slate-50 { color: ${textColorPrimary} !important; }` : ''}
      ${textColorBody ? `p, span, div, td, th, label, button, input, select, textarea, .text-slate-300, .text-slate-350 { color: ${textColorBody} !important; }` : ''}
      ${textColorMuted ? `.text-slate-400, .text-slate-500 { color: ${textColorMuted} !important; }` : ''}
      ${textColorAccent ? `.text-amber-400, .text-amber-500, .text-amber-600 { color: ${textColorAccent} !important; }` : ''}
    `;
  }, [siteFontFamily, siteFontSize, textColorPrimary, textColorBody, textColorMuted, textColorAccent, siteBgColor, siteBgImage]);

  useEffect(() => {
    const root = window.document.documentElement;
    // Remove existing theme color classes
    root.classList.forEach(className => {
      if (className.startsWith('theme-')) {
        root.classList.remove(className);
      }
    });
    // Add new theme class
    root.classList.add(`theme-${siteColor}`);
  }, [siteColor]);

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
    } else {
      root.classList.remove('light');
    }
    localStorage.setItem('mac_hub_theme', theme);
  }, [theme]);

  useEffect(() => {
    // Determine route slug index from window path:
    const path = window.location.pathname;
    if (path.startsWith('/store/')) {
      const slug = path.split('/store/')[1]?.trim();
      if (slug) {
        setStoreSlug(slug);
        setView('store');
        fetchStorefront(slug);
      }
    } else {
      // Check for query parameter or hash for auto registration view:
      const searchParams = new URLSearchParams(window.location.search);
      const hash = window.location.hash;
      if (
        searchParams.get('register') === 'true' || 
        searchParams.get('auth') === 'register' || 
        hash === '#register' || 
        hash === '#become-partner'
      ) {
        setAuthWindowMode('register');
        setAuthWindowRole('reseller');
        setView('auth');
      } else {
        setView('home');
      }
      fetchGeneralBundles();
    }

    // Recover session user details
    const storedUser = localStorage.getItem('mac_hub_user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        // clear corrupted
        localStorage.removeItem('mac_hub_user');
      }
    }

    if (localStorage.getItem('mac_hub_token')) {
      refreshUserProfile();
    }
  }, []);

  useEffect(() => {
    if (view === 'store' && selectedResellerStore) {
      document.title = selectedResellerStore.store_name;
    } else {
      document.title = siteName || 'Mac Data Hub';
    }
  }, [view, selectedResellerStore, siteName]);

  const handleSendSupportMsg = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userSupportMsg.trim()) return;
    const cleanMsg = userSupportMsg.trim();
    setUserSupportMsg('');

    const userMsgObj = {
      id: Date.now(),
      sender: 'user',
      text: cleanMsg,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setSupportMessages(prev => [...prev, userMsgObj]);
    triggerSupportAutoResponse(cleanMsg);
  };

  const handleSupportQuickAction = (actionText: string) => {
    const userMsgObj = {
      id: Date.now(),
      sender: 'user',
      text: actionText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setSupportMessages(prev => [...prev, userMsgObj]);
    triggerSupportAutoResponse(actionText);
  };

  const triggerSupportAutoResponse = async (queryText: string) => {
    setSupportTyping(true);

    try {
      const mappedHistory = supportMessages.slice(-5).map(m => ({
        role: m.sender === 'user' ? 'user' : 'model',
        text: m.text
      }));

      const response = await fetch('/api/support/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          message: queryText, 
          history: mappedHistory,
          isResellerStorefront: (view === 'store' && !!selectedResellerStore),
          storeName: (view === 'store' && selectedResellerStore) ? selectedResellerStore.store_name : null,
          userRole: user?.role || null
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.reply) {
          setSupportMessages(prev => [...prev, {
            id: Date.now() + 1,
            sender: 'care',
            text: data.reply,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }]);
          setSupportTyping(false);
          return;
        }
      }
    } catch (err) {
      console.warn('Live automated desk offline, executing embedded client engine fallback.', err);
    }

    // Embed client responses for instant support
    let replyText = "Thank you for reaching out! Your support ticket has been registered with our automated help desk. Our team is active—is there anything else about data packages, custom markups, or storefronts I can help explain?";
    const lQuery = queryText.toLowerCase();

    if (lQuery.includes('delivery') || lQuery.includes('time') || lQuery.includes('long') || lQuery.includes('when')) {
      replyText = "All data bundle orders are automatically pushed to our API gateway and typically land on your device within 15 to 45 seconds of a verified payment.";
    } else if (lQuery.includes('failed') || lQuery.includes('not arrive') || lQuery.includes('refund') || lQuery.includes('receive')) {
      replyText = "If your order payment succeeded but you haven't received the data payload, our server automatically retries. If it fails, our administrator is alerted immediately to manually process or refund. Please verify your transaction reference in 'Verify My Orders' or click support directly.";
    } else if (lQuery.includes('payment') || lQuery.includes('pay') || lQuery.includes('gateway') || lQuery.includes('momo') || lQuery.includes('card')) {
      replyText = "We accept MTN Mobile Money, Telecel Cash, AirtelTigo Money, and Visa/Mastercard. All checkouts are processed over secure Paystack payments.";
    } else if (lQuery.includes('network') || lQuery.includes('mtn') || lQuery.includes('telecel') || lQuery.includes('airtel') || lQuery.includes('glo')) {
      replyText = "We currently support high-speed MTN SME or Gifting bundles, Telecel (Vodafone) prepaid data lines, and standard AirtelTigo packages valid for 30 full days.";
    }

    setTimeout(() => {
      setSupportMessages(prev => [...prev, {
        id: Date.now() + 1,
        sender: 'care',
        text: replyText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
      setSupportTyping(false);
    }, 1000);
  };

  const fetchGeneralBundles = async () => {
    try {
      const resp = await fetch('/api/bundles');
      if (resp.ok) {
        const d = await resp.json();
        setGeneralBundles(d);
      }
    } catch (e) {
      console.error('Failed to load active bundles:', e);
    }
  };

  const fetchStorefront = async (slug: string) => {
    try {
      const resp = await fetch(`/api/store/${slug}`);
      if (!resp.ok) {
        throw new Error('Storefront not loaded');
      }
      const data = await resp.json();
      setSelectedResellerStore(data.reseller);
      setStorefrontBundles(data.bundles || []);
      setStorefrontReviews(data.reviews || []);
    } catch (e) {
      console.error('Failed to load storefront directly:', e);
      setView('home');
      setStoreSlug(null);
      fetchGeneralBundles();
      fetchGlobalSettings();
    }
  };

  const handleAddStorefrontReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedResellerStore) return;
    if (!newReviewAuthor.trim() || !newReviewComment.trim()) {
      setReviewErrorMsg('Both reviewer name and commentary feedback are required.');
      return;
    }
    setSubmittingReview(true);
    setReviewSuccessMsg('');
    setReviewErrorMsg('');
    try {
      const resp = await fetch(`/api/store/${selectedResellerStore.id}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          author_name: newReviewAuthor.trim(),
          rating: newReviewRating,
          comment: newReviewComment.trim()
        })
      });
      const d = await resp.json();
      if (!resp.ok) {
        throw new Error(d.error || 'Review save issue.');
      }
      setReviewSuccessMsg(`Thank you! Your feedback for "${selectedResellerStore.store_name}" has been recorded.`);
      setNewReviewAuthor('');
      setNewReviewComment('');
      setNewReviewRating(5);
      setStorefrontReviews(prev => [d.review, ...prev]);
    } catch (err: any) {
      setReviewErrorMsg(err.message || 'Review record processing issue.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleAuthSuccess = (newToken: string, authenticatedUser: any) => {
    localStorage.setItem('mac_hub_token', newToken);
    localStorage.setItem('mac_hub_user', JSON.stringify(authenticatedUser));
    setToken(newToken);
    setUser(authenticatedUser);
    
    // Auto redirect based on roles
    setView('dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('mac_hub_token');
    localStorage.removeItem('mac_hub_user');
    setToken(null);
    setUser(null);
    window.history.pushState({}, '', '/');
    setStoreSlug(null);
    setView('home');
  };

  // Fetch orders matching customer entered phone or email
  const handleQueryPurchases = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pastOrdersPhone.trim()) return;

    setCheckingPastOrders(true);
    localStorage.setItem('mac_hub_history_phone', pastOrdersPhone.trim());

    try {
      const stored = localStorage.getItem('mac_hub_orders');
      const list = stored ? JSON.parse(stored) : [];
      const customerList = list.filter((o: any) => o.customer_phone === pastOrdersPhone.trim());
      setCustomerOrderLogs(customerList);
    } catch (err) {
      console.error(err);
    } finally {
      setCheckingPastOrders(false);
    }
  };

  // Triggers checkout for reseller paywall
  const handleStartRegFeeCheckout = (amount: number, userId: number, email: string) => {
    setRegFeePaymentDetails({
      id: 9999,
      name: 'Reseller Storefront Authorization Fee',
      admin_base_price_ghs: amount,
      final_price_ghs: amount,
      is_registration: true,
      registeringResellerId: userId,
      customerEmail: email
    });
  };

  const handleRegFeeSuccess = () => {
    setRegFeePaymentDetails(null);
    // Alert success and redirect to login
    alert('Payment confirmed successfully! Your reseller storefront account is now pending administrative review and approval. Once reviewed, you will have immediate dashboard access!');
  };

  const refreshUserProfile = async () => {
    const activeToken = token || localStorage.getItem('mac_hub_token');
    if (!activeToken) return null;
    try {
      const resp = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${activeToken}`
        }
      });
      if (resp.ok) {
        const d = await resp.json();
        if (d.user) {
          localStorage.setItem('mac_hub_user', JSON.stringify(d.user));
          setUser(d.user);
          return d.user;
        }
      }
    } catch (err) {
      console.error('Failed to auto refresh user profile:', err);
    }
    return null;
  };

  return (
    <div 
      className={`min-h-screen text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950 transition-all duration-300 ${
        siteBgImage ? 'bg-transparent' : 'bg-slate-950'
      }`}
    >
      <style>{typographyCss}</style>

      {siteBgImage && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs -z-10 pointer-events-none" />
      )}

      {siteBgImage && isVideoMedia(siteBgImage) && (
        <video
          src={siteBgImage}
          autoPlay
          loop
          muted
          playsInline
          className="fixed inset-0 w-full h-full object-cover -z-20 pointer-events-none"
        />
      )}
      
      {/* HEADER SECTION LAYOUT */}
      <header className={`border-b border-slate-800/80 sticky top-0 z-40 transition-colors duration-300 ${
        siteBgImage ? 'bg-slate-900/85 backdrop-blur-md' : 'bg-slate-900'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
           {/* Logo element */}
          <a 
            href="/" 
            onClick={(e) => { 
              e.preventDefault(); 
              if (view === 'store') {
                setBundleSearchQuery('');
              } else {
                window.history.pushState({}, '', '/'); 
                setStoreSlug(null); 
                setView('home'); 
                fetchGeneralBundles(); 
              }
            }}
            className="flex items-center gap-2 group shrink-0 min-w-0"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center font-black text-slate-950 tracking-wider shadow-lg shadow-amber-500/15 group-hover:scale-105 transition-all text-xs shrink-0 select-none">
              {((view === 'store' && selectedResellerStore) ? selectedResellerStore.store_name : siteName).trim().split(/\s+/).map(w => w[0]).join('').substring(0, 3).toUpperCase() || 'HB'}
            </div>
            <div className="min-w-0 leading-tight">
              <span className="font-sans font-black tracking-tight text-slate-100 block group-hover:text-amber-400 transition truncate max-w-[130px] xs:max-w-[170px] sm:max-w-[240px] md:max-w-none text-xs sm:text-base">
                {(view === 'store' && selectedResellerStore) ? selectedResellerStore.store_name : siteName}
              </span>
              <span className="text-xxs text-amber-500 font-mono tracking-wide block uppercase truncate max-w-[130px] xs:max-w-[170px] sm:max-w-[240px] md:max-w-none">
                {(view === 'store' && selectedResellerStore) ? 'Data Storefront' : 'Reseller Gate Ghana'}
              </span>
            </div>
          </a>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-6 text-sm text-slate-300 font-sans">
            <a 
              href="/" 
              onClick={(e) => { 
                e.preventDefault(); 
                if (view !== 'store') {
                  setStoreSlug(null); 
                  setView('home'); 
                  fetchGeneralBundles(); 
                } else {
                  setBundleSearchQuery('');
                }
              }} 
              className="hover:text-amber-400 transition font-medium"
            >
              Browse Bundles
            </a>
            {view !== 'store' && (
              <a href="#become-partner" onClick={() => triggerAuth('register', 'reseller')} className="hover:text-amber-400 transition font-medium">Store Reseller Program</a>
            )}
            <button onClick={() => setView('my_purchases')} className="hover:text-amber-400 transition font-medium">Verify My Orders</button>
          </nav>

          {/* User parameters buttons */}
          <div className="flex items-center gap-3">
            {/* Elegant Theme Toggle Button */}
            <button
              onClick={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
              className="p-2.5 rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-300 hover:text-amber-400 border border-slate-800 transition-all flex items-center justify-center shrink-0 cursor-pointer"
              title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            >
              {theme === 'light' ? (
                <Moon className="w-4.5 h-4.5" />
              ) : (
                <Sun className="w-4.5 h-4.5 text-amber-500" />
              )}
            </button>

            {token && user ? (
              <div className="flex items-center gap-3 bg-slate-850 p-1.5 pr-3.5 rounded-xl border border-slate-800 shrink-0 font-sans">
                {user.role === 'admin' && (
                  <button
                    onClick={() => setView('dashboard')}
                    className="px-3.5 py-1.5 bg-rose-500 hover:bg-rose-600 text-slate-950 text-xs font-bold uppercase rounded-lg transition"
                  >
                    Admin Portal
                  </button>
                )}
                {user.role === 'reseller' && (
                  <button
                    onClick={() => setView('dashboard')}
                    className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold uppercase rounded-lg transition"
                  >
                    My Reseller Panel
                  </button>
                )}
                {user.role === 'customer' && (
                  <button
                    onClick={() => setView('my_purchases')}
                    className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-bold uppercase rounded-lg transition"
                  >
                    My Order History
                  </button>
                )}
                <div className="text-xs text-right hidden sm:block">
                  <span className="block font-semibold text-slate-200">{user.email}</span>
                  <span className="text-xxs text-slate-400 font-mono capitalize">{user.role} workspace</span>
                </div>
                <button 
                  onClick={handleLogout}
                  className="text-slate-400 hover:text-rose-400 p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-slate-800/60 transition shadow-sm"
                  title="Log out / Disconnect session"
                  aria-label="Logout"
                >
                  <LogOut className="w-5 h-5 shrink-0" />
                </button>
              </div>
            ) : (
              view !== 'store' && (
                <button
                  onClick={() => triggerAuth('login')}
                  className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold uppercase px-4 py-2.5 rounded-xl transition shadow font-sans"
                >
                  <Key className="w-4 h-4 text-amber-400" />
                  Store Partner Access
                </button>
              )
            )}
          </div>

        </div>
      </header>

      {/* BODY CONTENT CONTAINER LAYOUT */}
      <main className="flex-grow">
        
        {/* VIEW 1: MAIN HOME PLATFORM PAGE */}
        {view === 'home' && (
          <div className="space-y-16 py-10">
            
            {/* HERO MODULE BANNER */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/20 rounded-2xl p-8 md:p-12 border border-slate-800/80 relative overflow-hidden flex flex-col lg:flex-row gap-8 items-center">
                <div className="space-y-6 max-w-2xl text-center lg:text-left relative z-10">
                  <span className="px-3.5 py-1 bg-amber-500/10 text-amber-500 font-mono text-xs tracking-wider uppercase rounded-full border border-amber-500/20 font-semibold inline-block">
                    ₵ GHANA'S MOST DYNAMIC DATA HUB
                  </span>
                  <h1 className="text-3xl md:text-5xl font-black font-sans leading-tight text-white tracking-tight">
                    Premium high-speed data bundles. <span className="text-amber-500">Priced cheaper. Sent instantly.</span>
                  </h1>
                  <p className="text-slate-300 text-base leading-relaxed">
                    Buy cheap MTN, Telecel or AirtelTigo data bundles. Automatically processed and dispatched to any mobile phone in Ghana within seconds via secure Mobile Money checkout.
                  </p>

                  <div className="flex flex-col sm:flex-row gap-3.5 justify-center lg:justify-start">
                    <a
                      href="#bundle-catalogs"
                      className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-sans font-extrabold text-sm uppercase rounded-xl transition text-center shadow-lg"
                    >
                      Instant Purchase Data
                    </a>
                    <button
                      onClick={() => triggerAuth('register', 'reseller')}
                      className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-sans text-sm font-bold uppercase rounded-xl transition text-center"
                    >
                      Launch Your Own reseller Store
                    </button>
                  </div>
                </div>

                <div className="w-full max-w-sm lg:max-w-none lg:w-[400px] bg-slate-950 rounded-2xl p-6 border border-slate-800 flex flex-col gap-4 shadow-2xl relative z-10 shrink-0">
                  <div className="text-center font-bold text-slate-300 border-b border-slate-850 pb-3 uppercase tracking-wide text-xs">How it Works</div>
                  <div className="space-y-4 text-xs text-slate-400">
                    <div className="flex gap-3">
                      <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-amber-500 font-mono font-bold">1</span>
                      <p>Pick a cheap data bundle option and specify the delivery phone number.</p>
                    </div>
                    <div className="flex gap-3">
                      <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-amber-500 font-mono font-bold">2</span>
                      <p>Checkout instantly using Mobile Money (MTN, Telecel, or AirtelTigo) or Card.</p>
                    </div>
                    <div className="flex gap-3">
                      <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-amber-500 font-mono font-bold">3</span>
                      <p>The bundle is sent instantly to the phone network over SubAndGain API!</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* MAIN DATA BUNDLE BROWSER */}
            <div id="bundle-catalogs" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 scroll-mt-20">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="text-center md:text-left">
                  <h2 className="text-2xl font-extrabold text-slate-100 font-sans flex items-center justify-center md:justify-start gap-2">
                    <Smartphone className="w-5 h-5 text-amber-500 animate-pulse" />
                    Cheap Operator Data Bundles Menu
                  </h2>
                  <p className="text-slate-400 text-sm mt-1">Select a cheap data package below to checkout. Deliveries completed under 60 seconds.</p>
                </div>
                {/* Bundle Search Input UI */}
                <div className="relative max-w-md w-full md:w-80">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                    <Search className="h-4 w-4 text-slate-450" />
                  </span>
                  <input
                    type="text"
                    placeholder="Search size, network or package..."
                    value={bundleSearchQuery}
                    onChange={(e) => setBundleSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-8 py-2 bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl font-sans text-xs text-slate-200 placeholder-slate-500 focus:outline-none hover:border-slate-700 transition"
                  />
                  {bundleSearchQuery && (
                    <button
                      onClick={() => setBundleSearchQuery('')}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-xxs font-mono text-slate-400 hover:text-white"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Operator Network Selection Filter Tabs (MTN, Telecel, AirtelTigo) */}
              <div className="flex flex-wrap items-center gap-2 bg-slate-900 border border-slate-800 p-1 rounded-xl max-w-max">
                {[
                  { id: 'All', label: 'All Operators' },
                  { id: 'MTN', label: 'MTN Ghana' },
                  { id: 'Telecel', label: 'Telecel Ghana' },
                  { id: 'AirtelTigo', label: 'AirtelTigo' }
                ].map(net => {
                  const isActive = selectedNetwork === net.id;
                  return (
                    <button
                      key={net.id}
                      onClick={() => setSelectedNetwork(net.id as any)}
                      className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                        isActive 
                          ? 'bg-amber-500 text-slate-950 font-extrabold shadow-md' 
                          : 'bg-transparent text-slate-450 hover:text-white'
                      }`}
                    >
                      {net.label}
                    </button>
                  );
                })}
              </div>

              {generalBundles.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center gap-2 bg-slate-900 border border-slate-850 rounded-2xl text-slate-400">
                  <RefreshCw className="w-6 h-6 text-amber-500 animate-spin" />
                  <span>Loading official catalogs...</span>
                </div>
              ) : (
                (() => {
                  const query = bundleSearchQuery.toLowerCase().trim();
                  const queryTokens = query.split(/\s+/).filter(Boolean);
                  const filtered = generalBundles.filter(b => {
                    if (selectedNetwork !== 'All') {
                      // Normalize networks for strict comparison (e.g. Telecel/Vodafone)
                      const normNet = b.network.toLowerCase();
                      const targetNet = selectedNetwork.toLowerCase();
                      if (targetNet === 'telecel') {
                        if (normNet !== 'telecel' && normNet !== 'vodafone') return false;
                      } else {
                        if (normNet !== targetNet) return false;
                      }
                    }
                    if (queryTokens.length === 0) return true;
                    return queryTokens.every(token => {
                      return (
                        b.name.toLowerCase().includes(token) ||
                        b.network.toLowerCase().includes(token) ||
                        (b.network.toLowerCase() === 'vodafone' && 'telecel'.includes(token)) ||
                        b.data_amount.toLowerCase().includes(token) ||
                        String(b.validity_days).includes(token) ||
                        (b.provider_plan_code && b.provider_plan_code.toLowerCase().includes(token))
                      );
                    });
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="py-20 flex flex-col items-center justify-center gap-2 bg-slate-900 border border-slate-850 rounded-2xl text-slate-450 text-center font-sans text-sm">
                        <HelpCircle className="w-8 h-8 text-slate-600 animate-pulse" />
                        <span className="block mt-2 font-medium">No bundles match "{bundleSearchQuery}"</span>
                        <p className="text-xs text-slate-500 mt-1">Try standard terms like "5GB", "SME", "MTN", or "Telecel".</p>
                        <button onClick={() => setBundleSearchQuery('')} className="mt-4 px-3 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold font-sans text-xs rounded-lg transition shadow">
                          Reset Filter
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {filtered.map(b => (
                    <div key={b.id} className="bg-slate-900 border border-slate-850 rounded-2xl p-5 hover:border-slate-700 transition flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start">
                          <span className={`px-2 py-0.5 rounded text-xxs font-bold uppercase ${
                            b.network === 'MTN' ? 'bg-amber-950 text-amber-300 border border-amber-800/50' :
                            b.network === 'Vodafone' ? 'bg-red-950 text-red-300 border border-red-800/50' :
                            'bg-cyan-950 text-cyan-300 border border-cyan-800/50'
                          }`}>
                            {b.network === 'Vodafone' ? 'Telecel' : b.network}
                          </span>
                          <span className="text-xxs font-mono text-slate-500">{b.validity_days} Days Validity</span>
                        </div>
                        <h3 className="font-extrabold text-slate-200 mt-4 text-lg">{b.name}</h3>
                        <p className="text-slate-400 text-xs mt-1">Volume Allocation: <strong className="text-slate-200 font-bold">{b.data_amount}</strong> Cheaper Bundle</p>
                      </div>

                      <div className="mt-6 pt-4 border-t border-slate-850 flex items-center justify-between">
                        <div>
                          <span className="text-xxs text-slate-500 block uppercase font-mono">Retail price</span>
                          <span className="font-black text-amber-400 text-lg">₵{Number(b.admin_base_price_ghs).toFixed(2)}</span>
                        </div>
                        <button
                          onClick={() => setCheckoutBundle(b)}
                          className="flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs tracking-tight uppercase px-4 py-2 rounded-xl transition shadow-md"
                        >
                          Checkout Data
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                );
              })()
            )}
          </div>

            {/* PARTNER SIGNUP PROMO SECTION */}
            <div id="become-partner" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="bg-slate-900 border border-slate-850 rounded-2xl p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="space-y-3 max-w-xl">
                  <h3 className="text-xl font-bold text-slate-200 flex items-center gap-1.5">
                    <Store className="w-5 h-5 text-amber-500" />
                    Bespoke Reseller Storefront Business
                  </h3>
                  <p className="text-slate-400 text-xs leading-normal">
                    Do you want to host your own data reseller site in Ghana? Create an account with {siteName}, configure your own profit margins above our cheap base costs, and share your personalized `store/slug` URL prefix. We process payments and automate delivery over SubAndGain API on your behalf while you pocket the margins!
                  </p>
                </div>
                <button
                  onClick={() => triggerAuth('register', 'reseller')}
                  className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs uppercase rounded-xl transition shrink-0"
                >
                  Start Your Partner Storefront Free
                </button>
              </div>
            </div>

          </div>
        )}

        {/* VIEW 2: RESELLER BRANDED STOREFRONT VIEW */}
        {view === 'store' && selectedResellerStore && (
          <div className="py-10 space-y-12">
            
            {/* Store header decoration */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="p-8 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/20 border border-slate-850 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <span className="text-xxs text-amber-500 font-mono tracking-wide block uppercase uppercase font-semibold">WELCOME TO DISPATCH STOREFRONT</span>
                  <h1 className="text-2xl md:text-3xl font-black font-sans leading-tight text-white tracking-tight mt-1">
                    {selectedResellerStore.store_name}
                  </h1>
                  <p className="text-slate-400 text-xs mt-1">Cheap instantly delivered packages brought to you directly by our storefront.</p>
                </div>
                
                {selectedResellerStore.phone && (
                  <div className="px-4 py-2 bg-slate-850 rounded-xl border border-slate-800 font-mono text-xs text-slate-300">
                    Contact Reseller: <strong>{selectedResellerStore.phone}</strong>
                  </div>
                )}
              </div>
            </div>

            {/* Store storefront bundles listings */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h2 className="text-lg font-bold text-slate-200 font-sans flex items-center gap-1.5">
                  <ShoppingBag className="w-4 h-4 text-amber-500" />
                  Available Bundle Offers
                </h2>
                {/* Storefront search bar */}
                <div className="relative max-w-md w-full md:w-80">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                    <Search className="h-4 w-4 text-slate-450" />
                  </span>
                  <input
                    type="text"
                    placeholder="Search size, network or package..."
                    value={bundleSearchQuery}
                    onChange={(e) => setBundleSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-8 py-2 bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl font-sans text-xs text-slate-200 placeholder-slate-500 focus:outline-none hover:border-slate-700 transition"
                  />
                  {bundleSearchQuery && (
                    <button
                      onClick={() => setBundleSearchQuery('')}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-xxs font-mono text-slate-400 hover:text-white"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Operator Network Selection Filter Tabs for Storefront (MTN, Telecel, AirtelTigo) */}
              <div className="flex flex-wrap items-center gap-2 bg-slate-900 border border-slate-800 p-1 rounded-xl max-w-max">
                {[
                  { id: 'All', label: 'All Operators' },
                  { id: 'MTN', label: 'MTN Ghana' },
                  { id: 'Telecel', label: 'Telecel Ghana' },
                  { id: 'AirtelTigo', label: 'AirtelTigo' }
                ].map(net => {
                  const isActive = selectedNetwork === net.id;
                  return (
                    <button
                      key={net.id}
                      onClick={() => setSelectedNetwork(net.id as any)}
                      className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                        isActive 
                          ? 'bg-amber-500 text-slate-950 font-extrabold shadow-md' 
                          : 'bg-transparent text-slate-450 hover:text-white'
                      }`}
                    >
                      {net.label}
                    </button>
                  );
                })}
              </div>

              {selectedResellerStore.storefront_enabled === false ? (
                <div className="text-center py-16 px-6 bg-slate-900 rounded-2xl border border-rose-950/40 text-slate-400 space-y-4 max-w-2xl mx-auto shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-rose-600"></div>
                  <span className="px-3 py-1 bg-rose-500/10 text-rose-400 font-mono text-xs tracking-wider uppercase rounded border border-rose-500/10 font-bold inline-block">
                    ● Storefront Closed
                  </span>
                  <h3 className="text-xl font-extrabold font-sans text-slate-100">Orders Temporarily Paused</h3>
                  <p className="text-slate-400 text-sm max-w-md mx-auto leading-relaxed">
                    The distributor for <span className="text-amber-400 font-semibold">{selectedResellerStore.store_name}</span> is temporarily offline or has paused order reception. 
                    Please check back later or contact the reseller at <span className="font-mono text-slate-200">{selectedResellerStore.phone}</span>.
                  </p>
                </div>
              ) : storefrontBundles.length === 0 ? (
                <div className="text-center py-20 bg-slate-900 rounded-2xl border border-slate-850 text-slate-400">This reseller store has no dynamic packages active.</div>
              ) : (
                (() => {
                  const query = bundleSearchQuery.toLowerCase().trim();
                  const queryTokens = query.split(/\s+/).filter(Boolean);
                  const filtered = storefrontBundles.filter(b => {
                    if (selectedNetwork !== 'All') {
                      const normNet = b.network.toLowerCase();
                      const targetNet = selectedNetwork.toLowerCase();
                      if (targetNet === 'telecel') {
                        if (normNet !== 'telecel' && normNet !== 'vodafone') return false;
                      } else {
                        if (normNet !== targetNet) return false;
                      }
                    }
                    if (queryTokens.length === 0) return true;
                    return queryTokens.every(token => {
                      return (
                        b.name.toLowerCase().includes(token) ||
                        b.network.toLowerCase().includes(token) ||
                        (b.network.toLowerCase() === 'vodafone' && 'telecel'.includes(token)) ||
                        b.data_amount.toLowerCase().includes(token) ||
                        String(b.validity_days).includes(token) ||
                        (b.provider_plan_code && b.provider_plan_code.toLowerCase().includes(token))
                      );
                    });
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="py-20 flex flex-col items-center justify-center gap-2 bg-slate-900 border border-slate-850 rounded-2xl text-slate-400 text-center font-sans text-sm">
                        <HelpCircle className="w-8 h-8 text-slate-600 animate-pulse" />
                        <span className="block mt-2 font-medium">No bundle deals match "{bundleSearchQuery}"</span>
                        <p className="text-xs text-slate-500 mt-1">Try seeking simple words like "5GB", "Telecel", "MTN", "SME".</p>
                        <button onClick={() => setBundleSearchQuery('')} className="mt-4 px-3 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold font-sans text-xs rounded-lg transition shadow">
                          Reset Query Layout
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {filtered.map(b => (
                    <div key={b.id} className="bg-slate-900 border border-slate-850 rounded-2xl p-5 hover:border-slate-700 transition flex flex-col justify-between">
                      <div>
                        <span className={`px-2 py-0.5 rounded text-xxs font-bold uppercase ${
                          b.network === 'MTN' ? 'bg-amber-950 text-amber-300 border border-amber-800/50' :
                          b.network === 'Vodafone' ? 'bg-red-950 text-red-300 border border-red-800/50' :
                          'bg-cyan-950 text-cyan-300 border border-cyan-800/50'
                        }`}>
                          {b.network === 'Vodafone' ? 'Telecel' : b.network}
                        </span>
                        <h3 className="font-extrabold text-slate-200 mt-4 text-base">{b.name}</h3>
                        <p className="text-slate-400 text-xs mt-1">Size Limit: {b.data_amount} ({b.validity_days} Days)</p>
                      </div>

                      <div className="mt-6 pt-4 border-t border-slate-850 flex items-center justify-between">
                        <div>
                          <span className="text-xxs text-slate-500 block uppercase font-mono">Retail Price</span>
                          <span className="font-black text-amber-400 text-lg">₵{b.final_price_ghs?.toFixed(2)}</span>
                        </div>
                        <button
                          onClick={() => setCheckoutBundle(b)}
                          className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs uppercase px-4 py-2 rounded-lg transition shadow-md"
                        >
                          Checkout Data
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                );
              })()
            )}
            </div>

            {/* Storefront Rating & Reviews Custom Widget */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-slate-800/60 pt-12 pb-6 space-y-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-100 font-sans flex items-center gap-2">
                    <Star className="w-5 h-5 text-amber-500 fill-amber-500 animate-pulse" />
                    Reviews and 5-Star Ratings of {selectedResellerStore.store_name}
                  </h2>
                  <p className="text-slate-400 text-xs mt-1">Leave {selectedResellerStore.store_name} a 5-star rating if our VTU service satisfied you!</p>
                </div>

                <div className="flex items-center gap-2.5 bg-slate-900 border border-slate-800 p-3 rounded-xl max-w-max">
                  <div className="flex items-center text-amber-500">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} className="w-4 h-4 fill-amber-500 text-amber-500" />
                    ))}
                  </div>
                  <span className="text-xs font-bold font-sans text-slate-200">
                    5.0 / 5.0 Average Customer Rating for "{selectedResellerStore.store_name}"!
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Submit review column */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 h-max space-y-4">
                  <div className="border-b border-slate-800 pb-3">
                    <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider font-mono">Leave {selectedResellerStore.store_name} a Review!</h3>
                    <p className="text-slate-500 text-xxs mt-0.5">We highly appreciate your client-side feedback.</p>
                  </div>

                  <form onSubmit={handleAddStorefrontReview} className="space-y-4 text-xs">
                    {reviewSuccessMsg && (
                      <div className="bg-emerald-950/40 border border-emerald-900/40 p-3 rounded-lg text-emerald-400 text-xxs font-semibold font-sans">
                        {reviewSuccessMsg}
                      </div>
                    )}
                    {reviewErrorMsg && (
                      <div className="bg-rose-950/40 border border-rose-900/40 p-3 rounded-lg text-rose-450 text-xxs font-semibold font-sans">
                        {reviewErrorMsg}
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="text-slate-400 font-mono text-[10px] block">Your name:</label>
                      <input
                        type="text"
                        placeholder="e.g. Ama Serwaa"
                        required
                        value={newReviewAuthor}
                        onChange={(e) => setNewReviewAuthor(e.target.value)}
                        className="w-full bg-slate-850 border border-slate-750 focus:border-amber-500 rounded-xl p-2.5 focus:outline-none text-slate-200 text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-slate-400 font-mono text-[10px] block">Rating value (Click star to select):</label>
                      <div className="flex gap-1.5 py-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setNewReviewRating(star)}
                            className="p-0.5 focus:outline-none transition transform hover:scale-110 active:scale-95"
                          >
                            <Star 
                              className={`w-5 h-5 ${
                                star <= newReviewRating 
                                  ? 'text-amber-500 fill-amber-500' 
                                  : 'text-slate-650'
                              }`} 
                            />
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-slate-400 font-mono text-[10px] block">Your feedback review:</label>
                      <textarea
                        rows={3}
                        required
                        placeholder="Type about data speed, pricing, or customer support..."
                        value={newReviewComment}
                        onChange={(e) => setNewReviewComment(e.target.value)}
                        className="w-full bg-slate-850 border border-slate-750 focus:border-amber-500 rounded-xl p-2.5 focus:outline-none text-slate-200 text-xs resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submittingReview}
                      className="w-full bg-amber-500 disabled:opacity-50 hover:bg-amber-600 text-slate-950 font-extrabold uppercase py-2.5 rounded-xl transition-all font-sans tracking-wide shadow-md flex items-center justify-center gap-1.5"
                    >
                      {submittingReview ? 'Submitting...' : 'Submit 5-Star Review'}
                      <Star className="w-3.5 h-3.5 fill-slate-950 text-slate-950" />
                    </button>
                  </form>
                </div>

                {/* Reviews List column */}
                <div className="lg:col-span-2 space-y-4">
                  <h3 className="text-xs font-bold text-slate-350 uppercase tracking-wider font-mono">Dynamic Customer Feed ({storefrontReviews.length})</h3>
                  
                  {storefrontReviews.length === 0 ? (
                    <div className="p-10 bg-slate-900/60 border border-slate-800 rounded-2xl text-center text-slate-500 text-xs relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500/20"></div>
                      No client reviews registered for "{selectedResellerStore.store_name}" yet. Be the first to share your rating experience below!
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {storefrontReviews.map((r, i) => (
                        <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 flex flex-col justify-between hover:border-slate-705 transition">
                          <div className="space-y-2">
                            <div className="flex gap-0.5 text-amber-500">
                              {Array.from({ length: 5 }).map((_, idx) => (
                                <Star 
                                  key={idx} 
                                  className={`w-3 h-3 ${
                                    idx < r.rating 
                                      ? 'text-amber-500 fill-amber-500' 
                                      : 'text-slate-755'
                                  }`} 
                                />
                              ))}
                            </div>
                            <p className="text-slate-200 text-xs leading-relaxed font-sans font-medium">"{r.comment}"</p>
                          </div>

                          <div className="flex items-center justify-between pt-2.5 border-t border-slate-800 text-[9px] text-slate-500 font-mono">
                            <span className="font-semibold text-slate-400">{r.author_name}</span>
                            <span>{new Date(r.created_at || Date.now()).toLocaleDateString('en-GB')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </div>

          </div>
        )}

        {/* VIEW 3: SYSTEM DASHBOARD ROUTER FOR ADMIN/RESELLER */}
        {view === 'dashboard' && token && user && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            {user.role === 'admin' ? (
              <DashboardAdmin 
                token={token} 
                user={user} 
                onLogout={handleLogout}
                onTypographyChange={(font, size, colorPrimary, colorBody, colorMuted, colorAccent) => {
                  if (font !== undefined) setSiteFontFamily(font);
                  if (size !== undefined) setSiteFontSize(size);
                  if (colorPrimary !== undefined) setTextColorPrimary(colorPrimary);
                  if (colorBody !== undefined) setTextColorBody(colorBody);
                  if (colorMuted !== undefined) setTextColorMuted(colorMuted);
                  if (colorAccent !== undefined) setTextColorAccent(colorAccent);
                }} 
                onBrandingChange={(siteName, siteColor, siteBgColor, siteBgImage) => {
                  if (siteName !== undefined) setSiteName(siteName);
                  if (siteColor !== undefined) setSiteColor(siteColor);
                  if (siteBgColor !== undefined) setSiteBgColor(siteBgColor);
                  if (siteBgImage !== undefined) {
                    const imgVal = String(siteBgImage);
                    setSiteBgImage(imgVal === '0' || imgVal === 'null' || imgVal === 'undefined' ? '' : imgVal);
                  }
                }}
              />
            ) : user.status === 'active' ? (
              <DashboardReseller token={token} user={user} onLogout={handleLogout} />
            ) : (
              // Beautiful Custom Setup Tracker View for Non-Active Resellers
              <div className="max-w-2xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-10 space-y-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-amber-600"></div>
                <div className="space-y-2 text-center md:text-left">
                  <span className="px-3 py-1 bg-amber-500/10 text-amber-400 font-mono text-xs tracking-wider uppercase rounded border border-amber-500/10 font-bold inline-block">
                    {user.status === 'pending_payment' ? 'Setup Fee Pending' : 'Awaiting Administration Clearance'}
                  </span>
                  <h2 className="text-2xl font-black text-slate-100 font-sans">
                    Storefront Activations Tracker
                  </h2>
                  <p className="text-sm text-slate-400">
                    Welcome, <span className="text-amber-400 font-semibold">{user.store_name}</span>. Complete the setup parameters below to unlock your reseller dashboard and custom markup tools.
                  </p>
                </div>

                {/* Progress Steps UI */}
                <div className="space-y-6">
                  {/* Step 1: Account Generated */}
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-emerald-950/85 border border-emerald-500 flex items-center justify-center text-emerald-400 font-bold shrink-0 shadow-lg shadow-emerald-500/10">
                      ✓
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-200">Step 1: Alphanumeric Storefront Slug Setup</h4>
                      <p className="text-xs text-slate-400 mt-0.5">Custom agent URL: <span className="font-mono text-amber-500 hover:underline">/store/{user.store_slug}</span> completed and mapped.</p>
                    </div>
                  </div>

                  {/* Step 2: Paywall Authorization */}
                  <div className="flex gap-4">
                    {user.status === 'pending_payment' ? (
                      <div className="w-8 h-8 rounded-full bg-amber-950/80 border border-amber-500 flex items-center justify-center text-amber-400 font-bold shrink-0 animate-pulse">
                        2
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-emerald-950/85 border border-emerald-500 flex items-center justify-center text-emerald-400 font-bold shrink-0">
                        ✓
                      </div>
                    )}
                    <div className="space-y-2 flex-grow">
                      <h4 className="text-sm font-bold text-slate-200">Step 2: Reseller Entry Paywall Authentication</h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {user.status === 'pending_payment' 
                          ? 'Please finalize the one-time partner license authorization fee to initiate storefront verification.' 
                          : 'Entry license fee received and catalog sync processed successfully!'}
                      </p>
                      {user.status === 'pending_payment' && (
                        <button
                          onClick={async () => {
                            try {
                              const r = await fetch(`/api/registration-fee?t=${Date.now()}`);
                              if (r.ok) {
                                const d = await r.json();
                                handleStartRegFeeCheckout(d.fee_ghs || 50, user.id, user.email);
                              } else {
                                handleStartRegFeeCheckout(50, user.id, user.email);
                              }
                            } catch (e) {
                              handleStartRegFeeCheckout(50, user.id, user.email);
                            }
                          }}
                          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-bold text-xs rounded transition uppercase tracking-wide shadow flex items-center gap-1.5"
                        >
                          💸 Pay Verification Fee
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Step 3: Admin Approval */}
                  <div className="flex gap-4">
                    {user.status === 'pending_payment' ? (
                      <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500 text-sm shrink-0 font-bold">
                        3
                      </div>
                    ) : user.status === 'pending_approval' ? (
                      <div className="w-8 h-8 rounded-full bg-amber-950/80 border border-amber-500 flex items-center justify-center text-amber-400 font-bold shrink-0 animate-pulse">
                        3
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-emerald-950/85 border border-emerald-500 flex items-center justify-center text-emerald-400 font-bold shrink-0">
                        ✓
                      </div>
                    )}
                    <div>
                      <h4 className="text-sm font-bold text-slate-200">Step 3: Administrative Storefront Security Audit</h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {user.status === 'pending_payment'
                          ? 'Unlocks automatically after license payment.'
                          : 'Your custom storefront and reseller profile are currently undergoing administrator security clearance. Once approved by Aaron Binka, your core dashboard access will automatically activate.'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row gap-4 justify-between items-center text-center sm:text-left">
                  <div className="text-xxs text-slate-500 font-mono text-left space-y-1">
                    <div>System Email: <span className="text-slate-400">{user.email}</span></div>
                    <button 
                      onClick={handleLogout}
                      className="text-rose-450 hover:text-rose-400 hover:underline transition-colors block text-left uppercase text-xxs font-bold tracking-wider pt-0.5 cursor-pointer"
                    >
                      ← Disconnect / Sign Out
                    </button>
                  </div>
                  <button
                    onClick={async () => {
                      const updatedUser = await refreshUserProfile();
                      if (updatedUser && updatedUser.status === 'active') {
                        alert('Congratulations! Your reseller account has been approved and activated. Launching your workspace!');
                      } else {
                        alert('Status Refreshed: Your account is still undergoing administrative clearance. Thank you for your patience!');
                      }
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 font-mono font-bold text-xs rounded transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Check Live Status</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW 4: SECURITY AUTH WORKSPACE */}
        {view === 'auth' && (
          <div className="py-16 px-4">
            <AuthWindow 
              onAuthSuccess={handleAuthSuccess} 
              onSetView={setView} 
              onShowPaymentNotification={handleStartRegFeeCheckout}
              disableResellerRegister={!!selectedResellerStore}
              initialMode={authWindowMode}
              initialRole={authWindowRole}
            />
          </div>
        )}

        {/* VIEW 5: VERIFICATE CUSTOMERS PAST ORDERS */}
        {view === 'my_purchases' && (
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-8">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl">
              <div className="text-center space-y-2">
                <h2 className="text-xl font-bold text-slate-200">Verify past purchases status</h2>
                <p className="text-slate-400 text-xs">Supply your Mobile Money recipient number below to track bundle receipt status and active logs.</p>
              </div>

              <form onSubmit={handleQueryPurchases} className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="tel"
                  required
                  placeholder="e.g. 0244123456"
                  value={pastOrdersPhone}
                  onChange={(e) => setPastOrdersPhone(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-750 focus:border-amber-500 p-3 text-sm text-slate-200 rounded-xl focus:outline-none font-mono"
                />
                <button
                  type="submit"
                  disabled={checkingPastOrders}
                  className="bg-amber-500 hover:bg-amber-600 font-bold text-slate-950 px-6 py-3 rounded-xl text-xs transition uppercase whitespace-nowrap inline-flex items-center justify-center gap-1.5"
                >
                  {checkingPastOrders ? 'Synch Database...' : 'Fetch Purchases'}
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>

            {/* List products queried */}
            {customerOrderLogs.length > 0 ? (
              <div className="space-y-4">
                <h3 className="text-base font-bold text-slate-300 font-sans px-1">Orders found ({customerOrderLogs.length})</h3>
                <div className="space-y-3">
                  {customerOrderLogs.map(o => (
                    <div key={o.id} className="bg-slate-900 border border-slate-850 p-5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-sans text-xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-200">{o.order_ref}</span>
                          <span className="text-slate-500 font-mono">#{o.id}</span>
                        </div>
                        <h4 className="font-bold text-slate-100 text-sm">{o.bundle_name} ({o.bundle_data_amount})</h4>
                        <div className="text-slate-400 font-mono text-xxs">Recipient Phone: <strong>{o.customer_phone}</strong> | Date: {new Date(o.created_at).toLocaleDateString()}</div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <div className="text-left sm:text-right font-mono">
                          <span className="text-slate-500 block text-xxs block">PROCESSED FEE</span>
                          <span className="font-bold text-slate-200">₵{Number(o.final_price_ghs).toFixed(2)}</span>
                        </div>

                        <div className="shrink-0 flex gap-2">
                          <span className={`px-2 py-1 rounded font-semibold border ${
                            o.payment_status === 'paid' ? 'bg-emerald-950 text-emerald-300 border-emerald-900' : 'bg-rose-950 text-rose-300 border-rose-900'
                          }`}>
                            Paid: {o.payment_status}
                          </span>
                          <span className={`px-2 py-1 rounded font-semibold border ${
                            o.delivery_status === 'delivered' ? 'bg-emerald-950 text-emerald-300 border-emerald-900' :
                            o.delivery_status === 'failed' ? 'bg-rose-950 text-rose-300 border-rose-900 font-bold' :
                            'bg-amber-950 text-amber-300 border-amber-900'
                          }`}>
                            Delivery: {o.delivery_status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : pastOrdersPhone && !checkingPastOrders && (
              <div className="text-center py-10 bg-slate-900 border border-slate-850 rounded-2xl text-slate-500 text-xs">No orders listed under: {pastOrdersPhone} currently.</div>
            )}
          </div>
        )}

      </main>

      {/* FOOTER COMPONENT VIEW */}
      <footer className={`border-t border-slate-850 pt-10 pb-6 shrink-0 text-slate-400 text-xs font-sans transition-colors duration-300 ${
        siteBgImage ? 'bg-slate-900/85 backdrop-blur-md' : 'bg-slate-900'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-center md:text-left">
              <span className="font-bold text-slate-200 block text-sm">{(view === 'store' && selectedResellerStore) ? selectedResellerStore.store_name : siteName} Ghana</span>
              <p className="text-slate-500 font-sans max-w-sm">Secure, direct distribution catalogs for Cheaper MTN and Telecel data bundles.</p>
            </div>
            
            <div className="flex flex-wrap gap-4 text-xs font-medium">
              {view !== 'store' && (
                <a href="#become-partner" onClick={() => triggerAuth('register', 'reseller')} className="hover:text-amber-400 transition">Partner Reseller program</a>
              )}
              <button onClick={() => setView('my_purchases')} className="hover:text-amber-400 transition">Orders receipts verifying</button>
              <a 
                href="/" 
                onClick={(e) => { 
                  e.preventDefault(); 
                  if (view !== 'store') {
                    setStoreSlug(null); 
                    setView('home'); 
                    fetchGeneralBundles(); 
                  } else {
                    setBundleSearchQuery('');
                  }
                }} 
                className="hover:text-amber-400 transition"
              >
                Catalogs Index
              </a>
            </div>
          </div>

          <div className="border-t border-slate-850 pt-6 flex flex-col sm:flex-row justify-between items-center gap-2 text-slate-500 font-mono text-xxs">
            <span>© 2026 {(view === 'store' && selectedResellerStore) ? selectedResellerStore.store_name : siteName} Inc. All rights reserved. Registered under CAC guidelines.</span>
            <span>Accra, Republic of Ghana</span>
          </div>
        </div>
      </footer>

      {/* Dynamic Online Support Desk Chat UI & Unified WhatsApp circular widgets */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3" id="global-right-floating-controls">
        {/* Support Chat Box */}
        {supportEnabled !== false && isSupportOpen && (
          <div className="w-[calc(100vw-3rem)] sm:w-80 md:w-96 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col h-[400px] overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Header */}
            <div className="bg-slate-850 p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500 flex items-center justify-center">
                    <Headphones className="w-4 h-4 text-amber-500" />
                  </div>
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-slate-900 animate-ping"></span>
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-slate-900"></span>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-200">Online Support Desk</h4>
                  <p className="text-[10px] text-emerald-400 font-medium font-mono">Concierge Contact 24/7</p>
                </div>
              </div>
              <button 
                onClick={() => setIsSupportOpen(false)} 
                className="text-slate-400 hover:text-white p-1 rounded transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Chat Area */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 font-sans text-xs flex flex-col">
              {supportMessages.map(msg => (
                <div 
                  key={msg.id} 
                  className={`max-w-[85%] rounded-2xl p-3 leading-normal ${
                    msg.sender === 'care' 
                      ? 'bg-slate-850 text-slate-200 self-start' 
                      : 'bg-amber-500 text-slate-950 font-semibold self-end'
                  }`}
                >
                  <p>{msg.text}</p>
                  <span className={`block text-[8px] font-mono mt-1 text-right ${
                    msg.sender === 'care' ? 'text-slate-500' : 'text-slate-900/60'
                  }`}>
                    {msg.time}
                  </span>
                </div>
              ))}
              
              {supportTyping && (
                <div className="bg-slate-850 text-slate-400 self-start max-w-[80%] rounded-2xl p-3 flex items-center gap-1 bg-opacity-65">
                  <span className="font-semibold animate-pulse">Support typing</span>
                  <span className="animate-bounce font-bold">.</span>
                  <span className="animate-bounce font-bold delay-100">.</span>
                  <span className="animate-bounce font-bold delay-200">.</span>
                </div>
              )}
            </div>

            {/* Support Quick FAQ Suggestions Grid */}
            <div className="px-4 py-2 bg-slate-950/40 border-t border-slate-850 flex flex-wrap gap-1.5 shrink-0">
              <button 
                onClick={() => handleSupportQuickAction("⚡ Delivery Timeframe")} 
                className="px-2 py-1 bg-slate-850 hover:bg-slate-800 text-[10px] text-slate-300 rounded-lg transition"
              >
                ⚡ Delivery Time
              </button>
              <button 
                onClick={() => handleSupportQuickAction("❌ Transaction Failed?")} 
                className="px-2 py-1 bg-slate-850 hover:bg-slate-800 text-[10px] text-slate-300 rounded-lg transition"
              >
                ❌ Failed Order?
              </button>
              <button 
                onClick={() => handleSupportQuickAction("💳 Payment Methods")} 
                className="px-2 py-1 bg-slate-850 hover:bg-slate-800 text-[10px] text-slate-300 rounded-lg transition"
              >
                💳 Payment Ways
              </button>
            </div>

            {/* Support Form Text Input Footer */}
            <form onSubmit={handleSendSupportMsg} className="p-3 bg-slate-850 border-t border-slate-800 flex gap-2 shrink-0">
              <input
                type="text"
                placeholder="Ask your query here..."
                value={userSupportMsg}
                onChange={(e) => setUserSupportMsg(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-750 focus:border-amber-500 text-xs px-3 py-2 rounded-xl focus:outline-none text-slate-200 placeholder-slate-500"
              />
              <button 
                type="submit" 
                disabled={!userSupportMsg.trim()}
                className="p-2 bg-amber-500 disabled:opacity-40 hover:bg-amber-600 rounded-xl text-slate-950 transition flex items-center justify-center shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        )}

        {/* Floating Action Column arranged vertically (Top to Down: Customer Care / Verify Orders -> WhatsApp Channel -> WhatsApp Community) */}
        <div className="flex flex-col items-end gap-2.5">
          {/* Customer Order Verification Button */}
          {view !== 'my_purchases' && (
            <button
              onClick={() => setView('my_purchases')}
              className="flex items-center gap-2 bg-slate-900 border border-slate-800 text-amber-500 hover:text-amber-400 font-bold px-4 py-3 h-12 rounded-full shadow-lg hover:scale-105 transition-all outline-none shrink-0 cursor-pointer"
              title="Verify Past Purchases / Order History"
              id="global-verify-orders-float-trigger"
            >
              <div className="relative flex items-center justify-center">
                <ShoppingBag className="w-5 h-5 pointer-events-none" />
              </div>
              <span className="text-xs uppercase tracking-wider font-sans hidden sm:inline text-slate-200">Verify My Orders</span>
            </button>
          )}

          {/* Customer Support Desk Button */}
          {supportEnabled !== false && !isSupportOpen && (
            <button
              onClick={() => setIsSupportOpen(true)}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-4 py-3 h-12 rounded-full shadow-lg hover:scale-105 transition-all outline-none shrink-0"
              id="global-support-trigger-button"
            >
              <div className="relative flex items-center justify-center">
                <MessageSquare className="w-5 h-5" />
                <span className="absolute -top-1.5 -right-1.5 w-2 h-2 bg-rose-500 rounded-full animate-ping"></span>
                <span className="absolute -top-1.5 -right-1.5 w-2 h-2 bg-rose-500 rounded-full"></span>
              </div>
              <span className="text-xs uppercase tracking-wider font-sans hidden sm:inline">Online Care Desk</span>
            </button>
          )}

          {supportEnabled !== false && isSupportOpen && (
            <button
              onClick={() => setIsSupportOpen(false)}
              className="flex items-center justify-center bg-rose-600 hover:bg-rose-500 text-white w-12 h-12 rounded-full shadow-lg hover:scale-105 transition-all outline-none shrink-0"
              title="Close Live Support"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          {/* WhatsApp Channel (only on reseller/consumers/admin portal, NOT storefront) */}
          {view !== 'store' && whatsappChannelLink && (
            <a
              href={whatsappChannelLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center bg-teal-600 hover:bg-teal-500 text-white w-12 h-12 rounded-full shadow-lg hover:scale-105 transition-all outline-none shrink-0"
              title="Join official WhatsApp Channel"
              id="global-whatsapp-channel-float"
            >
              <span className="text-xl">📢</span>
            </a>
          )}

          {/* WhatsApp Community (only on reseller/consumers/admin portal, NOT storefront) */}
          {view !== 'store' && whatsappCommunityLink && (
            <a
              href={whatsappCommunityLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center bg-emerald-600 hover:bg-emerald-500 text-white w-12 h-12 rounded-full shadow-lg hover:scale-105 transition-all outline-none shrink-0"
              title="Join WhatsApp Community"
              id="global-whatsapp-community-float"
            >
              <span className="text-xl">👥</span>
            </a>
          )}
        </div>
      </div>

      {/* 5-Star Periodical Review Notification Pop-up Toast (Small, elegant, unclickable corner notification) */}
      {reviewsPopupEnabled && activeReviewPopup && (
        <div 
          className="fixed bottom-6 left-6 z-50 bg-slate-950/90 backdrop-blur-md border border-amber-500/20 p-2.5 rounded-lg shadow-xl max-w-[240px] animate-in fade-in slide-in-from-bottom-3 duration-300 pointer-events-none select-none"
          id="reviews-toast-notification-popup"
        >
          <div className="flex gap-2">
            <span className="text-amber-500 shrink-0 select-none text-sm">⭐</span>
            <div className="space-y-1 flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <h5 className="font-bold text-slate-100 text-[10px] truncate">
                  {activeReviewPopup.name} (5-Star)
                </h5>
                <span className="text-[7px] font-mono font-bold text-slate-900 bg-amber-500 px-0.5 py-0.2 rounded leading-none shrink-0">
                  VERIFIED
                </span>
              </div>
              <p className="text-slate-300 text-[10px] leading-snug italic break-words">
                "{activeReviewPopup.text}"
              </p>
              <div className="flex items-center justify-between text-[8px] text-slate-500 font-mono mt-1 border-t border-slate-800/80 pt-1">
                <span className="truncate max-w-[110px]">Bundle: {activeReviewPopup.product}</span>
                <span className="text-amber-400 font-bold border border-amber-500/10 px-1 rounded bg-amber-500/5 truncate max-w-[85px]">
                  @{view === 'store' && selectedResellerStore ? selectedResellerStore.store_name : (siteName || 'Mac Data Hub')}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CHECKOUT POPUP TRIGGER MODAL */}
      {checkoutBundle && (
        <CheckoutModal 
          bundle={checkoutBundle} 
          reseller={selectedResellerStore} 
          globalTax={globalTax}
          onClose={() => setCheckoutBundle(null)} 
          onSuccess={() => {
            // refresh history list
            if (pastOrdersPhone) handleQueryPurchases();
          }}
        />
      )}

      {/* BLOCK INTEGRATION PAYWALL TRIGGER REGISTRATION MODAL */}
      {regFeePaymentDetails && (
        <CheckoutModal 
          bundle={regFeePaymentDetails} 
          reseller={null} 
          globalTax={globalTax}
          onClose={() => setRegFeePaymentDetails(null)} 
          onSuccess={handleRegFeeSuccess}
        />
      )}

    </div>
  );
}
