import "./_group.css";

const navItems = [
  "Painel",
  "Caixa",
  "Resgates",
  "Disputas",
  "Automação",
];

function Metric({ label, note }: { label: string; note: string }) {
  return (
    <article className="current-kpi">
      <div className="current-kpi-label">{label}</div>
      <div className="current-kpi-value">—</div>
      <small className="current-kpi-note">{note}</small>
    </article>
  );
}

function Section({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: string;
}) {
  return (
    <section className="current-section">
      <div className="current-section-head">
        <p className="current-eyebrow">{title}</p>
        {action && <span className="current-note">{action} →</span>}
      </div>
      {children}
    </section>
  );
}

export function Current() {
  return (
    <div className="current-frame">
      <header className="current-topbar">
        <div className="current-topbar-inner">
          <a className="current-brand" href="#painel">
            <span className="current-mark" aria-hidden="true">
              ◆
            </span>
            <span className="current-brand-name">Lance do Pix</span>
            <span className="current-admin-tag">ADMIN</span>
          </a>
          <span className="current-connection">
            <i aria-hidden="true" />
            Dados não conectados nesta prévia
          </span>
        </div>
      </header>

      <main className="current-content" id="painel">
        <nav className="current-tabs" aria-label="Navegação principal">
          {navItems.map((item, index) => (
            <button
              className={`current-tab${index === 0 ? " active" : ""}`}
              key={item}
              type="button"
            >
              {item}
            </button>
          ))}
        </nav>

        <div className="current-dashboard">
          <Section title="Sistema" action="Atualizar">
            <div className="current-kpis">
              <Metric label="Servidor" note="Status sem telemetria conectada" />
              <Metric label="Online agora" note="Acompanhando as disputas" />
              <Metric label="Visitantes" note="Visitas do dia" />
            </div>
          </Section>

          <Section title="Agora">
            <div className="current-kpis">
              <Metric
                label="Disputas em andamento"
                note="Prêmios em disputa"
              />
              <Metric
                label="Lances em andamento"
                note="Lances registrados nas disputas ativas"
              />
            </div>
            <div className="current-empty">
              <strong>Aguardando fonte de disputas</strong>
              Esta prévia não apresenta atividade inventada.
            </div>
          </Section>

          <Section title="Caixa" action="Ver movimentações">
            <article className="current-card">
              <div className="current-kpi-label">
                Entradas brutas confirmadas
              </div>
              <strong className="current-cash-total">—</strong>
              <small className="current-note">
                Recargas, aportes e outras entradas recebidas; sem simulações.
              </small>
              <div className="current-ledger">
                {[
                  "Caixa livre após obrigações",
                  "Créditos ainda nas carteiras",
                  "Total consumido em lances",
                  "Prêmios ainda não pagos",
                ].map((label) => (
                  <div className="current-ledger-row" key={label}>
                    <span>{label}</span>
                    <strong>—</strong>
                  </div>
                ))}
              </div>
            </article>
          </Section>

          <Section title="Resgates" action="Abrir resgates">
            <div className="current-kpis">
              <Metric label="A pagar" note="Solicitações na fila" />
              <Metric label="Pagos" note="Pagamentos realizados" />
            </div>
          </Section>

          <Section title="Histórico" action="Ver disputas">
            <div className="current-kpis">
              <Metric
                label="Disputas realizadas"
                note="Lances registrados"
              />
              <Metric
                label="Receita da plataforma"
                note="Parcela registrada nos lances"
              />
              <Metric
                label="Cobertura para prêmios"
                note="Parcela destinada aos prêmios"
              />
            </div>
          </Section>
        </div>
      </main>
    </div>
  );
}
