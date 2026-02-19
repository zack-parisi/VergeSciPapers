import NextAuth from "next-auth";
import { authOptions } from "../mongodb/[...nextauth]";

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST }; 