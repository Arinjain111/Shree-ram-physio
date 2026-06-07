import type { DatabaseInvoice } from '@/types/database.types';

type Invoice = DatabaseInvoice;

export const COLORS = [
  { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-500' },
  { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500' },
  { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
  { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-500' },
];

const TreatmentCalendar = ({ treatments }: { treatments: Invoice['treatments'] }) => {
  const dates = treatments.flatMap(t => [new Date(t.startDate), new Date(t.endDate)]);
  if (dates.length === 0) return null;
  
  const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
  
  const months = [];
  const current = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  const end = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
  
  while (current <= end) {
    months.push(new Date(current));
    current.setMonth(current.getMonth() + 1);
  }

  const isDateInTreatment = (date: Date, treatment: any) => {
    const start = new Date(treatment.startDate);
    start.setHours(0,0,0,0);
    const end = new Date(treatment.endDate);
    end.setHours(23,59,59,999);
    return date >= start && date <= end;
  };

  return (
    <div className="relative">
      <div className="flex overflow-x-auto gap-4 pb-4 custom-scrollbar snap-x">
        {months.map(monthDate => (
          <div key={monthDate.toISOString()} className="min-w-[280px] bg-slate-50/50 rounded-3xl p-5 border border-slate-200/50 snap-start shrink-0">
            <div className="font-bold text-slate-700 text-sm mb-4 tracking-wide text-center uppercase">
              {monthDate.toLocaleDateString('default', { month: 'long', year: 'numeric' })}
            </div>
            
            <div className="grid grid-cols-7 gap-y-3 gap-x-1">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <div key={`${d}-${i}`} className="text-center text-[10px] font-bold text-slate-400">
                  {d}
                </div>
              ))}
              
              {Array.from({ length: new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).getDay() }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              
              {Array.from({ length: new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate() }).map((_, i) => {
                const day = i + 1;
                const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
                const activeTreatments = treatments.map((t, idx) => ({ ...t, color: COLORS[idx % COLORS.length] }))
                  .filter(t => isDateInTreatment(date, t));
                
                return (
                  <div 
                    key={day} 
                    className="aspect-square relative flex items-center justify-center group cursor-default"
                    title={activeTreatments.map(t => t.name).join(', ')}
                  >
                    {/* Background Pill for active treatments */}
                    {activeTreatments.length === 1 && (
                      <div className={`absolute inset-0 rounded-full opacity-40 ${activeTreatments[0].color.bg}`} />
                    )}
                    {activeTreatments.length > 1 && (
                      <div className="absolute inset-0 rounded-full bg-slate-200/80" />
                    )}

                    {/* Date Number */}
                    <span className={`z-10 text-sm ${activeTreatments.length > 0 ? 'font-bold text-slate-800' : 'font-medium text-slate-400 hover:text-slate-800 transition-colors'}`}>
                      {day}
                    </span>
                    
                    {/* Tiny Dots below the number */}
                    {activeTreatments.length > 0 && (
                      <div className="absolute bottom-1.5 left-1/2 transform -translate-x-1/2 flex gap-0.5">
                        {activeTreatments.map((t, idx) => (
                          <div key={idx} className={`w-1 h-1 rounded-full ${t.color.dot}`} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TreatmentCalendar;
