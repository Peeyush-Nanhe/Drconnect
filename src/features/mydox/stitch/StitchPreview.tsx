import { useEffect, useRef, useState, type ReactNode, type FormEvent } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Brain,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  CreditCard,
  FileText,
  Heart,
  HeartPulse,
  House,
  MapPin,
  MessageCircle,
  Plus,
  ScanLine,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Stethoscope,
  Syringe,
  TestTube,
  UserRound,
  Users,
  Utensils,
  Video,
  Wallet,
  X,
  Scissors,
  type LucideIcon,
} from "lucide-react";
import { PATIENT_SERVICE_GROUPS } from "../patient-services";
import {
  areas,
  exampleDoctors,
  exampleTests,
  rupees,
  sampleDates,
  sampleSlots,
  weekdays,
} from "./stitch-data";
import "./stitch-preview.css";
import { Heading, IconPod } from "./StitchPrimitives";
import { clinicalShortcuts } from "./clinical-shortcuts";

type Page =
  "home" | "doctor" | "diagnostics" | "chat" | "checkout" | "services" | "schedule" | "profile";
type Mode = "Video call" | "At clinic" | "Home visit";
const navItems: { page: Page; label: string; icon: LucideIcon }[] = [
  { page: "home", label: "Home", icon: House },
  { page: "schedule", label: "Schedule", icon: CalendarDays },
  { page: "services", label: "Services", icon: Stethoscope },
  { page: "chat", label: "Consult", icon: MessageCircle },
  { page: "profile", label: "Profile", icon: UserRound },
];
function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog
      className="sp-dialog"
      ref={ref}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sp-sheet">
        <header>
          <h2>{title}</h2>
          <button className="sp-round" aria-label="Close panel" onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}

