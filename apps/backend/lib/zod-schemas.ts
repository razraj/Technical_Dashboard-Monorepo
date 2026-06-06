import { z } from "zod";

export const createProjectSchema = z.object({
    name: z.string().min(1, "Project name is required"),
    description: z.string().optional(),
});

export const updateProjectSchema = z.object({
    name: z.string().min(1, "Project name is required").optional(),
    description: z.string().optional(),
});

export const addMemberSchema = z.object({
    username: z.string().min(1, "Username is required"),
});
