import { Prisma, Task, User, Project } from "@repo/db";

type TransactionClient = Prisma.TransactionClient;

// ─── Serialised shapes ────────────────────────────────────────────────────────

export type SerializedUserBrief = {
    id: string;
    firstName: string | null;
    lastName: string | null;
    profilePic: string | null;
};

export type SerializedProjectBrief = {
    id: string;
    name: string;
    color: string | null;
    status: string;
};

export type SerializedTask = {
    id: string;
    projectId: string;
    title: string;
    description: string | null;
    type: string;
    status: string;
    priority: string;
    estimatedHours: number | null;
    loggedHours: number;
    startDate: string | null;
    dueDate: string | null;
    completedAt: string | null;
    assignedToId: string | null;
    assignedById: string | null;
    createdById: string;
    isDeleted: boolean;
    createdAt: string;
    updatedAt: string;
};

export type SerializedTaskWithRelations = SerializedTask & {
    project: SerializedProjectBrief;
    createdBy: SerializedUserBrief;
    assignedBy: SerializedUserBrief | null;
};

// ─── Serializers ─────────────────────────────────────────────────────────────

export function serializeUserBrief(
    user: Pick<User, "id" | "firstName" | "lastName" | "profilePic">
): SerializedUserBrief {
    return {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        profilePic: user.profilePic,
    };
}

export function serializeProjectBrief(
    project: Pick<Project, "id" | "name" | "color" | "status">
): SerializedProjectBrief {
    return {
        id: project.id,
        name: project.name,
        color: project.color,
        status: project.status,
    };
}

export function serializeTask(
    task: Task & {
        project: Pick<Project, "id" | "name" | "color" | "status">;
        createdBy: Pick<User, "id" | "firstName" | "lastName" | "profilePic">;
        assignedBy: Pick<User, "id" | "firstName" | "lastName" | "profilePic"> | null;
    }
): SerializedTaskWithRelations {
    return {
        id: task.id,
        projectId: task.projectId,
        title: task.title,
        description: task.description,
        type: task.type,
        status: task.status,
        priority: task.priority,
        estimatedHours: task.estimatedHours ? task.estimatedHours.toNumber() : null,
        loggedHours: task.loggedHours.toNumber(),
        startDate: task.startDate ? task.startDate.toISOString().slice(0, 10) : null,
        dueDate: task.dueDate ? task.dueDate.toISOString().slice(0, 10) : null,
        completedAt: task.completedAt ? task.completedAt.toISOString() : null,
        assignedToId: task.assignedToId,
        assignedById: task.assignedById,
        createdById: task.createdById,
        isDeleted: task.isDeleted,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
        project: serializeProjectBrief(task.project),
        createdBy: serializeUserBrief(task.createdBy),
        assignedBy: task.assignedBy ? serializeUserBrief(task.assignedBy) : null,
    };
}

// ─── Denormalised rollup ──────────────────────────────────────────────────────

/**
 * Recomputes Task.loggedHours as the DB-side sum of all TimesheetEntry.hours
 * for this task. Call inside the same transaction as any entry create/update/delete.
 */
export async function recomputeTaskLoggedHours(
    taskId: string,
    tx: TransactionClient
): Promise<void> {
    const result = await tx.timesheetEntry.aggregate({
        where: { taskId },
        _sum: { hours: true },
    });
    const loggedHours = result._sum.hours ?? new Prisma.Decimal(0);
    await tx.task.update({
        where: { id: taskId },
        data: { loggedHours },
    });
}

// ─── Prisma select shape (reused by both API-1 and API-2) ────────────────────

export const taskWithRelationsSelect = {
    id: true,
    projectId: true,
    title: true,
    description: true,
    type: true,
    status: true,
    priority: true,
    estimatedHours: true,
    loggedHours: true,
    startDate: true,
    dueDate: true,
    completedAt: true,
    assignedToId: true,
    assignedById: true,
    createdById: true,
    isDeleted: true,
    createdAt: true,
    updatedAt: true,
    project: {
        select: { id: true, name: true, color: true, status: true },
    },
    createdBy: {
        select: { id: true, firstName: true, lastName: true, profilePic: true },
    },
    assignedBy: {
        select: { id: true, firstName: true, lastName: true, profilePic: true },
    },
} as const;
