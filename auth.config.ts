import type { NextAuthConfig } from "next-auth";

/**
 * Edge-veilige basisconfig (gebruikt in proxy.ts én auth.ts). GEEN database-
 * imports hier: de proxy draait op de edge-runtime. De DB-gebonden checks
 * (wachtwoordwijziging invalideert sessies) zitten in auth.ts en draaien in
 * elke `auth()`-aanroep op Node (admin-layout en server actions).
 */
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60; // 8 uur — admin-sessies verlopen dagelijks

export const authConfig = {
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS },
  jwt: { maxAge: SESSION_MAX_AGE_SECONDS },
  pages: { signIn: "/admin/login" },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnAdmin = nextUrl.pathname.startsWith("/admin");
      const isOnLogin = nextUrl.pathname === "/admin/login";
      if (isOnAdmin && !isOnLogin) return isLoggedIn;
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        // Moment van de laatste wachtwoordwijziging bij inloggen (ms-epoch, 0 =
        // nooit). auth.ts vergelijkt dit later met de actuele DB-waarde.
        token.pwdAt = (user as { pwdAt?: number }).pwdAt ?? 0;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        (session.user as { id: string }).id = token.id as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
