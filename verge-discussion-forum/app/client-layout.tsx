"use client";
import { createContext, useContext } from "react";
import { SessionProvider } from "next-auth/react";
import { usePathname } from "next/navigation";
import LegalWidgets from "./components/LegalWidgets";
import EurekaFloatingWidget from "./components/EurekaFloatingWidget";
import { UnbookmarkProvider } from "./contexts/UnbookmarkContext";

const ClientLayoutContext = createContext(false);

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isEurekaPage = pathname?.startsWith("/eureka");
  const isNested = useContext(ClientLayoutContext);

  const content = (
    <ClientLayoutContext.Provider value={true}>
      {children}
      {!isNested && (
        <>
          <LegalWidgets />
          {!isEurekaPage && <EurekaFloatingWidget />}
        </>
      )}
    </ClientLayoutContext.Provider>
  );

  if (isNested) {
    return content;
  }

  return (
    <SessionProvider>
      <UnbookmarkProvider>{content}</UnbookmarkProvider>
    </SessionProvider>
  );
}
