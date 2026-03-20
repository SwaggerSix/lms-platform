import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * POST /api/push/subscribe
 * Store a push subscription for the authenticated user.
 * Expects body: { subscription: { endpoint, keys: { p256dh, auth } } }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { subscription } = body;

    if (
      !subscription ||
      !subscription.endpoint ||
      !subscription.keys?.p256dh ||
      !subscription.keys?.auth
    ) {
      return NextResponse.json(
        { error: "Invalid subscription data. Requires endpoint, keys.p256dh, and keys.auth." },
        { status: 400 }
      );
    }

    const service = createServiceClient();

    // Look up the internal user
    const { data: dbUser } = await service
      .from("users")
      .select("id")
      .eq("auth_id", user.id)
      .single();

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Upsert push subscription with separate key columns
    const { error: upsertError } = await service
      .from("push_subscriptions")
      .upsert(
        {
          user_id: dbUser.id,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          created_at: new Date().toISOString(),
        },
        { onConflict: "endpoint" }
      );

    if (upsertError) {
      // Table might not exist yet -- store in user metadata as fallback
      console.warn(
        "push_subscriptions table not available, storing in user metadata:",
        upsertError.message
      );

      const { error: metaError } = await service
        .from("users")
        .update({
          metadata: {
            push_subscription: {
              endpoint: subscription.endpoint,
              keys: subscription.keys,
              updated_at: new Date().toISOString(),
            },
          },
        })
        .eq("id", dbUser.id);

      if (metaError) {
        return NextResponse.json(
          { error: "Failed to save subscription" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Push subscribe error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/push/subscribe
 * Remove a push subscription for the authenticated user.
 * Expects body: { endpoint: string }
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { endpoint } = body;

    if (!endpoint) {
      return NextResponse.json(
        { error: "Endpoint is required" },
        { status: 400 }
      );
    }

    const service = createServiceClient();

    const { data: dbUser } = await service
      .from("users")
      .select("id")
      .eq("auth_id", user.id)
      .single();

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Try to delete from push_subscriptions table
    const { error: deleteError } = await service
      .from("push_subscriptions")
      .delete()
      .eq("user_id", dbUser.id)
      .eq("endpoint", endpoint);

    if (deleteError) {
      // Fallback: clear from user metadata
      await service
        .from("users")
        .update({ metadata: { push_subscription: null } })
        .eq("id", dbUser.id);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Push unsubscribe error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
