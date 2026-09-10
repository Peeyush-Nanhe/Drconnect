import { useId } from "react";
import { ChevronRight, type LucideIcon } from "lucide-react";

export function IconPod({ icon: Icon, tone = "blue" }: { icon: LucideIcon; tone?: string }) {
  const gradientId = `sp-icon-${useId().replace(/:/g, "")}`;
  return (
    <span className={`sp-icon ${tone}`}>
      <Icon
        size={23}
        strokeWidth={1.8}
        stroke={`url(#${gradientId})`}
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <linearGradient
            id={gradientId}
            x1="0"
            y1="0"
            x2="24"
            y2="24"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="var(--sp-icon-start)" />
            <stop offset="100%" stopColor="var(--sp-icon-end)" />
          </linearGradient>
        </defs>
      </Icon>
    </span>
  );
}
export function Heading({
  title,
  subtitle,
  action,
  onClick,
}: {
  title: string;
  subtitle?: string;
  action?: string;
  onClick?: () => void;
}) {
  return (
    <div className="sp-heading">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action && (
        <button className="sp-text-button" onClick={onClick}>
          {action}
          <ChevronRight size={14} />
        </button>
      )}
    </div>
  );
}
