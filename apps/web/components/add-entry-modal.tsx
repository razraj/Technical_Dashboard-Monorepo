"use client";

import { useEffect } from "react";
import { useForm } from "@tanstack/react-form-nextjs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@repo/ui/components/dialog";
import { FieldGroup, Field, FieldContent, FieldLabel, FieldDescription } from "@repo/ui/components/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/components/select";
import { Textarea } from "@repo/ui/components/textarea";
import { Button } from "@repo/ui/components/button";
import { InfoIcon, MinusIcon, PlusIcon } from "lucide-react";
import { toast } from "@repo/ui/components";
import { useCreateEntry, useUpdateEntry } from "@/hooks/use-timesheet-queries";
import { useProjects } from "@/hooks/use-project-queries";
import { FormFieldError } from "@/components/form-field-error";
import { TimesheetEntry } from "@/types";

const WORK_TYPES = ["Development", "Bug fixes", "Feature", "Meeting", "Review"];

type EntryFormValues = {
    projectId: string;
    workType: string;
    description: string;
    hours: number;
};

type AddEntryModalProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    date: string;
    weekStart: string;
    entry?: TimesheetEntry | null;
};

const clampHours = (value: number) => {
    if (Number.isNaN(value)) return 1;
    return Math.max(1, Math.min(24, Math.round(value)));
};

const emptyValues: EntryFormValues = {
    projectId: "",
    workType: "",
    description: "",
    hours: 8,
};

