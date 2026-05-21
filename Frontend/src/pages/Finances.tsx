import { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell
} from 'recharts';
import {
  subDays, subMonths, subYears, startOfDay, endOfDay, isWithinInterval,
  format, parseISO, isValid, differenceInDays
} from 'date-fns';
import { useUI } from '@/context/UIContext';
import PageHeader from '@/components/layout/PageHeader';
import { ChartBarIcon } from '@/components/icons';
import type { DatabaseInvoice } from '@/types/database.types';
import { ipcRenderer } from '@/lib/ipc';

// Color palette for charts
const COLORS = ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#84cc16'];

type DatePreset = '30days' | '3months' | '6months' | '1year' | 'custom';

interface Metrics {
  revenue: number;
  patients: number;
  invoices: number;
  avgRevenue: number;
}

export default function Finances() {
  const { showToast } = useUI();
  const [invoices, setInvoices] = useState<DatabaseInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Date Range State
  const [preset, setPreset] = useState<DatePreset>('30days');
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 30));
  const [endDate, setEndDate] = useState<Date>(new Date());

  useEffect(() => {
    const loadInvoices = async () => {
      try {
        setIsLoading(true);
        const result = await ipcRenderer.invoke('load-invoices');
        if (result.success) {
          setInvoices(result.invoices);
        }
      } catch (error) {
        console.error("Failed to load invoices", error);
        showToast('error', 'Failed to load invoices');
      } finally {
        setIsLoading(false);
      }
    };
    loadInvoices();
  }, []);

  const handlePresetChange = (newPreset: DatePreset) => {
    setPreset(newPreset);
    const end = new Date();
    let start = new Date();
    switch (newPreset) {
      case '30days': start = subDays(end, 30); break;
      case '3months': start = subMonths(end, 3); break;
      case '6months': start = subMonths(end, 6); break;
      case '1year': start = subYears(end, 1); break;
      case 'custom': return; // Let custom keep current dates
    }
    setStartDate(startOfDay(start));
    setEndDate(endOfDay(end));
  };

  // Processing Data
  const { currentMetrics, previousMetrics, chartData, treatmentData } = useMemo(() => {
    if (!invoices.length) {
      return {
        currentMetrics: { revenue: 0, patients: 0, invoices: 0, avgRevenue: 0 },
        previousMetrics: { revenue: 0, patients: 0, invoices: 0, avgRevenue: 0 },
        chartData: [],
        treatmentData: []
      };
    }

    const currentInterval = { start: startOfDay(startDate), end: endOfDay(endDate) };
    const daysDiff = differenceInDays(currentInterval.end, currentInterval.start) + 1;
    const previousInterval = {
      start: subDays(currentInterval.start, daysDiff),
      end: endOfDay(subDays(currentInterval.start, 1))
    };

    const currentInvoices: DatabaseInvoice[] = [];
    const previousInvoices: DatabaseInvoice[] = [];

    invoices.forEach(inv => {
      const date = parseISO(inv.date);
      if (!isValid(date)) return;

      if (isWithinInterval(date, currentInterval)) currentInvoices.push(inv);
      if (isWithinInterval(date, previousInterval)) previousInvoices.push(inv);
    });

    const calculateMetrics = (invs: DatabaseInvoice[]): Metrics => {
      const revenue = invs.reduce((sum, inv) => sum + (Number(inv.total) || 0), 0);
      const uniquePatients = new Set(invs.map(inv => inv.patient.id || `${inv.patient.firstName} ${inv.patient.lastName}`));
      return {
        revenue,
        patients: uniquePatients.size,
        invoices: invs.length,
        avgRevenue: invs.length ? revenue / invs.length : 0
      };
    };

    const currentM = calculateMetrics(currentInvoices);
    const previousM = calculateMetrics(previousInvoices);

    // Chart Data (Group by Day or Month depending on preset)
    const formatStr = preset === '30days' || preset === 'custom' && daysDiff <= 60 ? 'MMM dd' : 'MMM yyyy';
    
    // Sort invoices chronologically before grouping
    const sortedCurrent = [...currentInvoices].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const trendMap = new Map<string, number>();
    sortedCurrent.forEach(inv => {
      const date = parseISO(inv.date);
      if (isValid(date)) {
        const key = format(date, formatStr);
        trendMap.set(key, (trendMap.get(key) || 0) + Number(inv.total));
      }
    });
    const finalChartData = Array.from(trendMap.entries()).map(([date, revenue]) => ({ date, revenue }));

    // Treatment Breakdown
    const tMap = new Map<string, number>();
    currentInvoices.forEach(inv => {
      inv.treatments.forEach(t => {
        tMap.set(t.name, (tMap.get(t.name) || 0) + Number(t.amount));
      });
    });
    const tData = Array.from(tMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10) // top 10
      .reverse();

    return {
      currentMetrics: currentM,
      previousMetrics: previousM,
      chartData: finalChartData,
      treatmentData: tData
    };
  }, [invoices, startDate, endDate, preset]);

  const renderMetricCard = (title: string, current: number, previous: number, isCurrency: boolean = false) => {
    const diff = current - previous;
    const percentChange = previous === 0 ? (current > 0 ? 100 : 0) : (diff / previous) * 100;
    const isPositive = diff >= 0;
    const displayCurrent = isCurrency ? `₹${current.toLocaleString()}` : current.toLocaleString();
    
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50/50 px-6 pb-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading financial data...</p>
        </div>
      </div>
    );
  }

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

  return (
    <div className="min-h-screen bg-slate-50/50 px-6 pb-6">
      <div className="max-w-7xl mx-auto space-y-8">
        <PageHeader 
          title="Finances & Analytics"
          icon={<div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg"><ChartBarIcon /></div>}
        />

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
            <input 
              type="date" 
              value={format(startDate, 'yyyy-MM-dd')}
              onChange={e => {
                setPreset('custom');
                setStartDate(new Date(e.target.value));
              }}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500"
            />
            <span className="text-slate-400">to</span>
            <input 
              type="date" 
              value={format(endDate, 'yyyy-MM-dd')}
              onChange={e => {
                setPreset('custom');
                setEndDate(new Date(e.target.value));
              }}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {renderMetricCard("Total Revenue", currentMetrics.revenue, previousMetrics.revenue, true)}
          {renderMetricCard("Patients Treated", currentMetrics.patients, previousMetrics.patients, false)}
          {renderMetricCard("Invoices Generated", currentMetrics.invoices, previousMetrics.invoices, false)}
          {renderMetricCard("Avg. Invoice Value", currentMetrics.avgRevenue, previousMetrics.avgRevenue, true)}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-6">Revenue Trend</h3>
            <div className="h-75">
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
            <h3 className="text-lg font-bold text-slate-800 mb-6">Revenue by Treatment</h3>
            <div className="h-75">
              {treatmentData.length > 0 ? (
                 <ResponsiveContainer width="100%" height="100%">
                   <BarChart layout="vertical" data={treatmentData} margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                     <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                     <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                     <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} width={120} />
                     <RechartsTooltip 
                       cursor={{ fill: '#f1f5f9' }}
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
    </div>
  );
}
