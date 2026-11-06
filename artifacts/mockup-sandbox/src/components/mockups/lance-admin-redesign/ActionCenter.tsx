import "./_group.css";
import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Banknote,
  Bell,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  Command,
  FileClock,
  Filter,
  Fingerprint,
  Headset,
  Layers3,
  LockKeyhole,
  Search,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  WalletCards,
  X,
  Zap,
} from "lucide-react";

const queueItems = [
  {
    id: "resgates",
    label: "Resgates",
    detail: "Pagamentos que precisam de revisão",
    icon: WalletCards,
  },
  {
    id: "disputas",
    label: "Disputas",
    detail: "Casos que pedem intervenção",
    icon: ShieldAlert,
  },
  {
    id: "fraude",
    label: "Fraude",
    detail: "Sinais aguardando análise",
    icon: Fingerprint,
  },
  {
    id: "incidentes",
    label: "Incidentes",
    detail: "Serviços e eventos operacionais",
    icon: Activity,
  },
];

const queueCopy: Record<
  string,
  { title: string; description: string; empty: string; iconLabel: string }
> = {
  resgates: {
    title: "Fila de resgates",
    description: "Verifique a solicitação antes de liberar um pagamento.",
    empty: "Aguardando dados reais de resgates.",
    iconLabel: "Nenhum resgate carregado",
  },
  disputas: {
    title: "Fila de disputas",
    description: "Acompanhe os casos e intervenha com contexto completo.",
    empty: "Aguardando dados reais de disputas.",
    iconLabel: "Nenhuma disputa carregada",
  },
  fraude: {
    title: "Fila de análise de fraude",
    description: "Sinais de risco devem ser revisados antes de qualquer ação.",
    empty: "Aguardando dados reais de análise.",
    iconLabel: "Nenhum caso carregado",
  },
  incidentes: {
    title: "Fila de incidentes",
    description: "Eventos de serviço ficam aqui quando a telemetria estiver conectada.",
    empty: "Aguardando dados reais de incidentes.",
    iconLabel: "Nenhum incidente carregado",
  },
};

function ValuePair({
  label,
  note,
  tone,
}: {
  label: string;
  note?: string;
  tone?: "highlight";
}) {
  return (
    <div className={`ac-value-pair${tone ? ` ${tone}` : ""}`}>
      <div>
        <span className="ac-value-label">{label}</span>
        {note && <small>{note}</small>}
      </div>
      <strong>—</strong>
    </div>
  );
}

function MiniStatus({
  label,
  icon,
}: {
  label: string;
  icon: typeof Zap;
}) {
  const Icon = icon;
  return (
    <div className="ac-mini-status">
      <span className="ac-mini-icon">
        <Icon size={15} strokeWidth={1.8} />
      </span>
      <span>{label}</span>
      <strong>—</strong>
    </div>
  );
}

