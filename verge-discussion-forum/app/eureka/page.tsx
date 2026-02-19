"use client";
import { useSession } from "next-auth/react";
import ClientLayout from "../client-layout";
import ForumLayout from "../forum_layout/ForumLayout";
import EurekaEnhanced from "./EurekaEnhanced";

export default function EurekaPage() {
  const { data: session } = useSession();
  const userId = session?.userId || "test-user-1";

  return (
    <ClientLayout>
      <ForumLayout userId={userId} currentUser={session?.user || undefined}>
        <EurekaEnhanced />
      </ForumLayout>
    </ClientLayout>
  );
}
