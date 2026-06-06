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
import { MoreHorizontal, Plus, Edit2, Users, Trash2 } from "lucide-react";
import { toast } from "@repo/ui/components";
import { useQueryClient } from "@tanstack/react-query";
import { getProject } from "@/actions/projects";

export default function ProjectsPage() {
    const { data: user } = useCurrentUser();
    const { data: projects, isLoading } = useProjects();
    const deleteMutation = useDeleteProject();
    const queryClient = useQueryClient();

    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
    const [selectedProject, setSelectedProject] = useState<ProjectDetail | null>(null);
    const [activeProjectId, setActiveProjectId] = useState<string>("");

    const canManage = user?.role === "ADMIN" || user?.role === "MANAGER";

    const handleCreate = () => {
        setSelectedProject(null);
        setIsFormModalOpen(true);
    };

    const handleEdit = async (id: string) => {
        try {
            // We need the full detail to edit (including description)
            // But actually the list has description now.
            // Still, getting full project object is safer to match ProjectDetail type.
            const { project } = await queryClient.fetchQuery({
                queryKey: ["projects", id],
                queryFn: () => getProject(id),
            });
            setSelectedProject(project);
            setIsFormModalOpen(true);
        } catch (error) {
            toast.error("Failed to load project details");
        }
    };

    const handleMembers = (id: string) => {
        setActiveProjectId(id);
        setIsMembersModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this project? This will soft-delete it.")) return;
        try {
            await deleteMutation.mutateAsync(id);
            toast.success("Project deleted");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to delete project");
        }
    };

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
                            <table className="w-full text-sm text-left">
                                <thead className="bg-muted/50 text-muted-foreground">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">Name</th>
                                        <th className="px-4 py-3 font-medium">Description</th>
                                        <th className="px-4 py-3 w-[80px]"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={3} className="text-center py-8 text-muted-foreground">
                                                Loading projects...
                                            </td>
                                        </tr>
                                    ) : projects?.length === 0 ? (
                                        <tr>
                                            <td colSpan={3} className="text-center py-8 text-muted-foreground">
                                                No projects found.
                                            </td>
                                        </tr>
                                    ) : (
                                        projects?.map((project) => (
                                            <tr key={project.id} className="hover:bg-muted/50">
                                                <td className="px-4 py-3 font-medium">{project.name}</td>
                                                <td className="px-4 py-3 text-muted-foreground">
                                                    {project.description || "—"}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {canManage && (
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                                    <span className="sr-only">Open menu</span>
                                                                    <MoreHorizontal className="h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuItem onClick={() => handleEdit(project.id)}>
                                                                    <Edit2 className="mr-2 h-4 w-4" /> Edit
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => handleMembers(project.id)}>
                                                                    <Users className="mr-2 h-4 w-4" /> Members
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem
                                                                    className="text-destructive focus:text-destructive"
                                                                    onClick={() => handleDelete(project.id)}
                                                                >
                                                                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    )}
                                                </td>
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
