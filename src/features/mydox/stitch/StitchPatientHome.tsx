import { useState, type ReactNode } from "react";
import {
  Brain,
  CalendarDays,
  ChevronRight,
  Heart,
  HeartPulse,
  MapPin,
  Search,
  SlidersHorizontal,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import { Heading, IconPod } from "./StitchPrimitives";
import { clinicalShortcuts } from "./clinical-shortcuts";
import "./stitch-preview.css";

// The approved visual design uses the existing app's actions and patient content.
// Illustrative providers, slots, prices and checkout stay in StitchPreview.
export default function StitchPatientHome({
  name,
  onAction,
  onServices,
  onNearby,
  allergyReport,
  activeRequest,
  onTrack,
}: {
  name: string;
  onAction: (action: string) => void;
  onServices: () => void;
  onNearby: () => void;
  allergyReport: ReactNode;
  activeRequest?: { title: string; detail: string } | null;
  onTrack?: () => void;
}) {
  const firstName = name.trim().split(/\s+/)[0] || "there";
  const [greeting] = useState(() => {
    const hour = new Date().getHours();
    return hour < 12 ? "GOOD MORNING" : hour < 17 ? "GOOD AFTERNOON" : "GOOD EVENING";
  });
  return (
    <div className="sp-preview mdx-stitch-home">
      <div className="sp-home-glow">
        <div className="sp-greeting">
          <div>
            <p>{greeting}</p>
            <h1>
              Hi, {firstName} <span>✦</span>
            </h1>
            <small>A little care. A healthier you.</small>
          </div>
          <button
            className="sp-sos"
            onClick={() => onAction("emergency")}
            aria-label="SOS emergency care"
          >
            <HeartPulse size={18} /> SOS
          </button>
        </div>
        <button className="sp-search sp-search-link" onClick={() => onAction("search")}>
          <Search size={20} />
          <span>Search doctors, tests, services…</span>
          <SlidersHorizontal size={17} />
        </button>
        <Heading
          title={activeRequest ? "Your active care" : "Your appointments"}
          action="Details"
          onClick={() => onAction("bookings")}
        />
        <article className="sp-appointment">
          <div className="sp-appointment-person">
            <IconPod icon={activeRequest ? Stethoscope : CalendarDays} />
            <div>
              <h3>{activeRequest?.title || "Your next step in care"}</h3>
              <p>
                {activeRequest?.detail ||
                  "Find your upcoming visits, requests and follow-ups in My bookings."}
              </p>
            </div>
          </div>
          <div className="mdx-stitch-appointment-actions">
            <button className="sp-secondary" onClick={() => onAction("bookings")}>
              My bookings
            </button>
            <button
              className="sp-primary"
              onClick={() => onAction("doctor")}
            >
              Book a doctor
              <ChevronRight size={15} />
            </button>
          </div>
        </article>
      </div>
      <section className="sp-section">
        <Heading
          title="Clinical services"
          subtitle="Care for every part of your health"
          action="Explore all"
          onClick={onServices}
        />
        <div className="sp-services-grid">
          {clinicalShortcuts.map((service) => (
            <button key={service.id} onClick={() => onAction(service.id)}>
              <IconPod icon={service.icon} tone={service.tone} />
              <strong>{service.label}</strong>
              <small>{service.detail}</small>
            </button>
          ))}
        </div>
      </section>
      <section className="sp-section">
        <Heading
          title="Find your specialist"
          action="View all"
          onClick={() => onAction("doctor")}
        />
        <div className="sp-chips">
          <button onClick={() => onAction("specialty:Neurologist")}>
            <Brain size={17} />
            Neurologist
          </button>
          <button onClick={() => onAction("specialty:Cardiologist")}>
            <Heart size={17} />
            Cardiologist
          </button>
          <button onClick={() => onAction("dental")}>
            <Sparkles size={17} />
            Dentist
          </button>
        </div>
      </section>
      <section className="sp-section">
        <Heading title="Meet your care team" subtitle="Find the right specialist for your visit" />
        {[
          {
            specialty: "Neurologist",
            title: "Brain & nerve care",
            summary: "Find a specialist for your brain, nerve and spinal care.",
            image: "krishna.jpg",
          },
          {
            specialty: "Cardiologist",
            title: "Care for your heart",
            summary: "Explore heart specialists and ongoing cardiovascular care.",
            image: "charlotte.jpg",
          },
        ].map((doctor) => (
          <article className="sp-doctor-card sp-card" key={doctor.specialty}>
            <div className="sp-doctor-copy">
              <span className="sp-eyebrow">{doctor.specialty}</span>
              <h2>{doctor.title}</h2>
              <p>{doctor.summary}</p>
              <small>Choose a doctor to see visit options</small>
            </div>
            <div className="sp-doctor-photo">
              <img src={`/design/stitch/${doctor.image}`} alt="" />
            </div>
            <button
              className="sp-primary sp-wide"
              onClick={() => onAction(`specialty:${doctor.specialty}`)}
            >
              <Stethoscope size={17} />
              Find a {doctor.specialty.toLowerCase()}
              <ChevronRight size={15} />
            </button>
          </article>
        ))}
      </section>
      {allergyReport && <section className="sp-section">{allergyReport}</section>}
      <section className="sp-section">
        <button className="sp-wellness" onClick={() => onAction("ai")}>
          <Sparkles size={30} />
          <div>
            <span className="sp-tag">YOUR HEALTH COMPANION</span>
            <h3>A little guidance, whenever you need.</h3>
            <p>Explore the MyDox assistant.</p>
          </div>
          <ChevronRight size={18} />
        </button>
      </section>
      <section className="sp-section">
        <button className="mdx-action-row" onClick={onNearby}>
          <IconPod icon={MapPin} tone="mint" />
          <span className="mdx-row-copy">
            <strong>Care near you</strong>
            <small>Explore hubs, hospitals and services</small>
          </span>
          <ChevronRight size={18} />
        </button>
      </section>
    </div>
  );
}
