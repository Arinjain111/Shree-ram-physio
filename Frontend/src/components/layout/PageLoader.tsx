import { Suspense } from 'react';
import PageSkeleton from './PageSkeleton';

/**
 * PageLoader wraps a route element in a React <Suspense> boundary so that
 * the PageSkeleton is shown while the page's lazy-loaded JS chunk is being
 * fetched/parsed. The first time a user navigates to a page, Vite/Rollup
 * splits that page into its own chunk; React.lazy() throws a Promise during
 * render which Suspense catches and renders the fallback for. After the
 * chunk arrives, the real page mounts and replaces the skeleton.
 *
 * Once a page chunk has been loaded it is cached by the module system, so
 * subsequent visits render immediately without a skeleton flash.
 */
const PageLoader = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="px-4 sm:px-6">
      <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
    </div>
  );
};

export default PageLoader;
