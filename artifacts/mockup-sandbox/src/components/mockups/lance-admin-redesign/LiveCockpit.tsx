import "./_group.css";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  ChevronRight,
  CircleDashed,
  Clock3,
  Database,
  Gem,
  History,
  KeyRound,
  LockKeyhole,
  Pause,
  Radio,
  Shield,
  Siren,
  Wallet,
  Workflow,
} from "lucide-react";

const navigation = [
  { label: "Visão geral", id: "painel", icon: Activity },
  { label: "Disputas ao vivo", id: "disputas", icon: Radio },
  { label: "Cobertura do caixa", id: "cobertura", icon: Shield },
  { label: "Fila de resgates", id: "resgates", icon: Wallet },
  { label: "Alertas e serviços", id: "alertas", icon: Bell },
  { label: "Auditoria e acesso", id: "auditoria", icon: History },
];

const obligations = [
  { label: "Caixa livre após obrigações", icon: ArrowUpRight },
  { label: "Créditos ainda nas carteiras", icon: ArrowDownRight },
  { label: "Valor consumido em lances", icon: Gem },
  { label: "Prêmios ainda não pagos", icon: Shield },
];

function SectionHeading({
  index,
  title,
  note,
}: {
  index: string;
  title: string;
  note?: string;
}) {
  return (
    <div className="lc-section-heading">
      <span className="lc-section-index">{index}</span>
      <h2>{title}</h2>
      {note && <span className="lc-section-note">{note}</span>}
    </div>
  );
}

