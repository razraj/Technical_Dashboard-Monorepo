export function FormFieldError({ errors }: { errors: unknown[] }) {
    if (!errors.length) return null;
    const messages = errors
        .map((error) => (typeof error === "string" ? error : error != null ? String(error) : ""))
        .filter(Boolean);
    if (!messages.length) return null;
    return (
        <p className="text-sm text-destructive" role="alert">
            {messages.join(", ")}
        </p>
    );
}
