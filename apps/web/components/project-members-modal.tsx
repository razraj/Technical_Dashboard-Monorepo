"use client";

import { useForm } from "@tanstack/react-form-nextjs";
import { useProject, useAddProjectMember, useRemoveProjectMember } from "@/hooks/use-project-queries";
import { FormFieldError } from "@/components/form-field-error";
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
import { Trash2 } from "lucide-react";

interface ProjectMembersModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: string;
}

export function ProjectMembersModal({ isOpen, onClose, projectId }: ProjectMembersModalProps) {
    const { data: project, isLoading, isError, refetch } = useProject(projectId);
    const addMemberMutation = useAddProjectMember();
    const removeMemberMutation = useRemoveProjectMember();

    const form = useForm({
        defaultValues: {
            username: "",
        },
        onSubmit: async ({ value }) => {
            try {
                await addMemberMutation.mutateAsync({ projectId, username: value.username });
                toast.success("Member added");
                form.reset();
            } catch (error) {
                toast.error(error instanceof Error ? error.message : "Failed to add member");
            }
        },
    });

    const handleRemove = async (memberId: string, memberName: string) => {
        if (!confirm(`Remove ${memberName} from this project?`)) return;
        try {
            await removeMemberMutation.mutateAsync({ projectId, memberId });
            toast.success("Member removed");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to remove member");
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Manage Members</DialogTitle>
                    <DialogDescription>
                        {project?.name ? `Add or remove members for ${project.name}.` : "Manage project members."}
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 flex flex-col gap-6">
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            void form.handleSubmit();
                        }}
                    >
                        <FieldGroup>
                            <form.Field
                                name="username"
                                validators={{ onChange: ({ value }) => (value.trim() ? undefined : "Username is required") }}
                            >
                                {(field) => (
                                    <Field>
                                        <FieldLabel htmlFor="username">Add Member by Username</FieldLabel>
                                        <div className="flex gap-2">
                                            <Input
                                                id="username"
                                                value={field.state.value}
                                                onChange={(e) => field.handleChange(e.target.value)}
                                                placeholder="e.g. jdoe"
                                                className="flex-1"
                                            />
                                            <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting]}>
                                                {([canSubmit, isSubmitting]) => (
                                                    <Button type="submit" disabled={!canSubmit || addMemberMutation.isPending}>
                                                        {isSubmitting || addMemberMutation.isPending ? "Adding..." : "Add"}
                                                    </Button>
                                                )}
                                            </form.Subscribe>
                                        </div>
                                        <FormFieldError errors={field.state.meta.errors} />
                                    </Field>
                                )}
                            </form.Field>
                        </FieldGroup>
                    </form>

                    <div>
                        <h4 className="text-sm font-medium mb-2">Current Members</h4>
                        {isLoading ? (
                            <p className="text-sm text-muted-foreground">Loading members...</p>
                        ) : isError ? (
                            <div className="flex items-center gap-2">
                                <p className="text-sm text-muted-foreground">Failed to load members.</p>
                                <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
                                    Try again
                                </Button>
                            </div>
                        ) : project?.members.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No members assigned to this project.</p>
                        ) : (
                            <ul className="space-y-2">
                                {project?.members.map((member) => {
                                    const memberName =
                                        [member.firstName, member.lastName].filter(Boolean).join(" ") || member.username;
                                    return (
                                        <li
                                            key={member.id}
                                            className="flex items-center justify-between bg-muted/50 p-2 rounded-md"
                                        >
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium">{memberName}</span>
                                                <span className="text-xs text-muted-foreground">@{member.username}</span>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                onClick={() => handleRemove(member.id, memberName)}
                                                disabled={removeMemberMutation.isPending}
                                                aria-label={`Remove ${memberName} from project`}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </div>

                <div className="flex justify-end">
                    <Button type="button" variant="outline" onClick={onClose}>
                        Close
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
