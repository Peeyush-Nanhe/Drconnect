import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Admin Console — MyDox" },
      {
        name: "description",
        content:
          "MyDox admin console: mental wellness analytics, care physician locum control room, live operations and user roles.",
      },
      { property: "og:title", content: "Admin Console — MyDox" },
      {
        property: "og:description",
        content: "Wellness analytics, locum control room, live operations and user management in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminConsole,
});

const PANELS = [
  {
    to: "/admin/wellness" as const,
    emoji: "🧠",
    title: "Mental Wellness Console",
    desc: "Screening scores, care-team SLA compliance, provider performance and patient outcome trends.",
    tone: "#4F46E5",
  },
  {
    to: "/admin/locum" as const,
    emoji: "🩺",
    title: "Locum Control Room",
    desc: "Care physician ward/ICU/special duty cover, attendance, hospital demand hotspots and feedback.",
    tone: "#0D9488",
  },
  {
    to: "/admin/credentials" as const,
    emoji: "✅",
    title: "Physician Credential Verification",
    desc: "Review council registration details and unlock ICU/gated duties only after verification.",
    tone: "#047857",
  },
  {
    to: "/admin/physio" as const,
    emoji: "🏃",
    title: "Home Physiotherapy Control Room",
    desc: "Home visits by area and therapy type, therapist attendance, hotspots, partner quality and patient ratings.",
    tone: "#7C3AED",
  },
  {
    to: "/admin/physician" as const,
    emoji: "🧑‍⚕️",
    title: "Care Physician Portal",
    desc: "For doctors: log on-duty hours, submit hospital feedback and track your own reliability score.",
    tone: "#0369A1",
  },
  {
    to: "/admin/live" as const,
    emoji: "📡",
    title: "Live Operations",
    desc: "Real-time users, care requests, programme bookings and community requests.",
    tone: "#B45309",
  },
  {
    to: "/admin/users" as const,
    emoji: "👤",
    title: "Users & Roles",
    desc: "Review accounts and manage administrator access.",
    tone: "#BE123C",
  },
];

function AdminConsole() {
  return (
    <div
      className="min-h-screen px-4 py-10"
      style={{ background: "#DCE6E1", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
    >
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
      />
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Admin Console</h1>
            <p className="text-sm text-slate-600">
              Every operational board for MyDox, in one place.
            </p>
          </div>
          <Link to="/" className="text-sm font-semibold text-teal-700 hover:underline">
            ← Back to app
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {PANELS.map((p) => (
            <Link
              key={p.to}
              to={p.to}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="text-2xl">{p.emoji}</div>
              <div className="mt-2 text-base font-extrabold" style={{ color: p.tone }}>
                {p.title}
              </div>
              <p className="mt-1 text-xs text-slate-600">{p.desc}</p>
              <div className="mt-3 text-xs font-semibold text-slate-500">Open →</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
