import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Bell,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  FileClock,
  Filter,
  Fingerprint,
  Layers3,
  LockKeyhole,
  Search,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Users,
  WalletCards,
  X,
  Zap,
} from "lucide-react";
import {
  getAdminDashboard,
  getAutomationConfig,
  listAdminPayouts,
  listAutomationEvents,
} from "../generated/adminApi";
import type { AdminDashboard, AdminDisputeSummary, AdminPayout } from "../generated/adminApi.schemas";
import "./action-center.css";

type QueueId = "resgates" | "disputas" | "fraude" | "incidentes";
type QueueFilter = "all" | "requested" | "under_review" | "live" | "paused";

const money = (cents: number | null | undefined) =>
  cents == null
    ? "—"
    : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

const dateLabel = (value: string | null | undefined) =>
  value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "—";

const queueItems = [
  { id: "resgates", label: "Resgates", detail: "Pagamentos que precisam de revisão", icon: WalletCards },
  { id: "disputas", label: "Disputas", detail: "Casos que pedem intervenção", icon: ShieldAlert },
  { id: "fraude", label: "Fraude", detail: "Sinais aguardando análise", icon: Fingerprint },
  { id: "incidentes", label: "Incidentes", detail: "Serviços e eventos operacionais", icon: Activity },
] as const;

const queueCopy: Record<QueueId, { title: string; description: string; empty: string; iconLabel: string }> = {
  resgates: {
    title: "Fila de resgates",
    description: "Verifique a solicitação antes de liberar um pagamento.",
    empty: "Não há resgates aguardando ação.",
    iconLabel: "Nenhum resgate carregado",
  },
  disputas: {
    title: "Fila de disputas",
    description: "Acompanhe os casos e intervenha com contexto completo.",
    empty: "Não há disputas ativas para revisar.",
    iconLabel: "Nenhuma disputa carregada",
  },
  fraude: {
    title: "Fila de análise de fraude",
    description: "Sinais de risco devem ser revisados antes de qualquer ação.",
    empty: "A API administrativa ainda não fornece dados de análise de fraude.",
    iconLabel: "Fonte de fraude não conectada",
  },
  incidentes: {
    title: "Fila de incidentes",
    description: "Eventos de serviço ficam aqui quando a telemetria estiver conectada.",
    empty: "A API administrativa ainda não fornece dados de incidentes.",
    iconLabel: "Fonte de incidentes não conectada",
  },
};

function ValuePair({
  label,
  value,
  note,
  highlight = false,
}: {
  label: string;
  value: string;
  note?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`ac-value-pair${highlight ? " highlight" : ""}`}>
      <div>
        <span className="ac-value-label">{label}</span>
        {note && <small>{note}</small>}
      </div>
      <strong>{value}</strong>
    </div>
  );
}

function MiniStatus({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Activity }) {
  return (
    <div className="ac-mini-status">
      <span className="ac-mini-icon"><Icon size={15} strokeWidth={1.8} /></span>
      <span>{label}</span>
      <strong title={value}>{value}</strong>
    </div>
  );
}

function EmptyQueue({
  title,
  description,
  icon: Icon,
  waiting,
  action,
}: {
  title: string;
  description: string;
  icon: typeof WalletCards;
  waiting: string;
  action?: ReactNode;
}) {
  return (
    <div className="ac-empty-queue">
      <span className="ac-empty-icon"><Icon size={21} strokeWidth={1.7} /></span>
      <h3>{title}</h3>
      <p>{description}</p>
      <span className="ac-waiting-label"><Clock3 size={12} /> {waiting}</span>
      {action}
    </div>
  );
}

function PayoutQueueRow({ payout }: { payout: AdminPayout }) {
  const nextStep = payout.status === "requested" ? "Iniciar análise" : "Concluir pagamento";
  const status = payout.status === "requested" ? "Aguardando análise" : "Em análise";
  return (
    <Link className="ac-live-row" href="/payouts" data-testid={`action-center-payout-${payout.id}`}>
      <span className="ac-live-row-main">
        <strong>{payout.userName}</strong>
        <small>{money(payout.amountCents)} · solicitação de {dateLabel(payout.requestedAt)}</small>
      </span>
      <span className="ac-live-row-owner">Operação</span>
      <span className="ac-live-row-step">{nextStep}<small>{status}</small></span>
      <span className="ac-live-row-deadline">{dateLabel(payout.requestedAt)}</span>
    </Link>
  );
}

