import type { DatabaseInvoice } from '@/types/database.types';

type Invoice = DatabaseInvoice;

const COLORS = [
  { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-500' },
  { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
  { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500' },
  { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-200', dot: 'bg-cyan-500' },
  { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-500' },
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
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {months.map(monthDate => (
          <div key={monthDate.toISOString()} className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 font-semibold text-center text-slate-700">
              {monthDate.toLocaleDateString('default', { month: 'long', year: 'numeric' })}
            </div>
            <div className="p-4 bg-white">
              <div className="grid grid-cols-7 gap-1 mb-2 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => <div key={d}>{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1">
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
                      className="aspect-square relative flex items-center justify-center text-sm rounded-lg hover:bg-slate-50 transition-colors group cursor-default"
                      title={activeTreatments.map(t => t.name).join(', ')}
                    >
                      <span className={`z-10 ${activeTreatments.length > 0 ? 'font-bold text-slate-800' : 'text-slate-500'}`}>{day}</span>
                      
                      {/* Background for single treatment */}
                      {activeTreatments.length === 1 && (
                        <div className={`absolute inset-0.5 rounded-lg opacity-20 ${activeTreatments[0].color.bg}`} />
                      )}

                      {/* Background for multiple treatments */}
                      {activeTreatments.length > 1 && (
                        <div className="absolute inset-0.5 rounded-lg bg-slate-100/80" />
                      )}

                      {/* Dots for treatments */}
                      {activeTreatments.length > 0 && (
                        <div className="absolute bottom-1.5 left-1/2 transform -translate-x-1/2 flex gap-1">
                          {activeTreatments.map((t, idx) => (
                            <div key={idx} className={`w-1.5 h-1.5 rounded-full ${t.color.dot}`} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {treatments.map((t, idx) => {
          const color = COLORS[idx % COLORS.length];
          return (
            <div key={idx} className={`flex flex-col gap-1 px-4 py-2 rounded-xl border ${color.bg} ${color.border}`}>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${color.dot}`} />
                <span className={`text-sm font-bold ${color.text}`}>{t.name}</span>
                <span className={`text-xs ${color.text} opacity-75`}>({t.sessions} sessions)</span>
              </div>
              <div className={`text-xs ${color.text} pl-4 opacity-90`}>
                {new Date(t.startDate).toLocaleDateString()} - {new Date(t.endDate).toLocaleDateString()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TreatmentCalendar;
