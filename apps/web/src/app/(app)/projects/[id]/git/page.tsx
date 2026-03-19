'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useGitStore } from '@/stores/git.store'
import { useProjectStore } from '@/stores/project.store'
import { formatDate } from '@/lib/utils'
import type { GitFileChange } from '@axy/shared'

const FILE_STATUS_CONFIG: Record<GitFileChange['status'], { letter: string; color: string }> = {
  added: { letter: 'A', color: 'text-green-400' },
  modified: { letter: 'M', color: 'text-yellow-400' },
  deleted: { letter: 'D', color: 'text-red-400' },
  renamed: { letter: 'R', color: 'text-blue-400' },
}

function FileList({
  files,
  emptyText,
  actionLabel,
  onAction,
}: {
  files: GitFileChange[]
  emptyText: string
  actionLabel?: string
  onAction?: (path: string) => void
}) {
  if (files.length === 0) {
    return <p className="text-sm text-[var(--muted-foreground)]">{emptyText}</p>
  }
  return (
    <ul className="space-y-0.5">
      {files.map((file) => {
        const cfg = FILE_STATUS_CONFIG[file.status]
        return (
          <li key={file.path} className="group flex items-center gap-2 rounded px-1 py-0.5 font-mono text-sm text-[var(--foreground)] hover:bg-[var(--secondary)]">
            <span className={`w-4 text-center text-xs font-bold ${cfg.color}`}>{cfg.letter}</span>
            <span className="min-w-0 flex-1 truncate">{file.path}</span>
            {onAction && (
              <button
                onClick={() => onAction(file.path)}
                className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium text-[var(--muted-foreground)] opacity-0 transition-opacity hover:bg-[var(--accent)] hover:text-[var(--foreground)] group-hover:opacity-100"
              >
                {actionLabel}
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function DiffViewer({ diff }: { diff: string }) {
  if (!diff) {
    return <p className="text-sm text-[var(--muted-foreground)]">No diff available</p>
  }
  const lines = diff.split('\n')
  return (
    <pre className="max-h-[500px] overflow-auto rounded-lg bg-[var(--secondary)] p-4 font-mono text-xs leading-relaxed">
      {lines.map((line, i) => {
        let color = 'text-[var(--muted-foreground)]'
        if (line.startsWith('+') && !line.startsWith('+++')) color = 'text-green-400'
        else if (line.startsWith('-') && !line.startsWith('---')) color = 'text-red-400'
        else if (line.startsWith('@@')) color = 'text-blue-400'
        else if (line.startsWith('diff ') || line.startsWith('index ')) color = 'text-[var(--muted-foreground)]/60'
        return <div key={i} className={color}>{line}</div>
      })}
    </pre>
  )
}

export default function ProjectGitPage() {
  const params = useParams()
  const projectId = params.id as string

  const {
    status, branches, log, diff,
    isLoading, isCommitting, isPushing, isPulling, isCheckingOut,
    isCreatingPr, isMergingPr, lastPr, checkoutMessage,
    error, fetchAll, commit, push, pull, checkout, createPr, mergePr,
    stage, unstage, stageAll, discard, linkRepo, createBranch, generateMessage,
    fetchDiff, clearError,
  } = useGitStore()

  const currentProject = useProjectStore((s) => s.currentProject)
  const fetchProject = useProjectStore((s) => s.fetchProject)
  const hasRemote = status?.hasRemote ?? false

  const [linkRepoUrl, setLinkRepoUrl] = useState(currentProject?.githubRepoUrl || '')
  const [isLinking, setIsLinking] = useState(false)
  const [commitMessage, setCommitMessage] = useState('')
  const [showStagedDiff, setShowStagedDiff] = useState(false)
  const [showPrDialog, setShowPrDialog] = useState(false)
  const [prTitle, setPrTitle] = useState('')
  const [prBody, setPrBody] = useState('')
  const [prBaseBranch, setPrBaseBranch] = useState('main')
  const [checkoutBranch, setCheckoutBranch] = useState<string | null>(null)
  const [newBranchName, setNewBranchName] = useState('')
  const [showNewBranch, setShowNewBranch] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [showBranchDropdown, setShowBranchDropdown] = useState(false)

  useEffect(() => { fetchAll(projectId) }, [projectId, fetchAll])

  const handleCommit = useCallback(async () => {
    if (!commitMessage.trim()) return
    try {
      await commit(projectId, commitMessage.trim())
      setCommitMessage('')
    } catch { /* error in store */ }
  }, [projectId, commitMessage, commit])

  const handlePush = useCallback(async () => {
    try { await push(projectId) } catch { /* error in store */ }
  }, [projectId, push])

  const handlePull = useCallback(async () => {
    try { await pull(projectId) } catch { /* error in store */ }
  }, [projectId, pull])

  const handleCheckout = useCallback(async () => {
    if (!checkoutBranch) return
    try {
      await checkout(projectId, checkoutBranch)
      setCheckoutBranch(null)
    } catch { /* error in store */ }
  }, [projectId, checkoutBranch, checkout])

  const handleCreatePr = useCallback(async () => {
    if (!prTitle.trim()) return
    try {
      await createPr(projectId, { title: prTitle.trim(), body: prBody.trim() || undefined, baseBranch: prBaseBranch })
    } catch { /* error in store */ }
  }, [projectId, prTitle, prBody, prBaseBranch, createPr])

  const handleMergePr = useCallback(async () => {
    if (!lastPr) return
    try {
      await mergePr(projectId, lastPr.number, 'squash')
      setShowPrDialog(false)
      setPrTitle('')
      setPrBody('')
    } catch { /* error in store */ }
  }, [projectId, lastPr, mergePr])

  const handleCreateBranch = useCallback(async () => {
    if (!newBranchName.trim()) return
    try {
      await createBranch(projectId, newBranchName.trim())
      setNewBranchName('')
      setShowNewBranch(false)
    } catch { /* error in store */ }
  }, [projectId, newBranchName, createBranch])

  const handleStageFile = useCallback(async (path: string) => {
    await stage(projectId, [path])
  }, [projectId, stage])

  const handleUnstageFile = useCallback(async (path: string) => {
    await unstage(projectId, [path])
  }, [projectId, unstage])

  const handleStageAll = useCallback(async () => {
    await stageAll(projectId)
  }, [projectId, stageAll])

  const handleDiscardFile = useCallback(async (path: string) => {
    await discard(projectId, path)
  }, [projectId, discard])

  const handleDiscardAll = useCallback(async () => {
    await discard(projectId)
  }, [projectId, discard])

  const handleLinkRepo = useCallback(async () => {
    if (!linkRepoUrl.trim()) return
    setIsLinking(true)
    try {
      await linkRepo(projectId, linkRepoUrl.trim())
      setLinkRepoUrl('')
      await fetchProject(projectId)
    } catch { /* error in store */ }
    finally { setIsLinking(false) }
  }, [projectId, linkRepoUrl, linkRepo, fetchProject])

  const handleGenerateMessage = useCallback(async () => {
    setIsGenerating(true)
    try {
      const msg = await generateMessage(projectId)
      if (msg) setCommitMessage(msg)
    } finally {
      setIsGenerating(false)
    }
  }, [projectId, generateMessage])

  const handleToggleDiffType = useCallback((staged: boolean) => {
    setShowStagedDiff(staged)
    fetchDiff(projectId, staged)
  }, [projectId, fetchDiff])

  if (isLoading && !status) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="animate-pulse rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="h-4 w-40 rounded bg-[var(--secondary)]" />
            <div className="mt-3 h-3 w-64 rounded bg-[var(--secondary)]" />
          </div>
        ))}
      </div>
    )
  }

  const totalChanges = (status?.staged.length || 0) + (status?.unstaged.length || 0) + (status?.untracked.length || 0)

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Git</h2>
          <p className="mt-0.5 text-sm text-[var(--muted-foreground)]">Source control for this project</p>
        </div>
        <button onClick={() => fetchAll(projectId)} disabled={isLoading}
          className="rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--secondary)] disabled:opacity-50">
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-lg border border-[var(--destructive)]/50 bg-[var(--destructive)]/10 px-4 py-3">
          <span className="text-sm text-[var(--destructive)]">{error}</span>
          <button onClick={clearError} className="ml-3 text-xs text-[var(--destructive)] underline hover:no-underline">Dismiss</button>
        </div>
      )}

      {/* Link GitHub repo banner */}
      {!hasRemote && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-yellow-400">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.102 1.101" />
            </svg>
            No GitHub repository linked
          </div>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            Link a GitHub repo to enable Push, Pull, and Pull Requests.
          </p>
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              placeholder="https://github.com/owner/repo.git"
              value={linkRepoUrl}
              onChange={(e) => setLinkRepoUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleLinkRepo() }}
              className="flex-1 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 font-mono text-sm placeholder:text-[var(--muted-foreground)]/50 outline-none focus:border-[var(--primary)]"
            />
            <button
              onClick={handleLinkRepo}
              disabled={isLinking || !linkRepoUrl.trim()}
              className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {isLinking ? 'Linking...' : 'Link & Push'}
            </button>
          </div>
        </div>
      )}

      {checkoutMessage && (
        <div className="flex items-center justify-between rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-3">
          <span className="text-sm text-blue-400">{checkoutMessage}</span>
          <button onClick={clearError} className="ml-3 text-xs text-blue-400 underline hover:no-underline">Dismiss</button>
        </div>
      )}

      {/* Branch & Actions bar */}
      {status && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
          {/* Branch selector dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowBranchDropdown(!showBranchDropdown)}
              className="inline-flex items-center gap-2 rounded-md bg-[var(--primary)]/15 px-3 py-1.5 font-mono text-sm font-medium text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/25"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              {status.branch}
              <svg className={`h-3 w-3 transition-transform ${showBranchDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showBranchDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowBranchDropdown(false)} />
                <div className="absolute left-0 top-full z-50 mt-1 max-h-64 w-64 overflow-auto rounded-lg border border-[var(--border)] bg-[var(--card)] py-1 shadow-xl">
                  {branches.filter((b) => !b.startsWith('remotes/')).map((branch) => {
                    const isCurrent = branch === status.branch
                    return (
                      <button
                        key={branch}
                        disabled={isCurrent || isCheckingOut}
                        onClick={() => {
                          setShowBranchDropdown(false)
                          if (!isCurrent) setCheckoutBranch(branch)
                        }}
                        className={`flex w-full items-center gap-2 px-3 py-1.5 text-left font-mono text-xs transition-colors ${
                          isCurrent
                            ? 'bg-[var(--primary)]/10 font-semibold text-[var(--primary)]'
                            : 'text-[var(--foreground)] hover:bg-[var(--secondary)]'
                        } disabled:opacity-60`}
                      >
                        {isCurrent && (
                          <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                        {!isCurrent && <span className="w-3" />}
                        <span className="truncate">{branch}</span>
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>

          {status.ahead > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-[11px] font-medium text-green-400">
              {status.ahead} ahead
            </span>
          )}
          {status.behind > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/15 px-2 py-0.5 text-[11px] font-medium text-yellow-400">
              {status.behind} behind
            </span>
          )}

          <div className="flex-1" />

          <button onClick={() => setShowNewBranch(!showNewBranch)}
            className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--secondary)]">
            + Branch
          </button>

          <button onClick={() => { setShowPrDialog(true); setPrTitle(status.branch !== 'main' ? `Merge ${status.branch} into ${prBaseBranch}` : ''); }}
            disabled={!hasRemote}
            title={!hasRemote ? 'Link a GitHub repo first' : undefined}
            className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--secondary)] disabled:opacity-40">
            Create PR
          </button>

          <button onClick={handlePull} disabled={isPulling || !hasRemote}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--secondary)] disabled:opacity-50">
            {isPulling ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" /> : null}
            Pull
          </button>
          <button onClick={handlePush} disabled={isPushing || !hasRemote}
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50">
            {isPushing ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" /> : null}
            Push
          </button>
        </div>
      )}

      {/* New branch input */}
      {showNewBranch && (
        <div className="flex gap-2 rounded-lg border border-[var(--primary)]/30 bg-[var(--primary)]/5 p-3">
          <input type="text" placeholder="new-branch-name" value={newBranchName}
            onChange={(e) => setNewBranchName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreateBranch() }}
            className="flex-1 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 font-mono text-sm outline-none focus:border-[var(--primary)]" />
          <button onClick={handleCreateBranch} disabled={isCheckingOut || !newBranchName.trim()}
            className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {isCheckingOut ? 'Creating...' : 'Create & Switch'}
          </button>
          <button onClick={() => { setShowNewBranch(false); setNewBranchName('') }}
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--secondary)]">
            Cancel
          </button>
        </div>
      )}

      {/* Commit section */}
      {status && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium">Commit</h3>
            <div className="flex items-center gap-2">
              {totalChanges > 0 && status.staged.length === 0 && (
                <button onClick={handleStageAll}
                  className="rounded-md border border-[var(--border)] px-2.5 py-1 text-[11px] font-medium transition-colors hover:bg-[var(--secondary)]">
                  Stage All
                </button>
              )}
              <button onClick={handleGenerateMessage} disabled={isGenerating || totalChanges === 0}
                className="rounded-md border border-[var(--border)] px-2.5 py-1 text-[11px] font-medium transition-colors hover:bg-[var(--secondary)] disabled:opacity-50"
                title="Auto-generate commit message from changes">
                {isGenerating ? 'Generating...' : 'Auto Message'}
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <input type="text" placeholder="Commit message..." value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleCommit() } }}
              className="flex-1 rounded-md border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]" />
            <button onClick={handleCommit} disabled={isCommitting || !commitMessage.trim() || status.staged.length === 0}
              className="inline-flex items-center gap-1.5 rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
              {isCommitting && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
              Commit
            </button>
          </div>
          {status.staged.length === 0 && totalChanges > 0 && (
            <p className="mt-2 text-[11px] text-[var(--muted-foreground)]">
              No staged changes. Click "Stage All" or stage individual files below.
            </p>
          )}
        </div>
      )}

      {/* Staged / Unstaged / Untracked files */}
      {status && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-medium">
              Staged Changes
              <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-medium text-green-400">{status.staged.length}</span>
            </h3>
            <FileList files={status.staged} emptyText="No staged changes" actionLabel="Unstage" onAction={handleUnstageFile} />
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-medium">
                Unstaged Changes
                <span className="rounded-full bg-yellow-500/15 px-2 py-0.5 text-[10px] font-medium text-yellow-400">{status.unstaged.length}</span>
              </h3>
              {status.unstaged.length > 0 && (
                <button onClick={handleDiscardAll}
                  className="rounded-md border border-red-500/30 px-2 py-0.5 text-[10px] font-medium text-red-400 transition-colors hover:bg-red-500/10">
                  Discard All
                </button>
              )}
            </div>
            {status.unstaged.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">No unstaged changes</p>
            ) : (
              <ul className="space-y-0.5">
                {status.unstaged.map((file) => {
                  const cfg = FILE_STATUS_CONFIG[file.status]
                  return (
                    <li key={file.path} className="group flex items-center gap-2 rounded px-1 py-0.5 font-mono text-sm text-[var(--foreground)] hover:bg-[var(--secondary)]">
                      <span className={`w-4 text-center text-xs font-bold ${cfg.color}`}>{cfg.letter}</span>
                      <span className="min-w-0 flex-1 truncate">{file.path}</span>
                      <button onClick={() => handleStageFile(file.path)}
                        className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium text-[var(--muted-foreground)] opacity-0 transition-opacity hover:bg-[var(--accent)] hover:text-[var(--foreground)] group-hover:opacity-100">
                        Stage
                      </button>
                      <button onClick={() => handleDiscardFile(file.path)}
                        className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium text-red-400 opacity-0 transition-opacity hover:bg-red-500/10 group-hover:opacity-100">
                        Discard
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {status.untracked.length > 0 && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 lg:col-span-2">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-medium">
                Untracked Files
                <span className="rounded-full bg-[var(--muted)]/40 px-2 py-0.5 text-[10px] font-medium text-[var(--muted-foreground)]">{status.untracked.length}</span>
              </h3>
              <ul className="space-y-0.5">
                {status.untracked.map((filePath) => (
                  <li key={filePath} className="group flex items-center gap-2 rounded px-1 py-0.5 font-mono text-sm hover:bg-[var(--secondary)]">
                    <span className="w-4 text-center text-xs font-bold text-[var(--muted-foreground)]">?</span>
                    <span className="min-w-0 flex-1 truncate">{filePath}</span>
                    <button onClick={() => handleStageFile(filePath)}
                      className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium text-[var(--muted-foreground)] opacity-0 transition-opacity hover:bg-[var(--accent)] hover:text-[var(--foreground)] group-hover:opacity-100">
                      Stage
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Branches */}
      {branches.length > 0 && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-medium">
            Branches
            <span className="rounded-full bg-[var(--secondary)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted-foreground)]">{branches.length}</span>
          </h3>
          <div className="flex flex-wrap gap-2">
            {branches.map((branch) => {
              const isCurrent = branch === status?.branch
              return isCurrent ? (
                <span key={branch}
                  className="inline-flex items-center gap-1.5 rounded-md bg-[var(--primary)]/15 px-2.5 py-1 font-mono text-xs font-semibold text-[var(--primary)] ring-1 ring-[var(--primary)]/30">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {branch}
                </span>
              ) : (
                <button key={branch} onClick={() => setCheckoutBranch(branch)} disabled={isCheckingOut}
                  className="rounded-md bg-[var(--secondary)] px-2.5 py-1 font-mono text-xs text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-50">
                  {branch}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Checkout dialog */}
      {checkoutBranch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => !isCheckingOut && setCheckoutBranch(null)}>
          <div className="mx-4 w-full max-w-sm rounded-lg border border-[var(--border)] bg-[var(--card)] p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-sm font-semibold">Switch Branch</h4>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              Switch to <span className="font-mono font-semibold text-[var(--foreground)]">{checkoutBranch}</span>?
            </p>
            {status && (status.staged.length > 0 || status.unstaged.length > 0) && (
              <p className="mt-2 text-[11px] text-yellow-400">Uncommitted changes will be carried to the new branch.</p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setCheckoutBranch(null)} disabled={isCheckingOut}
                className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--secondary)] disabled:opacity-50">Cancel</button>
              <button onClick={handleCheckout} disabled={isCheckingOut}
                className="rounded-md bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50">
                {isCheckingOut ? 'Switching...' : 'Switch'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create PR dialog */}
      {showPrDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => !isCreatingPr && !isMergingPr && setShowPrDialog(false)}>
          <div className="mx-4 w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--card)] p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-sm font-semibold">Create Pull Request</h4>
            <p className="mt-2 text-xs text-[var(--muted-foreground)]">
              From <span className="font-mono font-semibold text-[var(--primary)]">{status?.branch}</span> into:
            </p>
            <select
              value={prBaseBranch}
              onChange={(e) => setPrBaseBranch(e.target.value)}
              className="mt-2 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 font-mono text-sm outline-none focus:border-[var(--primary)]"
            >
              {branches.filter((b) => !b.startsWith('remotes/') && b !== status?.branch).map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            {!lastPr && (
              <>
                <input
                  type="text" placeholder="PR title" value={prTitle}
                  onChange={(e) => setPrTitle(e.target.value)}
                  className="mt-3 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                />
                <textarea
                  placeholder="Description (optional)" value={prBody}
                  onChange={(e) => setPrBody(e.target.value)} rows={3}
                  className="mt-2 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] resize-none"
                />
              </>
            )}
            {lastPr && (
              <div className="mt-3 rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2">
                <p className="text-xs font-medium text-green-400">PR #{lastPr.number} created</p>
                <a href={lastPr.url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-[var(--primary)] underline">{lastPr.url}</a>
              </div>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => { setShowPrDialog(false); setPrTitle(''); setPrBody('') }}
                className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--secondary)]">
                {lastPr ? 'Close' : 'Cancel'}
              </button>
              {!lastPr ? (
                <button onClick={handleCreatePr} disabled={isCreatingPr || !prTitle.trim()}
                  className="rounded-md bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50">
                  {isCreatingPr ? 'Creating...' : 'Create PR'}
                </button>
              ) : (
                <button onClick={handleMergePr} disabled={isMergingPr}
                  className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50">
                  {isMergingPr ? 'Merging...' : 'Merge PR on GitHub'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Commit log */}
      {log.length > 0 && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
          <h3 className="mb-3 text-sm font-medium">Recent Commits</h3>
          <div className="space-y-0">
            {log.map((entry, i) => (
              <div key={entry.hash} className={`flex items-start gap-3 py-2.5 ${i < log.length - 1 ? 'border-b border-[var(--border)]' : ''}`}>
                <span className="shrink-0 rounded bg-[var(--secondary)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--primary)]">{entry.hash.slice(0, 7)}</span>
                <span className="min-w-0 flex-1 truncate text-sm">{entry.message}</span>
                <div className="hidden shrink-0 text-right text-[11px] text-[var(--muted-foreground)] sm:block">
                  <div>{entry.author}</div>
                  <div>{formatDate(entry.date)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Diff viewer */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium">Diff</h3>
          <div className="flex overflow-hidden rounded-md border border-[var(--border)]">
            <button onClick={() => handleToggleDiffType(false)}
              className={`px-3 py-1 text-[11px] font-medium transition-colors ${!showStagedDiff ? 'bg-[var(--primary)]/15 text-[var(--primary)]' : 'text-[var(--muted-foreground)] hover:bg-[var(--secondary)]'}`}>
              Working
            </button>
            <button onClick={() => handleToggleDiffType(true)}
              className={`px-3 py-1 text-[11px] font-medium transition-colors ${showStagedDiff ? 'bg-[var(--primary)]/15 text-[var(--primary)]' : 'text-[var(--muted-foreground)] hover:bg-[var(--secondary)]'}`}>
              Staged
            </button>
          </div>
        </div>
        <DiffViewer diff={diff} />
      </div>
    </div>
  )
}
