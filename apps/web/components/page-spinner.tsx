import { Loader2 } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";

type PageSpinnerProps = {
    className?: string;
    label?: string;
};

/** Centered loading indicator for route transitions and auth checks. */
export function PageSpinner({ className, label = "Loading" }: PageSpinnerProps) {
    return (
        <div
            className={cn("flex items-center justify-center", className)}
            role="status"
            aria-live="polite"
            aria-label={label}
        >
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
    );
}
