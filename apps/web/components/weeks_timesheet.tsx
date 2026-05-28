"use client"

import { useMemo, useState } from "react"
import { MoreHorizontalIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu"
import { Input } from "@repo/ui/components/input"
import { cn } from "@repo/ui/lib/utils"

type TimesheetEntry = {
  id: string
  projectName: string
  taskName: string
  hours: number
}

type TimesheetDay = {
  id: string
  label: string
  date: string
  entries: TimesheetEntry[]
}

const INITIAL_WEEK: TimesheetDay[] = [
  {
    id: "jan-21",
    label: "Jan 21",
    date: "2024-01-21",
    entries: [
      { id: "jan-21-1", projectName: "Website Revamp", taskName: "Homepage Development", hours: 4 },
      { id: "jan-21-2", projectName: "Website Revamp", taskName: "Homepage Development", hours: 4 },
    ],
  },
  {
    id: "jan-22",
    label: "Jan 22",
    date: "2024-01-22",
    entries: [
      { id: "jan-22-1", projectName: "Platform Core", taskName: "Homepage Development", hours: 4 },
      { id: "jan-22-2", projectName: "Platform Core", taskName: "Homepage Development", hours: 4 },
      { id: "jan-22-3", projectName: "Mobile App", taskName: "Homepage Development", hours: 4 },
    ],
  },
  {
    id: "jan-23",
    label: "Jan 23",
    date: "2024-01-23",
    entries: [
      { id: "jan-23-1", projectName: "Analytics", taskName: "Homepage Development", hours: 4 },
      { id: "jan-23-2", projectName: "Analytics", taskName: "Homepage Development", hours: 4 },
    ],
  },
  {
    id: "jan-24",
    label: "Jan 24",
    date: "2024-01-24",
    entries: [
      { id: "jan-24-1", projectName: "Internal Tools", taskName: "Homepage Development", hours: 4 },
      { id: "jan-24-2", projectName: "Internal Tools", taskName: "Homepage Development", hours: 4 },
      { id: "jan-24-3", projectName: "Internal Tools", taskName: "Homepage Development", hours: 4 },
    ],
  },
  {
    id: "jan-25",
    label: "Jan 25",
    date: "2024-01-25",
    entries: [],
  },
]

const WEEK_TARGET_HOURS = 40

export function WeeksTimesheet() {
  const [week, setWeek] = useState<TimesheetDay[]>(INITIAL_WEEK)
  const [activeEditEntryId, setActiveEditEntryId] = useState<string | null>(null)
  const [draftTaskName, setDraftTaskName] = useState("")

  const totalHours = useMemo(
    () => week.reduce((sum, day) => sum + day.entries.reduce((daySum, entry) => daySum + entry.hours, 0), 0),
    [week]
  )

  const completionPct = Math.min(100, Math.round((totalHours / WEEK_TARGET_HOURS) * 100))

  const addEntry = (dayId: string) => {
    setWeek((current) =>
      current.map((day) =>
        day.id !== dayId
          ? day
          : {
              ...day,
              entries: [
                ...day.entries,
                {
                  id: crypto.randomUUID(),
                  projectName: "Project Name",
                  taskName: "New Task",
                  hours: 2,
                },
              ],
            }
      )
    )
  }

  const deleteEntry = (dayId: string, entryId: string) => {
    setWeek((current) =>
      current.map((day) =>
        day.id !== dayId
          ? day
          : {
              ...day,
              entries: day.entries.filter((entry) => entry.id !== entryId),
            }
      )
    )
  }

  const startEditing = (entryId: string, currentName: string) => {
    setActiveEditEntryId(entryId)
    setDraftTaskName(currentName)
  }

  const saveEdit = (dayId: string, entryId: string) => {
    const nextValue = draftTaskName.trim()
    if (!nextValue) return

    setWeek((current) =>
      current.map((day) =>
        day.id !== dayId
          ? day
          : {
              ...day,
              entries: day.entries.map((entry) =>
                entry.id === entryId ? { ...entry, taskName: nextValue } : entry
              ),
            }
      )
    )
    setActiveEditEntryId(null)
    setDraftTaskName("")
  }

  const cancelEdit = () => {
    setActiveEditEntryId(null)
    setDraftTaskName("")
  }

  return (
    <Card className="gap-4 py-5">
      <CardHeader className="flex items-start justify-between gap-4 px-4 sm:px-6">
        <div>
          <CardTitle className="text-2xl font-semibold tracking-tight">This week&apos;s timesheet</CardTitle>
          <p className="mt-2 text-sm text-muted-foreground">21 - 26 January, 2024</p>
        </div>
        <div className="min-w-[170px]">
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-semibold">
              {totalHours}/{WEEK_TARGET_HOURS} hrs
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
        {week.map((day) => (
          <section key={day.id} className="grid grid-cols-1 gap-3 border-b border-dashed border-muted pb-4 last:border-0">
            <div className="grid grid-cols-[84px_1fr] gap-3">
              <h3 className="pt-2 text-2xl font-semibold leading-none">{day.label}</h3>
              <div className="space-y-2">
                {day.entries.map((entry) => {
                  const isEditing = activeEditEntryId === entry.id
                  return (
                    <div
                      key={entry.id}
                      className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 shadow-xs"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        {isEditing ? (
                          <Input
                            value={draftTaskName}
                            onChange={(event) => setDraftTaskName(event.target.value)}
                            className="h-8"
                            autoFocus
                          />
                        ) : (
                          <p className="truncate text-sm font-medium">{entry.taskName}</p>
                        )}
                      </div>

                      <span className="text-sm text-muted-foreground">{entry.hours} hrs</span>
                      <span className="rounded-sm bg-accent px-2 py-1 text-xs font-medium text-accent-foreground">
                        {entry.projectName}
                      </span>

                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <Button size="sm" onClick={() => saveEdit(day.id, entry.id)}>
                            Save
                          </Button>
                          <Button size="sm" variant="outline" onClick={cancelEdit}>
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" className="size-7">
                              <MoreHorizontalIcon className="size-4" />
                              <span className="sr-only">Open row menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => startEditing(entry.id, entry.taskName)}>
                              <PencilIcon className="size-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => deleteEntry(day.id, entry.id)}
                            >
                              <Trash2Icon className="size-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  )
                })}

                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-center rounded-lg border border-dashed border-primary/30 text-primary hover:bg-primary/5",
                    day.entries.length === 0 && "text-muted-foreground border-muted-foreground/20"
                  )}
                  onClick={() => addEntry(day.id)}
                >
                  <PlusIcon className="size-4" />
                  Add new task
                </Button>
              </div>
            </div>
          </section>
        ))}
      </CardContent>
    </Card>
  )
}
