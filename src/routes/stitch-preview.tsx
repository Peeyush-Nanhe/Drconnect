import { createFileRoute } from "@tanstack/react-router";
import StitchPreview from "@/features/mydox/stitch/StitchPreview";

export const Route = createFileRoute("/stitch-preview")({
  head: () => ({
    meta: [
      { title: "MyDox · Stitch design preview" },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [{ rel: "stylesheet", href: "/design/stitch/fonts.css" }],
  }),
  component: StitchPreview,
});