export default function StitchPreview() {
  const [page, setPage] = useState<Page>("home");
  const [doctorIndex, setDoctorIndex] = useState(0);
  const [mode, setMode] = useState<Mode>("Video call");
  const [date, setDate] = useState("10");
  const [slot, setSlot] = useState("11:00 AM");
  const [bioOpen, setBioOpen] = useState(false);
  const [area, setArea] = useState("Koregaon Park");
  const [query, setQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [category, setCategory] = useState("All tests");
  const [delivery, setDelivery] = useState("Home collection");
  const [basket, setBasket] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [group, setGroup] = useState<string | null>(null);
  const [sheet, setSheet] = useState<string | null>(null);
  const [checkoutKind, setCheckoutKind] = useState<"doctor" | "tests">("doctor");
  const [payment, setPayment] = useState("UPI");
  const [patientKind, setPatientKind] = useState("self");
  const [patient, setPatient] = useState({
    name: "Priya Sharma",
    email: "patient1@demo.med",
    phone: "",
    age: "",
    gender: "Female",
    note: "",
  });
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<string[]>([]);
  const [completed, setCompleted] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const doctor = exampleDoctors[doctorIndex];
  const selectedTests = exampleTests.filter((t) => basket.includes(t.id));
  const testTotal = selectedTests.reduce((sum, t) => sum + t.fee, 0);
  const consultationFee =
    doctor.fee + (mode === "At clinic" ? 200 : mode === "Home visit" ? 600 : 0);
  const total = checkoutKind === "doctor" ? consultationFee : testTotal;
  const go = (next: Page) => {
    setPage(next);
    setQuery("");
  };
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [page]);
  const openDoctor = (index = 0, nextMode: Mode = mode) => {
    setDoctorIndex(index);
    setMode(nextMode);
    setBioOpen(false);
    go("doctor");
  };
  const openCheckout = (kind: "doctor" | "tests") => {
    setCheckoutKind(kind);
    go("checkout");
  };
  const toggleTest = (id: string) =>
    setBasket((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleFavorite = (id: string) =>
    setFavorites((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const openLocation = () => {
    setLocationQuery("");
    setSheet("location");
  };
  const openService = (id: string, label: string) => {
    if (id === "doctor") openDoctor();
    else if (["care", "homePackage"].includes(id)) openDoctor(0, "Home visit");
    else if (["labtest", "scan", "technician"].includes(id)) {
      setCategory(id === "scan" ? "MRI & CT" : "All tests");
      go("diagnostics");
    } else setSheet(label);
  };
  const sendMessage = (text = message) => {
    if (!text.trim()) return;
    setMessages((prev) => [...prev, text.trim()]);
    setMessage("");
  };
  const finishSample = (e: FormEvent) => {
    e.preventDefault();
    setCompleted(true);
    setSheet("complete");
  };
  const activeNav = ["doctor", "checkout"].includes(page)
    ? "schedule"
    : page === "diagnostics"
      ? "services"
      : page;
  const title = {
    home: "",
    doctor: "Doctor details",
    diagnostics: "Diagnostics & scans",
    chat: "Your consultation",
    checkout: "Review & checkout",
    services: "All your care",
    schedule: "Your schedule",
    profile: "Your MyDox",
  }[page];
  const groups = PATIENT_SERVICE_GROUPS.map((g) => ({
    ...g,
    services: g.services.filter((s) =>
      `${s.label} ${g.label}`.toLowerCase().includes(query.toLowerCase()),
    ),
  })).filter((g) => g.services.length);
  const tests = exampleTests.filter(
    (t) =>
      (category === "All tests" || category === t.category) &&
      `${t.name} ${t.description}`.toLowerCase().includes(query.toLowerCase()),
  );

  const appointment = (
    <section className="sp-appointment sp-card">
      <div className="sp-appointment-person">
        <img src="/design/stitch/vishal.jpg" alt="Example doctor portrait" />
        <div>
          <div className="sp-line">
            <h3>Dr. Vishal Shah</h3>
            <span className="sp-tag">VIDEO</span>
          </div>
          <p>Cardiologist · sample appointment</p>
          <div className="sp-meta">
            <span>
              <CalendarDays size={14} />
              10 Sep
            </span>
            <span>
              <Clock3 size={14} />
              10:30 AM
            </span>
          </div>
        </div>
      </div>
      <div className="sp-split">
        <button className="sp-secondary" onClick={() => openDoctor()}>
          Try rescheduling
        </button>
        <button className="sp-primary" onClick={() => go("chat")}>
          <Video size={17} />
          Join preview
        </button>
      </div>
    </section>
  );

  return (
    <div className="sp-preview">
      <aside className="sp-review-bar">
        <span>
          <i />
          APPROVED THEME <small>· Sample data</small>
        </span>
        <a href="/">
          Open MyDox
          <ArrowUpRight size={13} />
        </a>
      </aside>
      <div className="sp-device" data-screen={page}>
        <header className="sp-header">
          {page !== "home" ? (
            <>
              <button
                className="sp-round"
                aria-label="Go back"
                onClick={() =>
                  go(
                    page === "checkout"
                      ? checkoutKind === "doctor"
                        ? "doctor"
                        : "diagnostics"
                      : "home",
                  )
                }
              >
                <ArrowLeft size={21} />
              </button>
              <div className="sp-header-title">
                <strong>{title}</strong>
                <small>MyDox · design preview</small>
              </div>
            </>
          ) : (
            <>
              <div className="sp-logo">
                <Plus size={22} strokeWidth={3} />
              </div>
              <div className="sp-brand">
                <strong>MyDox</strong>
                <button onClick={openLocation}>
                  <MapPin size={13} />
                  {area}
                  <ChevronDown size={12} />
                </button>
              </div>
            </>
          )}
          {page === "home" && (
            <button
              className="sp-round sp-bell"
              aria-label="Notifications"
              onClick={() => setSheet("Notifications")}
            >
              <Bell size={20} />
              <i />
            </button>
          )}
          <button
            className="sp-avatar-button"
            aria-label="Open profile"
            onClick={() => go("profile")}
          >
            <img src="/design/stitch/patient.png" alt="Sample patient avatar" />
          </button>
        </header>
        <div className={`sp-scroll sp-page-${page}`} ref={scroller}>
          {page === "home" && (
            <>
              <div className="sp-home-glow">
                <div className="sp-greeting">
                  <div>
                    <p>GOOD MORNING</p>
                    <h1>
                      Hi, Priya <span>✦</span>
                    </h1>
                    <small>A little care. A healthier you.</small>
                  </div>
                  <button className="sp-sos" onClick={() => setSheet("Emergency access")}>
                    <HeartPulse size={18} />
                    SOS
                  </button>
                </div>
                <button className="sp-search sp-search-link" onClick={() => go("services")}>
                  <Search size={20} />
                  <span>Search doctors, tests, services…</span>
                  <SlidersHorizontal size={17} />
                </button>
                <Heading
                  title="Upcoming appointment"
                  action="Details"
                  onClick={() => go("schedule")}
                />
                {appointment}
              </div>
              <section className="sp-section">
                <Heading
                  title="Clinical services"
                  subtitle="Care for every part of your health"
                  action="Explore all"
                  onClick={() => go("services")}
                />
                <div className="sp-services-grid">
                  {clinicalShortcuts.map((s) => (
                    <button key={s.id} onClick={() => openService(s.id, s.label)}>
                      <IconPod icon={s.icon} tone={s.tone} />
                      <strong>{s.label}</strong>
                      <small>{s.detail}</small>
                    </button>
                  ))}
                </div>
              </section>
              <section className="sp-section">
                <Heading
                  title="Find your specialist"
                  action="View all"
                  onClick={() => go("services")}
                />
                <div className="sp-chips">
                  {[
                    { label: "Neurologist", icon: Brain, index: 0 },
                    { label: "Cardiologist", icon: Heart, index: 1 },
                  ].map((s) => (
                    <button
                      key={s.label}
                      className={doctorIndex === s.index ? "active" : ""}
                      onClick={() => openDoctor(s.index)}
                    >
                      <s.icon size={17} />
                      {s.label}
                    </button>
                  ))}
                  <button onClick={() => setSheet("Dental care")}>
                    <Sparkles size={17} />
                    Dentist
                  </button>
                </div>
              </section>
              <section className="sp-section">
                <Heading title="Meet your care team" subtitle="Example profiles from your design" />
                {exampleDoctors.map((d, index) => (
                  <article className="sp-doctor-card sp-card" key={d.id}>
                    <div className="sp-doctor-copy">
                      <span className="sp-eyebrow">{d.specialty}</span>
                      <h2>{d.name}</h2>
                      <p>{d.summary}</p>
                      <small>Example visit fee</small>
                      <strong className="sp-price">
                        {rupees(d.fee)}
                        <small> / visit</small>
                      </strong>
                    </div>
                    <div className="sp-doctor-photo">
                      <img src={`/design/stitch/${d.image}`} alt={`${d.name} example portrait`} />
                      <button
                        className="sp-round"
                        aria-label={`Save ${d.name}`}
                        aria-pressed={favorites.includes(d.id)}
                        onClick={() => toggleFavorite(d.id)}
                      >
                        <Heart
                          size={17}
                          fill={favorites.includes(d.id) ? "currentColor" : "none"}
                        />
                      </button>
                    </div>
                    <button className="sp-primary sp-wide" onClick={() => openDoctor(index)}>
                      <CalendarDays size={17} />
                      View profile & book
                      <ArrowRight size={17} />
                    </button>
                  </article>
                ))}
              </section>
              <section className="sp-section">
                <button className="sp-wellness" onClick={() => setSheet("Your health companion")}>
                  <div>
                    <span className="sp-tag">YOUR HEALTH COMPANION</span>
                    <h3>A little guidance, whenever you need.</h3>
                    <p>Explore the MyDox assistant.</p>
                  </div>
                  <Sparkles size={35} />
                </button>
              </section>
            </>
          )}

          {page === "doctor" && (
            <div className="sp-content">
              <div className="sp-doctor-hero sp-card">
                <div className="sp-profile-photo">
                  <img
                    src={`/design/stitch/${doctor.image}`}
                    alt={`${doctor.name} example portrait`}
                  />
                </div>
                <div>
                  <span className="sp-eyebrow">{doctor.specialty}</span>
                  <h1>{doctor.name}</h1>
                  <span className="sp-tag">EXAMPLE PROFILE</span>
                  <p>
                    From <strong>{rupees(doctor.fee)}</strong> / visit
                  </p>
                </div>
                <div className="sp-clinic">
                  <Stethoscope size={18} />
                  <span>{doctor.clinic}</span>
                  <span>{doctor.experience}*</span>
                </div>
              </div>
              <section className="sp-card sp-padding">
                <Heading title="Details" />
                <p>
                  {doctor.summary}{" "}
                  {bioOpen &&
                    "This sample profile demonstrates where qualifications, languages, experience and consultation information would appear in MyDox."}
                </p>
                <button
                  className="sp-text-button"
                  aria-expanded={bioOpen}
                  onClick={() => setBioOpen(!bioOpen)}
                >
                  {bioOpen ? "See less" : "See more"}
                  <ChevronDown size={15} />
                </button>
                <small className="sp-muted">*Profile details and prices are illustrative.</small>
              </section>
              <section>
                <Heading title="Consultation mode" subtitle="Choose what works for you" />
                <div className="sp-modes">
                  {(
                    [
                      { label: "Video call", icon: Video, add: 0 },
                      { label: "At clinic", icon: Stethoscope, add: 200 },
                      { label: "Home visit", icon: House, add: 600 },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.label}
                      className={mode === m.label ? "active" : ""}
                      aria-pressed={mode === m.label}
                      onClick={() => setMode(m.label)}
                    >
                      <IconPod icon={m.icon} />
                      <strong>{m.label}</strong>
                      <span>{rupees(doctor.fee + m.add)}</span>
                    </button>
                  ))}
                </div>
              </section>
              <section className="sp-card sp-padding">
                <Heading title="Create schedule" subtitle="Choose an example date and time" />
                <span className="sp-tag sp-month">
                  <CalendarDays size={14} />
                  September 2026
                </span>
                <div className="sp-dates">
                  {sampleDates.map((d, i) => (
                    <button
                      key={d}
                      aria-label={`${weekdays[i]} ${d} September`}
                      aria-pressed={date === d}
                      onClick={() => {
                        setDate(d);
                        setSlot("");
                      }}
                    >
                      <small>{weekdays[i]}</small>
                      <strong>{d}</strong>
                    </button>
                  ))}
                </div>
                <div className="sp-slot-label">
                  <span>
                    <i />
                    Example availability
                  </span>
                  <small>{date} Sep</small>
                </div>
                <div className="sp-slots">
                  {sampleSlots.map((t) => (
                    <button
                      key={t}
                      disabled={t === "05:30 PM"}
                      aria-pressed={slot === t}
                      onClick={() => setSlot(t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </section>
              <div className="sp-info">
                <ShieldCheck size={24} />
                <p>
                  <strong>Your visit, at a glance</strong>Review your patient details and visit
                  preferences before finishing the sample.
                </p>
              </div>
            </div>
          )}

          {page === "diagnostics" && (
            <div className="sp-content">
              <label className="sp-search">
                <Search size={19} />
                <input
                  aria-label="Search diagnostic tests"
                  placeholder="Search tests, scans, MRI…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <div className="sp-segment">
                {["Home collection", "Visit a centre"].map((d, i) => (
                  <button key={d} aria-pressed={delivery === d} onClick={() => setDelivery(d)}>
                    {i === 0 ? <House size={17} /> : <Stethoscope size={17} />}
                    {d}
                  </button>
                ))}
              </div>
              <section className="sp-rx-banner">
                <div>
                  <IconPod icon={FileText} />
                  <div>
                    <h2>Have a prescription?</h2>
                    <p>Keep your prescribed tests together.</p>
                  </div>
                </div>
                <button
                  className="sp-white-button"
                  onClick={() => setSheet("Prescription preview")}
                >
                  <ScanLine size={17} />
                  Explore sample Rx
                </button>
              </section>
              <section>
                <Heading title="Categories" subtitle="Sample catalogue · prices are illustrative" />
                <div className="sp-chips">
                  {["All tests", "Health checks", "MRI & CT", "Heart care"].map((c) => (
                    <button
                      key={c}
                      className={category === c ? "active" : ""}
                      aria-pressed={category === c}
                      onClick={() => setCategory(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </section>
              <div className="sp-test-list">
                {tests.map((t) => (
                  <article className="sp-test sp-card" key={t.id}>
                    <div className="sp-test-title">
                      <IconPod icon={t.icon} tone={t.tone} />
                      <div>
                        <span className="sp-tag">{t.label}</span>
                        <h2>{t.name}</h2>
                      </div>
                    </div>
                    <p>{t.description}</p>
                    <div className="sp-test-info">
                      <span>
                        <MapPin size={16} />
                        {t.delivery}
                      </span>
                      <span>
                        <FileText size={16} />
                        {t.detail}
                      </span>
                    </div>
                    <footer>
                      <div>
                        <strong>{rupees(t.fee)}</strong>
                        <small>Sample fee</small>
                      </div>
                      <button
                        className={basket.includes(t.id) ? "sp-added" : "sp-primary"}
                        aria-pressed={basket.includes(t.id)}
                        aria-label={`${basket.includes(t.id) ? "Remove" : "Add"} ${t.name}`}
                        onClick={() => toggleTest(t.id)}
                      >
                        {basket.includes(t.id) ? <Check size={16} /> : <Plus size={16} />}
                        {basket.includes(t.id) ? "Added" : "Add test"}
                      </button>
                    </footer>
                  </article>
                ))}
              </div>
              {!tests.length && (
                <p className="sp-empty">No sample tests match. Try another category or search.</p>
              )}
              <div className="sp-info">
                <MapPin size={24} />
                <p>
                  <strong>Choose the right visit</strong>Scans take place at an imaging centre. Home
                  collection applies to eligible tests only.
                </p>
              </div>
            </div>
          )}

          {page === "chat" && (
            <div className="sp-content sp-chat">
              <div className="sp-chat-person">
                <img src="/design/stitch/krishna.jpg" alt="Example doctor portrait" />
                <div>
                  <h2>Dr. Krishna Patel</h2>
                  <p>Neurologist · example conversation</p>
                </div>
                <button
                  className="sp-round"
                  aria-label="Preview video call"
                  onClick={() => setSheet("Video call preview")}
                >
                  <Video size={20} />
                </button>
              </div>
              <p className="sp-chat-note">Demo chat · messages stay in this preview</p>
              <div className="sp-bubble mine">
                Hello doctor, where can I see the tests from my consultation?
                <small>
                  10:32 AM <Check size={12} />
                </small>
              </div>
              <div className="sp-bubble">
                Your care plan can appear right here, with an option to review and book its tests
                together.<small>10:34 AM · sample reply</small>
              </div>
              <section className="sp-care-plan sp-card">
                <header>
                  <IconPod icon={Activity} />
                  <div>
                    <span className="sp-tag">SAMPLE CARE PLAN</span>
                    <h2>Your diagnostic plan</h2>
                    <p>Layout example · not a medical prescription</p>
                  </div>
                </header>
                <div className="sp-padding">
                  <p className="sp-plan-note">
                    A connected journey from consultation to diagnostics. Your clinician’s
                    instructions would appear here.
                  </p>
                  {exampleTests
                    .filter((t) => ["mri", "ecg"].includes(t.id))
                    .map((t) => (
                      <div className="sp-plan-test" key={t.id}>
                        <IconPod icon={t.icon} />
                        <div>
                          <strong>{t.name}</strong>
                          <small>{t.delivery}</small>
                        </div>
                        <strong>{rupees(t.fee)}</strong>
                      </div>
                    ))}
                  <div className="sp-plan-total">
                    <span>Example total</span>
                    <strong>{rupees(exampleTests[0].fee + exampleTests[2].fee)}</strong>
                  </div>
                  <button
                    className="sp-primary sp-wide"
                    onClick={() => {
                      setBasket(["mri", "ecg"]);
                      setCategory("All tests");
                      go("diagnostics");
                    }}
                  >
                    Review these tests
                    <ArrowRight size={17} />
                  </button>
                </div>
              </section>
              {messages.map((m, i) => (
                <div className="sp-bubble mine" key={i}>
                  {m}
                  <small>
                    Local preview only <Check size={12} />
                  </small>
                </div>
              ))}
              <div className="sp-chips">
                <button onClick={() => sendMessage("I’d like to review the appointment options.")}>
                  Review appointment options
                </button>
                <button onClick={() => setSheet("Care support")}>Care support</button>
              </div>
            </div>
          )}

          {page === "checkout" && (
            <form id="sp-checkout" className="sp-content" onSubmit={finishSample}>
              <section className="sp-card sp-padding">
                <Heading
                  title="Patient information"
                  subtitle="Use sample details to try the layout"
                />
                <div className="sp-segment">
                  {[
                    { id: "self", label: "For myself", icon: UserRound },
                    { id: "family", label: "Family member", icon: Users },
                  ].map((p) => (
                    <button
                      type="button"
                      key={p.id}
                      aria-pressed={patientKind === p.id}
                      onClick={() => {
                        setPatientKind(p.id);
                        setPatient((prev) => ({
                          ...prev,
                          name: p.id === "self" ? "Priya Sharma" : "Rahul Verma",
                          gender: p.id === "self" ? "Female" : "Prefer not to say",
                          email: p.id === "self" ? "patient1@demo.med" : "patient2@demo.med",
                        }));
                      }}
                    >
                      <p.icon size={17} />
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="sp-fields">
                  <label>
                    Full name
                    <input
                      required
                      autoComplete="off"
                      value={patient.name}
                      onChange={(e) => setPatient({ ...patient, name: e.target.value })}
                    />
                  </label>
                  <label>
                    Email address
                    <input
                      type="email"
                      required
                      autoComplete="off"
                      value={patient.email}
                      onChange={(e) => setPatient({ ...patient, email: e.target.value })}
                    />
                  </label>
                  <label>
                    Phone number <small>(optional in sample)</small>
                    <input
                      type="tel"
                      autoComplete="off"
                      placeholder="Example contact number"
                      value={patient.phone}
                      onChange={(e) => setPatient({ ...patient, phone: e.target.value })}
                    />
                  </label>
                  <div className="sp-split">
                    <label>
                      Age
                      <input
                        type="number"
                        min="0"
                        max="120"
                        placeholder="Years"
                        value={patient.age}
                        onChange={(e) => setPatient({ ...patient, age: e.target.value })}
                      />
                    </label>
                    <label>
                      Gender
                      <select
                        value={patient.gender}
                        onChange={(e) => setPatient({ ...patient, gender: e.target.value })}
                      >
                        <option>Female</option>
                        <option>Male</option>
                        <option>Prefer not to say</option>
                      </select>
                    </label>
                  </div>
                  <label>
                    Notes for the visit
                    <textarea
                      placeholder="Try adding a sample note"
                      value={patient.note}
                      onChange={(e) => setPatient({ ...patient, note: e.target.value })}
                    />
                  </label>
                </div>
              </section>
              <section className="sp-card sp-padding">
                <Heading title="Your visit" />
                <button type="button" className="sp-detail-row" onClick={openLocation}>
                  <MapPin size={19} />
                  <span>
                    {checkoutKind === "doctor" && mode === "Video call"
                      ? "Online consultation"
                      : `${area}, Pune`}
                  </span>
                  <small>Change</small>
                </button>
                <button
                  type="button"
                  className="sp-detail-row"
                  onClick={() => setSheet("visit-time")}
                >
                  <Clock3 size={19} />
                  <span>
                    {date} Sep 2026 · {slot || "Choose a time"}
                  </span>
                  <ChevronRight size={15} />
                </button>
                <p className="sp-muted">
                  {checkoutKind === "doctor"
                    ? `${doctor.name} · ${mode}`
                    : `${delivery} where eligible; imaging at the centre.`}
                </p>
              </section>
              <section className="sp-card sp-padding">
                <Heading title="Bill summary" subtitle="Illustrative prices for design review" />
                <dl className="sp-bill">
                  {checkoutKind === "doctor" ? (
                    <div>
                      <dt>Consultation · {mode}</dt>
                      <dd>{rupees(consultationFee)}</dd>
                    </div>
                  ) : (
                    selectedTests.map((t) => (
                      <div key={t.id}>
                        <dt>{t.name}</dt>
                        <dd>{rupees(t.fee)}</dd>
                      </div>
                    ))
                  )}
                  <div className="sp-total">
                    <dt>Example total</dt>
                    <dd>{rupees(total)}</dd>
                  </div>
                </dl>
              </section>
              <section className="sp-card sp-padding">
                <Heading
                  title="Payment preference"
                  subtitle="No payment details or charges in this sample"
                />
                <div className="sp-payment">
                  {[
                    { name: "UPI", icon: Wallet, detail: "Choose an app at checkout" },
                    {
                      name: "Credit / debit card",
                      icon: CreditCard,
                      detail: "Card details would follow",
                    },
                    {
                      name: "Pay at visit",
                      icon: Wallet,
                      detail: "Where supported by the provider",
                    },
                  ].map((p) => (
                    <button
                      type="button"
                      key={p.name}
                      aria-pressed={payment === p.name}
                      onClick={() => setPayment(p.name)}
                    >
                      <IconPod icon={p.icon} />
                      <span>
                        <strong>{p.name}</strong>
                        <small>{p.detail}</small>
                      </span>
                      <span className="sp-radio">{payment === p.name && <Check size={14} />}</span>
                    </button>
                  ))}
                </div>
              </section>
            </form>
          )}

          {page === "services" && (
            <div className="sp-content">
              <div className="sp-page-intro">
                <span className="sp-eyebrow">THE MYDOX CARE NETWORK</span>
                <h1>
                  All your care.
                  <br />
                  One place.
                </h1>
                <p>Open a section to explore what you need.</p>
              </div>
              <label className="sp-search">
                <Search size={19} />
                <input
                  aria-label="Search all services"
                  placeholder="Doctor, MRI, medicines…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              {groups.map((g) => (
                <section className="sp-service-group sp-card" key={g.id}>
                  <button
                    className="sp-group-heading"
                    aria-expanded={Boolean(query) || group === g.id}
                    onClick={() => {
                      setGroup(group === g.id ? null : g.id);
                      setQuery("");
                    }}
                  >
                    <IconPod icon={g.icon} />
                    <span>
                      <strong>{g.label}</strong>
                      <small>{g.description}</small>
                    </span>
                    <ChevronDown size={19} />
                  </button>
                  {(query || group === g.id) && (
                    <div className="sp-group-entries">
                      {g.services.map((s) => (
                        <button key={s.id} onClick={() => openService(s.id, s.label)}>
                          <s.icon size={19} />
                          <span>{s.label}</span>
                          <ChevronRight size={16} />
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              ))}
              {!groups.length && (
                <p className="sp-empty">No matching service. Try a different search.</p>
              )}
            </div>
          )}

          {page === "schedule" && (
            <div className="sp-content">
              <div className="sp-page-intro">
                <span className="sp-eyebrow">WITH YOU, EVERY STEP</span>
                <h1>Your care calendar</h1>
                <p>Appointments and requests, together.</p>
              </div>
              <Heading title="Upcoming" />
              {appointment}
              {completed && (
                <div className="sp-info">
                  <Check size={24} />
                  <p>
                    <strong>You’ve completed the sample flow</strong>Your design review is complete.
                    No real booking was created.
                  </p>
                </div>
              )}
              <button className="sp-primary sp-wide" onClick={() => openDoctor()}>
                <Plus size={17} />
                Explore a new consultation
              </button>
              <button className="sp-card sp-menu-row" onClick={() => go("diagnostics")}>
                <TestTube size={22} />
                <span>Tests & scans</span>
                <ChevronRight size={18} />
              </button>
              <button className="sp-card sp-menu-row" onClick={() => setSheet("Health records")}>
                <FileText size={22} />
                <span>Health records & prescriptions</span>
                <ChevronRight size={18} />
              </button>
            </div>
          )}

          {page === "profile" && (
            <div className="sp-content">
              <div className="sp-profile-intro">
                <img src="/design/stitch/patient.png" alt="Sample patient portrait" />
                <h1>Priya Sharma</h1>
                <p>Sample patient profile</p>
              </div>
              {[
                { name: "My family", icon: Users },
                { name: "Health records", icon: FileText },
                { name: "Saved doctors", icon: Heart },
                { name: "Notifications", icon: Bell },
                { name: "Privacy & preferences", icon: ShieldCheck },
              ].map((p) => (
                <button
                  className="sp-card sp-menu-row"
                  key={p.name}
                  onClick={() => setSheet(p.name)}
                >
                  <p.icon size={22} />
                  <span>{p.name}</span>
                  <ChevronRight size={18} />
                </button>
              ))}
              <a className="sp-compare-link" href="/design-preview">
                Compare the previous design
                <ArrowUpRight size={17} />
              </a>
              <a className="sp-compare-link" href="/">
                Open the current MyDox app
                <ArrowUpRight size={17} />
              </a>
            </div>
          )}
        </div>

        {page === "chat" && (
          <form
            className="sp-composer"
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
          >
            <input
              aria-label="Sample chat message"
              placeholder="Try a sample message…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <button
              className="sp-primary"
              aria-label="Send sample message"
              disabled={!message.trim()}
            >
              <Send size={18} />
            </button>
          </form>
        )}
        {page === "doctor" && (
          <div className="sp-bookbar">
            <span>
              <small>Example visit fee</small>
              <strong>{rupees(consultationFee)}</strong>
            </span>
            <button className="sp-primary" disabled={!slot} onClick={() => openCheckout("doctor")}>
              Book preview
              <ArrowRight size={18} />
            </button>
          </div>
        )}
        {page === "diagnostics" && basket.length > 0 && (
          <div className="sp-basket">
            <span>
              <strong>
                {basket.length} {basket.length === 1 ? "test" : "tests"} · {rupees(testTotal)}
              </strong>
              <small>Example basket</small>
            </span>
            <button onClick={() => openCheckout("tests")}>
              Review & book
              <ArrowRight size={16} />
            </button>
          </div>
        )}
        {page === "checkout" && (
          <div className="sp-bookbar">
            <span>
              <small>Example total</small>
              <strong>{rupees(total)}</strong>
            </span>
            <button
              type="submit"
              form="sp-checkout"
              className="sp-primary"
              disabled={checkoutKind === "tests" && !basket.length}
            >
              Finish sample
              <ArrowRight size={18} />
            </button>
          </div>
        )}
        {!(["doctor", "checkout"] as Page[]).includes(page) && (
          <nav className="sp-nav" aria-label="Stitch preview navigation">
            {navItems.map((n) => (
              <button
                key={n.page}
                aria-current={activeNav === n.page ? "page" : undefined}
                onClick={() => go(n.page)}
              >
                <n.icon size={21} strokeWidth={1.7} />
                <span>{n.label}</span>
              </button>
            ))}
          </nav>
        )}
      </div>

      {sheet && (
        <Sheet
          title={
            sheet === "location"
              ? "Choose your area"
              : sheet === "complete"
                ? "Preview complete"
                : sheet === "visit-time"
                  ? "Choose a sample time"
                  : sheet
          }
          onClose={() => setSheet(null)}
        >
          {sheet === "location" ? (
            <>
              <label className="sp-search">
                <Search size={18} />
                <input
                  aria-label="Search area"
                  placeholder="Search areas in Pune"
                  value={locationQuery}
                  onChange={(e) => setLocationQuery(e.target.value)}
                />
              </label>
              <div className="sp-location-list">
                {areas
                  .filter((a) => a.toLowerCase().includes(locationQuery.toLowerCase()))
                  .map((a) => (
                    <button
                      key={a}
                      onClick={() => {
                        setArea(a);
                        setSheet(null);
                      }}
                    >
                      <MapPin size={18} />
                      {a}
                      {area === a ? <Check size={18} /> : <ChevronRight size={18} />}
                    </button>
                  ))}
              </div>
              <p className="sp-muted">Sample locations for reviewing the design.</p>
            </>
          ) : sheet === "complete" ? (
            <div className="sp-complete">
              <span>
                <Check size={32} />
              </span>
              <h3>All set for your review.</h3>
              <p>
                You’ve completed the sample checkout. No booking, payment or message has been sent.
              </p>
              <button
                className="sp-primary sp-wide"
                onClick={() => {
                  setSheet(null);
                  go("schedule");
                }}
              >
                Back to schedule
                <ArrowRight size={17} />
              </button>
            </div>
          ) : sheet === "visit-time" ? (
            <>
              <div className="sp-dates">
                {sampleDates.map((d, i) => (
                  <button
                    key={d}
                    aria-label={`${weekdays[i]} ${d} September`}
                    aria-pressed={date === d}
                    onClick={() => setDate(d)}
                  >
                    <small>{weekdays[i]}</small>
                    <strong>{d}</strong>
                  </button>
                ))}
              </div>
              <div className="sp-slots">
                {sampleSlots
                  .filter((t) => t !== "05:30 PM")
                  .map((t) => (
                    <button
                      key={t}
                      aria-pressed={slot === t}
                      onClick={() => {
                        setSlot(t);
                        setSheet(null);
                      }}
                    >
                      {t}
                    </button>
                  ))}
              </div>
            </>
          ) : sheet === "Prescription preview" ? (
            <>
              <div className="sp-info">
                <FileText size={27} />
                <p>
                  <strong>From prescription to care</strong>Try the sample care plan from the
                  consultation screen. No file upload or AI extraction is performed.
                </p>
              </div>
              <button
                className="sp-primary sp-wide"
                onClick={() => {
                  setSheet(null);
                  go("chat");
                }}
              >
                Open sample care plan
                <ArrowRight size={17} />
              </button>
            </>
          ) : sheet === "Saved doctors" ? (
            <>
              {exampleDoctors
                .filter((d) => favorites.includes(d.id))
                .map((d) => (
                  <p key={d.id} className="sp-info">
                    {d.name}
                  </p>
                ))}
              {!favorites.length && (
                <p>Tap the heart on a doctor’s card to save an example profile here.</p>
              )}
            </>
          ) : (
            <>
              <IconPod icon={sheet === "Emergency access" ? HeartPulse : Sparkles} />
              <h3 className="sp-panel-title">A focused space for {sheet.toLowerCase()}.</h3>
              <p>
                This section is a layout preview.{" "}
                {sheet === "Emergency access"
                  ? "No emergency call or ambulance request is made."
                  : "Its full workflow can be connected after you choose the design."}
              </p>
              <button className="sp-secondary sp-wide" onClick={() => setSheet(null)}>
                Keep exploring
              </button>
            </>
          )}
        </Sheet>
      )}
    </div>
  );
}
