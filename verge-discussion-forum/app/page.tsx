import { redirect } from "next/navigation";

export default function Home() {
  redirect("/eureka");
  return null;
}
