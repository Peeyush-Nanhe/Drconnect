import { useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { enablePushNotifications } from "@/lib/push-client";
import { toast } from "sonner";

export function PhoneAlertsButton() {
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    setBusy(true);
    try {
      const res = await enablePushNotifications();
      if (res.status === "registered") {
        toast.success("Phone alerts enabled!");
      } else if (res.status === "denied") {
        toast.error("Notification permission was denied.");
      } else {
        toast.info("Push alerts not configured on this browser/environment.");
      }
    } catch {
      toast.error("Could not enable phone alerts.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={busy}
      onClick={handleClick}
      className="flex items-center gap-1.5 text-xs font-semibold"
    >
      <Bell className="h-3.5 w-3.5 text-teal-600" />
      {busy ? "Enabling…" : "Phone alerts"}
    </Button>
  );
}
