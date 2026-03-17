"use client";

import { useEffect, useRef, useCallback } from "react";
import type { SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";

/**
 * Hook to subscribe to Supabase Realtime changes on a table.
 *
 * Usage:
 *   useRealtimeSubscription(supabase, {
 *     table: "notifications",
 *     filter: `user_id=eq.${userId}`,
 *     event: "INSERT",
 *     onData: (payload) => addNotification(payload.new),
 *   });
 */
export interface RealtimeSubscriptionOptions {
  /** Table name to subscribe to */
  table: string;
  /** Postgres change event type */
  event?: "INSERT" | "UPDATE" | "DELETE" | "*";
  /** Row-level filter (e.g., "user_id=eq.abc123") */
  filter?: string;
  /** Schema (defaults to "public") */
  schema?: string;
  /** Callback when data arrives */
  onData: (payload: {
    eventType: "INSERT" | "UPDATE" | "DELETE";
    new: Record<string, unknown>;
    old: Record<string, unknown>;
  }) => void;
  /** Whether subscription is enabled (default true) */
  enabled?: boolean;
}

export function useRealtimeSubscription(
  supabase: SupabaseClient | null,
  options: RealtimeSubscriptionOptions
) {
  const {
    table,
    event = "*",
    filter,
    schema = "public",
    onData,
    enabled = true,
  } = options;

  const channelRef = useRef<RealtimeChannel | null>(null);
  const callbackRef = useRef(onData);
  callbackRef.current = onData;

  useEffect(() => {
    if (!supabase || !enabled) return;

    const channelName = `realtime:${schema}:${table}:${filter || "all"}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes" as "system",
        {
          event,
          schema,
          table,
          ...(filter ? { filter } : {}),
        } as Record<string, unknown>,
        (payload: Record<string, unknown>) => {
          callbackRef.current({
            eventType: payload.eventType as "INSERT" | "UPDATE" | "DELETE",
            new: (payload.new || {}) as Record<string, unknown>,
            old: (payload.old || {}) as Record<string, unknown>,
          });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [supabase, table, event, filter, schema, enabled]);
}

/**
 * Hook for Supabase Realtime Presence (who's online).
 */
export interface PresenceState {
  userId: string;
  name: string;
  status: "online" | "away";
  lastSeen: string;
}

export function useRealtimePresence(
  supabase: SupabaseClient | null,
  channelName: string,
  userState: PresenceState | null,
  onSync: (presences: PresenceState[]) => void
) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const syncRef = useRef(onSync);
  syncRef.current = onSync;

  useEffect(() => {
    if (!supabase || !userState) return;

    const channel = supabase.channel(channelName, {
      config: { presence: { key: userState.userId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresenceState>();
        const users: PresenceState[] = [];
        Object.values(state).forEach((presences) => {
          if (Array.isArray(presences)) {
            presences.forEach((p) => users.push(p as unknown as PresenceState));
          }
        });
        syncRef.current(users);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track(userState);
        }
      });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [supabase, channelName, userState]);
}

/**
 * Hook for Supabase Realtime Broadcast (ephemeral messages, like typing indicators).
 */
export function useRealtimeBroadcast(
  supabase: SupabaseClient | null,
  channelName: string,
  eventName: string,
  onMessage: (payload: Record<string, unknown>) => void
) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const callbackRef = useRef(onMessage);
  callbackRef.current = onMessage;

  const send = useCallback(
    (payload: Record<string, unknown>) => {
      channelRef.current?.send({
        type: "broadcast",
        event: eventName,
        payload,
      });
    },
    [eventName]
  );

  useEffect(() => {
    if (!supabase) return;

    const channel = supabase
      .channel(channelName)
      .on("broadcast", { event: eventName }, (payload) => {
        callbackRef.current(payload.payload as Record<string, unknown>);
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [supabase, channelName, eventName]);

  return { send };
}
