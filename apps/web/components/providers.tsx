"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider as NextThemesProvider } from "next-themes";

function makeQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 30_000,
                retry: 1,
            },
        },
    });
}

export function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = React.useState(makeQueryClient);

    return (
        <QueryClientProvider client={queryClient}>
            <NextThemesProvider
                attribute="class"
                defaultTheme="system"
                enableSystem
                disableTransitionOnChange
                enableColorScheme
            >
                {children}
            </NextThemesProvider>
        </QueryClientProvider>
    );
}
