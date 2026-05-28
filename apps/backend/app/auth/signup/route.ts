import { signupRequestSchema } from "@/common/ZodSchema";
import { sendSignupVerificationEmail } from "@/lib/email";
import prisma from "@/lib/db";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { NextResponse } from "next/server";

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
    try {
        const raw = await request.json();
        const parsed = signupRequestSchema.safeParse(raw);
        if (!parsed.success) {
            return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
        }
        const { email, password, username, firstName, lastName } = parsed.data;

        const [emailTaken, usernameTaken] = await Promise.all([
            prisma.user.findUnique({ where: { email }, select: { id: true } }),
            prisma.user.findUnique({ where: { username }, select: { id: true } })
        ]);
        if (emailTaken) {
            return NextResponse.json({ error: "Email already registered" }, { status: 409 });
        }
        if (usernameTaken) {
            return NextResponse.json({ error: "Username already taken" }, { status: 409 });
        }

        const hashedPassword = bcrypt.hashSync(password, 10);
        const emailVerificationToken = randomBytes(32).toString("hex");
        const emailVerificationExp = new Date(Date.now() + VERIFICATION_TTL_MS);

        await prisma.user.create({
            data: {
                email,
                username,
                password: hashedPassword,
                firstName,
                lastName,
                emailVerificationToken,
                emailVerificationExp
            },
            select: { id: true }
        });

        try {
            await sendSignupVerificationEmail(email, emailVerificationToken);
        } catch (e) {
            console.error("Verification email failed:", e);
            return NextResponse.json(
                { error: "Account created but verification email could not be sent. Try resend or contact support." },
                { status: 503 }
            );
        }

        return NextResponse.json(
            { message: "Check your email to verify your account before signing in.", email },
            { status: 201 }
        );
    } catch (error) {
        console.error("Signup error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
