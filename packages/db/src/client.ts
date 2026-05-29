import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client";

/** Neon/libpq SSL compatibility (see PostgreSQL libpq-ssl docs). */
function connectionString(): string {
    const url = process.env.DATABASE_URL;
    if (!url) {
        throw new Error("DATABASE_URL is required");
    }
    if (url.includes("sslmode=require") && !url.includes("uselibpqcompat")) {
        const sep = url.includes("?") ? "&" : "?";
        return `${url}${sep}uselibpqcompat=true`;
    }
    return url;
}

const adapter = new PrismaPg({
    connectionString: connectionString()
});

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
    globalForPrisma.prisma ||
    new PrismaClient({
        adapter
    });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
