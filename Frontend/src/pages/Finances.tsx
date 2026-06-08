import { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer
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
import { CustomSelect } from '@/components/ui/CustomSelect';
import type { DatabaseInvoice } from '@/types/database.types';
import type { InventoryTransaction } from '@/types/inventory.types';
import { ipcRenderer } from '@/lib/ipc';

type DatePreset = '30days' | '3months' | '6months' | '1year' | 'custom';
type Tab = 'overview' | 'billing';

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
  paymentMethod: string;
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

interface ExpenseItem { id: number; category: string; amount: number; date: string; notes?: string; }

export default function Finances() {
  const { showToast } = useUI();
  const [invoices, setInvoices] = useState<DatabaseInvoice[]>([]);
  const [inventoryTransactions, setInventoryTransactions] = useState<InventoryTransaction[]>([]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
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
    invoiceId: number; patientName: string; invoiceNumber: string; total: number; amountPaid: number; paymentMethod: string;
  } | null>(null);

  // Expense form
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expCat, setExpCat] = useState('Rent');
  const [expAmt, setExpAmt] = useState(0);
  const [expNotes, setExpNotes] = useState('');

  // Bulk payment state
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<number[]>([]);
  const [bulkPaymentMethod, setBulkPaymentMethod] = useState('Cash');
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const [invResult, billResult, transResult, expenseResult] = await Promise.all([
          ipcRenderer.invoke('load-invoices'),
          ipcRenderer.invoke('get-billing-summary'),
          ipcRenderer.invoke('get-inventory-transactions', 5000),
          ipcRenderer.invoke('get-expenses'),
        ]);
        if (invResult.success) setInvoices(invResult.invoices);
        if (billResult.success) setBillingData(billResult);
        if (transResult?.success) setInventoryTransactions(transResult.transactions);
        if (expenseResult?.success) setExpenses(expenseResult.expenses);
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
    ipcRenderer.invoke('sync-now').catch(() => {});
  };

  const handleBulkPayment = async () => {
    if (selectedInvoiceIds.length === 0) return;
    setIsBulkSubmitting(true);
    let successCount = 0;
    
    try {
      for (const invId of selectedInvoiceIds) {
        const inv = billingData?.invoices.find(i => i.id === invId);
        if (inv && inv.total > inv.amountPaid) {
          const due = inv.total - inv.amountPaid;
          const result = await ipcRenderer.invoke('record-payment', inv.id, due, bulkPaymentMethod);
          if (result.success) successCount++;
        }
      }
      
      if (successCount > 0) {
        showToast('success', `Successfully recorded payments for ${successCount} invoice(s)`);
        setSelectedInvoiceIds([]);
        await refreshBilling();
        ipcRenderer.invoke('sync-now').catch(() => {});
      } else {
        showToast('error', 'Failed to process bulk payments');
      }
    } catch (error) {
      log.error('finances', 'Bulk payment failed', { error: error instanceof Error ? error.message : String(error) });
      showToast('error', 'Bulk payment failed. Some invoices may not have been updated.');
    } finally {
      setIsBulkSubmitting(false);
    }
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

  const { currentMetrics, previousMetrics, chartData } = useMemo(() => {
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
      let revenue = invs.reduce((sum, inv) => sum + (Number(inv.total) || 0), 0);
      let expenses = 0;

      trans.forEach(t => {
        if (t.type === 'SALE') revenue += Number(t.totalAmount) || 0;
        if (t.type === 'PURCHASE') expenses += Number(t.totalAmount) || 0;
      });

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

    [...currentInvoices].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).forEach(inv => {
      const date = new Date(inv.date);
      if (isValid(date)) {
        const key = format(date, formatStr);
        trendMap.set(key, (trendMap.get(key) || 0) + Number(inv.total));
      }
    });

    [...currentTrans].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).forEach(t => {
      const date = new Date(t.date);
      if (isValid(date) && t.type === 'SALE') {
        const key = format(date, formatStr);
        trendMap.set(key, (trendMap.get(key) || 0) + Number(t.totalAmount));
      }
    });

    // Sort keys based on date
    const sortedKeys = Array.from(trendMap.keys()).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    const finalChartData = sortedKeys.map(date => ({ date, revenue: trendMap.get(date) || 0 }));

    return { currentMetrics: currentM, previousMetrics: previousM, chartData: finalChartData };
  }, [invoices, inventoryTransactions, startDate, endDate, preset]);

  const cashFlow = useMemo(() => {
    const invs = invoices.filter(inv => { const d = new Date(inv.date); return isValid(d) && d >= startOfDay(startDate) && d <= endOfDay(endDate); });
    const totalInvoiced = invs.reduce((s, i) => s + Number(i.total || 0), 0);
    const totalCollected = invs.reduce((s, i) => s + Number(i.amountPaid || 0), 0);
    const rate = totalInvoiced > 0 ? Number(((totalCollected / totalInvoiced) * 100).toFixed(1)) : 0;
    return { totalInvoiced, totalCollected, outstanding: totalInvoiced - totalCollected, rate };
  }, [invoices, startDate, endDate]);

  const renderMetricCard = (title: string, current: number, previous: number, isCurrency: boolean = false) => {
    const diff = current - previous;
    const percentChange = previous === 0 ? (current > 0 ? 100 : 0) : (diff / previous) * 100;
    const isPositive = diff >= 0;
    const displayCurrent = isCurrency ? `₹${current.toLocaleString()}` : current.toLocaleString();

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between">
        <h3 className="text-sm font-semibold text-slate-500 mb-2">{title}</h3>
        <div className="text-3xl font-semibold text-slate-800 mb-2">{displayCurrent}</div>
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

  const selectableInvoices = filteredInvoices.filter(inv => inv.total > inv.amountPaid);
  const isAllSelected = selectableInvoices.length > 0 && selectableInvoices.every(inv => selectedInvoiceIds.includes(inv.id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedInvoiceIds(selectedInvoiceIds.filter(id => !selectableInvoices.some(inv => inv.id === id)));
    } else {
      const newIds = [...selectedInvoiceIds];
      selectableInvoices.forEach(inv => {
        if (!newIds.includes(inv.id)) newIds.push(inv.id);
      });
      setSelectedInvoiceIds(newIds);
    }
  };

  const toggleSelectInvoice = (id: number) => {
    if (selectedInvoiceIds.includes(id)) {
      setSelectedInvoiceIds(selectedInvoiceIds.filter(i => i !== id));
    } else {
      setSelectedInvoiceIds([...selectedInvoiceIds, id]);
    }
  };

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
          breadcrumb="Management"
          title="Finance"
          icon={<div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg"><ChartBarIcon /></div>}
        />

        {/* Tabs */}
        <div className="bg-slate-100/50 p-1 rounded-[20px] flex items-center w-fit shadow-inner ring-1 ring-slate-200/50 backdrop-blur-md">
          {([{ key: 'overview', label: 'Overview' }, { key: 'billing', label: 'Billing' }] as const).map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-6 py-2 rounded-[16px] text-sm font-medium transition-all duration-300 ${
                activeTab === t.key ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200/60' : 'text-slate-500 hover:bg-white/60 hover:text-indigo-600'
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
              <div className="bg-slate-100/50 p-1 rounded-[20px] flex items-center shadow-inner ring-1 ring-slate-200/50 backdrop-blur-md">
                {(['30days', '3months', '6months', '1year'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => handlePresetChange(p)}
                    className={`px-5 py-2 rounded-[16px] text-sm font-medium transition-all duration-300 ${
                      preset === p ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200/60' : 'text-slate-500 hover:bg-white/60 hover:text-indigo-600'
                    }`}
                  >
                    {p === '30days' ? 'Last 30 Days' : p === '3months' ? '3 Months' : p === '6months' ? '6 Months' : '1 Year'}
                  </button>
                ))}
                <button
                  onClick={() => setPreset('custom')}
                  className={`px-5 py-2 rounded-[16px] text-sm font-medium transition-all duration-300 ${
                    preset === 'custom' ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200/60' : 'text-slate-500 hover:bg-white/60 hover:text-indigo-600'
                  }`}
                >
                  Custom
                </button>
              </div>
              <div className="flex items-center gap-3 bg-slate-50 p-1.5 rounded-xl border border-slate-200/60 shadow-inner">
                <div className="relative flex items-center">
                  <input type="date" value={format(startDate, 'yyyy-MM-dd')}
                    onChange={e => { setPreset('custom'); setStartDate(new Date(e.target.value)); }}
                    className="pl-4 pr-10 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-shadow appearance-none cursor-pointer outline-none hover:border-slate-300 shadow-sm [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer" />
                  <svg className="w-5 h-5 text-slate-400 absolute right-3 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </div>
                <span className="text-slate-400 font-medium text-sm">to</span>
                <div className="relative flex items-center">
                  <input type="date" value={format(endDate, 'yyyy-MM-dd')}
                    onChange={e => { setPreset('custom'); setEndDate(new Date(e.target.value)); }}
                    className="pl-4 pr-10 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-shadow appearance-none cursor-pointer outline-none hover:border-slate-300 shadow-sm [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer" />
                  <svg className="w-5 h-5 text-slate-400 absolute right-3 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </div>
              </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {renderMetricCard("Total Revenue", currentMetrics.revenue, previousMetrics.revenue, true)}
              {renderMetricCard("Total Expenses", currentMetrics.expenses, previousMetrics.expenses, true)}
              {renderMetricCard("Net Profit", currentMetrics.profit, previousMetrics.profit, true)}
              {renderMetricCard("Patients Treated", currentMetrics.patients, previousMetrics.patients, false)}
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-6">Revenue Trend</h3>
                <div className="h-80">
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorFinRev" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.9}/>
                            <stop offset="95%" stopColor="#818cf8" stopOpacity={0.4}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 500 }} axisLine={false} tickLine={false} dy={10} />
                        <YAxis tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 500 }} tickFormatter={(val) => `₹${val}`} axisLine={false} tickLine={false} dx={-10} />
                        <RechartsTooltip
                          cursor={{ fill: '#f8fafc' }}
                          contentStyle={{ borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.05)', fontWeight: 500, color: '#334155' }}
                          formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, 'Revenue']}
                        />
                        <Bar dataKey="revenue" fill="url(#colorFinRev)" radius={[6, 6, 0, 0]} maxBarSize={32} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-400">No data for selected period</div>
                  )}
                </div>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Cash Flow Summary</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-500">Total Invoiced</span>
                    <span className="text-sm font-semibold text-slate-800">₹{cashFlow.totalInvoiced.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-500">Total Collected</span>
                    <span className="text-sm font-semibold text-emerald-600">₹{cashFlow.totalCollected.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-500">Still Outstanding</span>
                    <span className="text-sm font-semibold text-rose-600">₹{cashFlow.outstanding.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-slate-500">Collection Rate</span>
                    <span className={`text-sm font-semibold ${cashFlow.rate >= 80 ? 'text-emerald-600' : cashFlow.rate >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>{cashFlow.rate}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Top Outstanding */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="font-semibold text-slate-800">Top Outstanding Invoices</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="border-b border-slate-100 bg-slate-50/50">{['Patient', 'Invoice #', 'Total', 'Paid', 'Due', 'Status'].map(h => <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">{h}</th>)}</tr></thead>
                  <tbody>
                    {(() => {
                      const outstandingInvs = invoices
                        .filter(inv => Number(inv.total || 0) > Number(inv.amountPaid || 0))
                        .sort((a, b) => (Number(b.total || 0) - Number(b.amountPaid || 0)) - (Number(a.total || 0) - Number(a.amountPaid || 0)))
                        .slice(0, 5);
                      return outstandingInvs.length === 0
                        ? <tr><td colSpan={6} className="text-center py-8 text-slate-400">All invoices are fully paid</td></tr>
                        : outstandingInvs.map(inv => {
                          const due = Number(inv.total || 0) - Number(inv.amountPaid || 0);
                          return (
                            <tr key={inv.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                              <td className="px-6 py-3 text-sm font-medium text-slate-800">{inv.patient?.firstName} {inv.patient?.lastName}</td>
                              <td className="px-6 py-3 text-sm text-slate-600">{inv.invoiceNumber}</td>
                              <td className="px-6 py-3 text-sm text-slate-600">₹{Number(inv.total || 0).toLocaleString()}</td>
                              <td className="px-6 py-3 text-sm text-emerald-600">₹{Number(inv.amountPaid || 0).toLocaleString()}</td>
                              <td className="px-6 py-3 text-sm font-medium text-rose-600">₹{due.toLocaleString()}</td>
                              <td className="px-6 py-3"><span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${inv.paymentStatus === 'overdue' ? 'bg-rose-100 text-rose-700' : inv.paymentStatus === 'partial' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{inv.paymentStatus || 'unpaid'}</span></td>
                            </tr>
                          );
                        });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Expenses */}
        {!showExpenseForm ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex items-center justify-between">
            <div>
              <span className="text-base font-semibold text-slate-800">Expenses</span>
              <span className="text-sm font-medium text-slate-500 ml-3 bg-slate-100 px-2.5 py-0.5 rounded-full">{expenses.length} recorded</span>
            </div>
            <button onClick={() => setShowExpenseForm(true)} className="px-5 py-2.5 text-sm font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors shadow-sm ring-1 ring-inset ring-rose-100">
              + Record Expense
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-800">Record Expense</h3>
              <button onClick={() => setShowExpenseForm(false)} className="text-slate-400 hover:text-slate-600 text-sm font-medium transition-colors">
                Cancel
              </button>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
              <div className="w-full sm:w-48">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Category</label>
                <CustomSelect 
                  value={expCat} 
                  onChange={(val) => setExpCat(String(val))} 
                  themeColor="teal"
                  options={['Rent','Salary','Utilities','Supplies','Equipment','Marketing','Other'].map(c => ({ value: c, label: c }))}
                />
              </div>
              
              <div className="w-full sm:w-32">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Amount</label>
                <div className="relative">
                  <span className="absolute left-4 top-2.5 text-slate-400 font-medium">₹</span>
                  <input 
                    type="number" 
                    min="1" 
                    value={expAmt || ''} 
                    onChange={e => setExpAmt(Number(e.target.value))} 
                    className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500 transition-all outline-none shadow-sm" 
                    placeholder="0.00"
                  />
                </div>
              </div>
              
              <div className="flex-1 w-full">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Notes (Optional)</label>
                <input 
                  type="text" 
                  placeholder="What was this for?" 
                  value={expNotes} 
                  onChange={e => setExpNotes(e.target.value)} 
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500 transition-all outline-none shadow-sm" 
                />
              </div>
              
              <button 
                onClick={async () => { 
                  if (!expAmt) return; 
                  const r = await ipcRenderer.invoke('add-expense', { category: expCat, amount: expAmt, notes: expNotes }); 
                  if (r.success) { 
                    showToast('success','Expense recorded'); 
                    setShowExpenseForm(false); 
                    setExpAmt(0); 
                    setExpNotes(''); 
                    const er = await ipcRenderer.invoke('get-expenses'); 
                    if (er.success) setExpenses(er.expenses); 
                  } else showToast('error', r.error); 
                }} 
                className="w-full sm:w-auto px-6 py-2.5 text-sm font-semibold text-white bg-rose-500 rounded-xl hover:bg-rose-600 shadow-sm shadow-rose-500/20 transition-all mt-2 sm:mt-0"
              >
                Save
              </button>
            </div>
          </div>
        )}
        {expenses.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto"><table className="w-full text-sm"><tbody>{expenses.slice(0, 5).map(e => <tr key={e.id} className="border-b border-slate-50"><td className="px-6 py-2 text-slate-600">{format(new Date(e.date), 'MMM dd')}</td><td className="px-2 py-2"><span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">{e.category}</span></td><td className="px-6 py-2 text-slate-500 text-xs">{e.notes}</td><td className="px-6 py-2 text-right font-medium text-rose-600">₹{e.amount.toLocaleString()}</td></tr>)}</tbody></table></div>
          </div>
        )}

        {/* Billing Tab */}
        {activeTab === 'billing' && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <p className="text-sm font-semibold text-slate-500 mb-1">Total Outstanding</p>
                <p className="text-3xl font-semibold text-rose-600">₹{billingData?.totalOutstanding?.toLocaleString() ?? 0}</p>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <p className="text-sm font-semibold text-slate-500 mb-1">Overdue Invoices</p>
                <p className="text-3xl font-semibold text-amber-600">{billingData?.overdueCount ?? 0}</p>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <p className="text-sm font-semibold text-slate-500 mb-1">Total Collected</p>
                <p className="text-3xl font-semibold text-emerald-600">₹{billingData?.totalCollected?.toLocaleString() ?? 0}</p>
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
              <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
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

              {/* Bulk Action Bar */}
              {selectedInvoiceIds.length > 0 && (
                <div className="bg-teal-50/50 px-6 py-3 border-b border-teal-100 flex flex-col sm:flex-row justify-between items-center gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-semibold text-teal-800">
                      {selectedInvoiceIds.length} invoice(s) selected
                    </span>
                    <button 
                      onClick={() => setSelectedInvoiceIds([])}
                      className="text-xs font-medium text-teal-600 hover:text-teal-800 transition-colors"
                    >
                      Clear Selection
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <CustomSelect 
                      value={bulkPaymentMethod}
                      onChange={(val) => setBulkPaymentMethod(String(val))}
                      themeColor="teal"
                      options={['Cash', 'Card', 'UPI', 'Online', 'Cheque'].map(m => ({ value: m, label: m }))}
                    />
                    <button
                      onClick={handleBulkPayment}
                      disabled={isBulkSubmitting}
                      className="px-4 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-sm transition-all whitespace-nowrap"
                    >
                      {isBulkSubmitting ? 'Processing...' : 'Mark as Paid'}
                    </button>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="px-6 py-3 w-12 text-center">
                        <input 
                          type="checkbox" 
                          checked={isAllSelected}
                          onChange={toggleSelectAll}
                          disabled={selectableInvoices.length === 0}
                          className="w-4 h-4 text-teal-600 border-slate-300 rounded focus:ring-teal-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                        />
                      </th>
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
                        <td colSpan={9} className="text-center py-12 text-slate-400">No invoices found</td>
                      </tr>
                    ) : (
                      filteredInvoices.map(inv => {
                        const due = inv.total - inv.amountPaid;
                        const isOverdue = inv.paymentStatus !== 'paid' && new Date(inv.date) < new Date(today);
                        const isFullyPaid = inv.paymentStatus === 'paid';
                        const isSelected = selectedInvoiceIds.includes(inv.id);
                        
                        return (
                          <tr key={inv.id} className={`border-b border-slate-50 transition-colors ${isSelected ? 'bg-teal-50/50' : 'hover:bg-slate-50/50'}`}>
                            <td className="px-6 py-4 text-center">
                              <input 
                                type="checkbox" 
                                checked={isSelected}
                                onChange={() => toggleSelectInvoice(inv.id)}
                                disabled={isFullyPaid}
                                className="w-4 h-4 text-teal-600 border-slate-300 rounded focus:ring-teal-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-30"
                              />
                            </td>
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
                                    paymentMethod: inv.paymentMethod,
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
          paymentMethod={paymentModal.paymentMethod}
          onClose={() => setPaymentModal(null)}
          onSuccess={handlePayment}
        />
      )}
    </div>
  );
}
