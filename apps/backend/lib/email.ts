import { emailVerificationHtml } from "@/common/emailer-html/email-verification";
import { passwordResetHtml } from "@/common/emailer-html/password-reset";
import { backendUrl } from "@/utils/auth";
import { Resend } from "resend";

function verificationLink(token: string): string {
    const base = `${backendUrl}/auth/verify-email`;
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}token=${encodeURIComponent(token)}`;
}

// TODO: Replace/update emailOptions with the actual data before production.
export async function sendEmail(link: string, from: string, to: string, subject: string, html: string) {
    if (process.env.NODE_ENV !== "production" && false) {
        console.info("[email:dev] Password reset link for", to, link);
        return;
    }
    const resend = new Resend(process.env.RESEND_API_KEY);
    // Build the email options
    const emailOptions: Parameters<typeof resend.emails.send>[0] = {
        from: from,
        to: [to],   
        subject: subject,
        html: html
    };
    // Send the email using Resend
    const { data, error } = await resend.emails.send(emailOptions);
    if (error) {
        throw new Error(`Email sending error: ${error.message}`);
    }
    if (process.env.NODE_ENV !== "production") {
        console.info("[email:dev] Verification link for", to, link, "has been sent");
        return;
    }
    console.log(`Email ${data?.id} has been sent`);
}

export async function sendSignupVerificationEmail(to: string, token: string): Promise<void> {
    const link = verificationLink(token);
    // TODO: Replace/update emailOptions with the actual data before production.
    await sendEmail(link, "onboarding@resend.dev", "raikarrajat@gmail.com", "Verify your email", emailVerificationHtml(link));
}

function passwordResetLink(token: string): string {
    const base = backendUrl;
    return `${base}/reset-password?token=${encodeURIComponent(token)}`;
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
    const link = passwordResetLink(token);
    // TODO: Replace/update emailOptions with the actual data before production.
    await sendEmail(link, "onboarding@resend.dev", "raikarrajat@gmail.com", "Reset your password", passwordResetHtml(link));
}
