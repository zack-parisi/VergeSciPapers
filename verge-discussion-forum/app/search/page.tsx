import SearchClient from "./SearchClient";
import ClientLayout from "../client-layout";
import { headers } from "next/headers";

export default async function SearchPage() {
  const hdrs = await headers();
  const proto =
    hdrs.get("x-forwarded-proto") ||
    (process.env.NODE_ENV === "development" ? "http" : "https");
  const host =
    hdrs.get("x-forwarded-host") || hdrs.get("host") || "localhost:3000";
  const baseUrl = `${proto}://${host}`;

  let subfields: any[] = [];
  try {
    const res = await fetch(
      `${baseUrl}/api/subfields?limit=10000&includeAll=true`,
      { cache: "no-store" }
    );
    if (res.ok) {
      const data = await res.json();
      subfields = (data && (data.subfields || data)) || [];
    }
  } catch (err) {
    subfields = [];
  }

  return (
    <ClientLayout>
      <SearchClient subfields={subfields} />
    </ClientLayout>
  );
}
