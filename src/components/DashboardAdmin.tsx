import React, { useState, useEffect } from 'react';
import { 
  Users, BarChart3, Database, Landmark, Settings, RefreshCw, AlertCircle, CheckCircle2, XCircle, 
  Trash2, Edit, Plus, Eye, History, Key, MessageSquare, Send, Smartphone, ShoppingCart, RotateCcw, Mail, LogOut, Copy, Bell
} from 'lucide-react';
import { Bundle, ResellerAccount, WithdrawalRequest, Order, DataDeliveryLog, AdminSettings } from '../types';
import CheckoutModal from './CheckoutModal';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

interface DashboardAdminProps {
  token: string;
  user?: any;
  onLogout?: () => void;
  onTypographyChange?: (
    font?: string, 
    size?: string, 
    colorPrimary?: string, 
    colorBody?: string, 
    colorMuted?: string, 
    colorAccent?: string
  ) => void;
  onBrandingChange?: (
    siteName?: string,
    siteColor?: string,
    siteBgColor?: string,
    siteBgImage?: string
  ) => void;
}

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

export default function DashboardAdmin({ token, user, onLogout, onTypographyChange, onBrandingChange }: DashboardAdminProps) {
  const [activeTab, setActiveTab] = useState<'stats' | 'bundles' | 'resellers' | 'withdrawals' | 'orders' | 'logs' | 'settings'>('stats');
  
  // Notifications States
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState<boolean>(false);

  // States
  const [purchaseBundle, setPurchaseBundle] = useState<Bundle | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [resellers, setResellers] = useState<ResellerAccount[]>([]);
  const [accountFilter, setAccountFilter] = useState<'all' | 'reseller' | 'customer'>('all');
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | 'paid' | 'delivered' | 'failed' | 'pending'>('all');
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
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  // Administrative withdrawal states
  const [adminWithdrawModalOpen, setAdminWithdrawModalOpen] = useState<boolean>(false);
  const [adminWithdrawAmount, setAdminWithdrawAmount] = useState<string>('');
  const [adminWithdrawDetails, setAdminWithdrawDetails] = useState<string>('');
  const [adminWithdrawSubmitting, setAdminWithdrawSubmitting] = useState<boolean>(false);

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

  // Agent Email states
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailTarget, setEmailTarget] = useState('all');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [emailDispatchLoading, setEmailDispatchLoading] = useState(false);
  const [emailLogs, setEmailLogs] = useState<any[]>([]);
  const [emailLogsLoading, setEmailLogsLoading] = useState(false);

  // SubAndGain API catalog fetching and base list importing states
  const [subAndGainPlans, setSubAndGainPlans] = useState<any[]>([]);
  const [fetchingSgPlans, setFetchingSgPlans] = useState<boolean>(false);
  const [globalSgMargin, setGlobalSgMargin] = useState<string>('2.0');
  const [sgImporting, setSgImporting] = useState<boolean>(false);
  const [preloadingSandbox, setPreloadingSandbox] = useState<boolean>(false);
  const [copiedInviteLink, setCopiedInviteLink] = useState<boolean>(false);

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

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (e) {
      console.log("Failed to retrieve system alerts (network or server spinup transient failure):", e);
    }
  };

  const handleMarkAsRead = async (id: number) => {
    try {
      const res = await fetch(`/api/notifications/${id}/read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleClearAllNotifications = async () => {
    try {
      const res = await fetch('/api/notifications/clear', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setNotifications([]);
        showNotification('All notifications cleared.', 'success');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
      
      // Load alerts
      await fetchNotifications();

      // Always fetch stats and settings to support real-time global low API wallet balance alerts
      const r1 = await fetch(`/api/admin/dashboard?t=${Date.now()}`, { headers });
      if (r1.ok) setStats(await r1.json());
      const r7 = await fetch(`/api/admin/settings?t=${Date.now()}`, { headers });
      if (r7.ok) setSettings(await r7.json());

      if (activeTab === 'bundles') {
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

  // Reseller deletion completely
  const handleDeleteReseller = async (reseller: ResellerAccount) => {
    const rId = reseller.user_id || (reseller as any).id;
    if (!rId) {
      showNotification('Cannot identify reseller account ID.', 'danger');
      return;
    }

    if (reseller.email?.toLowerCase() === 'aaronbinka173@gmail.com') {
      showNotification('The platform owner account cannot be deleted.', 'danger');
      return;
    }

    requestConfirmation(
      '⚠️ Delete Reseller Account Permanently?',
      `Are you ABSOLUTELY sure you want to permanently delete the reseller account "${reseller.store_name || reseller.email}"? This action is IRREVERSIBLE and will delete their storefront record as if they never existed!`,
      async () => {
        setTogglingResellerId(rId);
        try {
          const res = await fetch(`/api/admin/resellers/${rId}`, {
            method: 'DELETE',
            headers: { 
              'Authorization': `Bearer ${token}`
            }
          });
          const data = await res.json().catch(() => ({}));
          if (res.ok) {
            showNotification(data.message || `Reseller account was permanently deleted.`, 'success');
            fetchData();
          } else {
            showNotification(data.error || `Failed to delete reseller account.`, 'danger');
          }
        } catch (err) {
          showNotification('Failed to delete reseller due to system error.', 'danger');
        } finally {
          setTogglingResellerId(null);
        }
      },
      'Delete Permanently',
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

  // --- DATABASE EXPORT AND IMPORT HANDLERS ---
  const handleExportDatabase = async () => {
    try {
      showNotification('Generating database backup manifest...', 'success');
      const response = await fetch('/api/admin/db-export', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) {
        throw new Error('Export request unsuccessful.');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `machub_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      showNotification('Database backup downloaded successfully!', 'success');
    } catch (e: any) {
      console.error(e);
      showNotification('Failed to export database backup: ' + e.message, 'danger');
    }
  };

  const [importingDb, setImportingDb] = useState<boolean>(false);

  const handleImportDatabase = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    requestConfirmation(
      'RESTORE SYSTEM BACKUP?',
      `Are you sure you want to restore "${file.name}"? This will overwrite the entire data layout including users, resellers, orders, and credentials with the backup file data!`,
      async () => {
        setImportingDb(true);
        try {
          const reader = new FileReader();
          reader.onload = async (event) => {
            try {
              const text = event.target?.result;
              if (typeof text !== 'string') throw new Error('Could not read backup file.');
              const json = JSON.parse(text);

              // Basic validation
              if (!json.users || !json.bundles || !json.orders) {
                throw new Error('Invalid database backup format. Missing key items like users or bundles lists.');
              }

              const response = await fetch('/api/admin/db-import', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(json)
              });

              if (response.ok) {
                showNotification('Database successfully restored from backup file!', 'success');
                fetchData();
              } else {
                const errData = await response.json();
                showNotification(errData.error || 'Failed to restore database.', 'danger');
              }
            } catch (err: any) {
              showNotification(err.message, 'danger');
            } finally {
              setImportingDb(false);
            }
          };
          reader.readAsText(file);
        } catch (err: any) {
          showNotification('Reading backup failed: ' + err.message, 'danger');
          setImportingDb(false);
        }
      }
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

  const handleAdminWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminWithdrawAmount || isNaN(Number(adminWithdrawAmount)) || Number(adminWithdrawAmount) <= 0) {
      showNotification('Please enter a valid positive payout amount.', 'danger');
      return;
    }
    if (!adminWithdrawDetails.trim()) {
      showNotification('Please provide manual payout destination details.', 'danger');
      return;
    }

    setAdminWithdrawSubmitting(true);
    try {
      const res = await fetch('/api/admin/withdraw', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: Number(adminWithdrawAmount),
          details: adminWithdrawDetails.trim()
        })
      });

      const data = await res.json();
      if (res.ok) {
        showNotification(data.message || 'Admin withdrawal completed successfully!', 'success');
        setAdminWithdrawModalOpen(false);
        setAdminWithdrawAmount('');
        setAdminWithdrawDetails('');
        // Refresh dashboard data and settings
        fetchData();
      } else {
        showNotification(data.error || 'Failed to process admin withdrawal.', 'danger');
      }
    } catch {
      showNotification('Glitch while processing withdrawal request.', 'danger');
    } finally {
      setAdminWithdrawSubmitting(false);
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
          payment_gateway: 'paystack',
          paystack_public_key: settings.paystack_public_key,
          paystack_secret_key: settings.paystack_secret_key,
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
          vtu_balance_threshold: settings.vtu_balance_threshold,
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

  const handleLoadSubAndGainPlans = async () => {
    if (user?.email?.toLowerCase() !== 'aaronbinka173@gmail.com') {
      showNotification('Only the platform owner (aaronbinka173@gmail.com) is authorized to fetch or inspect data API plans.', 'danger');
      return;
    }
    setFetchingSgPlans(true);
    try {
      const res = await fetch('/api/admin/subandgain/plans', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const enriched = (data.plans || []).map((item: any) => {
          const matchedBundle = bundles.find((b: any) => b.provider_plan_code === item.provider_plan_code);
          let itemMargin = Number(globalSgMargin) || 2.0;
          if (matchedBundle) {
            const calculatedMargin = Number(matchedBundle.admin_base_price_ghs) - Number(item.base_price_ghs);
            if (calculatedMargin >= 0) {
              itemMargin = Number(calculatedMargin.toFixed(2));
            }
          }
          return {
            ...item,
            customMargin: itemMargin,
            isChecked: true
          };
        });
        setSubAndGainPlans(enriched);
        showNotification(`Loaded ${enriched.length} packages from ${data.provider === 'subandgain-live' ? 'SubAndGain Live Gateway' : 'Ghana base catalog API'}.`, 'success');
      } else {
        const d = await res.json().catch(() => ({}));
        showNotification(d.error || 'Failed to load SubAndGain plans.', 'danger');
      }
    } catch {
      showNotification('Communication failure reading API plans.', 'danger');
    } finally {
      setFetchingSgPlans(false);
    }
  };

  const handleApplyGlobalSgMargin = (val: string) => {
    setGlobalSgMargin(val);
    const mNum = Number(val) || 0;
    setSubAndGainPlans(prev => prev.map(p => ({
      ...p,
      customMargin: mNum
    })));
  };

  const handleImportSelectedSgPlans = async () => {
    if (user?.email?.toLowerCase() !== 'aaronbinka173@gmail.com') {
      showNotification('Only the platform owner (aaronbinka173@gmail.com) is authorized to reset or synchronize data packages.', 'danger');
      return;
    }
    const selected = subAndGainPlans.filter(p => p.isChecked);
    if (selected.length === 0) {
      showNotification('Please select at least one bundle package to import.', 'danger');
      return;
    }

    setSgImporting(true);
    try {
      const payloadPlans = selected.map(p => ({
        name: p.name,
        network: p.network,
        data_amount: p.data_amount,
        validity_days: p.validity_days || 30,
        admin_base_price_ghs: Number(p.base_price_ghs) + Number(p.customMargin),
        provider_plan_code: p.provider_plan_code
      }));

      const res = await fetch('/api/admin/subandgain/import', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ plans: payloadPlans })
      });

      if (res.ok) {
        const d = await res.json();
        showNotification(d.message || 'SubAndGain plans deployed and synchronized successfully!', 'success');
        const r2 = await fetch('/api/admin/bundles', { headers: { Authorization: `Bearer ${token}` } });
        if (r2.ok) {
          const bs = await r2.json();
          setBundles(bs);
        }
        fetchData();
      } else {
        const d = await res.json().catch(() => ({}));
        showNotification(d.error || 'Failed to synchronize selected bundles.', 'danger');
      }
    } catch {
      showNotification('Error transmitting pricing data to database.', 'danger');
    } finally {
      setSgImporting(false);
    }
  };

  const handleResetBundlesToDefaults = async () => {
    if (user?.email?.toLowerCase() !== 'aaronbinka173@gmail.com') {
      showNotification('Only the platform owner (aaronbinka173@gmail.com) is authorized to reset the data packages.', 'danger');
      return;
    }
    if (!resetConfirmOpen) {
      setResetConfirmOpen(true);
      showNotification('CONFIRMATION REQ: Click "Confirm Package Wipe" again to proceed.', 'danger');
      return;
    }
    setResetConfirmOpen(false);
    setLoading(true);
    try {
      const res = await fetch('/api/admin/bundles/reset', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const d = await res.json();
        showNotification(d.message || 'System data bundles successfully reset to presets!', 'success');
        const r2 = await fetch('/api/admin/bundles', { headers: { Authorization: `Bearer ${token}` } });
        if (r2.ok) {
          const bs = await r2.json();
          setBundles(bs);
        }
        fetchData();
      } else {
        const d = await res.json().catch(() => ({}));
        showNotification(d.error || 'Failed to reset bundles.', 'danger');
      }
    } catch {
      showNotification('Error contacting database server during reset.', 'danger');
    } finally {
      setLoading(false);
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

  const handlePreloadSandboxDefaults = async () => {
    setPreloadingSandbox(true);
    try {
      const res = await fetch('/api/admin/settings/preload-sandbox', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        showNotification('Fantastic! Sandbox keys and mock accounts loaded. The system is 100% active and testable!', 'success');
        fetchData();
      } else {
        showNotification('Failed to preload sandbox settings.', 'danger');
      }
    } catch {
      showNotification('Network transmission error.', 'danger');
    } finally {
      setPreloadingSandbox(false);
    }
  };

  const handleResetToProduction = async () => {
    requestConfirmation(
      '⚠️ CRITICAL: Reset Database to Live Production?',
      'Are you absolutely sure you are ready to go live? This action will permanently WIPE all sandbox/mock accounts, customer test purchases, simulated sales logs, mock sms/email records, and test reseller balances! It remains only your system owner account in active production mode with zeroed out counters.',
      async () => {
        setPreloadingSandbox(true);
        try {
          const res = await fetch('/api/admin/settings/reset-database', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` }
          });
          const data = await res.json().catch(() => ({}));
          if (res.ok) {
            showNotification(data.message || 'Database successfully wiped and reset to active production mode!', 'success');
            fetchData();
          } else {
            showNotification(data.error || 'Failed to wipe database.', 'danger');
          }
        } catch {
          showNotification('Network connection error.', 'danger');
        } finally {
          setPreloadingSandbox(false);
        }
      },
      'Wipe Database & Go Live',
      'danger'
    );
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
      const resComm = await fetch('/api/admin/settings/whatsapp-community', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ link: settings.whatsapp_community_link })
      });
      const resChan = await fetch('/api/admin/settings/whatsapp-channel', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ link: settings.whatsapp_channel_link })
      });
      if (resComm.ok && resChan.ok) {
        showNotification('WhatsApp Community and Channel links updated successfully.', 'success');
        fetchData();
      } else {
        showNotification('Failed to update one or both WhatsApp links.', 'danger');
      }
    } catch {
      showNotification('Transmission error.', 'danger');
    }
  };

  const handleUpdateBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    try {
      const res = await fetch('/api/admin/settings/branding', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          site_name: settings.site_name, 
          site_color: settings.site_color,
          site_bg_color: settings.site_bg_color,
          site_bg_image: settings.site_bg_image
        })
      });
      if (res.ok) {
        showNotification('Site brand settings and theme color updated successfully!', 'success');
        if (onBrandingChange) {
          const bgUrl = settings.site_bg_image ? `/api/settings/bg-image?h=${settings.site_bg_image.length}` : '';
          onBrandingChange(settings.site_name, settings.site_color, settings.site_bg_color, bgUrl);
        }
      } else {
        const d = await res.json().catch(() => ({}));
        showNotification(d.error || 'Failed to update branding.', 'danger');
      }
    } catch {
      showNotification('Transmission error.', 'danger');
    }
  };

  const handleUpdateSupportSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    try {
      const res = await fetch('/api/admin/settings/support', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          online_support_enabled: !!settings.online_support_enabled,
          online_support_restrictions: settings.online_support_restrictions || ''
        })
      });
      if (res.ok) {
        showNotification('Online live customer support and restriction settings updated successfully!', 'success');
        fetchData();
      } else {
        const d = await res.json().catch(() => ({}));
        showNotification(d.error || 'Failed to update support settings.', 'danger');
      }
    } catch {
      showNotification('Transmission error.', 'danger');
    }
  };

  const handleUpdateReviewsPopup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    try {
      const res = await fetch('/api/admin/settings/reviews-popup', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviews_popup_enabled: settings.reviews_popup_enabled !== false
        })
      });
      if (res.ok) {
        showNotification('5-Star rating popups global display status updated successfully!', 'success');
        fetchData();
      } else {
        const d = await res.json().catch(() => ({}));
        showNotification(d.error || 'Failed to update reviews popup status.', 'danger');
      }
    } catch {
      showNotification('Transmission error.', 'danger');
    }
  };

  const handleUpdateTypography = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    try {
      const res = await fetch('/api/admin/settings/typography', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          global_font_style: settings.global_font_style,
          global_font_size: settings.global_font_size,
          global_text_color_primary: settings.global_text_color_primary,
          global_text_color_body: settings.global_text_color_body,
          global_text_color_muted: settings.global_text_color_muted,
          global_text_color_accent: settings.global_text_color_accent,
        })
      });
      if (res.ok) {
        showNotification('Platform typography, custom text sizes, and writing colors updated successfully!', 'success');
        if (onTypographyChange) {
          onTypographyChange(
            settings.global_font_style,
            settings.global_font_size,
            settings.global_text_color_primary,
            settings.global_text_color_body,
            settings.global_text_color_muted,
            settings.global_text_color_accent
          );
        }
      } else {
        const d = await res.json().catch(() => ({}));
        showNotification(d.error || 'Failed to update typography settings.', 'danger');
      }
    } catch {
      showNotification('Network transmission error.', 'danger');
    }
  };

  const handleUpdateCustomerTax = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    try {
      const res = await fetch('/api/admin/settings/customer-tax', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: !!settings.customer_tax_enabled,
          percent: Number(settings.customer_tax_percent || 0),
          flatGhs: Number(settings.customer_tax_flat_ghs || 0)
        })
      });
      if (res.ok) {
        showNotification('Storefront customer tax/transaction fee settings saved successfully.', 'success');
        fetchData();
      } else {
        const d = await res.json().catch(() => ({}));
        showNotification(d.error || 'Failed to apply tax settings.', 'danger');
      }
    } catch {
      showNotification('Communication failure updating tax configuration.', 'danger');
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

  const fetchEmailLogs = async () => {
    setEmailLogsLoading(true);
    try {
      const response = await fetch('/api/admin/email-logs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setEmailLogs(data);
      }
    } catch (err) {
      console.error('Failed to fetch Email logs:', err);
    } finally {
      setEmailLogsLoading(false);
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

  const handleSendEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailSubject.trim()) {
      showNotification('Please enter an Email subject.', 'danger');
      return;
    }
    if (!emailMessage.trim()) {
      showNotification('Please enter the email Message body.', 'danger');
      return;
    }

    setEmailDispatchLoading(true);
    try {
      const response = await fetch('/api/admin/send-email', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          target: emailTarget,
          subject: emailSubject,
          message: emailMessage
        })
      });

      const data = await response.json();
      if (response.ok) {
        showNotification(data.messagePrefix || 'SMTP Email successfully dispatched!', 'success');
        setEmailSubject('');
        setEmailMessage('');
        fetchEmailLogs();
      } else {
        showNotification(data.error || 'Failed to dispatch outbound Email.', 'danger');
      }
    } catch {
      showNotification('Network boundary error dispatching Email.', 'danger');
    } finally {
      setEmailDispatchLoading(false);
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
        
        <div className="flex items-center gap-2 self-start flex-wrap">
          <button 
            onClick={fetchData}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-slate-300 text-sm hover:bg-slate-700 transition rounded-lg"
          >
            <RefreshCw className="w-4 h-4" />
            Full System Refresh
          </button>

          {/* Notifications Bell Dropdown */}
          <div className="relative">
            <button
              onClick={() => setNotifDropdownOpen(!notifDropdownOpen)}
              className="relative p-2 bg-slate-800 text-slate-300 hover:text-white rounded-lg hover:bg-slate-700 transition flex items-center justify-center"
              title="System Notifications"
            >
              <Bell className="w-4 h-4" />
              {notifications.filter(n => !n.is_read).length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white animate-pulse">
                  {notifications.filter(n => !n.is_read).length}
                </span>
              )}
            </button>

            {notifDropdownOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-slate-800 bg-slate-950 shadow-2xl z-50 p-4">
                <div className="flex items-center justify-between border-b border-slate-850 pb-2 mb-3">
                  <h4 className="font-semibold text-xs text-slate-200 flex items-center gap-1.5">
                    <Bell className="w-3.5 h-3.5 text-amber-500 animate-bounce" /> Administrative Logs & Alerts
                  </h4>
                  {notifications.length > 0 && (
                    <button
                      onClick={handleClearAllNotifications}
                      className="text-xxs text-rose-400 hover:text-rose-300 hover:underline"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                <div className="max-h-64 overflow-y-auto space-y-2 custom-scrollbar">
                  {notifications.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-500">
                      No active alerts or events logged.
                    </div>
                  ) : (
                    notifications.map(n => (
                      <div
                        key={n.id}
                        className={`p-2.5 rounded-lg border text-left transition ${
                          n.is_read 
                            ? 'bg-slate-900/40 border-slate-850 text-slate-400' 
                            : 'bg-amber-500/5 border-amber-500/20 text-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5 mb-1">
                          <span className={`text-xs font-bold leading-none ${n.is_read ? 'text-slate-400' : 'text-amber-400'}`}>
                            {n.title}
                          </span>
                          {!n.is_read && (
                            <button
                              onClick={() => handleMarkAsRead(n.id)}
                              className="text-[10px] text-amber-500 hover:underline leading-none shrink-0"
                              title="Mark as read"
                            >
                              Mark read
                            </button>
                          )}
                        </div>
                        <p className="text-[11px] leading-relaxed break-words text-slate-300">{n.message}</p>
                        <span className="block text-[9px] text-slate-500 font-mono mt-1">
                          {new Date(n.created_at).toLocaleString()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          
          {onLogout && (
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/25 text-sm transition rounded-lg"
              title="End active administrator session"
            >
              <LogOut className="w-4 h-4" />
              Sign Out / Disconnect
            </button>
          )}
        </div>
      </div>

      {stats && (stats.vtu_provider_balance_ghs ?? 124.50) < (settings?.vtu_balance_threshold !== undefined ? Number(settings.vtu_balance_threshold) : 10) && (
        <div className="bg-rose-950/30 border border-rose-900/60 p-3.5 rounded-xl mb-6 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 animate-pulse" />
            <div className="text-left">
              <span className="font-bold text-rose-300 text-xs sm:text-sm block">⚠️ Low SubAndGain API Provider Wallet Balance</span>
              <span className="text-slate-405 text-xxs sm:text-xs leading-normal">
                Your VTU provider fund of <strong className="text-rose-400 font-mono">₵{Number(stats.vtu_provider_balance_ghs ?? 124.50).toFixed(2)}</strong> has dropped below your critical threshold of <strong className="text-slate-300 font-mono">₵{Number(settings?.vtu_balance_threshold !== undefined ? settings.vtu_balance_threshold : 10).toFixed(2)}</strong>. Outbound deliverability could fail!
              </span>
            </div>
          </div>
          {activeTab !== 'stats' && (
            <button
              onClick={() => setActiveTab('stats')}
              className="px-3 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold rounded-lg transition shrink-0"
            >
              Top Up Wallet Funds
            </button>
          )}
        </div>
      )}

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
            <div className="space-y-6 animate-fade-in">
              
              {/* LOW VTU BALANCE ALERT CALLOUT */}
              {(stats.vtu_provider_balance_ghs ?? 124.50) < (settings?.vtu_balance_threshold !== undefined ? Number(settings.vtu_balance_threshold) : 10) && (
                <div className="bg-rose-950/40 border border-rose-900/60 p-4 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg animate-pulse-subtle">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 bg-rose-500/10 text-rose-400 rounded-lg shrink-0 border border-rose-500/10">
                      <AlertCircle className="w-5 h-5 text-rose-400" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-100 text-sm">⚠️ Critical Gateway Notice: Low VTU Provider Wallet Balance</h4>
                      <p className="text-xs text-rose-300 mt-1 leading-relaxed">
                        Your SubAndGain API wallet balance currently stands at <span className="font-mono font-bold text-rose-400">₵{Number(stats.vtu_provider_balance_ghs ?? 124.50).toFixed(2)}</span>, which is below your customizable threshold of ₵{Number(settings?.vtu_balance_threshold !== undefined ? settings.vtu_balance_threshold : 10).toFixed(2)}. Outbound reseller bundle fulfillments could fail if this depletes!
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 w-full md:w-auto shrink-0 bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                    <input
                      type="number"
                      placeholder="GHS Amt"
                      id="vtu-topup-alert-input"
                      className="w-24 bg-slate-950 border border-slate-800 focus:border-amber-500 text-xs text-slate-200 px-2.5 py-1.5 rounded-md focus:outline-none placeholder-slate-600"
                    />
                    <button
                      onClick={async () => {
                        const valInput = document.getElementById('vtu-topup-alert-input') as HTMLInputElement;
                        const val = Number(valInput?.value);
                        if (!val || val <= 0 || isNaN(val)) {
                          showNotification('Please enter a valid positive top up amount.', 'danger');
                          return;
                        }
                        try {
                          const res = await fetch('/api/admin/subandgain/topup', {
                            method: 'POST',
                            headers: {
                              'Authorization': `Bearer ${token}`,
                              'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ amount: val })
                          });
                          const data = await res.json();
                          if (res.ok) {
                            showNotification(data.message, 'success');
                            if (valInput) valInput.value = '';
                            fetchData();
                          } else {
                            showNotification(data.error || 'Failed to top up balance.', 'danger');
                          }
                        } catch {
                          showNotification('Network connection error.', 'danger');
                        }
                      }}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs rounded-md shadow-md transition whitespace-nowrap"
                    >
                      Fund Wallet
                    </button>
                  </div>
                </div>
              )}

              {/* STATS HERO GRID - 5 COLUMN GRID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
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

                {/* 5TH CARD: VTU PROVIDER PREPAID CASH BALANCE */}
                <div className="bg-slate-800/50 p-5 rounded-xl border border-slate-800 flex flex-col justify-between">
                  <div>
                    <span className="text-slate-400 text-xs font-mono block">VTU GATEWAY WALLET</span>
                    <div className={`text-3xl font-bold font-sans mt-2 ${(stats.vtu_provider_balance_ghs ?? 124.50) < 10 ? 'text-rose-400 animate-pulse-fast' : 'text-amber-500'}`}>
                      ₵{Number(stats.vtu_provider_balance_ghs ?? 124.50).toFixed(2)}
                    </div>
                  </div>
                  <div className="flex gap-1.5 mt-2.5">
                    <input
                      type="number"
                      placeholder="₵ GHS"
                      id="grid-topup-direct-input"
                      className="w-16 bg-slate-900 border border-slate-750 focus:border-amber-500 text-[10px] text-slate-200 px-1.5 py-1 rounded focus:outline-none"
                    />
                    <button
                      onClick={async () => {
                        const valInput = document.getElementById('grid-topup-direct-input') as HTMLInputElement;
                        const val = Number(valInput?.value);
                        if (!val || val <= 0 || isNaN(val)) {
                          showNotification('Enter positive amount.', 'danger');
                          return;
                        }
                        try {
                          const res = await fetch('/api/admin/subandgain/topup', {
                            method: 'POST',
                            headers: {
                              'Authorization': `Bearer ${token}`,
                              'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ amount: val })
                          });
                          const data = await res.json();
                          if (res.ok) {
                            showNotification(data.message, 'success');
                            if (valInput) valInput.value = '';
                            fetchData();
                          } else {
                            showNotification(data.error || 'Failed topup.', 'danger');
                          }
                        } catch {
                          showNotification('Network error.', 'danger');
                        }
                      }}
                      className="px-2 py-1 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-extrabold text-[10px] rounded transition"
                    >
                      Topup
                    </button>
                  </div>
                </div>
              </div>

              {/* DAILY REVENUE TRENDS BAR CHART USING RECHARTS */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-200">7-Day Outbound Sales & Royalties Stream</h3>
                    <p className="text-xs text-slate-500">Aggregated daily metrics comparing retail merchant orders vs admin fee revenues.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-xs font-mono bg-slate-950/40 px-3 py-1.5 rounded-lg border border-slate-800/60">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 bg-amber-500 rounded-sm"></span>
                      <span className="text-slate-300">Sales: ₵{stats.daily_revenue_trends?.reduce((sum: number, d: any) => sum + d.revenue, 0).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 bg-emerald-500 rounded-sm"></span>
                      <span className="text-slate-300">Royalty Fees: ₵{stats.daily_revenue_trends?.reduce((sum: number, d: any) => sum + d.admin_fees, 0).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="relative h-72 w-full text-slate-300 pt-2" id="vtu-sales-recharts-container">
                  <ResponsiveContainer width="99%" height="100%" minWidth={0}>
                    <BarChart
                      data={stats.daily_revenue_trends || []}
                      margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} vertical={false} />
                      <XAxis 
                        dataKey="label" 
                        stroke="#64748b" 
                        fontSize={10} 
                        tickLine={false}
                        axisLine={{ stroke: '#334155' }}
                        tickMargin={8}
                      />
                      <YAxis 
                        stroke="#64748b" 
                        fontSize={10} 
                        tickLine={false}
                        axisLine={{ stroke: '#334155' }}
                        tickFormatter={(v) => `₵${v}`}
                        tickMargin={6}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#090d16', borderColor: '#1e293b', borderRadius: '10px', fontSize: '11px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.4)' }}
                        labelStyle={{ fontWeight: 'bold', color: '#f1f5f9', marginBottom: '4px' }}
                        itemStyle={{ padding: '2px 0' }}
                        formatter={(value: any, name: any) => [
                          `₵${Number(value).toFixed(2)}`, 
                          name === 'revenue' ? '📈 Sales Value' : name === 'admin_fees' ? '👑 Admin Profit' : name
                        ]}
                      />
                      <Bar dataKey="revenue" fill="#f59e0b" radius={[4, 4, 0, 0]} name="revenue" maxBarSize={32} />
                      <Bar dataKey="admin_fees" fill="#10b981" radius={[4, 4, 0, 0]} name="admin_fees" maxBarSize={32} />
                    </BarChart>
                  </ResponsiveContainer>
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

              {/* ADMIN DIRECT EARNINGS WITHDRAWALS SECTION */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-200">👑 Administrative Profit Claims & Revenue Payouts</h3>
                    <p className="text-xs text-slate-500">Claim your accumulated marketplace sales royalty cuts and merchant store subscription fees directly.</p>
                  </div>
                  <button
                    onClick={() => setAdminWithdrawModalOpen(true)}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-slate-950 font-extrabold text-xs rounded-lg shadow transition whitespace-nowrap"
                  >
                    🚀 Withdraw Admin Profit
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-slate-950/30 p-4 rounded-xl border border-slate-850">
                    <span className="text-slate-400 text-xxs font-mono block uppercase">Gross Admin Profit (All-Time)</span>
                    <div className="text-2xl font-bold font-sans text-slate-200 mt-1">
                      ₵{(Number(stats.total_admin_fees_earned_ghs || 0) + Number(stats.total_registrations_earned_ghs || 0)).toFixed(2)}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      ₵{(Number(stats.total_admin_fees_earned_ghs || 0) - Number(stats.total_forfeited_reseller_profit_ghs || 0)).toFixed(2)} royalties + ₵{Number(stats.total_registrations_earned_ghs || 0).toFixed(2)} signups 
                      {Number(stats.total_forfeited_reseller_profit_ghs || 0) > 0 && ` + ₵${Number(stats.total_forfeited_reseller_profit_ghs || 0).toFixed(2)} confiscated margins`}
                    </p>
                  </div>

                  <div className="bg-slate-950/30 p-4 rounded-xl border border-slate-850">
                    <span className="text-slate-400 text-xxs font-mono block uppercase">Total Profits Withdrawn</span>
                    <div className="text-2xl font-bold font-sans text-rose-450 mt-1">
                      -₵{Number(settings?.admin_total_withdrawn_ghs || 0).toFixed(2)}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">Disbursed out of system</p>
                  </div>

                  <div className="bg-slate-950/30 p-4 rounded-xl border border-slate-850 bg-emerald-500/5">
                    <span className="text-emerald-400 text-xxs font-mono block uppercase">Available Claims Balance</span>
                    <div className="text-2xl font-bold font-sans text-emerald-400 mt-1">
                      ₵{Math.max(0, (Number(stats.total_admin_fees_earned_ghs || 0) + Number(stats.total_registrations_earned_ghs || 0)) - Number(settings?.admin_total_withdrawn_ghs || 0)).toFixed(2)}
                    </div>
                    <p className="text-[10px] text-emerald-500/60 mt-1">Available for instant manual claim</p>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <h4 className="text-xs font-mono uppercase text-slate-400 font-semibold tracking-wide">Claims History Log ({
                    (() => {
                      let logs: any[] = [];
                      try {
                        logs = JSON.parse(settings?.admin_withdrawal_logs || '[]');
                      } catch {
                        logs = [];
                      }
                      return logs.length;
                    })()
                  })</h4>
                  
                  {(() => {
                    let logs: any[] = [];
                    try {
                      logs = JSON.parse(settings?.admin_withdrawal_logs || '[]');
                      if (!Array.isArray(logs)) logs = [];
                    } catch {
                      logs = [];
                    }

                    if (logs.length === 0) {
                      return (
                        <div className="text-center py-6 bg-slate-950/25 border border-slate-850 rounded text-slate-500 text-xs italic font-sans">
                          No previous administrative claims payout has been logged. Use "Withdraw Admin Profit" above to disburse.
                        </div>
                      );
                    }

                    return (
                      <div className="overflow-x-auto max-h-64 overflow-y-auto border border-slate-850 rounded-lg">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-950/60 border-b border-slate-850 text-slate-400 uppercase font-mono text-[10px]">
                              <th className="py-2.5 px-3">Payout ID</th>
                              <th className="py-2.5 px-3">Amount</th>
                              <th className="py-2.5 px-3">Date & Time</th>
                              <th className="py-2.5 px-3">Receiving Destination & Method</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-850 bg-slate-950/20">
                            {logs.map((log: any) => (
                              <tr key={log.id} className="hover:bg-slate-850/30 text-slate-300">
                                <td className="py-2.5 px-3 font-mono font-medium text-slate-500">{log.id}</td>
                                <td className="py-2.5 px-3 font-mono font-bold text-emerald-400">₵{Number(log.amount_ghs).toFixed(2)}</td>
                                <td className="py-2.5 px-3 text-slate-400 font-sans">
                                  {new Date(log.created_at).toLocaleString('en-US', { hour12: true, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </td>
                                <td className="py-2.5 px-3 italic font-sans text-slate-400 max-w-xs truncate" title={log.details}>
                                  {log.details}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: INVENTORY BUNDLES CRUD */}
          {activeTab === 'bundles' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-slate-200">System Base Data Bundles</h3>
                <div className="flex items-center gap-2">
                  {user?.email?.toLowerCase() === 'aaronbinka173@gmail.com' && (
                    <button
                      onClick={handleResetBundlesToDefaults}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm transition font-semibold border ${
                        resetConfirmOpen 
                          ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-500 animate-pulse' 
                          : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/30'
                      }`}
                    >
                      <RotateCcw className="w-4 h-4" />
                      {resetConfirmOpen ? 'Confirm Package Wipe' : 'Reset to Defaults'}
                    </button>
                  )}
                  <button
                    onClick={handleOpenCreateBundle}
                    className="flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold px-4 py-2 rounded-lg text-sm transition"
                  >
                    <Plus className="w-4 h-4" />
                    Create New Bundle
                  </button>
                </div>
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
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => {
                      setSmsTarget('all');
                      setSmsModalOpen(true);
                      fetchSmsLogs();
                    }}
                    className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-105 border border-slate-700 hover:border-slate-500 px-4 py-2 rounded-lg text-xs font-semibold shadow-md transition"
                  >
                    <MessageSquare className="w-4 h-4 text-amber-500 animate-pulse" />
                    <span>SMS Broadcast</span>
                  </button>
                  <button
                    onClick={() => {
                      setEmailTarget('all');
                      setEmailModalOpen(true);
                      fetchEmailLogs();
                    }}
                    className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 px-4 py-2 rounded-lg text-xs font-extrabold shadow-lg transition"
                  >
                    <Mail className="w-4 h-4 text-slate-950" />
                    <span>Email Broadcast</span>
                  </button>
                </div>
              </div>

              {/* Sub-Agent Invitation & Referral Link Card */}
              <div className="bg-slate-900 border border-slate-850 rounded-xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1 max-w-2xl">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-amber-500/10 text-amber-400">
                    👑 Admin Onboarding Tool
                  </span>
                  <h4 className="text-sm font-semibold text-slate-100">
                    Sub-Agent (Reseller) Registration Link
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Copy and send this unique onboarding invitation link to anyone you want to register as a sub-agent. Once they sign up through this link, they can easily create their own storefront under your administrative network.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 min-w-full md:min-w-[400px] md:max-w-md">
                  <div className="flex-1 bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-xs text-amber-500 font-mono select-all truncate break-all">
                    {`${window.location.origin}/?register=true`}
                  </div>
                  <button
                    onClick={() => {
                      const inviteLink = `${window.location.origin}/?register=true`;
                      navigator.clipboard.writeText(inviteLink);
                      setCopiedInviteLink(true);
                      showNotification("Sub-Agent recruitment invitation link successfully copied to your clipboard!", "success");
                      setTimeout(() => setCopiedInviteLink(false), 3000);
                    }}
                    className={`flex items-center justify-center gap-1.5 py-2 px-4 rounded-lg text-xs font-bold transition-all whitespace-nowrap active:scale-95 shadow ${
                      copiedInviteLink
                        ? "bg-emerald-500 text-slate-950"
                        : "bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950"
                    }`}
                  >
                    {copiedInviteLink ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copy Invite Link</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Account Filter Tabs */}
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                <button
                  type="button"
                  onClick={() => setAccountFilter('all')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    accountFilter === 'all'
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                  }`}
                >
                  All Accounts ({resellers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAccountFilter('reseller')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    accountFilter === 'reseller'
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                  }`}
                >
                  Resellers ({resellers.filter(u => u.role === 'reseller').length})
                </button>
                <button
                  type="button"
                  onClick={() => setAccountFilter('customer')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    accountFilter === 'customer'
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                  }`}
                >
                  Customers ({resellers.filter(u => u.role === 'customer').length})
                </button>
              </div>

              {resellers.filter(r => accountFilter === 'all' ? true : r.role === accountFilter).length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  {accountFilter === 'customer' ? 'No end customer accounts found.' : 'No resellers live yet. Promote storefront CTA to seed registration.'}
                </div>
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
                      {resellers
                        .filter(r => accountFilter === 'all' ? true : r.role === accountFilter)
                        .map(r => (
                          <tr key={r.user_id} className="border-b border-slate-850 hover:bg-slate-850/50 text-slate-300">
                            <td className="py-3.5 px-4">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-semibold text-slate-100">{r.store_name || r.email.split('@')[0]}</span>
                                {r.role === 'admin' && (
                                  <span className="bg-amber-500/10 text-amber-500 text-[10px] font-bold px-1.5 py-0.5 rounded border border-amber-500/30 uppercase tracking-wide">
                                    Admin
                                  </span>
                                )}
                                {r.role === 'customer' && (
                                  <span className="bg-cyan-500/10 text-cyan-400 text-[10px] font-bold px-1.5 py-0.5 rounded border border-cyan-500/30 uppercase tracking-wide">
                                    Customer
                                  </span>
                                )}
                                {r.role === 'reseller' && (
                                  <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-bold px-1.5 py-0.5 rounded border border-emerald-500/30 uppercase tracking-wide">
                                    Reseller
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-500">{r.email}</div>
                            </td>
                            <td className="py-3.5 px-4">
                              {r.role === 'reseller' && r.store_slug ? (
                                <a 
                                  href={`/store/${r.store_slug}`} 
                                  target="_blank" 
                                  rel="noreferrer" 
                                  className="text-amber-400 hover:underline font-mono text-xs"
                                >
                                  store/{r.store_slug}
                                </a>
                              ) : (
                                <span className="text-slate-500 text-xs italic">N/A (Direct Buyer)</span>
                              )}
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

                              {/* Direct Email button */}
                              <button
                                onClick={() => {
                                  setEmailTarget(String(r.user_id));
                                  setEmailSubject(`System Notice from Mac Hub Administration`);
                                  setEmailMessage(`Dear ${r.store_name || 'Agent'},\n\nWe would like to coordinate administrative updates regarding your Ghanaian reseller account configurations.\n\nBest regards,\nAaron Binka`);
                                  setEmailModalOpen(true);
                                  fetchEmailLogs();
                                }}
                                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-750 hover:border-emerald-500/50 rounded flex items-center gap-1 text-xs font-semibold transition-colors"
                                title="Send support Email notice to this partner reseller"
                              >
                                <Mail className="w-3 h-3" />
                                <span>Email</span>
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

                              {/* Delete Account */}
                              {r.email?.toLowerCase() !== 'aaronbinka173@gmail.com' && (
                                <button
                                  onClick={() => handleDeleteReseller(r)}
                                  disabled={togglingResellerId === r.user_id}
                                  className="px-2 py-1 bg-rose-600/10 hover:bg-rose-650 text-rose-400 hover:text-slate-100 border border-rose-900/40 rounded flex items-center gap-1 text-xs font-semibold overflow-hidden transition-all duration-200"
                                  title="Permanently Purge Reseller Partner Account"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>Delete</span>
                                </button>
                              )}
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-lg font-medium text-slate-200">Global Customer Order Book Ledger</h3>
                  <p className="text-xs text-slate-400">Track and filter incoming direct and reseller storefront checkout transactions.</p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-mono">Status Filter:</span>
                  <select
                    id="admin-order-status-filter"
                    value={orderStatusFilter}
                    onChange={(e) => setOrderStatusFilter(e.target.value as any)}
                    className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg p-2 focus:outline-none focus:border-amber-500 transition-colors cursor-pointer min-w-[160px]"
                  >
                    <option value="all">📢 All Orders</option>
                    <option value="paid">💳 Paid (Completed Payment)</option>
                    <option value="delivered">📦 Delivered (Successful Delivery)</option>
                    <option value="failed">❌ Failed (Payment/Delivery Failed)</option>
                    <option value="pending">⏳ Pending (Undelivered / Not Paid)</option>
                  </select>
                </div>
              </div>

              {orders.length === 0 ? (
                <div className="text-center py-12 text-slate-400">Order ledger is fully empty. Start checkout test sessions to populate data.</div>
              ) : (
                (() => {
                  const filteredOrders = orders.filter(o => {
                    if (orderStatusFilter === 'all') return true;
                    if (orderStatusFilter === 'paid') return o.payment_status === 'paid';
                    if (orderStatusFilter === 'delivered') return o.delivery_status === 'delivered';
                    if (orderStatusFilter === 'failed') return o.delivery_status === 'failed' || o.payment_status === 'failed';
                    if (orderStatusFilter === 'pending') return o.delivery_status === 'pending' || o.payment_status === 'pending';
                    return true;
                  });

                  if (filteredOrders.length === 0) {
                    return (
                      <div className="text-center py-12 text-slate-400 border border-slate-800 bg-slate-900/30 rounded-xl">
                        No orders recorded matching the status filter: <span className="font-semibold text-amber-500 font-mono">"{orderStatusFilter}"</span>.
                      </div>
                    );
                  }

                  return (
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
                            <th className="py-3 px-4 text-amber-500">Store Tax</th>
                            <th className="py-3 px-4">Payment</th>
                            <th className="py-3 px-4">Bundle Delivery</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredOrders.map(o => (
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
                              <td className="py-3.5 px-4 font-mono text-amber-500 font-medium font-sans">₵{Number(o.tax_fee_ghs || 0).toFixed(2)}</td>
                              <td className="py-3.5 px-4 text-xs font-semibold">
                                <span className={`px-2 py-0.5 rounded ${
                                  o.payment_status === 'paid' ? 'bg-emerald-950 text-emerald-300 border border-emerald-900' : 'bg-rose-950 text-rose-300 border border-rose-900'
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
                  );
                })()
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

              {/* NON-TECHNICAL SETUP ASSISTANT */}
              <div className="bg-gradient-to-r from-amber-500/10 to-indigo-950/20 border border-amber-550/30 rounded-2xl p-6 relative overflow-hidden backdrop-blur-md">
                <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                  <div className="space-y-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-400/10 text-amber-300 text-xxs font-black uppercase tracking-widest rounded-full border border-amber-500/20">
                      💡 One-Click Setup Assistant for Aaron
                    </span>
                    <h3 className="text-lg font-black text-slate-100 tracking-tight">Don't have API keys yet? Test instantly with Sandbox Mode!</h3>
                    <p className="text-slate-350 text-xs leading-relaxed max-w-3xl">
                      We understand that getting real keys from <strong>Paystack, mNotify, and SubAndGain</strong> can be tedious or confusing. 
                      You <strong>do not need them</strong> to test your platform! With our advanced simulated gateway environment:
                    </p>
                    <ul className="text-slate-400 text-xs list-disc pl-5 space-y-1 mt-1 font-sans">
                      <li>Purchases bypass actual charges and simulate successful mobile money (MoMo) payments.</li>
                      <li>Data bundles simulate instant, successful virtual crediting over carrier networks.</li>
                      <li>Receipt emails and SMS notifications output transparent logs inside the Admin dashboard console!</li>
                    </ul>
                  </div>

                  <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 shrink-0 w-full lg:w-auto">
                    <button
                      type="button"
                      onClick={handlePreloadSandboxDefaults}
                      disabled={preloadingSandbox}
                      className="flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-550 text-slate-950 font-black text-xs px-6 py-3.5 rounded-xl uppercase tracking-wider transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-amber-500/10 disabled:opacity-50 w-full sm:w-auto"
                    >
                      <RefreshCw className={`w-4 h-4 ${preloadingSandbox ? 'animate-spin' : ''}`} />
                      {preloadingSandbox ? 'Setting Up...' : '⚡ Configure Sandbox Keys'}
                    </button>

                    <button
                      type="button"
                      onClick={handleResetToProduction}
                      disabled={preloadingSandbox}
                      className="flex items-center justify-center gap-2 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-650 text-slate-100 font-extrabold text-xs px-6 py-3.5 rounded-xl uppercase tracking-wider transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-rose-600/10 disabled:opacity-50 w-full sm:w-auto"
                      title="Wipe all simulation counters, purge test users, deactivate test mode, and launch real production figures."
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>🧹 Wipe Demo Data (Go Live)</span>
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Sandbox mode section */}
              <div className="bg-slate-800/40 p-5 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h4 className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <LANDMARK_TAG className="text-amber-500 w-5 h-5" />
                    Paystack & SubAndGain Test Simulator
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

              {/* Platform Backup & Restore Center */}
              <div className="bg-slate-900 border border-slate-850 rounded-2xl p-6 space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                    <Database className="w-5 h-5 text-amber-500" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-slate-200">System Database Backup & Integrity Recovery</h4>
                    <p className="text-slate-400 text-xs leading-relaxed max-w-4xl font-sans">
                      Prevent reseller storefronts or transaction logs from being lost. Because Cloud environment containers periodically recycle and reset local states to defaults, please download a JSON database backup regularly. If a container reset ever removes your registered partners, you can restore everything back to normal in seconds.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleExportDatabase}
                    className="flex items-center gap-2 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 font-bold px-4 py-2 rounded-xl text-xs transition uppercase tracking-wider"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-amber-500" />
                    Export JSON Database Backup
                  </button>

                  <div className="relative font-bold">
                    <label className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 cursor-pointer text-slate-950 px-4 py-2 rounded-xl text-xs transition uppercase tracking-wider">
                      <Plus className="w-4 h-4" />
                      Restore / Upload Backup File
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleImportDatabase}
                        disabled={importingDb}
                        className="hidden"
                      />
                    </label>
                  </div>
                  
                  {importingDb && (
                    <span className="text-xxs font-mono text-amber-500 animate-pulse">
                      Processing restore, updating database rows...
                    </span>
                  )}
                </div>
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

                {/* Resellers Only WhatsApp Community & Channel Links configuration */}
                <form onSubmit={handleUpdateWhatsappLink} className="bg-slate-800/20 p-5 rounded-xl border border-slate-800 space-y-4 flex flex-col justify-between">
                  <div>
                    <h4 className="font-semibold text-slate-100 border-b border-slate-800 pb-2 flex items-center gap-1.5">
                      <span className="text-emerald-500 text-base">💬</span> WhatsApp Channel & Community
                    </h4>
                    <p className="text-slate-500 text-xs block mt-1.5">
                      Configure your official WhatsApp Channel and Community links. These are displayed as responsive join-icons across the platform for resellers and consumers.
                    </p>
                    <div className="mt-3 space-y-3">
                      <div>
                        <label className="text-slate-400 text-xs font-mono block mb-1">WhatsApp Group / Community Link</label>
                        <input
                          type="url"
                          placeholder="https://chat.whatsapp.com/..."
                          value={settings.whatsapp_community_link || ''}
                          onChange={(e) => setSettings({ ...settings, whatsapp_community_link: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 p-2 text-sm text-slate-200 rounded focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-slate-400 text-xs font-mono block mb-1">WhatsApp Channel Link</label>
                        <input
                          type="url"
                          placeholder="https://whatsapp.com/channel/..."
                          value={settings.whatsapp_channel_link || ''}
                          onChange={(e) => setSettings({ ...settings, whatsapp_channel_link: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 p-2 text-sm text-slate-200 rounded focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                  <button type="submit" className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 transition text-slate-950 font-bold text-xs rounded uppercase mt-auto">
                    Save WhatsApp Links
                  </button>
                </form>

                {/* Platform Branding Configuration */}
                <form onSubmit={handleUpdateBranding} className="bg-slate-800/20 p-5 rounded-xl border border-slate-800 space-y-4 flex flex-col justify-between">
                  <div>
                    <h4 className="font-semibold text-slate-100 border-b border-slate-800 pb-2 flex items-center gap-1.5">
                      <span className="text-amber-500 text-base">🎨</span> Platform Branding & Theme
                    </h4>
                    <p className="text-slate-500 text-xs block mt-1.5">
                      Configure your data storefront site name, choose color accent themes, custom background shades, and custom background images.
                    </p>
                    <div className="mt-3 space-y-3">
                      <div>
                        <label className="text-slate-400 text-xs font-mono block mb-1">Site Custom Name</label>
                        <input
                          type="text"
                          placeholder="Mac Data Hub"
                          value={settings.site_name || ''}
                          onChange={(e) => setSettings({ ...settings, site_name: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 p-2 text-sm text-slate-200 rounded focus:outline-none"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-slate-400 text-xs font-mono block mb-1">Brand Theme Accent Color</label>
                        <select
                          value={settings.site_color || 'amber'}
                          onChange={(e) => setSettings({ ...settings, site_color: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 p-2 text-sm text-slate-200 rounded focus:outline-none"
                        >
                          <option value="amber">Default Amber Gold</option>
                          <option value="emerald">Emerald Dynamic Green</option>
                          <option value="blue">Vibrant Electric Blue</option>
                          <option value="indigo">Classic Royal Indigo</option>
                          <option value="rose">Elegant Rose Red</option>
                          <option value="violet">Deep Violet Purple</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-slate-400 text-xs font-mono block mb-1">Custom Background Color (Hex, e.g. #0f172a)</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="#0f172a"
                            value={settings.site_bg_color || ''}
                            onChange={(e) => setSettings({ ...settings, site_bg_color: e.target.value })}
                            className="flex-1 bg-slate-900 border border-slate-700 focus:border-amber-500 p-2 text-sm text-slate-200 rounded focus:outline-none"
                          />
                          <input
                            type="color"
                            value={settings.site_bg_color && settings.site_bg_color.startsWith('#') && settings.site_bg_color.length === 7 ? settings.site_bg_color : '#0f172a'}
                            onChange={(e) => setSettings({ ...settings, site_bg_color: e.target.value })}
                            className="w-10 h-9 p-0.5 bg-slate-900 border border-slate-700 rounded cursor-pointer"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-slate-400 text-xs font-mono block mb-1">Imported Background (Photo/Video URL or Gallery Upload)</label>
                        <div className="space-y-2">
                          <input
                            type="text"
                            placeholder="https://example.com/video.mp4"
                            value={settings.site_bg_image || ''}
                            onChange={(e) => setSettings({ ...settings, site_bg_image: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 p-2 text-sm text-slate-200 rounded focus:outline-none"
                          />
                          
                          <div className="flex items-center gap-2">
                            <label className="flex-1 flex flex-col items-center justify-center border border-dashed border-slate-700 hover:border-amber-500 bg-slate-940 hover:bg-slate-800/40 p-2.5 rounded cursor-pointer transition">
                              <span className="text-[11px] text-amber-500 font-semibold">📁 Select Image/Video from Device Gallery...</span>
                              <span className="text-[9px] text-slate-500 font-mono mt-0.5">Supports images & videos (direct uploads under 700KB, or external URL)</span>
                              <input 
                                type="file" 
                                accept="image/*,video/*" 
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    if (file.type.startsWith('video/')) {
                                      if (file.size > 700 * 1024) {
                                        alert("Because this app runs with a Firestore cloud database, direct device video uploads are restricted to under 700KB to stay within cloud storage constraints. \n\nFor larger or high-resolution background videos, please paste any direct external URL (MP4/WebM) in the input field above, which will stream with zero latency at any file size!");
                                        return;
                                      }
                                    } else if (file.size > 12 * 1024 * 1024) {
                                      alert("This file is too large. Please select an image under 12MB, which will be optimized automatically.");
                                      return;
                                    }
                                    const reader = new FileReader();
                                    reader.onload = (event) => {
                                      const rawResult = event.target?.result as string;
                                      if (rawResult) {
                                        if (file.type.startsWith('image/')) {
                                          const img = new Image();
                                          img.src = rawResult;
                                          img.onload = () => {
                                            const max_width = 1000;
                                            const max_height = 650;
                                            let width = img.width;
                                            let height = img.height;
                                            if (width > max_width || height > max_height) {
                                              if (width > height) {
                                                height *= max_width / width;
                                                width = max_width;
                                              } else {
                                                width *= max_height / height;
                                                height = max_height;
                                              }
                                            }
                                            
                                            // Adaptive compression to guarantee base64 image length stays safely under 900 thousand characters
                                            const loopCompress = (imgObj: HTMLImageElement, q: number, w: number, h: number) => {
                                              const canvas = document.createElement('canvas');
                                              canvas.width = Math.round(w);
                                              canvas.height = Math.round(h);
                                              const ctx = canvas.getContext('2d');
                                              if (ctx) {
                                                ctx.drawImage(imgObj, 0, 0, canvas.width, canvas.height);
                                                const compressed = canvas.toDataURL('image/jpeg', q);
                                                if (compressed.length > 900000 && (w > 320 || h > 240 || q > 0.2)) {
                                                  // Downscale more aggressively and reduce quality to fit database limits
                                                  loopCompress(imgObj, Math.max(0.15, q - 0.15), w * 0.75, h * 0.75);
                                                } else {
                                                  setSettings({ ...settings, site_bg_image: compressed });
                                                }
                                              } else {
                                                setSettings({ ...settings, site_bg_image: rawResult.length < 950000 ? rawResult : '' });
                                                if (rawResult.length >= 950000) {
                                                  alert("This image is too large for the database. Please select a compressed image or use a direct URL.");
                                                }
                                              }
                                            };
                                            
                                            loopCompress(img, 0.75, width, height);
                                          };
                                          img.onerror = () => {
                                            setSettings({ ...settings, site_bg_image: rawResult.length < 950000 ? rawResult : '' });
                                            if (rawResult.length >= 950000) {
                                              alert("Failed to load or optimize this image.");
                                            }
                                          };
                                        } else {
                                          if (rawResult.length < 950000) {
                                            setSettings({ ...settings, site_bg_image: rawResult });
                                          } else {
                                            alert("Even though the video is small, its encoded size exceeds database limits. Please compress it further or use an external link.");
                                          }
                                        }
                                      }
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }}
                              />
                            </label>
                            
                            {settings.site_bg_image && (
                              <button
                                type="button"
                                onClick={() => setSettings({ ...settings, site_bg_image: '' })}
                                className="px-3 py-4 bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border border-rose-500/20 text-xs rounded font-bold transition shrink-0"
                              >
                                Clear
                              </button>
                            )}
                          </div>
                          
                          {settings.site_bg_image && (settings.site_bg_image.startsWith('data:') || settings.site_bg_image.startsWith('http')) && (
                            <div className="flex items-center gap-2 bg-slate-900 p-2 rounded border border-slate-800">
                              <div className="w-8 h-8 rounded overflow-hidden bg-slate-950 shrink-0 border border-slate-800 flex items-center justify-center">
                                {isVideoMedia(settings.site_bg_image) ? (
                                  <video src={settings.site_bg_image} muted className="w-full h-full object-cover" />
                                ) : (
                                  <img src={settings.site_bg_image} alt="Upload Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-[9px] text-emerald-400 font-bold font-mono">
                                  ✓ Gallery {isVideoMedia(settings.site_bg_image) ? 'Video' : 'Image'} Loaded
                                </p>
                                <p className="text-[8px] text-slate-500 font-mono truncate">{settings.site_bg_image.substring(0, 45)}...</p>
                              </div>
                            </div>
                          )}
                        </div>
                        <p className="text-slate-500 text-[10px] mt-0.5">Leave blank to use base theme solid color. Upload an image or video from your device gallery, or specify an external link.</p>
                      </div>
                    </div>
                  </div>
                  <button type="submit" className="w-full py-1.5 bg-amber-500 hover:bg-amber-600 transition text-slate-950 font-bold text-xs rounded uppercase mt-4">
                    Save Brand settings
                  </button>
                </form>

                {/* Global Typography & Custom Writing Design */}
                <form onSubmit={handleUpdateTypography} className="bg-slate-800/20 p-5 rounded-xl border border-slate-800 space-y-4 flex flex-col justify-between col-span-1 md:col-span-2 lg:col-span-2 xl:col-span-2">
                  <div className="space-y-4">
                    <h4 className="font-semibold text-slate-100 border-b border-slate-800 pb-2 flex items-center gap-1.5">
                      <span className="text-amber-500 text-base">✍️</span> Platform Typography & Color Control
                    </h4>
                    <p className="text-slate-500 text-[11px] leading-relaxed">
                      Configure custom fonts (from Google Fonts or system), modify base text sizes, and set hex codes for any writing/headings across the site.
                    </p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {/* Font Family preset helper & manual entry */}
                      <div className="space-y-1">
                        <label className="text-slate-400 text-xs font-mono block">Font Style / Family</label>
                        <select
                          value={['Outfit', 'Inter', 'Space Grotesk', 'JetBrains Mono', 'Playfair Display', 'Cinzel', 'Roboto', 'Georgia', 'Pacifico'].includes(settings.global_font_style || 'Outfit') ? (settings.global_font_style || 'Outfit') : 'custom'}
                          onChange={(e) => {
                            if (e.target.value !== 'custom') {
                              setSettings({ ...settings, global_font_style: e.target.value });
                            }
                          }}
                          className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 p-2 text-xs text-slate-200 rounded focus:outline-none mb-1.5"
                        >
                          <option value="Outfit">Outfit (Default Modern)</option>
                          <option value="Inter">Inter (Swiss Neutral)</option>
                          <option value="Space Grotesk">Space Grotesk (Tech Focus)</option>
                          <option value="JetBrains Mono">JetBrains Mono (Technical)</option>
                          <option value="Playfair Display">Playfair Display (Serif Elegance)</option>
                          <option value="Cinzel">Cinzel (Roman Aesthetic)</option>
                          <option value="Roboto">Roboto (Google Standard)</option>
                          <option value="Georgia">Georgia (Classic Bookish)</option>
                          <option value="Pacifico">Pacifico (Playful script)</option>
                          <option value="custom">-- Enter Custom Font Below --</option>
                        </select>
                        <input
                          type="text"
                          placeholder="Or details e.g. Poppins"
                          value={settings.global_font_style || ''}
                          onChange={(e) => setSettings({ ...settings, global_font_style: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 p-2 text-xs text-slate-200 rounded-lg focus:outline-none font-mono"
                        />
                      </div>

                      {/* Font Sizing scale */}
                      <div className="space-y-1">
                        <label className="text-slate-400 text-xs font-mono block">Base Font Sizing</label>
                        <select
                          value={['13px', '14px', '15px', '16px', '17px', '18px', '20px', '22px'].includes(settings.global_font_size || '16px') ? (settings.global_font_size || '16px') : 'custom'}
                          onChange={(e) => {
                            if (e.target.value !== 'custom') {
                              setSettings({ ...settings, global_font_size: e.target.value });
                            }
                          }}
                          className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 p-2 text-xs text-slate-200 rounded focus:outline-none mb-1.5"
                        >
                          <option value="13px">13px (Compact)</option>
                          <option value="14px">14px (Medium-Small)</option>
                          <option value="15px">15px (Cozy)</option>
                          <option value="16px">16px (Normal Default)</option>
                          <option value="17px">17px (Spacious)</option>
                          <option value="18px">18px (Large Reading)</option>
                          <option value="20px">20px (Extra Large)</option>
                          <option value="22px">22px (Accessibility Max)</option>
                          <option value="custom">-- Choose custom scale --</option>
                        </select>
                        <input
                          type="text"
                          placeholder="Or type value e.g. 15px, 0.95rem"
                          value={settings.global_font_size || ''}
                          onChange={(e) => setSettings({ ...settings, global_font_size: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 p-2 text-xs text-slate-200 rounded-lg focus:outline-none font-mono"
                        />
                      </div>
                    </div>

                    {/* Colors custom palette mapping with html color picker input helper */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                      {/* primary */}
                      <div className="space-y-1">
                        <label className="text-slate-400 text-[10px] uppercase font-mono block leading-none">Titles</label>
                        <div className="flex items-center gap-1">
                          <input
                            type="color"
                            value={settings.global_text_color_primary ? (settings.global_text_color_primary.startsWith('#') && settings.global_text_color_primary.length === 7 ? settings.global_text_color_primary : '#f8fafc') : '#f8fafc'}
                            onChange={(e) => setSettings({ ...settings, global_text_color_primary: e.target.value })}
                            className="bg-transparent border-0 w-5 h-5 p-0 rounded cursor-pointer shrink-0"
                          />
                          <input
                            type="text"
                            placeholder="Hex GHS"
                            value={settings.global_text_color_primary || ''}
                            onChange={(e) => setSettings({ ...settings, global_text_color_primary: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 text-[10px] text-slate-200 p-1 rounded focus:outline-none font-mono"
                          />
                        </div>
                      </div>

                      {/* body text */}
                      <div className="space-y-1">
                        <label className="text-slate-400 text-[10px] uppercase font-mono block leading-none">Body text</label>
                        <div className="flex items-center gap-1">
                          <input
                            type="color"
                            value={settings.global_text_color_body ? (settings.global_text_color_body.startsWith('#') && settings.global_text_color_body.length === 7 ? settings.global_text_color_body : '#cbd5e1') : '#cbd5e1'}
                            onChange={(e) => setSettings({ ...settings, global_text_color_body: e.target.value })}
                            className="bg-transparent border-0 w-5 h-5 p-0 rounded cursor-pointer shrink-0"
                          />
                          <input
                            type="text"
                            placeholder="Hex GHS"
                            value={settings.global_text_color_body || ''}
                            onChange={(e) => setSettings({ ...settings, global_text_color_body: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 text-[10px] text-slate-200 p-1 rounded focus:outline-none font-mono"
                          />
                        </div>
                      </div>

                      {/* muted helper text */}
                      <div className="space-y-1">
                        <label className="text-slate-400 text-[10px] uppercase font-mono block leading-none">Labels</label>
                        <div className="flex items-center gap-1">
                          <input
                            type="color"
                            value={settings.global_text_color_muted ? (settings.global_text_color_muted.startsWith('#') && settings.global_text_color_muted.length === 7 ? settings.global_text_color_muted : '#64748b') : '#64748b'}
                            onChange={(e) => setSettings({ ...settings, global_text_color_muted: e.target.value })}
                            className="bg-transparent border-0 w-5 h-5 p-0 rounded cursor-pointer shrink-0"
                          />
                          <input
                            type="text"
                            placeholder="Hex GHS"
                            value={settings.global_text_color_muted || ''}
                            onChange={(e) => setSettings({ ...settings, global_text_color_muted: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 text-[10px] text-slate-200 p-1 rounded focus:outline-none font-mono"
                          />
                        </div>
                      </div>

                      {/* accent highlight text */}
                      <div className="space-y-1">
                        <label className="text-slate-400 text-[10px] uppercase font-mono block leading-none">Highlights</label>
                        <div className="flex items-center gap-1">
                          <input
                            type="color"
                            value={settings.global_text_color_accent ? (settings.global_text_color_accent.startsWith('#') && settings.global_text_color_accent.length === 7 ? settings.global_text_color_accent : '#f59e0b') : '#f59e0b'}
                            onChange={(e) => setSettings({ ...settings, global_text_color_accent: e.target.value })}
                            className="bg-transparent border-0 w-5 h-5 p-0 rounded cursor-pointer shrink-0"
                          />
                          <input
                            type="text"
                            placeholder="Hex GHS"
                            value={settings.global_text_color_accent || ''}
                            onChange={(e) => setSettings({ ...settings, global_text_color_accent: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 text-[10px] text-slate-200 p-1 rounded focus:outline-none font-mono"
                          />
                        </div>
                      </div>
                    </div>
                    
                    {/* Clear/Reset button for convenience */}
                    <div className="flex justify-between items-center pt-0.5">
                      <span className="text-[10px] text-slate-500 font-sans leading-none">All colors support any HEX values</span>
                      <button
                        type="button"
                        onClick={() => {
                          setSettings({
                            ...settings,
                            global_font_style: 'Outfit',
                            global_font_size: '16px',
                            global_text_color_primary: '',
                            global_text_color_body: '',
                            global_text_color_muted: '',
                            global_text_color_accent: '',
                          });
                          showNotification('Visual canvas values reset! Save changes to apply.', 'success');
                        }}
                        className="text-slate-500 hover:text-slate-400 text-[10px] font-bold uppercase tracking-wide font-mono transition"
                      >
                        Reset Defaults
                      </button>
                    </div>
                  </div>
                  
                  <button type="submit" className="w-full py-1.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 transition text-slate-950 font-black text-xs rounded uppercase tracking-wider shadow shadow-amber-500/10 mt-4">
                    Save Typography settings
                  </button>
                </form>

                {/* Storefront Customer Tax Fee */}
                <form onSubmit={handleUpdateCustomerTax} className="bg-slate-800/20 p-5 rounded-xl border border-slate-800 space-y-4 flex flex-col justify-between">
                  <div>
                    <h4 className="font-semibold text-slate-100 border-b border-slate-800 pb-2 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <span className="text-amber-500 text-base">💰</span> Customer Tax Surcharge
                      </span>
                      <button
                        type="button"
                        onClick={() => setSettings({ ...settings, customer_tax_enabled: !settings.customer_tax_enabled })}
                        className={`px-3 py-1 rounded text-[10px] font-mono font-bold uppercase transition ${
                          settings.customer_tax_enabled
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-slate-900 text-slate-500 border border-slate-800'
                        }`}
                      >
                        {settings.customer_tax_enabled ? 'Active/Enabled' : 'Disabled'}
                      </button>
                    </h4>
                    <p className="text-slate-500 text-xs block mt-1.5">
                      Charge tax/convenience transactions directly to resellers' end customers upon custom checkout. You can enable percentages, flat-fees, or merge both.
                    </p>
                    <div className="mt-3 space-y-3">
                      <div>
                        <label className="text-slate-400 text-xs font-mono block mb-1">Percentage Tax rate (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="20"
                          step="0.01"
                          disabled={!settings.customer_tax_enabled}
                          placeholder="e.g. 1.50"
                          value={settings.customer_tax_percent !== undefined ? settings.customer_tax_percent : 0}
                          onChange={(e) => setSettings({ ...settings, customer_tax_percent: Number(e.target.value) })}
                          className="w-full bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-700 focus:border-amber-500 p-2 text-sm text-slate-200 rounded focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-slate-400 text-xs font-mono block mb-1">Flat Tax Surcharge (GHS)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          disabled={!settings.customer_tax_enabled}
                          placeholder="e.g. 1.00"
                          value={settings.customer_tax_flat_ghs !== undefined ? settings.customer_tax_flat_ghs : 0}
                          onChange={(e) => setSettings({ ...settings, customer_tax_flat_ghs: Number(e.target.value) })}
                          className="w-full bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-700 focus:border-amber-500 p-2 text-sm text-slate-200 rounded focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                  <button 
                    type="submit" 
                    className="w-full py-1.5 bg-amber-500 hover:bg-amber-600 transition text-slate-950 font-bold text-xs rounded uppercase mt-4"
                  >
                    Save Customer Tax
                  </button>
                </form>

                {/* Online Support & Restriction Configuration */}
                <form onSubmit={handleUpdateSupportSettings} className="bg-slate-800/20 p-5 rounded-xl border border-slate-800 space-y-4 flex flex-col justify-between">
                  <div>
                    <h4 className="font-semibold text-slate-100 border-b border-slate-800 pb-2 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <span className="text-amber-500 text-base">💬</span> Customer Support Portal
                      </span>
                      <button
                        type="button"
                        onClick={() => setSettings({ ...settings, online_support_enabled: !settings.online_support_enabled })}
                        className={`px-3 py-1 rounded text-[10px] font-mono font-bold uppercase transition ${
                          settings.online_support_enabled !== false
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-slate-900 text-slate-500 border border-slate-800'
                        }`}
                      >
                        {settings.online_support_enabled !== false ? 'Active/Online' : 'Offline'}
                      </button>
                    </h4>
                    <p className="text-slate-500 text-xs block mt-1.5">
                      Toggle whether the dynamic live-support chat drawer is shown on client-facing and reseller portals. You can append safety filters & restriction prompts below.
                    </p>
                    <div className="mt-3 space-y-3">
                      <div>
                        <label className="text-slate-400 text-xs font-mono block mb-1">Safety Restrictions & Instructions</label>
                        <textarea
                          rows={4}
                          placeholder="e.g. Do not answer questions like how to register to also become a reseller, nor explain how to create a storefront..."
                          value={settings.online_support_restrictions || ''}
                          onChange={(e) => setSettings({ ...settings, online_support_restrictions: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 p-2 text-xs text-slate-200 rounded focus:outline-none placeholder:text-slate-600 font-mono"
                        />
                        <p className="text-slate-500 text-[10px] mt-0.5">Define custom rule strings that will be appended contextually to live chatbot prompt boundaries.</p>
                      </div>
                    </div>
                  </div>
                  <button 
                    type="submit" 
                    className="w-full py-1.5 bg-amber-500 hover:bg-amber-600 transition text-slate-950 font-bold text-xs rounded uppercase mt-4"
                  >
                    Save Support Rules
                  </button>
                </form>

                {/* 5-Star Reviews Popup Configuration */}
                <form onSubmit={handleUpdateReviewsPopup} className="bg-slate-800/20 p-5 rounded-xl border border-slate-800 space-y-4 flex flex-col justify-between">
                  <div>
                    <h4 className="font-semibold text-slate-100 border-b border-slate-800 pb-2 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <span className="text-amber-500 text-base">⭐</span> 5-Star Ratings Popups
                      </span>
                      <button
                        type="button"
                        onClick={() => setSettings({ ...settings, reviews_popup_enabled: settings.reviews_popup_enabled !== false ? false : true })}
                        className={`px-3 py-1 rounded text-[10px] font-mono font-bold uppercase transition ${
                          settings.reviews_popup_enabled !== false
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-slate-900 text-slate-500 border border-slate-800'
                        }`}
                      >
                        {settings.reviews_popup_enabled !== false ? 'Active/Enabled' : 'Disabled'}
                      </button>
                    </h4>
                    <p className="text-slate-500 text-xs block mt-1.5 leading-relaxed">
                      Toggle whether the animated 5-star customer review toast messages popup periodically at the corner of the site for visitors, resellers, and admins.
                    </p>

                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div>
                        <label className="text-slate-400 text-xxs font-mono block mb-1">Pop up Stay Duration (seconds)</label>
                        <input
                          type="number"
                          min="1"
                          max="60"
                          value={settings.reviews_display_duration !== undefined ? settings.reviews_display_duration : 5}
                          onChange={(e) => setSettings({ ...settings, reviews_display_duration: Number(e.target.value) })}
                          className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 p-1.5 text-xs text-slate-200 rounded focus:outline-none"
                          placeholder="5"
                        />
                        <p className="text-[9px] text-slate-500 mt-0.5">How long a review stays visible.</p>
                      </div>

                      <div>
                        <label className="text-slate-400 text-xxs font-mono block mb-1">Interval Cycle (seconds)</label>
                        <input
                          type="number"
                          min="5"
                          max="300"
                          value={settings.reviews_interval !== undefined ? settings.reviews_interval : 20}
                          onChange={(e) => setSettings({ ...settings, reviews_interval: Number(e.target.value) })}
                          className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 p-1.5 text-xs text-slate-200 rounded focus:outline-none"
                          placeholder="20"
                        />
                        <p className="text-[9px] text-slate-500 mt-0.5">How long before it loops back.</p>
                      </div>
                    </div>

                    <div className="mt-4 bg-slate-900/40 p-3 rounded border border-slate-850">
                      <p className="text-xxs text-slate-400 font-mono leading-normal">
                        ⚙️ **Current Display Status:** Rating popups {settings.reviews_popup_enabled !== false ? `pop up every ${settings.reviews_interval ?? 20} seconds and leave after ${settings.reviews_display_duration ?? 5} seconds` : 'are currently fully hidden'}. Displays as "Mac Data Hub" on standard pages, or the customized storefront reseller name on storefronts!
                      </p>
                    </div>
                  </div>
                  <button 
                    type="submit" 
                    className="w-full py-1.5 bg-amber-500 hover:bg-amber-600 transition text-slate-950 font-bold text-xs rounded uppercase mt-4"
                  >
                    Save Popup Settings
                  </button>
                </form>
              </div>

              {/* Payment Gateways Config */}
              <div className="bg-slate-800/20 p-6 rounded-xl border border-slate-800 space-y-4">
                <div>
                  <h4 className="font-semibold text-slate-100">Configure Paystack Payment Gateway & Keys</h4>
                  <p className="text-slate-400 text-xs mt-1">Specify your live or test Paystack API keys to accept customer payments securely. Make sure your webhook URL on Paystack is set to: <code className="text-amber-400 font-mono text-[10px] bg-slate-950 p-1 rounded">https://YOUR_DOMAIN/api/webhook/paystack</code></p>
                </div>

                <form onSubmit={handleUpdateGatewaySettings} className="space-y-4">
                  <div className="bg-slate-900/30 p-5 rounded-lg border border-slate-850 space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                      <span className="font-bold text-slate-200 text-sm">Active Gateway</span>
                      <span className="px-3 py-1 text-xxs font-bold uppercase rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        PAYSTACK ONLY
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-slate-455 text-[10px] block mb-1 font-mono uppercase">Paystack Public Key</label>
                        <input
                          type="text"
                          required
                          value={settings.paystack_public_key || ''}
                          onChange={(e) => setSettings({ ...settings, paystack_public_key: e.target.value })}
                          placeholder="pk_live_..."
                          className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 p-2 text-xs font-mono text-slate-200 rounded focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-slate-455 text-[10px] block mb-1 font-mono uppercase">Paystack Secret Key</label>
                        <input
                          type="password"
                          required
                          value={settings.paystack_secret_key || ''}
                          onChange={(e) => setSettings({ ...settings, paystack_secret_key: e.target.value })}
                          placeholder="sk_live_..."
                          className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 p-2 text-xs font-mono text-slate-200 rounded focus:outline-none"
                        />
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
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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

                    <div className="space-y-1.5">
                      <label className="text-slate-450 text-[10px] block font-mono uppercase">Critical Balance Threshold (₵ GHS)</label>
                      <input
                        type="number"
                        required
                        min="0"
                        step="0.01"
                        value={settings.vtu_balance_threshold !== undefined ? settings.vtu_balance_threshold : 10}
                        onChange={(e) => setSettings({ ...settings, vtu_balance_threshold: Number(e.target.value) })}
                        placeholder="10.00"
                        className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 p-2 text-xs font-mono text-slate-200 rounded focus:outline-none"
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

              {/* Dynamic SubAndGain Base Catalog Rates and Margin Configuration */}
              <div className="bg-slate-800/20 p-6 rounded-xl border border-slate-800 space-y-5">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800 pb-4">
                  <div>
                    <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                      <Database className="w-4 h-4 text-amber-500 animate-pulse" /> SubAndGain Base Price Importer & Profit Customizer
                    </h4>
                    <p className="text-slate-400 text-xs mt-0.5">
                      Fetch original API plans, customize premium margins, and synchronize active data reseller packages.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleLoadSubAndGainPlans}
                    disabled={fetchingSgPlans}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-slate-900 hover:bg-slate-850 text-slate-305 hover:text-amber-400 font-bold font-mono text-[10px] border border-slate-750 hover:border-amber-500/40 rounded transition-all duration-200 uppercase tracking-wider"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${fetchingSgPlans ? 'animate-spin text-amber-500' : ''}`} />
                    {fetchingSgPlans ? 'Polling API...' : '🔌 Fetch & Load Base Prices'}
                  </button>
                </div>

                {user?.email?.toLowerCase() !== 'aaronbinka173@gmail.com' && (
                  <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs p-3.5 rounded-lg leading-relaxed flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-rose-200 block">Access Restricted</span>
                      For security reasons, resetting, synchronizing, or overwriting dataset packages via carrier API integration is restricted exclusively to the primary platform owner (<strong>aaronbinka173@gmail.com</strong>).
                    </div>
                  </div>
                )}

                {subAndGainPlans.length > 0 ? (
                  <div className="space-y-4">
                    {/* Information guidance block */}
                    {settings?.data_api_url?.toLowerCase().includes('gigzhub') && (
                      <div className="bg-emerald-500/10 border border-emerald-600/30 rounded-lg p-3 text-xs text-emerald-250 leading-normal">
                        <strong>🔌 GigzHub Integration Active (Ultra-Discounted Rates!):</strong> We detected <strong>GigzHub</strong> (url contains gigzhub) in your settings! 
                        We have automatically loaded <strong>GigzHub's premium subsidized reseller rates</strong> (e.g., MTN 1GB @ ₵3.85, Telecel 1GB @ ₵3.20, AT 1GB @ ₵3.10) as customizable preset inputs below. Import or overwrite packages with this extremely cheap provider instantly!
                      </div>
                    )}

                    {settings?.data_api_url?.toLowerCase().includes('datahustle') && (
                      <div className="bg-amber-500/10 border border-amber-600/30 rounded-lg p-3 text-xs text-amber-200 leading-normal">
                        <strong>🔌 DataHustle Integration Active:</strong> Custom VTU platforms (including DataHustle) do not export a dynamic plans listing API on <code>data.php</code>. 
                        We have automatically loaded <strong>DataHustle's official wholesale prices</strong> (e.g. MTN 1GB @ ₵4.20, Telecel 5GB @ ₵19.50) as customizable inputs below. You can directly tweak these values and synchronize active products instantly!
                      </div>
                    )}

                    {/* Bulk Margin Controller */}
                    <div className="p-3.5 bg-slate-950/45 rounded-lg border border-slate-850 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div className="space-y-0.5">
                        <span className="text-slate-400 text-xs font-mono uppercase block">⚡ Bulk Admin Profit Customizer</span>
                        <p className="text-slate-500 text-[10px] leading-snug">
                          Apply a uniform markup directly on top of all fetched base prices below with a single action.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <span className="text-slate-400 text-xs font-mono shrink-0">+ ₵ GHS</span>
                        <input
                          type="number"
                          step="0.1"
                          placeholder="2.0"
                          value={globalSgMargin}
                          onChange={(e) => handleApplyGlobalSgMargin(e.target.value)}
                          className="w-20 bg-slate-900 border border-slate-700 text-center font-mono text-xs text-amber-400 p-1.5 rounded focus:outline-none focus:border-amber-500"
                        />
                        <button
                          type="button"
                          onClick={() => handleApplyGlobalSgMargin(globalSgMargin)}
                          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xxs rounded uppercase transition"
                        >
                          Apply to All
                        </button>
                      </div>
                    </div>

                    {/* Plans Grid Table */}
                    <div className="overflow-x-auto border border-slate-800 rounded-lg max-h-96 overflow-y-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-900 border-b border-slate-805 text-slate-400 font-mono text-xxs uppercase tracking-wider sticky top-0 z-10">
                            <th className="p-2.5 text-center w-12">Import</th>
                            <th className="p-2.5">Data Plan Package Name</th>
                            <th className="p-2.5">Plan Code</th>
                            <th className="p-2.5 text-right font-semibold">SubAndGain Price</th>
                            <th className="p-2.5 text-center">My Admin Profit (₵)</th>
                            <th className="p-2.5 text-right text-amber-400">Final Base Price</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 bg-slate-950/20 font-sans">
                          {subAndGainPlans.map((plan, idx) => {
                            const finalPrice = Number(plan.base_price_ghs) + Number(plan.customMargin || 0);
                            return (
                              <tr key={idx} className="hover:bg-slate-800/40 transition">
                                <td className="p-2.5 text-center">
                                  <input
                                    type="checkbox"
                                    checked={plan.isChecked}
                                    onChange={(e) => {
                                      const copy = [...subAndGainPlans];
                                      copy[idx].isChecked = e.target.checked;
                                      setSubAndGainPlans(copy);
                                    }}
                                    className="w-3.5 h-3.5 accent-amber-500 rounded bg-slate-900 border-slate-705"
                                  />
                                </td>
                                <td className="p-2.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold font-mono tracking-tight uppercase ${
                                      plan.network === 'MTN' ? 'bg-amber-500/20 text-amber-300' :
                                      plan.network.includes('Voda') || plan.network.includes('Tele') ? 'bg-red-500/20 text-red-300' :
                                      'bg-sky-500/20 text-sky-300'
                                    }`}>
                                      {plan.network}
                                    </span>
                                    <span className="font-semibold text-slate-200">{plan.name}</span>
                                    <span className="text-slate-500 font-mono text-[10px]">({plan.validity_days || 30} Days)</span>
                                  </div>
                                </td>
                                <td className="p-2.5 font-mono text-xxs text-slate-400 font-medium">{plan.provider_plan_code}</td>
                                <td className="p-2.5 text-center">
                                  <div className="inline-flex items-center justify-center gap-0.5 bg-slate-900 border border-slate-755 px-1 py-0.5 rounded focus-within:border-amber-500/80 transition-all">
                                    <span className="text-slate-500 text-[10px] font-bold">₵</span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      className="w-14 bg-transparent border-0 text-center font-mono text-xxs text-slate-100 font-bold focus:outline-none p-0.5"
                                      value={plan.base_price_ghs}
                                      onChange={(e) => {
                                        const copy = [...subAndGainPlans];
                                        copy[idx].base_price_ghs = Number(e.target.value) || 0;
                                        setSubAndGainPlans(copy);
                                      }}
                                    />
                                  </div>
                                </td>
                                <td className="p-2.5 text-center">
                                  <input
                                    type="number"
                                    step="0.05"
                                    className="w-16 bg-slate-900 border border-slate-700 text-center font-mono text-xxs text-slate-105 p-1 rounded focus:outline-none focus:border-amber-500"
                                    value={plan.customMargin}
                                    onChange={(e) => {
                                      const copy = [...subAndGainPlans];
                                      copy[idx].customMargin = Number(e.target.value) || 0;
                                      setSubAndGainPlans(copy);
                                    }}
                                  />
                                </td>
                                <td className="p-2.5 text-right font-mono font-bold text-amber-400">₵{finalPrice.toFixed(2)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex items-center justify-between pt-1 font-mono text-[10px] text-slate-400">
                      <span>{subAndGainPlans.filter(p => p.isChecked).length} plans check-marked for synchronization</span>
                      <button
                        type="button"
                        onClick={handleImportSelectedSgPlans}
                        disabled={sgImporting}
                        className="px-5 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-700 text-slate-950 font-black text-xs rounded transition-all duration-200 shadow shadow-amber-500/10 flex items-center gap-1.5 uppercase tracking-wider"
                      >
                        {sgImporting ? 'Synchronizing Base...' : '🚀 Deployed to Active Site Bundles'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-lg flex flex-col items-center justify-center gap-2">
                    <Database className="w-8 h-8 text-slate-600" />
                    <p className="text-xs font-mono">No API price list loaded yet.</p>
                    <p className="text-[10px] text-slate-500 max-w-sm">
                      Select your credentials above and click &ldquo;Fetch & Load Base Prices&rdquo; to query active plan prices and introduce custom profit margins.
                    </p>
                  </div>
                )}
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

      {/* MODAL: COMPOSER FOR RESELLER OUTBOUND EMAIL NOTICES */}
      {emailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-amber-500 animate-pulse" />
                <div>
                  <h3 className="text-lg font-bold text-slate-100 leading-none">SMTP Agent Outbound Mailer</h3>
                  <p className="text-xs text-slate-400 mt-1">Send professional email notices directly to active reseller partner mailboxes.</p>
                </div>
              </div>
              <button 
                onClick={() => setEmailModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs px-2.5 py-1.5 bg-slate-800 rounded-lg hover:bg-slate-755 transition border border-slate-700/60"
              >
                Close Panel
              </button>
            </div>

            {/* Modal Body Container */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <form onSubmit={handleSendEmailSubmit} className="space-y-4">
                
                {/* Email Recipient Target Select */}
                <div>
                  <label className="block mb-1 text-slate-400 font-mono text-xs">Recipient Reseller Target</label>
                  <select
                    value={emailTarget}
                    onChange={(e) => setEmailTarget(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:border-amber-500 text-slate-200 text-sm"
                  >
                    <option value="all">📢 All Active Store Creators (Broadcast to Everyone)</option>
                    {resellers.map(r => (
                      <option key={r.user_id} value={r.user_id}>
                        👤 {r.store_name || r.email.split('@')[0]} ({r.email})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Email Subject Option */}
                <div>
                  <label className="block mb-1 text-slate-400 font-mono text-xs">Email Subject Line</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter email subject line..."
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:border-amber-500 text-slate-100 text-sm"
                  />
                </div>

                {/* Email Text Area content block */}
                <div>
                  <label className="block mb-1 text-slate-400 font-mono text-xs flex justify-between">
                    <span>Email HTML/Text Body Payload</span>
                    <span className="text-slate-500 text-xxs font-mono">{emailMessage.length} characters</span>
                  </label>
                  <textarea
                    required
                    rows={8}
                    placeholder="Compose message here..."
                    value={emailMessage}
                    onChange={(e) => setEmailMessage(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm text-slate-100 focus:outline-none focus:border-amber-500 font-mono leading-relaxed"
                  />
                  <div className="p-3 bg-slate-950/60 rounded-lg text-xxs text-slate-400 border border-slate-800/40 flex items-start gap-2 mt-2 leading-normal">
                    <span className="text-emerald-400 font-bold">💡 Outbound SMTP Pipeline:</span>
                    <span>Emails sent through this portal are dispatched securely via our administrative mail handler with a verified SPF/DKIM signature. They support text formatting and land instantly in corresponding reseller inbox folders. Perfect for status syncs, margin caps, and direct notifications!</span>
                  </div>
                </div>

                {/* submit */}
                <div className="flex justify-end pt-2 border-t border-slate-800">
                  <button
                    type="submit"
                    disabled={emailDispatchLoading}
                    className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 disabled:opacity-55 text-slate-950 font-bold rounded-lg text-xs tracking-wider uppercase flex items-center gap-1.5 transition-colors shadow-lg"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {emailDispatchLoading ? 'Syncing Server SMTP Tunnel...' : 'Dispatch Email Message'}
                  </button>
                </div>

              </form>

              {/* Historical Email Broadcast Logs */}
              <div className="border-t border-slate-800 pt-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-slate-200 uppercase font-mono tracking-wider">Historical Email Broadcast Receipts</h4>
                  <button
                    onClick={fetchEmailLogs}
                    className="text-xxs text-amber-500 hover:text-amber-400 transition flex items-center gap-1 font-mono font-bold animate-pulse"
                  >
                    <RefreshCw className={`w-3 h-3 ${emailLogsLoading ? 'animate-spin' : ''}`} />
                    Refresh Logs
                  </button>
                </div>

                {emailLogsLoading && emailLogs.length === 0 ? (
                  <div className="py-6 text-center text-slate-500 text-xs font-sans">Loading outbound email records...</div>
                ) : emailLogs.length === 0 ? (
                  <div className="p-8 text-center bg-slate-950/30 border border-slate-800/50 rounded-lg text-slate-500 text-xs font-sans">
                    No outbound Email logs recorded yet. Composing and dispatching a message above will populate the routing queue.
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-56 border border-slate-850 rounded-lg">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-950/70 border-b border-slate-850 text-slate-400 uppercase font-mono text-[10px]">
                          <th className="py-2.5 px-3">Date / Stamp</th>
                          <th className="py-2.5 px-3">Recipient Store</th>
                          <th className="py-2.5 px-3">Subject Line</th>
                          <th className="py-2.5 px-3 text-right">Delivery Route</th>
                        </tr>
                      </thead>
                      <tbody>
                        {emailLogs.map((log: any) => (
                          <tr key={log.id} className="border-b border-slate-850 bg-slate-900 hover:bg-slate-850/30 text-slate-300">
                            <td className="py-2 px-3 font-mono text-[10px] text-slate-500">{new Date(log.created_at).toLocaleString()}</td>
                            <td className="py-2 px-3">
                              <span className="font-semibold text-slate-250 block max-w-[12rem] truncate">{log.store_name || 'N/A'}</span>
                              <span className="text-[10px] font-mono text-slate-500 block max-w-[12rem] truncate">{log.recipientEmail || log.email || 'N/A'}</span>
                            </td>
                            <td className="py-2 px-3">
                              <span className="font-semibold block text-slate-200 max-w-[15rem] truncate" title={log.subject}>{log.subject}</span>
                            </td>
                            <td className="py-2 px-3 text-right">
                              {log.status === 'Delivered' ? (
                                <span className="px-1.5 py-0.5 bg-emerald-950/50 text-emerald-400 border border-emerald-900/30 rounded text-[9px] uppercase font-bold">
                                  ✓ SENT SMTP
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 bg-slate-800 text-amber-500 border border-amber-900/30 rounded text-[9px] uppercase font-bold" title="No custom SMTP credentials stored in settings. Safe Sandbox level dispatch simulated.">
                                  ⚡ SIMULATED (SANDBOX)
                                </span>
                              )}
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

      {/* OVERLAY MODAL: ADMIN DIRECT REVENUE WITHDRAWAL CLAIMFORM */}
      {adminWithdrawModalOpen && stats && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
            <button 
              onClick={() => setAdminWithdrawModalOpen(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 text-lg focus:outline-none"
            >
              ✕
            </button>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded text-sm">👑</span> Withdraw Admin Profit
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">Enter details to record a manual payment of accumulated administrative royalty sales cuts and portal subscription fees.</p>
            </div>

            <form onSubmit={handleAdminWithdrawSubmit} className="space-y-4 pt-1">
              {/* CURRENT BALANCE GLANCE */}
              {(() => {
                const grossAdminProfit = Number(stats.total_admin_fees_earned_ghs || 0) + Number(stats.total_registrations_earned_ghs || 0);
                const adminWithdrawnAmount = Number(settings?.admin_total_withdrawn_ghs || 0);
                const availableAdminBalance = Number((grossAdminProfit - adminWithdrawnAmount).toFixed(2));
                
                return (
                  <div className="bg-slate-950/40 border border-slate-850 p-3.5 rounded-lg flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-sans">Available Claims Balance:</span>
                    <span className="font-mono font-bold text-emerald-400 text-sm">₵{availableAdminBalance.toFixed(2)}</span>
                  </div>
                );
              })()}

              <div className="space-y-1">
                <label className="block text-xs font-mono text-slate-400 uppercase tracking-wide">Withdrawal Amount (₵ GHS)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 50.00"
                  max={Number((Number(stats.total_admin_fees_earned_ghs || 0) + Number(stats.total_registrations_earned_ghs || 0) - Number(settings?.admin_total_withdrawn_ghs || 0)).toFixed(2))}
                  value={adminWithdrawAmount}
                  onChange={(e) => setAdminWithdrawAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-sm text-slate-100 p-2.5 rounded focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-mono text-slate-400 uppercase tracking-wide">Receiving Destination & Verification Details</label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. MTN Mobile Money Number 0244111222 (Name: Aaron Binka) or Bank Transfer details..."
                  value={adminWithdrawDetails}
                  onChange={(e) => setAdminWithdrawDetails(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 p-2.5 rounded focus:outline-none focus:border-emerald-500 leading-relaxed"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setAdminWithdrawModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs rounded transition-colors border border-slate-700 font-sans"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adminWithdrawSubmitting || !adminWithdrawAmount || Number(adminWithdrawAmount) <= 0 || Number(adminWithdrawAmount) > ((Number(stats.total_admin_fees_earned_ghs || 0) + Number(stats.total_registrations_earned_ghs || 0)) - Number(settings?.admin_total_withdrawn_ghs || 0))}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-extrabold text-xs rounded transition-all shadow-md font-sans"
                >
                  {adminWithdrawSubmitting ? 'Recording payout...' : 'Confirm Disburse Payout'}
                </button>
              </div>
            </form>
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
