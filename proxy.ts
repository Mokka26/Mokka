// Next.js 16: "middleware" is hernoemd naar "proxy". Inhoud identiek.
import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/admin/:path*"],
};
