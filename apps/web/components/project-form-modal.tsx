"use client";

import { useEffect } from "react";
import { useForm } from "@tanstack/react-form-nextjs";
import { ProjectDetail } from "@/types";
import { useCreateProject, useUpdateProject } from "@/hooks/use-project-queries";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@repo/ui/components/dialog";
import { Field, FieldGroup, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { Button } from "@repo/ui/components/button";
import { toast } from "@repo/ui/components";

interface ProjectFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    project?: ProjectDetail | null;
}

export function ProjectFormModal({ isOpen, onClose, project }: ProjectFormModalProps) {
    const createMutation = useCreateProject();
    const updateMutation = useUpdateProject();
    const isEdit = !!project;

    const form = useForm({
        defaultValues: {
            name: project?.name ?? "",
            description: project?.description ?? "",
        },
        onSubmit: async ({ value }) => {
            try {
                if (isEdit) {
                    await updateMutation.mutateAsync({ id: project.id, data: value });
                    toast.success("Project updated");
                } else {
                    await createMutation.mutateAsync(value);
                    toast.success("Project created");
                }
                onClose();
            } catch (error) {
                toast.error(error instanceof Error ? error.message : "An error occurred");
            }
        },
    });

    useEffect(() => {
        if (isOpen) {
            form.reset();
        }
    }, [isOpen, form]);

    const isPending = createMutation.isPending || updateMutation.isPending;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{isEdit ? "Edit Project" : "New Project"}</DialogTitle>
                    <DialogDescription>
                        {isEdit ? "Update project details." : "Create a new project to track time against."}
                    </DialogDescription>
                </DialogHeader>

                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void form.handleSubmit();
                    }}
                >
                    <div className="py-4">
                        <FieldGroup>
                            <form.Field
                                name="name"
                                validators={{ onChange: ({ value }) => (value.trim() ? undefined : "Name is required") }}
                            >
                                {(field) => (
                                    <Field>
                                        <FieldLabel htmlFor="projectName">Name</FieldLabel>
                                        <Input
                                            id="projectName"
                                            value={field.state.value}
                                            onChange={(e) => field.handleChange(e.target.value)}
                                            placeholder="e.g. Website Redesign"
                                            autoFocus
                                        />
                                    </Field>
                                )}
                            </form.Field>

                            <form.Field name="description">
                                {(field) => (
                                    <Field>
                                        <FieldLabel htmlFor="projectDesc">Description</FieldLabel>
                                        <Input
                                            id="projectDesc"
                                            value={field.state.value}
                                            onChange={(e) => field.handleChange(e.target.value)}
                                            placeholder="Optional description"
                                        />
                                    </Field>
                                )}
                            </form.Field>
                        </FieldGroup>
                    </div>

                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting]}>
                            {([canSubmit, isSubmitting]) => (
                                <Button type="submit" disabled={!canSubmit || isPending}>
                                    {isSubmitting || isPending ? "Saving..." : "Save"}
                                </Button>
                            )}
                        </form.Subscribe>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
