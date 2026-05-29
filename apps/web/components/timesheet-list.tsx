"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Button } from "@repo/ui/components/button"
import { Skeleton } from "@repo/ui/components/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/components/select"
import { cn } from "@repo/ui/lib/utils"
import { toast } from "@repo/ui/components"
import { useWeeks } from "@/hooks/use-timesheet-queries"
import { formatWeekRange } from "@/lib/format"
import { WeekStatus } from "@/types"

const PAGE_SIZES = [5, 10, 20]

const STATUS_STYLES: Record<WeekStatus, string> = {
  COMPLETED: "bg-green-100 text-green-700",
  INCOMPLETE: "bg-amber-100 text-amber-700",
  MISSING: "bg-rose-100 text-rose-700",
}

const ACTION_LABELS: Record<WeekStatus, string> = {
  COMPLETED: "View",
  INCOMPLETE: "Update",
  MISSING: "Create",
}

export function TimesheetList() {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const { data, isLoading, error } = useWeeks(page, pageSize)

  useEffect(() => {
    if (error) {
      const message = error instanceof Error ? error.message : "Failed to load timesheets"
      toast.error(message)
    }
  }, [error])

  const weeks = data?.weeks ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="rounded-xl border bg-card">
      <div className="px-6 py-5">
        <h2 className="text-2xl font-bold tracking-tight">Your Timesheets</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y bg-muted/40 text-left text-xs font-medium uppercase text-muted-foreground">
              <th className="px-6 py-3">Week #</th>
              <th className="px-6 py-3">Date</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: pageSize }).map((_, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-6 py-4">
                      <Skeleton className="h-4 w-6" />
                    </td>
                    <td className="px-6 py-4">
                      <Skeleton className="h-4 w-40" />
                    </td>
                    <td className="px-6 py-4">
                      <Skeleton className="h-5 w-24 rounded-full" />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Skeleton className="ml-auto h-4 w-12" />
                    </td>
                  </tr>
                ))
              : weeks.map((week) => (
                  <tr key={`${week.weekYear}-${week.weekNumber}`} className="border-b last:border-0">
                    <td className="px-6 py-4 text-muted-foreground">{week.weekNumber}</td>
                    <td className="px-6 py-4">{formatWeekRange(week.periodStart, week.periodEnd)}</td>
                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-xs font-medium uppercase",
                          STATUS_STYLES[week.status]
                        )}
                      >
                        {week.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/dashboard/${week.periodStart}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {ACTION_LABELS[week.status]}
                      </Link>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-6 py-4">
        <Select
          value={String(pageSize)}
          onValueChange={(value) => {
            setPageSize(Number(value))
            setPage(1)
          }}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZES.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size} per page
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || isLoading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || isLoading}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
