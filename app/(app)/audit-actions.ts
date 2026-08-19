"use server";

import { logPageView as writePageView } from "@/lib/audit";

export async function logPageView(path: string) {
  await writePageView(path);
}
