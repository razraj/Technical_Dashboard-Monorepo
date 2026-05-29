"use client";

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@repo/ui/components/dialog"
import { FieldGroup, Field, FieldLabel, FieldDescription } from "@repo/ui/components/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/components/select"
import { Textarea } from "@repo/ui/components/textarea"
import { Button } from "@repo/ui/components/button"
import { InfoIcon, MinusIcon, PlusIcon } from "lucide-react"
import { toast } from "@repo/ui/components"
import { createEntry, getProjects, updateEntry } from "@/actions/timesheet"
import { Project, TimesheetEntry } from "@/types"

const WORK_TYPES = ["Development", "Bug fixes", "Feature", "Meeting", "Review"]

type AddEntryModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  date: string
  entry?: TimesheetEntry | null
  onSubmitted: () => void
}

export function AddEntryModal({ open, onOpenChange, date, entry, onSubmitted }: AddEntryModalProps) {
  const isEdit = Boolean(entry)
  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState("")
  const [workType, setWorkType] = useState("")
  const [description, setDescription] = useState("")
  const [hours, setHours] = useState(8)
  const [pending, setPending] = useState(false)

  // Load projects whenever the modal opens (cheap; cached in component state).
  useEffect(() => {
    if (!open) return
    let active = true
    getProjects()
      .then((res) => {
        if (active) setProjects(res.projects)
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Failed to load projects"
        toast.error(message)
      })
    return () => {
      active = false
    }
  }, [open])

  // Sync the form to the entry being edited (or reset for create) when opened.
  useEffect(() => {
    if (!open) return
    setProjectId(entry?.projectId ?? "")
    setWorkType(entry?.workType ?? "")
    setDescription(entry?.description ?? "")
    setHours(entry?.hours ?? 8)
  }, [open, entry])

  const workTypeOptions =
    entry?.workType && !WORK_TYPES.includes(entry.workType) ? [entry.workType, ...WORK_TYPES] : WORK_TYPES

  const clampHours = (value: number) => {
    if (Number.isNaN(value)) return 1
    return Math.max(1, Math.min(24, Math.round(value)))
  }

  const canSubmit =
    projectId.length > 0 &&
    workType.length > 0 &&
    description.trim().length > 0 &&
    hours >= 1 &&
    hours <= 24 &&
    !pending

  const handleSubmit = async () => {
    if (!canSubmit) return
    setPending(true)
    try {
      if (isEdit && entry) {
        await updateEntry(entry.id, { projectId, workType, description: description.trim(), hours })
      } else {
        await createEntry({ date, projectId, workType, description: description.trim(), hours })
      }
      toast.success(isEdit ? "Entry updated" : "Entry added")
      onOpenChange(false)
      onSubmitted()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong"
      toast.error(message)
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-xl">{isEdit ? "Edit Entry" : "Add New Entry"}</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <FieldGroup>
            <Field>
              <div className="flex items-center gap-1.5">
                <FieldLabel htmlFor="project">Select Project *</FieldLabel>
                <InfoIcon className="size-4 text-muted-foreground" />
              </div>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger id="project">
                  <SelectValue placeholder="Project Name" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <div className="flex items-center gap-1.5">
                <FieldLabel htmlFor="typeOfWork">Type of Work *</FieldLabel>
                <InfoIcon className="size-4 text-muted-foreground" />
              </div>
              <Select value={workType} onValueChange={setWorkType}>
                <SelectTrigger id="typeOfWork">
                  <SelectValue placeholder="Bug fixes" />
                </SelectTrigger>
                <SelectContent>
                  {workTypeOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="description">Task description *</FieldLabel>
              <Textarea
                id="description"
                placeholder="Write text here ..."
                className="min-h-[120px] resize-none"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
              <FieldDescription>A note for extra info</FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="hours">Hours *</FieldLabel>
              <div className="flex h-9 w-fit items-center overflow-hidden rounded-md border border-input">
                <button
                  type="button"
                  onClick={() => setHours((h) => clampHours(h - 1))}
                  className="flex aspect-square h-full items-center justify-center border-r hover:bg-muted text-muted-foreground"
                >
                  <MinusIcon className="size-4" />
                </button>
                <input
                  type="number"
                  id="hours"
                  className="h-full w-12 border-0 bg-transparent text-center text-sm focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  value={hours}
                  min={1}
                  max={24}
                  onChange={(event) => setHours(clampHours(Number(event.target.value)))}
                />
                <button
                  type="button"
                  onClick={() => setHours((h) => clampHours(h + 1))}
                  className="flex aspect-square h-full items-center justify-center border-l hover:bg-muted text-muted-foreground"
                >
                  <PlusIcon className="size-4" />
                </button>
              </div>
            </Field>
          </FieldGroup>
        </div>
        <DialogFooter className="flex w-full flex-col gap-4 sm:flex-row sm:justify-between">
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
          >
            {pending ? "Saving..." : isEdit ? "Save changes" : "Add entry"}
          </Button>
          <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
