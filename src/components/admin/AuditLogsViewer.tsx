'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  ShieldAlert,
  Search,
  RefreshCw,
  Download,
  Eye,
  X,
  CheckCircle2,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import { AuditActionType, AuditLogEntry } from '@/types/store';

interface AuditLogsViewerProps {
  adminToken?: string | null;
  initialLogs?: AuditLogEntry[];
  compact?: boolean;
}

const ACTION_BADGE_STYLES: Partial<Record<AuditActionType, string>> = {
  auth_login: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  auth_failed: 'bg-rose-50 text-rose-700 border-rose-200',
  settings_update: 'bg-blue-50 text-blue-700 border-blue-200',
  price_change: 'bg-amber-50 text-amber-800 border-amber-200',
  inventory_adjustment: 'bg-purple-50 text-purple-700 border-purple-200',
  pos_return: 'bg-orange-50 text-orange-800 border-orange-200',
  order_cancel: 'bg-red-50 text-red-700 border-red-200',
  treasury_tx: 'bg-teal-50 text-teal-700 border-teal-200',
  system_reset: 'bg-red-100 text-red-800 border-red-300',
};

export default function AuditLogsViewer({
  adminToken,
  initialLogs = [],
  compact = false,
}: AuditLogsViewerProps) {
  const [logs, setLogs] = useState<AuditLogEntry[]>(initialLogs);
  const [actionLabels, setActionLabels] = useState<Record<string, string>>({});
  const [selectedAction, setSelectedAction] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [inspectedLog, setInspectedLog] = useState<AuditLogEntry | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedAction && selectedAction !== 'all') {
        params.set('action', selectedAction);
      }
      if (searchQuery.trim()) {
        params.set('q', searchQuery.trim());
      }
      params.set('limit', compact ? '100' : '300');

      const headers: Record<string, string> = {};
      if (adminToken) {
        headers.Authorization = `Bearer ${adminToken}`;
      }

      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`, {
        headers,
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'تعذر تحميل سجل الرقابة الأمني');
      }
      setLogs(Array.isArray(data.logs) ? data.logs : []);
      if (data.actionLabels) {
        setActionLabels(data.actionLabels);
      }
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ أثناء تحميل السجلات');
    } finally {
      setLoading(false);
    }
  }, [adminToken, selectedAction, searchQuery, compact]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleExportCsv = () => {
    const params = new URLSearchParams();
    if (selectedAction && selectedAction !== 'all') {
      params.set('action', selectedAction);
    }
    if (searchQuery.trim()) {
      params.set('q', searchQuery.trim());
    }
    params.set('format', 'csv');
    window.open(`/api/admin/audit-logs?${params.toString()}`, '_blank');
  };

  return (
    <div className="bg-white rounded-2xl border border-[#E8E0D5] p-5 space-y-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-[#9A6836]">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-cairo font-bold text-base text-[#231710]">
                سجل الرقابة والأمان غير القابل للتلاعب (Immutable Audit Log)
              </h3>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Lock className="w-3 h-3" />
                قراءة وتدقيق فقط
              </span>
            </div>
            <p className="text-xs text-[#6B5644]">
              توثيق فوري لكافة عمليات الدخول، تعديل الأسعار، تسويات المخزون، المرتجعات، وحركات الخزينة
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchLogs}
            disabled={loading}
            className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E8E0D5] bg-[#FAF6F0] hover:bg-[#F3ECE2] text-xs font-bold text-[#231710] transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>تحديث</span>
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#231710] hover:bg-[#3A271C] text-white text-xs font-bold transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>تصدير CSV</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2 relative">
          <Search className="w-4 h-4 text-[#8A7563] absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث باسم الموظف، رقم الفاتورة، اسم الصنف، أو تفاصيل الحركة..."
            className="w-full min-h-[40px] pr-9 pl-3 py-2 text-xs rounded-xl border border-[#E8E0D5] bg-[#FAF8F5] focus:outline-none focus:border-[#9A6836]"
          />
        </div>
        <select
          value={selectedAction}
          onChange={(e) => setSelectedAction(e.target.value)}
          className="w-full min-h-[40px] px-3 py-2 text-xs font-bold rounded-xl border border-[#E8E0D5] bg-[#FAF8F5] text-[#231710] focus:outline-none focus:border-[#9A6836]"
        >
          <option value="all">جميع أنواع العمليات ({logs.length})</option>
          {Object.entries(actionLabels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="overflow-x-auto border border-[#E8E0D5] rounded-xl max-h-[420px] overflow-y-auto">
        <table className="w-full text-right text-xs">
          <thead className="bg-[#FAF6F0] text-[#6B5644] sticky top-0 z-10 border-b border-[#E8E0D5]">
            <tr>
              <th className="py-2.5 px-3 font-bold">التوقيت</th>
              <th className="py-2.5 px-3 font-bold">نوع الإجراء</th>
              <th className="py-2.5 px-3 font-bold">المنفذ</th>
              <th className="py-2.5 px-3 font-bold">ملخص العملية</th>
              <th className="py-2.5 px-3 font-bold text-center">التفاصيل</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0E9DF]">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-[#8A7563] font-medium">
                  {loading ? 'جاري تحميل سجل الرقابة الأمني...' : 'لا توجد سجلات مطابقة للبحث حالياً'}
                </td>
              </tr>
            ) : (
              logs.map((log) => {
                const badgeClass =
                  ACTION_BADGE_STYLES[log.action] ||
                  'bg-[#FAF6F0] text-[#5C4634] border-[#E8E0D5]';
                const hasDiff = log.beforeValue !== undefined || log.afterValue !== undefined;

                return (
                  <tr key={log.id} className="hover:bg-[#FCF9F5] transition">
                    <td className="py-2.5 px-3 whitespace-nowrap text-[#6B5644] font-mono text-[11px]">
                      {new Date(log.createdAt).toLocaleString('ar-EG', {
                        month: 'short',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border font-bold text-[11px] ${badgeClass}`}
                      >
                        {log.action === 'auth_login' && <CheckCircle2 className="w-3 h-3" />}
                        {log.action === 'auth_failed' && <AlertTriangle className="w-3 h-3" />}
                        {actionLabels[log.action] || log.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="font-bold text-[#231710]">
                        {log.actorDisplayName || log.actorUsername}
                      </div>
                      <div className="text-[11px] text-[#6B5644]">
                        {log.actorUsername} ({String(log.actorRole)})
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-[#231710] max-w-md">{log.summary}</td>
                    <td className="py-2.5 px-3 text-center">
                      {hasDiff ? (
                        <button
                          type="button"
                          onClick={() => setInspectedLog(log)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FAF6F0] hover:bg-[#EFE6DA] border border-[#E8E0D5] text-[#231710] font-bold text-[11px]"
                        >
                          <Eye className="w-3 h-3 text-[#9A6836]" />
                          <span>مقارنة</span>
                        </button>
                      ) : (
                        <span className="text-[#B0A192]">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {inspectedLog && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E8E0D5] max-w-2xl w-full p-5 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#E8E0D5] pb-3">
              <div>
                <h4 className="font-cairo font-bold text-sm text-[#231710]">
                  تفاصيل حركة الرقابة #{inspectedLog.id}
                </h4>
                <p className="text-xs text-[#6B5644] mt-0.5">{inspectedLog.summary}</p>
              </div>
              <button
                type="button"
                onClick={() => setInspectedLog(null)}
                className="p-1.5 rounded-lg hover:bg-[#FAF6F0] text-[#6B5644]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-rose-50/50 border border-rose-200/70 space-y-1.5">
                <div className="font-bold text-rose-800">القيمة قبل التعديل (Before)</div>
                <pre className="text-[11px] font-mono whitespace-pre-wrap break-all text-[#231710] dir-ltr text-left">
                  {inspectedLog.beforeValue !== undefined
                    ? JSON.stringify(inspectedLog.beforeValue, null, 2)
                    : 'لا يوجد'}
                </pre>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-200/70 space-y-1.5">
                <div className="font-bold text-emerald-800">القيمة بعد التعديل (After)</div>
                <pre className="text-[11px] font-mono whitespace-pre-wrap break-all text-[#231710] dir-ltr text-left">
                  {inspectedLog.afterValue !== undefined
                    ? JSON.stringify(inspectedLog.afterValue, null, 2)
                    : 'لا يوجد'}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
