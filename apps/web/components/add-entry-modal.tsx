"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@repo/ui/components/dialog"
import { FieldGroup, Field, FieldLabel, FieldDescription } from "@repo/ui/components/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/components/select"
import { Textarea } from "@repo/ui/components/textarea"
import { Button } from "@repo/ui/components/button"
import { InfoIcon, MinusIcon, PlusIcon } from "lucide-react"

export function AddEntryModal({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-xl">Add New Entry</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <FieldGroup>
            <Field>
              <div className="flex items-center gap-1.5">
                <FieldLabel htmlFor="project">Select Project *</FieldLabel>
                <InfoIcon className="size-4 text-muted-foreground" />
              </div>
              <Select>
                <SelectTrigger id="project">
                  <SelectValue placeholder="Project Name" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="project1">Project 1</SelectItem>
                  <SelectItem value="project2">Project 2</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <div className="flex items-center gap-1.5">
                <FieldLabel htmlFor="typeOfWork">Type of Work *</FieldLabel>
                <InfoIcon className="size-4 text-muted-foreground" />
              </div>
              <Select>
                <SelectTrigger id="typeOfWork">
                  <SelectValue placeholder="Bug fixes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bug">Bug fixes</SelectItem>
                  <SelectItem value="feature">Feature</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="description">Task description *</FieldLabel>
              <Textarea 
                id="description" 
                placeholder="Write text here ..." 
                className="min-h-[120px] resize-none"
              />
              <FieldDescription>A note for extra info</FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="hours">Hours *</FieldLabel>
              <div className="flex h-9 w-fit items-center overflow-hidden rounded-md border border-input">
                <button type="button" className="flex aspect-square h-full items-center justify-center border-r hover:bg-muted text-muted-foreground">
                  <MinusIcon className="size-4" />
                </button>
                <input 
                  type="number" 
                  id="hours"
                  className="h-full w-12 border-0 bg-transparent text-center text-sm focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                  defaultValue={12} 
                />
                <button type="button" className="flex aspect-square h-full items-center justify-center border-l hover:bg-muted text-muted-foreground">
                  <PlusIcon className="size-4" />
                </button>
              </div>
            </Field>
          </FieldGroup>
        </div>
        <DialogFooter className="flex w-full flex-col gap-4 sm:flex-row sm:justify-between">
          <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">Add entry</Button>
          <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
