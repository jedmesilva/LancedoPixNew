import { Activity, ArrowDownLeft, ArrowUpRight, CircleDollarSign, FileClock, Shield, TimerReset } from "lucide-react";
import "./_group.css";
import "./OperationsTimeline.css";

const filters = ["Tudo", "Disputas", "Caixa", "Resgates", "Sistema"];

function Unavailable({ label, note }: { label: string; note: string }) {
  return (
    <div className="otl-metric">
      <span>{label}</span>
      <strong>—</strong>
      <small>{note}</small>
    </div>
  );
}

export function OperationsTimeline() {
  return (
    <main className="otl-frame">
      <header className="otl-topbar">
        <a className="otl-brand" href="#fluxo" aria-label="Lance do Pix, painel">
          <span className="otl-mark" aria-hidden="true">◆</span>
          <span>Lance do Pix</span>
          <span className="otl-admin">ADMIN</span>
        </a>
        <div className="otl-topbar-right">
          <span className="otl-connection"><i /> Prévia sem conexão</span>
          <span className="otl-avatar">OP</span>
        </div>
      </header>

      <div className="otl-content" id="fluxo">
        <section className="otl-page-head">
          <div>
            <p className="otl-overline">OPERAÇÃO · VISÃO CRONOLÓGICA</p>
            <h1>Ritmo operacional</h1>
            <p className="otl-intro">
              Uma linha do tempo única para entender o que mudou, quando e em qual área.
            </p>
          </div>
          <button className="otl-time-select" type="button" aria-label="Período selecionado">
            <TimerReset size={15} /> Período atual <span>⌄</span>
          </button>
        </section>

        <nav className="otl-filters" aria-label="Filtrar fluxo operacional">
          {filters.map((filter, index) => (
            <button className={index === 0 ? "selected" : ""} key={filter} type="button">
              {filter}
            </button>
          ))}
          <div className="otl-update"><span /> Atualização aguardando conexão</div>
        </nav>

        <div className="otl-layout">
          <section className="otl-stream-panel">
            <div className="otl-panel-head">
              <div>
                <div className="otl-title-row"><Activity size={17} /><h2>Fluxo de eventos</h2></div>
                <p>Disputas, caixa, resgates e sistema em uma mesma sequência.</p>
              </div>
              <button type="button" className="otl-icon-button" aria-label="Filtrar eventos">
                <span className="otl-filter-glyph">≡</span>
              </button>
            </div>

            <div className="otl-stream-meta">
              <div><small>EVENTOS NO PERÍODO</small><strong>—</strong></div>
              <div><small>ÚLTIMO EVENTO</small><strong>—</strong></div>
              <div><small>ÁREAS MONITORADAS</small><strong>—</strong></div>
            </div>

            <div className="otl-empty-stream">
              <div className="otl-orbit" aria-hidden="true">
                <span><Activity size={22} /></span>
                <i className="orbit orbit-a" />
                <i className="orbit orbit-b" />
                <i className="orbit orbit-c" />
              </div>
              <p className="otl-overline">LINHA DO TEMPO</p>
              <h3>Aguardando eventos reais</h3>
              <p>
                Assim que as fontes estiverem conectadas, mudanças verificadas aparecerão
                em ordem cronológica, com origem e contexto.
              </p>
              <div className="otl-empty-legend">
                <span><i className="legend-dispute" /> Disputas</span>
                <span><i className="legend-money" /> Caixa</span>
                <span><i className="legend-system" /> Sistema</span>
              </div>
            </div>

            <div className="otl-stream-foot">
              <Shield size={14} />
              Ações administrativas sensíveis devem registrar responsável e motivo.
            </div>
          </section>

          <aside className="otl-context">
            <section className="otl-context-card">
              <div className="otl-context-head">
                <div><p className="otl-overline">CONTEXTO</p><h2>Estado da operação</h2></div>
                <span className="otl-context-icon"><CircleDollarSign size={17} /></span>
              </div>
              <Unavailable label="Cobertura de prêmios" note="Caixa disponível ÷ obrigações" />
              <Unavailable label="Disputas em andamento" note="Timer e liderança" />
              <Unavailable label="Resgates pendentes" note="Fila de pagamentos" />
            </section>

            <section className="otl-context-card otl-areas-card">
              <div className="otl-context-head">
                <div><p className="otl-overline">FONTES DE EVENTOS</p><h2>Áreas da plataforma</h2></div>
              </div>
              <div className="otl-area-row">
                <span className="otl-area-icon area-bids"><ArrowUpRight size={15} /></span>
                <span><strong>Disputas</strong><small>Eventos aguardando conexão</small></span>
                <b>—</b>
              </div>
              <div className="otl-area-row">
                <span className="otl-area-icon area-cash"><CircleDollarSign size={15} /></span>
                <span><strong>Caixa e Pix</strong><small>Eventos aguardando conexão</small></span>
                <b>—</b>
              </div>
              <div className="otl-area-row">
                <span className="otl-area-icon area-payout"><ArrowDownLeft size={15} /></span>
                <span><strong>Resgates</strong><small>Eventos aguardando conexão</small></span>
                <b>—</b>
              </div>
              <div className="otl-area-row">
                <span className="otl-area-icon area-audit"><FileClock size={15} /></span>
                <span><strong>Auditoria</strong><small>Registro imutável de ações</small></span>
                <b>—</b>
              </div>
            </section>

            <div className="otl-note">
              <span className="otl-note-mark"><Shield size={15} /></span>
              <p><strong>Contexto antes da ação</strong>O histórico deve explicar o impacto e mostrar a trilha de auditoria relacionada.</p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
