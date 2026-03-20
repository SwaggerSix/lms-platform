import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { validateBody, updateMicroScheduleSchema } from "@/lib/validations";

export async function GET(request: NextRequest) {
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const service = createServiceClient();

  const { data, error } = await service
    .from("microlearning_schedules")
    .select("*")
    .eq("user_id", auth.user.id)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Microlearning schedule GET error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Return defaults if no schedule exists
  const schedule = data || {
    frequency: "daily",
    preferred_time: "09:00",
    topics: [],
    max_per_day: 3,
    is_active: true,
  };

  return NextResponse.json(schedule);
}

export async function PUT(request: NextRequest) {
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validateBody(updateMicroScheduleSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const service = createServiceClient();

  // Check if schedule already exists
  const { data: existing } = await service
    .from("microlearning_schedules")
    .select("id")
    .eq("user_id", auth.user.id)
    .single();

  let data;
  let error;

  if (existing) {
    const result = await service
      .from("microlearning_schedules")
      .update(validation.data)
      .eq("user_id", auth.user.id)
      .select()
      .single();
    data = result.data;
    error = result.error;
  } else {
    const result = await service
      .from("microlearning_schedules")
      .insert({ ...validation.data, user_id: auth.user.id })
      .select()
      .single();
    data = result.data;
    error = result.error;
  }

  if (error) {
    console.error("Microlearning schedule PUT error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(data);
}
