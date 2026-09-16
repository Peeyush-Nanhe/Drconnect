import { useEffect, useRef } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const TABLES = ["unified_bookings", "booking_offers", "booking_status_history", "booking_reviews", "app_notifications"] as const;

export function useUnifiedBookingRealtime(queryClient: QueryClient, showToasts = true) {
  const ready = useRef(false);

  useEffect(() => {
    const channel = supabase.channel(`unified-booking-${crypto.randomUUID()}`);
    for (const table of TABLES) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, (payload) => {
        void queryClient.invalidateQueries({ queryKey: ["unified-booking-hub"] });
        void queryClient.invalidateQueries({ queryKey: ["booking-operations"] });
        if (showToasts && ready.current && table === "app_notifications" && payload.eventType === "INSERT") {
          const notification = payload.new as { title?: string; body?: string; metadata?: { priority?: string } };
          const message = notification.body || notification.title || "Booking updated";
          if (notification.metadata?.priority === "emergency") toast.error(message);
          else toast(message);
          if (notification.metadata?.priority === "emergency" && "vibrate" in navigator) navigator.vibrate([180, 80, 180]);
        }
      });
    }
    channel.subscribe((status) => { if (status === "SUBSCRIBED") ready.current = true; });
    return () => { ready.current = false; void supabase.removeChannel(channel); };
  }, [queryClient, showToasts]);
}