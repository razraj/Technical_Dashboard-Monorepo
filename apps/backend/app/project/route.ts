import prisma from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { createProjectSchema } from "@/lib/zod-schemas";
import { Prisma } from "@repo/db";

export async function GET(req: NextRequest) {
    try {
        const callerId = req.headers.get("x-user-id");
        if (!callerId) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const caller = await prisma.user.findUnique({
            where: { id: callerId },
            select: { role: true }
        });

        if (!caller) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const whereClause: Prisma.ProjectWhereInput = { deletedAt: null };
        if (caller.role !== "ADMIN") {
            whereClause.OR = [
                { managerId: callerId },
                { members: { some: { userId: callerId } } }
            ];
        }

        const projects = await prisma.project.findMany({
            where: whereClause,
            select: { id: true, name: true, description: true },
            orderBy: { name: "asc" }
        });

        return NextResponse.json({ projects }, { status: 200 });
    } catch (error) {
        console.log("🚀 ~ GET /project ~ error:", error);
        return NextResponse.json({ message: "Error fetching projects" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const callerId = req.headers.get("x-user-id");
        if (!callerId) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const caller = await prisma.user.findUnique({
            where: { id: callerId },
            select: { role: true }
        });

        if (!caller || (caller.role !== "ADMIN" && caller.role !== "MANAGER")) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        const body = await req.json();
        const parsed = createProjectSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ message: "Invalid data", errors: parsed.error.errors }, { status: 400 });
        }

        const project = await prisma.project.create({
            data: {
                name: parsed.data.name,
                description: parsed.data.description,
                managerId: callerId
            }
        });

        return NextResponse.json({ message: "Project created", project }, { status: 201 });
    } catch (error) {
        console.log("🚀 ~ POST /project ~ error:", error);
        return NextResponse.json({ message: "Error creating project" }, { status: 500 });
    }
}
