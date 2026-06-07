import { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend,
  ComposedChart
} from 'recharts';
import {
  subDays, startOfMonth, endOfMonth, format, isValid,
  eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, startOfWeek, endOfWeek
} from 'date-fns';
import { useUI } from '@/context/UIContext';
import PageHeader from '@/components/layout/PageHeader';
import type { DatabaseInvoice } from '@/types/database.types';
import type { InventoryTransaction } from '@/types/inventory.types';
import { ipcRenderer } from '@/lib/ipc';

const PIE_COLORS = ['#6366f1', '#8b5cf6', '#0ea5e9', '#14b8a6', '#f59e0b', '#ec4899'];

type DatePreset = '7days' | '30days' | 'thisMonth' | 'lastMonth' | 'custom';

interface DayAggregate { date: string; revenue: number; expenses: number; patients: number; invoices: number; }

export default function Reports() {
  const { showToast } = useUI();
  const [invoices, setInvoices] = useState<DatabaseInvoice[]>([]);
  const [invTransactions, setInvTransactions] = useState<InventoryTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState<DatePreset>('30days');
  const [startDate, setStartDate] = useState(subDays(new Date(), 30));
  const [endDate, setEndDate] = useState(new Date());

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [invRes, txnRes] = await Promise.all([
          ipcRenderer.invoke('load-invoices'),
          ipcRenderer.invoke('get-inventory-transactions', 5000),
        ]);
        if (invRes.success) setInvoices(invRes.invoices);
        if (txnRes.success) setInvTransactions(txnRes.transactions);
      } catch { showToast('error', 'Failed to load report data'); }
      finally { setLoading(false); }
    })();
  }, []);

  const handlePreset = (p: DatePreset) => {
    setPreset(p);
    const now = new Date();
    switch (p) {
      case '7days': setStartDate(subDays(now, 7)); setEndDate(now); break;
      case '30days': setStartDate(subDays(now, 30)); setEndDate(now); break;
      case 'thisMonth': setStartDate(startOfMonth(now)); setEndDate(now); break;
      case 'lastMonth': {
        const lm = subDays(startOfMonth(now), 1);
        setStartDate(startOfMonth(lm)); setEndDate(endOfMonth(lm)); break;
      }
      case 'custom': return;
    }
  };

  const filteredInvoices = useMemo(() => invoices.filter(inv => {
    const d = new Date(inv.date);
    return isValid(d) && d >= startDate && d <= endDate;
  }), [invoices, startDate, endDate]);

  const filteredTxns = useMemo(() => invTransactions.filter(t => {
    const d = new Date(t.date);
    return isValid(d) && d >= startDate && d <= endDate;
  }), [invTransactions, startDate, endDate]);

  // Summary metrics
  const summary = useMemo(() => {
    const rev = filteredInvoices.reduce((s, i) => s + (Number(i.total) || 0), 0);
    const exp = filteredTxns.filter(t => t.type === 'PURCHASE').reduce((s, t) => s + (Number(t.totalAmount) || 0), 0);
    const saleRev = filteredTxns.filter(t => t.type === 'SALE').reduce((s, t) => s + (Number(t.totalAmount) || 0), 0);
    const totalRev = rev + saleRev;
    const patientSet = new Set(filteredInvoices.map(i => i.patient?.id || `${i.patient?.firstName} ${i.patient?.lastName}`));
    const count = filteredInvoices.length;
    return { revenue: totalRev, expenses: exp, profit: totalRev - exp, patients: patientSet.size, invoices: count, avgPerPatient: patientSet.size ? totalRev / patientSet.size : 0 };
  }, [filteredInvoices, filteredTxns]);

  // Daily aggregates
  const dailyData = useMemo(() => {
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    const map = new Map<string, DayAggregate>();
    days.forEach(d => map.set(format(d, 'yyyy-MM-dd'), { date: format(d, 'MMM dd'), revenue: 0, expenses: 0, patients: 0, invoices: 0 }));
    filteredInvoices.forEach(inv => {
      const key = format(new Date(inv.date), 'yyyy-MM-dd');
      const entry = map.get(key);
      if (entry) {
        entry.revenue += Number(inv.total) || 0;
        entry.invoices += 1;
        entry.patients += 1;
      }
    });
    filteredTxns.forEach(t => {
      const key = format(new Date(t.date), 'yyyy-MM-dd');
      const entry = map.get(key);
      if (entry && t.type === 'PURCHASE') entry.expenses += Number(t.totalAmount) || 0;
    });
    return Array.from(map.values());
  }, [filteredInvoices, filteredTxns, startDate, endDate]);

  // Monthly aggregates
  const monthlyData = useMemo(() => {
    const months = eachMonthOfInterval({ start: startDate, end: endDate });
    const map = new Map<string, { date: string; revenue: number; expenses: number }>();
    months.forEach(m => map.set(format(m, 'yyyy-MM'), { date: format(m, 'MMM yyyy'), revenue: 0, expenses: 0 }));
    filteredInvoices.forEach(inv => {
      const key = format(new Date(inv.date), 'yyyy-MM');
      const entry = map.get(key);
      if (entry) entry.revenue += Number(inv.total) || 0;
    });
    filteredTxns.forEach(t => {
      const key = format(new Date(t.date), 'yyyy-MM');
      const entry = map.get(key);
      if (entry && t.type === 'PURCHASE') entry.expenses += Number(t.totalAmount) || 0;
    });
    return Array.from(map.values());
  }, [filteredInvoices, filteredTxns, startDate, endDate]);

  // Payment method breakdown
  const paymentData = useMemo(() => {
    const map = new Map<string, number>();
    filteredInvoices.forEach(inv => {
      const method = inv.paymentMethod || 'Cash';
      map.set(method, (map.get(method) || 0) + (Number(inv.total) || 0));
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [filteredInvoices]);

  // Patient visit trends (weekly)
  const visitData = useMemo(() => {
    const weeks = eachWeekOfInterval({ start: startDate, end: endDate });
    const map = new Map<string, number>();
    weeks.forEach(w => map.set(format(w, 'yyyy-ww'), 0));
    const patientVisits = new Set<string>();
    filteredInvoices.forEach(inv => {
      const key = format(new Date(inv.date), 'yyyy-ww');
      const pid = inv.patient?.id || `${inv.patient?.firstName} ${inv.patient?.lastName}`;
      patientVisits.add(`${key}|${pid}`);
    });
    patientVisits.forEach(v => {
      const [week] = v.split('|');
      map.set(week, (map.get(week) || 0) + 1);
    });
    return weeks.map(w => ({ date: format(w, 'MMM dd'), visits: map.get(format(w, 'yyyy-ww')) || 0 }));
  }, [filteredInvoices, startDate, endDate]);

  // Weekly summary table — single-pass bucketing instead of O(n*m) nested filter
  const weeklySummary = useMemo(() => {
    const weeks = eachWeekOfInterval({ start: startDate, end: endDate });
    const weekKeys = weeks.map(w => format(startOfWeek(w, { weekStartsOn: 1 }), 'yyyy-ww'));
    const buckets: { revenue: number; expenses: number; patients: Set<string>; count: number }[] = weeks.map(() => ({ revenue: 0, expenses: 0, patients: new Set(), count: 0 }));

    const getWeekIdx = (d: Date) => {
      const key = format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-ww');
      return weekKeys.indexOf(key);
    };

    for (const inv of filteredInvoices) {
      const d = new Date(inv.date);
      if (!isValid(d)) continue;
      const idx = getWeekIdx(d);
      if (idx < 0) continue;
      buckets[idx].revenue += Number(inv.total) || 0;
      buckets[idx].count += 1;
      buckets[idx].patients.add(`${inv.patient?.id || ''}|${inv.patient?.firstName}|${inv.patient?.lastName}`);
    }

    for (const t of filteredTxns) {
      const d = new Date(t.date);
      if (!isValid(d)) continue;
      const idx = getWeekIdx(d);
      if (idx < 0) continue;
      if (t.type === 'SALE') buckets[idx].revenue += Number(t.totalAmount) || 0;
      if (t.type === 'PURCHASE') buckets[idx].expenses += Number(t.totalAmount) || 0;
    }

    return weeks.map((w, i) => {
      const b = buckets[i];
      const ws = startOfWeek(w, { weekStartsOn: 1 });
      const we = endOfWeek(w, { weekStartsOn: 1 });
      return { week: `${format(ws, 'MMM dd')} - ${format(we, 'MMM dd')}`, revenue: b.revenue, expenses: b.expenses, profit: b.revenue - b.expenses, patients: b.patients.size, invoices: b.count };
    });
  }, [filteredInvoices, filteredTxns, startDate, endDate]);

  // Treatment frequency (by count, not revenue)
  const treatmentFrequency = useMemo(() => {
    const map = new Map<string, number>();
    filteredInvoices.forEach(inv => {
      inv.treatments.forEach(t => {
        map.set(t.name, (map.get(t.name) || 0) + 1);
      });
    });
    return Array.from(map.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [filteredInvoices]);

  // Patient demographics
  const ageGroups = useMemo(() => {
    const groups = { '0-18': 0, '19-35': 0, '36-50': 0, '51-65': 0, '66+': 0 };
    const genderMap = new Map<string, number>();
    const seen = new Set<number | string>();
    filteredInvoices.forEach(inv => {
      const pid = inv.patient?.id || `${inv.patient?.firstName} ${inv.patient?.lastName}`;
      if (seen.has(pid)) return;
      seen.add(pid);
      const age = inv.patient?.age || 0;
      if (age <= 18) groups['0-18']++;
      else if (age <= 35) groups['19-35']++;
      else if (age <= 50) groups['36-50']++;
      else if (age <= 65) groups['51-65']++;
      else groups['66+']++;
      const gender = inv.patient?.gender || 'Unknown';
      genderMap.set(gender, (genderMap.get(gender) || 0) + 1);
    });
    return {
      age: Object.entries(groups).map(([name, value]) => ({ name, value })),
      gender: Array.from(genderMap.entries()).map(([name, value]) => ({ name, value })),
    };
  }, [filteredInvoices]);

  // Revenue by day of week
  const dayOfWeekData = useMemo(() => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const map = new Map<string, number>();
    days.forEach(d => map.set(d, 0));
    filteredInvoices.forEach(inv => {
      const d = new Date(inv.date);
      if (isValid(d)) {
        const day = days[d.getDay()];
        map.set(day, (map.get(day) || 0) + (Number(inv.total) || 0));
      }
    });
    return days.map(name => ({ name, revenue: map.get(name) || 0 }));
  }, [filteredInvoices]);

  // CSV export
  const exportCSV = () => {
    const headers = ['Week', 'Revenue', 'Expenses', 'Profit', 'Patients', 'Invoices'];
    const rows = weeklySummary.map(w => [w.week, w.revenue.toFixed(2), w.expenses.toFixed(2), w.profit.toFixed(2), String(w.patients), String(w.invoices)]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `report_${format(startDate, 'yyyy-MM-dd')}_to_${format(endDate, 'yyyy-MM-dd')}.csv`; a.click();
    URL.revokeObjectURL(url);
    showToast('success', 'Report exported to CSV');
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-50/50 px-6 pb-6 flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600" /></div>;
  }

  return (
    <div className="min-h-screen bg-slate-50/50 px-6 pb-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <PageHeader breadcrumb="Management" title="Reports & Analytics" icon={<div className="p-2 bg-teal-100 text-teal-700 rounded-lg"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg></div>} />

        {/* Date Filter */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            {(['7days', '30days', 'thisMonth', 'lastMonth'] as DatePreset[]).map(p => (
              <button key={p} onClick={() => handlePreset(p)} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${preset === p ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {p === '7days' ? '7 Days' : p === '30days' ? '30 Days' : p === 'thisMonth' ? 'This Month' : 'Last Month'}
              </button>
            ))}
            <button onClick={() => setPreset('custom')} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${preset === 'custom' ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Custom</button>
          </div>
          <div className="flex items-center gap-3 bg-slate-50 p-1.5 rounded-xl border border-slate-200/60 shadow-inner">
            <div className="relative flex items-center">
              <input type="date" value={format(startDate, 'yyyy-MM-dd')} onChange={e => { setPreset('custom'); setStartDate(new Date(e.target.value)); }} className="pl-4 pr-10 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-shadow appearance-none cursor-pointer outline-none hover:border-slate-300 shadow-sm [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer" />
              <svg className="w-5 h-5 text-slate-400 absolute right-3 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </div>
            <span className="text-slate-400 font-medium text-sm">to</span>
            <div className="relative flex items-center">
              <input type="date" value={format(endDate, 'yyyy-MM-dd')} onChange={e => { setPreset('custom'); setEndDate(new Date(e.target.value)); }} className="pl-4 pr-10 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-shadow appearance-none cursor-pointer outline-none hover:border-slate-300 shadow-sm [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer" />
              <svg className="w-5 h-5 text-slate-400 absolute right-3 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </div>
          </div>
          <button onClick={exportCSV} className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors flex items-center gap-2"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>Export CSV</button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {[
            { label: 'Total Revenue', value: `₹${summary.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, color: 'text-emerald-600' },
            { label: 'Total Expenses', value: `₹${summary.expenses.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, color: 'text-rose-600' },
            { label: 'Net Profit', value: `₹${summary.profit.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, color: summary.profit >= 0 ? 'text-indigo-600' : 'text-red-600' },
            { label: 'Total Patients', value: String(summary.patients), color: 'text-slate-700' },
            { label: 'Avg / Patient', value: `₹${summary.avgPerPatient.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, color: 'text-teal-600' },
          ].map(c => (
            <div key={c.label} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 text-center">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-1">{c.label}</p>
              <p className={`text-xl font-semibold ${c.color}`}>{c.value}</p>
            </div>
          ))}
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Daily Revenue */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">Daily Revenue</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.9}/>
                      <stop offset="95%" stopColor="#818cf8" stopOpacity={0.4}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 500 }} axisLine={false} tickLine={false} dy={10} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 500 }} tickFormatter={v => `₹${v}`} axisLine={false} tickLine={false} dx={-10} />
                  <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.05)', fontWeight: 500, color: '#334155' }} formatter={(v: any) => [`₹${Number(v).toLocaleString()}`, 'Revenue']} />
                  <Bar dataKey="revenue" fill="url(#colorRev)" radius={[6, 6, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Payment Method Breakdown */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">Payment Method Breakdown</h3>
            <div className="h-64 flex items-center">
              {paymentData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={paymentData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value" stroke="none">
                      {paymentData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <RechartsTooltip contentStyle={{ borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.05)', fontWeight: 500 }} formatter={(v: any) => `₹${Number(v).toLocaleString()}`} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 500, color: '#64748b' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-slate-400 text-center w-full">No payment data</p>}
            </div>
          </div>

          {/* Monthly Revenue vs Expenses */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">Monthly Revenue vs Expenses</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorMonthlyRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.9}/>
                      <stop offset="95%" stopColor="#34d399" stopOpacity={0.4}/>
                    </linearGradient>
                    <linearGradient id="colorMonthlyExp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.9}/>
                      <stop offset="95%" stopColor="#fb7185" stopOpacity={0.4}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 500 }} axisLine={false} tickLine={false} dy={10} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 500 }} tickFormatter={v => `₹${v}`} axisLine={false} tickLine={false} dx={-10} />
                  <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.05)', fontWeight: 500 }} />
                  <Bar dataKey="revenue" fill="url(#colorMonthlyRev)" radius={[6, 6, 0, 0]} name="Revenue" maxBarSize={40} />
                  <Bar dataKey="expenses" fill="url(#colorMonthlyExp)" radius={[6, 6, 0, 0]} name="Expenses" maxBarSize={40} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Patient Visit Trends */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">Patient Visit Trends</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={visitData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorVisits" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 500 }} axisLine={false} tickLine={false} dy={10} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 500 }} allowDecimals={false} axisLine={false} tickLine={false} dx={-10} />
                  <RechartsTooltip cursor={{ fill: '#f8fafc', strokeWidth: 2, strokeDasharray: '4 4' }} contentStyle={{ borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.05)', fontWeight: 500 }} />
                  <Line type="monotone" dataKey="visits" stroke="#0ea5e9" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6, strokeWidth: 0, fill: '#0ea5e9' }} name="Visits" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Second Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Treatment Frequency */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">Top Treatments by Frequency</h3>
            <div className="h-64">
              {treatmentFrequency.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={treatmentFrequency} margin={{ top: 0, right: 20, left: 20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorFreq" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.9}/>
                        <stop offset="95%" stopColor="#a78bfa" stopOpacity={0.7}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 4" horizontal={true} vertical={false} stroke="#f1f5f9" />
                    <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 500 }} allowDecimals={false} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }} width={120} axisLine={false} tickLine={false} />
                    <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.05)', fontWeight: 500 }} formatter={(v: any) => [v, 'Prescriptions']} />
                    <Bar dataKey="count" fill="url(#colorFreq)" radius={[0, 6, 6, 0]} maxBarSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-slate-400 text-center mt-20">No treatment data</p>}
            </div>
          </div>

          {/* Patient Age Groups */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">Patient Age Groups</h3>
            <div className="h-64">
              {ageGroups.age.some(a => a.value > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={ageGroups.age} cx="50%" cy="50%" innerRadius={40} outerRadius={85} paddingAngle={3} dataKey="value" nameKey="name" stroke="none" labelLine={false} label={(props: any) => (props.percent && props.percent > 0.05) ? `${props.name}` : ''}>
                      {ageGroups.age.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <RechartsTooltip contentStyle={{ borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.05)', fontWeight: 500 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-slate-400 text-center mt-20">No patient data</p>}
            </div>
          </div>

          {/* Day of Week */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">Revenue by Day of Week</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dayOfWeekData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorDow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.9}/>
                      <stop offset="95%" stopColor="#fbbf24" stopOpacity={0.4}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 500 }} axisLine={false} tickLine={false} dy={10} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 500 }} tickFormatter={v => `₹${v}`} axisLine={false} tickLine={false} dx={-10} />
                  <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.05)', fontWeight: 500 }} formatter={(v: any) => [`₹${Number(v).toLocaleString()}`, 'Revenue']} />
                  <Bar dataKey="revenue" fill="url(#colorDow)" radius={[6, 6, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Weekly Summary Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100"><h3 className="font-semibold text-slate-800">Weekly Summary</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-slate-100 bg-slate-50/50">{['Week', 'Revenue', 'Expenses', 'Profit', 'Patients', 'Invoices'].map(h => <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">{h}</th>)}</tr></thead>
              <tbody>
                {weeklySummary.length === 0 ? <tr><td colSpan={6} className="text-center py-12 text-slate-400">No data for selected period</td></tr> :
                  weeklySummary.map(w => (
                    <tr key={w.week} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="px-6 py-4 text-sm font-medium text-slate-800">{w.week}</td>
                      <td className="px-6 py-4 text-sm text-emerald-600">₹{w.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                      <td className="px-6 py-4 text-sm text-rose-600">₹{w.expenses.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                      <td className={`px-6 py-4 text-sm font-medium ${w.profit >= 0 ? 'text-slate-800' : 'text-red-600'}`}>₹{w.profit.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{w.patients}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{w.invoices}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
