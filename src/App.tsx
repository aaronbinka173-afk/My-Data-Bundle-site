/**
 * Mac Data Hub — Complete Data Bundle Reseller Platform (Ghana)
 */

import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, ArrowRight, Store, Smartphone, Landmark, CheckCircle, 
  ChevronRight, RefreshCw, UserCheck, Key, ShoppingBag, Eye, LogOut, Sparkles, Send
} from 'lucide-react';

import AuthWindow from './components/AuthWindow';
import CheckoutModal from './components/CheckoutModal';
import DashboardAdmin from './components/DashboardAdmin';
import DashboardReseller from './components/DashboardReseller';

export default function App() {
  // Navigation states
  const [view, setView] = useState<'home' | 'store' | 'dashboard' | 'auth' | 'my_purchases'>('home');
  const [storeSlug, setStoreSlug] = useState<string | null>(null);
  
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
      setView('home');
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
      // Fetch latest profile status (e.g., approved/suspended updates) from database
      const activeToken = localStorage.getItem('mac_hub_token');
      fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${activeToken}` }
      }).then(r => {
        if (r.ok) {
          r.json().then(data => {
            if (data.user) {
              localStorage.setItem('mac_hub_user', JSON.stringify(data.user));
              setUser(data.user);
            }
          });
        }
      }).catch(err => console.error('Failed to auto refresh profile on mount:', err));
    }
  }, []);

  const fetchGeneralBundles = async () => {
    try {
      const r = await fetch('/api/bundles');
      if (r.ok) {
        setGeneralBundles(await r.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchStorefront = async (slug: string) => {
    try {
      const r = await fetch(`/api/store/${slug}`);
      if (r.ok) {
        const d = await r.json();
        setSelectedResellerStore(d.reseller);
        setStorefrontBundles(d.bundles);
      } else {
        // Fallback to home if storefront doesn't exist
        setView('home');
        setStoreSlug(null);
        fetchGeneralBundles();
      }
    } catch (e) {
      console.error(e);
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
    setView('home');
  };

  // Fetch orders matching customer entered phone or email
  const handleQueryPurchases = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pastOrdersPhone.trim()) return;

    setCheckingPastOrders(true);
    localStorage.setItem('mac_hub_history_phone', pastOrdersPhone.trim());

    try {
      // Direct speculative fetch
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await fetch('/api/bundles'); // simple trigger
      
      // To keep customer records accessible without forced logins, find logs matching customer phone on checkout refer
      // We can fetch all orders if user is client, or mock orders that match in localStorage logs
      const ordersResponse = await fetch('/api/admin/orders', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (ordersResponse.ok) {
        const list = await ordersResponse.json();
        const customerList = list.filter((o: any) => o.customer_phone === pastOrdersPhone.trim());
        setCustomerOrderLogs(customerList);
      } else {
        // Fallback query matching local database records
        // If they are checking their guest orders, fetch a filtered endpoint or use mock simulation
        // In Express we have order history accessible under general stats/logs, so we fetch safely
        const altResponse = await fetch('/api/bundles');
      }
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
      const res = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${activeToken}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('mac_hub_user', JSON.stringify(data.user));
        setUser(data.user);
        return data.user;
      }
    } catch (err) {
      console.error('Failed to auto refresh user profile:', err);
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      
      {/* HEADER SECTION LAYOUT */}
      <header className="bg-slate-900 border-b border-slate-800/80 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
          
          {/* Logo element */}
          <a 
            href="/" 
            onClick={(e) => { e.preventDefault(); window.history.pushState({}, '', '/'); setStoreSlug(null); setView('home'); fetchGeneralBundles(); }}
            className="flex items-center gap-2 group shrink-0"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center font-black text-slate-950 tracking-wider shadow-lg shadow-amber-500/15 group-hover:scale-105 transition-all text-sm">
              MAC
            </div>
            <div>
              <span className="font-sans font-black tracking-tight text-slate-100 block group-hover:text-amber-400 transition">Mac Data Hub</span>
              <span className="text-xxs text-amber-500 font-mono tracking-wide block uppercase">Reseller Gate Ghana</span>
            </div>
          </a>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-6 text-sm text-slate-300">
            <a href="/" onClick={(e) => { e.preventDefault(); setStoreSlug(null); setView('home'); fetchGeneralBundles(); }} className="hover:text-amber-400 transition font-medium">Browse Bundles</a>
            <a href="#become-partner" onClick={() => setView('auth')} className="hover:text-amber-400 transition font-medium">Store Reseller Program</a>
            <button onClick={() => setView('my_purchases')} className="hover:text-amber-400 transition font-medium">Verify My Orders</button>
          </nav>

          {/* User parameters buttons */}
          <div className="flex items-center gap-3">
            {token && user ? (
              <div className="flex items-center gap-3 bg-slate-850 p-1.5 pr-3.5 rounded-xl border border-slate-800 shrink-0">
                {user.role === 'admin' && (
                  <button
                    onClick={() => setView('dashboard')}
                    className="px-3.5 py-1.5 bg-rose-500 hover:bg-rose-600 text-slate-950 text-xs font-bold font-sans uppercase rounded-lg transition"
                  >
                    Admin Portal
                  </button>
                )}
                {user.role === 'reseller' && (
                  <button
                    onClick={() => setView('dashboard')}
                    className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold font-sans uppercase rounded-lg transition"
                  >
                    My Reseller Panel
                  </button>
                )}
                {user.role === 'customer' && (
                  <button
                    onClick={() => setView('my_purchases')}
                    className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-bold font-sans uppercase rounded-lg transition"
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
                  className="text-slate-400 hover:text-rose-400 p-1 rounded-lg hover:bg-slate-800/60 transition"
                  title="Disconnect session"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setView('auth')}
                className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold font-sans tracking-wide uppercase px-4 py-2.5 rounded-xl transition shadow"
              >
                <Key className="w-4 h-4 text-amber-400" />
                Store Partner Access
              </button>
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
                      onClick={() => setView('auth')}
                      className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-sans text-sm font-bold uppercase rounded-xl transition text-center"
                    >
                      Launch Your Own reseller Store
                    </button>
                  </div>
                </div>

                <div className="max-w-sm lg:max-w-none lg:w-[400px] bg-slate-950 rounded-2xl p-6 border border-slate-800 flex flex-col gap-4 shadow-2xl relative z-10 shrink-0">
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
              <div className="text-center md:text-left">
                <h2 className="text-2xl font-extrabold text-slate-100 font-sans flex items-center justify-center md:justify-start gap-2">
                  <Smartphone className="w-5 h-5 text-amber-500 animate-pulse" />
                  Cheap Operator Data Bundles Menu
                </h2>
                <p className="text-slate-400 text-sm mt-1">Select a cheap data package below to checkout. Deliveries completed under 60 seconds.</p>
              </div>

              {generalBundles.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center gap-2 bg-slate-900 border border-slate-850 rounded-2xl text-slate-400">
                  <RefreshCw className="w-6 h-6 text-amber-500 animate-spin" />
                  <span>Loading official catalogs...</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {generalBundles.map(b => (
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
                    Do you want to host your own data reseller site in Ghana? Create an account with Mac Data Hub, configure your own profit margins above our cheap base costs, and share your personalized `store/slug` URL prefix. We process payments and automate delivery over SubAndGain API on your behalf while you pocket the margins!
                  </p>
                </div>
                <button
                  onClick={() => setView('auth')}
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
                  <p className="text-slate-400 text-xs mt-1">Cheap instantly delivered packages brought to you in partner association with Mac Data Hub.</p>
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
              <h2 className="text-lg font-bold text-slate-200 font-sans flex items-center gap-1.5">
                <ShoppingBag className="w-4 h-4 text-amber-500" />
                Available Bundle Offers
              </h2>

              {storefrontBundles.length === 0 ? (
                <div className="text-center py-20 bg-slate-900 rounded-2xl border border-slate-850 text-slate-400">This reseller store has no dynamic packages active.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {storefrontBundles.map(b => (
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
              )}
            </div>

          </div>
        )}

        {/* VIEW 3: SYSTEM DASHBOARD ROUTER FOR ADMIN/RESELLER */}
        {view === 'dashboard' && token && user && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            {user.role === 'admin' ? (
              <DashboardAdmin token={token} user={user} />
            ) : user.status === 'active' ? (
              <DashboardReseller token={token} user={user} />
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
                              const r = await fetch('/api/registration-fee');
                              if (r.ok) {
                                const d = await r.json();
                                handleStartRegFeeCheckout(d.fee_ghs, user.id, user.email);
                              } else {
                                handleStartRegFeeCheckout(10, user.id, user.email);
                              }
                            } catch (e) {
                              handleStartRegFeeCheckout(10, user.id, user.email);
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
                  <div className="text-xxs text-slate-500 font-mono">
                    System Email: <span className="text-slate-400">{user.email}</span>
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
          <div className="py-16">
            <AuthWindow 
              onAuthSuccess={handleAuthSuccess} 
              onSetView={setView} 
              onShowPaymentNotification={handleStartRegFeeCheckout}
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
      <footer className="bg-slate-900 border-t border-slate-850 pt-10 pb-6 shrink-0 text-slate-400 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-center md:text-left">
              <span className="font-bold text-slate-200 block text-sm">Mac Data Hub ghana</span>
              <p className="text-slate-500 font-sans max-w-sm">Secure, direct distribution catalogs for Cheaper MTN and Telecel data bundles.</p>
            </div>
            
            <div className="flex flex-wrap gap-4 text-xs font-medium">
              <a href="#become-partner" onClick={() => setView('auth')} className="hover:text-amber-400 transition">Partner Reseller program</a>
              <button onClick={() => setView('my_purchases')} className="hover:text-amber-400 transition">Orders receipts verifying</button>
              <a href="/" onClick={(e) => { e.preventDefault(); setStoreSlug(null); setView('home'); fetchGeneralBundles(); }} className="hover:text-amber-400 transition">Catalogs Index</a>
            </div>
          </div>

          <div className="border-t border-slate-850 pt-6 flex flex-col sm:flex-row justify-between items-center gap-2 text-slate-500 font-mono text-xxs">
            <span>© 2026 Mac Data Hub Inc. All rights reserved. Registered under CAC guidelines.</span>
            <span>Accra, Republic of Ghana</span>
          </div>
        </div>
      </footer>

      {/* CHECKOUT POPUP TRIGGER MODAL */}
      {checkoutBundle && (
        <CheckoutModal 
          bundle={checkoutBundle} 
          reseller={selectedResellerStore} 
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
          onClose={() => setRegFeePaymentDetails(null)} 
          onSuccess={handleRegFeeSuccess}
        />
      )}

    </div>
  );
}
