const PageSkeleton = () => {
  return (
    <div className="w-full max-w-7xl mx-auto py-8 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-slate-200/60 rounded-xl"></div>
          <div className="space-y-3">
            <div className="h-4 w-24 bg-slate-200/60 rounded-md"></div>
            <div className="h-6 w-48 bg-slate-200/80 rounded-md"></div>
          </div>
        </div>
        <div className="flex gap-3">
          <div className="h-10 w-24 bg-slate-200/60 rounded-lg"></div>
          <div className="h-10 w-32 bg-slate-200/80 rounded-lg"></div>
        </div>
      </div>

      {/* Grid Content Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <div className="h-64 bg-slate-200/50 rounded-2xl border border-slate-100"></div>
          <div className="h-96 bg-slate-200/50 rounded-2xl border border-slate-100"></div>
        </div>
        <div className="lg:col-span-2 space-y-6">
          <div className="h-[calc(100vh-8rem)] min-h-[500px] bg-slate-200/40 rounded-2xl border border-slate-100"></div>
        </div>
      </div>
    </div>
  );
};

export default PageSkeleton;
