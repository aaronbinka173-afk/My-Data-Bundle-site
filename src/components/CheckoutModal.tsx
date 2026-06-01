import React, { useState } from 'react';
import { 
  X, CreditCard, Smartphone, CheckCircle, RefreshCw, AlertCircle, Sparkles, Send
} from 'lucide-react';

interface CheckoutModalProps {
  bundle: any;
  reseller: any | null; // null if purchased from main catalog
  globalTax?: any | null; // Optional tax settings from root home
  onClose: () => void;
  onSuccess: () => void;
}

export default function CheckoutModal({ bundle, reseller, globalTax, onClose, onSuccess }: CheckoutModalProps) {
  const [step, setStep] = useState<'details' | 'processing' | 'success' | 'failed'>('details');
  const [buyerEmail, setBuyerEmail] = useState<string>('');
  const [buyerPhone, setBuyerPhone] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'mobile_money' | 'card'>('mobile_money');
  const [momoNetwork, setMomoNetwork] = useState<'MTN' | 'Vodafone' | 'AirtelTigo'>('MTN');
  
  const [checkoutData, setCheckoutData] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [statusPooling, setStatusPooling] = useState<string>('Initiating transaction...');

  const handleInitCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!buyerPhone.trim()) {
      setErrorMessage('Please provide a valid phone number for the bundle delivery.');
      return;
    }

    setStep('processing');
    setErrorMessage('');
    setStatusPooling('Generating payment parameters on Mac Data Hub servers...');

    try {
      const resp = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bundleId: bundle.id,
          customerPhone: buyerPhone.trim(),
          customerEmail: buyerEmail.trim() || undefined,
          resellerId: reseller ? reseller.id : null,
          paymentMethod,
          network: paymentMethod === 'mobile_money' ? momoNetwork : undefined
        })
      });

      const d = await resp.json();
      if (!resp.ok) {
        setErrorMessage(d.error || 'Checkout initiation was declined.');
        setStep('details');
        return;
      }

      setCheckoutData(d);
      setStatusPooling('Awaiting payment verification token...');
    } catch (err) {
      setErrorMessage('Communication block with checkout servers.');
      setStep('details');
    }
  };

  // Load CDN libraries dynamically
  React.useEffect(() => {
    // Paystack CDN
    if (!document.querySelector('script[src="https://js.paystack.co/v1/inline.js"]')) {
      const s = document.createElement('script');
      s.src = 'https://js.paystack.co/v1/inline.js';
      s.async = true;
      document.body.appendChild(s);
    }
    // Flutterwave CDN
    if (!document.querySelector('script[src="https://checkout.flutterwave.com/v3.js"]')) {
      const s = document.createElement('script');
      s.src = 'https://checkout.flutterwave.com/v3.js';
      s.async = true;
      document.body.appendChild(s);
    }
  }, []);

  const startFlutterwavePayment = () => {
    if (!checkoutData) return;
    const FlutterwaveCheckout = (window as any).FlutterwaveCheckout;
    if (!FlutterwaveCheckout) {
      setErrorMessage("Flutterwave payment libraries are still loading... Try again in a brief second.");
      return;
    }

    FlutterwaveCheckout({
      public_key: checkoutData.meta.flw_pub_key,
      tx_ref: checkoutData.reference,
      amount: checkoutData.amount,
      currency: "GHS",
      payment_options: paymentMethod === 'mobile_money' ? "mobilemoneyghana" : "card",
      customer: {
        email: checkoutData.email,
        phone_number: checkoutData.phone,
      },
      customizations: {
        title: "Mac Data Hub Network",
        description: checkoutData.meta.description || "Bundle dispatch services",
        logo: "https://ai.studio/build/favicon.ico"
      },
      callback: async (data: any) => {
        console.log("Flutterwave Inline Payment Finalized:", data);
        if (data.status === "successful" || data.status === "completed") {
          setStep('success');
          onSuccess();
        } else {
          setErrorMessage("Transaction was declined by gateway: " + (data.charge_response_message || 'Declined'));
          setStep('failed');
        }
      },
      onclose: () => {
        setErrorMessage("Payment interface dismissed. You can reopen or try again.");
        setStep('details');
      }
    });
  };

  const startPaystackPayment = () => {
    if (!checkoutData) return;
    const PaystackPop = (window as any).PaystackPop;
    if (!PaystackPop) {
      setErrorMessage("Paystack payment inline dependencies are loading... Try again in a brief second.");
      return;
    }

    const handler = PaystackPop.setup({
      key: checkoutData.meta.paystack_pub_key,
      email: checkoutData.email,
      amount: Math.round(checkoutData.amount * 100), // Paystack asks GHS in pesewas
      currency: "GHS",
      ref: checkoutData.reference,
      channels: paymentMethod === 'mobile_money' ? ['mobile_money'] : ['card'],
      callback: async (response: any) => {
        console.log("Paystack Inline Payment Finalized:", response);
        setStep('success');
        onSuccess();
      },
      onClose: () => {
        setErrorMessage("Paystack inline portal shut by buyer.");
        setStep('details');
      }
    });
    handler.openIframe();
  };

  React.useEffect(() => {
    if (checkoutData && !checkoutData.test_mode) {
      if (checkoutData.payment_gateway === 'flutterwave') {
        setTimeout(() => startFlutterwavePayment(), 1000);
      } else {
        setTimeout(() => startPaystackPayment(), 1000);
      }
    }
  }, [checkoutData]);

  // Triggers instant test success
  const simulateSandboxPayment = async () => {
    if (!checkoutData || !checkoutData.reference) return;
    
    setStatusPooling('Processing simulator checkout bypass keys...');
    try {
      const resp = await fetch('/api/checkout/mock-success', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference: checkoutData.reference })
      });

      const d = await resp.json();
      if (resp.ok) {
        setStep('success');
        onSuccess();
      } else {
        setErrorMessage(d.error || 'Sandbox simulation failed.');
        setStep('failed');
      }
    } catch {
      setErrorMessage('Connection failed during simulation verify.');
      setStep('failed');
    }
  };

  const finalPriceGhs = reseller ? bundle.final_price_ghs : bundle.admin_base_price_ghs;
  const hasTax = reseller 
    ? (reseller.tax && reseller.tax.enabled)
    : (globalTax && globalTax.enabled);
  const taxPercent = hasTax 
    ? (reseller ? Number(reseller.tax.percent || 0) : Number(globalTax.percent || 0)) 
    : 0;
  const taxFlat = hasTax 
    ? (reseller ? Number(reseller.tax.flatGhs || 0) : Number(globalTax.flatGhs || 0)) 
    : 0;
  const calculatedTax = hasTax 
    ? Number((((finalPriceGhs * taxPercent) / 100) + taxFlat).toFixed(2)) 
    : 0;
  const overallPriceGhs = Number((finalPriceGhs + calculatedTax).toFixed(2));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md shadow-2xl relative overflow-hidden flex flex-col">
        
        {/* Header decoration */}
        <div className="bg-slate-850 p-4 border-b border-slate-800 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <span className="p-1 px-1.5 bg-amber-500 rounded text-slate-950 font-mono text-xxs font-bold uppercase">GHS ₵</span>
            <h3 className="font-bold text-slate-200">Secure Purchase Checkout</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal scrolling contents */}
        <div className="p-6 overflow-y-auto max-h-[85vh]">
          {errorMessage && (
            <div className="p-3 bg-rose-950/50 text-rose-300 border border-rose-800 font-sans text-xs rounded-lg mb-4 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {step === 'details' && (
            <form onSubmit={handleInitCheckout} className="space-y-5 text-sm text-slate-300">
              
              {/* Product overview summary */}
              <div className="bg-slate-850 p-4 rounded-xl border border-slate-800/80">
                <span className="text-xxs text-slate-500 font-mono block uppercase">Bundle Package Selected</span>
                <span className="block font-bold text-slate-200 text-lg mt-1">{bundle.name}</span>
                <div className="flex justify-between text-xs mt-3 border-t border-slate-800 pt-2 text-slate-400">
                  <span>Network Carrier: <strong>{bundle.network}</strong></span>
                  <span>Volume size: <strong>{bundle.data_amount}</strong></span>
                </div>
                {reseller && (
                  <div className="mt-2 text-xxs text-amber-500 italic">Buying from trusted partner: {reseller.store_name}</div>
                )}
              </div>

              {/* Email details */}
              <div className="space-y-1">
                <label className="block text-slate-400 font-mono text-xs">Email address (optional)</label>
                <input
                  type="email"
                  placeholder="name@example.com (To receive billing updates)"
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:border-amber-500 text-slate-200"
                />
              </div>

              {/* Recipient details */}
              <div className="space-y-1">
                <label className="block text-slate-450 font-mono text-xs">Bundle Delivery Phone Number (GHS ₵)</label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 0244123456 (Receiver's MoMo number)"
                  value={buyerPhone}
                  onChange={(e) => setBuyerPhone(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 font-mono text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Payment details options */}
              <div className="space-y-2">
                <label className="block text-slate-450 font-mono text-xs">Payment Checkout Gateway Method</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('mobile_money')}
                    className={`flex items-center justify-center gap-2 p-3 rounded-lg border text-xs transition uppercase font-semibold ${
                      paymentMethod === 'mobile_money'
                        ? 'bg-amber-500/10 border-amber-500 text-amber-400'
                        : 'bg-slate-850 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Smartphone className="w-4 h-4" />
                    Mobile Money
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('card')}
                    className={`flex items-center justify-center gap-2 p-3 rounded-lg border text-xs transition uppercase font-semibold ${
                      paymentMethod === 'card'
                        ? 'bg-amber-500/10 border-amber-500 text-amber-400'
                        : 'bg-slate-850 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    Debit Card
                  </button>
                </div>
              </div>

              {/* Mobile Operator drop selector */}
              {paymentMethod === 'mobile_money' && (
                <div className="space-y-2.5 animate-fadeIn">
                  <label className="block text-slate-450 font-mono text-xs">Momo Carrier Platform Network</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'MTN', label: 'MTN MoMo', color: 'border-yellow-600 bg-yellow-900/10 text-yellow-500' },
                      { id: 'Vodafone', label: 'Telecel', color: 'border-red-600 bg-red-900/10 text-red-500' },
                      { id: 'AirtelTigo', label: 'AirtelTigo', color: 'border-cyan-600 bg-cyan-900/10 text-cyan-500' },
                    ].map(net => {
                      const isSel = momoNetwork === net.id;
                      return (
                        <button
                          key={net.id}
                          type="button"
                          onClick={() => setMomoNetwork(net.id as any)}
                          className={`p-2 border text-xxs font-semibold uppercase rounded-lg text-center transition ${
                            isSel ? net.color : 'border-slate-800 bg-slate-850 text-slate-450 hover:text-white'
                          }`}
                        >
                          {net.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Dynamic Customer Tax Surcharge Breakout */}
              {hasTax && calculatedTax > 0 && (
                <div className="bg-slate-950/45 p-3 rounded-lg border border-slate-800 space-y-1 text-xxs font-sans mt-2">
                  <div className="flex justify-between border-b border-slate-800 pb-1 font-bold text-slate-400">
                    <span>Pricing Breakdown</span>
                    <span>Amount</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Data package price:</span>
                    <span>₵{Number(finalPriceGhs).toFixed(2)} GHS</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Storefront tax fee:</span>
                    <span className="text-amber-400 font-semibold">₵{Number(calculatedTax).toFixed(2)} GHS</span>
                  </div>
                  {taxPercent > 0 && taxFlat > 0 && (
                    <span className="text-[9px] text-slate-500 block leading-tight">
                      *Includes {taxPercent}% processing tax rate + GHS {taxFlat.toFixed(2)} flat fee.
                    </span>
                  )}
                  {taxPercent > 0 && taxFlat === 0 && (
                    <span className="text-[9px] text-slate-500 block leading-tight">
                      *Calculated based on {taxPercent}% web service processing surcharge.
                    </span>
                  )}
                  {taxPercent === 0 && taxFlat > 0 && (
                    <span className="text-[9px] text-slate-500 block leading-tight">
                      *Includes a GHS {taxFlat.toFixed(2)} storefront flat convenience tax.
                    </span>
                  )}
                </div>
              )}

              {/* Final price section */}
              <div className="border-t border-slate-800 pt-4 flex justify-between items-center">
                <div>
                  <span className="text-xxs text-slate-500 block uppercase font-mono">Total customer fee</span>
                  <span className="font-extrabold text-slate-200 text-xl font-sans">₵{Number(overallPriceGhs).toFixed(2)} GHS</span>
                </div>
                
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold font-sans rounded-xl transition shadow-xl"
                >
                  Pay via Mobile Money
                  <Send className="w-4 h-4" />
                </button>
              </div>

            </form>
          )}

          {step === 'processing' && checkoutData && (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-6">
              <RefreshCw className="w-10 h-10 text-amber-500 animate-spin" />
              
              <div className="space-y-2">
                <h4 className="font-semibold text-slate-200 text-base">Checkout In-Flight</h4>
                <p className="text-xs text-slate-400 font-mono max-w-xs leading-relaxed">{statusPooling}</p>
              </div>

              <div className="bg-slate-850 p-4 border border-slate-800 rounded-xl space-y-3 w-full text-left font-sans">
                <span className="text-slate-400 text-xs block font-mono border-b border-slate-800 pb-1.5 uppercase">Checkout Transaction Details</span>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Invoice Ref:</span>
                  <span className="font-mono text-slate-200 font-semibold">{checkoutData.reference}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Destination:</span>
                  <span className="font-mono text-emerald-400 font-semibold">{buyerPhone}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Amount due:</span>
                  <span className="text-amber-400 font-bold font-sans text-sm">₵{checkoutData.amount?.toFixed(2)} GHS</span>
                </div>
              </div>

              {/* Simulator Bypass panel */}
              {checkoutData.test_mode && (
                <div className="bg-slate-950/40 p-5 rounded-xl border border-dashed border-amber-500/50 space-y-3 w-full">
                  <div className="flex items-center justify-center gap-1.5 text-xs text-amber-400 font-semibold">
                    <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
                    <span>TEST SIMULATION BYPASS ACTIVE</span>
                  </div>
                  <p className="text-xxs text-slate-500 max-w-xs leading-normal">
                    You of the site can evaluate the complete wallet billing, customer logs, and delivery actions using this custom sandbox validator without real mobile money charges.
                  </p>
                  
                  <button
                    onClick={simulateSandboxPayment}
                    className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-extrabold text-xs tracking-wide rounded-lg transition shadow-lg shrink-0 uppercase"
                  >
                    Simulate Instant Momo Payment Success
                  </button>
                </div>
              )}

              {/* Genuine keys advice statement */}
              {!checkoutData.test_mode && (
                <div className="w-full space-y-3 max-w-xs mx-auto">
                  <p className="text-xxs text-slate-500 leading-normal">
                    Our system verifies transactions automatically. Your payment gateway window should open within a second. If it didn't launch, please click below:
                  </p>
                  <button
                    onClick={() => {
                      if (checkoutData.payment_gateway === 'flutterwave') {
                        startFlutterwavePayment();
                      } else {
                        startPaystackPayment();
                      }
                    }}
                    type="button"
                    className="w-full py-2.5 bg-amber-500 hover:bg-amber-650 text-slate-950 font-bold text-xs rounded-lg transition uppercase tracking-wider shadow-md shrink-0"
                  >
                    Open Payment Window
                  </button>
                </div>
              )}
            </div>
          )}

          {step === 'success' && (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-5 animate-scaleUp">
              <div className="p-3 bg-emerald-950 border border-emerald-800 text-emerald-400 rounded-full">
                <CheckCircle className="w-12 h-12" />
              </div>

              <div className="space-y-1">
                <h4 className="text-lg font-bold text-emerald-400">Transaction Settled successfully!</h4>
                <p className="text-slate-400 text-xs">Your data bundle package is automatically active and queuing for automated SubAndGain network dispatcher delivery.</p>
              </div>

              <div className="bg-slate-850 p-4 rounded-xl border border-slate-800 w-full text-left font-mono text-xs space-y-1.5 text-slate-300">
                <div className="flex justify-between">
                  <span>Product:</span>
                  <span className="font-sans font-semibold text-slate-100">{bundle.name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Receiver Phone:</span>
                  <span className="text-slate-100">{buyerPhone}</span>
                </div>
                <div className="flex justify-between">
                  <span>Invoice:</span>
                  <span className="text-slate-400">{checkoutData?.reference}</span>
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white rounded-lg transition font-semibold text-sm"
              >
                Dismiss Checkout
              </button>
            </div>
          )}

          {step === 'failed' && (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-5">
              <div className="p-3 bg-rose-950 border border-rose-800 text-rose-500 rounded-full">
                <AlertCircle className="w-12 h-12" />
              </div>

              <div className="space-y-1">
                <h4 className="text-lg font-bold text-rose-400">Payment validation failed</h4>
                <p className="text-slate-400 text-xs">We encountered an issue during verification of transaction logs references.</p>
              </div>

              <div className="flex gap-2 w-full pt-4">
                <button
                  onClick={() => setStep('details')}
                  className="w-1/2 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition text-xs font-semibold"
                >
                  Return checkout Form
                </button>
                <button
                  onClick={onClose}
                  className="w-1/2 py-2.5 bg-rose-900 hover:bg-rose-950 text-rose-200 rounded-lg transition text-xs font-semibold border border-rose-800/50"
                >
                  Cancel transaction
                </button>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
