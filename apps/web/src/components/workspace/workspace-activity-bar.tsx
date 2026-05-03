'use client'

export type ActivityView = 'files' | 'chat' | 'search' | 'git' | 'tasks'

interface ActivityItem {
  id: ActivityView
  label: string
  icon: React.ReactNode
}

const ITEMS: ActivityItem[] = [
  {
    id: 'files',
    label: 'Explorer',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
      </svg>
    ),
  },
  {
    id: 'chat',
    label: 'Chats',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
  {
    id: 'search',
    label: 'Search',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
      </svg>
    ),
  },
  {
    id: 'git',
    label: 'Source Control',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 3v12m0 0a3 3 0 103 3H6m0-3h12a3 3 0 013-3V6a3 3 0 00-3-3H9a3 3 0 00-3 3v6" />
      </svg>
    ),
  },
  {
    id: 'tasks',
    label: 'Tasks',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
]

export function WorkspaceActivityBar({
  active,
  onSelect,
  onTogglePanel,
  panelOpen,
}: {
  active: ActivityView
  onSelect: (view: ActivityView) => void
  onTogglePanel: () => void
  panelOpen: boolean
}) {
  return (
    <div className="flex h-full w-12 flex-col items-center gap-1 py-2">
      {ITEMS.map((item) => {
        const isActive = active === item.id && panelOpen
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              if (active === item.id && panelOpen) {
                onTogglePanel()
              } else {
                onSelect(item.id)
                if (!panelOpen) onTogglePanel()
              }
            }}
            className={`group relative flex h-9 w-9 items-center justify-center rounded-md transition-all ${
              isActive
                ? 'text-[var(--primary)]'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
            title={item.label}
          >
            {/* Active indicator bar */}
            {isActive && (
              <span className="absolute -left-2 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-[var(--primary)]" />
            )}
            {item.icon}
          </button>
        )
      })}
    </div>
  )
}
