import prisma from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { createProjectSchema } from "@/common/ZodSchema";
import {
    forbiddenResponse,
    getCaller,
    projectListWhere,
    unauthorizedResponse,
} from "@/lib/caller";

export async function GET(req: NextRequest): Promise<NextResponse> {
    try {
        const caller = await getCaller(req.headers.get("x-user-id"));
        if (!caller) {
            return unauthorizedResponse();
        }

        const projects = await prisma.project.findMany({
            where: projectListWhere(caller.role, caller.id),
            select: {
                id: true,
                name: true,
                description: true,
                _count: { select: { members: true } },
            },
            orderBy: { name: "asc" },
        });

        return NextResponse.json(
            {
                projects: projects.map(({ _count, ...project }) => ({
                    ...project,
                    memberCount: _count.members,
                })),
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("GET /project error:", error);
        return NextResponse.json({ message: "Error fetching projects" }, { status: 500 });
    }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
    try {
        const caller = await getCaller(req.headers.get("x-user-id"));
        if (!caller) {
            return unauthorizedResponse();
        }

        if (caller.role !== "ADMIN" && caller.role !== "MANAGER") {
            return forbiddenResponse();
        }

        const body = await req.json();
        const parsed = createProjectSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ message: "Invalid data", errors: parsed.error.errors }, { status: 400 });
        }

        const project = await prisma.$transaction(async (tx) => {
            const created = await tx.project.create({
                data: {
                    name: parsed.data.name,
                    description: parsed.data.description,
                    managerId: caller.id,
                },
            });

            await tx.projectMember.create({
                data: {
                    userId: caller.id,
                    projectId: created.id,
                },
            });

            return created;
        });

        return NextResponse.json({ message: "Project created", project }, { status: 201 });
    } catch (error) {
        console.error("POST /project error:", error);
        return NextResponse.json({ message: "Error creating project" }, { status: 500 });
    }
}
