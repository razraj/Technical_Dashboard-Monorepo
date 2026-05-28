import { contactFormSchema } from "@/common/ZodSchema";
import { sendEmail } from "@/lib/email";
import { NextRequest, NextResponse } from "next/server";

type ContactFormValues = {
    name: string;
    email: string;
    message: string;
};

type FieldErrors = Partial<Record<keyof ContactFormValues, string>>;

function escapeHtml(value: string): string {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderContactFormPage(options?: {
    values?: ContactFormValues;
    fieldErrors?: FieldErrors;
    formError?: string;
    success?: boolean;
}): string {
    const values =
        (options?.values ?? process.env.NODE_ENV === "production")
            ? { name: "", email: "", message: "" }
            : { name: "name", email: "raikarrajat@gmail.com", message: "some empty message" };
    const fieldErrors = options?.fieldErrors ?? {};
    const formError = options?.formError;
    const success = options?.success;

    const errorBlock = (field: keyof ContactFormValues) =>
        fieldErrors[field] ? `<p class="field-error" role="alert">${escapeHtml(fieldErrors[field]!)}</p>` : "";

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Contact us</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      margin: 0;
      min-height: 100vh;
      background: #f8fafc;
      color: #0f172a;
      line-height: 1.5;
    }
    .wrap {
      max-width: 40rem;
      margin: 0 auto;
      padding: 2rem 1rem 3rem;
    }
    h1 { font-size: 1.75rem; margin: 0 0 0.5rem; }
    .subtitle { color: #64748b; margin: 0 0 1.5rem; }
    form {
      display: grid;
      gap: 1.25rem;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 0.75rem;
      padding: 1.5rem;
      box-shadow: 0 1px 2px rgb(15 23 42 / 0.05);
    }
    label {
      display: block;
      font-weight: 600;
      margin-bottom: 0.375rem;
    }
    input, textarea {
      width: 100%;
      font: inherit;
      padding: 0.625rem 0.75rem;
      border: 1px solid #cbd5e1;
      border-radius: 0.5rem;
      background: #fff;
    }
    input:focus, textarea:focus {
      outline: 2px solid #3b82f6;
      outline-offset: 1px;
      border-color: #3b82f6;
    }
    textarea { min-height: 8rem; resize: vertical; }
    .field-error { color: #b91c1c; font-size: 0.875rem; margin: 0.375rem 0 0; }
    .banner {
      padding: 0.75rem 1rem;
      border-radius: 0.5rem;
      margin-bottom: 1rem;
      font-size: 0.9375rem;
    }
    .banner-success { background: #dcfce7; color: #166534; border: 1px solid #86efac; }
    .banner-error { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
    button {
      font: inherit;
      font-weight: 600;
      padding: 0.75rem 1rem;
      border: none;
      border-radius: 0.5rem;
      background: #0f172a;
      color: #fff;
      cursor: pointer;
    }
    button:hover { background: #1e293b; }
    button:disabled { opacity: 0.6; cursor: not-allowed; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Contact us</h1>
    <p class="subtitle">Send us a message and we will get back to you.</p>
    ${success ? `<div class="banner banner-success" role="status">Application submitted successfully.</div>` : ""}
    ${formError ? `<div class="banner banner-error" role="alert">${escapeHtml(formError)}</div>` : ""}
    <form method="post" action="/contact-form" novalidate>
      <div>
        <label for="name">Enter your good name here</label>
        <input
          id="name"
          name="name"
          type="text"
          placeholder="John Doe"
          required
          minlength="2"
          value="${escapeHtml(values.name)}"
        />
        ${errorBlock("name")}
      </div>
      <div>
        <label for="email">Enter your email address</label>
        <input
          id="email"
          name="email"
          type="email"
          placeholder="john@example.com"
          required
          value="${escapeHtml(values.email)}"
        />
        ${errorBlock("email")}
      </div>
      <div>
        <label for="message">Enter your message here</label>
        <textarea
          id="message"
          name="message"
          placeholder="My question is which framework do you prefer to use?"
          required
          minlength="2"
        >${escapeHtml(values.message)}</textarea>
        ${errorBlock("message")}
      </div>
      <button type="submit">Send</button>
    </form>
  </div>
</body>
</html>`;
}

function htmlResponse(html: string, status = 200) {
    return new NextResponse(html, {
        status,
        headers: { "Content-Type": "text/html; charset=utf-8" }
    });
}

export async function GET() {
    return htmlResponse(renderContactFormPage());
}

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const raw = {
            name: String(formData.get("name") ?? "").trim(),
            email: String(formData.get("email") ?? "").trim(),
            message: String(formData.get("message") ?? "").trim()
        };

        const parsed = contactFormSchema.safeParse(raw);
        if (!parsed.success) {
            const fieldErrors: FieldErrors = {};
            for (const issue of parsed.error.issues) {
                const field = issue.path[0];
                if (field === "name" || field === "email" || field === "message") {
                    fieldErrors[field] = issue.message;
                }
            }
            return htmlResponse(
                renderContactFormPage({
                    values: { name: raw.name, email: raw.email, message: raw.message },
                    fieldErrors
                }),
                400
            );
        }

        const { name, email, message } = parsed.data;
        const mailText = `Name: ${name}\nEmail: ${email}\nMessage: ${message}`;
        // TODO: Replace/update emailOptions with the actual data before production.
        await sendEmail("", "onboarding@resend.dev", "raikarrajat@gmail.com", "Contact Us Form", mailText);
        return htmlResponse(
            renderContactFormPage({
                values: { name: "string", email: "string", message: "string" },
                success: true
            })
        );
    } catch (error) {
        console.error("Contact form error:", error);
        return htmlResponse(
            renderContactFormPage({
                formError: "Failed to send application."
            }),
            500
        );
    }
}
