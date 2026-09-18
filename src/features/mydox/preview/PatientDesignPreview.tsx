import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Bone,
  Brain,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Eye,
  FileText,
  Heart,
  HeartPulse,
  House,
  LayoutGrid,
  MapPin,
  MessageCircle,
  Navigation,
  Pill,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  TestTube,
  UserRound,
  Users,
  Video,
  Wind,
  X,
  type LucideIcon,
} from "lucide-react";
import { PATIENT_SERVICE_GROUPS, HEALTH_CARE_SERVICES } from "../patient-services";
import { HealthCareServicesBanner } from "../PatientDashboard";
import "./patient-design-preview.css";

// This review route is entirely local state: no Auth, API, storage, payments or bookings.
type Tab = "home" | "services" | "care" | "nearby" | "profile";
type Mode = "Clinic visit" | "Video consult" | "Home visit";
type Specialty = { name: string; detail: string; icon: LucideIcon; tone: string; common?: boolean };
const specialties: Specialty[] = [
  {
    name: "General physician",
    detail: "Everyday health",
    icon: Stethoscope,
    tone: "teal",
    common: true,
  },
  { name: "Children’s health", detail: "Paediatrics", icon: Users, tone: "peach", common: true },
  { name: "Skin & hair", detail: "Dermatology", icon: Sparkles, tone: "rose", common: true },
  { name: "Women’s health", detail: "Gynaecology", icon: Heart, tone: "violet", common: true },
  { name: "Bones & joints", detail: "Orthopaedics", icon: Bone, tone: "sand", common: true },
  { name: "Heart care", detail: "Cardiology", icon: HeartPulse, tone: "blue", common: true },
  { name: "Brain & nerves", detail: "Neurology", icon: Brain, tone: "violet" },
  { name: "Breathing & lungs", detail: "Pulmonology", icon: Wind, tone: "teal" },
  { name: "Eye care", detail: "Ophthalmology", icon: Eye, tone: "peach" },
  { name: "Mental wellbeing", detail: "Psychiatry", icon: Brain, tone: "blue" },
];
const modes: { label: Mode; detail: string; icon: LucideIcon; tone: string }[] = [
  { label: "Clinic visit", detail: "Care nearby", icon: Stethoscope, tone: "teal" },
  { label: "Video consult", detail: "From anywhere", icon: Video, tone: "blue" },
  { label: "Home visit", detail: "At your door", icon: House, tone: "sand" },
];
const tabs: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "home", label: "Home", icon: House },
  { id: "services", label: "Services", icon: LayoutGrid },
  { id: "care", label: "My Care", icon: HeartPulse },
  { id: "nearby", label: "Nearby", icon: MapPin },
  { id: "profile", label: "Profile", icon: UserRound },
];
const doctors = [
  {
    name: "Dr. Anita Rao",
    initials: "AR",
    tone: "teal",
    fee: 500,
    experience: "12 years’ experience",
    time: "10:30 AM",
  },
  {
    name: "Dr. Vikram Iyer",
    initials: "VI",
    tone: "blue",
    fee: 600,
    experience: "9 years’ experience",
    time: "11:00 AM",
  },
];
const areas = [
  "Koregaon Park",
  "Wakad",
  "Baner",
  "Kothrud",
  "Aundh",
  "Viman Nagar",
  "Hinjewadi",
  "Hadapsar",
  "Kharadi",
  "Pimpri-Chinchwad",
];
const dates = [
  { day: "Wed", date: "09" },
  { day: "Thu", date: "10" },
  { day: "Fri", date: "11" },
  { day: "Sat", date: "12" },
  { day: "Sun", date: "13" },
];
const slots = ["09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM"];