export function AddEntryModal({ open, onOpenChange, date, weekStart, entry }: AddEntryModalProps) {
    const isEdit = Boolean(entry);
    const {
        data: projectList,
        isLoading: projectsLoading,
        isError: projectsError,
        refetch: refetchProjects,
    } = useProjects(open);
    const createEntry = useCreateEntry(weekStart);
    const updateEntry = useUpdateEntry(weekStart);
    const projects = projectList ?? [];

    const form = useForm({
        defaultValues: emptyValues,
        onSubmit: async ({ value }) => {
            try {
                const payload = {
                    projectId: value.projectId,
                    workType: value.workType,
                    description: value.description.trim(),
                    hours: value.hours,
                };
                if (entry) {
                    await updateEntry.mutateAsync({ entryId: entry.id, payload });
                } else {
                    await createEntry.mutateAsync({ ...payload, date });
                }
                toast.success(entry ? "Entry updated" : "Entry added");
                onOpenChange(false);
            } catch (error) {
                const message = error instanceof Error ? error.message : "Something went wrong";
                toast.error(message);
            }
        },
    });

    useEffect(() => {
        if (!open) return;
        form.reset({
            projectId: entry?.projectId ?? "",
            workType: entry?.workType ?? "",
            description: entry?.description ?? "",
            hours: entry?.hours ?? 8,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when entry identity changes
    }, [open, entry?.id, entry?.projectId, entry?.workType, entry?.description, entry?.hours]);

    const workTypeOptions =
        entry?.workType && !WORK_TYPES.includes(entry.workType) ? [entry.workType, ...WORK_TYPES] : WORK_TYPES;

    const isPending = createEntry.isPending || updateEntry.isPending;
    const projectsUnavailable = projectsLoading || projectsError || projects.length === 0;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="text-xl">{isEdit ? "Edit Entry" : "Add New Entry"}</DialogTitle>
                </DialogHeader>
                <form
                    key={entry?.id ?? "new"}
                    className="py-4"
                    onSubmit={(event) => {
                        event.preventDefault();
                        void form.handleSubmit();
                    }}
                >
                    <FieldGroup>
                        <form.Field
                            name="projectId"
                            validators={{
                                onChange: ({ value }) => (value ? undefined : "Select a project"),
                            }}
                        >
                            {(field) => (
                                <Field>
                                    <div className="flex items-center gap-1.5">
                                        <FieldLabel htmlFor="project">Select Project *</FieldLabel>
                                        <InfoIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                                    </div>
                                    {projectsLoading ? (
                                        <p className="text-sm text-muted-foreground">Loading projects...</p>
                                    ) : projectsError ? (
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm text-muted-foreground">Failed to load projects.</p>
                                            <Button type="button" variant="outline" size="sm" onClick={() => refetchProjects()}>
                                                Retry
                                            </Button>
                                        </div>
                                    ) : projects.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">
                                            No projects available. Ask your manager to assign you to a project.
                                        </p>
                                    ) : (
                                        <Select value={field.state.value} onValueChange={field.handleChange}>
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
                                    )}
                                    <FormFieldError errors={field.state.meta.errors} />
                                </Field>
                            )}
                        </form.Field>

                        <form.Field
                            name="workType"
                            validators={{
                                onChange: ({ value }) => (value ? undefined : "Select a work type"),
                            }}
                        >
                            {(field) => (
                                <Field>
                                    <div className="flex items-center gap-1.5">
                                        <FieldLabel htmlFor="typeOfWork">Type of Work *</FieldLabel>
                                        <InfoIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                                    </div>
                                    <Select value={field.state.value} onValueChange={field.handleChange}>
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
                                    <FormFieldError errors={field.state.meta.errors} />
                                </Field>
                            )}
                        </form.Field>

                        <form.Field
                            name="description"
                            validators={{
                                onChange: ({ value }) => (value.trim() ? undefined : "Description is required"),
                            }}
                        >
                            {(field) => (
                                <Field>
                                    <FieldLabel htmlFor="description">Task description *</FieldLabel>
                                    <Textarea
                                        id="description"
                                        placeholder="Write text here ..."
                                        className="min-h-[120px] resize-none"
                                        value={field.state.value}
                                        onChange={(event) => field.handleChange(event.target.value)}
                                    />
                                    <FieldDescription>A note for extra info</FieldDescription>
                                    <FormFieldError errors={field.state.meta.errors} />
                                </Field>
                            )}
                        </form.Field>

                        <form.Field
                            name="hours"
                            validators={{
                                onChange: ({ value }) =>
                                    value >= 1 && value <= 24 ? undefined : "Hours must be between 1 and 24",
                            }}
                        >
                            {(field) => (
                                <Field>
                                    <FieldLabel htmlFor="hours">Hours *</FieldLabel>
                                    <FieldContent className="!w-fit self-start">
                                        <div className="inline-flex h-9 items-stretch overflow-hidden rounded-md border border-input">
                                            <button
                                                type="button"
                                                aria-label="Decrease hours"
                                                onClick={() => field.handleChange(clampHours(field.state.value - 1))}
                                                className="flex size-9 shrink-0 items-center justify-center border-r border-input hover:bg-muted text-muted-foreground"
                                            >
                                                <MinusIcon className="size-4" />
                                            </button>
                                            <input
                                                type="number"
                                                id="hours"
                                                className="h-9 w-12 shrink-0 border-0 bg-transparent text-center text-sm focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                value={field.state.value}
                                                min={1}
                                                max={24}
                                                onChange={(event) => field.handleChange(clampHours(Number(event.target.value)))}
                                            />
                                            <button
                                                type="button"
                                                aria-label="Increase hours"
                                                onClick={() => field.handleChange(clampHours(field.state.value + 1))}
                                                className="flex size-9 shrink-0 items-center justify-center border-l border-input hover:bg-muted text-muted-foreground"
                                            >
                                                <PlusIcon className="size-4" />
                                            </button>
                                        </div>
                                    </FieldContent>
                                    <FormFieldError errors={field.state.meta.errors} />
                                </Field>
                            )}
                        </form.Field>
                    </FieldGroup>

                    <DialogFooter className="mt-4 flex w-full flex-col gap-4 sm:flex-row sm:justify-between">
                        <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
                            {([canSubmit, isSubmitting]) => (
                                <Button
                                    type="submit"
                                    disabled={!canSubmit || isPending || projectsUnavailable}
                                    className="flex-1"
                                >
                                    {isSubmitting || isPending ? "Saving..." : isEdit ? "Save changes" : "Add entry"}
                                </Button>
                            )}
                        </form.Subscribe>
                        <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
