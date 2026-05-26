import React, { useState, useEffect } from 'react';
import { 
  DollarSign, Users, ShoppingCart, Landmark, ArrowUpRight, Copy, Check, Info, Settings2, RefreshCw, AlertCircle
} from 'lucide-react';
import { Bundle, ResellerAccount, WithdrawalRequest, Order } from '../types';
import CheckoutModal from './CheckoutModal';

interface DashboardResellerProps {
  token: string;
  user: any;
}

export default function DashboardReseller({ token, user }: DashboardResellerProps) {
  const [activeTab, setActiveTab] = useState<'stats' | 'pricing' | 'customers' | 'orders' | 'withdrawals'>('stats');
  
  const [loading, setLoading] = useState<boolean>(true);
  const [purchaseBundle, setPurchaseBundle] = useState<any | null>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [bundles, setBundles] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [adminSettings, setAdminSettings] = useState<any>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'danger' } | null>(null);

  // States for updating markup
  const [pricingModalOpen, setPricingModalOpen] = useState<boolean>(false);
  const [updatingBundle, setUpdatingBundle] = useState<any>(null);
  const [markupForm, setMarkupForm] = useState({
    markupType: 'fixed' as 'fixed' | 'percentage',
    markupValue: 0
  });

  // States for requesting withdrawal
  const [withdrawModalOpen, setWithdrawModalOpen] = useState<boolean>(false);
  const [withdrawAmount, setWithdrawAmount] = useState<number>(0);

  // Share link feedback state
  const [copiedStoreLink, setCopiedStoreLink] = useState<boolean>(false);

  useEffect(() => {
    fetchResellerData();
  }, [activeTab]);

  const showNotification = (message: string, type: 'success' | 'danger') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4500);
  };

  const fetchResellerData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
      
      // Fetch public/admin settings to get ceiling validation info
      const setR = await fetch('/api/bundles'); // get active bundles for comparison
      const setG = await fetch('/api/admin/settings', { headers }); // might trigger 403 if not admin, but backend handles it or we map average defaults
      let maxMarkupPercentage = 50;
      if (setG.ok) {
        const sData = await setG.json();
        setAdminSettings(sData);
        maxMarkupPercentage = sData.max_markup_percent;
      }

      if (activeTab === 'stats') {
        const res = await fetch('/api/reseller/dashboard', { headers });
        if (res.ok) setAnalytics(await res.json());
      } else if (activeTab === 'pricing') {
        const res = await fetch('/api/reseller/bundles', { headers });
        if (res.ok) setBundles(await res.json());
      } else if (activeTab === 'customers') {
        const res = await fetch('/api/reseller/customers', { headers });
        if (res.ok) setCustomers(await res.json());
      } else if (activeTab === 'orders') {
        const res = await fetch('/api/reseller/orders', { headers });
        if (res.ok) setOrders(await res.json());
      } else if (activeTab === 'withdrawals') {
        const res = await fetch('/api/reseller/withdrawals', { headers });
        if (res.ok) setWithdrawals(await res.json());
        
        // Refresh balance
        const syncAn = await fetch('/api/reseller/dashboard', { headers });
        if (syncAn.ok) setAnalytics(await syncAn.json());
      }
    } catch (e) {
      console.error(e);
      showNotification('Failed to read partner database resources', 'danger');
    } finally {
      setLoading(false);
    }
  };

  // Click handler to launch pricing editor
  const handleOpenPricingEditor = (b: any) => {
    setUpdatingBundle(b);
    setMarkupForm({
      markupType: b.markup_type || 'fixed',
      markupValue: b.markup_value || 0
    });
    setPricingModalOpen(true);
  };

  const handleSavePricing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updatingBundle) return;

    try {
      const response = await fetch('/api/reseller/pricing', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          bundleId: updatingBundle.id,
          markupType: markupForm.markupType,
          markupValue: Number(markupForm.markupValue)
        })
      });

      const d = await response.json();
      if (response.ok) {
        showNotification('Pricing modifier changed successfully.', 'success');
        setPricingModalOpen(false);
        fetchResellerData();
      } else {
        showNotification(d.error || 'Failed to modify dynamic pricing layout.', 'danger');
      }
    } catch {
      showNotification('System connection failure.', 'danger');
    }
  };

  const handleWithdrawRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!withdrawAmount || withdrawAmount <= 0) return;

    try {
      const response = await fetch('/api/reseller/withdraw', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ amount: Number(withdrawAmount) })
      });

      const d = await response.json();
      if (response.ok) {
        showNotification('Payout request registered. Processing queue updated.', 'success');
        setWithdrawModalOpen(false);
        setWithdrawAmount(0);
        fetchResellerData();
      } else {
        showNotification(d.error || 'Withdrawal rejected.', 'danger');
      }
    } catch {
      showNotification('Glitch submitting withdrawal parameters.', 'danger');
    }
  };

  // Store slug copy link logic
  const copyStorefrontLink = () => {
    const storefrontUrl = `${window.location.protocol}//${window.location.host}/store/${user.store_slug}`;
    navigator.clipboard.writeText(storefrontUrl);
    setCopiedStoreLink(true);
    setTimeout(() => setCopiedStoreLink(false), 3000);
  };

  const calculatedMarkupGhs = (b: any) => {
    if (b.markup_type === 'fixed') {
      return b.markup_value;
    }
    return Number(((b.admin_base_price_ghs * b.markup_value) / 100).toFixed(2));
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5 mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Partner Storefront Portal: {user.store_name}
          </h2>
          <div className="flex flex-wrap items-center gap-3 mt-1 text-xs">
            <span className="text-slate-400 font-mono">My url prefix: store/{user.store_slug}</span>
            <button
              onClick={copyStorefrontLink}
              className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xxs transition font-medium"
            >
              {copiedStoreLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              {copiedStoreLink ? 'Copied URL!' : 'Copy Shareable Link'}
            </button>
          </div>
        </div>

        <button 
          onClick={fetchResellerData}
          className="self-start flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-slate-300 text-sm hover:bg-slate-700 transition rounded-lg"
        >
          <RefreshCw className="w-4 h-4" />
          Synch Stats
        </button>
      </div>

      {notification && (
        <div className={`p-4 rounded-lg mb-6 flex items-center gap-2 text-sm ${
          notification.type === 'success' ? 'bg-emerald-950/50 text-emerald-300 border border-emerald-800' : 'bg-rose-950/55 text-rose-300 border border-rose-800'
        }`}>
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{notification.message}</span>
        </div>
      )}

      {/* Tabs navigation options */}
      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { id: 'stats', label: 'Dashboard Live Stat Counters', icon: DollarSign },
          { id: 'pricing', label: 'Dynamic Store Pricing', icon: Settings2 },
          { id: 'customers', label: 'Distributor Customers', icon: Users },
          { id: 'orders', label: 'Storefront Orders', icon: ShoppingCart },
          { id: 'withdrawals', label: 'Withdrawal Ledger', icon: Landmark },
        ].map(tab => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                isSelected 
                  ? 'bg-amber-500 text-slate-950 shadow-lg font-semibold' 
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-2">
          <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
          <span className="text-slate-400 text-sm">Synchronizing your dashboard...</span>
        </div>
      ) : (
        <div className="mt-2 min-h-[300px]">

          {/* TAB 1: ANALYTICS COUNTERS */}
          {activeTab === 'stats' && analytics && (
            <div className="space-y-6">
              
              {/* Intelligent order reception mode setting */}
              <div className="p-5 bg-gradient-to-r from-slate-900/60 to-slate-850/60 rounded-2xl border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xl">
                <div>
                  <h4 className="text-sm font-extrabold text-slate-100 font-sans tracking-tight">Storefront Order Intake Dispatcher</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed max-w-xl">
                    By default, your storefront dynamically accept &amp; delivers data bundles. Disable order intake to close your customer store during offline periods or maintenance.
                  </p>
                </div>
                
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`text-xxs font-mono font-black tracking-wider px-2.5 py-1 rounded border uppercase ${
                    analytics.storefront_enabled !== false 
                      ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40' 
                      : 'bg-rose-950/40 text-rose-400 border-rose-800/40'
                  }`}>
                    ● {analytics.storefront_enabled !== false ? 'Store Open' : 'Store Closed'}
                  </span>
                  
                  <button
                    onClick={async () => {
                      try {
                        const targetState = analytics.storefront_enabled === false;
                        const r = await fetch('/api/reseller/storefront-status', {
                          method: 'PUT',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                          },
                          body: JSON.stringify({ enabled: targetState })
                        });
                        if (r.ok) {
                          setAnalytics({
                            ...analytics,
                            storefront_enabled: targetState
                          });
                          showNotification(`Your storefront order reception was successfully toggled ${targetState ? 'ON' : 'OFF'}!`, 'success');
                        } else {
                          showNotification('Administrative failure updating storefront status.', 'danger');
                        }
                      } catch (e: any) {
                        showNotification(e.message || 'Network error updating storefront status.', 'danger');
                      }
                    }}
                    className={`px-4 py-2 text-xxs font-black uppercase rounded-lg transition-all cursor-pointer shadow-md ${
                      analytics.storefront_enabled !== false
                        ? 'bg-rose-600 hover:bg-rose-700 text-white hover:shadow-rose-600/10'
                        : 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 hover:shadow-emerald-500/10'
                    }`}
                  >
                    {analytics.storefront_enabled !== false ? 'Turn Off Store' : 'Turn On Store'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                
                <div className="bg-slate-800/40 p-5 rounded-xl border border-slate-800">
                  <span className="text-slate-400 text-xs font-mono block uppercase">Cash Balance Available</span>
                  <div className="text-3xl font-extrabold font-sans text-amber-400 mt-2">₵{analytics.balance_ghs?.toFixed(2)}</div>
                  <button 
                    onClick={() => setWithdrawModalOpen(true)}
                    className="mt-4 flex items-center justify-center gap-1 w-full text-center py-1.5 bg-slate-800 hover:bg-slate-700 hover:text-white rounded text-xs transition border border-slate-800"
                  >
                    Request Payout
                    <ArrowUpRight className="w-3.5 h-3.5 text-amber-500" />
                  </button>
                </div>

                <div className="bg-slate-800/40 p-5 rounded-xl border border-slate-800 flex flex-col justify-between">
                  <div>
                    <span className="text-slate-400 text-xs font-mono block uppercase">Total Earnings Collected</span>
                    <div className="text-3xl font-extrabold font-sans text-slate-200 mt-2">₵{analytics.total_earned_ghs?.toFixed(2)}</div>
                  </div>
                  <p className="text-xxs text-slate-500 border-t border-slate-850 pt-2 mt-4 italic font-sans">Accumulated profit across store lifeline</p>
                </div>

                <div className="bg-slate-800/40 p-5 rounded-xl border border-slate-800 flex flex-col justify-between">
                  <div>
                    <span className="text-slate-400 text-xs font-mono block uppercase">Active Consumers Acquired</span>
                    <div className="text-3xl font-extrabold font-sans text-emerald-400 mt-2">{analytics.total_customers_acquired}</div>
                  </div>
                  <p className="text-xxs text-slate-500 border-t border-slate-850 pt-2 mt-4 italic font-sans">Distinct phone buyers live</p>
                </div>

                <div className="bg-slate-800/40 p-5 rounded-xl border border-slate-800 flex flex-col justify-between">
                  <div>
                    <span className="text-slate-400 text-xs font-mono block uppercase">Payout Requests In-Flight</span>
                    <div className="text-3xl font-extrabold font-sans text-indigo-400 mt-2">₵{analytics.pending_withdrawal_ghs?.toFixed(2)}</div>
                  </div>
                  <p className="text-xxs text-slate-500 border-t border-slate-850 pt-2 mt-4 italic font-sans">Awaiting admin transaction clearing</p>
                </div>

              </div>

              {/* Helpful Information and Community Hub */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-slate-800/20 p-5 rounded-xl border border-slate-800 flex gap-4 text-sm text-slate-300">
                  <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="font-semibold text-slate-200">Reseller Commission Flow Instructions</h4>
                    <p className="text-slate-400 leading-relaxed text-xs">
                      Your storefront dynamic links let friends buy MTN data, Vodafone bundles or other network packages directly using your markup indexes.
                      Once a consumer settlements mobile money checkouts, our system deducts the administrative cost, automatically allocates their gigabytes, and places the remaining margin into your available cash wallet instantly!
                    </p>
                  </div>
                </div>

                {analytics?.whatsapp_community_link && (
                  <div className="bg-emerald-950/25 p-5 rounded-xl border border-emerald-800/20 flex flex-col justify-between gap-4 text-sm text-slate-200 relative overflow-hidden group">
                    <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl group-hover:bg-emerald-500/10 transition"></div>
                    <div className="flex gap-3">
                      <span className="text-xl shrink-0">💬</span>
                      <div className="space-y-1">
                        <h4 className="font-semibold text-emerald-400 font-sans tracking-tight">Resellers WhatsApp Hub</h4>
                        <p className="text-slate-400 text-[11px] leading-relaxed">
                          Join our secure reseller-only WhatsApp group to get instant platform updates, plan status logs, and live network digests.
                        </p>
                      </div>
                    </div>
                    <a
                      href={analytics.whatsapp_community_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full text-center py-2 bg-emerald-500 hover:bg-emerald-600 font-extrabold font-sans text-xs text-slate-950 rounded-lg transition-all shadow-md hover:shadow-emerald-500/10"
                    >
                      Join WhatsApp Community
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: STORE PRICING CONTROLLERS */}
          {activeTab === 'pricing' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-medium text-slate-200">Catalog Storefront Profit Modifiers</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Define are markup offsets added above baseline administrative price indexes.</p>
                </div>
                {adminSettings && (
                  <span className="px-3 py-1 bg-amber-950 text-amber-300 border border-amber-800 font-mono text-xs rounded-lg">
                    Global Markup Ceiling: {adminSettings.max_markup_percent}% max profit
                  </span>
                )}
              </div>

              {bundles.length === 0 ? (
                <div className="text-center py-10 bg-slate-850 rounded text-slate-500">No data bundle systems found inside global catalog pools yet.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {bundles.map(b => {
                    const addedPriceValue = calculatedMarkupGhs(b);
                    return (
                      <div key={b.id} className="bg-slate-800/30 border border-slate-800 rounded-xl p-5 flex flex-col justify-between hover:border-slate-700 transition">
                        <div>
                          <div className="flex justify-between items-start gap-2">
                            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                              {b.network}
                            </span>
                            <span className="text-xs font-mono text-slate-500">
                              Base Cost: ₵{Number(b.admin_base_price_ghs).toFixed(2)}
                            </span>
                          </div>
                          
                          <h4 className="font-bold text-slate-200 text-base mt-3">{b.name}</h4>
                          <p className="text-xs text-slate-400 mt-1">Package Volume: {b.data_amount} ({b.validity_days} Days)</p>

                          <div className="border-t border-slate-850 pt-3 mt-4 space-y-1.5 text-xs text-slate-300">
                            <div className="flex justify-between">
                              <span className="text-slate-500">My pricing markup:</span>
                              <span className="font-mono text-emerald-400 font-semibold">
                                {b.markup_type === 'percentage' ? `${b.markup_value}%` : `₵${b.markup_value?.toFixed(2)}`} (+₵{addedPriceValue?.toFixed(2)})
                              </span>
                            </div>
                            <div className="flex justify-between text-sm font-semibold border-t border-slate-850 pt-1.5">
                              <span className="text-slate-200">Store Retail Price:</span>
                              <span className="text-amber-400 font-sans text-base font-bold">₵{b.final_price_ghs?.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 flex gap-2 w-full">
                          <button
                            onClick={() => handleOpenPricingEditor(b)}
                            className="w-1/2 text-center py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded text-xs transition font-semibold"
                          >
                            Modify Markup
                          </button>
                          <button
                            onClick={() => setPurchaseBundle(b)}
                            className="w-1/2 text-center py-2 bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-900/30 text-emerald-300 rounded text-xs transition font-semibold flex items-center justify-center gap-1"
                          >
                            <ShoppingCart className="w-3.5 h-3.5 text-emerald-400" />
                            Buy Direct
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CUSTOMERS */}
          {activeTab === 'customers' && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-slate-200">Referred Customer Purchases</h3>
              {customers.length === 0 ? (
                <div className="text-center py-10 bg-slate-850 rounded text-slate-500">No direct referred customer records registered yet. Share store dynamically.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase font-mono text-xs">
                        <th className="py-3 px-4">Contact Phone Number</th>
                        <th className="py-3 px-4">Email profile</th>
                        <th className="py-3 px-4">Total Orders Created</th>
                        <th className="py-3 px-4 text-right">Cumulative Purchases Spent (GHS)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customers.map((c, i) => (
                        <tr key={i} className="border-b border-slate-850 hover:bg-slate-850/50 text-slate-300">
                          <td className="py-3 px-4 font-semibold font-mono text-slate-100">{c.phone}</td>
                          <td className="py-3 px-4 text-slate-400 font-sans">{c.email}</td>
                          <td className="py-3 px-4">{c.totalOrders} Purchases</td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-amber-400">₵{Number(c.totalSpent).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: STORE ORDERS HISTORIES */}
          {activeTab === 'orders' && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-slate-200">Store Order Logs Book</h3>
              {orders.length === 0 ? (
                <div className="text-center py-10 bg-slate-850 rounded text-slate-500">Your storefront has zero in-flight orders currently.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase font-mono text-xs">
                        <th className="py-3 px-4">Order Ref</th>
                        <th className="py-3 px-4">Volume Plan</th>
                        <th className="py-3 px-4">Client Number</th>
                        <th className="py-3 px-4">Customer Net Paid</th>
                        <th className="py-3 px-4">Markup Net Earned</th>
                        <th className="py-3 px-4">Created date</th>
                        <th className="py-3 px-4 text-right">State</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map(o => (
                        <tr key={o.id} className="border-b border-slate-850 hover:bg-slate-850/50 text-slate-300">
                          <td className="py-3 px-4 font-mono font-semibold text-slate-400">{o.order_ref}</td>
                          <td className="py-3 px-4 text-slate-200 font-semibold">{o.bundle_name} / {o.bundle_data_amount}</td>
                          <td className="py-3 px-4 font-mono font-semibold text-slate-300">{o.customer_phone}</td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-300">₵{Number(o.final_price_ghs).toFixed(2)}</td>
                          <td className="py-3 px-4 font-mono font-bold text-emerald-400">₵{Number(o.net_to_reseller_ghs).toFixed(2)}</td>
                          <td className="py-3 px-4 text-xs text-slate-500">{new Date(o.created_at).toLocaleDateString()}</td>
                          <td className="py-3 px-4 text-right text-xs">
                            <span className={`px-2 py-0.5 rounded font-mono font-semibold capitalize ${
                              o.payment_status === 'paid' ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-900' : 'bg-rose-950/70 text-rose-300 border border-rose-900'
                            }`}>
                              {o.payment_status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: WITHDRAWALS */}
          {activeTab === 'withdrawals' && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-slate-200">My Withdrawal Requests Ledger</h3>
              {withdrawals.length === 0 ? (
                <div className="text-center py-10 bg-slate-850 rounded text-slate-500">You have no recorded withdrawal requests. Hit "Request Payout" under Analytics.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase font-mono text-xs">
                        <th className="py-3 px-4">Claim Reference</th>
                        <th className="py-3 px-4">Requested payout</th>
                        <th className="py-3 px-4">Processing Fee</th>
                        <th className="py-3 px-4">Net Payout</th>
                        <th className="py-3 px-4">Created at</th>
                        <th className="py-3 px-4 font-center">Processing status</th>
                        <th className="py-3 px-4 text-right">Reason (On Decline)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {withdrawals.map(w => (
                        <tr key={w.id} className="border-b border-slate-850 hover:bg-slate-850/50 text-slate-300">
                          <td className="py-3 px-4 font-mono font-semibold text-slate-400">#WR-{w.id}</td>
                          <td className="py-3 px-4 font-mono font-bold text-amber-500 text-sm">₵{Number(w.amount_ghs).toFixed(2)}</td>
                          <td className="py-3 px-4 font-mono text-rose-450 text-xs">
                            ₵{(w.fee_ghs !== undefined ? Number(w.fee_ghs) : 0).toFixed(2)}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-emerald-400 text-sm">
                            ₵{(w.net_amount_ghs !== undefined ? Number(w.net_amount_ghs) : Number(w.amount_ghs)).toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-500">{new Date(w.created_at).toLocaleDateString()}</td>
                          <td className="py-3 px-4 text-xs">
                            <span className={`px-2 py-0.5 rounded uppercase font-semibold ${
                              w.status === 'pending' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                              w.status === 'approved' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                              'bg-rose-950 text-rose-300 border border-rose-800'
                            }`}>
                              {w.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right text-xs text-rose-400 italic">
                            {w.decline_reason || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* MODAL: PRICING EDITOR POPUP */}
      {pricingModalOpen && updatingBundle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-100">Set margin: {updatingBundle.name}</h3>
            
            <form onSubmit={handleSavePricing} className="space-y-4 text-sm text-slate-300">
              
              <div>
                <label className="block mb-1 text-slate-400 font-mono text-xs">Markup system type</label>
                <select
                  value={markupForm.markupType}
                  onChange={(e) => setMarkupForm({ ...markupForm, markupType: e.target.value as any })}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-200"
                >
                  <option value="fixed">Fixed Flat Fee Added (GHS ₵)</option>
                  <option value="percentage">Percentage Markup added (%)</option>
                </select>
              </div>

              <div>
                <label className="block mb-1 text-slate-400 font-mono text-xs">Markup Profit Goal</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={markupForm.markupValue}
                  onChange={(e) => setMarkupForm({ ...markupForm, markupValue: Number(e.target.value) })}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 focus:outline-none focus:border-amber-500 text-slate-200"
                />
              </div>

              {/* Estimate Preview */}
              <div className="bg-slate-850 p-3 rounded text-xs text-slate-400 border border-slate-800 font-sans space-y-1">
                <div className="flex justify-between">
                  <span>Administrative base price:</span>
                  <span className="font-mono">₵{Number(updatingBundle.admin_base_price_ghs).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Custom profit markup added:</span>
                  <span className="font-mono text-emerald-400">
                    +₵{(markupForm.markupType === 'fixed' ? markupForm.markupValue : (updatingBundle.admin_base_price_ghs * markupForm.markupValue) / 100).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-800 pt-1 text-slate-200 font-semibold">
                  <span>Estimated Catalog Storefront Retail Price:</span>
                  <span className="font-mono text-amber-400 text-sm">
                    ₵{(Number(updatingBundle.admin_base_price_ghs) + (markupForm.markupType === 'fixed' ? markupForm.markupValue : (updatingBundle.admin_base_price_ghs * markupForm.markupValue) / 100)).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-3">
                <button
                  type="button"
                  onClick={() => setPricingModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-450 hover:text-white rounded transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded transition"
                >
                  Save margins
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL: WITHDRAWAL REQUEST POPUP */}
      {withdrawModalOpen && analytics && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-100">Claim Wallet Payout Withdrawal</h3>
            <p className="text-xs text-slate-400">Request mobile money manual transaction payout of your available wallet balance.</p>

            <form onSubmit={handleWithdrawRequest} className="space-y-4 text-sm text-slate-300">
              
              <div className="bg-slate-850 p-3 rounded font-sans flex justify-between text-xs text-slate-300 border border-slate-800">
                <span>Total GHS Balance:</span>
                <span className="font-mono font-bold text-emerald-400">₵{analytics.balance_ghs?.toFixed(2)}</span>
              </div>

              <div>
                <label className="block mb-1 text-slate-400 font-mono text-xs">Withdrawal cash amount (₵)</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  placeholder="0.00"
                  max={analytics.balance_ghs}
                  value={withdrawAmount || ''}
                  onChange={(e) => setWithdrawAmount(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 focus:outline-none focus:border-amber-500 text-slate-200"
                />
              </div>

              {withdrawAmount > 0 && adminSettings && (
                <div className="bg-slate-950/40 p-3 rounded text-xs space-y-1.5 border border-slate-800">
                  <div className="flex justify-between text-slate-450">
                    <span>Processing Retention Fee ({(adminSettings as any).withdrawal_fee_percent || 0}%):</span>
                    <span className="font-mono text-rose-400">
                      -₵{Number(((withdrawAmount * ((adminSettings as any).withdrawal_fee_percent || 0)) / 100).toFixed(2)).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-200 font-medium pt-1.5 border-t border-slate-850">
                    <span>Net payout amount:</span>
                    <span className="font-mono text-emerald-400">
                      ₵{Number((withdrawAmount - Number(((withdrawAmount * ((adminSettings as any).withdrawal_fee_percent || 0)) / 100).toFixed(2))).toFixed(2)).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setWithdrawModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-450 hover:text-white rounded transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!withdrawAmount || withdrawAmount <= 0 || withdrawAmount > analytics.balance_ghs}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded transition disabled:opacity-40"
                >
                  Submit claim request
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {purchaseBundle && (
        <CheckoutModal
          bundle={purchaseBundle}
          reseller={null} // Resellers purchase at cheap base cost with zero markup
          onClose={() => setPurchaseBundle(null)}
          onSuccess={() => {
            setPurchaseBundle(null);
            fetchResellerData();
          }}
        />
      )}

    </div>
  );
}
