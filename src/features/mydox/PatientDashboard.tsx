import { useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  Bell,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FileText,
  Heart,
  HeartPulse,
  House,
  LayoutGrid,
  LogOut,
  MapPin,
  MessageCircle,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Stethoscope,
  TestTube,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { PATIENT_SERVICE_GROUPS, HEALTH_CARE_SERVICES } from "./patient-services";
import "./patient-dashboard.css";
import StitchPatientHome from "./stitch/StitchPatientHome";
import { IconPod } from "./stitch/StitchPrimitives";
import "./patient-stitch-theme.css";

export function HealthCareServicesBanner({ onAction }: { onAction: (action: string) => void }) {
  return (
    <div className="mdx-hcs-banner" aria-label="Health Care Services">
      <div className="mdx-hcs-header">
        <span className="mdx-hcs-line" />
        <span className="mdx-hcs-badge">HEALTH CARE SERVICES</span>
        <span className="mdx-hcs-line" />
      </div>
      <div className="mdx-hcs-grid">
        {HEALTH_CARE_SERVICES.map((item) => (
          <button
            key={item.id}
            className="mdx-hcs-card"
            style={
              {
                "--hcs-bg": item.bg,
                "--hcs-border": item.borderColor,
              } as React.CSSProperties
            }
            onClick={() => onAction(item.id)}
            aria-label={`Open ${item.label}`}
          >
            <div className="mdx-hcs-visual">
              {item.image ? (
                <img src={item.image} alt={item.label} />
              ) : (
                <span>{item.emoji}</span>
              )}
            </div>
            <span className="mdx-hcs-title">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export type PatientTab = "home" | "services" | "care" | "consult" | "nearby" | "profile";
type Action = (action: string) => void;

export function PatientHeader({
  area,
  areas,
  onAreaChange,
  onAction,
  unread,
  name,
  home,
  onProfile,
}: {
  area: string;
  areas: string[];
  onAreaChange: (area: string) => void;
  onAction: Action;
  unread: number;
  name: string;
  home: boolean;
  onProfile: () => void;
}) {
  return (
    <header className="mdx-header mdx-stitch-header" data-home={home}>
      <span className="sp-logo">
        <Plus size={21} strokeWidth={2.7} />
      </span>
      <div className="mdx-stitch-brand">
        <strong>MyDox</strong>
        <label className="mdx-location">
          <MapPin size={12} />
          <select
            aria-label="Care location"
            value={area}
            onChange={(e) => onAreaChange(e.target.value)}
          >
            {areas.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
      </div>
      <button
        className="mdx-icon-button mdx-notifications"
        onClick={() => onAction("notifications")}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
      >
        <Bell size={20} />
        {unread > 0 && <span className="mdx-notification-dot" />}
      </button>
      <button className="mdx-stitch-avatar" onClick={onProfile} aria-label="Open profile">
        {name
          .trim()
          .split(/\s+/)
          .slice(0, 2)
          .map((n) => n[0])
          .join("") || <UserRound size={18} />}
      </button>
    </header>
  );
}

const tabs: { id: PatientTab; label: string; icon: LucideIcon }[] = [
  { id: "home", label: "Home", icon: House },
  { id: "care", label: "Schedule", icon: CalendarDays },
  { id: "services", label: "Services", icon: Stethoscope },
  { id: "consult", label: "Consult", icon: MessageCircle },
  { id: "profile", label: "Profile", icon: UserRound },
];

export function PatientBottomNav({
  tab,
  onChange,
}: {
  tab: PatientTab;
  onChange: (tab: PatientTab) => void;
}) {
  const activeTab = tab === "nearby" ? "home" : tab;
  return (
    <nav className="mdx-bottom-nav" aria-label="Main navigation">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          aria-current={activeTab === id ? "page" : undefined}
          onClick={() => onChange(id)}
        >
          <span>
            <Icon size={21} strokeWidth={activeTab === id ? 2.3 : 1.7} />
          </span>
          {label}
        </button>
      ))}
    </nav>
  );
}

function ActionRow({
  icon: Icon,
  label,
  detail,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  detail?: string;
  onClick: () => void;
}) {
  return (
    <button className="mdx-action-row" onClick={onClick}>
      <IconPod icon={Icon} />
      <span className="mdx-row-copy">
        <strong>{label}</strong>
        {detail && <small>{detail}</small>}
      </span>
      <ChevronRight size={17} />
    </button>
  );
}

export default function PatientDashboard({
  tab,
  onTabChange,
  onAction,
  name,
  mapContent,
  doctorsContent,
  chatsContent,
  recommendationsContent,
  reportContent,
  allergyReport,
  activeRequest,
  onTrack,
}: {
  tab: PatientTab;
  onTabChange: (tab: PatientTab) => void;
  onAction: Action;
  name: string;
  mapContent: ReactNode;
  doctorsContent: ReactNode;
  chatsContent: ReactNode;
  recommendationsContent: ReactNode;
  reportContent: ReactNode;
  allergyReport: ReactNode;
  activeRequest?: { title: string; detail: string } | null;
  onTrack?: () => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const openCategory = (id: string) => {
    setExpanded(id);
    setFilter("");
    onTabChange("services");
  };
  const filteredGroups = PATIENT_SERVICE_GROUPS.map((group) => ({
    ...group,
    services: group.services.filter((service) =>
      `${group.label} ${service.label} ${service.detail || ""}`
        .toLowerCase()
        .includes(filter.trim().toLowerCase()),
    ),
  })).filter((group) => group.services.length);

  return (
    <main
      className="mdx-dashboard"
      data-tab={tab}
      aria-label={`${tab === "nearby" ? "Care nearby" : tabs.find((t) => t.id === tab)?.label} section`}
    >
      {tab === "home" && (
        <StitchPatientHome
          name={name}
          onAction={onAction}
          onServices={() => onTabChange("services")}
          onNearby={() => onTabChange("nearby")}
          allergyReport={allergyReport}
          activeRequest={activeRequest}
          onTrack={onTrack}
        />
      )}

      {tab === "services" && (
        <>
          <div className="mdx-page-heading">
            <p className="mdx-eyebrow">EXPLORE MYDOX</p>
            <h1>
              All your care.
              <br />
              Simply organised.
            </h1>
            <p>Choose a section to see what’s inside.</p>
          </div>
          <label className="mdx-service-search">
            <Search size={18} />
            <input
              aria-label="Find a service"
              placeholder="Find a service…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </label>
          <HealthCareServicesBanner onAction={onAction} />
          <div className="mdx-service-groups">
            {filteredGroups.map(({ id, label, description, icon: Icon, services }) => {
              const open = Boolean(filter.trim()) || expanded === id;
              return (
                <section className={`mdx-service-group${open ? " is-open" : ""}`} key={id}>
                  <button
                    className="mdx-group-toggle"
                    aria-expanded={open}
                    aria-controls={`mdx-group-${id}`}
                    onClick={() => {
                      setFilter("");
                      setExpanded(open ? null : id);
                    }}
                  >
                    <IconPod
                      icon={Icon}
                      tone={id === "homecare" ? "mint" : id === "programs" ? "lavender" : "blue"}
                    />
                    <span>
                      <strong>{label}</strong>
                      <small>{description}</small>
                    </span>
                    <ChevronDown size={18} />
                  </button>
                  <div id={`mdx-group-${id}`} hidden={!open} className="mdx-group-content">
                    {services.map((service) => (
                      <ActionRow
                        key={service.id}
                        icon={service.icon}
                        label={service.label}
                        detail={service.detail}
                        onClick={() => onAction(service.id)}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
          {!filteredGroups.length && (
            <p className="mdx-empty" role="status">
              No services match “{filter}”. Try another name.
            </p>
          )}
          <button
            className="mdx-emergency mdx-emergency-wide"
            onClick={() => onAction("emergency")}
          >
            <HeartPulse size={18} />
            Need urgent help? Open emergency care <ChevronRight size={16} />
          </button>
        </>
      )}

      {tab === "care" && (
        <>
          <div className="mdx-page-heading">
            <p className="mdx-eyebrow">WITH YOU, EVERY STEP</p>
            <h1>Your schedule</h1>
            <p>Your appointments, people and health story.</p>
          </div>
          <div className="mdx-action-list">
            <ActionRow
              icon={CalendarDays}
              label="My bookings"
              detail="Appointments & requests across all services"
              onClick={() => onAction("bookings")}
            />
            <ActionRow
              icon={ClipboardList}
              label="Consultation history"
              detail="Past visits, payments & follow-ups"
              onClick={() => onAction("history")}
            />
            <ActionRow
              icon={FileText}
              label="Health records"
              detail="Your reports & medical history"
              onClick={() => onAction("records")}
            />
            <ActionRow
              icon={CalendarDays}
              label="My calendar"
              onClick={() => onAction("calendar")}
            />
          </div>
          <details className="mdx-disclosure">
            <summary>
              <Stethoscope size={20} />
              <span>My doctors & family plan</span>
              <ChevronDown size={18} />
            </summary>
            <div>
              {doctorsContent}
              <ActionRow
                icon={Heart}
                label="Preferred doctors"
                onClick={() => onAction("preferred")}
              />
            </div>
          </details>

          <details className="mdx-disclosure">
            <summary>
              <ClipboardList size={20} />
              <span>Recommended by my doctor</span>
              <ChevronDown size={18} />
            </summary>
            <div>{recommendationsContent}</div>
          </details>
          <details className="mdx-disclosure">
            <summary>
              <Sparkles size={20} />
              <span>AI health tools</span>
              <ChevronDown size={18} />
            </summary>
            <div>
              <ActionRow icon={Sparkles} label="Ask AI" onClick={() => onAction("ai")} />
              <ActionRow
                icon={HeartPulse}
                label="Health companion"
                onClick={() => onAction("companion")}
              />
              <ActionRow
                icon={FileText}
                label="Saved AI summaries"
                onClick={() => onAction("aiHistory")}
              />
              {reportContent}
            </div>
          </details>
        </>
      )}

      {tab === "consult" && (
        <>
          <div className="mdx-page-heading">
            <p className="mdx-eyebrow">CARE, CONNECTED</p>
            <h1>Your consultations</h1>
            <p>Your doctors, conversations and follow-up care.</p>
          </div>
          <div className="mdx-action-list">
            <ActionRow
              icon={Stethoscope}
              label="Book a consultation"
              detail="Clinic, video or home visit"
              onClick={() => onAction("doctor")}
            />
            <ActionRow
              icon={ClipboardList}
              label="Consultation history"
              onClick={() => onAction("history")}
            />
          </div>
          <section className="mdx-stitch-consult">
            <h2>Chats & care groups</h2>
            {chatsContent}
          </section>
          <details className="mdx-disclosure">
            <summary>
              <ClipboardList size={20} />
              <span>Recommended by my doctor</span>
              <ChevronDown size={18} />
            </summary>
            <div>{recommendationsContent}</div>
          </details>
        </>
      )}

      {tab === "nearby" && (
        <>
          <div className="mdx-page-heading">
            <p className="mdx-eyebrow">CLOSER TO BETTER CARE</p>
            <h1>Care nearby</h1>
            <p>Explore hubs and services around you.</p>
          </div>
          <div className="mdx-map">{mapContent}</div>
          <div className="mdx-action-list">
            <ActionRow
              icon={Stethoscope}
              label="Find a doctor"
              onClick={() => onAction("doctor")}
            />
            <ActionRow
              icon={ShieldCheck}
              label="Hospital admission"
              onClick={() => onAction("admit")}
            />
            <ActionRow
              icon={TestTube}
              label="Labs & scans"
              onClick={() => openCategory("diagnostics")}
            />
          </div>
          <button className="mdx-emergency mdx-emergency-wide" onClick={() => onAction("sos")}>
            <HeartPulse size={18} />
            Ambulance · SOS <ChevronRight size={16} />
          </button>
        </>
      )}

      {tab === "profile" && (
        <>
          <div className="mdx-page-heading">
            <p className="mdx-eyebrow">YOUR MYDOX</p>
            <h1>Profile</h1>
          </div>
          <div className="mdx-profile-card">
            <span>
              {name
                .trim()
                .split(/\s+/)
                .slice(0, 2)
                .map((n) => n[0])
                .join("") || <UserRound />}
            </span>
            <div>
              <h2>{name || "Your account"}</h2>
              <p>Your care, your way</p>
            </div>
          </div>
          <div className="mdx-action-list">
            <ActionRow
              icon={UserRound}
              label="Health profile & settings"
              onClick={() => onAction("profile")}
            />
            <ActionRow
              icon={FileText}
              label="My health records"
              onClick={() => onAction("records")}
            />
            <ActionRow icon={MapPin} label="Care nearby" onClick={() => onTabChange("nearby")} />
            <ActionRow icon={Star} label="Rewards" onClick={() => onAction("rewards")} />
            <ActionRow
              icon={Bell}
              label="Notifications"
              onClick={() => onAction("notifications")}
            />
          </div>
          <details className="mdx-disclosure">
            <summary>
              <Users size={20} />
              <span>Memberships & benefits</span>
              <ChevronDown size={18} />
            </summary>
            <div>
              <ActionRow
                icon={Users}
                label="Family physician plan"
                onClick={() => onAction("family")}
              />
              <ActionRow
                icon={ShieldCheck}
                label="Insurance benefit"
                onClick={() => onAction("insurance")}
              />
              <ActionRow
                icon={Heart}
                label="Community programs"
                onClick={() => openCategory("community")}
              />
            </div>
          </details>
          <details className="mdx-disclosure">
            <summary>
              <LayoutGrid size={20} />
              <span>More from MyDox</span>
              <ChevronDown size={18} />
            </summary>
            <div>
              <ActionRow
                icon={Stethoscope}
                label="Clinic app demo"
                onClick={() => onAction("clinicDemo")}
              />
              <a className="mdx-account-link" href="/provider/earnings">
                Provider earnings <ArrowUpRight size={16} />
              </a>
              <a className="mdx-account-link" href="/provider/availability">
                Provider availability <ArrowUpRight size={16} />
              </a>
              <a className="mdx-account-link" href="/auth?admin=1">
                Admin sign in <ArrowUpRight size={16} />
              </a>
            </div>
          </details>
          <button className="mdx-signout" onClick={() => onAction("signout")}>
            <LogOut size={17} />
            Sign out
          </button>
        </>
      )}
    </main>
  );
}