function IconTile({
  icon: Icon,
  tone = "teal",
  children,
}: {
  icon: LucideIcon;
  tone?: string;
  children?: ReactNode;
}) {
  return (
    <span className={`mp-icon ${tone}`}>
      <Icon size={25} strokeWidth={1.65} />
      {children}
    </span>
  );
}
function SectionHeading({
  title,
  action,
  onClick,
}: {
  title: string;
  action?: string;
  onClick?: () => void;
}) {
  return (
    <div className="mp-section-title">
      <h2>{title}</h2>
      {action && (
        <button onClick={onClick}>
          {action}
          <ChevronRight size={15} />
        </button>
      )}
    </div>
  );
}
function Row({
  icon,
  title,
  detail,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  detail?: string;
  onClick: () => void;
}) {
  return (
    <button className="mp-row" onClick={onClick}>
      <IconTile icon={icon} />
      <span>
        <strong>{title}</strong>
        {detail && <small>{detail}</small>}
      </span>
      <ChevronRight size={18} />
    </button>
  );
}
function SampleSheet({
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
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="mp-dialog"
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="mp-sheet">
        <div className="mp-sheet-handle" />
        <header>
          <h2>{title}</h2>
          <button className="mp-circle-button" onClick={onClose} aria-label="Close preview panel">
            <X size={20} />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}

export default function PatientDesignPreview() {
  const [tab, setTab] = useState<Tab>("home");
  const [flow, setFlow] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>("Clinic visit");
  const [specialty, setSpecialty] = useState<Specialty>(specialties[0]);
  const [doctorIndex, setDoctorIndex] = useState(0);
  const [dateIndex, setDateIndex] = useState(0);
  const [slot, setSlot] = useState("");
  const [area, setArea] = useState("Koregaon Park");
  const [recentAreas, setRecentAreas] = useState<string[]>(["Koregaon Park"]);
  const [patient, setPatient] = useState("Priya Sharma");
  const [sheet, setSheet] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [commonOnly, setCommonOnly] = useState(true);
  const [group, setGroup] = useState<string | null>(null);
  const [service, setService] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const doctor = doctors[doctorIndex];
  const resetScroll = () => {
    scroller.current?.scrollTo({ top: 0 });
  };
  const navigate = (next: Tab) => {
    setTab(next);
    setFlow(null);
    setService(null);
    setQuery("");
    resetScroll();
  };
  const startBooking = (nextMode: Mode = mode) => {
    setMode(nextMode);
    setFlow(0);
    setQuery("");
    setService(null);
    resetScroll();
  };
  const nextStage = (step: number) => {
    setFlow(step);
    resetScroll();
  };
  const selectSpecialty = (item: Specialty) => {
    setSpecialty(item);
    if (item.name !== specialty.name) setSlot("");
    setDoctorIndex(0);
    nextStage(1);
  };
  const openService = (id: string, label: string) => {
    if (id === "doctor") startBooking();
    else {
      setService(label);
      resetScroll();
    }
  };
  const chooseArea = (next: string) => {
    setArea(next);
    setRecentAreas((prev) => [next, ...prev.filter((a) => a !== next)].slice(0, 3));
    setSheet(null);
  };
  const filteredSpecialties = specialties.filter(
    (s) =>
      (!commonOnly || Boolean(query.trim()) || s.common) &&
      `${s.name} ${s.detail}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const filteredGroups = PATIENT_SERVICE_GROUPS.map((g) => ({
    ...g,
    services: g.services.filter((s) =>
      `${g.label} ${s.label} ${s.detail || ""}`.toLowerCase().includes(query.toLowerCase()),
    ),
  })).filter((g) => g.services.length);
  const pageTitle =
    flow !== null
      ? ["Find your specialty", "Choose your doctor", "Choose a time", "Review your visit"][flow]
      : service || tabs.find((t) => t.id === tab)?.label;

  return (
    <div className="mp-preview">
      <aside className="mp-review-note">
        <span className="mp-review-dot" />
        <strong>DESIGN PREVIEW</strong>
        <span>Sample data · explore freely</span>
        <a href="/">
          Current app
          <ArrowUpRight size={13} />
        </a>
      </aside>
      <div className="mp-phone">
        <header className="mp-header">
          {flow !== null || service ? (
            <>
              <button
                className="mp-circle-button"
                aria-label="Go back"
                onClick={() => {
                  if (service) {
                    setService(null);
                    resetScroll();
                  } else if (flow === 0) navigate("home");
                  else nextStage((flow ?? 1) - 1);
                }}
              >
                <ArrowLeft size={21} />
              </button>
              <span className="mp-header-title">{pageTitle}</span>
              <span className="mp-mini-brand">MyDox</span>
            </>
          ) : (
            <>
              <div className="mp-brand">
                <span>
                  <Plus size={22} strokeWidth={3} />
                </span>
                MyDox<span className="mp-brand-dot">.</span>
              </div>
              <button
                className="mp-area"
                onClick={() => {
                  setLocationQuery("");
                  setSheet("location");
                }}
              >
                <MapPin size={14} />
                <span>{area}</span>
                <ChevronDown size={13} />
              </button>
              <button
                className="mp-circle-button"
                aria-label="Notifications preview"
                onClick={() => setSheet("notifications")}
              >
                <Bell size={20} />
                <i />
              </button>
            </>
          )}
        </header>
        <div className="mp-scroll" ref={scroller}>
          {flow !== null ? (
            <>
              <div className="mp-stepper" aria-label="Booking progress">
                {["Specialty", "Doctor", "Time", "Review"].map((label, index) => (
                  <button
                    key={label}
                    className={flow === index ? "active" : flow > index ? "complete" : ""}
                    disabled={index > flow}
                    onClick={() => nextStage(index)}
                    aria-current={flow === index ? "step" : undefined}
                  >
                    <span>{flow > index ? <Check size={13} /> : index + 1}</span>
                    {label}
                  </button>
                ))}
              </div>
              {flow === 0 && (
                <>
                  <div className="mp-page-intro">
                    <p className="mp-kicker">THE RIGHT CARE STARTS HERE</p>
                    <h1>
                      What can we
                      <br />
                      help you with?
                    </h1>
                    <p>Find a specialty that feels right for you.</p>
                  </div>
                  <div className="mp-mode-switch" aria-label="Consultation type">
                    {modes.map((m) => (
                      <button
                        key={m.label}
                        aria-pressed={mode === m.label}
                        onClick={() => setMode(m.label)}
                      >
                        <m.icon size={17} />
                        {m.label}
                      </button>
                    ))}
                  </div>
                  <label className="mp-search">
                    <Search size={20} />
                    <input
                      aria-label="Search specialties"
                      placeholder="Search a specialty or concern"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                  {!query && (
                    <>
                      <SectionHeading title="Your familiar care" />
                      <button
                        className="mp-familiar"
                        onClick={() => {
                          setSpecialty(specialties[0]);
                          setDoctorIndex(0);
                          nextStage(2);
                        }}
                      >
                        <span className="mp-avatar teal">AR</span>
                        <span>
                          <strong>Dr. Anita Rao</strong>
                          <small>General physician · example profile</small>
                        </span>
                        <span className="mp-text-action">
                          Book again
                          <ArrowUpRight size={15} />
                        </span>
                      </button>
                    </>
                  )}
                  <div className="mp-segment">
                    <button aria-pressed={commonOnly} onClick={() => setCommonOnly(true)}>
                      Common care
                    </button>
                    <button aria-pressed={!commonOnly} onClick={() => setCommonOnly(false)}>
                      All specialties
                    </button>
                  </div>
                  <div className="mp-specialty-grid">
                    {filteredSpecialties.map((s) => (
                      <button key={s.name} onClick={() => selectSpecialty(s)}>
                        <IconTile icon={s.icon} tone={s.tone} />
                        <strong>{s.name}</strong>
                        <small>{s.detail}</small>
                        <ArrowUpRight size={15} />
                      </button>
                    ))}
                  </div>
                  {!filteredSpecialties.length && (
                    <div className="mp-empty">
                      <Search size={26} />
                      <h2>No matching specialty</h2>
                      <p>Try “skin”, “heart” or “general”.</p>
                      <button className="mp-secondary" onClick={() => setQuery("")}>
                        Clear search
                      </button>
                    </div>
                  )}
                </>
              )}
              {flow === 1 && (
                <>
                  <div className="mp-page-intro">
                    <p className="mp-kicker">
                      {mode.toUpperCase()} · {area.toUpperCase()}
                    </p>
                    <h1>
                      Your care.
                      <br />
                      Your choice.
                    </h1>
                    <p>{specialty.name} · example doctor profiles</p>
                  </div>
                  <div className="mp-doctor-list">
                    {doctors.map((d, index) => (
                      <article
                        key={d.name}
                        className={`mp-doctor-card${doctorIndex === index ? " selected" : ""}`}
                      >
                        <div className={`mp-doctor-portrait ${d.tone}`}>
                          <span className="mp-portrait-circle">
                            <UserRound size={57} strokeWidth={1.1} />
                          </span>
                          <span className="mp-example-label">Example profile</span>
                          <button
                            aria-label={`About ${d.name}`}
                            onClick={() => {
                              setDoctorIndex(index);
                              setSheet("doctor");
                            }}
                          >
                            <ArrowUpRight size={20} />
                          </button>
                        </div>
                        <div className="mp-doctor-copy">
                          <h2>{d.name}</h2>
                          <p>{specialty.name}</p>
                          <small>{d.experience} · sample information</small>
                          <div>
                            <span>
                              <strong>₹{d.fee}</strong>
                              <small>Example visit fee</small>
                            </span>
                            <button
                              className="mp-primary"
                              onClick={() => {
                                if (doctorIndex !== index) setSlot("");
                                setDoctorIndex(index);
                                nextStage(2);
                              }}
                            >
                              Choose
                              <ArrowRight size={16} />
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </>
              )}
              {flow === 2 && (
                <>
                  <div className="mp-page-intro">
                    <p className="mp-kicker">MAKE TIME FOR YOU</p>
                    <h1>
                      A time that
                      <br />
                      works for you.
                    </h1>
                    <p>Select an example date and time.</p>
                  </div>
                  <div className="mp-familiar">
                    <span className={`mp-avatar ${doctor.tone}`}>{doctor.initials}</span>
                    <span>
                      <strong>{doctor.name}</strong>
                      <small>{specialty.name}</small>
                    </span>
                    <span className="mp-mode-tag">{mode}</span>
                  </div>
                  <SectionHeading title="September 2026" />
                  <div className="mp-dates">
                    {dates.map((d, index) => (
                      <button
                        key={d.date}
                        aria-pressed={dateIndex === index}
                        aria-label={`${d.day} ${d.date} September`}
                        onClick={() => {
                          setDateIndex(index);
                          setSlot("");
                        }}
                      >
                        <small>{d.day}</small>
                        <strong>{d.date}</strong>
                        <i />
                      </button>
                    ))}
                  </div>
                  <SectionHeading title="Morning" />
                  <div className="mp-time-slots">
                    {slots.map((time) => (
                      <button key={time} aria-pressed={slot === time} onClick={() => setSlot(time)}>
                        {time}
                      </button>
                    ))}
                  </div>
                  <p className="mp-sample-note">
                    <Clock3 size={15} />
                    Example slots for reviewing this design
                  </p>
                  <div className="mp-patient-row">
                    <IconTile icon={UserRound} />
                    <span>
                      <small>Booking for</small>
                      <strong>{patient}</strong>
                    </span>
                    <button onClick={() => setSheet("patient")}>Change</button>
                  </div>
                  <div className="mp-soft-note">
                    <ShieldCheck size={22} />
                    <p>
                      Everything in one place.
                      <br />
                      <span>Review your visit details before continuing.</span>
                    </p>
                  </div>
                </>
              )}
              {flow === 3 && (
                <>
                  <div className="mp-page-intro">
                    <p className="mp-kicker">ONE LAST LOOK</p>
                    <h1>
                      Your visit,
                      <br />
                      at a glance.
                    </h1>
                    <p>Review this sample appointment.</p>
                  </div>
                  <div className="mp-review-card">
                    <div className="mp-familiar">
                      <span className={`mp-avatar ${doctor.tone}`}>{doctor.initials}</span>
                      <span>
                        <strong>{doctor.name}</strong>
                        <small>{specialty.name}</small>
                      </span>
                    </div>
                    <dl>
                      <div>
                        <dt>Consultation</dt>
                        <dd>{mode}</dd>
                      </div>
                      <div>
                        <dt>Date & time</dt>
                        <dd>
                          {dates[dateIndex].date} Sep 2026 · {slot}
                        </dd>
                      </div>
                      <div>
                        <dt>Patient</dt>
                        <dd>{patient}</dd>
                      </div>
                      <div>
                        <dt>Location</dt>
                        <dd>{mode === "Video consult" ? "Online" : area}</dd>
                      </div>
                      <div>
                        <dt>Example fee</dt>
                        <dd>₹{doctor.fee}</dd>
                      </div>
                    </dl>
                    <button className="mp-inline" onClick={() => nextStage(2)}>
                      Edit visit details
                      <ArrowRight size={15} />
                    </button>
                  </div>
                  <p className="mp-sample-note">
                    Design preview only. No payment or appointment will be created.
                  </p>
                </>
              )}
            </>
          ) : service ? (
            <>
              <div className="mp-page-intro">
                <p className="mp-kicker">YOUR CARE, SIMPLIFIED</p>
                <h1>{service}</h1>
                <p>An example of how a service opens into its own focused page.</p>
              </div>
              <div className="mp-service-example">
                <IconTile icon={HeartPulse} />
                <h2>Care that comes together.</h2>
                <p>Choose your preferences, explore your options and review the details.</p>
              </div>
              <div className="mp-list">
                <Row
                  icon={ClipboardListIcon}
                  title="Your requirements"
                  detail="Tell us what you need"
                  onClick={() => setSheet("requirements")}
                />
                <Row
                  icon={MapPin}
                  title={area}
                  detail="Choose your area"
                  onClick={() => setSheet("location")}
                />
                <Row
                  icon={CalendarDays}
                  title="Preferred time"
                  detail="Choose what suits you"
                  onClick={() => setSheet("preferred-time")}
                />
              </div>
              <button className="mp-primary mp-full" onClick={() => setSheet("service-example")}>
                Explore options
                <ArrowRight size={17} />
              </button>
            </>
          ) : tab === "home" ? (
            <>
              <div className="mp-greeting">
                <div>
                  <p className="mp-kicker">A LITTLE CARE, EVERY DAY</p>
                  <h1>
                    Hello, Priya<span>✦</span>
                  </h1>
                  <p>Let’s find the right care for you.</p>
                </div>
                <button className="mp-emergency" onClick={() => setSheet("emergency")}>
                  <HeartPulse size={15} />
                  SOS
                </button>
              </div>
              <div className="mp-search-row">
                <button
                  className="mp-search"
                  onClick={() => {
                    navigate("services");
                  }}
                >
                  <Search size={20} />
                  <span>Search your care</span>
                </button>
                <button className="mp-ai" onClick={() => setSheet("ai")}>
                  <Sparkles size={19} />
                  <span>Ask AI</span>
                </button>
              </div>
              <SectionHeading title="How would you like to consult?" />
              <div className="mp-consult-grid">
                {modes.map((m) => (
                  <button key={m.label} onClick={() => startBooking(m.label)}>
                    <IconTile icon={m.icon} tone={m.tone} />
                    <strong>{m.label}</strong>
                    <small>{m.detail}</small>
                  </button>
                ))}
              </div>
              <div className="mp-quick-services">
                {[
                  { id: "labtest", label: "Lab tests", icon: TestTube },
                  { id: "medicines", label: "Medicines", icon: Pill },
                  { id: "programs", label: "Care plans", icon: Heart },
                  { id: "all", label: "All services", icon: LayoutGrid },
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      if (s.id === "all") navigate("services");
                      else if (s.id === "programs") {
                        navigate("services");
                        setGroup("programs");
                      } else openService(s.id, s.label);
                    }}
                  >
                    <span>
                      <s.icon size={23} strokeWidth={1.7} />
                    </span>
                    {s.label}
                  </button>
                ))}
              </div>
              <SectionHeading
                title="Your next appointment"
                action="My Care"
                onClick={() => navigate("care")}
              />
              <AppointmentCard onClick={() => setSheet("appointment")} />
              <SectionHeading
                title="Find care by specialty"
                action="View all"
                onClick={() => startBooking()}
              />
              <div className="mp-specialty-grid compact">
                {specialties.slice(0, 4).map((s) => (
                  <button
                    key={s.name}
                    onClick={() => {
                      setMode("Clinic visit");
                      selectSpecialty(s);
                    }}
                  >
                    <IconTile icon={s.icon} tone={s.tone} />
                    <strong>{s.name}</strong>
                    <small>{s.detail}</small>
                    <ArrowUpRight size={15} />
                  </button>
                ))}
              </div>
              <button
                className="mp-community"
                onClick={() => {
                  navigate("services");
                  setGroup("community");
                }}
              >
                <Users size={26} />
                <span>
                  <strong>Better care, together.</strong>
                  <small>Explore community programs & benefits</small>
                </span>
                <ArrowUpRight size={18} />
              </button>
            </>
          ) : tab === "services" ? (
            <>
              <div className="mp-page-intro">
                <p className="mp-kicker">EVERY PART OF YOUR HEALTH</p>
                <h1>
                  One place.
                  <br />
                  All your care.
                </h1>
                <p>Open a section. Find what you need.</p>
              </div>
              <label className="mp-search">
                <Search size={20} />
                <input
                  aria-label="Search services"
                  placeholder="Doctors, tests, home care…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <HealthCareServicesBanner onAction={(id) => openService(id, HEALTH_CARE_SERVICES.find((h) => h.id === id)?.label || id)} />
              <div className="mp-groups">
                {filteredGroups.map((g) => {
                  const open = Boolean(query) || group === g.id;
                  return (
                    <section key={g.id}>
                      <button
                        className="mp-group"
                        onClick={() => {
                          setQuery("");
                          setGroup(open ? null : g.id);
                        }}
                        aria-expanded={open}
                        aria-controls={`mp-${g.id}`}
                      >
                        <IconTile icon={g.icon} />
                        <span>
                          <strong>{g.label}</strong>
                          <small>{g.description}</small>
                        </span>
                        <ChevronDown size={18} />
                      </button>
                      <div id={`mp-${g.id}`} hidden={!open} className="mp-group-items">
                        {g.services.map((s) => (
                          <Row
                            key={s.id}
                            icon={s.icon}
                            title={s.label}
                            onClick={() => openService(s.id, s.label)}
                          />
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
              {!filteredGroups.length && (
                <p className="mp-empty">No matching service. Try another search.</p>
              )}
            </>
          ) : tab === "care" ? (
            <>
              <div className="mp-page-intro">
                <p className="mp-kicker">WITH YOU, EVERY STEP</p>
                <h1>
                  Your care,
                  <br />
                  all together.
                </h1>
                <p>Appointments, conversations and health records.</p>
              </div>
              <SectionHeading title="Upcoming" />
              <AppointmentCard onClick={() => setSheet("appointment")} />
              <div className="mp-list">
                <Row
                  icon={CalendarDays}
                  title="All appointments"
                  detail="Visits & requests across your services"
                  onClick={() => setSheet("appointment")}
                />
                <Row
                  icon={FileText}
                  title="Health records"
                  detail="Reports, prescriptions & summaries"
                  onClick={() => setSheet("records")}
                />
                <Row
                  icon={MessageCircle}
                  title="Care conversations"
                  detail="Your doctors & care groups"
                  onClick={() => setSheet("conversations")}
                />
              </div>
              <SectionHeading title="Your care team" />
              <button className="mp-familiar" onClick={() => startBooking()}>
                <span className="mp-avatar teal">AR</span>
                <span>
                  <strong>Dr. Anita Rao</strong>
                  <small>General physician · example profile</small>
                </span>
                <ArrowUpRight size={18} />
              </button>
            </>
          ) : tab === "nearby" ? (
            <>
              <div className="mp-page-intro">
                <p className="mp-kicker">GOOD CARE, CLOSER</p>
                <h1>
                  In your
                  <br />
                  neighbourhood.
                </h1>
                <button className="mp-inline" onClick={() => setSheet("location")}>
                  <MapPin size={16} />
                  {area}
                  <ChevronDown size={15} />
                </button>
              </div>
              <div className="mp-map">
                <svg viewBox="0 0 400 260" aria-hidden="true">
                  <rect width="400" height="260" fill="#e7efec" />
                  <path d="M0 20H130V105H0ZM240 160H400V260H240Z" fill="#d0e2d6" />
                  <path
                    d="M-10 170L410 35M120 -10L260 270M-10 240L400 145M-10 40L410 225"
                    fill="none"
                    stroke="#fff"
                    strokeWidth="14"
                  />
                  <path d="M10 265Q230 80 400 220" fill="none" stroke="#b7dce0" strokeWidth="21" />
                  <circle cx="210" cy="130" r="45" fill="#137c8020" />
                  <circle cx="210" cy="130" r="9" fill="#147a80" stroke="white" strokeWidth="4" />
                </svg>
                <button
                  className="mp-map-pin"
                  onClick={() => setSheet("hub")}
                  aria-label="Explore example MyDox hub"
                >
                  <Plus size={24} />
                </button>
                <span>Illustrative map</span>
              </div>
              <div className="mp-list">
                <Row
                  icon={Stethoscope}
                  title="MyDox care hub"
                  detail="Example listing · tap to explore"
                  onClick={() => setSheet("hub")}
                />
                <Row
                  icon={TestTube}
                  title="Diagnostics nearby"
                  detail="Explore tests and scans"
                  onClick={() => openService("labtest", "Tests & scans")}
                />
              </div>
            </>
          ) : (
            <>
              <div className="mp-page-intro">
                <p className="mp-kicker">YOUR MYDOX</p>
                <h1>Made for you.</h1>
              </div>
              <div className="mp-profile">
                <span className="mp-avatar teal">PS</span>
                <div>
                  <h2>Priya Sharma</h2>
                  <p>Sample patient profile</p>
                </div>
              </div>
              <div className="mp-list">
                <Row
                  icon={UserRound}
                  title="My health profile"
                  detail="Personal details & preferences"
                  onClick={() => setSheet("patient")}
                />
                <Row
                  icon={Users}
                  title="Family & loved ones"
                  detail="Preview family selection"
                  onClick={() => setSheet("patient")}
                />
                <Row
                  icon={Heart}
                  title="Plans & benefits"
                  onClick={() => {
                    navigate("services");
                    setGroup("community");
                  }}
                />
                <Row icon={Bell} title="Notifications" onClick={() => setSheet("notifications")} />
                <Row
                  icon={ShieldCheck}
                  title="Privacy & account"
                  onClick={() => setSheet("account")}
                />
              </div>
              <a className="mp-current-app" href="/">
                Return to current MyDox app
                <ArrowUpRight size={17} />
              </a>
            </>
          )}
        </div>
        {flow === 2 || flow === 3 ? (
          <div className="mp-booking-footer">
            <span>
              <small>Example consultation fee</small>
              <strong>₹{doctor.fee}</strong>
            </span>
            <button
              className="mp-primary"
              disabled={flow === 2 && !slot}
              onClick={() => (flow === 2 ? nextStage(3) : setSheet("complete"))}
            >
              {flow === 2 ? "Review visit" : "Finish sample"}
              <ArrowRight size={17} />
            </button>
          </div>
        ) : (
          <nav className="mp-nav" aria-label="Preview navigation">
            {tabs.map((t) => (
              <button
                key={t.id}
                aria-current={(flow !== null ? "services" : tab) === t.id ? "page" : undefined}
                onClick={() => navigate(t.id)}
              >
                <span>
                  <t.icon size={23} strokeWidth={1.7} />
                </span>
                {t.label}
              </button>
            ))}
          </nav>
        )}
      </div>
      {sheet && (
        <SampleSheet
          title={
            {
              location: "Choose your area",
              patient: "Who is this visit for?",
              complete: "Preview complete",
              doctor: doctor.name,
              ai: "Ask MyDox AI",
              emergency: "Emergency access preview",
              appointment: "Your appointment",
              hub: "MyDox care hub",
            }[sheet] || "Explore this preview"
          }
          onClose={() => setSheet(null)}
        >
          {sheet === "location" ? (
            <>
              <label className="mp-search">
                <Search size={19} />
                <input
                  autoFocus
                  aria-label="Search city or area"
                  placeholder="Search city or area"
                  value={locationQuery}
                  onChange={(e) => setLocationQuery(e.target.value)}
                />
              </label>
              <button className="mp-locate" onClick={() => chooseArea("Koregaon Park")}>
                <Navigation size={19} />
                <span>
                  <strong>Use current location</strong>
                  <small>Simulates selection in this preview</small>
                </span>
              </button>
              {!locationQuery && (
                <>
                  <p className="mp-kicker">RECENT AREAS</p>
                  <div className="mp-location-chips">
                    {recentAreas.map((a) => (
                      <button key={a} onClick={() => chooseArea(a)}>
                        {a}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <SectionHeading title="Areas in Pune" />
              <div className="mp-area-list">
                {areas
                  .filter((a) => a.toLowerCase().includes(locationQuery.toLowerCase()))
                  .map((a) => (
                    <button key={a} onClick={() => chooseArea(a)}>
                      <MapPin size={17} />
                      {a}
                      {area === a ? <Check size={17} /> : <ChevronRight size={17} />}
                    </button>
                  ))}
              </div>
              {!areas.some((a) => a.toLowerCase().includes(locationQuery.toLowerCase())) && (
                <p className="mp-sample-note">No sample areas match this search.</p>
              )}
            </>
          ) : sheet === "patient" ? (
            <>
              <p className="mp-sample-note">Example profiles for reviewing patient selection.</p>
              {["Priya Sharma", "Rahul Verma"].map((p) => (
                <Row
                  key={p}
                  icon={UserRound}
                  title={p}
                  detail={p === patient ? "Selected for this sample" : "Sample family profile"}
                  onClick={() => {
                    setPatient(p);
                    setSheet(null);
                  }}
                />
              ))}
            </>
          ) : sheet === "complete" ? (
            <div className="mp-complete">
              <span>
                <Check size={34} />
              </span>
              <h3>That’s the new booking experience.</h3>
              <p>You’ve reached the end of the sample. No appointment or payment was created.</p>
              <button
                className="mp-primary mp-full"
                onClick={() => {
                  setSheet(null);
                  navigate("home");
                }}
              >
                Back to preview home
                <ArrowRight size={16} />
              </button>
            </div>
          ) : sheet === "doctor" ? (
            <>
              <div className="mp-familiar">
                <span className={`mp-avatar ${doctor.tone}`}>{doctor.initials}</span>
                <span>
                  <strong>{doctor.name}</strong>
                  <small>{specialty.name}</small>
                </span>
              </div>
              <p className="mp-sheet-copy">
                A calm, focused space for the doctor’s introduction, experience, consultation
                options and visit details.
              </p>
              <p className="mp-sample-note">Example profile · ₹{doctor.fee} sample visit fee</p>
              <button
                className="mp-primary mp-full"
                onClick={() => {
                  setSheet(null);
                  nextStage(2);
                }}
              >
                Choose a time
                <ArrowRight size={16} />
              </button>
            </>
          ) : sheet === "appointment" ? (
            <>
              <div className="mp-familiar">
                <span className="mp-avatar teal">AR</span>
                <span>
                  <strong>Dr. Anita Rao</strong>
                  <small>General physician</small>
                </span>
              </div>
              <div className="mp-appointment-meta">
                <span>
                  <CalendarDays size={17} />
                  09 Sep · 10:30 AM
                </span>
                <span>
                  <Video size={17} />
                  Video consult
                </span>
              </div>
              <p className="mp-sample-note">This is an example appointment, not a real booking.</p>
              <button
                className="mp-primary mp-full"
                onClick={() => {
                  setSheet(null);
                  setMode("Video consult");
                  setSpecialty(specialties[0]);
                  setDoctorIndex(0);
                  nextStage(2);
                }}
              >
                Try the schedule screen
                <ArrowRight size={16} />
              </button>
            </>
          ) : sheet === "ai" ? (
            <>
              <div className="mp-ai-welcome">
                <Sparkles size={32} />
                <h3>A little guidance to get started.</h3>
                <p>A sample entry to the existing MyDox health assistant.</p>
              </div>
              <Row
                icon={Stethoscope}
                title="Help me find a specialty"
                onClick={() => {
                  setSheet(null);
                  startBooking();
                }}
              />
              <Row
                icon={LayoutGrid}
                title="Explore available services"
                onClick={() => {
                  setSheet(null);
                  navigate("services");
                }}
              />
            </>
          ) : sheet === "emergency" ? (
            <>
              <p className="mp-sheet-copy">
                Emergency support stays easy to find, with clear choices for ambulance and hospital
                assistance.
              </p>
              <div className="mp-soft-note">
                <HeartPulse size={25} />
                <p>
                  This panel demonstrates the entry point.
                  <br />
                  <span>No call or dispatch is made in this sample.</span>
                </p>
              </div>
              <button className="mp-secondary mp-full" onClick={() => setSheet(null)}>
                Return to preview
              </button>
            </>
          ) : (
            <>
              <div className="mp-service-example">
                <IconTile
                  icon={
                    sheet === "records"
                      ? FileText
                      : sheet === "conversations"
                        ? MessageCircle
                        : HeartPulse
                  }
                />
                <h3>
                  {{
                    records: "Your health story, organised.",
                    conversations: "Care is a conversation.",
                    notifications: "Your updates, in one place.",
                    hub: "Care in your neighbourhood.",
                    account: "Your preferences. Your control.",
                    requirements: "Start with what you need.",
                    "preferred-time": "Make room for care.",
                  }[sheet] ||
                    service ||
                    "A focused space for your care."}
                </h3>
                <p>
                  This panel shows the proposed layout for this section. It uses sample content for
                  design review.
                </p>
              </div>
              <button className="mp-secondary mp-full" onClick={() => setSheet(null)}>
                Back to exploring
              </button>
            </>
          )}
        </SampleSheet>
      )}
    </div>
  );
}

function AppointmentCard({ onClick }: { onClick: () => void }) {
  return (
    <button className="mp-appointment" onClick={onClick}>
      <div className="mp-appointment-top">
        <span className="mp-avatar">AR</span>
        <span>
          <strong>Dr. Anita Rao</strong>
          <small>General physician</small>
        </span>
        <span className="mp-example-label">Example</span>
      </div>
      <div className="mp-appointment-meta">
        <span>
          <CalendarDays size={16} />
          09 Sep · 10:30 AM
        </span>
        <span>
          <Video size={16} />
          Video consult
        </span>
        <ChevronRight size={17} />
      </div>
    </button>
  );
}

const ClipboardListIcon = FileText;
