import "./_group.css";
import {
  Activity,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Bell,
  Check,
  CircleDashed,
  Clock3,
  FileClock,
  Fingerprint,
  Gauge,
  Landmark,
  LockKeyhole,
  Pause,
  ReceiptText,
  ShieldCheck,
  Siren,
  Wallet,
  Workflow,
} from "lucide-react";

const sections = [
  { label: "Posição de caixa", href: "#posicao" },
  { label: "Obrigações", href: "#obrigacoes" },
  { label: "Fila e disputas", href: "#fila" },
  { label: "Controles", href: "#controles" },
];

const obligations = [
  {
    label: "Créditos nas carteiras",
    detail: "Saldo disponível que pertence aos usuários",
    icon: Wallet,
  },
  {
    label: "Prêmios a entregar",
    detail: "Exposição dos prêmios ainda não liquidados",
    icon: ReceiptText,
  },
  {
    label: "Dívida em disputas abertas",
    detail: "Compromissos vinculados a disputas em andamento",
    icon: Activity,
  },
  {
    label: "Resgates pendentes",
    detail: "Fila de solicitações aguardando pagamento",
    icon: ArrowUpRight,
  },
];

function SectionHeading({
  number,
  eyebrow,
  title,
  note,
}: {
  number: string;
  eyebrow: string;
  title: string;
  note?: string;
}) {
  return (
    <div className="cp-section-heading">
      <span className="cp-section-number">{number}</span>
      <div>
        <p className="cp-eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      {note && <span className="cp-heading-note">{note}</span>}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof CircleDashed;
  title: string;
  children: string;
}) {
  return (
    <div className="cp-empty">
      <span className="cp-empty-icon" aria-hidden="true">
        <Icon size={17} strokeWidth={1.8} />
      </span>
      <div>
        <strong>{title}</strong>
        <p>{children}</p>
      </div>
      <span className="cp-empty-dash" aria-hidden="true">—</span>
    </div>
  );
}

function UnavailableTag({ children = "Aguardando dados reais" }: { children?: string }) {
  return (
    <span className="cp-unavailable">
      <CircleDashed size={13} strokeWidth={1.8} aria-hidden="true" />
      {children}
    </span>
  );
}

