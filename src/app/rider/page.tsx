'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
        // Redirection if another staff logged in
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
              text: `🔔 تم إسناد طلب جديد لك: ${newlyAssigned[0].orderNumber} (العميل: ${newlyAssigned[0].customerName})`,
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
          window.location.href = data.redirectTo;
        } else {
          setLoginError('عزل الأدوار: هذا الحساب غير مصرح له بالدخول كـ مندوب توصيل');
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
              ? `✅ تم تأكيد تسليم الطلب #${order.orderNumber} وتحصيل المبلغ بنجاح!`
              : `🛵 تم استلام الطلب #${order.orderNumber} وجاري التوصيل للعميل.`,
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
      <div className="min-h-screen bg-[#FAF6F0] flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-[#C88A4B] animate-spin mx-auto" />
          <p className="font-cairo font-bold text-sm text-[#231710]">
            جاري تهيئة بوابة مندوب التوصيل — فرع بني مزار...
          </p>
        </div>
      </div>
    );
  }

  // 2. Login Screen (Strictly AGENTS.md: Username & Password only)
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#FAF6F0] flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-[#D4AF37]/30 space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#231710] text-[#D4AF37] shadow-md mb-2">
              <Bike className="w-7 h-7" />
            </div>
            <h1 className="font-cairo font-black text-xl sm:text-2xl text-[#231710]">
              محمصة حفصة للبن والمكسرات
            </h1>
            <p className="font-cairo text-xs text-[#6E5D4F] font-bold">
              بوابة مندوب التوصيل — فرع بني مزار (البندر ودورات القرى)
            </p>
          </div>

          {loginError && (
            <div className="bg-[#B83B2B]/10 border border-[#B83B2B] text-[#B83B2B] p-3 rounded-2xl text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-black text-[#231710] mb-1.5">
                اسم المستخدم
              </label>
              <input
                type="text"
                autoComplete="username"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="أدخل اسم المستخدم"
                className="w-full bg-[#FAF6F0] border border-[#E6DFD3] focus:border-[#C88A4B] rounded-2xl px-4 py-3 text-sm text-[#231710] focus:outline-none transition font-bold"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-black text-[#231710] mb-1.5">
                كلمة المرور
              </label>
              <input
                type="password"
                autoComplete="current-password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="أدخل كلمة المرور"
                className="w-full bg-[#FAF6F0] border border-[#E6DFD3] focus:border-[#C88A4B] rounded-2xl px-4 py-3 text-sm text-[#231710] focus:outline-none transition font-bold"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full bg-[#231710] hover:bg-[#3a261a] text-[#D4AF37] hover:text-white font-cairo font-black py-3.5 rounded-2xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer text-sm"
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

          <div className="pt-4 border-t border-[#E6DFD3] text-center">
            <Link
              href="/"
              className="text-xs text-[#6E5D4F] hover:text-[#231710] font-bold transition"
            >
              ← العودة للمتجر الرئيسي
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 3. Authenticated Rider Portal
  return (
    <div className="min-h-screen bg-[#FAF6F0] text-[#231710] pb-20">
      {/* Top Sticky Header */}
      <header className="sticky top-0 z-30 bg-[#231710] text-[#FAF6F0] border-b-2 border-[#D4AF37]/40 px-4 py-3 shadow-md">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#D4AF37] text-[#231710] flex items-center justify-center font-black">
              <Bike className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-cairo font-black text-sm text-white">
                  محمصة حفصة
                </span>
                <span className="text-[10px] bg-[#D4AF37]/20 text-[#D4AF37] px-2 py-0.5 rounded-full font-bold">
                  بني مزار
                </span>
              </div>
              <p className="text-[11px] text-[#FAF6F0]/70 font-bold truncate max-w-[170px] sm:max-w-none">
                🛵 المندوب: {riderInfo?.displayName || riderInfo?.username || 'المندوب'}
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
              className={`p-2 rounded-xl transition cursor-pointer flex items-center gap-1 ${isAudioMutedState ? 'bg-rose-500/25 text-rose-300' : 'bg-white/10 text-[#D4AF37] hover:bg-white/20'}`}
            >
              {isAudioMutedState ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-[#D4AF37]" />}
            </button>
            <button
              type="button"
              onClick={() => fetchRiderOrders()}
              disabled={loading}
              title="تحديث لحظي"
              className="p-2 bg-white/10 hover:bg-white/20 text-[#D4AF37] rounded-xl transition cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={handleLogout}
              title="تسجيل الخروج"
              className="p-2 bg-[#B83B2B]/20 hover:bg-[#B83B2B]/40 text-red-200 rounded-xl transition cursor-pointer"
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
            className={`p-3 rounded-2xl text-xs font-black border flex items-center gap-2 ${
              feedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                : 'bg-red-50 border-red-400 text-red-800'
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
          <div className="bg-white p-3 rounded-2xl border border-[#E6DFD3] shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-[#6E5D4F] flex items-center gap-1">
              <Package className="w-3.5 h-3.5 text-[#C88A4B]" />
              <span>إجمالي الطلبات</span>
            </span>
            <div className="text-xl font-cairo font-black text-[#231710] tabular-nums">
              {stats.totalAssigned}
            </div>
          </div>

          <div className="bg-white p-3 rounded-2xl border border-[#E6DFD3] shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-[#6E5D4F] flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>بانتظار التوصيل</span>
            </span>
            <div className="text-xl font-cairo font-black text-amber-600 tabular-nums">
              {stats.pendingDelivery}
            </div>
          </div>

          <div className="bg-white p-3 rounded-2xl border border-[#E6DFD3] shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-[#6E5D4F] flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#3B6E4C]" />
              <span>تم التسليم اليوم</span>
            </span>
            <div className="text-xl font-cairo font-black text-[#3B6E4C] tabular-nums">
              {stats.deliveredToday}
            </div>
          </div>

          <div className="bg-white p-3 rounded-2xl border border-[#D4AF37]/40 bg-gradient-to-br from-white to-[#F3ECE1] shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-[#6E5D4F] flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5 text-[#231710]" />
              <span>تحصيل كاش (COD)</span>
            </span>
            <div className="text-xl font-cairo font-black text-[#231710] tabular-nums">
              {stats.totalCodToCollect} <span className="text-xs">ج.م</span>
            </div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-white p-3 rounded-2xl border border-[#E6DFD3] shadow-xs space-y-3">
          {/* Quick Search */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث برقم الهاتف، اسم العميل، القرية، أو رقم الطلب..."
              className="w-full bg-[#FAF6F0] border border-[#E6DFD3] focus:border-[#C88A4B] rounded-xl py-2 pr-9 pl-3 text-xs text-[#231710] placeholder-[#6E5D4F]/60 focus:outline-none font-bold"
            />
            <Search className="w-4 h-4 text-[#C88A4B] absolute right-3 top-2.5" />
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-cairo font-black transition shrink-0 cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-[#231710] text-[#D4AF37]'
                  : 'bg-[#FAF6F0] text-[#6E5D4F] hover:bg-[#E6DFD3]'
              }`}
            >
              📋 الكل ({stats.totalAssigned})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('bandar_fast')}
              className={`px-3 py-1.5 rounded-xl text-xs font-cairo font-black transition shrink-0 cursor-pointer ${
                activeTab === 'bandar_fast'
                  ? 'bg-[#C88A4B] text-white'
                  : 'bg-[#FAF6F0] text-[#6E5D4F] hover:bg-[#E6DFD3]'
              }`}
            >
              ⚡ بندر بني مزار (فوري)
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('villages_scheduled')}
              className={`px-3 py-1.5 rounded-xl text-xs font-cairo font-black transition shrink-0 cursor-pointer ${
                activeTab === 'villages_scheduled'
                  ? 'bg-[#3B6E4C] text-white'
                  : 'bg-[#FAF6F0] text-[#6E5D4F] hover:bg-[#E6DFD3]'
              }`}
            >
              🌾 دورات قرى المركز
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('delivered')}
              className={`px-3 py-1.5 rounded-xl text-xs font-cairo font-black transition shrink-0 cursor-pointer ${
                activeTab === 'delivered'
                  ? 'bg-[#231710] text-emerald-300'
                  : 'bg-[#FAF6F0] text-[#6E5D4F] hover:bg-[#E6DFD3]'
              }`}
            >
              ✅ المسلمة ({stats.deliveredToday})
            </button>
          </div>
        </div>

        {/* Orders List */}
        {orders.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 border border-[#E6DFD3] text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#FAF6F0] text-[#C88A4B] flex items-center justify-center mx-auto">
              <Package className="w-6 h-6" />
            </div>
            <h3 className="font-cairo font-black text-base text-[#231710]">
              لا توجد طلبات توصيل في هذا التبويب حالياً
            </h3>
            <p className="text-xs text-[#6E5D4F] font-bold">
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
                  className={`bg-white rounded-3xl border shadow-xs overflow-hidden transition ${
                    isDelivered
                      ? 'border-emerald-300 bg-emerald-50/20'
                      : 'border-[#D4AF37]/40 hover:border-[#C88A4B]'
                  }`}
                >
                  {/* Card Top: Order Number, Badge & Time */}
                  <div className="p-3.5 sm:p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="font-cairo font-black text-base text-[#231710]">
                          #{order.orderNumber}
                        </span>
                        {isVillage ? (
                          <span className="bg-[#3B6E4C]/15 text-[#3B6E4C] px-2.5 py-0.5 rounded-full text-[11px] font-black flex items-center gap-1">
                            <Compass className="w-3 h-3" />
                            <span>
                              {order.villageName
                                ? `قرية ${order.villageName}`
                                : 'دورة قرى بني مزار'}
                            </span>
                          </span>
                        ) : (
                          <span className="bg-[#C88A4B]/15 text-[#C88A4B] px-2.5 py-0.5 rounded-full text-[11px] font-black flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            <span>بندر بني مزار (فوري)</span>
                          </span>
                        )}
                      </div>

                      {/* Status Tag */}
                      <span
                        className={`text-[11px] font-black px-2.5 py-0.5 rounded-full ${
                          isDelivered
                            ? 'bg-emerald-100 text-emerald-800'
                            : isShipped
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {isDelivered
                          ? '✅ تم التسليم'
                          : isShipped
                            ? '🛵 جاري التوصيل'
                            : '🔥 جاهز للتحرك'}
                      </span>
                    </div>

                    {/* Scheduled Slot if village */}
                    {order.deliverySlot && (
                      <div className="bg-[#FAF6F0] rounded-xl px-3 py-1.5 border border-[#E6DFD3] text-[11px] font-bold text-[#6E5D4F] flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-[#C88A4B]" />
                        <span>موعد الدورة: <strong>{order.deliverySlot}</strong></span>
                      </div>
                    )}

                    {/* Customer Info & Direct Contacts */}
                    <div className="bg-[#FAF6F0] rounded-2xl p-3 border border-[#E6DFD3] space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <h4 className="font-cairo font-black text-sm text-[#231710]">
                            {order.customerName}
                          </h4>
                          <p className="text-xs text-[#6E5D4F] font-bold flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-[#C88A4B] shrink-0" />
                            <span>{order.address}</span>
                          </p>
                        </div>
                      </div>

                      {/* Mobile Fast Action Buttons (Call + WhatsApp) */}
                      <div className="flex items-center gap-2 pt-1 border-t border-[#E6DFD3]">
                        <a
                          href={`tel:${order.customerPhone}`}
                          className="flex-1 bg-[#3B6E4C] hover:bg-[#2f5a3d] text-white py-2 px-3 rounded-xl text-xs font-cairo font-black flex items-center justify-center gap-1.5 transition shadow-xs"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>اتصال بالعميل</span>
                        </a>

                        <a
                          href={`https://wa.me/${formatWhatsAppPhone(
                            order.customerPhone
                          )}?text=${encodeURIComponent(
                            `السلام عليكم ورحمة الله يا ${order.customerName} 🌰\nمع حضرتك مندوب محمصة حفصة للبن والمكسرات بخصوص طلبك رقم #${order.orderNumber}.\nأنا في طريقي لحضرتك الآن إلى العنوان: ${order.address}.\nالمبلغ المطلوب: ${
                              isCod ? `${order.total} ج.م نقداً` : 'تم الدفع مسبقاً'
                            }`
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 bg-[#25D366] hover:bg-[#1ebd5a] text-white py-2 px-3 rounded-xl text-xs font-cairo font-black flex items-center justify-center gap-1.5 transition shadow-xs"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>واتساب فوري</span>
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
                        className="w-full flex items-center justify-between text-xs font-bold text-[#6E5D4F] hover:text-[#231710] py-1 cursor-pointer"
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
                        <div className="mt-2 bg-[#FAF6F0] rounded-xl p-2.5 text-xs space-y-1.5 border border-[#E6DFD3]">
                          {order.items?.map((item, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between text-[11px] font-bold"
                            >
                              <span>
                                {item.quantity}× {item.productName} ({item.weightLabel || `${item.unitPrice} ج.م`})
                              </span>
                              <span className="text-[#C88A4B] font-black">
                                {item.unitPrice * item.quantity} ج.م
                              </span>
                            </div>
                          ))}
                          {order.notes && (
                            <div className="pt-1.5 border-t border-[#E6DFD3] text-[10px] text-[#B83B2B] font-black">
                              ملاحظات العميل: {order.notes}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Payment Status & COD Amount */}
                    <div
                      className={`p-3 rounded-2xl border text-xs font-black flex items-center justify-between ${
                        isCod
                          ? 'bg-amber-50 border-amber-300 text-amber-950'
                          : 'bg-emerald-50 border-emerald-300 text-emerald-950'
                      }`}
                    >
                      <div>
                        <span>{isCod ? '💵 الدفع عند الاستلام (COD):' : '✅ طريقة الدفع:'}</span>
                        <span className="block text-[11px] font-bold text-[#6E5D4F]">
                          {isCod ? 'يجب تحصيل المبلغ نقداً بالكامل' : 'مدفوع إلكترونياً — لا تُحصّل أي مبالغ'}
                        </span>
                      </div>
                      <div className="text-base font-cairo font-black tabular-nums">
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
                            className="flex-1 bg-[#C88A4B] hover:bg-[#b0753a] text-white py-3 rounded-2xl text-xs font-cairo font-black transition flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                          >
                            <Bike className="w-4 h-4" />
                            <span>استلام وبدء التحرك</span>
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={actionLoadingId === order.id}
                          onClick={() => handleUpdateStatus(order, 'delivered')}
                          className="flex-1 bg-[#3B6E4C] hover:bg-[#2f5a3d] text-white py-3 rounded-2xl text-xs font-cairo font-black transition flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
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
                      <div className="bg-emerald-100 text-emerald-900 py-2.5 px-4 rounded-2xl text-xs font-black flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>تم تسليم هذا الطلب بنجاح</span>
                        </div>
                        {order.deliveredAt && (
                          <span className="text-[10px] font-bold tabular-nums">
                            {new Date(order.deliveredAt).toLocaleTimeString('ar-EG', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
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
