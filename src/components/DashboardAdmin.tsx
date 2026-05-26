import React, { useState, useEffect } from 'react';
import { 
  Users, BarChart3, Database, Landmark, Settings, RefreshCw, AlertCircle, CheckCircle2, XCircle, 
  Trash2, Edit, Plus, Eye, History, Key, MessageSquare, Send, Smartphone, ShoppingCart
} from 'lucide-react';
import { Bundle, ResellerAccount, WithdrawalRequest, Order, DataDeliveryLog, AdminSettings } from '../types';
import CheckoutModal from './CheckoutModal';

interface DashboardAdminProps {
  token: string;
  user?: any;
}

export default function DashboardAdmin({ token, user }: DashboardAdminProps) {
  const [activeTab, setActiveTab] = useState<'stats' | 'bundles' | 'resellers' | 'withdrawals' | 'orders' | 'logs' | 'settings'>('stats');
  
  // States
  const [purchaseBundle, setPurchaseBundle] = useState<Bundle | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [resellers, setResellers] = useState<ResellerAccount[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [deliveryLogs, setDeliveryLogs] = useState<DataDeliveryLog[]>([]);
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'danger' } | null>(null);

  // Bundle Edit/Create States
  const [bundleModalOpen, setBundleModalOpen] = useState<boolean>(false);
  const [editingBundle, setEditingBundle] = useState<Bundle | null>(null);
  const [bundleForm, setBundleForm] = useState({
    name: '',
    network: 'MTN' as any,
    data_amount: '',
    validity_days: 30,
    admin_base_price_ghs: 0,
    provider_plan_code: '',
    status: 'active' as any
  });

  // Decline withdrawal form
  const [declineId, setDeclineId] = useState<number | null>(null);
  const [declineReason, setDeclineReason] = useState<string>('');

  // Retry states
  const [retryingId, setRetryingId] = useState<number | null>(null);

  // Password change states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordChangeStatus, setPasswordChangeStatus] = useState<{ message: string; type: 'success' | 'danger' } | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Reseller Password Reset States (Admin resetting reseller)
  const [resettingUser, setResettingUser] = useState<ResellerAccount | null>(null);
  const [resellerResetPassword, setResellerResetPassword] = useState('');
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);

  // Agent SMS states
  const [smsModalOpen, setSmsModalOpen] = useState(false);
  const [smsTarget, setSmsTarget] = useState('all');
  const [smsMessage, setSmsMessage] = useState('');
  const [smsMaskId, setSmsMaskId] = useState('MAC-HUB');
  const [smsLogs, setSmsLogs] = useState<any[]>([]);
  const [smsLogsLoading, setSmsLogsLoading] = useState(false);
  const [smsDispatchLoading, setSmsDispatchLoading] = useState(false);
  const [togglingResellerId, setTogglingResellerId] = useState<number | null>(null);

  // Custom Confirmation Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    actionLabel?: string;
    actionType?: 'primary' | 'danger' | 'success';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const requestConfirmation = (
    title: string, 
    message: string, 
    onConfirm: () => void, 
    actionLabel: string = "Confirm",
    actionType: 'primary' | 'danger' | 'success' = 'primary'
  ) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      actionLabel,
      actionType,
      onConfirm: () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        onConfirm();
      }
    });
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const showNotification = (message: string, type: 'success' | 'danger') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4500);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
      
      if (activeTab === 'stats') {
        const r1 = await fetch('/api/admin/dashboard', { headers });
        if (r1.ok) setStats(await r1.json());
      } else if (activeTab === 'bundles') {
        const r2 = await fetch('/api/admin/bundles', { headers });
        if (r2.ok) setBundles(await r2.json());
      } else if (activeTab === 'resellers') {
        const r3 = await fetch('/api/admin/resellers', { headers });
        if (r3.ok) setResellers(await r3.json());
      } else if (activeTab === 'withdrawals') {
        const r4 = await fetch('/api/admin/withdrawals', { headers });
        if (r4.ok) setWithdrawals(await r4.json());
      } else if (activeTab === 'orders') {
        const r5 = await fetch('/api/admin/orders', { headers });
        if (r5.ok) setOrders(await r5.json());
      } else if (activeTab === 'logs') {
        const r6 = await fetch('/api/admin/delivery-logs', { headers });
        if (r6.ok) setDeliveryLogs(await r6.json());
      } else if (activeTab === 'settings') {
        const r7 = await fetch('/api/admin/settings', { headers });
        if (r7.ok) setSettings(await r7.json());
      }
    } catch (e) {
      console.error('Fetch error:', e);
      showNotification('Failed to retrieve server-side panel data.', 'danger');
    } finally {
      setLoading(false);
    }
  };

  // Bundle Handlers
  const handleSaveBundle = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
      const url = editingBundle ? `/api/admin/bundles/${editingBundle.id}` : '/api/admin/bundles';
      const method = editingBundle ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers,
        body: JSON.stringify({
          ...bundleForm,
          admin_base_price_ghs: Number(bundleForm.admin_base_price_ghs),
          validity_days: Number(bundleForm.validity_days)
        })
      });

      if (response.ok) {
        showNotification(editingBundle ? 'Bundle was successfully modified.' : 'New bundle added to inventory.', 'success');
        setBundleModalOpen(false);
        setEditingBundle(null);
        fetchData();
      } else {
        const data = await response.json();
        showNotification(data.error || 'Failed to submit bundle values.', 'danger');
      }
    } catch {
      showNotification('Communication error.', 'danger');
    }
  };

  const handleOpenEditBundle = (b: Bundle) => {
    setEditingBundle(b);
    setBundleForm({
      name: b.name,
      network: b.network,
      data_amount: b.data_amount,
      validity_days: b.validity_days,
      admin_base_price_ghs: b.admin_base_price_ghs,
      provider_plan_code: b.provider_plan_code,
      status: b.status
    });
    setBundleModalOpen(true);
  };

  const handleOpenCreateBundle = () => {
    setEditingBundle(null);
    setBundleForm({
      name: '',
      network: 'MTN',
      data_amount: '',
      validity_days: 30,
      admin_base_price_ghs: 0,
      provider_plan_code: '',
      status: 'active'
    });
    setBundleModalOpen(true);
  };

  const handleDeleteBundle = async (id: number) => {
    requestConfirmation(
      'Permanently Delete Bundle?',
      'Are you sure you want to permanently delete this bundle? This action can disrupt reseller store price indexes.',
      async () => {
        try {
          const res = await fetch(`/api/admin/bundles/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
            showNotification('Item was deleted from catalogs.', 'success');
            fetchData();
          }
        } catch {
          showNotification('System connection error.', 'danger');
        }
      },
      'Delete Bundle',
      'danger'
    );
  };

  // Reseller suspension
  const handleToggleReseller = async (reseller: ResellerAccount) => {
    if (reseller.role === 'admin' && user?.email?.toLowerCase() !== 'aaronbinka173@gmail.com') {
      showNotification('Only the platform owner can suspend or reactivate other administrator accounts.', 'danger');
      return;
    }

    const isSuspended = reseller.status === 'suspended';
    const action = isSuspended ? 'reactivate' : 'suspend';
    const rId = reseller.user_id || (reseller as any).id;
    if (!rId) {
      showNotification('Cannot identify reseller account ID.', 'danger');
      return;
    }

    requestConfirmation(
      `${isSuspended ? 'Activate' : 'Suspend'} Reseller Account?`,
      `Are you sure you want to ${action} reseller storefront: "${reseller.store_name}"?`,
      async () => {
        setTogglingResellerId(rId);
        try {
          const res = await fetch(`/api/admin/resellers/${rId}/${action}`, {
            method: 'PUT',
            headers: { 
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          const data = await res.json().catch(() => ({}));
          if (res.ok) {
            showNotification(data.message || `Reseller account state was toggled successfully.`, 'success');
            fetchData();
          } else {
            showNotification(data.error || `Failed to ${action} reseller account.`, 'danger');
          }
        } catch (err) {
          showNotification('Failed to toggle reseller credentials due to system error.', 'danger');
        } finally {
          setTogglingResellerId(null);
        }
      },
      isSuspended ? 'Activate Account' : 'Suspend Account',
      isSuspended ? 'success' : 'danger'
    );
  };

  // Reseller approval
  const handleApproveReseller = async (reseller: ResellerAccount) => {
    const rId = reseller.user_id || (reseller as any).id;
    if (!rId) {
      showNotification('Cannot identify reseller account ID.', 'danger');
      return;
    }

    requestConfirmation(
      'Approve Reseller Storefront?',
      `Are you sure you want to approve and activate reseller storefront: "${reseller.store_name}"?`,
      async () => {
        setTogglingResellerId(rId);
        try {
          const res = await fetch(`/api/admin/resellers/${rId}/approve`, {
            method: 'PUT',
            headers: { 
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          const data = await res.json().catch(() => ({}));
          if (res.ok) {
            showNotification(data.message || `Reseller store approved & activated!`, 'success');
            fetchData();
          } else {
            showNotification(data.error || `Failed to approve reseller account.`, 'danger');
          }
        } catch (err) {
          showNotification('Failed to approve reseller due to system error.', 'danger');
        } finally {
          setTogglingResellerId(null);
        }
      },
      'Approve & Activate',
      'success'
    );
  };

  // Toggle administrative access privileges for reseller
  const handleToggleAdmin = async (reseller: ResellerAccount) => {
    const callerEmail = user?.email?.toLowerCase();
    if (callerEmail !== 'aaronbinka173@gmail.com') {
      showNotification('Only the platform owner can grant or revoke administrative access.', 'danger');
      return;
    }

    const isGrantedAdmin = reseller.role === 'admin';
    const actionDesc = isGrantedAdmin ? 'revoke administrative portal and API credentials from' : 'grant complete administrative workspace access privileges to';
    const actionBtn = isGrantedAdmin ? 'Revoke Admin' : 'Grant Admin';
    const actionType = isGrantedAdmin ? 'danger' : 'success';
    const rId = reseller.user_id || (reseller as any).id;

    if (!rId) {
      showNotification('Cannot identify reseller account ID.', 'danger');
      return;
    }

    requestConfirmation(
      `${isGrantedAdmin ? 'Revoke' : 'Grant'} Admin Privileges?`,
      `Are you sure you want to ${actionDesc} reseller workspace: "${reseller.store_name}" (${reseller.email})? Once processed, they can access all admin features.`,
      async () => {
        setTogglingResellerId(rId);
        try {
          const res = await fetch(`/api/admin/resellers/${rId}/toggle-admin`, {
            method: 'PUT',
            headers: { 
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          const data = await res.json().catch(() => ({}));
          if (res.ok) {
            showNotification(data.message || `Administrative role state updated!`, 'success');
            fetchData();
          } else {
            showNotification(data.error || 'Failed to update administrative permission settings.', 'danger');
          }
        } catch (err) {
          showNotification('System connection issue updating credentials.', 'danger');
        } finally {
          setTogglingResellerId(null);
        }
      },
      actionBtn,
      actionType
    );
  };

  // Withdrawal approve/decline
  const handleApproveW = async (id: number) => {
    requestConfirmation(
      'Confirm Payout Completed?',
      'Are you sure you want to certify this payout? This will deduct the profit margin amount from the reseller store balance.',
      async () => {
        try {
          const res = await fetch(`/api/admin/withdrawals/${id}/approve`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
            showNotification('Withdrawal payout certified.', 'success');
            fetchData();
          } else {
            const d = await res.json();
            showNotification(d.error || 'Failed to approve request.', 'danger');
          }
        } catch {
          showNotification('Communication glitch.', 'danger');
        }
      },
      'Confirm Paid',
      'success'
    );
  };

  const handleDeclineW = async () => {
    if (!declineId || !declineReason.trim()) return;
    try {
      const res = await fetch(`/api/admin/withdrawals/${declineId}/decline`, {
        method: 'PUT',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ declineReason })
      });
      if (res.ok) {
        showNotification('Request was marked declined. Balance restored.', 'success');
        setDeclineId(null);
        setDeclineReason('');
        fetchData();
      }
    } catch {
      showNotification('Connection failure.', 'danger');
    }
  };

  // Manual delivery logs retry trigger
  const handleRetryDelivery = async (logId: number) => {
    setRetryingId(logId);
    try {
      const res = await fetch(`/api/admin/delivery-logs/${logId}/retry`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const d = await res.json();
      if (res.ok) {
        showNotification(d.message || 'Delivery success!', 'success');
        fetchData();
      } else {
        showNotification(d.error || 'Retry attempt was declined by API endpoint.', 'danger');
      }
    } catch {
      showNotification('API connection timed out.', 'danger');
    } finally {
      setRetryingId(null);
    }
  };

  // Sync System Settings modifications
  const handleUpdateRegFee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    try {
      const res = await fetch('/api/admin/settings/registration-fee', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: settings.registration_fee_ghs, enabled: settings.registration_fee_enabled })
      });
      if (res.ok) {
        showNotification('Store registration entry paywall updated.', 'success');
        fetchData();
      }
    } catch {
      showNotification('Transmission error.', 'danger');
    }
  };

  const handleUpdateLimits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    try {
      const res = await fetch('/api/admin/settings/max-markup', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxPercent: settings.max_markup_percent })
      });
      if (res.ok) {
        showNotification('Markup policy enforced across all stores.', 'success');
        fetchData();
      }
    } catch {
      showNotification('Transmission error.', 'danger');
    }
  };

  const handleUpdateAdminFees = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    try {
      const res = await fetch('/api/admin/settings/admin-fee', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ feePercent: settings.admin_fee_percent, source: settings.admin_fee_source })
      });
      if (res.ok) {
        showNotification('Admin transactional sales fee index altered.', 'success');
        fetchData();
      }
    } catch {
      showNotification('Transmission error.', 'danger');
    }
  };

  const handleUpdateGatewaySettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    try {
      const res = await fetch('/api/admin/settings/gateway', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_gateway: settings.payment_gateway,
          paystack_public_key: settings.paystack_public_key,
          paystack_secret_key: settings.paystack_secret_key,
          flutterwave_public_key: settings.flutterwave_public_key,
          flutterwave_secret_key: settings.flutterwave_secret_key,
        })
      });
      if (res.ok) {
        showNotification('Payment gateway credentials stored securely.', 'success');
        fetchData();
      } else {
        const d = await res.json().catch(() => ({}));
        showNotification(d.error || 'Failed to update gateway settings.', 'danger');
      }
    } catch {
      showNotification('Transmission error.', 'danger');
    }
  };

  const handleUpdateDataApiSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    try {
      const res = await fetch('/api/admin/settings/data-api', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data_api_username: settings.data_api_username,
          data_api_key: settings.data_api_key,
          data_api_url: settings.data_api_url,
        })
      });
      if (res.ok) {
        showNotification('SubAndGain data dispatcher API configuration stored successfully.', 'success');
        fetchData();
      } else {
        const d = await res.json().catch(() => ({}));
        showNotification(d.error || 'Failed to update Data API settings.', 'danger');
      }
    } catch {
      showNotification('Transmission error.', 'danger');
    }
  };

  const handleToggleTestMode = async (enabled: boolean) => {
    if (!settings) return;
    try {
      const res = await fetch('/api/admin/settings/test-mode', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
      if (res.ok) {
        setSettings({ ...settings, test_mode_enabled: enabled });
        showNotification(`Simulator sandbox toggled to: ${enabled ? 'ACTIVE (Mock payments)' : 'LIVE (True Gateway)'}`, 'success');
        fetchData();
      }
    } catch {
      showNotification('Transmission error.', 'danger');
    }
  };

  const handleUpdateWithdrawalFee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    try {
      const res = await fetch('/api/admin/settings/withdrawal-fee', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ feePercent: settings.withdrawal_fee_percent })
      });
      if (res.ok) {
        showNotification('Withdrawal payout processing fee rate saved successfully.', 'success');
        fetchData();
      } else {
        const d = await res.json().catch(() => ({}));
        showNotification(d.error || 'Failed to update withdrawal fee.', 'danger');
      }
    } catch {
      showNotification('Transmission error.', 'danger');
    }
  };

  const handleUpdateWhatsappLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    try {
      const res = await fetch('/api/admin/settings/whatsapp-community', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ link: settings.whatsapp_community_link })
      });
      if (res.ok) {
        showNotification('WhatsApp reseller community invite link updated.', 'success');
        fetchData();
      } else {
        const d = await res.json().catch(() => ({}));
        showNotification(d.error || 'Failed to update WhatsApp link.', 'danger');
      }
    } catch {
      showNotification('Transmission error.', 'danger');
    }
  };

  const fetchSmsLogs = async () => {
    setSmsLogsLoading(true);
    try {
      const response = await fetch('/api/admin/sms-logs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSmsLogs(data);
      }
    } catch (err) {
      console.error('Failed to fetch SMS logs:', err);
    } finally {
      setSmsLogsLoading(false);
    }
  };

  const handleResetResellerPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingUser) return;
    if (resettingUser.role === 'admin' && user?.email?.toLowerCase() !== 'aaronbinka173@gmail.com') {
      showNotification('Only the platform owner can reset other administrator passwords.', 'danger');
      return;
    }
    if (!resellerResetPassword || resellerResetPassword.length < 6) {
      showNotification('New password must be at least 6 characters.', 'danger');
      return;
    }

    setResetPasswordLoading(true);
    try {
      const response = await fetch(`/api/admin/resellers/${resettingUser.user_id}/reset-password`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ newPassword: resellerResetPassword })
      });

      const data = await response.json();
      if (response.ok) {
        showNotification(data.message || `Password reset for ${resettingUser.store_name} succeeded!`, 'success');
        setResettingUser(null);
        setResellerResetPassword('');
      } else {
        showNotification(data.error || 'Failed to reset password.', 'danger');
      }
    } catch {
      showNotification('Connection error while resetting reseller password.', 'danger');
    } finally {
      setResetPasswordLoading(false);
    }
  };

  const handleSendSmsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!smsMessage.trim()) {
      showNotification('Please enter an SMS message body.', 'danger');
      return;
    }

    setSmsDispatchLoading(true);
    try {
      const response = await fetch('/api/admin/send-sms', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          target: smsTarget,
          message: smsMessage,
          maskId: smsMaskId
        })
      });

      const data = await response.json();
      if (response.ok) {
        showNotification(data.messagePrefix || 'One-Way Alphanumeric SMS successfully broadcasted!', 'success');
        setSmsMessage('');
        fetchSmsLogs();
        // keep modal open so they see past logs, or close if they wish
      } else {
        showNotification(data.error || 'Failed to dispatch outbound SMS.', 'danger');
      }
    } catch {
      showNotification('Network boundary error dispatching SMS.', 'danger');
    } finally {
      setSmsDispatchLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setPasswordChangeStatus({ message: 'All password fields are required.', type: 'danger' });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordChangeStatus({ message: 'New passwords do not match.', type: 'danger' });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordChangeStatus({ message: 'New password must be at least 6 characters long.', type: 'danger' });
      return;
    }

    setPasswordLoading(true);
    setPasswordChangeStatus(null);

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });

      const data = await response.json();
      if (response.ok) {
        setPasswordChangeStatus({ message: 'Password changed successfully!', type: 'success' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
      } else {
        setPasswordChangeStatus({ message: data.error || 'Failed to change password.', type: 'danger' });
      }
    } catch (err) {
      setPasswordChangeStatus({ message: 'Connection error. Please try again.', type: 'danger' });
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5 mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-slate-100 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
            Mac Data Hub — Admin Control Center
          </h2>
          <p className="text-slate-400 text-sm mt-1">Configure global pricing, manage storefronts, verify payouts and audit transaction delivery.</p>
        </div>
        
        <button 
          onClick={fetchData}
          className="self-start flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-slate-300 text-sm hover:bg-slate-700 transition rounded-lg"
        >
          <RefreshCw className="w-4 h-4" />
          Full System Refresh
        </button>
      </div>

      {notification && (
        <div className={`p-4 rounded-lg mb-6 flex items-center gap-2 text-sm ${
          notification.type === 'success' ? 'bg-emerald-950/55 text-emerald-300 border border-emerald-800' : 'bg-rose-950/55 text-rose-300 border border-rose-800'
        }`}>
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{notification.message}</span>
        </div>
      )}

      {/* Admin navigation tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { id: 'stats', label: 'Dashboard Analytics', icon: BarChart3 },
          { id: 'bundles', label: 'Base Bundles', icon: Database },
          { id: 'resellers', label: 'Partner Resellers', icon: Users },
          { id: 'withdrawals', label: 'Withdrawal Requests', icon: Landmark },
          { id: 'orders', label: 'Orders & Sales', icon: History },
          { id: 'logs', label: 'Delivery Logs', icon: RefreshCw },
          { id: 'settings', label: 'App Settings', icon: Settings },
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
          <span className="text-slate-400 text-sm">Synchronizing ledger records...</span>
        </div>
      ) : (
        <div className="mt-2 min-h-[400px]">
          
          {/* TAB 1: STATISTICS / ANALYTICS */}
          {activeTab === 'stats' && stats && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-800/50 p-5 rounded-xl border border-slate-800">
                  <span className="text-slate-400 text-xs font-mono block">PARTNER STORES</span>
                  <div className="text-3xl font-bold font-sans text-slate-200 mt-2">{stats.total_resellers}</div>
                  <p className="text-xs text-slate-500 mt-1">Vetted storefronts live</p>
                </div>
                <div className="bg-slate-800/50 p-5 rounded-xl border border-slate-800">
                  <span className="text-slate-400 text-xs font-mono block">TOTAL CUSTOMERS</span>
                  <div className="text-3xl font-bold font-sans text-slate-200 mt-2">{stats.total_customers}</div>
                  <p className="text-xs text-slate-500 mt-1">Unique shoppers served</p>
                </div>
                <div className="bg-slate-800/50 p-5 rounded-xl border border-slate-800">
                  <span className="text-slate-400 text-xs font-mono block">ACCUMULATED SALES REVENUE</span>
                  <div className="text-3xl font-bold font-sans text-amber-400 mt-2">₵{stats.total_revenue_ghs?.toFixed(2)}</div>
                  <p className="text-xs text-slate-500 mt-1">Registrations + Bundles</p>
                </div>
                <div className="bg-slate-800/50 p-5 rounded-xl border border-slate-800">
                  <span className="text-slate-400 text-xs font-mono block">ADMIN ROYALTY FEES EARNED</span>
                  <div className="text-3xl font-bold font-sans text-emerald-400 mt-2">₵{stats.total_admin_fees_earned_ghs?.toFixed(2)}</div>
                  <p className="text-xs text-slate-500 mt-1">From reseller retail margins</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-800/30 p-5 rounded-xl border border-slate-800 space-y-3">
                  <h3 className="text-lg font-medium text-slate-200 border-b border-slate-800 pb-2">Entry & Fee Breakdown</h3>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Total Registration Fees Collected:</span>
                    <span className="font-semibold text-slate-200">₵{stats.total_registrations_earned_ghs?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Paid Bundle Orders:</span>
                    <span className="font-semibold text-slate-200">{stats.total_orders} Transactions</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Total Payouts processed:</span>
                    <span className="font-semibold text-rose-400">₵{stats.withdrawal_payouts_ghs?.toFixed(2)}</span>
                  </div>
                </div>

                <div className="bg-slate-800/30 p-5 rounded-xl border border-slate-800 flex flex-col justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-slate-200 border-b border-slate-800 pb-2">Outstanding Action Items</h3>
                    <div className="flex items-center gap-3 mt-4 text-sm text-slate-300">
                      <Landmark className="w-5 h-5 text-amber-500" />
                      <span>There are currently <strong className="text-amber-400 font-bold">{stats.pending_withdrawals}</strong> partner payout withdrawals awaiting approval.</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => setActiveTab('withdrawals')}
                    className="w-full mt-4 text-center py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm transition"
                  >
                    Open Payout Queue
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: INVENTORY BUNDLES CRUD */}
          {activeTab === 'bundles' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-slate-200">System Base Data Bundles</h3>
                <button
                  onClick={handleOpenCreateBundle}
                  className="flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold px-4 py-2 rounded-lg text-sm transition"
                >
                  <Plus className="w-4 h-4" />
                  Create New Bundle
                </button>
              </div>

              {bundles.length === 0 ? (
                <div className="text-center py-10 bg-slate-850 rounded-lg text-slate-400 text-sm">No bundle catalogs inside inventory. Click custom creation button to index.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase font-mono text-xs">
                        <th className="py-3 px-4">Bundle ID</th>
                        <th className="py-3 px-4">Plan Name</th>
                        <th className="py-3 px-4">Operator Network</th>
                        <th className="py-3 px-4">Size</th>
                        <th className="py-3 px-4">Validity</th>
                        <th className="py-3 px-4">Admin Cost</th>
                        <th className="py-3 px-4">API Code</th>
                        <th className="py-3 px-4">State</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bundles.map(b => (
                        <tr key={b.id} className="border-b border-slate-850 hover:bg-slate-800/30 text-slate-300">
                          <td className="py-3.5 px-4 font-mono text-slate-500">#{b.id}</td>
                          <td className="py-3.5 px-4 font-semibold text-slate-100">{b.name}</td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                              b.network === 'MTN' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                              b.network === 'Vodafone' ? 'bg-red-950 text-red-300 border border-red-800' :
                              'bg-cyan-950 text-cyan-300 border border-cyan-800'
                            }`}>
                              {b.network === 'Vodafone' ? 'Telecel' : b.network}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">{b.data_amount}</td>
                          <td className="py-3.5 px-4">{b.validity_days} Days</td>
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-200">₵{Number(b.admin_base_price_ghs).toFixed(2)}</td>
                          <td className="py-3.5 px-4 font-mono text-slate-400">{b.provider_plan_code}</td>
                          <td className="py-3.5 px-4">
                            <span className={`px-1.5 py-0.5 rounded text-xxs font-semibold uppercase ${
                              b.status === 'active' ? 'bg-emerald-950 text-emerald-300' : 'bg-rose-950 text-rose-300'
                            }`}>
                              {b.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex justify-end items-center gap-3 text-slate-400">
                              <button
                                onClick={() => setPurchaseBundle(b)}
                                className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-800/40 text-emerald-300 rounded text-xs font-semibold font-sans transition"
                                title="Purchase and process this bundle directly"
                              >
                                <ShoppingCart className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Buy Direct</span>
                              </button>
                              <button onClick={() => handleOpenEditBundle(b)} className="hover:text-amber-500 transition" title="Modify details">
                                <Edit className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleDeleteBundle(b.id)} className="hover:text-rose-500 transition" title="Delete">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: RESELLERS LIST */}
          {activeTab === 'resellers' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-medium text-slate-200">Registered Partner Stores</h3>
                  <p className="text-xs text-slate-400">Manage agents, reset credentials, and send alphanumeric notifications.</p>
                </div>
                <button
                  onClick={() => {
                    setSmsTarget('all');
                    setSmsModalOpen(true);
                    fetchSmsLogs();
                  }}
                  className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 px-4 py-2 rounded-lg text-sm font-semibold shadow-lg transition"
                >
                  <MessageSquare className="w-4 h-4" />
                  SMS Agent Broadcast
                </button>
              </div>

              {resellers.length === 0 ? (
                <div className="text-center py-12 text-slate-400">No resellers live yet. Promote storefront CTA to seed registration.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase font-mono text-xs">
                        <th className="py-3 px-4">Store Creator</th>
                        <th className="py-3 px-4">Contact URL slug</th>
                        <th className="py-3 px-4">Cash balance</th>
                        <th className="py-3 px-4">Total Margin Earnings</th>
                        <th className="py-3 px-4">Active Customers</th>
                        <th className="py-3 px-4">State</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resellers.map(r => (
                        <tr key={r.user_id} className="border-b border-slate-850 hover:bg-slate-850/50 text-slate-300">
                          <td className="py-3.5 px-4">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-semibold text-slate-100">{r.store_name}</span>
                              {r.role === 'admin' && (
                                <span className="bg-amber-500/10 text-amber-500 text-[10px] font-bold px-1.5 py-0.5 rounded border border-amber-500/30 uppercase tracking-wide">
                                  Admin
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500">{r.email}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <a 
                               href={`/store/${r.store_slug}`} 
                               target="_blank" 
                               rel="noreferrer" 
                               className="text-amber-400 hover:underline font-mono text-xs"
                            >
                              store/{r.store_slug}
                            </a>
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-200">₵{Number(r.balance_ghs).toFixed(2)}</td>
                          <td className="py-3.5 px-4 font-mono text-emerald-400">₵{Number(r.total_earned_ghs).toFixed(2)}</td>
                          <td className="py-3.5 px-4">{r.total_customers}</td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2 py-0.5 rounded text-xxs font-semibold uppercase border ${
                              r.status === 'active' ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800' :
                              r.status === 'pending_approval' ? 'bg-amber-950/80 text-amber-300 border-amber-800 animate-pulse font-bold' :
                              r.status === 'pending_payment' ? 'bg-slate-800/80 text-slate-350 border-slate-750' :
                              'bg-rose-950/80 text-rose-300 border-rose-800'
                            }`}>
                              {r.status === 'pending_approval' ? 'Awaiting Approval' : r.status === 'pending_payment' ? 'Awaiting Payment' : r.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex justify-end items-center gap-2">
                              {/* Approve account button */}
                              {r.status !== 'active' && r.status !== 'suspended' && (
                                <button
                                  onClick={() => handleApproveReseller(r)}
                                  disabled={togglingResellerId === r.user_id}
                                  className="px-2 py-1 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-slate-950 rounded flex items-center gap-1 text-xs font-bold transition-colors shadow shadow-emerald-500/10"
                                  title="Approve and activate reseller storefront"
                                >
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Approve</span>
                                </button>
                              )}
 
                              {/* Toggle Admin Privileges */}
                              <button
                                onClick={() => handleToggleAdmin(r)}
                                disabled={togglingResellerId === r.user_id}
                                className={`px-2 py-1 rounded text-xs transition border font-semibold ${
                                  r.role === 'admin'
                                    ? 'bg-amber-950/55 text-amber-400 border-amber-800/50 hover:bg-amber-905'
                                    : 'bg-indigo-950/50 text-indigo-400 border-indigo-800/20 hover:bg-indigo-900/60'
                                } ${togglingResellerId === r.user_id ? 'opacity-50 cursor-not-allowed' : ''}`}
                                title={r.role === 'admin' ? 'Revoke System Admin Privileges' : 'Grant System Admin Privileges'}
                              >
                                {r.role === 'admin' ? 'Revoke Admin' : 'Grant Admin'}
                              </button>
 
                              {/* Direct SMS button */}
                              <button
                                onClick={() => {
                                  setSmsTarget(String(r.user_id));
                                  setSmsModalOpen(true);
                                  fetchSmsLogs();
                                }}
                                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-750 hover:border-amber-500/50 rounded flex items-center gap-1 text-xs font-semibold transition-colors"
                                title="Send SMS notification (One-Way Alphanumeric)"
                              >
                                <Smartphone className="w-3 h-3" />
                                <span>SMS</span>
                              </button>
 
                              {/* Reset password button */}
                              <button
                                onClick={() => {
                                  setResettingUser(r);
                                  setResellerResetPassword('');
                                }}
                                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-750 hover:border-slate-500 rounded flex items-center gap-1 text-xs font-semibold transition-colors"
                                title="Reset Agent Password"
                              >
                                <Key className="w-3 h-3 text-slate-400" />
                                <span>Reset Pass</span>
                              </button>
 
                              {/* Suspension actions */}
                              <button
                                onClick={() => handleToggleReseller(r)}
                                disabled={togglingResellerId === r.user_id}
                                className={`px-2 py-1 rounded text-xs transition border font-semibold ${
                                  r.status === 'suspended'
                                    ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/40 hover:bg-emerald-900/60'
                                    : 'bg-rose-950/30 text-rose-400 border-rose-800/30 hover:bg-rose-900/40'
                                } ${togglingResellerId === r.user_id ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                {togglingResellerId === r.user_id ? 'Wait...' : r.status === 'suspended' ? 'Activate' : 'Suspend'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: WITHDRAWAL REQUESTS */}
          {activeTab === 'withdrawals' && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-slate-200">Pending & Historical Cash Payout Requests</h3>

              {declineId && (
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 space-y-3">
                  <span className="text-slate-200 text-sm font-semibold">Flag decline context for request #{declineId}</span>
                  <input
                    type="text"
                    placeholder="Provide description reason (e.g. Please verify mobile money name matching)..."
                    value={declineReason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                  <div className="flex gap-2">
                    <button onClick={handleDeclineW} className="bg-rose-600 hover:bg-rose-700 text-white text-xs px-3 py-1.5 rounded transition">
                      Confirm Decline
                    </button>
                    <button onClick={() => setDeclineId(null)} className="bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs px-3 py-1.5 rounded transition">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {withdrawals.length === 0 ? (
                <div className="text-center py-12 text-slate-400">Payout system is completely empty. No payout requests registered.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase font-mono text-xs">
                        <th className="py-3 px-4">Request Ref</th>
                        <th className="py-3 px-4">Storefront Partner</th>
                        <th className="py-3 px-4">Requested amount (GHS)</th>
                        <th className="py-3 px-4">Processing Fee</th>
                        <th className="py-3 px-4">Net Payout</th>
                        <th className="py-3 px-4">Created Date</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Resolution Options</th>
                      </tr>
                    </thead>
                    <tbody>
                      {withdrawals.map(w => (
                        <tr key={w.id} className="border-b border-slate-850 hover:bg-slate-850/30 text-slate-300">
                          <td className="py-3.5 px-4 font-mono font-medium text-slate-400">#WR-{w.id}</td>
                          <td className="py-3.5 px-4">
                            <span className="font-semibold text-slate-200">{w.reseller_store_name}</span>
                            <span className="block text-xs text-slate-500">{w.reseller_email}</span>
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-amber-500">₵{Number(w.amount_ghs).toFixed(2)}</td>
                          <td className="py-3.5 px-4 font-mono text-rose-400 text-xs">
                            ₵{(w.fee_ghs !== undefined ? Number(w.fee_ghs) : 0).toFixed(2)}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">
                            ₵{(w.net_amount_ghs !== undefined ? Number(w.net_amount_ghs) : Number(w.amount_ghs)).toFixed(2)}
                          </td>
                          <td className="py-3.5 px-4 text-xs text-slate-400">{new Date(w.created_at).toLocaleDateString()}</td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2 py-0.5 rounded text-xxs font-semibold uppercase ${
                              w.status === 'pending' ? 'bg-amber-950/50 text-amber-300 border border-amber-800' :
                              w.status === 'approved' ? 'bg-emerald-950/50 text-emerald-300 border border-emerald-800' :
                              'bg-rose-950/50 text-rose-300 border border-rose-800'
                            }`}>
                              {w.status}
                            </span>
                            {w.decline_reason && (
                              <p className="text-rose-400 text-xs mt-1 font-sans italic">{w.decline_reason}</p>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {w.status === 'pending' ? (
                              <div className="flex justify-end gap-1.5">
                                <button
                                  onClick={() => handleApproveW(w.id)}
                                  className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-600 text-white rounded text-xs font-semibold transition"
                                >
                                  Payout completed
                                </button>
                                <button
                                  onClick={() => setDeclineId(w.id)}
                                  className="px-2.5 py-1 bg-rose-950 hover:bg-rose-900 text-rose-300 rounded text-xs transition border border-rose-800/50"
                                >
                                  Decline
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-500 italic">Resolved on {new Date(w.processed_at || w.created_at).toLocaleDateString()}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: GLOBAL ORDERS SUMMARY */}
          {activeTab === 'orders' && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-slate-200">Global Customer Order Book Ledger</h3>
              {orders.length === 0 ? (
                <div className="text-center py-12 text-slate-400">Order ledger is fully empty. Start checkout test sessions to populate data.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase font-mono text-xs">
                        <th className="py-3 px-4">Reference ID</th>
                        <th className="py-3 px-4">Store Outlet</th>
                        <th className="py-3 px-4">Client Detail</th>
                        <th className="py-3 px-4">Size & Plan</th>
                        <th className="py-3 px-4">Price paid</th>
                        <th className="py-3 px-4">Net profit</th>
                        <th className="py-3 px-4">Admin Tax</th>
                        <th className="py-3 px-4">Payment</th>
                        <th className="py-3 px-4">Bundle Delivery</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map(o => (
                        <tr key={o.id} className="border-b border-slate-850 hover:bg-slate-850/30 text-slate-300">
                          <td className="py-3.5 px-4 font-mono font-semibold text-slate-300">
                            {o.order_ref}
                            <span className="block text-xxs font-mono text-slate-500 mt-1">{new Date(o.created_at).toLocaleString()}</span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-semibold text-slate-200">{o.reseller_store_name || 'Mac Direct Hub'}</span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-300">
                            <strong>{o.customer_phone}</strong>
                            <span className="block text-slate-500 text-xs">{o.customer_email}</span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-semibold text-slate-200">{o.bundle_name}</span>
                            <span className="block text-xs font-mono text-slate-500">{o.bundle_network} | {o.bundle_data_amount}</span>
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">₵{Number(o.final_price_ghs).toFixed(2)}</td>
                          <td className="py-3.5 px-4 font-mono text-slate-300">₵{Number(o.net_to_reseller_ghs).toFixed(2)}</td>
                          <td className="py-3.5 px-4 font-mono text-slate-400">₵{Number(o.admin_fee_ghs).toFixed(2)}</td>
                          <td className="py-3.5 px-4 text-xs font-semibold">
                            <span className={`px-2 py-0.5 rounded ${
                              o.payment_status === 'paid' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-rose-950 text-rose-300 border border-rose-800'
                            }`}>
                              {o.payment_status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-xs font-semibold">
                            <span className={`px-2 py-0.5 rounded ${
                              o.delivery_status === 'delivered' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                              o.delivery_status === 'failed' ? 'bg-rose-950 text-rose-300 border border-rose-800' :
                              'bg-amber-950 text-amber-300 border border-amber-800'
                            }`}>
                              {o.delivery_status}
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

          {/* TAB 6: API DELIVERY TRY ATTEMPTS LOGS & MANUAL RETRY */}
          {activeTab === 'logs' && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-slate-200">SubAndGain Bundle Delivery Attempt Reports</h3>
              {deliveryLogs.length === 0 ? (
                <div className="text-center py-12 text-slate-400">Delivery attempt reports is completely vacant. Send bundle orders to track API logs.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase font-mono text-xs">
                        <th className="py-3 px-4">Log ID</th>
                        <th className="py-3 px-4">Destination Target</th>
                        <th className="py-3 px-4">Provider Engine</th>
                        <th className="py-3 px-4">API Response Payload</th>
                        <th className="py-3 px-4">Retries</th>
                        <th className="py-3 px-4">Delivery status</th>
                        <th className="py-3 px-4 text-right">Self-Correction Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deliveryLogs.map(l => (
                        <tr key={l.id} className="border-b border-slate-850 hover:bg-slate-850/20 text-slate-300">
                          <td className="py-3.5 px-4 font-mono text-slate-500">
                            #DL-{l.id}
                            <span className="block text-xxs mt-0.5 text-slate-500">{new Date(l.created_at).toLocaleTimeString()}</span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-semibold block">{l.customer_phone}</span>
                            <span className="text-slate-500 font-mono text-xxs">{l.order_ref}</span>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-xs text-slate-300 uppercase">{l.api_provider}</td>
                          <td className="py-3.5 px-4 font-mono text-xxs text-slate-400 max-w-xs truncate" title={l.response}>
                            {l.response}
                          </td>
                          <td className="py-3.5 px-4">{l.retry_count}</td>
                          <td className="py-3.5 px-4 font-semibold text-xs">
                            <span className={`px-1.5 py-0.5 rounded ${
                              l.status === 'success' ? 'bg-emerald-950 text-emerald-300' : 'bg-rose-950 text-rose-300'
                            }`}>
                              {l.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {l.status === 'failed' ? (
                              <button
                                onClick={() => handleRetryDelivery(l.id)}
                                disabled={retryingId === l.id}
                                className="px-3 py-1 bg-indigo-950 hover:bg-indigo-900 text-indigo-300 hover:text-white rounded text-xs transition border border-indigo-800 disabled:opacity-50"
                              >
                                {retryingId === l.id ? 'Retrying...' : 'Force retry delivery'}
                              </button>
                            ) : (
                              <span className="text-slate-500 text-xs italic">Delivered</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 7: ADMINISTRATIVE SYSTEM CONFIGURATIONS */}
          {activeTab === 'settings' && settings && (
            <div className="space-y-6">
              
              {/* Sandbox mode section */}
              <div className="bg-slate-800/40 p-5 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h4 className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <LANDMARK_TAG className="text-amber-500 w-5 h-5" />
                    Flutterwave & SubAndGain Test Simulator
                  </h4>
                  <p className="text-slate-400 text-sm mt-1">
                    When active, customers bypass true cash charges/Momo triggers and simulate successful order processing instantly without credential setups.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleTestMode(!settings.test_mode_enabled)}
                  className={`px-4 py-2 text-sm font-semibold rounded-lg shadow transition border ${
                    settings.test_mode_enabled 
                      ? 'bg-amber-500 text-slate-950 border-amber-600' 
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  {settings.test_mode_enabled ? 'Simulator: ACTIVE' : 'Simulator: INACTIVE (LIVE)'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                
                {/* Registration entry policy config */}
                <form onSubmit={handleUpdateRegFee} className="bg-slate-800/20 p-5 rounded-xl border border-slate-800 space-y-4">
                  <h4 className="font-semibold text-slate-100 border-b border-slate-800 pb-2">Reseller Store Signup Paywall</h4>
                  <div className="flex items-center justify-between">
                    <label className="text-slate-400 text-sm">Require registration fee</label>
                    <input
                      type="checkbox"
                      checked={settings.registration_fee_enabled}
                      onChange={(e) => setSettings({ ...settings, registration_fee_enabled: e.target.checked })}
                      className="w-4 h-4 text-amber-500 bg-slate-900 border-slate-700 focus:ring-0"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 text-xs font-mono block mb-1">Fee Amount (GHS)</label>
                    <input
                      type="number"
                      value={settings.registration_fee_ghs}
                      onChange={(e) => setSettings({ ...settings, registration_fee_ghs: Number(e.target.value) })}
                      disabled={!settings.registration_fee_enabled}
                      className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 p-2 text-sm text-slate-200 rounded focus:outline-none"
                    />
                  </div>
                  <button type="submit" className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 transition text-slate-100 font-semibold text-xs rounded">
                    Save paywall values
                  </button>
                </form>

                {/* Resellers markup ceiling constraint policy */}
                <form onSubmit={handleUpdateLimits} className="bg-slate-800/20 p-5 rounded-xl border border-slate-800 space-y-4">
                  <h4 className="font-semibold text-slate-100 border-b border-slate-800 pb-2">Max Profit Margin Ceiling</h4>
                  <p className="text-slate-500 text-xs block">Limit the markup percentage (%) a reseller partner can configure above admin base bundle index.</p>
                  <div>
                    <label className="text-slate-400 text-xs font-mono block mb-1">Ceiling Percentage Limit (%)</label>
                    <input
                      type="number"
                      value={settings.max_markup_percent}
                      onChange={(e) => setSettings({ ...settings, max_markup_percent: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 p-2 text-sm text-slate-200 rounded focus:outline-none"
                    />
                  </div>
                  <button type="submit" className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 transition text-slate-100 font-semibold text-xs rounded">
                    Impose Profit Ceiling
                  </button>
                </form>

                {/* Cumulative sales royalties commission fees */}
                <form onSubmit={handleUpdateAdminFees} className="bg-slate-800/20 p-5 rounded-xl border border-slate-800 space-y-4">
                  <h4 className="font-semibold text-slate-100 border-b border-slate-800 pb-2">Admin Transaction Taxes</h4>
                  <div>
                    <label className="text-slate-400 text-xs font-mono block mb-1">Percent royalty per order sale (%)</label>
                    <input
                      type="number"
                      value={settings.admin_fee_percent}
                      onChange={(e) => setSettings({ ...settings, admin_fee_percent: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 p-2 text-sm text-slate-200 rounded focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 text-xs font-mono block mb-1">Deduction workflow source</label>
                    <select
                      value={settings.admin_fee_source}
                      onChange={(e) => setSettings({ ...settings, admin_fee_source: e.target.value as any })}
                      className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 p-2 text-sm text-slate-200 rounded focus:outline-none"
                    >
                      <option value="storefront_earnings">Deduct from reseller profit margin payout</option>
                      <option value="order_margin">Reseller balance independent deduction</option>
                    </select>
                  </div>
                  <button type="submit" className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 transition text-slate-100 font-semibold text-xs rounded">
                    Re-index Royalty Tax
                  </button>
                </form>

                {/* Sub-agents Withdrawal percentage deduction config */}
                <form onSubmit={handleUpdateWithdrawalFee} className="bg-slate-800/20 p-5 rounded-xl border border-slate-800 space-y-4">
                  <h4 className="font-semibold text-slate-100 border-b border-slate-800 pb-2">Agent Withdrawal Tax</h4>
                  <p className="text-slate-500 text-xs block">Deduct this percentage whenever sub-agents cash out/request account withdrawal from their dashboards.</p>
                  <div>
                    <label className="text-slate-400 text-xs font-mono block mb-1">Retention Payout Fee (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="90"
                      step="0.1"
                      value={settings.withdrawal_fee_percent !== undefined ? settings.withdrawal_fee_percent : 0}
                      onChange={(e) => setSettings({ ...settings, withdrawal_fee_percent: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 p-2 text-sm text-slate-200 rounded focus:outline-none"
                    />
                  </div>
                  <button type="submit" className="w-full py-1.5 bg-amber-500 hover:bg-amber-600 transition text-slate-950 font-bold text-xs rounded uppercase">
                    Save payout tax rate
                  </button>
                </form>

                {/* Resellers Only WhatsApp Community Link configuration */}
                <form onSubmit={handleUpdateWhatsappLink} className="bg-slate-800/20 p-5 rounded-xl border border-slate-800 space-y-4 flex flex-col justify-between">
                  <div>
                    <h4 className="font-semibold text-slate-100 border-b border-slate-800 pb-2 flex items-center gap-1.5">
                      <span className="text-emerald-500 text-base">💬</span> Reseller WhatsApp Link
                    </h4>
                    <p className="text-slate-500 text-xs block mt-1.5">
                      Invite link displayed on authorized reseller dashboards so they can instantly join your update channel &amp; community pool.
                    </p>
                    <div className="mt-3">
                      <label className="text-slate-400 text-xs font-mono block mb-1">WhatsApp Group / Community Link</label>
                      <input
                        type="url"
                        placeholder="https://chat.whatsapp.com/..."
                        value={settings.whatsapp_community_link || ''}
                        onChange={(e) => setSettings({ ...settings, whatsapp_community_link: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 p-2 text-sm text-slate-200 rounded focus:outline-none"
                      />
                    </div>
                  </div>
                  <button type="submit" className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 transition text-slate-950 font-bold text-xs rounded uppercase mt-auto">
                    Save Resellers link
                  </button>
                </form>

              </div>

              {/* Payment Gateways Config */}
              <div className="bg-slate-800/20 p-6 rounded-xl border border-slate-800 space-y-4">
                <div>
                  <h4 className="font-semibold text-slate-100">Configure Payment Gateways & Keys</h4>
                  <p className="text-slate-400 text-xs mt-1">Specify whether you are accepting live customer payments via Flutterwave or Paystack and input your API keys. Make sure your webhook URL on Paystack/Flutterwave is set to: <code className="text-amber-400 font-mono text-[10px] bg-slate-950 p-1 rounded">https://YOUR_DOMAIN/api/webhook/YOUR_GATEWAY</code></p>
                </div>

                <form onSubmit={handleUpdateGatewaySettings} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3 bg-slate-900/30 p-4 rounded-lg border border-slate-850">
                      <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                        <span className="font-bold text-slate-200 text-sm">Active Gateway</span>
                        <div className="flex gap-2">
                          {['paystack', 'flutterwave'].map(gw => (
                            <button
                              key={gw}
                              type="button"
                              onClick={() => setSettings({ ...settings, payment_gateway: gw as any })}
                              className={`px-3 py-1 text-xxs font-bold uppercase rounded transition border ${
                                settings.payment_gateway === gw
                                  ? 'bg-amber-500 text-slate-950 border-amber-600'
                                  : 'bg-slate-850 text-slate-400 border-slate-800 hover:text-white'
                              }`}
                            >
                              {gw}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="text-slate-450 text-[10px] block mb-1 font-mono uppercase">Paystack Public Key</label>
                          <input
                            type="text"
                            required={settings.payment_gateway === 'paystack'}
                            value={settings.paystack_public_key || ''}
                            onChange={(e) => setSettings({ ...settings, paystack_public_key: e.target.value })}
                            placeholder="pk_live_..."
                            className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 p-2 text-xs font-mono text-slate-200 rounded focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-slate-450 text-[10px] block mb-1 font-mono uppercase">Paystack Secret Key</label>
                          <input
                            type="password"
                            required={settings.payment_gateway === 'paystack'}
                            value={settings.paystack_secret_key || ''}
                            onChange={(e) => setSettings({ ...settings, paystack_secret_key: e.target.value })}
                            placeholder="sk_live_..."
                            className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 p-2 text-xs font-mono text-slate-205 rounded focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 bg-slate-900/30 p-4 rounded-lg border border-slate-850">
                      <span className="font-bold text-slate-200 text-sm block border-b border-slate-800 pb-2">Flutterwave Credentials</span>
                      
                      <div className="space-y-3">
                        <div>
                          <label className="text-slate-450 text-[10px] block mb-1 font-mono uppercase">Flutterwave Public Key</label>
                          <input
                            type="text"
                            required={settings.payment_gateway === 'flutterwave'}
                            value={settings.flutterwave_public_key || ''}
                            onChange={(e) => setSettings({ ...settings, flutterwave_public_key: e.target.value })}
                            placeholder="FLWPUBK-..."
                            className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 p-2 text-xs font-mono text-slate-205 rounded focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-slate-450 text-[10px] block mb-1 font-mono uppercase">Flutterwave Secret Key</label>
                          <input
                            type="password"
                            required={settings.payment_gateway === 'flutterwave'}
                            value={settings.flutterwave_secret_key || ''}
                            onChange={(e) => setSettings({ ...settings, flutterwave_secret_key: e.target.value })}
                            placeholder="FLWSECK-..."
                            className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 p-2 text-xs font-mono text-slate-205 rounded focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2 border-t border-slate-800">
                    <button
                      type="submit"
                      className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded transition uppercase tracking-wide"
                    >
                      Save Gateway Credentials
                    </button>
                  </div>
                </form>
              </div>

              {/* Data Bundle Dispatcher API Integration */}
              <div className="bg-slate-800/20 p-6 rounded-xl border border-slate-800 space-y-4">
                <div>
                  <h4 className="font-semibold text-slate-100">Configure Automated Data Dispatch API (SubAndGain)</h4>
                  <p className="text-slate-400 text-xs mt-1">
                    Connect your real SubAndGain developer account to automate GHS/Giga-byte (GB) data bundle delivery instantly upon successful client payments. Make sure you map the exact provider's <strong>Plan Codes</strong> in your bundles table.
                  </p>
                </div>

                <form onSubmit={handleUpdateDataApiSettings} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-1.5">
                      <label className="text-slate-450 text-[10px] block font-mono uppercase">API Base Endpoint URL</label>
                      <input
                        type="text"
                        required
                        value={settings.data_api_url || 'https://subandgain.com/api/data.php'}
                        onChange={(e) => setSettings({ ...settings, data_api_url: e.target.value })}
                        placeholder="https://subandgain.com/api/data.php"
                        className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 p-2 text-xs font-mono text-slate-200 rounded focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-slate-450 text-[10px] block font-mono uppercase">SubAndGain Username</label>
                      <input
                        type="text"
                        required
                        value={settings.data_api_username || ''}
                        onChange={(e) => setSettings({ ...settings, data_api_username: e.target.value })}
                        placeholder="Developer Username"
                        className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 p-2 text-xs font-mono text-slate-200 rounded focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-slate-450 text-[10px] block font-mono uppercase">Developer API Key</label>
                      <input
                        type="password"
                        required
                        value={settings.data_api_key || ''}
                        onChange={(e) => setSettings({ ...settings, data_api_key: e.target.value })}
                        placeholder="SubAndGain API Password / Token"
                        className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 p-2 text-xs font-mono text-slate-200  rounded focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-2 border-t border-slate-800">
                    <button
                      type="submit"
                      className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded transition uppercase tracking-wide"
                    >
                      Save Dispatcher API Credentials
                    </button>
                  </div>
                </form>
              </div>

              {/* Password change security block */}
              <div className="bg-slate-800/20 p-6 rounded-xl border border-slate-800 space-y-4">
                <div>
                  <h4 className="font-semibold text-slate-100">Update Administrator Password</h4>
                  <p className="text-slate-400 text-xs mt-1">To change your password, enter your current password, followed by your new password twice to confirm.</p>
                </div>

                <form onSubmit={handleChangePassword} className="space-y-4 max-w-lg">
                  {passwordChangeStatus && (
                    <div className={`p-3 rounded text-xs px-4 border ${
                      passwordChangeStatus.type === 'success' 
                        ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800' 
                        : 'bg-rose-950/60 text-rose-300 border-rose-800'
                    }`}>
                      {passwordChangeStatus.message}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-slate-400 text-xs block mb-1 font-mono">Current Password</label>
                      <input
                        type="password"
                        required
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 p-2 text-sm text-slate-200 rounded focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 text-xs block mb-1 font-mono">New Password</label>
                      <input
                        type="password"
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="At least 6 chars"
                        className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 p-2 text-sm text-slate-200 rounded focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 text-xs block mb-1 font-mono">Confirm New Password</label>
                      <input
                        type="password"
                        required
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 p-2 text-sm text-slate-200 rounded focus:outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={passwordLoading}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-semibold text-xs uppercase tracking-wider rounded transition"
                  >
                    {passwordLoading ? 'Updating credentials...' : 'Update Password'}
                  </button>
                </form>
              </div>

            </div>
          )}

        </div>
      )}

      {/* MODAL: BUNDLE CREATE/EDIT POPUP */}
      {bundleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-md shadow-2xl relative space-y-4">
            <h3 className="text-xl font-semibold text-slate-100">
              {editingBundle ? 'Update System Base Plan' : 'Add New Inventory Package'}
            </h3>

            <form onSubmit={handleSaveBundle} className="space-y-4 text-sm text-slate-300">
              <div>
                <label className="block mb-1 text-slate-400 font-mono text-xs">Plan name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MTN 1.5GB Super"
                  value={bundleForm.name}
                  onChange={(e) => setBundleForm({ ...bundleForm, name: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 focus:outline-none focus:border-amber-500 text-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 text-slate-400 font-mono text-xs">Operator network</label>
                  <select
                    value={bundleForm.network}
                    onChange={(e) => setBundleForm({ ...bundleForm, network: e.target.value as any })}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 focus:outline-none text-slate-200"
                  >
                    <option value="MTN">MTN</option>
                    <option value="Vodafone">Telecel (Vodafone)</option>
                    <option value="AirtelTigo">AirtelTigo</option>
                    <option value="Glo">Glo</option>
                  </select>
                </div>

                <div>
                  <label className="block mb-1 text-slate-400 font-mono text-xs">Package size</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 5GB or 750MB"
                    value={bundleForm.data_amount}
                    onChange={(e) => setBundleForm({ ...bundleForm, data_amount: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 focus:outline-none text-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 text-slate-400 font-mono text-xs">Validity days</label>
                  <input
                    type="number"
                    required
                    value={bundleForm.validity_days}
                    onChange={(e) => setBundleForm({ ...bundleForm, validity_days: Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 focus:outline-none text-slate-200"
                  />
                </div>

                <div>
                  <label className="block mb-1 text-slate-400 font-mono text-xs">Base price (GHS ₵)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={bundleForm.admin_base_price_ghs}
                    onChange={(e) => setBundleForm({ ...bundleForm, admin_base_price_ghs: Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 focus:outline-none text-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 text-slate-400 font-mono text-xs">SubAndGain Plan Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. mtn-5gb"
                    value={bundleForm.provider_plan_code}
                    onChange={(e) => setBundleForm({ ...bundleForm, provider_plan_code: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 focus:outline-none text-slate-200 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block mb-1 text-slate-400 font-mono text-xs">Plan catalog state</label>
                  <select
                    value={bundleForm.status}
                    onChange={(e) => setBundleForm({ ...bundleForm, status: e.target.value as any })}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 focus:outline-none text-slate-200"
                  >
                    <option value="active">Active (Visible)</option>
                    <option value="inactive">Inactive (Hidden)</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-3">
                <button
                  type="button"
                  onClick={() => setBundleModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-400 hover:text-white rounded transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded transition"
                >
                  Confirm catalog submit
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL: RESET RESELLER AGENT PASSWORD */}
      {resettingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-md shadow-2xl relative space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <Key className="w-5 h-5 text-amber-500" />
              <h3 className="text-xl font-semibold text-slate-100">Reset Reseller Password</h3>
            </div>

            <div className="bg-amber-950/20 text-amber-300 border border-amber-800/30 p-3 rounded text-xs space-y-1">
              <span>You are overriding credentials for partner store: </span>
              <div className="font-bold">{resettingUser.store_name}</div>
              <div className="text-slate-400">Email: {resettingUser.email}</div>
            </div>

            <form onSubmit={handleResetResellerPasswordSubmit} className="space-y-4 text-sm text-slate-300">
              <div>
                <label className="block mb-1 text-slate-400 font-mono text-xs">Enter New Password</label>
                <input
                  type="text"
                  required
                  placeholder="minimum 6 characters"
                  value={resellerResetPassword}
                  onChange={(e) => setResellerResetPassword(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 focus:outline-none focus:border-amber-500 text-slate-100 font-mono"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  disabled={resetPasswordLoading}
                  onClick={() => setResettingUser(null)}
                  className="px-4 py-2 bg-slate-800 text-slate-400 hover:text-white rounded transition text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetPasswordLoading}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold rounded transition text-xs flex items-center gap-1"
                >
                  {resetPasswordLoading ? 'Applying reset...' : 'Confirm Overwrite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: AGENT SMS ACTION BROADCASTER & TRANSACTION LOGS */}
      {smsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-amber-500 animate-pulse" />
                <div>
                  <h3 className="text-lg font-bold text-slate-100 leading-none">One-Way Alphanumeric SMS Broadcaster</h3>
                  <p className="text-xxs text-slate-500 mt-1">Send un-replyable notifications directly to agents using custom alpha-headers.</p>
                </div>
              </div>
              <button 
                onClick={() => setSmsModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs px-2 py-1 bg-slate-800 rounded"
              >
                Close Panel
              </button>
            </div>

            {/* Modal Body Container */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <form onSubmit={handleSendSmsSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* SMS Target Select */}
                  <div>
                    <label className="block mb-1 text-slate-400 font-mono text-xs">Recipient Agents</label>
                    <select
                      value={smsTarget}
                      onChange={(e) => setSmsTarget(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded p-2 focus:outline-none focus:border-amber-500 text-slate-200"
                    >
                      <option value="all">📢 All Active Agents (Broadcast to Everyone)</option>
                      {resellers.map(r => (
                        <option key={r.user_id} value={r.user_id}>
                          👤 {r.store_name} ({r.email})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* SMS Mask/Alphanumeric ID */}
                  <div>
                    <label className="block mb-1 text-slate-400 font-mono text-xs flex justify-between">
                      <span>Sender ID (Mask Header Name)</span>
                      <span className="text-xxs text-amber-500 font-sans">UN-REPLYABLE GSM REGULATION ENFORCED</span>
                    </label>
                    <input
                      type="text"
                      maxLength={11}
                      required
                      placeholder="e.g. MAC-HUB, NO-REPLY"
                      value={smsMaskId}
                      onChange={(e) => setSmsMaskId(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded p-2 focus:outline-none focus:border-amber-500 text-slate-100 font-bold uppercase font-mono"
                    />
                    <p className="text-xxs text-slate-500 mt-1">Maximum 11 characters. Rendered straight as letters, bypassing numeric phone return streams.</p>
                  </div>
                </div>

                {/* SMS Text Content */}
                <div>
                  <label className="block mb-1 text-slate-400 font-mono text-xs flex justify-between">
                    <span>Message Body Payload</span>
                    <span className="text-slate-500 text-xxs font-mono">{smsMessage.length} characters</span>
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Enter notification details. E.g., 'Hello agent, MTNP-5GB data package is now fully operational! Happy sales.'"
                    value={smsMessage}
                    onChange={(e) => setSmsMessage(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500 font-sans"
                  />
                  <div className="p-3 bg-slate-950/60 rounded text-xxs text-slate-400 border border-slate-800/40 flex items-start gap-2 mt-2 leading-normal font-sans">
                    <span className="text-amber-500 font-bold">💡 Technical Fact:</span>
                    <span>Using an alphanumeric sender identity overrides standard digital cell replies. Recipient agents will receive this message as a brand text string and cannot text back or reply to it. Perfect for system declarations, announcements, and important core notifications!</span>
                  </div>
                </div>

                {/* Dispatch Trigger */}
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={smsDispatchLoading}
                    className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 disabled:opacity-55 text-slate-950 font-bold rounded-lg text-xs tracking-wider uppercase flex items-center gap-1.5 transition-colors shadow-lg"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {smsDispatchLoading ? 'Broadcasting via SMPP Gateway...' : 'Send SMS Message'}
                  </button>
                </div>
              </form>

              {/* SMS Logs / History list */}
              <div className="border-t border-slate-800 pt-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-slate-200 uppercase font-mono tracking-wider">Historical Broadcast Receipts</h4>
                  <button
                    onClick={fetchSmsLogs}
                    className="text-xxs text-amber-500 hover:text-amber-400 transition flex items-center gap-1 font-mono font-bold"
                  >
                    <RefreshCw className={`w-3 h-3 ${smsLogsLoading ? 'animate-spin' : ''}`} />
                    Refresh Logs
                  </button>
                </div>

                {smsLogsLoading && smsLogs.length === 0 ? (
                  <div className="py-6 text-center text-slate-500 text-xs">Loading outbound transmission records...</div>
                ) : smsLogs.length === 0 ? (
                  <div className="p-8 text-center bg-slate-950/30 border border-slate-800/50 rounded-lg text-slate-500 text-xs">No outbound Alphanumeric SMS records currently dispatched. Compose a message above to test connectivity.</div>
                ) : (
                  <div className="overflow-x-auto max-h-56 border border-slate-850 rounded-lg">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-950/70 border-b border-slate-850 text-slate-400 uppercase font-mono text-[10px]">
                          <th className="py-2.5 px-3">Date / Stamp</th>
                          <th className="py-2.5 px-3">Recipient Agent</th>
                          <th className="py-2.5 px-3 font-mono">Mask Sender</th>
                          <th className="py-2.5 px-3">SMS Text Material</th>
                          <th className="py-2.5 px-3 text-right">Delivery</th>
                        </tr>
                      </thead>
                      <tbody>
                        {smsLogs.map((log: any) => (
                          <tr key={log.id} className="border-b border-slate-850 bg-slate-900 hover:bg-slate-850/30 text-slate-300">
                            <td className="py-2 px-3 font-mono text-[10px] text-slate-500">{new Date(log.created_at).toLocaleString()}</td>
                            <td className="py-2 px-3">
                              <span className="font-semibold text-slate-200 block max-w-[12rem] truncate">{log.store_name || 'N/A'}</span>
                              <span className="text-[10px] text-slate-500 block max-w-[12rem] truncate">{log.email || 'N/A'}</span>
                            </td>
                            <td className="py-2 px-3 font-mono font-bold text-amber-500">{log.sender_id}</td>
                            <td className="py-2 px-3">
                              <p className="max-w-xs break-words text-slate-330 line-clamp-1 hover:line-clamp-none transition-all duration-300 cursor-help" title={log.message}>{log.message}</p>
                            </td>
                            <td className="py-2 px-3 text-right">
                              <span className="px-1.5 py-0.5 bg-emerald-950/50 text-emerald-400 border border-emerald-900/30 rounded text-[9px] uppercase font-bold">
                                {log.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {purchaseBundle && (
        <CheckoutModal
          bundle={purchaseBundle}
          reseller={null}
          onClose={() => setPurchaseBundle(null)}
          onSuccess={() => {
            setPurchaseBundle(null);
            fetchData();
          }}
        />
      )}

      {/* Fully safe custom iframe confirmation portal modal */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-full mt-0.5 shrink-0 ${
                confirmDialog.actionType === 'danger' ? 'bg-rose-950/50 text-rose-400 border border-rose-800/30' :
                confirmDialog.actionType === 'success' ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-800/30' :
                'bg-amber-950/50 text-amber-400 border border-amber-800/30'
              }`}>
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-100">{confirmDialog.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{confirmDialog.message}</p>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs rounded transition-colors border border-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDialog.onConfirm}
                className={`px-4 py-2 font-bold text-xs rounded transition-all shadow-md ${
                  confirmDialog.actionType === 'danger' ? 'bg-rose-600 hover:bg-rose-500 text-slate-100 shadow-rose-500/10' :
                  confirmDialog.actionType === 'success' ? 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-emerald-500/10' :
                  'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-amber-500/10'
                }`}
              >
                {confirmDialog.actionLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Simple dynamic element icon fallback key
function LANDMARK_TAG(props: any) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={props.className}
    >
      <rect width="20" height="12" x="2" y="6" rx="2" />
      <circle cx="12" cy="12" r="2" />
      <path d="M6 12h.01M18 12h.01" />
    </svg>
  );
}
