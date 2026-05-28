import { forgotPasswordRequestSchema } from "@/common/ZodSchema";
import { sendPasswordResetEmail } from "@/lib/email";
import prisma from "@/lib/db";
import { randomBytes } from "crypto";
import { NextResponse } from "next/server";

const RESET_TTL_MS = 60 * 60 * 1000;

const genericMessage = { message: "If an account exists for that email, you will receive password reset instructions shortly." };

export async function POST(request: Request) {
    try {
        const raw = await request.json();
        const parsed = forgotPasswordRequestSchema.safeParse(raw);
        if (!parsed.success) {
            return NextResponse.json({ error: "Invalid request" }, { status: 400 });
        }
        const { email } = parsed.data;

        const user = await prisma.user.findUnique({
            where: { email },
            select: { id: true, password: true }
        });

        if (!user?.password) {
            return NextResponse.json(genericMessage);
        }

        const resetToken = randomBytes(32).toString("hex");
        const resetTokenExp = new Date(Date.now() + RESET_TTL_MS);
        await prisma.user.update({
            where: { id: user.id },
            data: { resetToken, resetTokenExp }
        });

        try {
            await sendPasswordResetEmail(email, resetToken);
        } catch (e) {
            console.error("Password reset email failed:", e);
            return NextResponse.json({ error: "Could not send email. Try again later." }, { status: 503 });
        }

        return NextResponse.json(genericMessage);
    } catch (error) {
        console.error("Forgot password error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
