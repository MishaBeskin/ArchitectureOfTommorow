/** Fallback while the filtered list streams in: reserves the layout so nothing jumps. */
export function ProjectsSkeleton() {
  return (
    <div data-projects-skeleton className="flex flex-col gap-8">
      <p role="status" className="sr-only">
        Loading projects
      </p>
      <div aria-hidden="true" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-[4.5rem] animate-pulse rounded-lg bg-surface motion-reduce:animate-none" />
        ))}
      </div>
      <ul aria-hidden="true" className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i} className="flex flex-col gap-4">
            <div className="aspect-[4/3] animate-pulse rounded-xl bg-surface motion-reduce:animate-none" />
            <div className="h-5 w-2/3 animate-pulse rounded bg-surface motion-reduce:animate-none" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-surface motion-reduce:animate-none" />
          </li>
        ))}
      </ul>
    </div>
  );
}
