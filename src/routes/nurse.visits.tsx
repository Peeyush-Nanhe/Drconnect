import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

// Uses the live unified booking flow (/care-booking) until the dedicated page is built.
export const Route = createFileRoute("/nurse/visits")({
  ssr: false,
  component: RedirectToCareBooking,
});

function RedirectToCareBooking() {
  useEffect(() => {
    window.location.replace("/care-booking?role=nurse");
  }, []);
  return <p style={{ padding: 24, textAlign: "center" }}>Opening booking…</p>;
}
