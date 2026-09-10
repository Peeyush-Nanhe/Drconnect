import { createFileRoute } from "@tanstack/react-router";
import PatientDesignPreview from "@/features/mydox/preview/PatientDesignPreview";

export const Route = createFileRoute("/design-preview")({
  head: () => ({
    meta: [
      { title: "MyDox · Interactive design preview" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PatientDesignPreview,
});
