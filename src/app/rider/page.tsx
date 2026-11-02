'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Bike,
  Package,
  Phone,
  MessageCircle,
  CheckCircle2,
  Clock,
  MapPin,
  RefreshCw,
  LogOut,
  Search,
  AlertCircle,
  DollarSign,
  Compass,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Calendar,
  Lock,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { playOrderAlertChime, isAudioMuted, toggleAudioMuted } from '@/lib/audio-chime';
import { Order, OrderStatus } from '@/types/store';
import { formatWhatsAppPhone } from '@/lib/validation';

export default function DeliveryRiderPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [riderInfo, setRiderInfo] = useState<{
    staffId?: string;
    username?: string;
    displayName?: string;
  } | null>(null);

  // Login form state (Strict AGENTS.md: Username & Password ONLY)
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Rider Dashboard state
  const [orders, setOrders] = useState<Order[]>([]);
  const [isAudioMutedState, setIsAudioMutedState] = useState(false);
  const prevOrderIdsRef = useRef<Set<string>>(new Set());
  const isInitialFetchRef = useRef<boolean>(true);

  useEffect(() => {
    setIsAudioMutedState(isAudioMuted());
  }, []);

  const [stats, setStats] = useState({
    totalAssigned: 0,
    pendingDelivery: 0,
    deliveredToday: 0,
    totalCodToCollect: 0,
    unsettledCodBalance: 0,
    settledCodTotal: 0,
    unsettledOrdersCount: 0,
  });
  const [activeTab, setActiveTab] = useState<
    'all' | 'bandar_fast' | 'villages_scheduled' | 'delivered'
  >('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // Fetch orders from dedicated rider endpoint
  const fetchRiderOrders = useCallback(async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/rider/orders?type=${activeTab}&q=${encodeURIComponent(searchQuery)}`, {
        cache: 'no-store',
      });
      if (res.status === 401) {
        setIsAuthenticated(false);
        return;
      }
      if (res.status === 403) {
        // Automatic redirection if another staff role is logged in
        try {
          const sessionRes = await fetch('/api/admin/login', { cache: 'no-store' });
          if (sessionRes.ok) {
            const sessionData = await sessionRes.json();
            if (sessionData.role === 'cashier') {
              window.location.replace('/pos');
              return;
            }
            if (sessionData.role === 'supplier') {
              window.location.replace('/supplier');
              return;
            }
            if (sessionData.role === 'accountant') {
              window.location.replace('/admin');
              return;
            }
          }
        } catch {}
        const data = await res.json().catch(() => ({}));
        setLoginError(data.error || 'عزل الأدوار: بوابة المندوب مخصصة لمناديب التوصيل فقط');
        setIsAuthenticated(false);
        return;
      }
      const data = await res.json();
      if (data.success) {
        setIsAuthenticated(true);
        const incoming: Order[] = data.orders || [];
        if (!isInitialFetchRef.current) {
          const newlyAssigned = incoming.filter(
            (o: Order) =>
              !prevOrderIdsRef.current.has(o.id) &&
              (o.status === 'pending' || o.status === 'confirmed' || o.status === 'roasting_packing' || o.status === 'shipped')
          );
          if (newlyAssigned.length > 0) {
            playOrderAlertChime();
            setFeedback({
              type: 'success',
              text: `تم إسناد طلب جديد لك: ${newlyAssigned[0].orderNumber} (العميل: ${newlyAssigned[0].customerName})`,
            });
          }
        }
        isInitialFetchRef.current = false;
        prevOrderIdsRef.current = new Set(incoming.map((o: Order) => o.id));
        setOrders(incoming);
        if (data.stats) setStats(data.stats);
        if (data.rider) setRiderInfo(data.rider);
      }
    } catch {
      setFeedback({ type: 'error', text: 'فشل الاتصال بالخادم — يرجى التحقق من الشبكة' });
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchQuery]);

  useEffect(() => {
    fetchRiderOrders();
    const interval = setInterval(() => {
      fetchRiderOrders();
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchRiderOrders]);

  // Handle staff login adhering strictly to AGENTS.md
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameInput.trim() || !passwordInput.trim()) {
      setLoginError('يرجى إدخال اسم المستخدم وكلمة المرور');
      return;
    }
    setLoginLoading(true);
    setLoginError('');

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: usernameInput.trim(),
          password: passwordInput.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || 'اسم المستخدم أو كلمة المرور غير صحيحة');
      } else {
        // Credential-driven automatic routing
        if (data.role === 'delivery_rider' || data.role === 'super_admin' || data.role === 'admin') {
          setIsAuthenticated(true);
          setRiderInfo({
            staffId: data.staffId,
            username: data.username,
            displayName: data.displayName,
          });
          await fetchRiderOrders();
        } else if (data.redirectTo) {
          window.location.replace(data.redirectTo);
        } else if (data.role === 'cashier') {
          window.location.replace('/pos');
        } else if (data.role === 'supplier') {
          window.location.replace('/supplier');
        } else if (data.role === 'accountant') {
          window.location.replace('/admin');
        } else {
          setLoginError('عزل الأدوار: هذا الحساب غير مصرح له بالدخول كبوابة مندوب توصيل');
        }
      }
    } catch {
      setLoginError('حدث خطأ أثناء تسجيل الدخول');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
    } catch {
      // Ignore
    }
    setIsAuthenticated(false);
    setOrders([]);
    setRiderInfo(null);
  };

  // Update order status (Take out or Deliver)
  const handleUpdateStatus = async (order: Order, newStatus: OrderStatus) => {
    setActionLoadingId(order.id);
    setFeedback(null);
    try {
      const res = await fetch('/api/rider/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          status: newStatus,
          cashCollected: newStatus === 'delivered' && order.paymentMethod === 'cod' ? order.total : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'error', text: data.error || 'فشل تحديث حالة الطلب' });
      } else {
        setFeedback({
          type: 'success',
          text:
            newStatus === 'delivered'
              ? `تم تأكيد تسليم الطلب #${order.orderNumber} وتحصيل المبلغ بنجاح`
              : `تم استلام الطلب #${order.orderNumber} وجاري التوصيل للعميل`,
        });
        await fetchRiderOrders();
      }
    } catch {
      setFeedback({ type: 'error', text: 'حدث خطأ أثناء تحديث حالة الطلب' });
    } finally {
      setActionLoadingId(null);
    }
  };

  // 1. Loading State
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-[#FAF6F0] flex items-center justify-center p-4" dir="rtl">
        <div className="text-center space-y-3">
          <RefreshCw className="w-7 h-7 text-[#9A6836] animate-spin mx-auto" />
          <p className="font-bold text-sm text-[#231710]">
            جاري تهيئة بوابة مندوب التوصيل — فرع بني مزار...
          </p>
        </div>
      </div>
    );
  }

  // 2. Login Screen (Strictly AGENTS.md: Username & Password only)
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#FAF6F0] flex flex-col justify-center items-center p-4" dir="rtl">
        <div className="w-full max-w-md bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-[#E8E0D5] space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#FAF6F0] text-[#231710] border border-[#E8E0D5] mb-1">
              <Bike className="w-6 h-6" />
            </div>
            <h1 className="font-bold text-xl text-[#231710]">
              محمصة حفصة للبن والمكسرات
            </h1>
            <p className="text-xs text-[#6E5D4F] font-medium">
              بوابة مندوب التوصيل — فرع بني مزار (البندر ودورات القرى)
            </p>
          </div>

          {loginError && (
            <div className="bg-red-50 border border-red-200 text-[#B83B2B] p-3 rounded-xl text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#231710] mb-1.5">
                اسم المستخدم
              </label>
              <input
                type="text"
                autoComplete="username"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="أدخل اسم المستخدم"
                className="w-full bg-[#FAF6F0] border border-[#E8E0D5] focus:border-[#231710] rounded-xl px-3.5 py-2.5 text-sm text-[#231710] focus:outline-none transition"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#231710] mb-1.5">
                كلمة المرور
              </label>
              <input
                type="password"
                autoComplete="current-password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="أدخل كلمة المرور"
                className="w-full bg-[#FAF6F0] border border-[#E8E0D5] focus:border-[#231710] rounded-xl px-3.5 py-2.5 text-sm text-[#231710] focus:outline-none transition"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full bg-[#231710] hover:bg-[#3A271C] text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer text-sm disabled:opacity-50"
            >
              {loginLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>جاري تسجيل الدخول...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>دخول بوابة المندوب</span>
                </>
              )}
            </button>
          </form>

          <div className="pt-3 border-t border-[#E8E0D5] text-center">
            <Link
              href="/"
              className="text-xs text-[#6E5D4F] hover:text-[#231710] font-medium transition"
            >
              العودة للمتجر الرئيسي
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 3. Authenticated Rider Portal
  return (
    <div className="min-h-screen bg-[#FAF6F0] text-[#231710] pb-20" dir="rtl">
      {/* Top Sticky Header */}
      <header className="sticky top-0 z-30 bg-white text-[#231710] border-b border-[#E8E0D5] px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#FAF6F0] text-[#231710] border border-[#E8E0D5] flex items-center justify-center">
              <Bike className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm text-[#231710]">
                  محمصة حفصة — بوابة مندوب التوصيل
                </span>
                <span className="text-[10px] bg-[#FAF6F0] text-[#6E5D4F] border border-[#E8E0D5] px-2 py-0.5 rounded-lg font-medium">
                  بني مزار
                </span>
              </div>
              <p className="text-xs text-[#6E5D4F] truncate max-w-[180px] sm:max-w-none">
                المندوب: {riderInfo?.displayName || riderInfo?.username || 'المندوب'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const next = toggleAudioMuted();
                setIsAudioMutedState(next);
              }}
              title={isAudioMutedState ? 'تفعيل جرس التنبيهات الصوتية' : 'كتم جرس التنبيهات الصوتية'}
              className={`p-2 rounded-xl border transition cursor-pointer flex items-center gap-1 ${
                isAudioMutedState
                  ? 'bg-red-50 text-[#B83B2B] border-red-200'
                  : 'bg-[#FAF6F0] text-[#231710] border-[#E8E0D5] hover:bg-[#EFE8DF]'
              }`}
            >
              {isAudioMutedState ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => fetchRiderOrders()}
              disabled={loading}
              title="تحديث لحظي"
              className="p-2 bg-[#FAF6F0] hover:bg-[#EFE8DF] text-[#231710] border border-[#E8E0D5] rounded-xl transition cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={handleLogout}
              title="تسجيل الخروج"
              className="p-2 bg-[#FAF6F0] hover:bg-red-50 text-[#B83B2B] border border-[#E8E0D5] rounded-xl transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto p-3 sm:p-4 space-y-4">
        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`p-3 rounded-xl text-xs font-bold border flex items-center gap-2 ${
              feedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-[#3B6E4C]'
                : 'bg-red-50 border-red-200 text-[#B83B2B]'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}

        {/* Live KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="bg-white p-3.5 rounded-2xl border border-[#E8E0D5] space-y-1">
            <span className="text-xs font-medium text-[#6E5D4F] flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-[#9A6836]" />
              <span>إجمالي الطلبات</span>
            </span>
            <div className="text-xl font-bold text-[#231710] tabular-nums">
              {stats.totalAssigned}
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-[#E8E0D5] space-y-1">
            <span className="text-xs font-medium text-[#6E5D4F] flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>بانتظار التوصيل</span>
            </span>
            <div className="text-xl font-bold text-amber-700 tabular-nums">
              {stats.pendingDelivery}
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-[#E8E0D5] space-y-1">
            <span className="text-xs font-medium text-[#6E5D4F] flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#3B6E4C]" />
              <span>تم التسليم اليوم</span>
            </span>
            <div className="text-xl font-bold text-[#3B6E4C] tabular-nums">
              {stats.deliveredToday}
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-[#E8E0D5] space-y-1">
            <span className="text-xs font-medium text-[#6E5D4F] flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-[#9A6836]" />
              <span>مطلوب تحصيله بالطريق</span>
            </span>
            <div className="text-xl font-bold text-[#231710] tabular-nums">
              {stats.totalCodToCollect} <span className="text-xs font-medium">ج.م</span>
            </div>
          </div>
        </div>

        {/* Rider Cash Custody & Branch Handover Strip */}
        <div className="bg-white p-3.5 rounded-2xl border border-[#E8E0D5] flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="text-xs font-bold text-[#231710] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#9A6836]" />
              <span>ذمة عهدة التحصيل النقدي (COD Custody)</span>
            </div>
            <p className="text-xs text-[#6E5D4F]">
              {(stats.unsettledCodBalance || 0) > 0
                ? `لديك عهدة نقدية محصلة من ${stats.unsettledOrdersCount || 0} طلب بانتظار تسليمها لكاشير فرع بني مزار`
                : 'ذمتك النقدية خالية ومسوّاة بالكامل مع درج كاشير الفرع'}
            </p>
          </div>
          <div className="flex items-center gap-2.5 tabular-nums">
            <div className="bg-[#FAF6F0] px-3 py-1.5 rounded-xl border border-[#E8E0D5] text-right">
              <span className="block text-[10px] text-[#6E5D4F]">عهدة مطلوبة للفرع</span>
              <span className="font-bold text-sm text-[#B83B2B]">
                {stats.unsettledCodBalance || 0} ج.م
              </span>
            </div>
            <div className="bg-[#FAF6F0] px-3 py-1.5 rounded-xl border border-[#E8E0D5] text-right">
              <span className="block text-[10px] text-[#6E5D4F]">تم توريده للكاشير</span>
              <span className="font-bold text-sm text-[#3B6E4C]">
                {stats.settledCodTotal || 0} ج.م
              </span>
            </div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-white p-3.5 rounded-2xl border border-[#E8E0D5] space-y-3">
          {/* Quick Search */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث برقم الهاتف، اسم العميل، القرية، أو رقم الطلب..."
              className="w-full bg-[#FAF6F0] border border-[#E8E0D5] focus:border-[#231710] rounded-xl py-2 pr-9 pl-3 text-xs text-[#231710] placeholder-[#6E5D4F]/70 focus:outline-none"
            />
            <Search className="w-4 h-4 text-[#6E5D4F] absolute right-3 top-2.5" />
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-[#231710] text-white'
                  : 'bg-[#FAF6F0] text-[#6E5D4F] border border-[#E8E0D5] hover:text-[#231710]'
              }`}
            >
              الكل ({stats.totalAssigned})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('bandar_fast')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
                activeTab === 'bandar_fast'
                  ? 'bg-[#231710] text-white'
                  : 'bg-[#FAF6F0] text-[#6E5D4F] border border-[#E8E0D5] hover:text-[#231710]'
              }`}
            >
              بندر بني مزار (فوري)
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('villages_scheduled')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
                activeTab === 'villages_scheduled'
                  ? 'bg-[#231710] text-white'
                  : 'bg-[#FAF6F0] text-[#6E5D4F] border border-[#E8E0D5] hover:text-[#231710]'
              }`}
            >
              دورات قرى المركز
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('delivered')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
                activeTab === 'delivered'
                  ? 'bg-[#231710] text-white'
                  : 'bg-[#FAF6F0] text-[#6E5D4F] border border-[#E8E0D5] hover:text-[#231710]'
              }`}
            >
              المسلمة ({stats.deliveredToday})
            </button>
          </div>
        </div>

        {/* Orders List */}
        {orders.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 border border-[#E8E0D5] text-center space-y-2.5">
            <div className="w-11 h-11 rounded-xl bg-[#FAF6F0] text-[#9A6836] border border-[#E8E0D5] flex items-center justify-center mx-auto">
              <Package className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-[#231710]">
              لا توجد طلبات توصيل في هذا التبويب حالياً
            </h3>
            <p className="text-xs text-[#6E5D4F]">
              سيتم إظهار طلبات البندر الفورية ودورات القرى فور إسنادها أو وصولها من الكاشير والإدارة.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => {
              const isDelivered = order.status === 'delivered';
              const isShipped = order.status === 'shipped';
              const isCod = order.paymentMethod === 'cod';
              const isExpanded = expandedOrderId === order.id;

              const isVillage =
                order.deliveryMethod === 'villages_scheduled' ||
                Boolean(order.villageName) ||
                Boolean(order.deliverySlot);

              return (
                <div
                  key={order.id}
                  className={`bg-white rounded-2xl border overflow-hidden transition ${
                    isDelivered
                      ? 'border-emerald-200'
                      : 'border-[#E8E0D5] hover:border-[#C5B8A8]'
                  }`}
                >
                  {/* Card Top: Order Number, Badge & Time */}
                  <div className="p-3.5 sm:p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base text-[#231710] tabular-nums">
                          #{order.orderNumber}
                        </span>
                        {isVillage ? (
                          <span className="bg-[#FAF6F0] text-[#231710] border border-[#E8E0D5] px-2.5 py-0.5 rounded-lg text-[11px] font-medium flex items-center gap-1">
                            <Compass className="w-3 h-3 text-[#3B6E4C]" />
                            <span>
                              {order.villageName
                                ? order.villageName.startsWith('قرية')
                                  ? order.villageName
                                  : `قرية ${order.villageName}`
                                : 'دورة قرى بني مزار'}
                            </span>
                          </span>
                        ) : (
                          <span className="bg-[#FAF6F0] text-[#231710] border border-[#E8E0D5] px-2.5 py-0.5 rounded-lg text-[11px] font-medium flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-[#9A6836]" />
                            <span>بندر بني مزار (فوري)</span>
                          </span>
                        )}
                      </div>

                      {/* Status Tag */}
                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                          isDelivered
                            ? 'bg-emerald-50 text-[#3B6E4C] border-emerald-200'
                            : isShipped
                              ? 'bg-blue-50 text-blue-800 border-blue-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}
                      >
                        {isDelivered
                          ? 'تم التسليم'
                          : isShipped
                            ? 'جاري التوصيل'
                            : 'جاهز للتحرك'}
                      </span>
                    </div>

                    {/* Scheduled Slot if village */}
                    {order.deliverySlot && (
                      <div className="bg-[#FAF6F0] rounded-xl px-3 py-1.5 border border-[#E8E0D5] text-xs text-[#6E5D4F] flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-[#9A6836]" />
                        <span>موعد الدورة: <strong className="text-[#231710]">{order.deliverySlot}</strong></span>
                      </div>
                    )}

                    {/* Customer Info & Direct Contacts */}
                    <div className="bg-[#FAF6F0] rounded-xl p-3 border border-[#E8E0D5] space-y-2.5">
                      <div>
                        <h4 className="font-bold text-sm text-[#231710]">
                          {order.customerName}
                        </h4>
                        <p className="text-xs text-[#6E5D4F] flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-[#9A6836] shrink-0" />
                          <span>{order.address}</span>
                        </p>
                      </div>

                      {/* Mobile Fast Action Buttons (Call + WhatsApp) */}
                      <div className="flex items-center gap-2 pt-2 border-t border-[#E8E0D5]">
                        <a
                          href={`tel:${order.customerPhone}`}
                          className="flex-1 bg-[#231710] hover:bg-[#3A271C] text-white py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>اتصال بالعميل</span>
                        </a>

                        <a
                          href={`https://wa.me/${formatWhatsAppPhone(
                            order.customerPhone
                          )}?text=${encodeURIComponent(
                            `السلام عليكم ورحمة الله يا ${order.customerName}\nمع حضرتك مندوب محمصة حفصة للبن والمكسرات بخصوص طلبك رقم #${order.orderNumber}.\nأنا في طريقي لحضرتك الآن إلى العنوان: ${order.address}.\nالمبلغ المطلوب: ${
                              isCod ? `${order.total} ج.م نقداً` : 'تم الدفع مسبقاً'
                            }`
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 bg-white hover:bg-[#EFE8DF] text-[#231710] border border-[#E8E0D5] py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition"
                        >
                          <MessageCircle className="w-3.5 h-3.5 text-[#3B6E4C]" />
                          <span>مراسلة واتساب</span>
                        </a>
                      </div>
                    </div>

                    {/* Order Items Collapsible */}
                    <div>
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedOrderId(isExpanded ? null : order.id)
                        }
                        className="w-full flex items-center justify-between text-xs font-medium text-[#6E5D4F] hover:text-[#231710] py-1 cursor-pointer"
                      >
                        <span>
                          أصناف الطلب ({order.items?.length || 0} صنف)
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>

                      {isExpanded && (
                        <div className="mt-2 bg-[#FAF6F0] rounded-xl p-2.5 text-xs space-y-1.5 border border-[#E8E0D5]">
                          {order.items?.map((item, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between text-xs"
                            >
                              <span className="text-[#231710] font-medium">
                                {item.quantity}× {item.productName} ({item.weightLabel || `${item.unitPrice} ج.م`})
                              </span>
                              <span className="text-[#231710] font-bold tabular-nums">
                                {item.unitPrice * item.quantity} ج.م
                              </span>
                            </div>
                          ))}
                          {order.notes && (
                            <div className="pt-1.5 border-t border-[#E8E0D5] text-[11px] text-[#B83B2B] font-medium">
                              ملاحظات العميل: {order.notes}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Payment Status & COD Amount */}
                    <div
                      className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                        isCod
                          ? 'bg-amber-50/70 border-amber-200 text-[#231710]'
                          : 'bg-emerald-50/70 border-emerald-200 text-[#231710]'
                      }`}
                    >
                      <div>
                        <span className="font-bold">{isCod ? 'الدفع عند الاستلام (COD)' : 'طريقة الدفع'}</span>
                        <span className="block text-[11px] text-[#6E5D4F] mt-0.5">
                          {isCod ? 'يجب تحصيل المبلغ نقداً بالكامل' : 'مدفوع إلكترونياً — لا تُحصّل أي مبالغ'}
                        </span>
                      </div>
                      <div className="text-base font-bold tabular-nums">
                        {order.total} ج.م
                      </div>
                    </div>

                    {/* Action Execution Button */}
                    {!isDelivered ? (
                      <div className="flex gap-2">
                        {!isShipped && (
                          <button
                            type="button"
                            disabled={actionLoadingId === order.id}
                            onClick={() => handleUpdateStatus(order, 'shipped')}
                            className="flex-1 bg-[#231710] hover:bg-[#3A271C] text-white py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <Bike className="w-4 h-4" />
                            <span>استلام وبدء التحرك</span>
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={actionLoadingId === order.id}
                          onClick={() => handleUpdateStatus(order, 'delivered')}
                          className="flex-1 bg-[#3B6E4C] hover:bg-[#2F5A3D] text-white py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>
                            {isCod
                              ? `تأكيد التسليم وتحصيل (${order.total} ج.م)`
                              : 'تأكيد التسليم للعميل'}
                          </span>
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="bg-emerald-50 border border-emerald-200 text-[#3B6E4C] py-2.5 px-3.5 rounded-xl text-xs font-bold flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-[#3B6E4C]" />
                            <span>تم تسليم هذا الطلب بنجاح</span>
                          </div>
                          {order.deliveredAt && (
                            <span className="text-[11px] font-medium tabular-nums">
                              {new Date(order.deliveredAt).toLocaleTimeString('ar-EG', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          )}
                        </div>
                        {isCod && (
                          <div
                            className={`py-2 px-3 rounded-xl text-[11px] font-bold flex items-center justify-between border ${
                              order.riderCodSettled
                                ? 'bg-emerald-50/60 border-emerald-200 text-[#3B6E4C]'
                                : 'bg-amber-50/70 border-amber-200 text-amber-900'
                            }`}
                          >
                            <span>
                              {order.riderCodSettled
                                ? `تم توريد العهدة لدرج الفرع (${order.riderCodSettledBy || 'الكاشير'})`
                                : 'عهدة محصلة بطرفك — سلمها لكاشير الفرع'}
                            </span>
                            <span className="tabular-nums">
                              {order.cashCollected ?? order.total} ج.م
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