function DisputeQueueRow({ dispute }: { dispute: AdminDisputeSummary }) {
  const nextStep = dispute.status === "paused" ? "Verificar disputa" : "Acompanhar disputa";
  return (
    <Link className="ac-live-row" href={`/disputes/${encodeURIComponent(dispute.id)}`} data-testid={`action-center-dispute-${dispute.id}`}>
      <span className="ac-live-row-main">
        <strong>Disputa #{dispute.number} · {money(dispute.prizeCents)}</strong>
        <small>{dispute.leaderName ? `Líder: ${dispute.leaderName}` : "Sem lances"} · {dispute.bidsCount} lances</small>
      </span>
      <span className="ac-live-row-owner">{dispute.status === "paused" ? "Pausada" : "Ao vivo"}</span>
      <span className="ac-live-row-step">{nextStep}<small>{dispute.currentValueCents == null ? "Aguardando primeiro lance" : `Lance atual ${money(dispute.currentValueCents)}`}</small></span>
      <span className="ac-live-row-deadline">{dateLabel(dispute.startedAt ?? dispute.createdAt)}</span>
    </Link>
  );
}

function disputeSearchText(dispute: AdminDisputeSummary) {
  return ` ${dispute.number} ${dispute.prizeCents} ${dispute.leaderName ?? ""} ${dispute.status} `.toLocaleLowerCase("pt-BR");
}

