import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CapstoneClient from "./capstone-client";

export const metadata: Metadata = {
  title: "Capstone hand-in | LMS Platform",
  description: "Hand in your capstone work for marking",
};

export default async function CapstonePage({ params }: { params: Promise<{ certificationId: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { certificationId } = await params;
  return <CapstoneClient certificationId={certificationId} />;
}
