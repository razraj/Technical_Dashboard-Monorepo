import { TimesheetStatus } from "@repo/db";
import { z } from "zod";

export const loginRequestSchema = z.object({
    username: z.string().email(),
    password: z.string().min(8)
});

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const createTimesheetSchema = z.object({
    title: z.string().min(1),
    notes: z.string().optional(),
    periodStart: isoDateSchema,
    periodEnd: isoDateSchema,
    status: z.nativeEnum(TimesheetStatus).optional()
});

export const updateTimesheetSchema = z
    .object({
        title: z.string().min(1).optional(),
        notes: z.string().nullable().optional(),
        periodStart: isoDateSchema.optional(),
        periodEnd: isoDateSchema.optional(),
        status: z.nativeEnum(TimesheetStatus).optional(),
        submittedAt: z.string().datetime().nullable().optional()
    })
    .refine((data) => Object.keys(data).length > 0, {
        message: "At least one field is required"
    });

export const createTimesheetEntrySchema = z.object({
    workDate: isoDateSchema,
    hours: z.number().positive().max(99.99),
    startTime: z.string().datetime().optional(),
    endTime: z.string().datetime().optional(),
    isOvertime: z.boolean().optional(),
    description: z.string().optional()
});

export const updateTimesheetEntrySchema = z
    .object({
        workDate: isoDateSchema.optional(),
        hours: z.number().positive().max(99.99).optional(),
        startTime: z.string().datetime().nullable().optional(),
        endTime: z.string().datetime().nullable().optional(),
        isOvertime: z.boolean().optional(),
        description: z.string().nullable().optional()
    })
    .refine((data) => Object.keys(data).length > 0, {
        message: "At least one field is required"
    });