function ActionCenterPage() {
  const [activeQueue, setActiveQueue] = useState<QueueId>("resgates");
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [queueFilter, setQueueFilter] = useState<QueueFilter>("all");
  const [oldestFirst, setOldestFirst] = useState(true);
  const dashboardQuery = useQuery({ queryKey: ["/api/admin/dashboard"], queryFn: getAdminDashboard });
  const automationQuery = useQuery({ queryKey: ["/api/admin/automation/config"], queryFn: getAutomationConfig });
  const eventsQuery = useQuery({
    queryKey: ["/api/admin/automation/events", { limit: 20, offset: 0 }],
    queryFn: () => listAutomationEvents({ limit: 20, offset: 0 }),
  });
  const payoutQuery = useQuery({
    queryKey: ["/api/admin/action-center/payouts", search.trim()],
    enabled: activeQueue === "resgates",
    queryFn: async () => {
      const q = search.trim() || undefined;
      const [requested, underReview] = await Promise.all([
        listAdminPayouts({ status: "requested", q, limit: 25, offset: 0 }),
        listAdminPayouts({ status: "under_review", q, limit: 25, offset: 0 }),
      ]);
      return {
        items: [...requested.items, ...underReview.items],
        requestedTotal: requested.total,
        underReviewTotal: underReview.total,
      };
    },
  });

  const dashboard = dashboardQuery.data as AdminDashboard | undefined;
  const activeCopy = queueCopy[activeQueue];
  const selectedQueue = queueItems.find((item) => item.id === activeQueue);
  const ActiveQueueIcon = selectedQueue?.icon ?? WalletCards;
  const pendingWork = dashboard ? dashboard.pendingPayoutCount + dashboard.liveDisputes.length : null;
  const liveDisputes = useMemo(() => {
    if (!dashboard) return [];
    const query = search.trim().toLocaleLowerCase("pt-BR");
    return dashboard.liveDisputes
      .filter((dispute) => queueFilter === "all" || ((queueFilter === "live" || queueFilter === "paused") && dispute.status === queueFilter))
      .filter((dispute) => !query || disputeSearchText(dispute).includes(query))
      .sort((a, b) => {
        const order = new Date(a.startedAt ?? a.createdAt).getTime() - new Date(b.startedAt ?? b.createdAt).getTime();
        return oldestFirst ? order : -order;
      });
  }, [dashboard, oldestFirst, queueFilter, search]);

  const payouts = useMemo(() => {
    const items = payoutQuery.data?.items ?? [];
    return items
      .filter((payout) => queueFilter === "all" || ((queueFilter === "requested" || queueFilter === "under_review") && payout.status === queueFilter))
      .sort((a, b) => {
        const order = new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime();
        return oldestFirst ? order : -order;
      })
      .slice(0, 10);
  }, [oldestFirst, payoutQuery.data, queueFilter]);

  const automationStatus = automationQuery.data?.operatorRules.status;
  const enabledRules = automationQuery.data
    ? Number(automationQuery.data.operatorRules.opening.on) + Number(automationQuery.data.operatorRules.counter.on)
    : null;
  const latestEvent = eventsQuery.data?.items[0];
  const queueCount = activeQueue === "resgates"
    ? dashboard?.pendingPayoutCount
    : activeQueue === "disputas"
      ? dashboard?.liveDisputes.length
      : null;
  const searchMatches = activeQueue === "resgates"
    ? payouts
    : activeQueue === "disputas"
      ? liveDisputes
      : [];
  const queueError = activeQueue === "resgates" && payoutQuery.isError;
  const queueLoading = activeQueue === "resgates" && payoutQuery.isPending;

  const selectQueue = (id: QueueId) => {
    setActiveQueue(id);
    setQueueFilter("all");
    setSearch("");
  };
  const refreshAll = () => {
    void dashboardQuery.refetch();
    void automationQuery.refetch();
    void eventsQuery.refetch();
    if (activeQueue === "resgates") void payoutQuery.refetch();
  };
  const reviewWork = () => {
    if (dashboard?.pendingPayoutCount) selectQueue("resgates");
    else if (dashboard?.liveDisputes.length) selectQueue("disputas");
    requestAnimationFrame(() => document.getElementById("fila")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const filterOptions: Array<{ value: QueueFilter; label: string }> = activeQueue === "resgates"
    ? [{ value: "all", label: "Todos os pendentes" }, { value: "requested", label: "Solicitados" }, { value: "under_review", label: "Em análise" }]
    : activeQueue === "disputas"
      ? [{ value: "all", label: "Todas as ativas" }, { value: "live", label: "Ao vivo" }, { value: "paused", label: "Pausadas" }]
      : [];

  if (dashboardQuery.isPending) {
    return <div className="ac-page-loading" role="status"><span className="ac-preview-dot" /> Carregando dados operacionais…</div>;
  }
  if (dashboardQuery.isError || !dashboard) {
    return (
      <div className="ac-empty-queue ac-page-error" role="alert">
        <span className="ac-empty-icon"><AlertTriangle size={21} /></span>
        <h3>Não foi possível carregar a central</h3>
        <p>Os dados do painel não chegaram da API administrativa.</p>
        <button className="ac-button" type="button" onClick={() => void dashboardQuery.refetch()}>Tentar novamente</button>
      </div>
    );
  }

  return (
    <>
      <section className="ac-page-intro" aria-labelledby="ac-title">
        <div>
          <p className="ac-eyebrow">Central de trabalho</p>
          <h1 id="ac-title">O que precisa de uma decisão?</h1>
          <p className="ac-page-intro-copy">Priorize o próximo passo. Caixa e automação ficam à vista enquanto você resolve cada fila.</p>
        </div>
        <div className="ac-header-actions">
          <button className="ac-button" type="button" onClick={refreshAll} data-testid="button-refresh-action-center">
            <Activity size={15} /> Atualizar
          </button>
          <button className="ac-button ac-button-primary" type="button" onClick={reviewWork} data-testid="button-review-work">
            <ArrowRight size={15} /> Revisar trabalho
          </button>
        </div>
      </section>

      <section className="ac-topline" aria-label="Prioridade e segurança do caixa">
        <div className="ac-priority-banner">
          <div className="ac-priority-copy">
            <span className="ac-banner-label"><Sparkles size={13} /> Foco da operação</span>
            <strong>{pendingWork ? "Trabalho pendente" : "Operação em dia"}</strong>
            <p>{pendingWork ? "Resgates e disputas aguardando triagem ou acompanhamento." : "Não há resgates ou disputas ativas aguardando ação."}</p>
          </div>
          <strong className="ac-banner-value">{pendingWork?.toLocaleString("pt-BR") ?? "—"}</strong>
        </div>
        <div className="ac-safety-chip">
          <span className="ac-safety-icon"><ShieldCheck size={19} /></span>
          <div className="ac-safety-text">
            <span>Segurança financeira</span>
            <strong>Cobertura de prêmios</strong>
            <small>Parcela destinada aos prêmios, conforme os lances registrados</small>
          </div>
          <strong className="ac-banner-value ac-safety-value">{money(dashboard.prizeCoverageCents)}</strong>
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
            <div className="ac-work-total"><strong>{queueCount?.toLocaleString("pt-BR") ?? "—"}</strong><span>itens</span></div>
          </div>

          <div className="ac-queue-tabs" role="tablist" aria-label="Tipo de trabalho">
            {queueItems.map(({ id, label, icon: Icon }) => {
              const count = id === "resgates" ? dashboard.pendingPayoutCount : id === "disputas" ? dashboard.liveDisputes.length : null;
              return (
                <button
                  className={`ac-queue-tab${activeQueue === id ? " active" : ""}`}
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={activeQueue === id}
                  aria-controls="ac-queue-panel"
                  onClick={() => selectQueue(id)}
                  data-testid={`action-center-queue-${id}`}
                >
                  <Icon size={14} />{label}<span className="ac-tab-count">{count?.toLocaleString("pt-BR") ?? "—"}</span>
                </button>
              );
            })}
          </div>

          <div className="ac-queue-controls">
            <label className="ac-search">
              <Search size={14} aria-hidden="true" />
              <input
                type="search"
                value={search}
                maxLength={100}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={`Buscar em ${selectedQueue?.label.toLocaleLowerCase("pt-BR") ?? "todas as filas"}`}
                aria-label="Buscar na fila"
                data-testid="input-action-center-search"
              />
              {search && <button className="ac-search-clear" type="button" aria-label="Limpar busca" onClick={() => setSearch("")}><X size={13} /></button>}
            </label>
            <div className="ac-control-actions">
              <button className="ac-small-button" type="button" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((open) => !open)} data-testid="button-action-center-filters">
                <Filter size={13} /> Filtros <ChevronDown size={12} />
              </button>
              <button className="ac-small-button" type="button" onClick={() => setOldestFirst((oldest) => !oldest)} aria-label={oldestFirst ? "Ordenar mais recentes primeiro" : "Ordenar mais antigos primeiro"}>
                <SlidersHorizontal size={13} /> {oldestFirst ? "Mais antigos" : "Mais recentes"}
              </button>
            </div>
          </div>

          {filtersOpen && (
            <div className="ac-filter-panel" role="group" aria-label="Filtros da fila">
              <span><Filter size={13} /> Estado</span>
              {filterOptions.length
                ? filterOptions.map((option) => (
                    <button className={`ac-filter-chip${queueFilter === option.value ? " active" : ""}`} key={option.value} type="button" aria-pressed={queueFilter === option.value} onClick={() => setQueueFilter(option.value)}>{option.label}</button>
                  ))
                : <span className="ac-filter-chip">Fonte de dados não conectada</span>}
            </div>
          )}

          <div id="ac-queue-panel" role="tabpanel" aria-label={activeCopy.title}>
            <div className="ac-table-head" aria-hidden="true">
              <span>Prioridade / item</span><span>Responsável</span><span>Próxima etapa</span><span>Prazo / relógio</span>
            </div>
            {queueLoading ? (
              <div className="ac-empty-queue"><span className="ac-empty-icon"><Clock3 size={21} /></span><h3>Carregando resgates</h3><p>Buscando solicitações reais na API administrativa.</p></div>
            ) : queueError ? (
              <div className="ac-empty-queue" role="alert"><span className="ac-empty-icon"><AlertTriangle size={21} /></span><h3>Não foi possível carregar a fila</h3><p>A API não retornou os resgates pendentes.</p><button className="ac-button" type="button" onClick={() => void payoutQuery.refetch()}>Tentar novamente</button></div>
            ) : searchMatches.length ? (
              <div className="ac-live-queue">
                {activeQueue === "resgates"
                  ? payouts.map((payout) => <PayoutQueueRow key={payout.id} payout={payout} />)
                  : liveDisputes.map((dispute) => <DisputeQueueRow key={dispute.id} dispute={dispute} />)}
              </div>
            ) : (
              <EmptyQueue
                title={activeCopy.iconLabel}
                description={activeCopy.description}
                icon={ActiveQueueIcon}
                waiting={activeCopy.empty}
                action={activeQueue === "resgates" || activeQueue === "disputas"
                  ? <p className="ac-empty-search-note">{search ? "Revise o termo ou os filtros aplicados." : "Os registros desta fila vêm diretamente da API administrativa."}</p>
                  : undefined}
              />
            )}
          </div>
          <div className="ac-queue-foot">
            <span><Search size={12} /> Selecione um item para abrir a tela de revisão correspondente.</span>
            <span>Relógios em tempo real <strong>{activeQueue === "disputas" && dashboard.currentDispute ? "na disputa" : "—"}</strong></span>
          </div>
        </section>

        <aside className="ac-side-stack" aria-label="Contexto operacional">
          <section className="ac-panel" aria-labelledby="ac-cash-title">
            <div className="ac-panel-head">
              <div className="ac-panel-title"><span className="ac-panel-icon"><CircleDollarSign size={17} /></span><div><h2 id="ac-cash-title">Caixa e obrigações</h2><p>Valores protegidos para decisões de pagamento</p></div></div>
              <Link className="ac-panel-action" href="/treasury" data-testid="link-action-center-treasury">Detalhes <ChevronRight size={13} /></Link>
            </div>
            <div className="ac-value-list">
              <ValuePair label="Caixa livre" note="Após obrigações" value={money(dashboard.treasury.freeCashCents)} />
              <ValuePair label="Créditos em carteira" value={money(dashboard.treasury.lockedWalletCents)} />
              <ValuePair label="Prêmios a pagar" value={money(dashboard.treasury.unpaidPrizeCents)} />
              <ValuePair label="Entradas confirmadas" value={money(dashboard.treasury.settledCashCents)} />
              <ValuePair label="Cobertura para prêmios" note="Parcela dos lances destinada a prêmios" value={money(dashboard.prizeCoverageCents)} highlight />
            </div>
            <div className="ac-coverage-note"><ShieldCheck size={13} /><span>Valores da API, sem incluir movimentações simuladas.</span></div>
          </section>

          <section className="ac-panel" aria-labelledby="ac-automation-title">
            <div className="ac-panel-head">
              <div className="ac-panel-title"><span className="ac-panel-icon"><Zap size={16} /></span><div><h2 id="ac-automation-title">Automação</h2><p>Contexto antes da intervenção manual</p></div></div>
              <Link className="ac-panel-action" href="/automation" data-testid="link-action-center-automation">Regras <ChevronRight size={13} /></Link>
            </div>
            <div className="ac-status-list">
              <MiniStatus label="Regras ativas" icon={Zap} value={enabledRules == null ? "—" : `${enabledRules} de 2`} />
              <MiniStatus label="Eventos registrados" icon={ArrowUpRight} value={eventsQuery.data?.total.toLocaleString("pt-BR") ?? (eventsQuery.isError ? "Indisponível" : "—")} />
              <MiniStatus label="Último evento" icon={AlertTriangle} value={latestEvent?.summary ?? (eventsQuery.isError ? "Indisponível" : "—")} />
            </div>
            <div className="ac-state-line"><Clock3 size={13} /> Estado da automação: {automationStatus ?? (automationQuery.isError ? "indisponível" : "verificando…")}</div>
          </section>
        </aside>
      </div>

      <section className="ac-below-grid" aria-label="Acompanhamento e governança">
        <section className="ac-panel" aria-labelledby="ac-service-title">
          <div className="ac-panel-head"><div className="ac-panel-title"><span className="ac-panel-icon"><Activity size={16} /></span><div><h2 id="ac-service-title">Saúde dos serviços</h2><p>Telemetria e atividade operacional</p></div></div><span className="ac-side-count">API</span></div>
          <div className="ac-status-list">
            <MiniStatus label="API administrativa" icon={Activity} value="Respondendo" />
            <MiniStatus label="Conexões ativas" icon={Users} value={dashboard.activeConnections.toLocaleString("pt-BR")} />
            <MiniStatus label="Visitantes hoje" icon={Activity} value={dashboard.visitorsToday.toLocaleString("pt-BR")} />
          </div>
          <div className="ac-state-line"><Clock3 size={13} /> Pagamentos e notificações sem telemetria própria.</div>
        </section>

        <section className="ac-panel" id="auditoria" aria-labelledby="ac-audit-title">
          <div className="ac-panel-head"><div className="ac-panel-title"><span className="ac-panel-icon"><FileClock size={16} /></span><div><h2 id="ac-audit-title">Auditoria recente</h2><p>Ações e alterações rastreáveis</p></div></div><span className="ac-side-count">—</span></div>
          <div className="ac-empty-compact"><span className="ac-empty-compact-icon"><ClipboardCheck size={15} /></span>O serviço administrativo ainda não fornece um registro de auditoria para esta tela.</div>
        </section>

        <section className="ac-panel" aria-labelledby="ac-alerts-title">
          <div className="ac-panel-head"><div className="ac-panel-title"><span className="ac-panel-icon"><Bell size={16} /></span><div><h2 id="ac-alerts-title">Alertas</h2><p>Sinais para ação imediata</p></div></div><strong className="ac-side-count">—</strong></div>
          <div className="ac-alert-placeholder"><AlertTriangle size={14} />A API não fornece uma fila de alertas; nenhum alerta é presumido.</div>
        </section>
      </section>

      <section className="ac-below-grid ac-governance-grid" aria-label="Controles de segurança">
        <section className="ac-panel ac-emergency" aria-labelledby="ac-emergency-title">
          <div className="ac-panel-head"><div className="ac-panel-title"><span className="ac-panel-icon"><ShieldAlert size={16} /></span><div><h2 id="ac-emergency-title">Controles de emergência</h2><p>Proteção adicional para situações críticas</p></div></div></div>
          <p className="ac-emergency-text">As ações de emergência não estão conectadas à API; permanecem bloqueadas.</p>
          <div className="ac-lock-controls">
            <button className="ac-locked-control" type="button" disabled><LockKeyhole size={12} /> Pausar pagamentos</button>
            <button className="ac-locked-control" type="button" disabled><LockKeyhole size={12} /> Suspender disputas</button>
          </div>
        </section>

        <section className="ac-panel" id="acessos" aria-labelledby="ac-access-title">
          <div className="ac-panel-head"><div className="ac-panel-title"><span className="ac-panel-icon"><LockKeyhole size={16} /></span><div><h2 id="ac-access-title">Acessos e permissões</h2><p>Escopo de ação por perfil</p></div></div><span className="ac-side-count">—</span></div>
          <div className="ac-empty-compact"><span className="ac-empty-compact-icon"><BadgeCheck size={15} /></span>A API ainda não oferece gerenciamento de perfis ou permissões administrativas.</div>
        </section>

        <section className="ac-panel" aria-labelledby="ac-payout-title">
          <div className="ac-panel-head"><div className="ac-panel-title"><span className="ac-panel-icon"><WalletCards size={16} /></span><div><h2 id="ac-payout-title">Fila de pagamentos</h2><p>Revisão, liberação e comprovantes</p></div></div></div>
          <div className="ac-value-list">
            <ValuePair label="Aguardando análise" value={payoutQuery.data?.requestedTotal.toLocaleString("pt-BR") ?? "—"} />
            <ValuePair label="Em análise" value={payoutQuery.data?.underReviewTotal.toLocaleString("pt-BR") ?? "—"} />
            <ValuePair label="Valor pendente" value={money(dashboard.pendingPayoutAmountCents)} highlight />
          </div>
          <Link className="ac-panel-action ac-payout-link" href="/payouts">Ir para resgates <ArrowRight size={13} /></Link>
        </section>
      </section>

      <footer className="ac-footer-note">
        <span><ShieldCheck size={12} /> Painel operacional conectado às fontes reais disponíveis.</span>
        <span>Indicadores sem uma fonte de dados permanecem como —</span>
      </footer>
    </>
  );
}

export default ActionCenterPage;
