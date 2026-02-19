import NetworkClient from "./NetworkClient";
import ClientLayout from "../client-layout";

export default async function NetworkPage() {
  return (
    <ClientLayout>
      <NetworkClient userData={null} />
    </ClientLayout>
  );
}
