"use client";

import { useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { AuthGuard } from "@/components/auth-guard";
import { useCurrentUser } from "@/hooks/use-user-queries";
import { useProjects, useDeleteProject } from "@/hooks/use-project-queries";
import { ProjectFormModal } from "@/components/project-form-modal";
import { ProjectMembersModal } from "@/components/project-members-modal";
import { ProjectDetail } from "@/types";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@repo/ui/components/breadcrumb";
import { Button } from "@repo/ui/components/button";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@repo/ui/components/sidebar";
import { Separator } from "@repo/ui/components/separator";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@repo/ui/components/dropdown-menu";
import { MoreHorizontal, Plus, Edit2, Users, Trash2, Loader2 } from "lucide-react";
import { toast } from "@repo/ui/components";
import { useQueryClient } from "@tanstack/react-query";
import { getProject } from "@/actions/projects";
import { queryKeys } from "@/lib/query-keys";

export default function ProjectsPage() {
    const { data: user } = useCurrentUser();
    const { data: projects, isLoading, isError, refetch } = useProjects();
    const deleteMutation = useDeleteProject();
    const queryClient = useQueryClient();

    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
    const [selectedProject, setSelectedProject] = useState<ProjectDetail | null>(null);
    const [activeProjectId, setActiveProjectId] = useState<string>("");
    const [editingId, setEditingId] = useState<string | null>(null);

    const canManage = user?.role === "ADMIN" || user?.role === "MANAGER";

    const handleCreate = () => {
        setSelectedProject(null);
        setIsFormModalOpen(true);
    };

    const handleEdit = async (id: string) => {
        if (editingId) return;
        setEditingId(id);
        try {
            const { project } = await queryClient.fetchQuery({
                queryKey: queryKeys.projects.detail(id),
                queryFn: () => getProject(id),
            });
            setSelectedProject(project);
            setIsFormModalOpen(true);
        } catch {
            toast.error("Failed to load project details");
        } finally {
            setEditingId(null);
        }
    };

    const handleMembers = (id: string) => {
        setActiveProjectId(id);
        setIsMembersModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (deleteMutation.isPending) return;
        if (!confirm("Are you sure you want to delete this project? This will soft-delete it.")) return;
        try {
            await deleteMutation.mutateAsync(id);
            toast.success("Project deleted");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to delete project");
        }
    };

    const colCount = canManage ? 4 : 3;

    return (
        <AuthGuard requireUnauthenticated={false}>
            <SidebarProvider>
                <AppSidebar />
                <SidebarInset>
                    <header className="flex h-16 shrink-0 items-center justify-between gap-2 px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
                        <div className="flex items-center gap-2">
                            <SidebarTrigger className="-ml-1" />
                            <Separator orientation="vertical" className="mr-2 h-4" />
                            <Breadcrumb>
                                <BreadcrumbList>
                                    <BreadcrumbItem>
                                        <BreadcrumbPage>Projects</BreadcrumbPage>
                                    </BreadcrumbItem>
                                </BreadcrumbList>
                            </Breadcrumb>
                        </div>
                        {canManage && (
                            <Button onClick={handleCreate} size="sm" className="gap-2">
                                <Plus className="h-4 w-4" /> New Project
                            </Button>
                        )}
                    </header>

                    <div className="p-4 sm:p-6">
                        <div className="rounded-md border bg-white shadow-sm overflow-hidden">
                            <table className="w-full text-sm text-left" aria-label="Projects">
                                <thead className="bg-muted/50 text-muted-foreground">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">Name</th>
                                        <th className="px-4 py-3 font-medium">Description</th>
                                        <th className="px-4 py-3 font-medium">Members</th>
                                        {canManage && <th className="px-4 py-3 w-[80px]"><span className="sr-only">Actions</span></th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={colCount} className="text-center py-8 text-muted-foreground">
                                                Loading projects...
                                            </td>
                                        </tr>
                                    ) : isError ? (
                                        <tr>
                                            <td colSpan={colCount} className="text-center py-8">
                                                <p className="text-muted-foreground mb-2">Failed to load projects.</p>
                                                <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
                                                    Try again
                                                </Button>
                                            </td>
                                        </tr>
                                    ) : projects?.length === 0 ? (
                                        <tr>
                                            <td colSpan={colCount} className="text-center py-8">
                                                <p className="text-muted-foreground mb-2">No projects found.</p>
                                                {canManage && (
                                                    <Button type="button" size="sm" onClick={handleCreate}>
                                                        Create your first project
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                    ) : (
                                        projects?.map((project) => (
                                            <tr key={project.id} className="hover:bg-muted/50">
                                                <td className="px-4 py-3 font-medium">{project.name}</td>
                                                <td className="px-4 py-3 text-muted-foreground">
                                                    {project.description || "—"}
                                                </td>
                                                <td className="px-4 py-3 text-muted-foreground">
                                                    {project.memberCount ?? "—"}
                                                </td>
                                                {canManage && (
                                                    <td className="px-4 py-3 text-right">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button
                                                                    variant="ghost"
                                                                    className="h-8 w-8 p-0"
                                                                    disabled={editingId === project.id || deleteMutation.isPending}
                                                                >
                                                                    <span className="sr-only">Open menu for {project.name}</span>
                                                                    {editingId === project.id ? (
                                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                                    ) : (
                                                                        <MoreHorizontal className="h-4 w-4" />
                                                                    )}
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuItem
                                                                    onClick={() => handleEdit(project.id)}
                                                                    disabled={editingId === project.id}
                                                                >
                                                                    <Edit2 className="mr-2 h-4 w-4" /> Edit
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => handleMembers(project.id)}>
                                                                    <Users className="mr-2 h-4 w-4" /> Members
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem
                                                                    className="text-destructive focus:text-destructive"
                                                                    onClick={() => handleDelete(project.id)}
                                                                    disabled={deleteMutation.isPending}
                                                                >
                                                                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </td>
                                                )}
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <ProjectFormModal
                        isOpen={isFormModalOpen}
                        onClose={() => setIsFormModalOpen(false)}
                        project={selectedProject}
                    />

                    {activeProjectId && (
                        <ProjectMembersModal
                            isOpen={isMembersModalOpen}
                            onClose={() => {
                                setIsMembersModalOpen(false);
                                setActiveProjectId("");
                            }}
                            projectId={activeProjectId}
                        />
                    )}
                </SidebarInset>
            </SidebarProvider>
        </AuthGuard>
    );
}