export function LiveCockpit() {
  return (
    <div className="lc-frame">
      <style>{`
        .lc-frame {
          --lc-paper: #f4f5ed;
          --lc-card: #fbfcf7;
          --lc-ink: #20241b;
          --lc-muted: #687064;
          --lc-line: #d9ddcf;
          --lc-line-dark: #c7cdbb;
          --lc-lime: #d4ff4f;
          --lc-olive: #53632e;
          --lc-olive-soft: #eaf0d7;
          --lc-alert: #9a4b35;
          --lc-alert-soft: #f7ece5;
          --lc-shadow: 0 14px 34px rgba(42, 49, 30, .055);
          min-height: 100dvh;
          background:
            radial-gradient(ellipse at 87% 0%, rgba(212, 255, 79, .16), transparent 28rem),
            var(--lc-paper);
          color: var(--lc-ink);
          font-family: ui-sans-serif, system-ui, sans-serif;
          font-size: 13px;
          line-height: 1.5;
        }
        .lc-frame * { box-sizing: border-box; }
        .lc-frame a { color: inherit; text-decoration: none; }
        .lc-frame button { font: inherit; }
        .lc-topbar {
          height: 68px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 clamp(18px, 3.4vw, 52px);
          border-bottom: 1px solid var(--lc-line);
          background: rgba(251, 252, 247, .88);
          backdrop-filter: blur(16px);
          position: sticky;
          top: 0;
          z-index: 10;
        }
        .lc-brand, .lc-brand-copy, .lc-top-right, .lc-status, .lc-inline, .lc-label-row {
          display: flex;
          align-items: center;
        }
        .lc-brand { gap: 11px; }
        .lc-brand-mark {
          width: 35px; height: 35px; display: grid; place-items: center;
          border-radius: 11px; background: var(--lc-ink); color: var(--lc-lime);
        }
        .lc-brand-mark svg { width: 19px; height: 19px; stroke-width: 2.4; }
        .lc-brand-copy { gap: 10px; }
        .lc-brand-name {
          font: 800 15px/1 var(--lp-display);
          letter-spacing: -.045em;
        }
        .lc-admin-chip {
          padding: 4px 7px 3px; border: 1px solid var(--lc-line-dark);
          border-radius: 5px; color: var(--lc-muted);
          font: 700 9px/1 var(--lp-mono); letter-spacing: .11em;
        }
        .lc-top-right { gap: 17px; }
        .lc-status {
          gap: 8px; padding: 7px 10px; border: 1px solid var(--lc-line);
          border-radius: 7px; color: var(--lc-muted);
          background: var(--lc-card); font-size: 11px; font-weight: 600;
        }
        .lc-status-dot {
          width: 7px; height: 7px; border: 1.5px solid var(--lc-olive);
          border-radius: 50%; background: transparent;
        }
        .lc-top-operator {
          color: var(--lc-muted); font-size: 11px; display: flex; align-items: center; gap: 7px;
        }
        .lc-top-operator svg { width: 15px; height: 15px; }
        .lc-shell {
          width: min(100%, 1600px);
          margin: 0 auto; padding: 30px clamp(18px, 3.4vw, 52px) 68px;
          display: grid; grid-template-columns: 196px minmax(0, 1fr); gap: 30px;
        }
        .lc-sidebar { position: sticky; top: 94px; align-self: start; }
        .lc-side-caption {
          margin: 1px 0 13px 11px; color: #87907e;
          font: 700 9px/1.2 var(--lp-mono); letter-spacing: .14em; text-transform: uppercase;
        }
        .lc-nav { display: grid; gap: 4px; }
        .lc-nav-link {
          min-height: 39px; display: flex; align-items: center; gap: 10px;
          padding: 0 11px; border-radius: 7px; color: var(--lc-muted);
          font-size: 11px; font-weight: 600; transition: background .18s ease, color .18s ease, transform .18s ease;
        }
        .lc-nav-link:hover { background: #e8ebdf; color: var(--lc-ink); transform: translateX(2px); }
        .lc-nav-link.is-active {
          background: var(--lc-ink); color: #f8faef; box-shadow: 0 4px 12px rgba(32,36,27,.13);
        }
        .lc-nav-link svg { width: 15px; height: 15px; flex: 0 0 auto; stroke-width: 1.8; }
        .lc-sidebar-rule { height: 1px; margin: 19px 10px 16px; background: var(--lc-line); }
        .lc-sidebar-note {
          margin: 0 9px; padding: 12px 12px 13px; border: 1px solid var(--lc-line);
          border-radius: 9px; background: rgba(251,252,247,.56); color: var(--lc-muted);
          font-size: 10px; line-height: 1.55;
        }
        .lc-sidebar-note strong { display: block; margin-bottom: 5px; color: var(--lc-ink); font-size: 10px; }
        .lc-main { min-width: 0; }
        .lc-hero {
          position: relative; display: grid; grid-template-columns: minmax(0, 1fr) auto;
          align-items: end; gap: 24px; padding: 8px 0 24px;
        }
        .lc-kicker {
          display: flex; align-items: center; gap: 8px; margin: 0 0 10px;
          color: var(--lc-olive); font: 700 10px/1.2 var(--lp-mono);
          letter-spacing: .12em; text-transform: uppercase;
        }
        .lc-kicker::before { content: ""; width: 19px; height: 2px; background: var(--lc-olive); }
        .lc-hero h1 {
          margin: 0; max-width: 760px; font: 700 clamp(28px, 3.4vw, 45px)/1.04 var(--lp-display);
          letter-spacing: -.055em;
        }
        .lc-hero-subtitle { max-width: 670px; margin: 11px 0 0; color: var(--lc-muted); font-size: 12px; }
        .lc-preview-stamp {
          display: grid; justify-items: end; gap: 5px; min-width: 160px; padding-bottom: 2px;
          color: var(--lc-muted); font-size: 10px; text-align: right;
        }
        .lc-preview-stamp strong { color: var(--lc-ink); font: 700 10px var(--lp-mono); letter-spacing: .05em; }
        .lc-preview-stamp span { display: inline-flex; align-items: center; gap: 6px; }
        .lc-preview-stamp svg { width: 13px; height: 13px; }
        .lc-signal-ribbon {
          display: grid; grid-template-columns: repeat(4, minmax(0, 1fr));
          border: 1px solid #32382d; border-radius: 10px; overflow: hidden;
          background: #252a20; color: #f5f7eb; box-shadow: var(--lc-shadow);
        }
        .lc-signal {
          min-height: 91px; display: flex; flex-direction: column; justify-content: space-between;
          padding: 14px 17px 13px; border-right: 1px solid rgba(236,241,218,.14);
          transition: background .2s ease;
        }
        .lc-signal:last-child { border-right: 0; }
        .lc-signal:hover { background: #2d3425; }
        .lc-signal-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
        .lc-signal-label { color: #c0c7b5; font-size: 10px; font-weight: 600; }
        .lc-signal-top svg { width: 15px; height: 15px; color: var(--lc-lime); stroke-width: 1.7; }
        .lc-signal-value { display: flex; align-items: baseline; gap: 8px; }
        .lc-signal-value strong { color: var(--lc-lime); font: 700 24px/1 var(--lp-mono); letter-spacing: -.08em; }
        .lc-signal-value span { color: #a8b09f; font-size: 10px; }
        .lc-section-heading { display: flex; align-items: center; gap: 10px; margin: 0 0 13px; min-width: 0; }
        .lc-section-index {
          width: 25px; height: 25px; flex: 0 0 auto; display: grid; place-items: center;
          border: 1px solid var(--lc-line-dark); border-radius: 7px; color: var(--lc-olive);
          font: 700 9px var(--lp-mono);
        }
        .lc-section-heading h2 {
          margin: 0; font: 700 17px/1.1 var(--lp-display); letter-spacing: -.035em;
        }
        .lc-section-note { margin-left: auto; color: var(--lc-muted); font-size: 10px; }
        .lc-live-section { margin-top: 25px; }
        .lc-primary-grid { display: grid; grid-template-columns: minmax(0, 1.62fr) minmax(250px, .85fr); gap: 13px; }
        .lc-panel {
          min-width: 0; border: 1px solid var(--lc-line); border-radius: 10px;
          background: var(--lc-card); box-shadow: 0 5px 18px rgba(42,49,30,.025);
          transition: border-color .2s ease, box-shadow .2s ease, transform .2s ease;
        }
        .lc-panel:hover { border-color: var(--lc-line-dark); box-shadow: var(--lc-shadow); transform: translateY(-1px); }
        .lc-dispute-panel { min-height: 277px; overflow: hidden; }
        .lc-panel-head {
          min-height: 53px; display: flex; align-items: center; justify-content: space-between;
          gap: 12px; padding: 0 17px; border-bottom: 1px solid var(--lc-line);
        }
        .lc-panel-title { display: flex; align-items: center; gap: 9px; font-size: 11px; font-weight: 700; }
        .lc-panel-title svg { width: 15px; height: 15px; color: var(--lc-olive); }
        .lc-head-meta { color: var(--lc-muted); font-size: 9px; font-weight: 600; }
        .lc-live-tag {
          display: inline-flex; align-items: center; gap: 6px; padding: 5px 7px;
          border: 1px solid var(--lc-line); border-radius: 5px; color: var(--lc-muted);
          background: #f4f6ed; font: 700 8px var(--lp-mono); letter-spacing: .04em;
        }
        .lc-live-tag i { width: 6px; height: 6px; border: 1px solid var(--lc-olive); border-radius: 50%; }
        .lc-dispute-empty {
          min-height: 222px; display: grid; grid-template-columns: 64px 1fr; align-items: center;
          gap: 17px; padding: 26px clamp(18px, 3vw, 35px);
        }
        .lc-empty-symbol {
          width: 61px; height: 61px; display: grid; place-items: center; position: relative;
          border: 1px dashed #bfc7ae; border-radius: 18px; color: var(--lc-olive); background: #f0f3e6;
        }
        .lc-empty-symbol::after {
          content: ""; width: 8px; height: 8px; position: absolute; right: -3px; bottom: -3px;
          border: 2px solid var(--lc-card); border-radius: 50%; background: var(--lc-lime);
        }
        .lc-empty-symbol svg { width: 25px; height: 25px; stroke-width: 1.5; }
        .lc-empty-copy h3 { margin: 0 0 6px; font: 700 16px/1.2 var(--lp-display); letter-spacing: -.025em; }
        .lc-empty-copy p { max-width: 390px; margin: 0; color: var(--lc-muted); font-size: 11px; }
        .lc-empty-status {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 0; margin-top: 17px;
          padding-top: 12px; border-top: 1px solid var(--lc-line);
        }
        .lc-empty-status div { min-width: 0; padding-right: 9px; }
        .lc-empty-status div + div { padding-left: 12px; border-left: 1px solid var(--lc-line); }
        .lc-empty-status small { display: block; color: #858d7e; font-size: 9px; }
        .lc-empty-status strong { display: block; margin-top: 3px; color: var(--lc-ink); font: 700 12px var(--lp-mono); }
        .lc-stack { display: grid; gap: 13px; }
        .lc-state-card { padding: 15px 16px 14px; }
        .lc-state-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .lc-state-title { display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 700; }
        .lc-state-title svg { width: 15px; height: 15px; color: var(--lc-olive); }
        .lc-state-mark { width: 6px; height: 6px; border: 1px solid var(--lc-olive); border-radius: 50%; }
        .lc-state-reading {
          margin-top: 14px; display: flex; align-items: baseline; gap: 8px;
          font: 700 24px/1 var(--lp-mono); letter-spacing: -.08em;
        }
        .lc-state-reading small { color: var(--lc-muted); font: 500 10px/1.3 ui-sans-serif, system-ui, sans-serif; letter-spacing: 0; }
        .lc-state-foot { display: flex; justify-content: space-between; gap: 10px; margin-top: 10px; padding-top: 9px; border-top: 1px solid var(--lc-line); color: var(--lc-muted); font-size: 9px; }
        .lc-state-foot strong { color: var(--lc-ink); font: 600 9px var(--lp-mono); }
        .lc-state-card.is-automation { background: #f2f5e7; border-color: #d1d9be; }
        .lc-state-card.is-service { background: #f9faf4; }
        .lc-columns { display: grid; grid-template-columns: minmax(0, 1.18fr) minmax(290px, .82fr); gap: 13px; }
        .lc-coverage { padding: 18px 19px 16px; }
        .lc-coverage-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
        .lc-coverage-title { margin: 0; font: 700 14px/1.2 var(--lp-display); letter-spacing: -.02em; }
        .lc-coverage-desc { max-width: 330px; margin: 5px 0 0; color: var(--lc-muted); font-size: 10px; }
        .lc-coverage-total { text-align: right; }
        .lc-coverage-total span { display: block; color: var(--lc-muted); font-size: 9px; }
        .lc-coverage-total strong { display: block; margin-top: 1px; font: 700 25px/1.15 var(--lp-mono); letter-spacing: -.1em; }
        .lc-coverage-track {
          height: 8px; margin: 17px 0 14px; border: 1px dashed #c4cbb7; border-radius: 99px;
          background: repeating-linear-gradient(135deg, #f1f3e9, #f1f3e9 5px, #e9eddf 5px, #e9eddf 10px);
        }
        .lc-obligations { display: grid; }
        .lc-obligation-row {
          min-height: 36px; display: flex; align-items: center; justify-content: space-between;
          gap: 12px; border-top: 1px solid var(--lc-line); color: #525b4c; font-size: 10px;
        }
        .lc-obligation-row span { display: flex; align-items: center; gap: 8px; }
        .lc-obligation-row svg { width: 13px; height: 13px; color: var(--lc-olive); }
        .lc-obligation-row strong { color: var(--lc-ink); font: 700 11px var(--lp-mono); }
        .lc-coverage-foot {
          display: flex; align-items: center; gap: 7px; margin-top: 10px; padding-top: 11px;
          border-top: 1px solid var(--lc-line); color: var(--lc-muted); font-size: 9px;
        }
        .lc-coverage-foot svg { width: 13px; height: 13px; color: var(--lc-olive); }
        .lc-queue-panel { padding-bottom: 12px; }
        .lc-queue-panel .lc-panel-head { border-bottom: 0; }
        .lc-queue-summary { display: grid; grid-template-columns: 1fr 1fr; padding: 0 16px 12px; }
        .lc-queue-stat { padding: 0 10px 0 0; }
        .lc-queue-stat + .lc-queue-stat { padding-left: 14px; border-left: 1px solid var(--lc-line); }
        .lc-queue-stat span { display: block; color: var(--lc-muted); font-size: 9px; }
        .lc-queue-stat strong { display: block; margin-top: 3px; font: 700 20px/1 var(--lp-mono); }
        .lc-queue-empty {
          display: flex; align-items: center; gap: 10px; margin: 0 13px; padding: 12px;
          border: 1px dashed var(--lc-line-dark); border-radius: 7px; color: var(--lc-muted); font-size: 9px;
        }
        .lc-queue-empty svg { width: 17px; height: 17px; flex: 0 0 auto; color: var(--lc-olive); }
        .lc-bottom-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(310px, .86fr); gap: 13px; }
        .lc-alert-panel, .lc-audit-panel, .lc-access-panel { padding-bottom: 15px; }
        .lc-count { min-width: 24px; height: 22px; display: grid; place-items: center; border: 1px solid var(--lc-line); border-radius: 5px; color: var(--lc-muted); font: 700 10px var(--lp-mono); }
        .lc-alert-empty, .lc-audit-empty {
          display: flex; align-items: flex-start; gap: 11px; margin: 0 15px; padding: 14px;
          border-radius: 7px; background: #f1f3e9;
        }
        .lc-alert-empty svg, .lc-audit-empty svg { width: 17px; height: 17px; flex: 0 0 auto; color: var(--lc-olive); }
        .lc-alert-empty strong, .lc-audit-empty strong { display: block; font-size: 10px; }
        .lc-alert-empty p, .lc-audit-empty p { margin: 3px 0 0; color: var(--lc-muted); font-size: 9px; }
        .lc-service-list { padding: 0 15px; }
        .lc-service-row { min-height: 35px; display: flex; align-items: center; justify-content: space-between; gap: 10px; border-bottom: 1px solid var(--lc-line); font-size: 10px; }
        .lc-service-row:last-child { border-bottom: 0; }
        .lc-service-name { display: flex; align-items: center; gap: 8px; }
        .lc-service-name svg { width: 13px; height: 13px; color: var(--lc-muted); }
        .lc-service-value { color: var(--lc-muted); font: 600 9px var(--lp-mono); }
        .lc-audit-panel { display: flex; flex-direction: column; }
        .lc-audit-empty { flex: 1; align-items: center; margin-top: 0; }
        .lc-access-panel { padding: 0 16px 15px; }
        .lc-access-panel .lc-panel-head { margin: 0 -16px 0; }
        .lc-access-readout {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          padding: 12px 0; border-bottom: 1px solid var(--lc-line);
        }
        .lc-access-readout span { color: var(--lc-muted); font-size: 10px; }
        .lc-access-readout strong { color: var(--lc-ink); font: 700 10px var(--lp-mono); }
        .lc-access-foot { display: flex; align-items: flex-start; gap: 7px; margin: 10px 0 0; color: var(--lc-muted); font-size: 9px; }
        .lc-access-foot svg { width: 13px; height: 13px; flex: 0 0 auto; }
        .lc-emergency {
          margin-top: 14px; padding: 15px; border: 1px solid #d9c9be; border-radius: 9px;
          background: #f7f0e9;
        }
        .lc-emergency-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .lc-emergency-title { display: flex; align-items: center; gap: 8px; font-size: 10px; font-weight: 700; }
        .lc-emergency-title svg { width: 15px; height: 15px; color: var(--lc-alert); }
        .lc-emergency-head small { color: #8d7467; font: 700 8px var(--lp-mono); letter-spacing: .08em; text-transform: uppercase; }
        .lc-emergency-actions { display: grid; grid-template-columns: repeat(3, 1fr); gap: 7px; margin-top: 12px; }
        .lc-emergency-button {
          min-height: 37px; display: flex; align-items: center; justify-content: center; gap: 6px;
          padding: 0 8px; border: 1px solid #ddcfc4; border-radius: 6px; background: rgba(255,255,255,.42);
          color: #907d70; cursor: not-allowed; font-size: 9px; font-weight: 650;
        }
        .lc-emergency-button svg { width: 13px; height: 13px; }
        .lc-emergency-note { margin: 9px 0 0; color: #8b796d; font-size: 9px; }
        .lc-footer {
          display: flex; justify-content: space-between; gap: 12px; margin-top: 23px; padding-top: 13px;
          border-top: 1px solid var(--lc-line); color: #858d7e; font-size: 9px;
        }
        .lc-footer span { display: inline-flex; align-items: center; gap: 6px; }
        .lc-footer svg { width: 12px; height: 12px; }
        @media (min-width: 1500px) {
          .lc-shell { grid-template-columns: 210px minmax(0, 1fr); gap: 38px; }
        }
        @media (max-width: 1050px) {
          .lc-shell { grid-template-columns: 1fr; gap: 19px; padding-top: 20px; }
          .lc-sidebar { position: static; }
          .lc-side-caption, .lc-sidebar-rule, .lc-sidebar-note { display: none; }
          .lc-nav { display: flex; gap: 5px; overflow-x: auto; padding-bottom: 3px; scrollbar-width: none; }
          .lc-nav::-webkit-scrollbar { display: none; }
          .lc-nav-link { flex: 0 0 auto; border: 1px solid var(--lc-line); background: rgba(251,252,247,.6); }
          .lc-nav-link.is-active { border-color: var(--lc-ink); }
        }
        @media (max-width: 760px) {
          .lc-topbar { height: 59px; padding: 0 15px; }
          .lc-top-operator { display: none; }
          .lc-brand-mark { width: 32px; height: 32px; }
          .lc-brand-copy { gap: 7px; }
          .lc-brand-name { font-size: 14px; }
          .lc-status { padding: 6px 8px; font-size: 9px; }
          .lc-shell { padding: 17px 14px 40px; gap: 15px; }
          .lc-hero { grid-template-columns: 1fr; gap: 12px; padding: 3px 0 16px; }
          .lc-hero h1 { font-size: 34px; }
          .lc-hero-subtitle { font-size: 11px; }
          .lc-preview-stamp { display: flex; align-items: center; justify-items: initial; text-align: left; }
          .lc-signal-ribbon { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .lc-signal { min-height: 80px; padding: 11px 12px; }
          .lc-signal:nth-child(2) { border-right: 0; }
          .lc-signal:nth-child(-n+2) { border-bottom: 1px solid rgba(236,241,218,.14); }
          .lc-signal-value strong { font-size: 21px; }
          .lc-live-section { margin-top: 21px; }
          .lc-primary-grid, .lc-columns, .lc-bottom-grid { grid-template-columns: 1fr; }
          .lc-dispute-empty { grid-template-columns: 48px 1fr; gap: 12px; padding: 21px 15px; }
          .lc-empty-symbol { width: 47px; height: 47px; border-radius: 14px; }
          .lc-empty-symbol svg { width: 21px; height: 21px; }
          .lc-empty-copy h3 { font-size: 14px; }
          .lc-empty-status { gap: 0; }
          .lc-empty-status div + div { padding-left: 7px; }
          .lc-empty-status div { padding-right: 5px; }
          .lc-empty-status small { font-size: 8px; }
          .lc-empty-status strong { font-size: 10px; }
          .lc-coverage { padding: 15px; }
          .lc-section-heading h2 { font-size: 15px; }
          .lc-section-note { font-size: 9px; }
          .lc-emergency-actions { grid-template-columns: 1fr; }
          .lc-emergency-button { justify-content: flex-start; padding-left: 11px; }
          .lc-footer { flex-direction: column; }
        }
        @media (prefers-reduced-motion: reduce) {
          .lc-frame *, .lc-frame *::before, .lc-frame *::after {
            scroll-behavior: auto !important; transition-duration: .01ms !important;
          }
        }
      `}</style>

      <header className="lc-topbar">
        <a href="#painel" className="lc-brand" aria-label="Lance do Pix, início">
          <span className="lc-brand-mark"><Gem aria-hidden="true" /></span>
          <span className="lc-brand-copy">
            <span className="lc-brand-name">Lance do Pix</span>
            <span className="lc-admin-chip">OPERAÇÕES</span>
          </span>
        </a>
        <div className="lc-top-right">
          <span className="lc-status">
            <i className="lc-status-dot" aria-hidden="true" />
            Prévia sem conexão
          </span>
          <span className="lc-top-operator">
            <KeyRound aria-hidden="true" />
            Acesso e permissões
          </span>
        </div>
      </header>

      <div className="lc-shell" id="painel">
        <aside className="lc-sidebar" aria-label="Navegação do painel">
          <p className="lc-side-caption">Central de operação</p>
          <nav className="lc-nav">
            {navigation.map(({ label, id, icon: Icon }, index) => (
              <a
                className={`lc-nav-link${index === 0 ? " is-active" : ""}`}
                href={`#${id}`}
                key={id}
                aria-current={index === 0 ? "page" : undefined}
              >
                <Icon aria-hidden="true" />
                {label}
                {index === 0 && <ChevronRight aria-hidden="true" />}
              </a>
            ))}
          </nav>
          <div className="lc-sidebar-rule" />
          <div className="lc-sidebar-note">
            <strong>Dados de operação indisponíveis</strong>
            Os indicadores ficam neutros até a conexão com fontes reais.
          </div>
        </aside>

        <main className="lc-main">
          <section className="lc-hero" aria-labelledby="lc-title">
            <div>
              <p className="lc-kicker">Cockpit ao vivo / operações</p>
              <h1 id="lc-title">Disputas primeiro.<br />Obrigações sempre visíveis.</h1>
              <p className="lc-hero-subtitle">
                Leitura rápida da atividade, dos próximos marcos e dos limites de segurança do caixa.
              </p>
            </div>
            <div className="lc-preview-stamp">
              <strong>AGUARDANDO DADOS REAIS</strong>
              <span><CircleDashed aria-hidden="true" /> Indicadores sem telemetria</span>
            </div>
          </section>

          <section className="lc-signal-ribbon" aria-label="Resumo operacional">
            <div className="lc-signal">
              <div className="lc-signal-top"><span className="lc-signal-label">Disputas ao vivo</span><Radio aria-hidden="true" /></div>
              <div className="lc-signal-value"><strong>—</strong><span>aguardando dados reais</span></div>
            </div>
            <div className="lc-signal">
              <div className="lc-signal-top"><span className="lc-signal-label">Próxima transição</span><Clock3 aria-hidden="true" /></div>
              <div className="lc-signal-value"><strong>—</strong><span>tempo restante</span></div>
            </div>
            <div className="lc-signal">
              <div className="lc-signal-top"><span className="lc-signal-label">Estado da automação</span><Workflow aria-hidden="true" /></div>
              <div className="lc-signal-value"><strong>—</strong><span>aguardando dados reais</span></div>
            </div>
            <div className="lc-signal">
              <div className="lc-signal-top"><span className="lc-signal-label">Saúde dos serviços</span><Database aria-hidden="true" /></div>
              <div className="lc-signal-value"><strong>—</strong><span>aguardando dados reais</span></div>
            </div>
          </section>

          <section className="lc-live-section" id="disputas">
            <SectionHeading index="01" title="Intervenção ao vivo" note="Disputas · lances · próxima transição" />
            <div className="lc-primary-grid">
              <article className="lc-panel lc-dispute-panel">
                <div className="lc-panel-head">
                  <div className="lc-panel-title"><Radio aria-hidden="true" /> Disputas em andamento</div>
                  <span className="lc-live-tag"><i aria-hidden="true" /> AGUARDANDO DADOS</span>
                </div>
                <div className="lc-dispute-empty">
                  <div className="lc-empty-symbol"><Activity aria-hidden="true" /></div>
                  <div className="lc-empty-copy">
                    <h3>Sem leitura da fila ao vivo</h3>
                    <p>Os detalhes de disputa, o relógio e o próximo marco aparecem aqui quando a fonte de dados estiver conectada.</p>
                    <div className="lc-empty-status">
                      <div><small>Identificação</small><strong>—</strong></div>
                      <div><small>Lance atual</small><strong>—</strong></div>
                      <div><small>Próxima transição</small><strong>—</strong></div>
                    </div>
                  </div>
                </div>
              </article>

              <div className="lc-stack">
                <article className="lc-panel lc-state-card is-automation">
                  <div className="lc-state-head">
                    <div className="lc-state-title"><Workflow aria-hidden="true" /> Automação</div>
                    <i className="lc-state-mark" aria-label="Estado desconhecido" />
                  </div>
                  <div className="lc-state-reading">— <small>aguardando dados reais</small></div>
                  <div className="lc-state-foot"><span>Modo de execução</span><strong>—</strong></div>
                  <div className="lc-state-foot"><span>Próxima ação prevista</span><strong>—</strong></div>
                </article>
                <article className="lc-panel lc-state-card is-service">
                  <div className="lc-state-head">
                    <div className="lc-state-title"><Database aria-hidden="true" /> Saúde dos serviços</div>
                    <i className="lc-state-mark" aria-label="Estado desconhecido" />
                  </div>
                  <div className="lc-state-reading">— <small>sem telemetria conectada</small></div>
                  <div className="lc-state-foot"><span>Disponibilidade</span><strong>—</strong></div>
                  <div className="lc-state-foot"><span>Última verificação</span><strong>—</strong></div>
                </article>
              </div>
            </div>
          </section>

          <section className="lc-live-section" id="cobertura">
            <SectionHeading index="02" title="Caixa como limite de segurança" note="Valores não carregados" />
            <div className="lc-columns">
              <article className="lc-panel lc-coverage">
                <div className="lc-coverage-top">
                  <div>
                    <h3 className="lc-coverage-title">Cobertura para prêmios</h3>
                    <p className="lc-coverage-desc">Uma leitura de proteção, não uma projeção. Sem saldos reais, a cobertura não pode ser avaliada.</p>
                  </div>
                  <div className="lc-coverage-total"><span>Leitura atual</span><strong>—</strong></div>
                </div>
                <div className="lc-coverage-track" role="img" aria-label="Cobertura não disponível nesta prévia" />
                <div className="lc-obligations">
                  {obligations.map(({ label, icon: Icon }) => (
                    <div className="lc-obligation-row" key={label}>
                      <span><Icon aria-hidden="true" />{label}</span>
                      <strong>—</strong>
                    </div>
                  ))}
                </div>
                <div className="lc-coverage-foot"><Shield aria-hidden="true" /> Aguardando dados reais para conciliar caixa e obrigações.</div>
              </article>

              <article className="lc-panel lc-queue-panel" id="resgates">
                <div className="lc-panel-head">
                  <div className="lc-panel-title"><Wallet aria-hidden="true" /> Fila de resgates</div>
                  <span className="lc-head-meta">Sem fonte conectada</span>
                </div>
                <div className="lc-queue-summary">
                  <div className="lc-queue-stat"><span>A pagar</span><strong>—</strong></div>
                  <div className="lc-queue-stat"><span>Pagos</span><strong>—</strong></div>
                </div>
                <div className="lc-queue-empty">
                  <CircleDashed aria-hidden="true" />
                  <span>Solicitações e comprovantes aguardam dados reais.</span>
                </div>
              </article>
            </div>
          </section>

          <section className="lc-live-section" id="alertas">
            <SectionHeading index="03" title="Sinais e rastreabilidade" note="Alertas · saúde · auditoria" />
            <div className="lc-bottom-grid">
              <div className="lc-stack">
                <article className="lc-panel lc-alert-panel">
                  <div className="lc-panel-head">
                    <div className="lc-panel-title"><Bell aria-hidden="true" /> Alertas urgentes</div>
                    <span className="lc-count">—</span>
                  </div>
                  <div className="lc-alert-empty">
                    <AlertTriangle aria-hidden="true" />
                    <div>
                      <strong>Aguardando dados reais de alertas</strong>
                      <p>Não há leitura de alertas disponível nesta prévia.</p>
                    </div>
                  </div>
                </article>
                <article className="lc-panel">
                  <div className="lc-panel-head">
                    <div className="lc-panel-title"><Activity aria-hidden="true" /> Serviços monitorados</div>
                    <span className="lc-head-meta">Estados desconhecidos</span>
                  </div>
                  <div className="lc-service-list">
                    <div className="lc-service-row"><span className="lc-service-name"><Database aria-hidden="true" /> API de operação</span><span className="lc-service-value">—</span></div>
                    <div className="lc-service-row"><span className="lc-service-name"><Radio aria-hidden="true" /> Atualização de disputas</span><span className="lc-service-value">—</span></div>
                    <div className="lc-service-row"><span className="lc-service-name"><Wallet aria-hidden="true" /> Processamento de pagamentos</span><span className="lc-service-value">—</span></div>
                  </div>
                </article>
              </div>

              <article className="lc-panel lc-audit-panel" id="auditoria">
                <div className="lc-panel-head">
                  <div className="lc-panel-title"><History aria-hidden="true" /> Trilha de auditoria</div>
                  <span className="lc-head-meta">Eventos recentes</span>
                </div>
                <div className="lc-audit-empty">
                  <CircleDashed aria-hidden="true" />
                  <div>
                    <strong>Nenhuma atividade carregada</strong>
                    <p>Alterações e ações operacionais serão exibidas quando houver uma fonte real conectada.</p>
                  </div>
                </div>
              </article>
            </div>
          </section>

          <section className="lc-live-section">
            <SectionHeading index="04" title="Controles e permissões" note="Informativo · sem comandos conectados" />
            <div className="lc-columns">
              <article className="lc-panel lc-access-panel">
                <div className="lc-panel-head">
                  <div className="lc-panel-title"><KeyRound aria-hidden="true" /> Acesso efetivo</div>
                  <span className="lc-head-meta">Sem leitura de sessão</span>
                </div>
                <div className="lc-access-readout"><span>Perfil ativo</span><strong>—</strong></div>
                <div className="lc-access-readout"><span>Permissões críticas</span><strong>—</strong></div>
                <p className="lc-access-foot"><LockKeyhole aria-hidden="true" /> A identidade e as permissões não são representadas nesta prévia.</p>
              </article>
              <article className="lc-emergency" aria-label="Controles de emergência desativados">
                <div className="lc-emergency-head">
                  <div className="lc-emergency-title"><Siren aria-hidden="true" /> Controles de emergência</div>
                  <small>Desconectados</small>
                </div>
                <div className="lc-emergency-actions">
                  <button className="lc-emergency-button" type="button" disabled title="Indisponível nesta prévia">
                    <Pause aria-hidden="true" /> Pausar novos lances
                  </button>
                  <button className="lc-emergency-button" type="button" disabled title="Indisponível nesta prévia">
                    <Workflow aria-hidden="true" /> Suspender automação
                  </button>
                  <button className="lc-emergency-button" type="button" disabled title="Indisponível nesta prévia">
                    <LockKeyhole aria-hidden="true" /> Restringir resgates
                  </button>
                </div>
                <p className="lc-emergency-note">Controles exibidos para contexto. Nenhuma ação pode ser executada nesta prévia.</p>
              </article>
            </div>
          </section>

          <footer className="lc-footer">
            <span><CircleDashed aria-hidden="true" /> Prévia estática · sem integração com serviços operacionais</span>
            <span>Dados reais não carregados</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
