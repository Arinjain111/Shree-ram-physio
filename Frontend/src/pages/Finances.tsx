import { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell
} from 'recharts';
import {
  subDays, subMonths, subYears, startOfDay, endOfDay, isWithinInterval,
  format, isValid, differenceInDays
} from 'date-fns';
import { useUI } from '@/context/UIContext';
import { useLogger } from '@/utils/logger';
import PageHeader from '@/components/layout/PageHeader';
import PaymentModal from '@/components/billing/PaymentModal';
import { ChartBarIcon } from '@/components/icons';
import type { DatabaseInvoice } from '@/types/database.types';
import type { InventoryTransaction } from '@/types/inventory.types';
import { ipcRenderer } from '@/lib/ipc';

const COLORS = ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#84cc16'];

type DatePreset = '30days' | '3months' | '6months' | '1year' | 'custom';
type Tab = 'overview' | 'billing';
type FinanceFilter = 'all' | 'treatments' | 'inventory';

interface Metrics {
  revenue: number;
  expenses: number;
  profit: number;
  patients: number;
  invoices: number;
  avgRevenue: number;
}

interface InvoiceSummary {
  id: number;
  invoiceNumber: string;
  date: string;
  total: number;
  amountPaid: number;
  paymentStatus: string;
  patientName: string;
}

interface BillingData {
  totalOutstanding: number;
  overdueCount: number;
  totalCollected: number;
  overdueInvoices: InvoiceSummary[];
  invoices: InvoiceSummary[];
}

const statusColors: Record<string, string> = {
  paid: 'bg-emerald-100 text-emerald-700',
  partial: 'bg-amber-100 text-amber-700',
  unpaid: 'bg-slate-100 text-slate-600',
  overdue: 'bg-rose-100 text-rose-700',
};

const statusLabels: Record<string, string> = {
  paid: 'Paid',
  partial: 'Partial',
  unpaid: 'Unpaid',
  overdue: 'Overdue',
};

type StatusTab = 'all' | 'unpaid' | 'partial' | 'paid' | 'overdue';

