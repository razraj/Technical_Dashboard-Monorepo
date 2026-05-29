import { z } from "zod";

export const loginRequestSchema = z.object({
    username: z.string().email(),
    password: z.string().min(8)
});

export const signupRequestSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    username: z.string().min(3),
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    profilePic: z.string().url().optional()
});

export const forgotPasswordRequestSchema = z.object({
    email: z.string().email()
});

export const resendVerificationSchema = z.object({
    email: z.string().email()
});

export const resetPasswordSchema = z.object({
    token: z.string().min(1),
    password: z.string().min(8)
});

export const contactFormSchema = z.object({
    name: z.string().min(2, { message: "Please enter your name" }),
    email: z.string().email({ message: "Please enter a valid email address" }),
    message: z.string().min(10, { message: "Please make sure your message is at least 10 characters long." })
});

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const weeksQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10),
    userId: z.string().min(1).optional()
});

export const weekDetailQuerySchema = z.object({
    userId: z.string().min(1).optional()
});

export const createEntrySchema = z.object({
    date: isoDateSchema,
    projectId: z.string().min(1),
    workType: z.string().min(1),
    description: z.string().min(1),
    hours: z.number().positive().max(24)
});

export const updateEntrySchema = z
    .object({
        date: isoDateSchema.optional(),
        projectId: z.string().min(1).optional(),
        workType: z.string().min(1).optional(),
        description: z.string().min(1).optional(),
        hours: z.number().positive().max(24).optional()
    })
    .refine((data) => Object.keys(data).length > 0, {
        message: "At least one field is required"
    });
