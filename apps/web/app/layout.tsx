import { Providers } from "@/components/providers";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@repo/ui/components/sonner";
import "@repo/ui/globals.css";
import { Roboto } from "next/font/google";

const roboto = Roboto({
    weight: "400",
    subsets: ["latin"]
});

export default function RootLayout({
    children
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" className={roboto.className} suppressHydrationWarning>
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
