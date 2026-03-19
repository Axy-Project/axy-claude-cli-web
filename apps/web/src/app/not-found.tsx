import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="rounded-full bg-[var(--muted)] p-4">
        <svg
          className="h-8 w-8 text-[var(--muted-foreground)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
          />
        </svg>
      </div>
      <h1 className="text-2xl font-semibold text-[var(--foreground)]">Page not found</h1>
      <p className="max-w-md text-sm text-[var(--muted-foreground)]">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        href="/dashboard"
        className="mt-2 rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
      >
        Back to dashboard
      </Link>
    </div>
  )
}
