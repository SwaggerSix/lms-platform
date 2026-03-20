import { authorize } from "@/lib/auth/authorize";
import { redirect } from "next/navigation";
import AICreateClient from "./ai-create-client";

export default async function AICreateCoursePage() {
  const auth = await authorize("admin", "instructor");
  if (!auth.authorized) redirect("/login");

  const hasApiKey = !!process.env.ANTHROPIC_API_KEY;

  return <AICreateClient hasApiKey={hasApiKey} />;
}
