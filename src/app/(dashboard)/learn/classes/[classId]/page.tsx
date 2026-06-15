import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ClassCardClient from "./class-card-client";

export const metadata: Metadata = {
  title: "Class | LMS Platform",
};

export default async function ClassCardPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <ClassCardClient classId={classId} />;
}
