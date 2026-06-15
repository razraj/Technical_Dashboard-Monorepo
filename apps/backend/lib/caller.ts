import prisma from "@/lib/db";
import { Prisma, Role } from "@repo/db";
import { NextResponse } from "next/server";

export type Caller = {
    id: string;
    role: Role;
};

export async function getCaller(callerId: string | null): Promise<Caller | null> {
    if (!callerId) return null;
    return prisma.user.findUnique({
        where: { id: callerId },
        select: { id: true, role: true },
    });
}

export function unauthorizedResponse(): NextResponse {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
}

export function forbiddenResponse(): NextResponse {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
}

export function projectListWhere(role: Role, callerId: string): Prisma.ProjectWhereInput {
    const where: Prisma.ProjectWhereInput = { deletedAt: null };
    if (role === "EMPLOYEE") {
        where.members = { some: { userId: callerId } };
    }
    return where;
}

export async function canLogTimeToProject(
    callerId: string,
    role: Role,
    projectId: string
): Promise<boolean> {
    if (role === "ADMIN" || role === "MANAGER") return true;

    const project = await prisma.project.findFirst({
        where: {
            id: projectId,
            deletedAt: null,
            members: { some: { userId: callerId } },
        },
        select: { id: true },
    });
    return project !== null;
}

export function isPrismaKnownError(
    error: unknown,
    code: string
): error is Prisma.PrismaClientKnownRequestError {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}
