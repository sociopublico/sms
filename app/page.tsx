import { redirect } from "next/navigation";
import { getSessionProfile, homePathForRole } from "@/lib/auth";

export default async function Home() {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  redirect(homePathForRole(session.appRole));
}
