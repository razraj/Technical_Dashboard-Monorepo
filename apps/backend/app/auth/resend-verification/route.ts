import { resendVerificationSchema } from "@/common/ZodSchema";
import { sendSignupVerificationEmail } from "@/lib/email";
import prisma from "@/lib/db";
import { randomBytes } from "crypto";
import { NextResponse } from "next/server";

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
    try {
        const raw = await request.json();
        const parsed = resendVerificationSchema.safeParse(raw);
        if (!parsed.success) {
            return NextResponse.json({ error: "Invalid request" }, { status: 400 });
        }
        const { email } = parsed.data;

        const user = await prisma.user.findUnique({
            where: { email },
            select: {
                id: true,
                emailVerified: true,
                password: true
            }
        });

        if (!user?.password) {
            return NextResponse.json({ message: "If an account exists, a verification email will be sent." });
        }
        if (user.emailVerified) {
            return NextResponse.json({ message: "If an account exists, a verification email will be sent." });
        }

        const emailVerificationToken = randomBytes(32).toString("hex");
        const emailVerificationExp = new Date(Date.now() + VERIFICATION_TTL_MS);
        await prisma.user.update({
            where: { id: user.id },
            data: { emailVerificationToken, emailVerificationExp }
        });

        try {
            await sendSignupVerificationEmail(email, emailVerificationToken);
        } catch (e) {
            console.error("Resend verification email failed:", e);
            return NextResponse.json({ error: "Could not send email" }, { status: 503 });
        }

        return NextResponse.json({ message: "If an account exists, a verification email will be sent." });
    } catch (error) {
        console.error("Resend verification error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
