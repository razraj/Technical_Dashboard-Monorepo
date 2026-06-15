"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    getProjects,
    getProject,
    createProject,
    updateProject,
    deleteProject,
    addProjectMember,
    removeProjectMember,
} from "@/actions/projects";
import { queryKeys } from "@/lib/query-keys";

export function useProjects() {
    return useQuery({
        queryKey: queryKeys.projects.all,
        queryFn: getProjects,
        select: (data) => data.projects,
    });
}

export function useProject(id: string) {
    return useQuery({
        queryKey: queryKeys.projects.detail(id),
        queryFn: () => getProject(id),
        select: (data) => data.project,
    });
}

export function useCreateProject() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: createProject,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
        },
    });
}

export function useUpdateProject() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: { name?: string; description?: string } }) => updateProject(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(variables.id) });
        },
    });
}

export function useDeleteProject() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: deleteProject,
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(id) });
        },
    });
}

export function useAddProjectMember() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ projectId, username }: { projectId: string; username: string }) => addProjectMember(projectId, username),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(variables.projectId) });
        },
    });
}

export function useRemoveProjectMember() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ projectId, memberId }: { projectId: string; memberId: string }) => removeProjectMember(projectId, memberId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(variables.projectId) });
        },
    });
}
