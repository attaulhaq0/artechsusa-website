import React, { createContext, useContext, useEffect, useRef } from "react";
import {
  IconArrowRight,
  IconArrowUpRight,
  IconArrowLeft,
  IconChevronDown,
  IconChevronRight,
  IconX,
  IconMenu2,
  IconCloud,
  IconDatabase,
  IconCode,
  IconSettings,
  IconUsers,
  IconUser,
  IconBuildingHospital,
  IconBuildingBank,
  IconShoppingBag,
  IconLayersIntersect,
  IconRoute,
  IconTargetArrow,
  IconCircleCheck,
  IconCheck,
  IconPlayerPause,
  IconPlayerPlay,
  IconBriefcase,
  IconFileText,
  IconUpload,
  IconMail,
  IconInfoCircle,
  IconSearch,
  IconShieldCheck,
} from "@tabler/icons-react";

const icons = {
  arrow: IconArrowRight,
  diagonal: IconArrowUpRight,
  back: IconArrowLeft,
  chevron: IconChevronDown,
  next: IconChevronRight,
  close: IconX,
  menu: IconMenu2,
  cloud: IconCloud,
  data: IconDatabase,
  code: IconCode,
  settings: IconSettings,
  users: IconUsers,
  user: IconUser,
  healthcare: IconBuildingHospital,
  finance: IconBuildingBank,
  retail: IconShoppingBag,
  layers: IconLayersIntersect,
  route: IconRoute,
  target: IconTargetArrow,
  success: IconCircleCheck,
  check: IconCheck,
  pause: IconPlayerPause,
  play: IconPlayerPlay,
  briefcase: IconBriefcase,
  file: IconFileText,
  upload: IconUpload,
  mail: IconMail,
  info: IconInfoCircle,
  search: IconSearch,
  shield: IconShieldCheck,
};
export function Icon({ name = "arrow", size = 22, ...props }) {
  const Glyph = icons[name] || IconArrowRight;
  return <Glyph size={size} stroke={1.5} aria-hidden="true" {...props} />;
}
export const NavigationContext = createContext(null);
export function Link({ href = "/", children, onClick, ...props }) {
  const nav = useContext(NavigationContext);
  return (
    <a
      href={nav ? nav.makeHref(href) : href}
      {...props}
      onClick={(e) => {
        onClick?.(e);
        if (
          !e.defaultPrevented &&
          nav &&
          e.button === 0 &&
          !e.metaKey &&
          !e.ctrlKey &&
          !e.shiftKey &&
          !e.altKey &&
          !/^https?:|^mailto:/.test(href)
        ) {
          e.preventDefault();
          nav.navigate(href);
        }
      }}
    >
      {children}
    </a>
  );
}
export function ButtonLink({ cta, secondary = false, className = "" }) {
  if (!cta) return null;
  return (
    <Link
      href={cta.href}
      className={`button ${secondary || cta.style === "secondary" ? "button-secondary" : ""} ${className}`}
    >
      {cta.label}
      <Icon name="arrow" size={21} />
    </Link>
  );
}
export function TextLink({ cta, children, href }) {
  return (
    <Link className="text-link" href={href || cta?.href || "/"}>
      {children || cta?.label}
      <Icon name="arrow" size={20} />
    </Link>
  );
}
export function PreviewLabel({ children, className = "" }) {
  if (!children) return null;
  return <span className={`preview-label ${className}`}>{children}</span>;
}
export function SectionHeading({ kicker, title, body, cta, centered = false }) {
  return (
    <div className={`section-heading ${centered ? "centered" : ""}`}>
      <div>
        {kicker && <p className="eyebrow">{kicker}</p>}
        <h2>{title}</h2>
        {body && <p className="section-deck">{body}</p>}
      </div>
      {cta && <TextLink cta={cta} />}
    </div>
  );
}
export function Dialog({ data, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    const previous = document.activeElement;
    el.showModal();
    return () => {
      el.close();
      previous?.focus();
    };
  }, []);
  function trapFocus(e) {
    if (e.key !== "Tab") return;
    const controls = [
      ...ref.current.querySelectorAll(
        'a[href],button:not([disabled]),input:not([disabled]),select,textarea,summary,[tabindex="0"]',
      ),
    ].filter((el) => el.getClientRects().length);
    const first = controls[0],
      last = controls[controls.length - 1];
    if (!first) {
      e.preventDefault();
      ref.current.focus();
      return;
    }
    if (
      controls.length === 1 ||
      (e.shiftKey && document.activeElement === first) ||
      (!e.shiftKey && document.activeElement === last)
    ) {
      e.preventDefault();
      (e.shiftKey ? last : first).focus();
    }
  }
  return (
    <dialog
      ref={ref}
      className="content-dialog"
      aria-labelledby="dialog-title"
      onKeyDown={trapFocus}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      <div className="dialog-top">
        <PreviewLabel>
          {data.preview_label || "Client review draft"}
        </PreviewLabel>
        <button
          autoFocus
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </div>
      <h2 id="dialog-title">{data.title}</h2>
      {children}
    </dialog>
  );
}
