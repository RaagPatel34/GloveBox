import { cookies } from "next/headers";
import { VISITOR_COOKIE, VISITOR_COOKIE_MAX_AGE } from "./visitor";

// Server actions that save a car also (re)issue the visitor cookie, so the next render
// finds that car. The client sets the same cookie itself on first visit (useVisitorId);
// this covers browsers where that write was lost.
export async function setVisitorCookie(visitorId: string): Promise<void> {
  (await cookies()).set(VISITOR_COOKIE, visitorId, {
    maxAge: VISITOR_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}