export function ActionCenter() {
  const [activeQueue, setActiveQueue] = useState("resgates");
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const activeCopy = queueCopy[activeQueue];
  const selectedQueue = queueItems.find((item) => item.id === activeQueue);
  const ActiveQueueIcon = selectedQueue?.icon ?? WalletCards;

  const announcePreview = (action: string) => {
    setNotice(`${action}: esta prévia não está conectada a dados ou ações reais.`);
  };

  return (
    <div className="ac-root">
      <style>{`
        .ac-root {
          --ac-bg: #f1f2e9;
          --ac-paper: #fbfcf6;
          --ac-panel: #f7f8f0;
          --ac-ink: #1c261f;
          --ac-muted: #69746a;
          --ac-line: #dce1d4;
          --ac-strong-line: #c5cdbd;
          --ac-lime: #d4ff4f;
          --ac-forest: #224b37;
          --ac-soft-green: #e4eddf;
          --ac-amber: #a96421;
          --ac-radius: 17px;
          min-height: 100vh;
          background:
            radial-gradient(ellipse at 86% 0%, rgba(212, 255, 79, .15), transparent 32rem),
            var(--ac-bg);
          color: var(--ac-ink);
          font-family: var(--lp-display), sans-serif;
          font-size: 14px;
          letter-spacing: -.01em;
        }
        .ac-root * { box-sizing: border-box; }
        .ac-root button, .ac-root input { font: inherit; }
        .ac-root button { color: inherit; }
        .ac-topbar {
          min-height: 68px;
          position: sticky;
          top: 0;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          padding: 0 clamp(18px, 3.5vw, 52px);
          border-bottom: 1px solid var(--ac-line);
          background: rgba(251, 252, 246, .92);
          backdrop-filter: blur(16px);
        }
        .ac-brand {
          display: inline-flex;
          align-items: center;
          gap: 11px;
          color: var(--ac-ink);
          text-decoration: none;
        }
        .ac-brand-mark {
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border-radius: 11px;
          background: var(--ac-lime);
          color: #1c261f;
          box-shadow: inset 0 0 0 1px rgba(28, 38, 31, .09);
        }
        .ac-brand-name {
          font-size: 15px;
          font-weight: 800;
          letter-spacing: -.04em;
        }
        .ac-admin-tag {
          padding: 4px 8px;
          border: 1px solid var(--ac-line);
          border-radius: 999px;
          color: var(--ac-muted);
          font: 700 9px/1.2 var(--lp-mono), monospace;
          letter-spacing: .08em;
        }
        .ac-top-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .ac-preview-label {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: var(--ac-muted);
          font-size: 12px;
          font-weight: 600;
        }
        .ac-preview-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #a76a21;
          box-shadow: 0 0 0 3px rgba(167, 106, 33, .12);
        }
        .ac-icon-button {
          width: 36px;
          height: 36px;
          display: grid;
          place-items: center;
          border: 1px solid var(--ac-line);
          border-radius: 11px;
          background: var(--ac-paper);
          cursor: pointer;
          transition: transform .18s ease, background .18s ease, border-color .18s ease;
        }
        .ac-icon-button:hover { transform: translateY(-1px); background: white; border-color: var(--ac-strong-line); }
        .ac-layout {
          width: min(100%, 1600px);
          min-height: calc(100vh - 68px);
          display: grid;
          grid-template-columns: 218px minmax(0, 1fr);
          gap: 28px;
          margin: 0 auto;
          padding: 26px clamp(18px, 3.5vw, 52px) 64px;
        }
        .ac-sidebar {
          align-self: start;
          position: sticky;
          top: 92px;
          display: grid;
          gap: 24px;
          padding: 8px 0;
        }
        .ac-sidebar-group { display: grid; gap: 7px; }
        .ac-side-heading {
          margin: 0 0 3px;
          padding: 0 11px;
          color: #899187;
          font: 700 10px/1.3 var(--lp-mono), monospace;
          letter-spacing: .1em;
          text-transform: uppercase;
        }
        .ac-side-link {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          min-height: 40px;
          padding: 0 11px;
          border: 0;
          border-radius: 10px;
          background: transparent;
          color: #566258;
          text-align: left;
          font-weight: 650;
          cursor: pointer;
          transition: background .18s ease, color .18s ease, transform .18s ease;
        }
        .ac-side-link:hover { background: rgba(255,255,255,.64); color: var(--ac-ink); transform: translateX(2px); }
        .ac-side-link.active { background: #e3ebdd; color: var(--ac-forest); }
        .ac-side-link.active svg { color: var(--ac-forest); }
        .ac-side-count {
          margin-left: auto;
          color: #828b81;
          font: 700 11px var(--lp-mono), monospace;
        }
        .ac-sidebar-note {
          padding: 14px;
          border: 1px solid var(--ac-line);
          border-radius: 14px;
          background: rgba(251,252,246,.66);
        }
        .ac-sidebar-note-title {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px;
          font-size: 12px;
          font-weight: 750;
        }
        .ac-sidebar-note p { margin: 0; color: var(--ac-muted); font-size: 11px; line-height: 1.55; }
        .ac-main { min-width: 0; }
        .ac-page-intro {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 22px;
          margin: 2px 0 22px;
        }
        .ac-eyebrow {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0 0 9px;
          color: var(--ac-forest);
          font: 700 10px/1.2 var(--lp-mono), monospace;
          letter-spacing: .1em;
          text-transform: uppercase;
        }
        .ac-eyebrow::before {
          width: 18px;
          height: 2px;
          content: "";
          background: var(--ac-forest);
        }
        .ac-page-intro h1 {
          max-width: 640px;
          margin: 0;
          font-size: clamp(31px, 3.7vw, 48px);
          font-weight: 750;
          letter-spacing: -.065em;
          line-height: .98;
        }
        .ac-page-intro-copy {
          max-width: 450px;
          margin: 10px 0 0;
          color: var(--ac-muted);
          font-size: 14px;
          line-height: 1.55;
        }
        .ac-header-actions { display: flex; flex: 0 0 auto; align-items: center; gap: 8px; }
        .ac-button {
          min-height: 38px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 0 13px;
          border: 1px solid var(--ac-line);
          border-radius: 10px;
          background: var(--ac-paper);
          color: var(--ac-ink);
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: transform .18s ease, background .18s ease, border-color .18s ease;
        }
        .ac-button:hover:not(:disabled) { transform: translateY(-1px); border-color: var(--ac-strong-line); background: white; }
        .ac-button:focus-visible, .ac-side-link:focus-visible, .ac-queue-tab:focus-visible, .ac-icon-button:focus-visible {
          outline: 3px solid rgba(76, 113, 65, .35);
          outline-offset: 2px;
        }
        .ac-button-primary { border-color: var(--ac-forest); background: var(--ac-forest); color: #f7f8f0 !important; }
        .ac-button-primary:hover:not(:disabled) { border-color: #193a2a; background: #193a2a; }
        .ac-button:disabled { opacity: .55; cursor: not-allowed; }
        .ac-topline {
          display: grid;
          grid-template-columns: minmax(0, 1.6fr) minmax(240px, .8fr);
          gap: 13px;
          margin-bottom: 15px;
        }
        .ac-priority-banner {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          min-height: 91px;
          overflow: hidden;
          padding: 17px 20px;
          border-radius: var(--ac-radius);
          background: var(--ac-forest);
          color: #f4f7ed;
        }
        .ac-priority-banner::after {
          width: 165px;
          height: 165px;
          position: absolute;
          top: -94px;
          right: 80px;
          border: 1px solid rgba(237, 255, 204, .14);
          border-radius: 50%;
          content: "";
          box-shadow: 0 0 0 18px rgba(237, 255, 204, .035), 0 0 0 38px rgba(237, 255, 204, .025);
          pointer-events: none;
        }
        .ac-priority-copy { position: relative; z-index: 1; }
        .ac-banner-label {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-bottom: 7px;
          color: #d3e0d1;
          font: 700 10px var(--lp-mono), monospace;
          letter-spacing: .09em;
          text-transform: uppercase;
        }
        .ac-priority-copy strong { display: block; font-size: 18px; font-weight: 700; letter-spacing: -.04em; }
        .ac-priority-copy p { margin: 4px 0 0; color: #d3e0d1; font-size: 12px; }
        .ac-banner-value {
          position: relative;
          z-index: 1;
          min-width: 69px;
          color: var(--ac-lime);
          font: 700 32px/1 var(--lp-mono), monospace;
          text-align: right;
        }
        .ac-safety-chip {
          min-height: 91px;
          display: flex;
          align-items: center;
          gap: 13px;
          padding: 17px 18px;
          border: 1px solid var(--ac-line);
          border-radius: var(--ac-radius);
          background: var(--ac-paper);
        }
        .ac-safety-icon {
          width: 40px;
          height: 40px;
          display: grid;
          flex: 0 0 auto;
          place-items: center;
          border-radius: 12px;
          background: var(--ac-lime);
          color: var(--ac-forest);
        }
        .ac-safety-text { min-width: 0; }
        .ac-safety-text span { display: block; color: var(--ac-muted); font-size: 11px; font-weight: 700; }
        .ac-safety-text strong { display: block; margin-top: 3px; font-size: 15px; font-weight: 750; letter-spacing: -.035em; }
        .ac-safety-text small { display: block; margin-top: 2px; color: var(--ac-muted); font-size: 10px; }
        .ac-work-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.72fr) minmax(280px, .78fr);
          align-items: start;
          gap: 15px;
        }
        .ac-work-card, .ac-panel {
          min-width: 0;
          border: 1px solid var(--ac-line);
          border-radius: var(--ac-radius);
          background: var(--ac-paper);
          box-shadow: 0 5px 18px rgba(35, 55, 39, .025);
        }
        .ac-work-card { overflow: hidden; }
        .ac-work-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          padding: 20px 21px 16px;
        }
        .ac-section-kicker {
          display: flex;
          align-items: center;
          gap: 7px;
          margin: 0 0 6px;
          color: var(--ac-muted);
          font: 700 10px var(--lp-mono), monospace;
          letter-spacing: .08em;
          text-transform: uppercase;
        }
        .ac-work-head h2, .ac-panel-title h2 {
          margin: 0;
          font-size: 19px;
          font-weight: 750;
          letter-spacing: -.045em;
        }
        .ac-work-subtitle { margin: 5px 0 0; color: var(--ac-muted); font-size: 12px; line-height: 1.45; }
        .ac-work-total {
          display: flex;
          align-items: baseline;
          gap: 7px;
          padding-top: 4px;
          color: var(--ac-muted);
          font-size: 11px;
          white-space: nowrap;
        }
        .ac-work-total strong { color: var(--ac-ink); font: 700 20px var(--lp-mono), monospace; }
        .ac-queue-tabs {
          display: flex;
          gap: 5px;
          overflow-x: auto;
          padding: 0 20px 13px;
          border-bottom: 1px solid var(--ac-line);
          scrollbar-width: none;
        }
        .ac-queue-tabs::-webkit-scrollbar { display: none; }
        .ac-queue-tab {
          min-height: 38px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          flex: 0 0 auto;
          padding: 0 11px;
          border: 1px solid transparent;
          border-radius: 9px;
          background: transparent;
          color: #667166;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: color .16s ease, background .16s ease, border-color .16s ease;
        }
        .ac-queue-tab:hover { background: #f0f3e8; color: var(--ac-ink); }
        .ac-queue-tab.active { border-color: #d9e2d4; background: #e7eee3; color: var(--ac-forest); }
        .ac-tab-count {
          min-width: 23px;
          padding: 2px 5px;
          border-radius: 6px;
          background: rgba(255,255,255,.72);
          color: #788178;
          font: 700 10px var(--lp-mono), monospace;
          text-align: center;
        }
        .ac-queue-controls {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 13px 20px;
          border-bottom: 1px solid #e8ebe2;
        }
        .ac-search {
          width: min(100%, 310px);
          min-height: 35px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 10px;
          border: 1px solid var(--ac-line);
          border-radius: 9px;
          background: #fff;
          color: var(--ac-muted);
        }
        .ac-search input {
          width: 100%;
          min-width: 0;
          border: 0;
          outline: 0;
          background: transparent;
          color: var(--ac-ink);
          font-size: 11px;
        }
        .ac-search input::placeholder { color: #8b938a; }
        .ac-control-actions { display: flex; align-items: center; gap: 7px; }
        .ac-small-button {
          min-height: 34px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          padding: 0 10px;
          border: 1px solid var(--ac-line);
          border-radius: 9px;
          background: var(--ac-paper);
          color: #59645a;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          transition: background .16s ease, transform .16s ease;
        }
        .ac-small-button:hover { transform: translateY(-1px); background: #f0f3e8; }
        .ac-table-head {
          display: grid;
          grid-template-columns: minmax(120px, 1.1fr) minmax(110px, .8fr) minmax(140px, 1fr) minmax(90px, .65fr);
          gap: 12px;
          padding: 11px 20px;
          color: #899187;
          font: 700 9px var(--lp-mono), monospace;
          letter-spacing: .07em;
          text-transform: uppercase;
        }
        .ac-empty-queue {
          min-height: 244px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px;
          border-top: 1px solid #edf0e9;
          background:
            linear-gradient(rgba(242,244,235,.36) 1px, transparent 1px),
            linear-gradient(90deg, rgba(242,244,235,.36) 1px, transparent 1px);
          background-size: 24px 24px;
          text-align: center;
        }
        .ac-empty-icon {
          width: 48px;
          height: 48px;
          display: grid;
          place-items: center;
          margin-bottom: 12px;
          border: 1px solid #dfe5d7;
          border-radius: 15px;
          background: var(--ac-paper);
          color: var(--ac-forest);
          box-shadow: 0 5px 14px rgba(42, 71, 47, .05);
        }
        .ac-empty-queue h3 { margin: 0; font-size: 15px; font-weight: 750; letter-spacing: -.03em; }
        .ac-empty-queue p { max-width: 350px; margin: 5px 0 0; color: var(--ac-muted); font-size: 11px; line-height: 1.55; }
        .ac-empty-queue .ac-waiting-label {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-top: 13px;
          padding: 6px 9px;
          border: 1px solid var(--ac-line);
          border-radius: 7px;
          background: rgba(251,252,246,.86);
          color: #768075;
          font: 700 9px var(--lp-mono), monospace;
          letter-spacing: .02em;
        }
        .ac-queue-foot {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 12px 20px;
          border-top: 1px solid var(--ac-line);
          color: var(--ac-muted);
          font-size: 10px;
        }
        .ac-queue-foot > span { display: flex; align-items: center; gap: 6px; }
        .ac-queue-foot strong { color: var(--ac-ink); font: 700 10px var(--lp-mono), monospace; }
        .ac-side-stack { display: grid; gap: 13px; }
        .ac-panel { padding: 16px; }
        .ac-panel-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 11px;
        }
        .ac-panel-title { display: flex; align-items: flex-start; gap: 10px; }
        .ac-panel-icon {
          width: 32px;
          height: 32px;
          display: grid;
          flex: 0 0 auto;
          place-items: center;
          border-radius: 10px;
          background: #e8eee2;
          color: var(--ac-forest);
        }
        .ac-panel-title h2 { font-size: 15px; }
        .ac-panel-title p { margin: 3px 0 0; color: var(--ac-muted); font-size: 10px; line-height: 1.45; }
        .ac-panel-action {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          padding: 3px 0;
          border: 0;
          background: transparent;
          color: var(--ac-forest);
          font-size: 10px;
          font-weight: 750;
          cursor: pointer;
        }
        .ac-panel-action:hover { text-decoration: underline; text-underline-offset: 3px; }
        .ac-value-list { display: grid; }
        .ac-value-pair {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 0;
          border-top: 1px solid #e8ebe2;
        }
        .ac-value-pair:first-child { border-top: 0; }
        .ac-value-label { display: block; font-size: 11px; font-weight: 650; }
        .ac-value-pair small { display: block; margin-top: 2px; color: var(--ac-muted); font-size: 9px; }
        .ac-value-pair strong { color: var(--ac-ink); font: 700 13px var(--lp-mono), monospace; }
        .ac-value-pair.highlight { margin: 3px -8px 0; padding: 10px 8px; border: 0; border-radius: 8px; background: #edf3df; }
        .ac-value-pair.highlight .ac-value-label { color: var(--ac-forest); font-weight: 750; }
        .ac-coverage-note {
          display: flex;
          align-items: flex-start;
          gap: 7px;
          margin-top: 10px;
          padding: 9px 10px;
          border: 1px solid #e5eadc;
          border-radius: 9px;
          background: #f5f7ef;
          color: var(--ac-muted);
          font-size: 9px;
          line-height: 1.45;
        }
        .ac-coverage-note svg { flex: 0 0 auto; color: var(--ac-forest); }
        .ac-status-list { display: grid; border-top: 1px solid #e8ebe2; }
        .ac-mini-status {
          min-height: 36px;
          display: flex;
          align-items: center;
          gap: 8px;
          border-bottom: 1px solid #e8ebe2;
          color: #536055;
          font-size: 10px;
          font-weight: 650;
        }
        .ac-mini-status:last-child { border-bottom: 0; }
        .ac-mini-icon { display: grid; place-items: center; color: var(--ac-forest); }
        .ac-mini-status strong { margin-left: auto; color: #757f74; font: 700 10px var(--lp-mono), monospace; }
        .ac-state-line {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 10px;
          padding: 9px 10px;
          border-radius: 8px;
          background: #f0f2e9;
          color: #6f796f;
          font-size: 10px;
        }
        .ac-state-line svg { flex: 0 0 auto; }
        .ac-below-grid {
          display: grid;
          grid-template-columns: 1.15fr 1fr .85fr;
          gap: 13px;
          margin-top: 15px;
        }
        .ac-empty-compact {
          min-height: 88px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 0 0;
          border-top: 1px solid #e8ebe2;
          color: var(--ac-muted);
          font-size: 10px;
          line-height: 1.5;
        }
        .ac-empty-compact-icon {
          width: 31px;
          height: 31px;
          display: grid;
          flex: 0 0 auto;
          place-items: center;
          border-radius: 9px;
          background: #f0f3e9;
          color: #738171;
        }
        .ac-alert-placeholder {
          display: flex;
          align-items: flex-start;
          gap: 9px;
          padding: 11px 10px;
          border: 1px dashed #d7decf;
          border-radius: 9px;
          background: #f8f9f3;
          color: var(--ac-muted);
          font-size: 10px;
          line-height: 1.45;
        }
        .ac-alert-placeholder svg { flex: 0 0 auto; color: #8b7b5c; }
        .ac-emergency { border-color: #e1d5c7; background: #fbf8f1; }
        .ac-emergency .ac-panel-icon { background: #f1e7da; color: #8a5b2b; }
        .ac-emergency-text { margin: 0 0 12px; color: var(--ac-muted); font-size: 10px; line-height: 1.5; }
        .ac-lock-controls { display: flex; flex-wrap: wrap; gap: 7px; }
        .ac-locked-control {
          min-height: 31px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 0 9px;
          border: 1px solid #e3d7c8;
          border-radius: 8px;
          background: #f7f0e6;
          color: #8a7561;
          font-size: 9px;
          font-weight: 700;
          cursor: not-allowed;
        }
        .ac-footer-note {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          margin-top: 17px;
          padding: 11px 1px 0;
          border-top: 1px solid var(--ac-line);
          color: #7b8579;
          font-size: 9px;
        }
        .ac-footer-note span { display: inline-flex; align-items: center; gap: 6px; }
        .ac-filter-panel {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          border-bottom: 1px solid var(--ac-line);
          background: #f8f9f3;
          color: var(--ac-muted);
          font-size: 10px;
        }
        .ac-filter-chip { padding: 5px 8px; border: 1px solid var(--ac-line); border-radius: 999px; background: var(--ac-paper); color: #627063; font-size: 9px; font-weight: 650; }
        .ac-notice {
          position: fixed;
          right: 24px;
          bottom: 22px;
          z-index: 20;
          max-width: min(440px, calc(100vw - 32px));
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 13px 14px;
          border: 1px solid #becdb9;
          border-radius: 12px;
          background: #f8fbf3;
          box-shadow: 0 12px 38px rgba(29, 47, 32, .14);
          color: var(--ac-ink);
          font-size: 12px;
          line-height: 1.45;
          animation: ac-notice-in .2s ease both;
        }
        .ac-notice > svg { flex: 0 0 auto; color: var(--ac-forest); }
        .ac-notice button { display: grid; flex: 0 0 auto; place-items: center; margin-left: 2px; padding: 1px; border: 0; background: transparent; color: var(--ac-muted); cursor: pointer; }
        @keyframes ac-notice-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @media (prefers-reduced-motion: reduce) {
          .ac-root *, .ac-root *::before, .ac-root *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; scroll-behavior: auto !important; }
        }
        @media (max-width: 1100px) {
          .ac-layout { grid-template-columns: 176px minmax(0, 1fr); gap: 20px; }
          .ac-work-grid { grid-template-columns: minmax(0, 1.45fr) minmax(250px, .8fr); }
          .ac-below-grid { grid-template-columns: 1fr 1fr; }
          .ac-below-grid > :last-child { grid-column: 1 / -1; }
        }
        @media (max-width: 800px) {
          .ac-layout { grid-template-columns: 1fr; gap: 13px; padding-top: 15px; }
          .ac-sidebar { position: static; display: block; padding: 0; overflow-x: auto; scrollbar-width: none; }
          .ac-sidebar-group { display: flex; gap: 5px; min-width: max-content; }
          .ac-sidebar-group + .ac-sidebar-group, .ac-sidebar-note, .ac-side-heading { display: none; }
          .ac-side-link { width: auto; min-height: 36px; padding: 0 11px; font-size: 11px; }
          .ac-side-count { margin-left: 0; }
          .ac-page-intro { align-items: flex-start; flex-direction: column; gap: 15px; }
          .ac-header-actions { align-self: stretch; }
          .ac-topline { grid-template-columns: minmax(0, 1fr); }
          .ac-work-grid { grid-template-columns: 1fr; }
          .ac-side-stack { grid-template-columns: 1fr 1fr; align-items: start; }
          .ac-side-stack > :first-child { grid-row: span 2; }
        }
        @media (max-width: 560px) {
          .ac-topbar { min-height: 59px; padding: 0 14px; }
          .ac-brand { gap: 8px; }
          .ac-brand-mark { width: 31px; height: 31px; }
          .ac-brand-name { font-size: 13px; }
          .ac-admin-tag { font-size: 8px; }
          .ac-preview-label { max-width: 120px; font-size: 9px; line-height: 1.3; }
          .ac-top-right { gap: 7px; }
          .ac-icon-button { width: 33px; height: 33px; }
          .ac-layout { padding: 11px 12px 40px; }
          .ac-page-intro { margin: 3px 0 14px; }
          .ac-page-intro h1 { font-size: 34px; }
          .ac-page-intro-copy { font-size: 12px; }
          .ac-header-actions .ac-button { flex: 1; }
          .ac-priority-banner { min-height: 85px; padding: 15px; }
          .ac-priority-copy strong { font-size: 15px; }
          .ac-priority-copy p { max-width: 225px; font-size: 10px; }
          .ac-banner-value { font-size: 27px; }
          .ac-safety-chip { min-height: 77px; }
          .ac-work-head { padding: 16px 14px 13px; }
          .ac-queue-tabs { padding: 0 12px 11px; }
          .ac-queue-tab { min-height: 35px; padding: 0 9px; font-size: 10px; }
          .ac-queue-controls { align-items: stretch; flex-direction: column; padding: 11px 12px; }
          .ac-search { width: 100%; }
          .ac-control-actions { justify-content: flex-end; }
          .ac-table-head { grid-template-columns: 1fr 1fr; gap: 7px; padding: 10px 14px; font-size: 8px; }
          .ac-empty-queue { min-height: 216px; padding: 20px 14px; }
          .ac-queue-foot { align-items: flex-start; flex-direction: column; padding: 11px 14px; }
          .ac-side-stack { grid-template-columns: 1fr; }
          .ac-side-stack > :first-child { grid-row: auto; }
          .ac-below-grid { grid-template-columns: 1fr; }
          .ac-below-grid > :last-child { grid-column: auto; }
          .ac-footer-note { flex-direction: column; gap: 6px; }
        }
      `}</style>

      <header className="ac-topbar">
        <a className="ac-brand" href="#central" aria-label="Lance do Pix, início">
          <span className="ac-brand-mark" aria-hidden="true">
            <Command size={18} strokeWidth={2.3} />
          </span>
          <span className="ac-brand-name">Lance do Pix</span>
          <span className="ac-admin-tag">OPERAÇÕES</span>
        </a>
        <div className="ac-top-right">
          <span className="ac-preview-label">
            <i className="ac-preview-dot" aria-hidden="true" />
            Aguardando dados reais
          </span>
          <button
            className="ac-icon-button"
            type="button"
            aria-label="Avisos da prévia"
            onClick={() => announcePreview("Avisos")}
          >
            <Bell size={16} strokeWidth={1.8} />
          </button>
        </div>
      </header>

      <div className="ac-layout" id="central">
        <aside className="ac-sidebar" aria-label="Navegação da operação">
          <div className="ac-sidebar-group">
            <p className="ac-side-heading">Operação</p>
            <button className="ac-side-link active" type="button" aria-current="page">
              <Layers3 size={16} />
              Central de trabalho
            </button>
            {queueItems.map(({ id, label, icon: Icon }) => (
              <button
                className="ac-side-link"
                type="button"
                key={id}
                onClick={() => {
                  setActiveQueue(id);
                  document.getElementById("fila")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                <Icon size={16} />
                {label}
                <span className="ac-side-count">—</span>
              </button>
            ))}
          </div>
          <div className="ac-sidebar-group">
            <p className="ac-side-heading">Governança</p>
            <button
              className="ac-side-link"
              type="button"
              onClick={() => document.getElementById("auditoria")?.scrollIntoView({ behavior: "smooth", block: "center" })}
            >
              <FileClock size={16} />
              Auditoria
            </button>
            <button
              className="ac-side-link"
              type="button"
              onClick={() => document.getElementById("acessos")?.scrollIntoView({ behavior: "smooth", block: "center" })}
            >
              <LockKeyhole size={16} />
              Acessos e permissões
            </button>
          </div>
          <div className="ac-sidebar-note">
            <div className="ac-sidebar-note-title">
              <ShieldCheck size={15} />
              Decisão segura
            </div>
            <p>Confirme o contexto e as obrigações antes de liberar pagamentos ou alterar uma disputa.</p>
          </div>
        </aside>

        <main className="ac-main">
          <section className="ac-page-intro" aria-labelledby="ac-title">
            <div>
              <p className="ac-eyebrow">Central de trabalho</p>
              <h1 id="ac-title">O que precisa de uma decisão?</h1>
              <p className="ac-page-intro-copy">
                Priorize o próximo passo. Caixa e automação ficam à vista enquanto você resolve cada fila.
              </p>
            </div>
            <div className="ac-header-actions">
              <button className="ac-button" type="button" onClick={() => announcePreview("Atualização")}>
                <Activity size={15} />
                Atualizar
              </button>
              <button className="ac-button ac-button-primary" type="button" onClick={() => announcePreview("Atribuição de trabalho")}>
                <ClipboardCheck size={15} />
                Revisar trabalho
              </button>
            </div>
          </section>

          <section className="ac-topline" aria-label="Prioridade e segurança do caixa">
            <div className="ac-priority-banner">
              <div className="ac-priority-copy">
                <span className="ac-banner-label"><Sparkles size={13} /> Foco da operação</span>
                <strong>Trabalho pendente</strong>
                <p>Itens aguardando triagem e definição de próxima etapa</p>
              </div>
              <strong className="ac-banner-value">—</strong>
            </div>
            <div className="ac-safety-chip">
              <span className="ac-safety-icon"><ShieldCheck size={19} /></span>
              <div className="ac-safety-text">
                <span>Segurança financeira</span>
                <strong>Cobertura de prêmios</strong>
                <small>Aguardando dados reais para conferência</small>
              </div>
              <strong className="ac-banner-value" style={{ color: "var(--ac-forest)", fontSize: 21, marginLeft: "auto" }}>—</strong>
            </div>
          </section>

          <div className="ac-work-grid">
            <section className="ac-work-card" id="fila" aria-labelledby="ac-work-title">
              <div className="ac-work-head">
                <div>
                  <p className="ac-section-kicker"><Layers3 size={12} /> Entrada operacional</p>
                  <h2 id="ac-work-title">Trabalho por resolver</h2>
                  <p className="ac-work-subtitle">Uma fila por tipo de decisão, sem misturar prioridades.</p>
                </div>
                <div className="ac-work-total"><strong>—</strong><span>itens</span></div>
              </div>

              <div className="ac-queue-tabs" role="tablist" aria-label="Tipo de trabalho">
                {queueItems.map(({ id, label, icon: Icon }) => (
                  <button
                    className={`ac-queue-tab${activeQueue === id ? " active" : ""}`}
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={activeQueue === id}
                    aria-controls="ac-queue-panel"
                    onClick={() => setActiveQueue(id)}
                  >
                    <Icon size={14} />
                    {label}
                    <span className="ac-tab-count">—</span>
                  </button>
                ))}
              </div>

              <div className="ac-queue-controls">
                <label className="ac-search">
                  <Search size={14} aria-hidden="true" />
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={`Buscar em ${selectedQueue?.label.toLocaleLowerCase("pt-BR") ?? "todas as filas"}`}
                    aria-label="Buscar na fila"
                  />
                  {search && (
                    <button
                      className="ac-icon-button"
                      type="button"
                      aria-label="Limpar busca"
                      style={{ width: 24, height: 24, border: 0, background: "transparent" }}
                      onClick={() => setSearch("")}
                    >
                      <X size={13} />
                    </button>
                  )}
                </label>
                <div className="ac-control-actions">
                  <button
                    className="ac-small-button"
                    type="button"
                    aria-expanded={filtersOpen}
                    onClick={() => setFiltersOpen((open) => !open)}
                  >
                    <Filter size={13} />
                    Filtros
                    <ChevronDown size={12} />
                  </button>
                  <button className="ac-small-button" type="button" onClick={() => announcePreview("Ordenação")}>
                    <SlidersHorizontal size={13} />
                    Prioridade
                  </button>
                </div>
              </div>

              {filtersOpen && (
                <div className="ac-filter-panel">
                  <span><Filter size={13} /> Filtros da fila</span>
                  <span className="ac-filter-chip">Responsável: todos</span>
                  <span className="ac-filter-chip">Estado: aguardando dados</span>
                </div>
              )}

              <div id="ac-queue-panel" role="tabpanel" aria-label={activeCopy.title}>
                <div className="ac-table-head" aria-hidden="true">
                  <span>Prioridade / item</span>
                  <span>Responsável</span>
                  <span>Próxima etapa</span>
                  <span>Prazo / relógio</span>
                </div>
                <div className="ac-empty-queue">
                  <span className="ac-empty-icon"><ActiveQueueIcon size={21} strokeWidth={1.7} /></span>
                  <h3>{activeCopy.iconLabel}</h3>
                  <p>{activeCopy.description}</p>
                  <span className="ac-waiting-label"><Clock3 size={12} /> {activeCopy.empty}</span>
                </div>
              </div>
              <div className="ac-queue-foot">
                <span><Search size={12} /> {search ? "A busca não consulta dados nesta prévia." : "Responsáveis e próximos passos aparecem com a fila conectada."}</span>
                <span>Relógios em tempo real <strong>—</strong></span>
              </div>
            </section>

            <aside className="ac-side-stack" aria-label="Contexto operacional">
              <section className="ac-panel" aria-labelledby="ac-cash-title">
                <div className="ac-panel-head">
                  <div className="ac-panel-title">
                    <span className="ac-panel-icon"><CircleDollarSign size={17} /></span>
                    <div>
                      <h2 id="ac-cash-title">Caixa e obrigações</h2>
                      <p>Valores protegidos para decisões de pagamento</p>
                    </div>
                  </div>
                  <button className="ac-panel-action" type="button" onClick={() => announcePreview("Detalhamento do caixa")}>
                    Detalhes <ChevronRight size={13} />
                  </button>
                </div>
                <div className="ac-value-list">
                  <ValuePair label="Caixa livre" note="Após obrigações" />
                  <ValuePair label="Créditos em carteira" />
                  <ValuePair label="Prêmios a pagar" />
                  <ValuePair label="Entradas confirmadas" />
                  <ValuePair label="Cobertura para prêmios" tone="highlight" />
                </div>
                <div className="ac-coverage-note">
                  <ShieldCheck size={13} />
                  <span>Sem valores reais, não é possível calcular a cobertura nem validar liberações.</span>
                </div>
              </section>

              <section className="ac-panel" aria-labelledby="ac-automation-title">
                <div className="ac-panel-head">
                  <div className="ac-panel-title">
                    <span className="ac-panel-icon"><Zap size={16} /></span>
                    <div>
                      <h2 id="ac-automation-title">Automação</h2>
                      <p>Contexto antes da intervenção manual</p>
                    </div>
                  </div>
                  <button className="ac-panel-action" type="button" onClick={() => announcePreview("Regras de automação")}>
                    Regras <ChevronRight size={13} />
                  </button>
                </div>
                <div className="ac-status-list">
                  <MiniStatus label="Regras ativas" icon={Zap} />
                  <MiniStatus label="Itens automatizados" icon={ArrowUpRight} />
                  <MiniStatus label="Exceções para revisão" icon={AlertTriangle} />
                </div>
                <div className="ac-state-line"><Clock3 size={13} /> Estado da automação: aguardando dados reais</div>
              </section>
            </aside>
          </div>

          <section className="ac-below-grid" aria-label="Acompanhamento e governança">
            <section className="ac-panel" aria-labelledby="ac-service-title">
              <div className="ac-panel-head">
                <div className="ac-panel-title">
                  <span className="ac-panel-icon"><Activity size={16} /></span>
                  <div>
                    <h2 id="ac-service-title">Saúde dos serviços</h2>
                    <p>Telemetria e dependências operacionais</p>
                  </div>
                </div>
                <span className="ac-side-count">—</span>
              </div>
              <div className="ac-status-list">
                <MiniStatus label="Aplicação" icon={Activity} />
                <MiniStatus label="Pagamentos" icon={Banknote} />
                <MiniStatus label="Notificações" icon={Headset} />
              </div>
              <div className="ac-state-line"><Clock3 size={13} /> Saúde sem telemetria conectada</div>
            </section>

            <section className="ac-panel" id="auditoria" aria-labelledby="ac-audit-title">
              <div className="ac-panel-head">
                <div className="ac-panel-title">
                  <span className="ac-panel-icon"><FileClock size={16} /></span>
                  <div>
                    <h2 id="ac-audit-title">Auditoria recente</h2>
                    <p>Ações e alterações rastreáveis</p>
                  </div>
                </div>
                <button className="ac-panel-action" type="button" onClick={() => announcePreview("Registro de auditoria")}>
                  Abrir <ChevronRight size={13} />
                </button>
              </div>
              <div className="ac-empty-compact">
                <span className="ac-empty-compact-icon"><ClipboardCheck size={15} /></span>
                Aguardando dados reais de auditoria. Nenhuma atividade é simulada nesta prévia.
              </div>
            </section>

            <section className="ac-panel" aria-labelledby="ac-alerts-title">
              <div className="ac-panel-head">
                <div className="ac-panel-title">
                  <span className="ac-panel-icon"><Bell size={16} /></span>
                  <div>
                    <h2 id="ac-alerts-title">Alertas</h2>
                    <p>Sinais para ação imediata</p>
                  </div>
                </div>
                <strong className="ac-side-count">—</strong>
              </div>
              <div className="ac-alert-placeholder">
                <AlertTriangle size={14} />
                Aguardando dados reais. Não há alertas carregados nesta prévia.
              </div>
            </section>
          </section>

          <section className="ac-below-grid" aria-label="Controles de segurança">
            <section className="ac-panel ac-emergency" aria-labelledby="ac-emergency-title">
              <div className="ac-panel-head">
                <div className="ac-panel-title">
                  <span className="ac-panel-icon"><ShieldAlert size={16} /></span>
                  <div>
                    <h2 id="ac-emergency-title">Controles de emergência</h2>
                    <p>Proteção adicional para situações críticas</p>
                  </div>
                </div>
              </div>
              <p className="ac-emergency-text">Ações críticas ficam bloqueadas nesta prévia; nenhum controle está conectado.</p>
              <div className="ac-lock-controls">
                <button className="ac-locked-control" type="button" disabled><LockKeyhole size={12} /> Pausar pagamentos</button>
                <button className="ac-locked-control" type="button" disabled><LockKeyhole size={12} /> Suspender disputas</button>
              </div>
            </section>

            <section className="ac-panel" id="acessos" aria-labelledby="ac-access-title">
              <div className="ac-panel-head">
                <div className="ac-panel-title">
                  <span className="ac-panel-icon"><LockKeyhole size={16} /></span>
                  <div>
                    <h2 id="ac-access-title">Acessos e permissões</h2>
                    <p>Escopo de ação por perfil</p>
                  </div>
                </div>
                <button className="ac-panel-action" type="button" onClick={() => announcePreview("Permissões")}>
                  Ver acessos <ChevronRight size={13} />
                </button>
              </div>
              <div className="ac-empty-compact">
                <span className="ac-empty-compact-icon"><BadgeCheck size={15} /></span>
                Perfis e permissões aguardando dados reais; nenhum usuário é exibido.
              </div>
            </section>

            <section className="ac-panel" aria-labelledby="ac-payout-title">
              <div className="ac-panel-head">
                <div className="ac-panel-title">
                  <span className="ac-panel-icon"><WalletCards size={16} /></span>
                  <div>
                    <h2 id="ac-payout-title">Fila de pagamentos</h2>
                    <p>Revisão, liberação e comprovantes</p>
                  </div>
                </div>
              </div>
              <div className="ac-value-list">
                <ValuePair label="Aguardando revisão" />
                <ValuePair label="Aguardando liberação" />
              </div>
              <button className="ac-panel-action" type="button" style={{ marginTop: 7 }} onClick={() => setActiveQueue("resgates")}>
                Ir para resgates <ArrowRight size={13} />
              </button>
            </section>
          </section>

          <footer className="ac-footer-note">
            <span><ShieldCheck size={12} /> Prévia operacional sem conexão com serviços ou dados reais.</span>
            <span>Valores, filas e estados indisponíveis são exibidos como —</span>
          </footer>
        </main>
      </div>

      {notice && (
        <div className="ac-notice" role="status">
          <ArrowDownRight size={16} />
          <span>{notice}</span>
          <button type="button" aria-label="Fechar aviso" onClick={() => setNotice(null)}><X size={15} /></button>
        </div>
      )}
    </div>
  );
}
