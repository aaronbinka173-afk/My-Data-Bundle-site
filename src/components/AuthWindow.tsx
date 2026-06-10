import React, { useState } from 'react';
import { 
  Lock, Mail, Eye, EyeOff, Store, Phone, Keyboard, AlertCircle, Sparkles, CheckSquare
} from 'lucide-react';
import { AdminSettings } from '../types';

interface AuthWindowProps {
  onAuthSuccess: (token: string, user: any) => void;
  onSetView: (v: string) => void;
  onShowPaymentNotification: (amount: number, userId: number, email: string) => void;
  disableResellerRegister?: boolean;
  initialMode?: 'login' | 'register';
  initialRole?: 'customer' | 'reseller';
}

export default function AuthWindow({ 
  onAuthSuccess, 
  onSetView, 
  onShowPaymentNotification, 
  disableResellerRegister = false,
  initialMode = 'login',
  initialRole = 'reseller'
}: AuthWindowProps) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [role, setRole] = useState<'customer' | 'reseller'>(disableResellerRegister ? 'customer' : initialRole);

  React.useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  React.useEffect(() => {
    setRole(disableResellerRegister ? 'customer' : initialRole);
  }, [initialRole, disableResellerRegister]);

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  
  // Reseller specific fields:
  const [storeName, setStoreName] = useState<string>('');
  const [storeSlug, setStoreSlug] = useState<string>('');
  const [phone, setPhone] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const [adminPricePolicy, setAdminPricePolicy] = useState<{ fee: number; enabled: boolean } | null>(null);

  React.useEffect(() => {
    fetch('/api/registration-fee')
      .then(res => {
        if (!res.ok) throw new Error('Failed to retrieve registration settings');
        return res.json();
      })
      .then(data => {
        setAdminPricePolicy({
          fee: data.fee_ghs,
          enabled: data.fee_enabled
        });
      })
      .catch(() => {
        setAdminPricePolicy({ fee: 50.00, enabled: true });
      });
  }, []);

  const handleSlugCalculation = (title: string) => {
    setStoreName(title);
    const slug = title.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-');
    setStoreSlug(slug);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body = mode === 'login' 
        ? { email, password } 
        : { email, password, role, storeName, storeSlug, phone };

      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const d = await resp.json();
      if (!resp.ok) {
        setErrorMessage(d.error || 'Authentication attempt failed.');
        return;
      }

      onAuthSuccess(d.token, d.user);
    } catch (err: any) {
      console.error(err);
      setErrorMessage('Communications failure. Make sure the server backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const showRegistrationPaywallNotification = () => {
    // Basic custom inline alerts triggers
    setErrorMessage('Storefront generated! To activate your URL, please complete the resellers registration fee payment modal below.');
  };

  return (
    <div className="max-w-md w-full mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-slate-100 tracking-tight font-sans flex items-center justify-center gap-1.5">
          <Store className="w-5 h-5 text-amber-500" />
          Mac Data Hub Account Gate
        </h2>
        <p className="text-slate-400 text-sm">
          {mode === 'login' ? 'Please supply credential logs to access dashboards.' : 'Launch customizable storefront pages instantly!'}
        </p>
      </div>



      {errorMessage && (
        <div className="p-3 bg-rose-950/40 text-rose-300 border border-rose-800 font-sans text-xs rounded-lg flex items-start gap-2 leading-relaxed">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Reg vs Login Options buttons */}
      {!disableResellerRegister ? (
        <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-xl">
          <button
            onClick={() => { setMode('login'); setErrorMessage(''); }}
            className={`py-2 text-xs font-semibold uppercase rounded-lg transition ${
              mode === 'login' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Logging In
          </button>
          <button
            onClick={() => { setMode('register'); setErrorMessage(''); }}
            className={`py-2 text-xs font-semibold uppercase rounded-lg transition ${
              mode === 'register' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Create Storefront
          </button>
        </div>
      ) : (
        <div className="text-center bg-slate-950/80 p-3 rounded-xl text-xs font-mono text-slate-400 border border-slate-800/50">
          🔒 Secure Reseller Storefront Portal
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 text-sm text-slate-300">
        
        {/* Toggle buyer vs seller in register mode */}
        {mode === 'register' && !disableResellerRegister && (
          <div className="space-y-2">
            <label className="block text-slate-450 font-mono text-xs">I want to register on Mac Hub as a:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole('customer')}
                className={`p-2.5 rounded-lg border text-xs text-center font-bold tracking-wide uppercase transition ${
                  role === 'customer'
                    ? 'bg-slate-850 border-amber-500 text-amber-500'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                End Consumer
              </button>
              <button
                type="button"
                onClick={() => setRole('reseller')}
                className={`p-2.5 rounded-lg border text-xs text-center font-bold tracking-wide uppercase transition ${
                  role === 'reseller'
                    ? 'bg-slate-850 border-amber-500 text-amber-500'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                Storefront Reseller
              </button>
            </div>
          </div>
        )}

        {/* Email form field */}
        <div className="space-y-1">
          <label className="block text-slate-400 font-mono text-xs">Email address</label>
          <div className="relative">
            <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
            <input
              type="email"
              required
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 pl-10 focus:outline-none focus:border-amber-500 text-slate-200"
            />
          </div>
        </div>

        {/* Password form field */}
        <div className="space-y-1">
          <label className="block text-slate-400 font-mono text-xs">Secret key Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
            <input
              type={showPassword ? 'text' : 'password'}
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 pl-10 pr-10 focus:outline-none focus:border-amber-500 text-slate-200"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-3 text-slate-500 hover:text-slate-300"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Resellers specific detailed block inputs */}
        {mode === 'register' && role === 'reseller' && (
          <div className="space-y-4 border-t border-slate-800/80 pt-4 animate-scaleUp">
            
            <div className="space-y-1">
              <label className="block text-slate-400 font-mono text-xs">My Custom Store Name</label>
              <input
                type="text"
                required={role === 'reseller'}
                placeholder="e.g. Binka Super Bundles"
                value={storeName}
                onChange={(e) => handleSlugCalculation(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:border-amber-500 text-slate-200"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-slate-400 font-mono text-xs">My storefront URL slug</label>
              <div className="flex bg-slate-950 border border-slate-800 rounded-lg overflow-hidden p-0.5">
                <span className="bg-slate-900 border-r border-slate-800/70 text-slate-500 px-2.5 py-1.5 font-mono text-xxs flex items-center">
                  {typeof window !== 'undefined' ? window.location.host : 'localhost:3000'}/store/
                </span>
                <input
                  type="text"
                  required={role === 'reseller'}
                  placeholder="binka-super-bundles"
                  value={storeSlug}
                  onChange={(e) => setStoreSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                  className="w-full bg-transparent p-2.5 text-slate-200 text-xs font-mono focus:outline-none focus:ring-0"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-slate-455 font-mono text-xs">Mobile money Contact Number</label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                <input
                  type="tel"
                  required={role === 'reseller'}
                  placeholder="e.g. 0244123456"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 pl-10 font-mono text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Registration fee disclosure alerts */}
            {adminPricePolicy && adminPricePolicy.enabled && (
              <div className="p-3 bg-amber-950/20 text-amber-400 rounded-lg border border-amber-800/60 flex gap-2.5 items-start">
                <Sparkles className="w-5 h-5 text-amber-500 shrink-0 mt-0.5 animate-pulse" />
                <div className="text-xxxs font-sans leading-normal">
                  Our system currently has a resellers entry fee of <strong className="font-bold text-amber-400">₵{adminPricePolicy.fee?.toFixed(2)} GHS</strong> to mitigate platform operational database costs and unlock unlimited storefront delivery APIs.
                </div>
              </div>
            )}
            {adminPricePolicy && !adminPricePolicy.enabled && (
              <div className="p-3 bg-emerald-950/25 text-emerald-450 rounded-lg border border-emerald-800/50 flex gap-2.5 items-start">
                <Sparkles className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <div className="text-xxxs font-sans leading-normal">
                  🎉 Platform registration is currently <strong className="font-bold text-emerald-400">absolutely FREE!</strong> Create your store now and launch your business with zero upfront fees.
                </div>
              </div>
            )}

          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-6 py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-800 font-bold text-slate-950 text-sm tracking-wide rounded-xl shadow-lg transition duration-250 flex justify-center items-center uppercase"
        >
          {loading ? 'Authenticating ledger...' : (mode === 'login' ? 'Authenticate Access' : 'Create Sandbox Account')}
        </button>

      </form>
    </div>
  );
}
