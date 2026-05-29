import prisma from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    try {
        const callerId = req.headers.get("x-user-id");
        if (!callerId) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const projects = await prisma.project.findMany({
            where: { deletedAt: null },
            select: { id: true, name: true },
            orderBy: { name: "asc" }
        });

        return NextResponse.json({ projects }, { status: 200 });
    } catch (error) {
        console.log("🚀 ~ GET /project ~ error:", error);
        return NextResponse.json({ message: "Error fetching projects" }, { status: 500 });
    }
}