export default function Finances() {
  const { showToast } = useUI();
  const [invoices, setInvoices] = useState<DatabaseInvoice[]>([]);
  const [inventoryTransactions, setInventoryTransactions] = useState<InventoryTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [financeFilter, setFinanceFilter] = useState<FinanceFilter>('all');
  const log = useLogger();

  // Analytics State
  const [preset, setPreset] = useState<DatePreset>('30days');
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 30));
  const [endDate, setEndDate] = useState<Date>(new Date());

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Billing State
  const [billingData, setBillingData] = useState<BillingData | null>(null);
  const [billingTab, setBillingTab] = useState<StatusTab>('overdue');
  const [paymentModal, setPaymentModal] = useState<{
    invoiceId: number; patientName: string; invoiceNumber: string; total: number; amountPaid: number
  } | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const [invResult, billResult, transResult] = await Promise.all([
          ipcRenderer.invoke('load-invoices'),
          ipcRenderer.invoke('get-billing-summary'),
          ipcRenderer.invoke('get-inventory-transactions', 5000) // load many
        ]);
        if (invResult.success) setInvoices(invResult.invoices);
        if (billResult.success) setBillingData(billResult);
        if (transResult?.success) setInventoryTransactions(transResult.transactions);
      } catch (error) {
        log.error('finances', 'Failed to load finance data', { error: error instanceof Error ? error.message : String(error) });
        showToast('error', 'Failed to load data');
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const refreshBilling = async () => {
    const result = await ipcRenderer.invoke('get-billing-summary');
    if (result.success) setBillingData(result);
  };

  const handlePayment = async () => {
    await refreshBilling();
    showToast('success', 'Payment recorded successfully');
  };

  // Analytics
  const handlePresetChange = (newPreset: DatePreset) => {
    setPreset(newPreset);
    const end = new Date();
    let start = new Date();
    switch (newPreset) {
      case '30days': start = subDays(end, 30); break;
      case '3months': start = subMonths(end, 3); break;
      case '6months': start = subMonths(end, 6); break;
      case '1year': start = subYears(end, 1); break;
      case 'custom': return;
    }
    setStartDate(startOfDay(start));
    setEndDate(endOfDay(end));
  };

  const { currentMetrics, previousMetrics, chartData, treatmentData } = useMemo(() => {
    const currentInterval = { start: startOfDay(startDate), end: endOfDay(endDate) };
    const daysDiff = differenceInDays(currentInterval.end, currentInterval.start) + 1;
    const previousInterval = {
      start: subDays(currentInterval.start, daysDiff),
      end: endOfDay(subDays(currentInterval.start, 1))
    };

    const currentInvoices: DatabaseInvoice[] = [];
    const previousInvoices: DatabaseInvoice[] = [];
    
    invoices.forEach(inv => {
      const date = new Date(inv.date);
      if (!isValid(date)) return;
      if (isWithinInterval(date, currentInterval)) currentInvoices.push(inv);
      if (isWithinInterval(date, previousInterval)) previousInvoices.push(inv);
    });

    const currentTrans: InventoryTransaction[] = [];
    const previousTrans: InventoryTransaction[] = [];
    
    inventoryTransactions.forEach(t => {
      const date = new Date(t.date);
      if (!isValid(date)) return;
      if (isWithinInterval(date, currentInterval)) currentTrans.push(t);
      if (isWithinInterval(date, previousInterval)) previousTrans.push(t);
    });

    const calculateMetrics = (invs: DatabaseInvoice[], trans: InventoryTransaction[]): Metrics => {
      let revenue = 0;
      let expenses = 0;
      
      if (financeFilter === 'all' || financeFilter === 'treatments') {
        revenue += invs.reduce((sum, inv) => sum + (Number(inv.total) || 0), 0);
      }
      
      if (financeFilter === 'all' || financeFilter === 'inventory') {
        trans.forEach(t => {
          if (t.type === 'SALE') revenue += Number(t.totalAmount) || 0;
          if (t.type === 'PURCHASE') expenses += Number(t.totalAmount) || 0;
        });
      }

      const uniquePatients = new Set(invs.map(inv => inv.patient?.id || `${inv.patient?.firstName} ${inv.patient?.lastName}`));
      return { 
        revenue, 
        expenses,
        profit: revenue - expenses,
        patients: uniquePatients.size, 
        invoices: invs.length, 
        avgRevenue: invs.length ? revenue / invs.length : 0 
      };
    };

    const currentM = calculateMetrics(currentInvoices, currentTrans);
    const previousM = calculateMetrics(previousInvoices, previousTrans);

    const formatStr = preset === '30days' || preset === 'custom' && daysDiff <= 60 ? 'MMM dd' : 'MMM yyyy';
    const trendMap = new Map<string, number>();
    
    if (financeFilter === 'all' || financeFilter === 'treatments') {
      [...currentInvoices].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).forEach(inv => {
        const date = new Date(inv.date);
        if (isValid(date)) {
          const key = format(date, formatStr);
          trendMap.set(key, (trendMap.get(key) || 0) + Number(inv.total));
        }
      });
    }

    if (financeFilter === 'all' || financeFilter === 'inventory') {
      [...currentTrans].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).forEach(t => {
        const date = new Date(t.date);
        if (isValid(date) && t.type === 'SALE') {
          const key = format(date, formatStr);
          trendMap.set(key, (trendMap.get(key) || 0) + Number(t.totalAmount));
        }
      });
    }
    
    // Sort keys based on date
    const sortedKeys = Array.from(trendMap.keys()).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    const finalChartData = sortedKeys.map(date => ({ date, revenue: trendMap.get(date) || 0 }));

    const tMap = new Map<string, number>();
    if (financeFilter === 'all' || financeFilter === 'treatments') {
      currentInvoices.forEach(inv => {
        inv.treatments.forEach(t => {
          tMap.set(t.name, (tMap.get(t.name) || 0) + Number(t.amount));
        });
      });
    }

    if (financeFilter === 'all' || financeFilter === 'inventory') {
      currentTrans.forEach(t => {
        if (t.type === 'SALE') {
          const name = `Item: ${t.item?.name || 'Unknown'}`;
          tMap.set(name, (tMap.get(name) || 0) + Number(t.totalAmount));
        }
      });
    }

    const tData = Array.from(tMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
      .reverse();

    return { currentMetrics: currentM, previousMetrics: previousM, chartData: finalChartData, treatmentData: tData };
  }, [invoices, inventoryTransactions, startDate, endDate, preset, financeFilter]);

  const renderMetricCard = (title: string, current: number, previous: number, isCurrency: boolean = false) => {
    const diff = current - previous;
    const percentChange = previous === 0 ? (current > 0 ? 100 : 0) : (diff / previous) * 100;
    const isPositive = diff >= 0;
    const displayCurrent = isCurrency ? `₹${current.toLocaleString()}` : current.toLocaleString();

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between">
        <h3 className="text-sm font-semibold text-slate-500 mb-2">{title}</h3>
        <div className="text-3xl font-bold text-slate-800 mb-2">{displayCurrent}</div>
        <div className={`text-sm font-medium flex items-center gap-1 ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
          <span>{isPositive ? '↑' : '↓'}</span>
          <span>{Math.abs(percentChange).toFixed(1)}%</span>
          <span className="text-slate-400 ml-1 font-normal">vs prev. period</span>
        </div>
      </div>
    );
  };

  const filteredInvoices = billingData?.invoices?.filter(inv => {
    if (billingTab === 'all') return true;
    if (billingTab === 'overdue') return inv.paymentStatus !== 'paid' && new Date(inv.date) < new Date(today);
    return inv.paymentStatus === billingTab;
  }) ?? [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50/50 px-6 pb-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading financial data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 px-6 pb-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <PageHeader
          title="Finance"
          icon={<div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg"><ChartBarIcon /></div>}
          actions={
            <div className="flex bg-slate-200 p-1 rounded-xl">
              {(['all', 'treatments', 'inventory'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFinanceFilter(f)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    financeFilter === f ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {f === 'all' ? 'All Finances' : f === 'treatments' ? 'Treatments Only' : 'Inventory Only'}
                </button>
              ))}
            </div>
          }
        />

        {/* Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
          {([{ key: 'overview', label: 'Overview' }, { key: 'billing', label: 'Billing' }] as const).map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === t.key ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Filters */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex bg-slate-100 p-1 rounded-xl">
                {(['30days', '3months', '6months', '1year'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => handlePresetChange(p)}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                      preset === p ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {p === '30days' ? 'Last 30 Days' : p === '3months' ? '3 Months' : p === '6months' ? '6 Months' : '1 Year'}
                  </button>
                ))}
                <button
                  onClick={() => setPreset('custom')}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    preset === 'custom' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Custom
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input type="date" value={format(startDate, 'yyyy-MM-dd')}
                  onChange={e => { setPreset('custom'); setStartDate(new Date(e.target.value)); }}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500" />
                <span className="text-slate-400">to</span>
                <input type="date" value={format(endDate, 'yyyy-MM-dd')}
                  onChange={e => { setPreset('custom'); setEndDate(new Date(e.target.value)); }}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {renderMetricCard("Total Revenue (Inflow)", currentMetrics.revenue, previousMetrics.revenue, true)}
              {renderMetricCard("Total Expenses (Outflow)", currentMetrics.expenses, previousMetrics.expenses, true)}
              {renderMetricCard("Net Profit", currentMetrics.profit, previousMetrics.profit, true)}
              {financeFilter !== 'inventory' 
                ? renderMetricCard("Patients Treated", currentMetrics.patients, previousMetrics.patients, false)
                : renderMetricCard("Avg. Revenue", currentMetrics.avgRevenue, previousMetrics.avgRevenue, true)}
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-lg font-bold text-slate-800 mb-6">Revenue Trend</h3>
                <div className="h-80">
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(val) => `₹${val}`} />
                        <RechartsTooltip
                          cursor={{ fill: '#f1f5f9' }}
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                          formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, 'Revenue']}
                        />
                        <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={50} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-400">No data for selected period</div>
                  )}
                </div>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-lg font-bold text-slate-800 mb-6">Revenue by Source</h3>
                <div className="h-80">
                  {treatmentData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart layout="vertical" data={treatmentData} margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                        <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                        <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} width={120} />
                        <RechartsTooltip cursor={{ fill: '#f1f5f9' }}
                          formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, 'Revenue']}
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={30}>
                          {treatmentData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-400">No data for selected period</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Billing Tab */}
        {activeTab === 'billing' && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <p className="text-sm font-semibold text-slate-500 mb-1">Total Outstanding</p>
                <p className="text-3xl font-bold text-rose-600">₹{billingData?.totalOutstanding?.toLocaleString() ?? 0}</p>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <p className="text-sm font-semibold text-slate-500 mb-1">Overdue Invoices</p>
                <p className="text-3xl font-bold text-amber-600">{billingData?.overdueCount ?? 0}</p>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <p className="text-sm font-semibold text-slate-500 mb-1">Total Collected</p>
                <p className="text-3xl font-bold text-emerald-600">₹{billingData?.totalCollected?.toLocaleString() ?? 0}</p>
              </div>
            </div>

            {/* Overdue Alert */}
            {billingData && billingData.overdueCount > 0 && (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center gap-3">
                <svg className="w-6 h-6 text-rose-500 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <p className="text-sm font-medium text-rose-800">
                  {billingData.overdueCount} invoice{billingData.overdueCount > 1 ? 's' : ''} overdue — ₹{billingData.totalOutstanding?.toLocaleString()} outstanding
                </p>
              </div>
            )}

            {/* Invoice Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <div className="flex gap-2">
                  {(['overdue', 'all', 'unpaid', 'partial', 'paid'] as StatusTab[]).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setBillingTab(tab)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        billingTab === tab ? 'bg-teal-100 text-teal-700' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {tab === 'overdue' ? 'Overdue' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Invoice</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Patient</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Date</th>
                      <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Total</th>
                      <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Paid</th>
                      <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Due</th>
                      <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                      <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInvoices.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-12 text-slate-400">No invoices found</td>
                      </tr>
                    ) : (
                      filteredInvoices.map(inv => {
                        const due = inv.total - inv.amountPaid;
                        const isOverdue = inv.paymentStatus !== 'paid' && new Date(inv.date) < new Date(today);
                        return (
                          <tr key={inv.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4 text-sm font-medium text-slate-800">{inv.invoiceNumber}</td>
                            <td className="px-6 py-4 text-sm text-slate-600">{inv.patientName}</td>
                            <td className="px-6 py-4 text-sm text-slate-600">{format(new Date(inv.date), 'PP')}</td>
                            <td className="px-6 py-4 text-sm text-right font-medium text-slate-800">₹{inv.total.toLocaleString()}</td>
                            <td className="px-6 py-4 text-sm text-right text-emerald-600 font-medium">₹{inv.amountPaid.toLocaleString()}</td>
                            <td className="px-6 py-4 text-sm text-right text-rose-600 font-medium">₹{due.toLocaleString()}</td>
                            <td className="px-6 py-4 text-center">
                              <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${isOverdue ? statusColors.overdue : statusColors[inv.paymentStatus] || statusColors.unpaid}`}>
                                {isOverdue ? 'Overdue' : statusLabels[inv.paymentStatus] || 'Unpaid'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              {due > 0 && (
                                <button
                                  onClick={() => setPaymentModal({
                                    invoiceId: inv.id,
                                    patientName: inv.patientName,
                                    invoiceNumber: inv.invoiceNumber,
                                    total: inv.total,
                                    amountPaid: inv.amountPaid,
                                  })}
                                  className="px-3 py-1.5 text-xs font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-500 transition-colors"
                                >
                                  Record Payment
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {paymentModal && (
        <PaymentModal
          isOpen={true}
          invoiceId={paymentModal.invoiceId}
          patientName={paymentModal.patientName}
          invoiceNumber={paymentModal.invoiceNumber}
          total={paymentModal.total}
          amountPaid={paymentModal.amountPaid}
          onClose={() => setPaymentModal(null)}
          onSuccess={handlePayment}
        />
      )}
    </div>
  );
}
