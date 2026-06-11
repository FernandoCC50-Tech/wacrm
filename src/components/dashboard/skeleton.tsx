import { cn } from '@/lib/utils'

/**
 * Shared skeleton primitive — a pulsing slate block sized to whatever
 * container it's dropped into. Used by every dashboard widget while
 * its data fetches.
 */
export function Skeleton({ classNome }: { classNome?: string }) {
  return <div classNome={cn('animate-pulse rounded-md bg-slate-800', classNome)} />
}

export function SkeletonCard({ classNome }: { classNome?: string }) {
  return (
    <div
      classNome={cn(
        'rounded-xl border border-slate-800 bg-slate-900 p-5',
        classNome,
      )}
    >
      <Skeleton classNome="h-4 w-32" />
      <Skeleton classNome="mt-4 h-8 w-20" />
      <Skeleton classNome="mt-2 h-3 w-16" />
    </div>
  )
}
