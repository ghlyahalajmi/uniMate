import { Skeleton } from '@/components/ui/primitives';

/** Skeletons matched to the real layout, so the page does not jump on arrival. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>
      <Skeleton className="h-8 w-52 mb-2" />
      <Skeleton className="h-4 w-72 mb-6" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[0, 1, 2, 3].map((i) => (<Skeleton key={i} className="h-[76px]" rounded="md" />))}
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-5">
          <Skeleton className="h-52" rounded="md" />
          <Skeleton className="h-64" rounded="md" />
        </div>
        <div className="space-y-5">
          <Skeleton className="h-40" rounded="md" />
          <Skeleton className="h-52" rounded="md" />
        </div>
      </div>
    </div>
  );
}
