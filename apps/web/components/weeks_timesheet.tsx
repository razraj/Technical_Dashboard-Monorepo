"use client"

import { useState } from "react"
import { MoreHorizontalIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu"
import { cn } from "@repo/ui/lib/utils"
import { toast } from "@repo/ui/components"
import { AddEntryModal } from "@/components/add-entry-modal"
import { deleteEntry } from "@/actions/timesheet"
import { TimesheetEntry, WeekDetail } from "@/types"

function formatRange(periodStart: string, periodEnd: string): string {
  const start = new Date(periodStart)
  const end = new Date(periodEnd)
  const month = (d: Date) => d.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" })
  const day = (d: Date) => d.toLocaleDateString("en-US", { day: "numeric", timeZone: "UTC" })
  const year = end.toLocaleDateString("en-US", { year: "numeric", timeZone: "UTC" })
  if (month(start) === month(end)) {
    return `${day(start)} - ${day(end)} ${month(end)}, ${year}`
  }
  return `${day(start)} ${month(start)} - ${day(end)} ${month(end)}, ${year}`
}

export function WeeksTimesheet({ detail, onChanged }: { detail: WeekDetail; onChanged: () => void }) {
  const [modalOpen, setModalOpen] = useState(false)
  const [modalDate, setModalDate] = useState(detail.periodStart)
  const [editEntry, setEditEntry] = useState<TimesheetEntry | null>(null)

  const completionPct = Math.min(100, detail.utilization)

  const openCreate = (date: string) => {
    setEditEntry(null)
    setModalDate(date)
    setModalOpen(true)
  }

  const openEdit = (entry: TimesheetEntry) => {
    setEditEntry(entry)
    setModalDate(entry.date)
    setModalOpen(true)
  }

  const handleDelete = async (entryId: string) => {
    try {
      await deleteEntry(entryId)
      toast.success("Entry deleted")
      onChanged()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete entry"
      toast.error(message)
    }
  }

  return (
    <Card className="gap-4 py-5">
      <CardHeader className="flex items-start justify-between gap-4 px-4 sm:px-6">
        <div>
          <CardTitle className="text-2xl font-semibold tracking-tight">This week&apos;s timesheet</CardTitle>
          <p className="mt-2 text-sm text-muted-foreground">{formatRange(detail.periodStart, detail.periodEnd)}</p>
        </div>
        <div className="min-w-[170px]">
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-semibold">
              {detail.totalHours}/{detail.capacity} hrs
            </span>
            <span className="text-muted-foreground">{completionPct}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-orange-400 transition-all duration-300"
              style={{ width: `${completionPct}%` }}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 px-4 sm:px-6">
        {detail.days.map((day) => (
          <section
            key={day.date}
            className="grid grid-cols-1 gap-3 border-b border-dashed border-muted pb-4 last:border-0"
          >
            <div className="grid grid-cols-[84px_1fr] gap-3">
              <h3 className="pt-2 text-lg font-semibold leading-none">{day.dayLabel}</h3>
              <div className="space-y-2">
                {day.entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 shadow-xs"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <p className="truncate text-sm font-medium">{entry.description}</p>
                    </div>

                    <span className="text-sm text-muted-foreground">{entry.hours} hrs</span>
                    {entry.project ? (
                      <span className="rounded-sm bg-accent px-2 py-1 text-xs font-medium text-accent-foreground">
                        {entry.project.name}
                      </span>
                    ) : null}

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" className="size-7">
                          <MoreHorizontalIcon className="size-4" />
                          <span className="sr-only">Open row menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(entry)}>
                          <PencilIcon className="size-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem variant="destructive" onClick={() => handleDelete(entry.id)}>
                          <Trash2Icon className="size-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}

                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-center rounded-lg border border-dashed border-primary/30 text-primary hover:bg-primary/5",
                    day.entries.length === 0 && "text-muted-foreground border-muted-foreground/20"
                  )}
                  onClick={() => openCreate(day.date)}
                >
                  <PlusIcon className="size-4" />
                  Add new task
                </Button>
              </div>
            </div>
          </section>
        ))}
      </CardContent>

      <AddEntryModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        date={modalDate}
        entry={editEntry}
        onSubmitted={onChanged}
      />
    </Card>
  )
}
