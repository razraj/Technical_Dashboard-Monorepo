import "@repo/ui/globals.css";

import { ThemeProvider } from "@/components/theme-provider";
import { Providers } from "@/components/providers";
import { Toaster } from "@repo/ui/components/sonner";

export default function RootLayout({
    children
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body>
                <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
                    <main>
                        <Providers>{children}</Providers>
                    </main>
                    <Toaster position="top-right" closeButton={true} duration={3000} />
                </ThemeProvider>
            </body>
        </html>
    );
}
