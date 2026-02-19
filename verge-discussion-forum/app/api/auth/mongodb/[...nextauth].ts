import NextAuth, { NextAuthOptions, Session, User as NextAuthUser } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { getUsersCollection } from "../../../../lib/mongodb-user-interactions";
import { compare } from "bcrypt";
import { SessionStrategy } from "next-auth";

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          console.error("Missing credentials");
          return null;
        }
        
        try {
          const usersCollection = await getUsersCollection();
          
          // Find user by email
          const user = await usersCollection.findOne({ email: credentials.email });
          if (!user) {
            console.error("No user found with email:", credentials.email);
            return null;
          }
          
          if (!user.emailVerified) {
            console.error("Email not verified for user:", credentials.email);
            return null;
          }
          
          // Compare password
          const isValid = await compare(credentials.password, user.passwordHash);
          if (!isValid) {
            console.error("Invalid password for user:", credentials.email);
            return null;
          }
          
          console.log("Authentication successful for user:", credentials.email);
          return {
            id: user.id,
            email: user.email,
            name: user.firstName ? `${user.firstName} ${user.lastName || ''}` : user.email,
          };
        } catch (error) {
          console.error("Authentication error:", error);
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: "jwt" as SessionStrategy,
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async session({ session, token }) {
      try {
        // Expose userId on session
        if (token?.id) {
          (session as any).userId = token.id;
        }
        return session;
      } catch (error) {
        console.error("Session callback error:", error);
        return session;
      }
    },
    async jwt({ token, user }) {
      try {
        if (user) {
          token.id = user.id;
        }
        return token;
      } catch (error) {
        console.error("JWT callback error:", error);
        return token;
      }
    },
  },
  secret: process.env.NEXTAUTH_SECRET || "fallback-secret-for-development",
  debug: process.env.NODE_ENV === "development",
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST }; 