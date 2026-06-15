import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MyClassesClient from "./my-classes-client";

export const metadata: Metadata = {
  title: "My Classes | LMS Platform",
  description: "Your scheduled classes — sessions, materials, and assessments in one place",
};

export default async function MyClassesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <MyClassesClient />;
}
