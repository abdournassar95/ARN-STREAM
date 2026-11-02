import React from 'react';

export function MediaGridSkeleton({ count = 12, isSquare = false, cardMinSize = 180 }) {
  return (
    <div
      className="grid gap-4 sm:gap-5 animate-fadeIn"
      style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${cardMinSize}px), 1fr))` }}
      aria-busy="true"
    >
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="rounded-2xl overflow-hidden bg-white/60 dark:bg-surface/50 border border-slate-200/60 dark:border-white/10 p-2.5 shadow-sm"
        >
          <div className={`${isSquare ? 'aspect-square' : 'aspect-[2/3]'} w-full rounded-xl arn-skeleton`} />
          <div className="mt-3 space-y-2 px-1">
            <div className="h-3.5 w-3/4 mx-auto rounded-md arn-skeleton" />
            <div className="h-2.5 w-1/2 mx-auto rounded-md arn-skeleton opacity-70" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function LoadingSpinner() {
  return (
    <div className="min-h-screen bg-bg text-text px-4 sm:px-6 md:px-10 py-6 space-y-8 animate-fadeIn" aria-busy="true">
      {/* Top header shimmer */}
      <div className="flex items-center justify-between gap-4">
        <div className="h-10 w-44 rounded-2xl arn-skeleton border border-white/5" />
        <div className="hidden md:flex items-center gap-3 flex-1 max-w-xl">
          <div className="h-10 w-full rounded-2xl arn-skeleton border border-white/5" />
        </div>
        <div className="flex items-center gap-2.5">
          <div className="h-10 w-10 rounded-full arn-skeleton border border-white/5" />
          <div className="h-10 w-10 rounded-full arn-skeleton border border-white/5" />
        </div>
      </div>

      {/* Hero banner shimmer */}
      <div className="h-44 sm:h-56 w-full rounded-3xl arn-skeleton border border-slate-200/50 dark:border-white/10" />

      {/* Grid cards shimmer */}
      <MediaGridSkeleton count={12} />
    </div>
  );
}
