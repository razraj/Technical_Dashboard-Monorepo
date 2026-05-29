import "dotenv/config";
import { jwtVerify, SignJWT } from "jose";

const SECRET_KEY = new TextEncoder().encode(process.env.JWT_SECRET);

export const backendUrl =
    process.env.NODE_ENV === "production"
        ? `https://${process.env.DATABASE_HOST?.replace(/\/$/, "")}`
        : "http://localhost:3000";

/** Public web app origin for links in emails (reset password, verify email). */
export const webUrl =
    process.env.WEB_URL?.replace(/\/$/, "") ??
    (process.env.NODE_ENV === "production"
        ? `https://${process.env.WEB_APP_HOST?.replace(/\/$/, "") ?? "ticktock-webapp.vercel.app"}`
        : "http://localhost:3001");

export function isEmail(username: string) {
    // Basic email regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(username)) {
        return true;
    }
    return false;
}

export const generateToken = (
    user: { id: string; orgId: string; role: string },
    expiresIn: string = "15m"
): Promise<string> => {
    return new SignJWT({
        role: user.role
    })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(`${user.id}:${user.orgId}`)
        .setIssuedAt()
        .setExpirationTime(expiresIn)
        .sign(SECRET_KEY);
};

export async function verifyToken(token: string) {
    try {
        const { payload } = await jwtVerify(token, SECRET_KEY);
        return payload;
    } catch {
        return null;
    }
}
