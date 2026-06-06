import { Project, ProjectDetail, ProjectMemberUser } from "@/types";
import { fetchWithAuth } from "@/utils/api";

export const getProjects = async (): Promise<{ projects: Project[] }> =>
    fetchWithAuth(`/project`, { method: "GET" });

export const getProject = async (id: string): Promise<{ project: ProjectDetail }> =>
    fetchWithAuth(`/project/${id}`, { method: "GET" });

export const createProject = async (data: { name: string; description?: string }): Promise<{ project: ProjectDetail }> =>
    fetchWithAuth(`/project`, {
        method: "POST",
        body: JSON.stringify(data),
    });

export const updateProject = async (id: string, data: { name?: string; description?: string }): Promise<{ project: ProjectDetail }> =>
    fetchWithAuth(`/project/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
    });

export const deleteProject = async (id: string): Promise<{ message: string }> =>
    fetchWithAuth(`/project/${id}`, { method: "DELETE" });

export const addProjectMember = async (projectId: string, username: string): Promise<{ user: ProjectMemberUser }> =>
    fetchWithAuth(`/project/${projectId}/members`, {
        method: "POST",
        body: JSON.stringify({ username }),
    });

export const removeProjectMember = async (projectId: string, memberId: string): Promise<{ message: string }> =>
    fetchWithAuth(`/project/${projectId}/members/${memberId}`, { method: "DELETE" });