export function CashProtection() {
  return (
    <div className="cp-frame">
      <style>{`
        .cp-frame {
          --cp-bg: #f1f2eb;
          --cp-paper: #fbfcf8;
          --cp-ink: #18231d;
          --cp-muted: #657169;
          --cp-soft-muted: #879188;
          --cp-line: #d8ddd4;
          --cp-line-strong: #c5cec3;
          --cp-deep: #1b3328;
          --cp-deep-2: #264536;
          --cp-lime: #d4ff4f;
          --cp-lime-muted: #e9f5c8;
          --cp-caution: #986c2d;
          min-height: 100dvh;
          background: var(--cp-bg);
          color: var(--cp-ink);
          font-family: var(--lp-body);
          font-size: 14px;
          line-height: 1.5;
        }
        .cp-frame * { box-sizing: border-box; }
        .cp-frame a { color: inherit; text-decoration: none; }
        .cp-topbar {
          position: sticky;
          top: 0;
          z-index: 10;
          border-bottom: 1px solid var(--cp-line);
          background: color-mix(in srgb, var(--cp-bg) 92%, transparent);
          backdrop-filter: blur(16px);
        }
        .cp-topbar-inner, .cp-main {
          width: min(100% - 48px, 1320px);
          margin: 0 auto;
        }
        .cp-topbar-inner {
          min-height: 72px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
        }
        .cp-brand {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          min-width: 220px;
        }
        .cp-brand-mark {
          display: grid;
          width: 36px;
          height: 36px;
          place-items: center;
          border-radius: 11px;
          background: var(--cp-deep);
          color: var(--cp-lime);
          font: 800 15px/1 var(--lp-display);
          letter-spacing: -1px;
          box-shadow: inset 0 0 0 1px rgb(255 255 255 / 10%);
        }
        .cp-brand-name {
          display: block;
          font: 800 15px/1.1 var(--lp-display);
          letter-spacing: -.4px;
        }
        .cp-brand-sub {
          margin-top: 4px;
          color: var(--cp-muted);
          font: 700 9px/1 var(--lp-mono);
          letter-spacing: .12em;
        }
        .cp-topline {
          display: flex;
          align-items: center;
          gap: 18px;
          color: var(--cp-muted);
          font-size: 12px;
        }
        .cp-preview-label {
          padding: 7px 10px;
          border: 1px solid var(--cp-line-strong);
          border-radius: 5px;
          color: var(--cp-muted);
          font: 700 9px/1 var(--lp-mono);
          letter-spacing: .08em;
          text-transform: uppercase;
        }
        .cp-connection {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          white-space: nowrap;
        }
        .cp-connection-dot {
          width: 8px;
          height: 8px;
          border: 1px solid #a7a99e;
          border-radius: 50%;
          background: #e5e7dd;
        }
        .cp-main { padding: 0 0 72px; }
        .cp-nav {
          display: flex;
          gap: 26px;
          align-items: center;
          min-height: 54px;
          border-bottom: 1px solid var(--cp-line);
          overflow-x: auto;
          scrollbar-width: none;
        }
        .cp-nav::-webkit-scrollbar { display: none; }
        .cp-nav-label {
          flex: 0 0 auto;
          color: var(--cp-soft-muted);
          font: 700 9px/1 var(--lp-mono);
          letter-spacing: .08em;
        }
        .cp-nav a {
          position: relative;
          display: inline-flex;
          align-items: center;
          height: 54px;
          color: var(--cp-muted);
          font-size: 12px;
          font-weight: 650;
          transition: color 160ms ease, opacity 160ms ease;
        }
        .cp-nav a::after {
          position: absolute;
          right: 0;
          bottom: -1px;
          left: 0;
          height: 2px;
          background: var(--cp-deep);
          content: "";
          opacity: 0;
          transform: scaleX(.72);
          transition: transform 160ms ease, opacity 160ms ease;
        }
        .cp-nav a:hover, .cp-nav a:focus-visible { color: var(--cp-ink); }
        .cp-nav a:hover::after, .cp-nav a:focus-visible::after {
          opacity: 1;
          transform: scaleX(1);
        }
        .cp-frame a:focus-visible, .cp-frame button:focus-visible {
          outline: 3px solid #7e9d49;
          outline-offset: 3px;
        }
        .cp-intro {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 28px;
          padding: 38px 0 26px;
        }
        .cp-eyebrow {
          margin: 0 0 8px;
          color: var(--cp-muted);
          font: 700 10px/1.25 var(--lp-mono);
          letter-spacing: .105em;
          text-transform: uppercase;
        }
        .cp-intro h1 {
          margin: 0;
          font: 700 clamp(34px, 4vw, 48px)/1.02 var(--lp-display);
          letter-spacing: -1.9px;
        }
        .cp-intro-copy {
          max-width: 610px;
          margin: 12px 0 0;
          color: var(--cp-muted);
          font-size: 15px;
          line-height: 1.55;
        }
        .cp-intro-side {
          display: flex;
          align-items: center;
          gap: 11px;
          flex: 0 0 auto;
          padding: 11px 14px;
          border: 1px solid var(--cp-line);
          border-radius: 8px;
          background: rgb(251 252 248 / 60%);
        }
        .cp-intro-side-icon {
          display: grid;
          width: 34px;
          height: 34px;
          place-items: center;
          border-radius: 8px;
          background: var(--cp-lime-muted);
          color: var(--cp-deep);
        }
        .cp-intro-side strong {
          display: block;
          font: 700 12px/1.25 var(--lp-display);
        }
        .cp-intro-side span {
          display: block;
          margin-top: 3px;
          color: var(--cp-muted);
          font-size: 10px;
        }
        .cp-position {
          overflow: hidden;
          border: 1px solid #254333;
          border-radius: 12px;
          background: var(--cp-deep);
          color: #f1f5ec;
          box-shadow: 0 14px 40px rgb(31 54 42 / 10%);
        }
        .cp-position-top {
          display: grid;
          grid-template-columns: minmax(0, 1.15fr) minmax(320px, .85fr);
          align-items: stretch;
        }
        .cp-cash-main {
          padding: 27px 30px 25px;
          border-right: 1px solid rgb(255 255 255 / 13%);
        }
        .cp-inverse-eyebrow {
          display: flex;
          align-items: center;
          gap: 9px;
          color: #c0cfc4;
          font: 700 10px/1.25 var(--lp-mono);
          letter-spacing: .08em;
          text-transform: uppercase;
        }
        .cp-cash-amount {
          display: flex;
          align-items: baseline;
          gap: 11px;
          margin-top: 15px;
        }
        .cp-cash-amount strong {
          font: 700 clamp(54px, 7vw, 82px)/.92 var(--lp-display);
          letter-spacing: -4px;
          color: #f5f7ef;
          font-variant-numeric: tabular-nums;
        }
        .cp-cash-amount span {
          color: #b9c7bc;
          font: 700 11px/1 var(--lp-mono);
          letter-spacing: .1em;
        }
        .cp-cash-caption {
          margin: 11px 0 0;
          color: #b6c5ba;
          font-size: 12px;
        }
        .cp-position-rule {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 20px;
          color: #ced9cf;
          font-size: 11px;
        }
        .cp-position-rule svg { color: var(--cp-lime); }
        .cp-coverage {
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 25px 30px;
        }
        .cp-coverage-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
        }
        .cp-coverage-head p {
          margin: 0;
          color: #bdcabe;
          font-size: 12px;
        }
        .cp-coverage-value {
          display: block;
          margin-top: 8px;
          font: 700 34px/1 var(--lp-display);
          letter-spacing: -1px;
          font-variant-numeric: tabular-nums;
        }
        .cp-coverage-icon {
          display: grid;
          width: 39px;
          height: 39px;
          place-items: center;
          border: 1px solid rgb(255 255 255 / 18%);
          border-radius: 10px;
          color: var(--cp-lime);
        }
        .cp-coverage-track {
          position: relative;
          height: 7px;
          margin-top: 22px;
          overflow: hidden;
          border: 1px dashed rgb(255 255 255 / 30%);
          border-radius: 99px;
          background: rgb(255 255 255 / 5%);
        }
        .cp-coverage-track::after {
          position: absolute;
          inset: 0 auto 0 0;
          width: 0;
          background: var(--cp-lime);
          content: "";
        }
        .cp-coverage-foot {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          margin-top: 8px;
          color: #b7c5ba;
          font: 10px/1.4 var(--lp-mono);
        }
        .cp-position-bottom {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          border-top: 1px solid rgb(255 255 255 / 13%);
          background: rgb(9 19 13 / 14%);
        }
        .cp-position-stat {
          min-width: 0;
          padding: 16px 22px 18px 30px;
          border-right: 1px solid rgb(255 255 255 / 12%);
        }
        .cp-position-stat:last-child { border-right: 0; }
        .cp-position-stat span {
          display: block;
          color: #bdcabe;
          font-size: 11px;
        }
        .cp-position-stat strong {
          display: block;
          margin-top: 6px;
          color: #f1f5ed;
          font: 700 21px/1.1 var(--lp-mono);
          letter-spacing: -.7px;
        }
        .cp-position-stat small {
          display: block;
          margin-top: 5px;
          color: #9fb1a4;
          font-size: 10px;
        }
        .cp-position-footnote {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 18px;
          border-top: 1px solid rgb(255 255 255 / 13%);
          color: #c0cec3;
          font-size: 10px;
        }
        .cp-position-footnote svg { flex: 0 0 auto; color: var(--cp-lime); }
        .cp-section {
          padding-top: 42px;
          scroll-margin-top: 92px;
        }
        .cp-section-heading {
          display: flex;
          align-items: center;
          gap: 13px;
          margin-bottom: 17px;
        }
        .cp-section-number {
          display: grid;
          width: 33px;
          height: 33px;
          flex: 0 0 auto;
          place-items: center;
          border: 1px solid var(--cp-line-strong);
          border-radius: 9px;
          color: var(--cp-muted);
          font: 700 10px/1 var(--lp-mono);
        }
        .cp-section-heading .cp-eyebrow { margin-bottom: 3px; font-size: 9px; }
        .cp-section-heading h2 {
          margin: 0;
          font: 700 20px/1.15 var(--lp-display);
          letter-spacing: -.45px;
        }
        .cp-heading-note {
          margin-left: auto;
          color: var(--cp-muted);
          font-size: 11px;
          text-align: right;
        }
        .cp-coverage-logic {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 215px;
          align-items: center;
          gap: 20px;
          margin-top: 15px;
          padding: 16px 18px;
          border: 1px solid var(--cp-line);
          border-radius: 9px;
          background: #e8ebe2;
        }
        .cp-logic-title {
          display: flex;
          align-items: center;
          gap: 9px;
          margin-bottom: 10px;
          color: var(--cp-muted);
          font: 700 9px/1.2 var(--lp-mono);
          letter-spacing: .08em;
          text-transform: uppercase;
        }
        .cp-logic-title svg { color: var(--cp-deep-2); }
        .cp-equation {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 7px;
          color: var(--cp-ink);
          font: 700 12px/1.5 var(--lp-mono);
        }
        .cp-equation span {
          padding: 5px 8px;
          border: 1px solid var(--cp-line-strong);
          border-radius: 4px;
          background: var(--cp-paper);
        }
        .cp-equation b { color: var(--cp-soft-muted); font-weight: 400; }
        .cp-logic-state {
          display: flex;
          align-items: center;
          gap: 10px;
          padding-left: 18px;
          border-left: 1px solid var(--cp-line-strong);
        }
        .cp-logic-state svg { flex: 0 0 auto; color: var(--cp-caution); }
        .cp-logic-state strong {
          display: block;
          font: 700 11px/1.3 var(--lp-display);
        }
        .cp-logic-state small {
          display: block;
          margin-top: 3px;
          color: var(--cp-muted);
          font-size: 9px;
          line-height: 1.4;
        }
        .cp-ledger-layout {
          display: grid;
          grid-template-columns: minmax(0, 1.7fr) minmax(270px, .8fr);
          gap: 16px;
        }
        .cp-panel {
          min-width: 0;
          border: 1px solid var(--cp-line);
          border-radius: 10px;
          background: var(--cp-paper);
        }
        .cp-panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          min-height: 57px;
          padding: 13px 17px;
          border-bottom: 1px solid var(--cp-line);
        }
        .cp-panel-title {
          display: flex;
          align-items: center;
          gap: 9px;
          font: 700 13px/1.25 var(--lp-display);
        }
        .cp-panel-title svg { color: var(--cp-deep-2); }
        .cp-panel-caption {
          color: var(--cp-muted);
          font-size: 10px;
        }
        .cp-ledger-header, .cp-ledger-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(155px, 185px);
          align-items: center;
          gap: 14px;
        }
        .cp-ledger-header {
          padding: 9px 17px;
          background: #f2f4ed;
          color: var(--cp-soft-muted);
          font: 700 9px/1.3 var(--lp-mono);
          letter-spacing: .06em;
          text-transform: uppercase;
        }
        .cp-ledger-header span:last-child { text-align: right; }
        .cp-ledger-row {
          min-height: 62px;
          padding: 9px 17px;
          border-bottom: 1px solid #e8ebe4;
          transition: transform 160ms ease, opacity 160ms ease;
        }
        .cp-ledger-row:last-child { border-bottom: 0; }
        .cp-ledger-row:hover { transform: translateX(3px); }
        .cp-ledger-name {
          display: flex;
          align-items: center;
          gap: 11px;
          min-width: 0;
        }
        .cp-ledger-icon {
          display: grid;
          width: 30px;
          height: 30px;
          flex: 0 0 auto;
          place-items: center;
          border: 1px solid var(--cp-line);
          border-radius: 8px;
          color: var(--cp-deep-2);
          background: #f8f9f4;
        }
        .cp-ledger-name strong {
          display: block;
          font: 650 12px/1.3 var(--lp-display);
        }
        .cp-ledger-name small {
          display: block;
          margin-top: 3px;
          color: var(--cp-muted);
          font-size: 10px;
        }
        .cp-ledger-value {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 9px;
          color: var(--cp-ink);
          font: 700 13px/1 var(--lp-mono);
          white-space: nowrap;
        }
        .cp-ledger-value small {
          color: var(--cp-soft-muted);
          font: 9px/1 var(--lp-mono);
        }
        .cp-ledger-row.total {
          min-height: 67px;
          background: #eff3e8;
        }
        .cp-ledger-row.total .cp-ledger-icon {
          border-color: #c8d5b9;
          background: var(--cp-lime-muted);
        }
        .cp-ledger-row.total .cp-ledger-name strong,
        .cp-ledger-row.total .cp-ledger-value { font-weight: 800; }
        .cp-ledger-note {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          padding: 12px 17px;
          border-top: 1px solid var(--cp-line);
          color: var(--cp-muted);
          font-size: 10px;
          line-height: 1.45;
        }
        .cp-ledger-note svg { flex: 0 0 auto; margin-top: 1px; }
        .cp-gates {
          display: flex;
          flex-direction: column;
        }
        .cp-gate-intro {
          padding: 14px 16px 11px;
          color: var(--cp-muted);
          font-size: 10px;
          line-height: 1.5;
        }
        .cp-gate {
          display: grid;
          grid-template-columns: 29px minmax(0, 1fr);
          gap: 10px;
          padding: 13px 16px;
          border-top: 1px solid #e8ebe4;
        }
        .cp-gate-icon {
          display: grid;
          width: 28px;
          height: 28px;
          place-items: center;
          border-radius: 7px;
          background: #edf0e9;
          color: var(--cp-deep-2);
        }
        .cp-gate strong {
          display: block;
          font: 700 11px/1.3 var(--lp-display);
        }
        .cp-gate span {
          display: block;
          margin-top: 4px;
          color: var(--cp-muted);
          font-size: 9px;
        }
        .cp-gate-result {
          display: inline-flex !important;
          align-items: center;
          gap: 5px;
          margin-top: 8px !important;
          color: var(--cp-caution) !important;
          font: 700 9px/1 var(--lp-mono) !important;
          letter-spacing: .02em;
          text-transform: uppercase;
        }
        .cp-gate-result svg { color: var(--cp-caution); }
        .cp-gate-disclaimer {
          margin: auto 14px 14px;
          padding: 10px;
          border: 1px dashed var(--cp-line-strong);
          border-radius: 6px;
          color: var(--cp-muted);
          font-size: 9px;
          line-height: 1.45;
        }
        .cp-operations-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.1fr) minmax(0, .9fr);
          gap: 16px;
        }
        .cp-operation-table {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 140px 118px;
          align-items: center;
          gap: 12px;
          padding: 10px 16px;
          border-bottom: 1px solid #e8ebe4;
        }
        .cp-operation-table:last-child { border-bottom: 0; }
        .cp-table-head {
          background: #f2f4ed;
          color: var(--cp-soft-muted);
          font: 700 9px/1.3 var(--lp-mono);
          letter-spacing: .06em;
          text-transform: uppercase;
        }
        .cp-table-head span:last-child { text-align: right; }
        .cp-operation-name {
          display: flex;
          align-items: center;
          gap: 9px;
          font: 650 11px/1.3 var(--lp-display);
        }
        .cp-operation-name svg { color: var(--cp-deep-2); }
        .cp-mono-dash {
          color: var(--cp-ink);
          font: 700 12px/1 var(--lp-mono);
          text-align: right;
        }
        .cp-state-cell { display: flex; justify-content: flex-end; }
        .cp-unavailable {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          max-width: 100%;
          color: #747e74;
          font-size: 9px;
          white-space: nowrap;
        }
        .cp-unavailable svg { flex: 0 0 auto; }
        .cp-queue-empty {
          padding: 17px 16px;
          border-bottom: 1px solid #e8ebe4;
        }
        .cp-queue-foot {
          padding: 11px 16px;
          color: var(--cp-muted);
          font-size: 9px;
          line-height: 1.45;
        }
        .cp-dispute-metrics {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          border-bottom: 1px solid var(--cp-line);
        }
        .cp-dispute-metric {
          min-height: 86px;
          padding: 15px 16px;
          border-right: 1px solid var(--cp-line);
        }
        .cp-dispute-metric:last-child { border-right: 0; }
        .cp-dispute-metric span {
          display: block;
          color: var(--cp-muted);
          font-size: 10px;
        }
        .cp-dispute-metric strong {
          display: block;
          margin-top: 6px;
          font: 700 20px/1 var(--lp-mono);
        }
        .cp-empty {
          display: flex;
          align-items: flex-start;
          gap: 11px;
          padding: 14px 15px;
          border: 1px dashed var(--cp-line-strong);
          border-radius: 7px;
          background: #f8f9f5;
        }
        .cp-empty-icon {
          display: grid;
          width: 28px;
          height: 28px;
          flex: 0 0 auto;
          place-items: center;
          border: 1px solid var(--cp-line);
          border-radius: 7px;
          color: var(--cp-muted);
        }
        .cp-empty strong {
          display: block;
          font: 700 11px/1.3 var(--lp-display);
        }
        .cp-empty p {
          margin: 4px 0 0;
          color: var(--cp-muted);
          font-size: 9px;
          line-height: 1.45;
        }
        .cp-empty-dash {
          margin-left: auto;
          color: var(--cp-soft-muted);
          font: 700 16px/1 var(--lp-mono);
        }
        .cp-controls-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }
        .cp-control-row {
          display: grid;
          grid-template-columns: 30px minmax(0, 1fr) auto;
          align-items: center;
          gap: 10px;
          min-height: 56px;
          padding: 9px 15px;
          border-bottom: 1px solid #e8ebe4;
        }
        .cp-control-row:last-child { border-bottom: 0; }
        .cp-control-icon {
          display: grid;
          width: 29px;
          height: 29px;
          place-items: center;
          border-radius: 7px;
          background: #f0f2eb;
          color: var(--cp-deep-2);
        }
        .cp-control-row strong {
          display: block;
          font: 650 11px/1.3 var(--lp-display);
        }
        .cp-control-row small {
          display: block;
          margin-top: 3px;
          color: var(--cp-muted);
          font-size: 9px;
        }
        .cp-control-value {
          color: var(--cp-muted);
          font: 700 10px/1 var(--lp-mono);
          white-space: nowrap;
        }
        .cp-control-empty { padding: 15px; }
        .cp-emergency {
          display: grid;
          grid-template-columns: minmax(230px, .8fr) minmax(0, 1.2fr);
          gap: 20px;
          padding: 19px 20px;
          border: 1px solid #d9d0bf;
          border-radius: 10px;
          background: #f5f0e6;
        }
        .cp-emergency-title {
          display: flex;
          gap: 11px;
          align-items: flex-start;
        }
        .cp-emergency-icon {
          display: grid;
          width: 36px;
          height: 36px;
          flex: 0 0 auto;
          place-items: center;
          border: 1px solid #d9cbb3;
          border-radius: 8px;
          color: #775c35;
        }
        .cp-emergency h3 {
          margin: 0;
          font: 700 14px/1.3 var(--lp-display);
        }
        .cp-emergency-title p {
          margin: 5px 0 0;
          color: #756a57;
          font-size: 10px;
          line-height: 1.45;
        }
        .cp-emergency-actions {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
          align-items: center;
        }
        .cp-emergency-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          min-height: 39px;
          padding: 7px 9px;
          border: 1px solid #d6c9b3;
          border-radius: 6px;
          background: #eee8dc;
          color: #8b816f;
          cursor: not-allowed;
          font: 700 9px/1.3 var(--lp-display);
          text-align: center;
        }
        .cp-emergency-caption {
          grid-column: 1 / -1;
          display: flex;
          align-items: center;
          gap: 6px;
          color: #756a57;
          font-size: 9px;
        }
        .cp-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-top: 34px;
          padding-top: 15px;
          border-top: 1px solid var(--cp-line);
          color: var(--cp-muted);
          font-size: 10px;
        }
        .cp-footer-note { display: flex; align-items: center; gap: 7px; }
        .cp-footer-note svg { color: var(--cp-deep-2); }
        .cp-footer-code { font: 9px/1.3 var(--lp-mono); }
        @media (max-width: 900px) {
          .cp-topbar-inner, .cp-main { width: min(100% - 32px, 1320px); }
          .cp-position-top { grid-template-columns: minmax(0, 1fr) minmax(260px, .8fr); }
          .cp-cash-main, .cp-coverage { padding-right: 22px; padding-left: 22px; }
          .cp-position-stat { padding-left: 22px; }
          .cp-ledger-layout { grid-template-columns: minmax(0, 1.35fr) minmax(250px, .8fr); }
          .cp-operations-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 700px) {
          .cp-topbar-inner, .cp-main { width: min(100% - 28px, 1320px); }
          .cp-topbar-inner { min-height: 62px; }
          .cp-brand { min-width: 0; }
          .cp-topline { gap: 8px; }
          .cp-preview-label { display: none; }
          .cp-connection { max-width: 150px; white-space: normal; font-size: 10px; }
          .cp-nav { gap: 19px; }
          .cp-nav-label { display: none; }
          .cp-intro { align-items: flex-start; flex-direction: column; gap: 16px; padding: 29px 0 21px; }
          .cp-intro h1 { letter-spacing: -1.3px; }
          .cp-intro-copy { max-width: 500px; font-size: 13px; }
          .cp-position-top { grid-template-columns: 1fr; }
          .cp-cash-main { padding: 22px 20px 19px; border-right: 0; }
          .cp-coverage { padding: 18px 20px 21px; border-top: 1px solid rgb(255 255 255 / 13%); }
          .cp-cash-amount strong { font-size: 64px; }
          .cp-position-bottom { grid-template-columns: 1fr; }
          .cp-position-stat { padding: 13px 20px; border-right: 0; border-bottom: 1px solid rgb(255 255 255 / 12%); }
          .cp-position-stat:last-child { border-bottom: 0; }
          .cp-position-stat strong { font-size: 18px; }
          .cp-section { padding-top: 32px; }
          .cp-section-heading { align-items: flex-start; }
          .cp-heading-note { max-width: 110px; font-size: 9px; }
          .cp-coverage-logic { grid-template-columns: 1fr; gap: 13px; }
          .cp-logic-state { padding: 10px 0 0; border-top: 1px solid var(--cp-line-strong); border-left: 0; }
          .cp-ledger-layout { grid-template-columns: 1fr; }
          .cp-controls-grid { grid-template-columns: 1fr; }
          .cp-emergency { grid-template-columns: 1fr; gap: 15px; padding: 16px; }
          .cp-emergency-actions { grid-template-columns: 1fr; }
          .cp-emergency-button { justify-content: flex-start; padding-left: 12px; }
          .cp-emergency-caption { padding-top: 3px; }
          .cp-footer { align-items: flex-start; flex-direction: column; gap: 8px; }
        }
        @media (max-width: 430px) {
          .cp-operation-table { grid-template-columns: minmax(0, 1fr) 72px; gap: 7px; }
          .cp-operation-table > :nth-child(3) { grid-column: 1 / -1; justify-content: flex-start; padding-left: 25px; }
          .cp-table-head > :nth-child(3) { display: none; }
          .cp-ledger-header, .cp-ledger-row { grid-template-columns: minmax(0, 1fr) 94px; gap: 8px; }
          .cp-ledger-name { gap: 8px; }
          .cp-ledger-name small { max-width: 205px; }
          .cp-ledger-value { font-size: 11px; }
          .cp-ledger-value small { display: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          .cp-frame *, .cp-frame *::before, .cp-frame *::after {
            scroll-behavior: auto !important;
            transition-duration: .01ms !important;
          }
        }
      `}</style>

      <header className="cp-topbar">
        <div className="cp-topbar-inner">
          <a className="cp-brand" href="#inicio" aria-label="Lance do Pix, início">
            <span className="cp-brand-mark" aria-hidden="true">LP</span>
            <span>
              <span className="cp-brand-name">Lance do Pix</span>
              <span className="cp-brand-sub">OPERAÇÕES FINANCEIRAS</span>
            </span>
          </a>
          <div className="cp-topline">
            <span className="cp-preview-label">Prévia estática</span>
            <span className="cp-connection">
              <i className="cp-connection-dot" aria-hidden="true" />
              Dados aguardando conexão
            </span>
          </div>
        </div>
      </header>

      <main className="cp-main" id="inicio">
        <nav className="cp-nav" aria-label="Navegação desta página">
          <span className="cp-nav-label">CONSOLE /</span>
          {sections.map((section) => (
            <a href={section.href} key={section.href}>{section.label}</a>
          ))}
        </nav>

        <div className="cp-intro">
          <div>
            <p className="cp-eyebrow">CONTROLE FINANCEIRO / VISÃO GERAL</p>
            <h1>Proteção do caixa</h1>
            <p className="cp-intro-copy">
              Saiba o que está livre e o que já tem destino. Decisões de saída
              dependem de uma cobertura conciliada — não de estimativas.
            </p>
          </div>
          <div className="cp-intro-side">
            <span className="cp-intro-side-icon" aria-hidden="true">
              <ShieldCheck size={18} strokeWidth={1.8} />
            </span>
            <span>
              <strong>Cobertura não calculada</strong>
              <span>Aguardando dados reais</span>
            </span>
          </div>
        </div>

        <section className="cp-position" id="posicao" aria-label="Posição de caixa">
          <div className="cp-position-top">
            <div className="cp-cash-main">
              <div className="cp-inverse-eyebrow">
                <Landmark size={14} strokeWidth={1.8} aria-hidden="true" />
                Saldo conciliado disponível
              </div>
              <div className="cp-cash-amount">
                <strong>—</strong>
                <span>BRL</span>
              </div>
              <p className="cp-cash-caption">
                Caixa após conciliação de entradas, reservas e obrigações.
              </p>
              <div className="cp-position-rule">
                <LockKeyhole size={14} strokeWidth={1.8} aria-hidden="true" />
                Sem saldo verificado, nenhuma cobertura pode ser presumida.
              </div>
            </div>
            <div className="cp-coverage">
              <div className="cp-coverage-head">
                <div>
                  <p>Índice de cobertura das obrigações</p>
                  <strong className="cp-coverage-value">—</strong>
                </div>
                <span className="cp-coverage-icon" aria-hidden="true">
                  <Gauge size={20} strokeWidth={1.7} />
                </span>
              </div>
              <div className="cp-coverage-track" aria-hidden="true" />
              <div className="cp-coverage-foot">
                <span>Caixa livre ÷ obrigações</span>
                <span>Sem cálculo</span>
              </div>
            </div>
          </div>
          <div className="cp-position-bottom">
            <div className="cp-position-stat">
              <span>Caixa livre</span>
              <strong>—</strong>
              <small>Após valores protegidos</small>
            </div>
            <div className="cp-position-stat">
              <span>Fundos reservados</span>
              <strong>—</strong>
              <small>Compromissos ainda não liquidados</small>
            </div>
            <div className="cp-position-stat">
              <span>Entradas confirmadas</span>
              <strong>—</strong>
              <small>Sem lançamentos conciliados</small>
            </div>
          </div>
          <div className="cp-position-footnote">
            <CircleDashed size={13} strokeWidth={1.8} aria-hidden="true" />
            Posição financeira indisponível nesta prévia; nenhum saldo ou status foi presumido.
          </div>
        </section>

        <section className="cp-section" id="obrigacoes">
          <SectionHeading
            number="01"
            eyebrow="Conciliação e compromissos"
            title="O que o caixa precisa proteger"
            note="Valores e regras aguardando integração"
          />
          <div className="cp-ledger-layout">
            <article className="cp-panel">
              <div className="cp-panel-header">
                <div className="cp-panel-title">
                  <Banknote size={16} strokeWidth={1.8} aria-hidden="true" />
                  Livro de obrigações
                </div>
                <span className="cp-panel-caption">BRL</span>
              </div>
              <div className="cp-ledger-header">
                <span>Natureza do saldo</span>
                <span>Posição atual</span>
              </div>
              {obligations.map(({ label, detail, icon: Icon }) => (
                <div className="cp-ledger-row" key={label}>
                  <div className="cp-ledger-name">
                    <span className="cp-ledger-icon" aria-hidden="true">
                      <Icon size={15} strokeWidth={1.8} />
                    </span>
                    <span>
                      <strong>{label}</strong>
                      <small>{detail}</small>
                    </span>
                  </div>
                  <div className="cp-ledger-value">
                    <strong>—</strong>
                    <small>BRL</small>
                  </div>
                </div>
              ))}
              <div className="cp-ledger-row total">
                <div className="cp-ledger-name">
                  <span className="cp-ledger-icon" aria-hidden="true">
                    <ShieldCheck size={15} strokeWidth={1.8} />
                  </span>
                  <span>
                    <strong>Total de obrigações protegidas</strong>
                    <small>Consolidado após conciliação, sem dupla contagem</small>
                  </span>
                </div>
                <div className="cp-ledger-value">
                  <strong>—</strong>
                  <small>BRL</small>
                </div>
              </div>
              <div className="cp-ledger-note">
                <AlertTriangle size={13} strokeWidth={1.8} aria-hidden="true" />
                Resgates pendentes podem compor obrigações existentes. A composição depende da regra de conciliação e não é somada nesta prévia.
              </div>
            </article>

            <aside className="cp-panel cp-gates" aria-label="Decisões condicionadas à cobertura">
              <div className="cp-panel-header">
                <div className="cp-panel-title">
                  <LockKeyhole size={15} strokeWidth={1.8} aria-hidden="true" />
                  Decisões sob cobertura
                </div>
                <span className="cp-panel-caption">Critérios</span>
              </div>
              <div className="cp-gate-intro">
                Antes de qualquer saída ou nova exposição, o saldo disponível precisa ser verificável.
              </div>
              <div className="cp-gate">
                <span className="cp-gate-icon" aria-hidden="true"><ArrowUpRight size={15} /></span>
                <div>
                  <strong>Aprovar um resgate</strong>
                  <span>Validar caixa livre e obrigações atuais</span>
                  <span className="cp-gate-result"><CircleDashed size={11} /> Não avaliável</span>
                </div>
              </div>
              <div className="cp-gate">
                <span className="cp-gate-icon" aria-hidden="true"><ReceiptText size={15} /></span>
                <div>
                  <strong>Liberar um prêmio</strong>
                  <span>Confirmar reserva e liquidação devida</span>
                  <span className="cp-gate-result"><CircleDashed size={11} /> Não avaliável</span>
                </div>
              </div>
              <div className="cp-gate">
                <span className="cp-gate-icon" aria-hidden="true"><ArrowDownLeft size={15} /></span>
                <div>
                  <strong>Abrir nova exposição</strong>
                  <span>Verificar cobertura antes de iniciar disputa</span>
                  <span className="cp-gate-result"><CircleDashed size={11} /> Não avaliável</span>
                </div>
              </div>
              <div className="cp-gate-disclaimer">
                Os critérios exibidos são referências operacionais. Não há aprovação nem bloqueio conectado nesta prévia.
              </div>
            </aside>
          </div>

          <div className="cp-coverage-logic">
            <div>
              <div className="cp-logic-title">
                <Workflow size={14} strokeWidth={1.8} aria-hidden="true" />
                Leitura da cobertura
              </div>
              <div className="cp-equation" aria-label="Caixa livre menos obrigações protegidas">
                <span>Caixa livre</span><b>−</b><span>Obrigações protegidas</span><b>=</b><span>Margem segura</span>
              </div>
            </div>
            <div className="cp-logic-state">
              <AlertTriangle size={17} strokeWidth={1.8} aria-hidden="true" />
              <span>
                <strong>Resultado indisponível</strong>
                <small>Aguardando dados reais para avaliar o saldo.</small>
              </span>
            </div>
          </div>
        </section>

        <section className="cp-section" id="fila">
          <SectionHeading
            number="02"
            eyebrow="Contexto operacional"
            title="Fila de pagamentos e exposição ao vivo"
            note="Sem atividade inventada"
          />
          <div className="cp-operations-grid">
            <article className="cp-panel">
              <div className="cp-panel-header">
                <div className="cp-panel-title">
                  <ArrowUpRight size={16} strokeWidth={1.8} aria-hidden="true" />
                  Resgates a pagar
                </div>
                <UnavailableTag />
              </div>
              <div className="cp-operation-table cp-table-head">
                <span>Solicitação</span>
                <span>Valor</span>
                <span>Estado</span>
              </div>
              <div className="cp-queue-empty">
                <EmptyState icon={ArrowUpRight} title="Fila não carregada">
                  As solicitações e seus prazos só aparecem quando a fonte de pagamentos estiver disponível.
                </EmptyState>
              </div>
              <div className="cp-queue-foot">
                Totais a pagar e pagos: — · Os dados da fila podem compor o livro de obrigações após conciliação.
              </div>
            </article>

            <article className="cp-panel">
              <div className="cp-panel-header">
                <div className="cp-panel-title">
                  <Activity size={16} strokeWidth={1.8} aria-hidden="true" />
                  Disputas em andamento
                </div>
                <UnavailableTag />
              </div>
              <div className="cp-dispute-metrics">
                <div className="cp-dispute-metric">
                  <span>Disputas abertas</span>
                  <strong>—</strong>
                </div>
                <div className="cp-dispute-metric">
                  <span>Lances ativos</span>
                  <strong>—</strong>
                </div>
              </div>
              <div className="cp-queue-empty">
                <EmptyState icon={Clock3} title="Tempos de disputa indisponíveis">
                  Nenhum prazo ou atividade em tempo real pode ser exibido sem uma fonte conectada.
                </EmptyState>
              </div>
              <div className="cp-queue-foot">
                Exposição e dívida de disputas: — · Aguardando dados reais.
              </div>
            </article>
          </div>
        </section>

        <section className="cp-section" id="controles">
          <SectionHeading
            number="03"
            eyebrow="Integridade da operação"
            title="Automação, serviços e acesso"
            note="Telemetria não conectada"
          />
          <div className="cp-controls-grid">
            <article className="cp-panel">
              <div className="cp-panel-header">
                <div className="cp-panel-title">
                  <Workflow size={16} strokeWidth={1.8} aria-hidden="true" />
                  Estado da automação
                </div>
                <UnavailableTag />
              </div>
              <div className="cp-control-row">
                <span className="cp-control-icon" aria-hidden="true"><Activity size={15} /></span>
                <span><strong>Pagamentos automáticos</strong><small>Execução e regras ativas</small></span>
                <span className="cp-control-value">—</span>
              </div>
              <div className="cp-control-row">
                <span className="cp-control-icon" aria-hidden="true"><Clock3 size={15} /></span>
                <span><strong>Próxima execução</strong><small>Horário da próxima rotina</small></span>
                <span className="cp-control-value">—</span>
              </div>
              <div className="cp-control-row">
                <span className="cp-control-icon" aria-hidden="true"><Check size={15} /></span>
                <span><strong>Regras de cobertura</strong><small>Última validação conhecida</small></span>
                <span className="cp-control-value">—</span>
              </div>
              <div className="cp-control-empty">
                <EmptyState icon={CircleDashed} title="Estado sem telemetria">
                  Automação sem status verificável nesta prévia.
                </EmptyState>
              </div>
            </article>

            <article className="cp-panel">
              <div className="cp-panel-header">
                <div className="cp-panel-title">
                  <Activity size={16} strokeWidth={1.8} aria-hidden="true" />
                  Saúde dos serviços
                </div>
                <UnavailableTag />
              </div>
              {[
                { label: "API de operações", icon: Gauge },
                { label: "Processador de pagamentos", icon: Banknote },
                { label: "Notificações e webhooks", icon: Bell },
              ].map(({ label, icon: Icon }) => (
                <div className="cp-control-row" key={label}>
                  <span className="cp-control-icon" aria-hidden="true"><Icon size={15} /></span>
                  <span><strong>{label}</strong><small>Última resposta</small></span>
                  <span className="cp-control-value">—</span>
                </div>
              ))}
              <div className="cp-control-empty">
                <EmptyState icon={CircleDashed} title="Status não monitorado">
                  Nenhuma condição de serviço foi presumida.
                </EmptyState>
              </div>
            </article>

            <article className="cp-panel">
              <div className="cp-panel-header">
                <div className="cp-panel-title">
                  <Bell size={16} strokeWidth={1.8} aria-hidden="true" />
                  Alertas operacionais
                </div>
                <UnavailableTag />
              </div>
              <div className="cp-control-empty">
                <EmptyState icon={AlertTriangle} title="Fonte de alertas indisponível">
                  Sem informação sobre alertas ativos ou resolvidos.
                </EmptyState>
              </div>
            </article>

            <article className="cp-panel">
              <div className="cp-panel-header">
                <div className="cp-panel-title">
                  <Fingerprint size={16} strokeWidth={1.8} aria-hidden="true" />
                  Permissões e alçadas
                </div>
                <UnavailableTag />
              </div>
              <div className="cp-control-row">
                <span className="cp-control-icon" aria-hidden="true"><Fingerprint size={15} /></span>
                <span><strong>Identidade em sessão</strong><small>Perfil e operador</small></span>
                <span className="cp-control-value">—</span>
              </div>
              <div className="cp-control-row">
                <span className="cp-control-icon" aria-hidden="true"><LockKeyhole size={15} /></span>
                <span><strong>Alçada para pagamentos</strong><small>Permissões de aprovação</small></span>
                <span className="cp-control-value">—</span>
              </div>
              <div className="cp-control-empty">
                <EmptyState icon={ShieldCheck} title="Acesso não verificado">
                  Não há dados de identidade ou permissão nesta prévia.
                </EmptyState>
              </div>
            </article>
          </div>
        </section>

        <section className="cp-section">
          <SectionHeading
            number="04"
            eyebrow="Rastreabilidade"
            title="Registro de auditoria"
            note="Eventos recentes"
          />
          <article className="cp-panel">
            <div className="cp-operation-table cp-table-head">
              <span>Evento e responsável</span>
              <span>Horário</span>
              <span>Referência</span>
            </div>
            <div className="cp-queue-empty">
              <EmptyState icon={FileClock} title="Registro aguardando fonte de auditoria">
                Ações e alterações não são simuladas. O histórico será exibido quando houver dados reais.
              </EmptyState>
            </div>
            <div className="cp-operation-table">
              <span className="cp-operation-name"><FileClock size={14} /> Último evento registrado</span>
              <span className="cp-mono-dash">—</span>
              <span className="cp-state-cell"><UnavailableTag /></span>
            </div>
          </article>
        </section>

        <section className="cp-section">
          <SectionHeading
            number="05"
            eyebrow="Contenção"
            title="Controles de emergência"
            note="Ações indisponíveis na prévia"
          />
          <div className="cp-emergency">
            <div className="cp-emergency-title">
              <span className="cp-emergency-icon" aria-hidden="true">
                <Siren size={18} strokeWidth={1.8} />
              </span>
              <div>
                <h3>Interromper com segurança</h3>
                <p>Use controles de contenção somente com acesso validado e procedimento auditável.</p>
              </div>
            </div>
            <div className="cp-emergency-actions">
              <button className="cp-emergency-button" type="button" disabled title="Indisponível: prévia sem conexão">
                <Pause size={13} aria-hidden="true" /> Pausar pagamentos
              </button>
              <button className="cp-emergency-button" type="button" disabled title="Indisponível: prévia sem conexão">
                <LockKeyhole size={13} aria-hidden="true" /> Suspender novos lances
              </button>
              <button className="cp-emergency-button" type="button" disabled title="Indisponível: prévia sem conexão">
                <AlertTriangle size={13} aria-hidden="true" /> Acionar contenção
              </button>
              <span className="cp-emergency-caption">
                <LockKeyhole size={12} aria-hidden="true" />
                Nenhuma ação está conectada; estes controles são apenas ilustrativos.
              </span>
            </div>
          </div>
        </section>

        <footer className="cp-footer">
          <span className="cp-footer-note">
            <ShieldCheck size={14} strokeWidth={1.8} aria-hidden="true" />
            Prévia estática. Nenhuma operação financeira foi executada.
          </span>
          <span className="cp-footer-code">LANCE DO PIX / OPERAÇÕES</span>
        </footer>
      </main>
    </div>
  );
}
