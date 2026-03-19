'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api-client'

interface BudgetData {
  monthlyLimitUsd: number | null
  dailyLimitUsd: number | null
  alertThreshold: number
  currentMonthSpend: number
  currentDaySpend: number
  monthlyPercentUsed: number
  dailyPercentUsed: number
}

function progressColor(percent: number): string {
  if (percent >= 80) return 'bg-red-500'
  if (percent >= 50) return 'bg-yellow-500'
  return 'bg-green-500'
}

function progressTextColor(percent: number): string {
  if (percent >= 80) return 'text-red-500'
  if (percent >= 50) return 'text-yellow-500'
  return 'text-green-500'
}

export function BudgetSettings() {
  const [data, setData] = useState<BudgetData | null>(null)
  const [monthlyLimit, setMonthlyLimit] = useState('')
  const [dailyLimit, setDailyLimit] = useState('')
  const [alertThreshold, setAlertThreshold] = useState(80)
  const [isSaving, setIsSaving] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const loadBudget = useCallback(async () => {
    try {
      const budget = await api.get<BudgetData>('/api/usage/budget')
      setData(budget)
      setMonthlyLimit(budget.monthlyLimitUsd?.toString() || '')
      setDailyLimit(budget.dailyLimitUsd?.toString() || '')
      setAlertThreshold(Math.round(budget.alertThreshold * 100))
    } catch (err) {
      console.error('Failed to load budget:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadBudget()
  }, [loadBudget])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await api.put('/api/usage/budget', {
        monthlyLimitUsd: monthlyLimit ? parseFloat(monthlyLimit) : null,
        dailyLimitUsd: dailyLimit ? parseFloat(dailyLimit) : null,
        alertThreshold: alertThreshold / 100,
      })
      setIsSaved(true)
      setTimeout(() => setIsSaved(false), 2000)
      // Reload to get updated spend percentages
      await loadBudget()
    } catch (err) {
      console.error('Failed to save budget:', err)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-5 w-32 rounded bg-[var(--secondary)]" />
          <div className="h-10 rounded bg-[var(--secondary)]" />
          <div className="h-10 rounded bg-[var(--secondary)]" />
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
      <h2 className="mb-1 font-medium">Budget & Limits</h2>
      <p className="mb-4 text-sm text-[var(--muted-foreground)]">
        Set spending limits to control costs. You will be warned when approaching the threshold and blocked when the limit is reached.
      </p>

      <div className="space-y-4">
        {/* Monthly limit */}
        <div>
          <label className="mb-1 block text-sm font-medium">
            Monthly Limit (USD)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--muted-foreground)]">
              $
            </span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={monthlyLimit}
              onChange={(e) => setMonthlyLimit(e.target.value)}
              placeholder="No limit"
              className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] py-2 pl-7 pr-3 text-sm outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
            />
          </div>
          {data && data.monthlyLimitUsd !== null && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--muted-foreground)]">
                  ${data.currentMonthSpend.toFixed(2)} of ${data.monthlyLimitUsd.toFixed(2)}
                </span>
                <span className={progressTextColor(data.monthlyPercentUsed)}>
                  {data.monthlyPercentUsed.toFixed(1)}%
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--secondary)]">
                <div
                  className={`h-full rounded-full transition-all ${progressColor(data.monthlyPercentUsed)}`}
                  style={{ width: `${Math.min(data.monthlyPercentUsed, 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Daily limit */}
        <div>
          <label className="mb-1 block text-sm font-medium">
            Daily Limit (USD)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--muted-foreground)]">
              $
            </span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={dailyLimit}
              onChange={(e) => setDailyLimit(e.target.value)}
              placeholder="No limit"
              className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] py-2 pl-7 pr-3 text-sm outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
            />
          </div>
          {data && data.dailyLimitUsd !== null && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--muted-foreground)]">
                  ${data.currentDaySpend.toFixed(2)} of ${data.dailyLimitUsd.toFixed(2)}
                </span>
                <span className={progressTextColor(data.dailyPercentUsed)}>
                  {data.dailyPercentUsed.toFixed(1)}%
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--secondary)]">
                <div
                  className={`h-full rounded-full transition-all ${progressColor(data.dailyPercentUsed)}`}
                  style={{ width: `${Math.min(data.dailyPercentUsed, 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Alert threshold */}
        <div>
          <label className="mb-1 block text-sm font-medium">
            Alert Threshold
          </label>
          <p className="mb-2 text-xs text-[var(--muted-foreground)]">
            Warn when spend reaches this percentage of the limit.
          </p>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="50"
              max="100"
              step="5"
              value={alertThreshold}
              onChange={(e) => setAlertThreshold(parseInt(e.target.value))}
              className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-[var(--secondary)] accent-[var(--primary)]"
            />
            <span className="w-12 text-right text-sm font-medium tabular-nums">
              {alertThreshold}%
            </span>
          </div>
        </div>

        {/* Save button */}
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="rounded-lg bg-[var(--primary)] px-6 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isSaving ? 'Saving...' : isSaved ? 'Saved!' : 'Save Budget Settings'}
        </button>
      </div>
    </div>
  )
}
