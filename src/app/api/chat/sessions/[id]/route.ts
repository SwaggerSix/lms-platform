import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const service = createServiceClient();

  const { data: session, error: sessionError } = await service
    .from("chat_sessions")
    .select("*")
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const { data: messages, error: msgError } = await service
    .from("chat_messages")
    .select("*")
    .eq("session_id", id)
    .order("created_at", { ascending: true });

  if (msgError) {
    console.error("Chat messages GET error:", msgError.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ session, messages: messages || [] });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const service = createServiceClient();

  // Verify ownership
  const { data: session } = await service
    .from("chat_sessions")
    .select("user_id")
    .eq("id", id)
    .single();

  if (!session || session.user_id !== auth.user.id) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const { error } = await service
    .from("chat_sessions")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Chat session DELETE error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ message: "Session deleted" });
}
