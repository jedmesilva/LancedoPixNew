import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Route, Switch as RouteSwitch, useLocation, useParams, Router as WouterRouter } from 'wouter';
import {
  Activity, ArrowDownLeft, ArrowLeft, ArrowRight, Bot, Check, ChevronDown,
  CircleAlert, CircleCheck, CircleDollarSign, CircleX, FileSearch, KeyRound, LayoutDashboard,
  LogOut, RefreshCw, Search, Settings2, ShieldCheck, SlidersHorizontal, Wallet, X,
} from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch as ToggleSwitch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { AdminApiError } from './custom-fetch';
import {
  createAdminSession, endAdminSession, getAdminDashboard, getAdminDispute, getAdminSession,
  getAutomationConfig, listAdminDisputes, listAdminPayouts,
  listAdminTreasuryMovements,
  listAutomationAccounts, listAutomationEvents, updateAutomationConfig, recordAutomationFunding,
} from './generated/adminApi';
import type {
  AdminDashboard, AdminDisputeSummary, AdminPayout, AdminPayoutStatus,
  AdminTreasuryMovement, AutomationAccount,
  AutomationConfigInput, AutomationFundingInput,
} from './generated/adminApi.schemas';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, refetchInterval: 30_000, retry: 1, refetchOnWindowFocus: true } },
});
const SESSION_KEY = ['/api/admin/auth/session'];
const DASHBOARD_KEY = ['/api/admin/dashboard'];
const CONFIG_KEY = ['/api/admin/automation/config'];
const AUTOMATION_ACCOUNTS_KEY = ['/api/admin/automation/accounts'];
const EVENTS_KEY = ['/api/admin/automation/events'];
const money = (cents: number | null | undefined) => cents == null ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
const date = (value: string | null | undefined) => value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
const statusName: Record<string, string> = {
  scheduled: 'Agendada', live: 'Em andamento', paused: 'Pausada', ended: 'Encerrada',
  requested: 'Solicitado', under_review: 'Em análise', paid: 'Pago', rejected: 'Recusado',
};
const statusClass: Record<string, string> = { live: 'live', paid: 'paid', ended: 'ended', paused: 'paused', under_review: 'under_review', requested: 'requested', scheduled: 'scheduled', rejected: 'rejected' };
const errorMessage = (error: unknown) => {
  if (error instanceof AdminApiError) {
    const data = error.data as { error?: string } | null;
    const detail = data?.error || '';
    if (/admin(istrative)? key.*(missing|not configured)|key.*(missing|not configured)|chave.*(ausente|não configurada)/i.test(detail)) {
      return 'Chave administrativa ausente ou não configurada no servidor. Solicite a configuração ao responsável técnico.';
    }
    return detail || (error.status === 401 || error.status === 403 ? 'Sua sessão não está autenticada. Entre novamente.' : `Não foi possível concluir a solicitação (HTTP ${error.status}).`);
  }
  return 'Falha de conexão. Verifique sua rede e tente novamente.';
};

function Status({ value }: { value: string }) {
  return <span className={`status ${statusClass[value] || ''}`} data-testid={`status-${value}`}>{statusName[value] || value}</span>;
}
function LoadingPanel({ count = 3 }: { count?: number }) {
  return <div className="grid" aria-label="Carregando">{Array.from({ length: count }, (_, i) => <div className="skeleton-card" key={i} />)}</div>;
}
function QueryError({ error, retry }: { error: unknown; retry: () => void }) {
  return <div className="error-box" role="alert"><span>{errorMessage(error)}</span><button className="btn" onClick={retry} data-testid="button-retry"><RefreshCw size={14} /> Tentar novamente</button></div>;
}
function Empty({ title, text }: { title: string; text: string }) {
  return <div className="empty"><div className="empty-icon"><FileSearch size={19} /></div><strong>{title}</strong><p>{text}</p></div>;
}
function Heading({ eyebrow, title, description, children }: { eyebrow: string; title: string; description?: string; children?: ReactNode }) {
  return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1 className="page-title">{title}</h1>{description && <p className="page-desc">{description}</p>}</div>{children}</div>;
}
function Metric({ label, value, note }: { label: string; value: ReactNode; note: string }) {
  return <article className="prototype-kpi"><div className="ey">{label}</div><div className="prototype-kpi-value" data-testid={`metric-${label.toLowerCase().replaceAll(' ', '-')}`}>{value}</div><small>{note}</small></article>;
}
function DisputeRows({ items }: { items: AdminDisputeSummary[] }) {
  return <div className="record-list">{items.map(item => <DisputeRow item={item} key={item.id} />)}</div>;
}
function DisputeRow({ item }: { item: AdminDisputeSummary }) {
  const [expanded, setExpanded] = useState(false);
  const detail = useQuery({
    queryKey: ['/api/admin/disputes', item.id],
    queryFn: () => getAdminDispute(item.id),
    enabled: expanded,
    staleTime: 60_000,
  });
  return <article className={`dispute-record ${expanded ? 'expanded' : ''}`} data-testid={`card-dispute-${item.id}`}>
    <button type="button" className="record-trigger" aria-expanded={expanded} onClick={() => setExpanded(value => !value)} data-testid={`button-expand-dispute-${item.id}`}>
      <span className="record-copy"><strong>Disputa #{item.number}</strong><small>{date(item.createdAt)} · {item.bidsCount} lances · {item.winnerName || item.leaderName || 'Sem lances'}</small></span>
      <span className="record-trailing"><Status value={item.status} /><strong>{item.currentValueCents == null ? 'Sem lances' : money(item.currentValueCents)}</strong><ChevronDown size={16} className="record-chevron" /></span>
    </button>
    {expanded && <div className="record-expanded">
      <div className="record-facts">
        <span><small>Prêmio</small><strong>{money(item.prizeCents)}</strong></span>
        <span><small>Incremento mínimo</small><strong>{money(item.stepCents)}</strong></span>
        <span><small>Vencedor</small><strong>{item.winnerName || '—'}</strong></span>
      </div>
      {detail.isPending ? <div className="record-loading">Carregando lances registrados…</div>
        : detail.isError ? <QueryError error={detail.error} retry={() => void detail.refetch()} />
        : detail.data?.bids.length ? <div className="bid-record-list" aria-label={`Lances da disputa ${item.number}`}>
          {detail.data.bids.map(bid => <div className="bid-record" key={bid.id} data-testid={`row-bid-${bid.id}`}>
            <span><strong>{bid.bidderName}</strong>{bid.automated && <small>Participante automatizado</small>}</span>
            <span><strong>{money(bid.amountCents)}</strong><small>{date(bid.createdAt)}</small></span>
            <span className={`result-pill ${bid.result || ''}`}>{bid.result === 'won' ? 'Venceu' : bid.result === 'lost' ? 'Não venceu' : 'Em aberto'}</span>
          </div>)}
        </div> : <div className="record-loading">Nenhum lance registrado nesta disputa.</div>}
      <Link href={`/disputes/${encodeURIComponent(item.id)}`} className="table-link record-detail-link" data-testid={`link-dispute-${item.id}`}>Abrir detalhes completos <ArrowRight size={13} /></Link>
    </div>}
  </article>;
}
function AuthGate() {
  const queryClient = useQueryClient();
  const [key, setKey] = useState('');
  const [submitError, setSubmitError] = useState('');
  const keyRef = useRef('');
  const session = useQuery({ queryKey: SESSION_KEY, queryFn: getAdminSession, staleTime: 10_000, refetchInterval: 30_000, retry: false });
  const login = useMutation({
    mutationFn: () => createAdminSession({ key: keyRef.current }),
    onSuccess: result => {
      queryClient.setQueryData(SESSION_KEY, result);
      if (!result.authenticated) setSubmitError('A sessão não foi autenticada. Confira a chave e tente novamente.');
    },
    onError: error => {
      if (error instanceof AdminApiError && (error.status === 401 || error.status === 403)) {
        setSubmitError('A chave não foi aceita. Confira e tente novamente.');
      } else if (error instanceof AdminApiError && error.status === 503) {
        setSubmitError('O serviço de autenticação está indisponível ou sem chave administrativa configurada.');
      } else {
        setSubmitError(error instanceof AdminApiError ? `Não foi possível autenticar (HTTP ${error.status}). Tente novamente.` : 'Falha de conexão. Verifique sua rede e tente novamente.');
      }
    },
    onSettled: () => { keyRef.current = ''; setKey(''); },
  });
  const signOut = useMutation({
    mutationFn: endAdminSession,
    onSuccess: () => { queryClient.clear(); queryClient.setQueryData(SESSION_KEY, { authenticated: false }); },
  });
  const isAuthError = session.error instanceof AdminApiError && (session.error.status === 401 || session.error.status === 403);
  useEffect(() => { if (isAuthError) queryClient.setQueryData(SESSION_KEY, { authenticated: false }); }, [isAuthError, queryClient]);

  if (session.isPending) return <main className="auth-loading"><div className="skeleton-card" /><div className="skeleton-card" /><span>Verificando sessão segura…</span></main>;
  if (session.data?.authenticated) return <Shell signOut={() => signOut.mutate()} signOutBusy={signOut.isPending} />;
  if (session.isError && !isAuthError) return <main className="login-page">
    <div className="login-logo"><span className="brand-mark" aria-hidden="true">◆</span><span>Lance do Pix</span><span className="login-tag">ADMIN</span></div>
    <section className="login-card"><div className="lock-icon"><ShieldCheck size={20} /></div><p className="eyebrow">Conexão protegida</p><h1>Console indisponível</h1><p>Não foi possível verificar a sessão agora.</p><QueryError error={session.error} retry={() => void session.refetch()} /></section>
  </main>;
  return <main className="login-page">
    <div className="login-logo"><span className="brand-mark" aria-hidden="true">◆</span><span>Lance do Pix</span><span className="login-tag">ADMIN</span></div>
    <form className="login-card" onSubmit={event => { event.preventDefault(); setSubmitError(''); if (!key.trim()) { setSubmitError('Informe a chave de acesso para continuar.'); return; } keyRef.current = key; setKey(''); login.mutate(); }}>
      <div className="lock-icon"><KeyRound size={20} /></div><p className="eyebrow">Ambiente interno · acesso restrito</p><h1>Entrar no console</h1><p>Use sua chave privada de operador. Ela será enviada somente ao servidor.</p>
      <label className="input-label" htmlFor="admin-key">Chave de acesso</label><Input id="admin-key" data-testid="input-admin-key" type="password" autoComplete="off" value={key} maxLength={512} onChange={event => setKey(event.target.value)} placeholder="Insira sua chave privada" disabled={login.isPending} />
      {submitError && <div className="inline-error" role="alert">{submitError}</div>}
      <Button className="btn primary login-submit" type="submit" disabled={login.isPending} data-testid="button-admin-login">{login.isPending ? 'Validando acesso…' : 'Acessar console'} <ArrowRight size={15} /></Button>
      <div className="lock-note"><ShieldCheck size={15} /><span>A chave não é salva neste dispositivo. A sessão é mantida por cookie seguro HttpOnly.</span></div>
    </form>
  </main>;
}
const navItems = [
  { href: '/', label: 'Painel', icon: LayoutDashboard },
  { href: '/treasury', label: 'Caixa', icon: Wallet },
  { href: '/payouts', label: 'Resgates', icon: ArrowDownLeft },
  { href: '/disputes', label: 'Disputas', icon: FileSearch },
  { href: '/automation', label: 'Automação', icon: Bot },
];
function Shell({ signOut, signOutBusy }: { signOut: () => void; signOutBusy: boolean }) {
  const [path] = useLocation();
  const automation = useQuery({ queryKey: CONFIG_KEY, queryFn: getAutomationConfig });
  const activeLabel = navItems.find(item => item.href === (path.startsWith('/disputes') ? '/disputes' : path.startsWith('/automation') ? '/automation' : path))?.label || 'Painel';
  return <div className="shell">
    <header className="topbar">
      <div className="topbar-inner">
        <Link href="/" className="brand" data-testid="link-admin-home">
          <span className="brand-copy"><span className="brand-name">Lance do Pix</span></span>
          <span className="login-tag">ADMIN</span>
        </Link>
        <div className="topbar-right">
          <span className={`automation-indicator ${automation.data?.enabled ? 'is-active' : ''}`} data-testid="header-automation-status"><i />Automação {automation.data?.enabled ? 'ativa' : automation.isError ? 'indisponível' : 'desativada'}</span>
          <button className="btn logout" onClick={signOut} disabled={signOutBusy} data-testid="button-admin-logout"><LogOut size={15} />{signOutBusy ? 'Saindo…' : 'Sair'}</button>
        </div>
      </div>
    </header>
    <main className="content">
      <nav className="tabs" aria-label="Navegação principal">
        {navItems.map(item => {
          const active = item.href === '/' ? path === '/' : path.startsWith(item.href);
          return <Link key={item.href} href={item.href} className={`navlink ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined} data-testid={`nav-${item.label.toLowerCase().replaceAll(' ', '-')}`}>{item.label}</Link>;
        })}
      </nav>
      <div className="route-content" data-page={activeLabel}><RouteSwitch>
        <Route path="/" component={Overview} />
        <Route path="/disputes" component={DisputesPage} />
        <Route path="/disputes/:id" component={DisputeDetailPage} />
        <Route path="/payouts" component={PayoutsPage} />
        <Route path="/treasury" component={TreasuryPage} />
         <Route path="/automation/settings" component={AutomationSettings} />
        <Route path="/automation" component={AutomationPage} />
        <Route component={NotFound} />
      </RouteSwitch></div>
    </main>
  </div>;
}
function Overview() {
  const query = useQuery({ queryKey: DASHBOARD_KEY, queryFn: getAdminDashboard });
  const dashboard = query.data as AdminDashboard | undefined;
  if (query.isPending) return <LoadingPanel />;
  if (query.isError || !dashboard) return <QueryError error={query.error} retry={() => void query.refetch()} />;
  const treasury = dashboard.treasury;
  const activeBids = dashboard.liveDisputes.reduce((sum, dispute) => sum + dispute.bidsCount, 0);
  const livePrizeTotal = dashboard.liveDisputes.reduce((sum, dispute) => sum + dispute.prizeCents, 0);
  const bidVolume = dashboard.platformRevenueCents + dashboard.prizeCoverageCents;
  return <div className="prototype-dashboard appear">
    <section className="prototype-section" data-testid="overview-system">
      <div className="prototype-section-head"><p className="ey">Sistema</p><button className="prototype-refresh" onClick={() => void query.refetch()} data-testid="button-refresh-dashboard"><RefreshCw size={14} /> Atualizar</button></div>
      <div className="prototype-kpis">
        <Metric label="Servidor" value={<span className="prototype-status success"><i />No ar</span>} note="API respondeu com dados atuais" />
        <Metric label="Online agora" value={dashboard.activeConnections.toLocaleString('pt-BR')} note="Acompanhando as disputas" />
        <Metric label="Visitantes" value={dashboard.totalVisitors.toLocaleString('pt-BR')} note={`${dashboard.visitorsToday.toLocaleString('pt-BR')} hoje`} />
      </div>
    </section>

    <section className="prototype-section" data-testid="overview-current-dispute">
      <p className="ey">Agora</p>
      <div className="prototype-kpis">
        <Metric label="Disputas em andamento" value={dashboard.liveDisputes.length.toLocaleString('pt-BR')} note={`Prêmios em disputa: ${money(livePrizeTotal)}`} />
        <Metric label="Lances em andamento" value={activeBids.toLocaleString('pt-BR')} note="Lances registrados nas disputas ativas" />
      </div>
      <div className="prototype-record-list">
        {dashboard.liveDisputes.map(dispute => <Link key={dispute.id} href={`/disputes/${encodeURIComponent(dispute.id)}`} className="prototype-card prototype-live-card" data-testid={`link-live-dispute-${dispute.id}`}>
          <div><strong>{money(dispute.prizeCents)}</strong><small>Disputa #{dispute.number} · {dispute.leaderName ? `${money(dispute.currentValueCents)} · ${dispute.leaderName}` : 'Sem lances'} · {dispute.bidsCount} lances</small></div>
          <Status value={dispute.status} />
        </Link>)}
        {!dashboard.liveDisputes.length && <Empty title="Nenhuma disputa em andamento" text="A API não informou uma disputa ativa neste momento." />}
      </div>
    </section>

    <section className="prototype-section" data-testid="overview-cash">
      <div className="prototype-section-head"><p className="ey">Caixa</p><Link href="/treasury" className="prototype-text-link" data-testid="link-treasury-details">Ver movimentações <ArrowRight size={13} /></Link></div>
      <div className="prototype-card prototype-cash-card">
        <div className="ey">Entradas brutas confirmadas</div>
        <strong className="prototype-cash-total" data-testid="metric-gross-cash">{money(treasury.settledCashCents)}</strong>
        <small className="prototype-note">Recargas, aportes e outras entradas recebidas; sem simulações.</small>
        <div className="prototype-cash-grid">
          <LedgerRow title="Caixa livre após obrigações" detail="Disponível depois de saídas, carteiras e valores reservados" value={treasury.freeCashCents} tone="positive" />
          <LedgerRow title="Créditos ainda nas carteiras" detail="Saldo não usado pelos usuários" value={treasury.lockedWalletCents} />
          <LedgerRow title="Total consumido em lances" detail="Soma das parcelas da plataforma e dos prêmios" value={bidVolume} />
          <LedgerRow title="Prêmios ainda não pagos" detail="Obrigações de prêmio em aberto" value={treasury.unpaidPrizeCents} />
        </div>
        <div className="prototype-allocation">
          <span><small>Receita da plataforma</small><strong>{money(dashboard.platformRevenueCents)}</strong></span>
          <span><small>Cobertura para prêmios</small><strong>{money(dashboard.prizeCoverageCents)}</strong></span>
        </div>
        <p className="prototype-note">Os lances são repartidos por disputa; a configuração padrão destina 90% à plataforma e 10% aos prêmios.</p>
      </div>
    </section>

    <section className="prototype-section" data-testid="overview-payouts">
      <div className="prototype-section-head"><p className="ey">Resgates</p><Link href="/payouts" className="prototype-text-link" data-testid="link-pending-payouts">Abrir resgates <ArrowRight size={13} /></Link></div>
      <div className="prototype-kpis">
        <Metric label="A pagar" value={money(dashboard.pendingPayoutAmountCents)} note={`${dashboard.pendingPayoutCount.toLocaleString('pt-BR')} na fila`} />
        <Metric label="Pagos" value={money(dashboard.paidPayoutAmountCents)} note={`${dashboard.paidPayoutCount.toLocaleString('pt-BR')} realizados`} />
      </div>
    </section>

    <section className="prototype-section" data-testid="overview-history">
      <div className="prototype-section-head"><p className="ey">Histórico</p><Link href="/disputes" className="prototype-text-link" data-testid="link-disputes-search">Ver disputas <ArrowRight size={13} /></Link></div>
      <div className="prototype-kpis">
        <Metric label="Disputas realizadas" value={dashboard.historyDisputeCount.toLocaleString('pt-BR')} note={`${dashboard.historyBidCount.toLocaleString('pt-BR')} lances registrados`} />
        <Metric label="Receita da plataforma" value={money(dashboard.platformRevenueCents)} note="Parcela registrada nos lances" />
        <Metric label="Cobertura para prêmios" value={money(dashboard.prizeCoverageCents)} note="Parcela destinada aos prêmios" />
      </div>
    </section>
  </div>;
}
function DisputesPage() {
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 20;
  const query = useQuery({ queryKey: ['/api/admin/disputes', { q, limit, offset }], queryFn: () => listAdminDisputes({ q: q || undefined, limit, offset }) });
  const total = query.data?.total || 0;
  return <>
    <section className="prototype-section">
      <div className="prototype-section-head"><p className="ey">Histórico de disputas</p><span className="prototype-note">{total.toLocaleString('pt-BR')} registros</span></div>
      <form className="prototype-search" onSubmit={event => { event.preventDefault(); setOffset(0); setQ(input.trim()); }}>
        <Search size={16} aria-hidden="true" />
        <Input aria-label="Pesquisar disputas" data-testid="input-dispute-search" placeholder="Buscar por nº, prêmio, usuário ou bot" maxLength={100} value={input} onChange={event => setInput(event.target.value)} />
        {q && <button type="button" className="prototype-clear" onClick={() => { setInput(''); setQ(''); setOffset(0); }} data-testid="button-clear-dispute-search"><X size={15} /> Limpar</button>}
      </form>
    </section>
    {query.isPending ? <LoadingPanel /> : query.isError ? <QueryError error={query.error} retry={() => void query.refetch()} /> : query.data?.items.length ? <><DisputeRows items={query.data.items} /><Pagination offset={offset} limit={limit} total={total} setOffset={setOffset} /></> : <Empty title="Nenhuma disputa encontrada" text={q ? 'Tente outro termo de pesquisa.' : 'Ainda não há disputas disponíveis no histórico.'} />}
  </>;
}
function Pagination({ offset, limit, total, setOffset }: { offset: number; limit: number; total: number; setOffset: (n: number) => void }) {
  return <div className="pagination"><span>{total.toLocaleString('pt-BR')} registros</span><div><button className="btn" onClick={() => setOffset(Math.max(0, offset - limit))} disabled={offset === 0} data-testid="button-page-prev"><ArrowLeft size={14} /> Anterior</button><button className="btn" onClick={() => setOffset(offset + limit)} disabled={offset + limit >= total} data-testid="button-page-next">Próxima <ArrowRight size={14} /></button></div></div>;
}
function DisputeDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const decoded = decodeURIComponent(id);
  const query = useQuery({ queryKey: ['/api/admin/disputes', decoded], queryFn: () => getAdminDispute(decoded), enabled: !!decoded });
  if (query.isPending) return <><Link href="/disputes" className="back-link" data-testid="link-back-disputes"><ArrowLeft size={14} /> Voltar às disputas</Link><div className="spacer" /><LoadingPanel /></>;
  if (query.isError || !query.data) return <><Link href="/disputes" className="back-link" data-testid="link-back-disputes"><ArrowLeft size={14} /> Voltar às disputas</Link><div className="spacer" /><QueryError error={query.error} retry={() => void query.refetch()} /></>;
  const dispute = query.data.dispute;
  return <div className="appear">
    <Link href="/disputes" className="back-link" data-testid="link-back-disputes"><ArrowLeft size={14} /> Voltar às disputas</Link>
    <div className="spacer" />
    <Heading eyebrow="Histórico de disputas" title={`Disputa #${dispute.number}`} description={`Criada em ${date(dispute.createdAt)}`}><Status value={dispute.status} /></Heading>
    <article className="dispute-record expanded dispute-detail-record">
      <div className="record-expanded">
        <div className="record-facts dispute-detail-facts">
          <span><small>Prêmio</small><strong>{money(dispute.prizeCents)}</strong></span>
          <span><small>Lance atual</small><strong>{dispute.currentValueCents == null ? 'Sem lances' : money(dispute.currentValueCents)}</strong></span>
          <span><small>Incremento mínimo</small><strong>{money(dispute.stepCents)}</strong></span>
          <span><small>Total de lances</small><strong>{dispute.bidsCount.toLocaleString('pt-BR')}</strong></span>
          <span><small>Início</small><strong>{date(dispute.startedAt)}</strong></span>
          <span><small>Encerramento</small><strong>{date(dispute.endedAt)}</strong></span>
          <span><small>Vencedor</small><strong>{dispute.winnerName || '—'}</strong></span>
        </div>
        <div className="section-head dispute-detail-heading"><div><p className="eyebrow">Histórico público</p><h2 className="section-title">Lances registrados</h2></div><span className="section-kicker">{query.data.bids.length} eventos</span></div>
        {query.data.bids.length ? <div className="bid-record-list">
          {query.data.bids.map(bid => <div className="bid-record" key={bid.id} data-testid={`row-bid-${bid.id}`}>
            <span><strong>{bid.automated && <Bot size={13} aria-label="Participante automatizado" />} {bid.bidderName}</strong>{bid.automated && <small>Participante automatizado</small>}</span>
            <span><strong>{money(bid.amountCents)}</strong><small>{date(bid.createdAt)}</small></span>
            <span className={`result-pill ${bid.result || ''}`}>{bid.result === 'won' ? 'Venceu' : bid.result === 'lost' ? 'Não venceu' : 'Em aberto'}</span>
          </div>)}
        </div> : <Empty title="Sem lances registrados" text="A API não retornou lances para esta disputa." />}
      </div>
    </article>
  </div>;
}
function PayoutsPage() {
  const [status, setStatus] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 20;
  const query = useQuery({ queryKey: ['/api/admin/payouts', { status, limit, offset }], queryFn: () => listAdminPayouts({ status: (status || undefined) as AdminPayoutStatus | undefined, limit, offset }) });
  const total = query.data?.total || 0;
  return <>
    <section className="prototype-section" aria-label="Filtrar resgates por status">
      <div className="prototype-section-head"><p className="ey">Resgates</p><span className="prototype-note">{total.toLocaleString('pt-BR')} solicitações</span></div>
      <div className="prototype-chips" role="group" aria-label="Status dos resgates">
        {[['', 'Todos'], ['requested', 'Solicitado'], ['under_review', 'Em análise'], ['paid', 'Pago'], ['rejected', 'Recusado']].map(([value, label]) =>
          <button key={value || 'all'} type="button" aria-pressed={status === value} onClick={() => { setStatus(value); setOffset(0); }} data-testid={`filter-payout-${value || 'all'}`}>{label}</button>,
        )}
      </div>
    </section>
    {query.isPending ? <LoadingPanel /> : query.isError ? <QueryError error={query.error} retry={() => void query.refetch()} /> : query.data?.items.length ? <><PayoutRows items={query.data.items} /><Pagination offset={offset} limit={limit} total={total} setOffset={setOffset} /></> : <Empty title="Fila vazia" text="A API não retornou solicitações com este filtro." />}
  </>;
}
function PayoutRows({ items }: { items: AdminPayout[] }) {
  const keyNames: Record<string, string> = { cpf: 'CPF', email: 'E-mail', phone: 'Telefone', random: 'Aleatória' };
  return <div className="prototype-record-list">{items.map(payout => <article className="prototype-card prototype-payout" key={payout.id} data-testid={`card-payout-${payout.id}`}>
    <div className="prototype-record-top">
      <div><strong>{money(payout.amountCents)}</strong><small>{payout.userName} · {date(payout.requestedAt)}</small></div>
      <Status value={payout.status} />
    </div>
    <div className="prototype-record-detail"><span>Resgate · {keyNames[payout.pixKeyType] || payout.pixKeyType}</span><span>Prêmio {money(payout.prizeCents)} · Bônus {money(payout.bonusCents)}</span></div>
    <small className="prototype-note">Atualizado {date(payout.updatedAt)}</small>
  </article>)}</div>;
}
function TreasuryPage() {
  const [filter, setFilter] = useState<'all' | AdminTreasuryMovement['category']>('all');
  const dashboardQuery = useQuery({ queryKey: DASHBOARD_KEY, queryFn: getAdminDashboard });
  const movementQuery = useQuery({
    queryKey: ['/api/admin/treasury/movements', { limit: 50, offset: 0 }],
    queryFn: () => listAdminTreasuryMovements({ limit: 50, offset: 0 }),
  });
  if (dashboardQuery.isPending || movementQuery.isPending) return <LoadingPanel />;
  if (dashboardQuery.isError || !dashboardQuery.data) return <QueryError error={dashboardQuery.error} retry={() => void dashboardQuery.refetch()} />;
  const dashboard = dashboardQuery.data;
  const data = dashboard.treasury;
  const bidVolume = dashboard.platformRevenueCents + dashboard.prizeCoverageCents;
  const categoryLabels: Record<AdminTreasuryMovement['category'], string> = {
    topup: 'Recarga de créditos',
    contribution: 'Aporte de capital',
    payout: 'Prêmio ou resgate pago',
    refund: 'Reembolso',
    fee: 'Tarifa de processamento',
    ad_revenue: 'Receita publicitária',
  };
  const filters: Array<{ value: 'all' | AdminTreasuryMovement['category']; label: string }> = [
    { value: 'all', label: 'Todas' },
    { value: 'topup', label: 'Recargas' },
    { value: 'contribution', label: 'Aportes' },
    { value: 'payout', label: 'Prêmios' },
    { value: 'refund', label: 'Reembolsos' },
    { value: 'fee', label: 'Tarifas' },
    { value: 'ad_revenue', label: 'Publicidade' },
  ];
  const movements = (movementQuery.data?.items ?? []).filter(item => filter === 'all' || item.category === filter);
  return <div className="prototype-dashboard appear">
    <section className="prototype-section" data-testid="treasury-summary">
      <div className="prototype-section-head"><p className="ey">Caixa</p><button className="prototype-refresh" onClick={() => { void dashboardQuery.refetch(); void movementQuery.refetch(); }} data-testid="button-refresh-treasury"><RefreshCw size={14} /> Atualizar</button></div>
      <div className="prototype-card prototype-cash-card">
        <div className="ey">Entradas brutas confirmadas</div>
        <strong className="prototype-cash-total">{money(data.settledCashCents)}</strong>
        <small className="prototype-note">Recargas, aportes e outras entradas recebidas; sem simulações.</small>
        <div className="prototype-cash-grid">
          <LedgerRow title="Saldo não utilizado nas carteiras" detail="Créditos que ainda pertencem aos usuários" value={data.lockedWalletCents} />
          <LedgerRow title="Total consumido em lances" detail="Total dos lances registrados, sem simulações" value={bidVolume} />
          <LedgerRow title="Receita da plataforma" detail="Parcela da plataforma conforme a divisão registrada" value={dashboard.platformRevenueCents} />
          <LedgerRow title="Cobertura destinada a prêmios" detail="Parcela dos lances reservada para financiar prêmios" value={dashboard.prizeCoverageCents} />
          <LedgerRow title="Prêmios ainda não pagos" detail="Obrigações abertas, pelo valor integral dos prêmios" value={data.unpaidPrizeCents} />
          <LedgerRow title="Saídas de caixa pagas" detail="Resgates, reembolsos e tarifas liquidados" value={data.cashOutflowsCents} />
          <LedgerRow title="Bônus reservados" detail="Valores já comprometidos com bônus" value={data.reservedBonusCents} />
        </div>
        <div className="prototype-ledger-total"><span>Caixa livre após obrigações</span><strong>{money(data.freeCashCents)}</strong></div>
        <p className="prototype-note">Caixa livre = entradas confirmadas − saídas pagas − saldo em carteiras − prêmios em aberto − bônus reservados.</p>
      </div>
    </section>
    <section className="prototype-section" data-testid="treasury-movements">
      <div className="prototype-section-head"><p className="ey">Movimentações</p><span className="prototype-note">{movementQuery.data?.total ?? 0} registros · últimos 50</span></div>
      <div className="prototype-chips" role="group" aria-label="Filtrar movimentações">
        {filters.map(item => <button key={item.value} type="button" aria-pressed={filter === item.value} onClick={() => setFilter(item.value)} data-testid={`filter-treasury-${item.value}`}>{item.label}</button>)}
      </div>
      {movementQuery.isError ? <QueryError error={movementQuery.error} retry={() => void movementQuery.refetch()} />
        : movements.length ? <div className="prototype-record-list">{movements.map(item => <article className="prototype-card prototype-movement" key={item.id} data-testid={`row-treasury-movement-${item.id}`}>
          <div><strong>{categoryLabels[item.category]}</strong><small>{item.userName || item.note || item.reference || 'Movimentação registrada'} · {date(item.createdAt)}</small></div>
          <div className="prototype-movement-value"><strong className={item.amountCents < 0 ? 'negative' : 'positive'}>{item.amountCents < 0 ? '−' : '+'}{money(Math.abs(item.amountCents))}</strong><small>Caixa {money(item.runningBalanceCents)}</small></div>
        </article>)}</div>
        : <Empty title="Sem movimentações" text="Não há movimentações para este filtro no período exibido." />}
    </section>
  </div>;
}
function LedgerRow({ title, detail, value, tone }: { title: string; detail: string; value: number; tone?: string }) {
  return <div className="ledger-row"><div><strong>{title}</strong><small>{detail}</small></div><span className={tone || ''}>{money(value)}</span></div>;
}
const automationModes: Array<{ value: AutomationConfigInput["mode"]; label: string; detail: string }> = [
  { value: "counterbids_only", label: "Só contralances", detail: "Responde aos lances de outros participantes." },
  { value: "bids_and_counterbids", label: "Lances e contralances", detail: "Abre disputas sem lance e responde a outros participantes." },
  { value: "bids_only", label: "Só lances", detail: "Abre disputas sem lance, sem responder a outros participantes." },
];
const bidTriggerModes: Array<{ value: AutomationConfigInput["bidTriggerMode"]; label: string; detail: string }> = [
  { value: "on_outbid", label: "Quando for superado", detail: "Reage ao lance maior de outro participante após o intervalo definido." },
  { value: "at_fixed_time", label: "Em tempo fixo", detail: "Espera o cronômetro chegar ao tempo escolhido; se o bot não liderar, pode lançar novamente após cada reinício." },
];
const defaultConfig: AutomationConfigInput = {
  enabled: false,
  mode: "counterbids_only",
  bidTriggerMode: "on_outbid",
  botUserId: null,
  maxBidCents: 0,
  perDisputeLimitCents: 0,
  dailyLimitCents: 0,
  maxBidsPerDispute: 0,
  minimumSecondsRemaining: 1,
  minimumDelaySeconds: 1,
  operatorRules: {
    status: "desativada",
    opening: { on: false, trigger: "immediate", seconds: 1, multiplier: 1 },
    counter: { on: true, trigger: "immediate", seconds: 1, multiplier: 1 },
    limits: {
      bidsPerDispute: 0,
      bidsPerDay: 0,
      disputesPerDay: 0,
      maxBidCents: 0,
      perDisputeCents: 0,
      dailySpendCents: 0,
    },
  },
};
function toAutomationInput(
  input: AutomationConfigInput,
  status: AutomationConfigInput["operatorRules"]["status"],
): AutomationConfigInput {
  const trigger =
    input.bidTriggerMode === "at_fixed_time" ? "final" : "immediate";
  return {
    ...input,
    enabled: status === "ativa",
    operatorRules: {
      ...input.operatorRules,
      status,
      opening: {
        ...input.operatorRules.opening,
        on: input.mode !== "counterbids_only",
        trigger,
        seconds: input.minimumSecondsRemaining,
      },
      counter: {
        ...input.operatorRules.counter,
        on: input.mode !== "bids_only",
        trigger,
        seconds: input.minimumSecondsRemaining,
      },
      limits: {
        ...input.operatorRules.limits,
        bidsPerDispute: input.maxBidsPerDispute,
        maxBidCents: input.maxBidCents,
        perDisputeCents: input.perDisputeLimitCents,
        dailySpendCents: input.dailyLimitCents,
      },
    },
  };
}
const eventNames: Record<string, string> = { bid: "Lance automático", funding: "Aporte confirmado", config_updated: "Configuração alterada", enabled: "Automação ativada", disabled: "Automação desativada", blocked: "Execução bloqueada" };
function EventRows({ items, testPrefix = "event" }: { items: import("./generated/adminApi.schemas").AutomationEvent[]; testPrefix?: string }) {
  return <div className="event-list">{items.map(event => {
    const isBid = event.eventType === "bid";
    const Icon = isBid ? CircleCheck : event.eventType === "blocked" ? CircleX : event.eventType === "funding" ? CircleDollarSign : Activity;
    return <article className={`event-row event-${event.eventType}`} key={event.id} data-testid={`${testPrefix}-row-${event.id}`}>
      <div className="event-mark"><Icon size={15} /></div><div className="event-body">
        <div className="event-title"><strong>{event.summary || eventNames[event.eventType]}</strong><span className={`event-type ${event.eventType}`}>{eventNames[event.eventType] || event.eventType}</span></div>
        <div className="event-text">{event.disputeNumber != null && <span>Disputa #{event.disputeNumber} · </span>}{event.amountCents != null && <span>{money(event.amountCents)} · </span>}<span>{date(event.createdAt)}</span></div>
      </div>
      {isBid && <span className="bid-success"><Check size={12} /> Registrado</span>}
    </article>;
  })}</div>;
}
function AutomationPage() {
  const [eventsOffset, setEventsOffset] = useState(0);
  const eventsLimit = 100;
  const configQuery = useQuery({ queryKey: CONFIG_KEY, queryFn: getAutomationConfig });
  const accountsQuery = useQuery({ queryKey: AUTOMATION_ACCOUNTS_KEY, queryFn: listAutomationAccounts });
  const eventsQueryKey = [...EVENTS_KEY, { limit: eventsLimit, offset: eventsOffset }];
  const eventsQuery = useQuery({ queryKey: eventsQueryKey, queryFn: () => listAutomationEvents({ limit: eventsLimit, offset: eventsOffset }) });
  if (configQuery.isPending) return <><Heading eyebrow="Participante automatizado" title="Automação" description="Acompanhe os lances e a atividade do participante automatizado." /><LoadingPanel /></>;
  if (configQuery.isError || !configQuery.data) return <><Heading eyebrow="Participante automatizado" title="Automação" /><QueryError error={configQuery.error} retry={() => void configQuery.refetch()} /></>;
  const config = configQuery.data;
  const account = accountsQuery.data?.items.find(item => item.id === config.botUserId);
  const wallet = account?.walletBalanceCents ?? config.botWalletBalanceCents;
  const bids = eventsQuery.data?.items.filter(event => event.eventType === "bid") ?? [];
  const events = eventsQuery.data?.items ?? [];
  return <div className="automation-page appear">
    <Heading eyebrow="Participante automatizado" title="Automação" description="Lances registrados e eventos operacionais, em um só lugar.">
      <Link href="/automation/settings" className="btn primary" data-testid="link-automation-settings"><Settings2 size={15} /> Configurações</Link>
    </Heading>
    {configQuery.isFetching && <div className="refresh-note"><span className="pulse-dot" /> Atualizando dados de automação…</div>}
    <section className={`automation-status-card ${config.enabled ? "is-running" : ""}`} data-testid="automation-status-card">
      <div className="status-orbit" aria-hidden="true" />
      <div className="automation-status-main">
        <div className="automation-status-label"><span className={`status-light ${config.enabled ? "on" : ""}`} /> CONTROLE DO PARTICIPANTE</div>
        <div className="automation-status-head"><h2>{config.enabled ? "Automação ativa" : "Automação desativada"}</h2><span className={`state-chip ${config.enabled ? "state-on" : ""}`}><i />{config.enabled ? "Em execução" : "Pausada"}</span></div>
        <p>Os lances são feitos publicamente pela conta selecionada. O saldo dessa carteira é sempre o teto absoluto de gasto.</p>
      </div>
      <div className="automation-account">
        <div className="account-avatar"><Bot size={19} /></div>
        <div className="account-copy"><span>CONTA E CARTEIRA</span><strong data-testid="automation-account-name">{account?.publicName || config.botName || "Nenhuma conta selecionada"}</strong><small>Saldo real disponível</small></div>
        <strong className="account-balance" data-testid="automation-wallet-balance">{money(wallet)}</strong>
      </div>
      <Link href="/automation/settings" className="status-settings-link" data-testid="link-status-settings">Gerenciar automação <ArrowRight size={15} /></Link>
    </section>
    {accountsQuery.isError && <QueryError error={accountsQuery.error} retry={() => void accountsQuery.refetch()} />}
    <div className="automation-history-grid">
      <section className="panel history-panel bid-history" data-testid="automated-bid-history">
        <div className="history-heading"><div><p className="eyebrow">Execuções</p><h2 className="section-title">Lances automáticos</h2><p className="history-subtitle">Apenas eventos de lance registrados.</p></div><span className="history-count">{eventsQuery.data ? bids.length : "—"} <small>nesta página</small></span></div>
        {eventsQuery.isPending ? <div className="event-skeleton"><div className="skeleton" /><div className="skeleton" /><div className="skeleton" /></div>
          : eventsQuery.isError ? <QueryError error={eventsQuery.error} retry={() => void eventsQuery.refetch()} />
          : bids.length ? <EventRows items={bids} testPrefix="bid" />
          : <Empty title="Nenhum lance automático" text="Os lances aparecerão aqui depois de serem registrados pela automação." />}
      </section>
      <section className="panel history-panel activity-history" data-testid="automation-activity-history">
        <div className="history-heading"><div><p className="eyebrow">Registro operacional</p><h2 className="section-title">Atividade da automação</h2><p className="history-subtitle">Execuções, bloqueios, aportes e alterações.</p></div><span className="history-count">{eventsQuery.data?.total ?? "—"} <small>eventos</small></span></div>
        {eventsQuery.isPending ? <div className="event-skeleton"><div className="skeleton" /><div className="skeleton" /><div className="skeleton" /></div>
          : eventsQuery.isError ? <QueryError error={eventsQuery.error} retry={() => void eventsQuery.refetch()} />
          : events.length ? <EventRows items={events} testPrefix="activity" />
          : <Empty title="Sem atividade registrada" text="Eventos de status, configuração, financiamento e execução aparecerão neste histórico." />}
      </section>
    </div>
    {eventsQuery.data && <div className="automation-event-pagination" data-testid="automation-event-pagination">
      <span>{eventsQuery.data.total ? `${eventsOffset + 1}–${eventsOffset + events.length} de ${eventsQuery.data.total} eventos` : "0 eventos"}</span>
      <div>
        <button className="btn" disabled={eventsOffset === 0 || eventsQuery.isFetching} onClick={() => setEventsOffset(offset => Math.max(0, offset - eventsLimit))} data-testid="button-events-prev"><ArrowLeft size={14} /> Anterior</button>
        <button className="btn" disabled={eventsOffset + eventsLimit >= eventsQuery.data.total || eventsQuery.isFetching} onClick={() => setEventsOffset(offset => offset + eventsLimit)} data-testid="button-events-next">Próxima <ArrowRight size={14} /></button>
      </div>
    </div>}
  </div>;
}
function AutomationSettings() {
  const queryClient = useQueryClient();
  const configQuery = useQuery({ queryKey: CONFIG_KEY, queryFn: getAutomationConfig });
  const accountsQuery = useQuery({ queryKey: AUTOMATION_ACCOUNTS_KEY, queryFn: listAutomationAccounts });
  const [form, setForm] = useState<AutomationConfigInput>(defaultConfig);
  const [dirty, setDirty] = useState(false);
  const [fundingAmount, setFundingAmount] = useState("");
  const [receipt, setReceipt] = useState("");
  const [cashConfirmed, setCashConfirmed] = useState(false);
  const [fundingResult, setFundingResult] = useState("");
  const [formError, setFormError] = useState("");
  const [statusError, setStatusError] = useState("");
  const [statusFeedback, setStatusFeedback] = useState("");
  const [saveFeedback, setSaveFeedback] = useState("");
  useEffect(() => {
    const data = configQuery.data;
    if (data && !dirty) {
      setForm({ enabled: data.enabled, mode: data.mode, bidTriggerMode: data.bidTriggerMode, botUserId: data.botUserId, maxBidCents: data.maxBidCents, perDisputeLimitCents: data.perDisputeLimitCents, dailyLimitCents: data.dailyLimitCents, maxBidsPerDispute: data.maxBidsPerDispute, minimumSecondsRemaining: data.minimumSecondsRemaining, minimumDelaySeconds: data.minimumDelaySeconds, operatorRules: data.operatorRules });
    }
  }, [configQuery.data, dirty]);
  const update = useMutation({
    mutationFn: (input: AutomationConfigInput) => updateAutomationConfig(input),
    onSuccess: data => {
      queryClient.setQueryData(CONFIG_KEY, data);
      setForm({ enabled: data.enabled, mode: data.mode, bidTriggerMode: data.bidTriggerMode, botUserId: data.botUserId, maxBidCents: data.maxBidCents, perDisputeLimitCents: data.perDisputeLimitCents, dailyLimitCents: data.dailyLimitCents, maxBidsPerDispute: data.maxBidsPerDispute, minimumSecondsRemaining: data.minimumSecondsRemaining, minimumDelaySeconds: data.minimumDelaySeconds, operatorRules: data.operatorRules });
      setDirty(false); setFormError(""); setSaveFeedback("Regras salvas. O estado atual da automação foi mantido.");
      void queryClient.invalidateQueries({ queryKey: EVENTS_KEY }); void queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY });
    },
    onError: error => setFormError(errorMessage(error)),
  });
  const statusUpdate = useMutation({
    mutationFn: (input: AutomationConfigInput) => updateAutomationConfig(input),
    onSuccess: (data, input) => {
      queryClient.setQueryData(CONFIG_KEY, data);
      if (input.enabled) {
        setForm({ enabled: data.enabled, mode: data.mode, bidTriggerMode: data.bidTriggerMode, botUserId: data.botUserId, maxBidCents: data.maxBidCents, perDisputeLimitCents: data.perDisputeLimitCents, dailyLimitCents: data.dailyLimitCents, maxBidsPerDispute: data.maxBidsPerDispute, minimumSecondsRemaining: data.minimumSecondsRemaining, minimumDelaySeconds: data.minimumDelaySeconds, operatorRules: data.operatorRules });
        setDirty(false);
        setStatusFeedback("Automação ativada com as regras exibidas.");
      } else {
        setForm(previous => ({ ...previous, enabled: false }));
        setStatusFeedback("Automação pausada. Rascunhos não salvos foram mantidos.");
      }
      setStatusError(""); setSaveFeedback("");
      void queryClient.invalidateQueries({ queryKey: EVENTS_KEY }); void queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY });
    },
    onError: error => setStatusError(errorMessage(error)),
  });
  const fund = useMutation({
    mutationFn: (input: AutomationFundingInput) => recordAutomationFunding(input),
    onSuccess: result => {
      setFundingResult(`Aporte registrado: ${money(result.amountCents)} · saldo informado ${money(result.botWalletBalanceCents)}.`);
      setFundingAmount(""); setReceipt(""); setCashConfirmed(false);
      queryClient.setQueryData(CONFIG_KEY, (old: import("./generated/adminApi.schemas").AutomationConfig | undefined) => old ? { ...old, botWalletBalanceCents: result.botWalletBalanceCents } : old);
      void queryClient.invalidateQueries({ queryKey: CONFIG_KEY }); void queryClient.invalidateQueries({ queryKey: AUTOMATION_ACCOUNTS_KEY });
      void queryClient.invalidateQueries({ queryKey: EVENTS_KEY }); void queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY });
    },
  });
  if (configQuery.isPending) return <><Heading eyebrow="Operação / automação" title="Configurações" description="Conta, limites e financiamento do participante automatizado." /><LoadingPanel /></>;
  if (configQuery.isError || !configQuery.data) return <><Heading eyebrow="Operação / automação" title="Configurações" /><QueryError error={configQuery.error} retry={() => void configQuery.refetch()} /></>;
  const config = configQuery.data;
  const setNumber = (key: keyof AutomationConfigInput, raw: string) => { setDirty(true); setForm(previous => ({ ...previous, [key]: raw === "" ? 0 : Number(raw) })); };
  const numericValid = Number.isInteger(form.maxBidCents) && form.maxBidCents >= 0 && form.maxBidCents <= 100000000
    && Number.isInteger(form.perDisputeLimitCents) && form.perDisputeLimitCents >= 0 && form.perDisputeLimitCents <= 100000000
    && Number.isInteger(form.dailyLimitCents) && form.dailyLimitCents >= 0 && form.dailyLimitCents <= 100000000
    && Number.isInteger(form.maxBidsPerDispute) && form.maxBidsPerDispute >= 0 && form.maxBidsPerDispute <= 10000
    && Number.isInteger(form.minimumSecondsRemaining) && form.minimumSecondsRemaining >= 1 && form.minimumSecondsRemaining <= 60
    && Number.isInteger(form.minimumDelaySeconds) && form.minimumDelaySeconds >= 1 && form.minimumDelaySeconds <= 3600;
  const selectedAccount = accountsQuery.data?.items.find((account: AutomationAccount) => account.id === form.botUserId);
  const positiveCaps = [form.maxBidCents, form.perDisputeLimitCents, form.dailyLimitCents].filter(value => value > 0);
  const consistent = positiveCaps.every((value, index) => index === 0 || positiveCaps[index - 1] <= value);
  const accountReady = Boolean(selectedAccount && !selectedAccount.testAccount && selectedAccount.walletBalanceCents > 0);
  const draftMatchesSavedConfig = form.mode === config.mode && form.bidTriggerMode === config.bidTriggerMode
    && form.botUserId === config.botUserId && form.maxBidCents === config.maxBidCents
    && form.perDisputeLimitCents === config.perDisputeLimitCents && form.dailyLimitCents === config.dailyLimitCents
    && form.maxBidsPerDispute === config.maxBidsPerDispute && form.minimumSecondsRemaining === config.minimumSecondsRemaining
    && form.minimumDelaySeconds === config.minimumDelaySeconds;
  const serverBlocksActivation = draftMatchesSavedConfig && !config.canEnable;
  const canEnable = Boolean(accountReady && numericValid && consistent && !serverBlocksActivation);
  const reasons = [
    !selectedAccount ? "Selecione uma conta." : "",
    selectedAccount?.testAccount ? "Contas de teste não podem participar." : "",
    selectedAccount && selectedAccount.walletBalanceCents <= 0 ? "A conta precisa ter saldo confirmado maior que zero." : "",
    !numericValid ? "Revise os valores permitidos para cada parâmetro." : "",
    !consistent ? "Os limites de lance, disputa e dia precisam respeitar a ordem definida." : "",
    ...(serverBlocksActivation ? (config.blockedReasons.length ? config.blockedReasons : ["A configuração salva não pode ser ativada pelo serviço."]) : []),
  ].filter(Boolean);
  const wallet = form.botUserId === config.botUserId ? config.botWalletBalanceCents : selectedAccount?.walletBalanceCents ?? 0;
  const displayedName = selectedAccount?.publicName ?? (form.botUserId === config.botUserId ? config.botName : "Selecione uma conta");
  const savingBusy = update.isPending || statusUpdate.isPending;
  const saveBlocked = !numericValid || !consistent || (config.enabled && !canEnable);
  const savedInput: AutomationConfigInput = {
    enabled: false, mode: config.mode, bidTriggerMode: config.bidTriggerMode, botUserId: config.botUserId,
    maxBidCents: config.maxBidCents, perDisputeLimitCents: config.perDisputeLimitCents, dailyLimitCents: config.dailyLimitCents,
    maxBidsPerDispute: config.maxBidsPerDispute, minimumSecondsRemaining: config.minimumSecondsRemaining, minimumDelaySeconds: config.minimumDelaySeconds,
    operatorRules: config.operatorRules,
  };
  return <div className="automation-page automation-settings-page appear">
    <Link href="/automation" className="back-link" data-testid="link-back-automation"><ArrowLeft size={14} /> Visão geral da automação</Link>
    <div className="spacer" />
    <Heading eyebrow="Operação / automação" title="Configurações" description="Estado ao vivo separado das regras que você está preparando.">
      {dirty && <span className="draft-indicator" data-testid="automation-draft-status"><span /> Rascunho não salvo</span>}
    </Heading>
    <section className="panel live-control-section" data-testid="automation-live-control">
      <div className="live-control-copy">
        <p className="eyebrow">Estado ao vivo</p>
        <div className="live-control-title"><h2>{config.enabled ? "Automação ativa" : "Automação pausada"}</h2><span className={`state-chip ${config.enabled ? "state-on" : ""}`} data-testid="automation-config-state"><i />{config.enabled ? "Ativa agora" : "Desativada"}</span></div>
        <p>Este estado é salvo imediatamente. Ativar aplica o rascunho atual e inicia o participante; desativar pausa agora sem descartar alterações não salvas.</p>
      </div>
      <div className="live-control-action">
        <div className="toggle-row"><div><strong>{config.enabled ? "Ativa no momento" : "Desativada no momento"}</strong><small>{statusUpdate.isPending ? "Atualizando estado…" : config.enabled ? "Lances podem ser executados agora" : "Nenhum lance será executado"}</small></div>
          <ToggleSwitch checked={config.enabled} disabled={statusUpdate.isPending || (!config.enabled && !canEnable)} onCheckedChange={(checked: boolean) => {
            setStatusError(""); setStatusFeedback(""); setSaveFeedback("");
            if (checked) statusUpdate.mutate(toAutomationInput(form, "ativa"));
            else statusUpdate.mutate(toAutomationInput(savedInput, "desativada"));
          }} data-testid="switch-automation-enabled" />
        </div>
      </div>
      {!canEnable && <div className="blocked-list live-blocked" data-testid="automation-blocked-reasons"><strong>Para ativar, resolva:</strong>{reasons.map((reason, index) => <div key={`${index}-${reason}`}><CircleAlert size={13} />{reason}</div>)}</div>}
      {statusError && <div className="inline-error live-message" role="alert" data-testid="automation-status-error">{statusError}</div>}
      {statusFeedback && <div className="success-note live-message" data-testid="automation-status-feedback"><Check size={14} />{statusFeedback}</div>}
    </section>

    <section className="panel settings-section identity-section" data-testid="automation-identity-section">
      <div className="settings-section-heading"><div><p className="eyebrow">01 / Identidade e estratégia</p><h2>Quem age e quando</h2><p>Escolha a conta real e o comportamento do participante.</p></div><Bot size={19} /></div>
      <div className="settings-account-banner" data-testid="settings-account-summary"><div className="account-avatar"><Bot size={19} /></div><div><span>CONTA SELECIONADA</span><strong>{displayedName}</strong><small>Saldo real da carteira</small></div><b>{money(wallet)}</b></div>
      <label className="config-field account-field" htmlFor="automation-account"><span>Conta que fará os lances</span><select id="automation-account" className="field full" value={form.botUserId ?? ""} onChange={event => { setDirty(true); setForm(previous => ({ ...previous, botUserId: event.target.value || null })); setFormError(""); setSaveFeedback(""); }} disabled={savingBusy || accountsQuery.isPending} data-testid="select-automation-account">
        <option value="">Selecione uma conta</option>{accountsQuery.data?.items.map((account: AutomationAccount) => <option key={account.id} value={account.id} disabled={account.testAccount}>{account.publicName}{account.testAccount ? " · conta de teste indisponível" : ` · saldo ${money(account.walletBalanceCents)}`}</option>)}
      </select></label>
      {accountsQuery.isPending && <div className="skeleton account-skeleton" />}
      {accountsQuery.isError && <QueryError error={accountsQuery.error} retry={() => void accountsQuery.refetch()} />}
      {selectedAccount?.testAccount && <div className="notice notice-error"><CircleAlert size={15} /> Contas de teste não podem ser usadas na automação.</div>}
      <div className="strategy-grid">
        <fieldset className="automation-mode-group" disabled={savingBusy}><legend>Quais ações o bot pode fazer?</legend><div className="automation-mode-list">{automationModes.map(mode => <label className={`automation-mode-option ${form.mode === mode.value ? "selected" : ""}`} key={mode.value}>
          <input type="radio" name="automation-mode" value={mode.value} checked={form.mode === mode.value} onChange={() => { setDirty(true); setForm(previous => ({ ...previous, mode: mode.value })); setSaveFeedback(""); }} data-testid={`radio-automation-mode-${mode.value}`} />
          <span><strong>{mode.label}</strong><small>{mode.detail}</small></span>
        </label>)}</div></fieldset>
        <fieldset className="automation-mode-group trigger-mode-group" disabled={savingBusy}><legend>Quando o bot deve agir?</legend><div className="automation-mode-list">{bidTriggerModes.map(trigger => <label className={`automation-mode-option ${form.bidTriggerMode === trigger.value ? "selected" : ""}`} key={trigger.value}>
          <input type="radio" name="automation-trigger-mode" value={trigger.value} checked={form.bidTriggerMode === trigger.value} onChange={() => { setDirty(true); setForm(previous => ({ ...previous, bidTriggerMode: trigger.value })); setSaveFeedback(""); }} data-testid={`radio-automation-trigger-${trigger.value}`} />
          <span><strong>{trigger.label}</strong><small>{trigger.detail}</small></span>
        </label>)}</div></fieldset>
      </div>
      {form.bidTriggerMode === "at_fixed_time" && <div className="trigger-explainer" data-testid="fixed-time-trigger-note"><Activity size={14} /><span>Em tempo fixo: quando o cronômetro reiniciar, o bot poderá agir novamente se não estiver liderando.</span></div>}
    </section>

    <section className="panel settings-section finance-section" data-testid="automation-financial-section">
      <div className="settings-section-heading"><div><p className="eyebrow">02 / Proteção financeira e tempo</p><h2>Regras de gasto</h2><p>Defina limites independentes e o ritmo de execução.</p></div><ShieldCheck size={19} /></div>
      <div className="notice wallet-ceiling-note"><ShieldCheck size={16} /><span><strong>O saldo da carteira é o teto absoluto de gasto.</strong> Zero significa sem limite apenas para aquele parâmetro; nunca autoriza gastar além do saldo real disponível.</span></div>
      <div className="limits-label"><div><p className="eyebrow">Limites de gasto</p><h3>Caps por lance, disputa e dia</h3></div><span>Valores em centavos</span></div>
      <div className="config-grid">{([
        ["maxBidCents", "Teto por lance", 0, 100000000],
        ["perDisputeLimitCents", "Teto por disputa", 0, 100000000],
        ["dailyLimitCents", "Teto diário", 0, 100000000],
        ["maxBidsPerDispute", "Lances por disputa", 0, 10000],
      ] as const).map(([key, label, min, max]) => <label className="config-field" key={key}><span>{label}</span><Input type="number" min={min} max={max} step="1" value={form[key]} onChange={event => { setNumber(key, event.target.value); setSaveFeedback(""); }} disabled={savingBusy} data-testid={`input-${key}`} />{min === 0 && <small className="zero-hint">0 = sem limite para este parâmetro</small>}</label>)}</div>
      <div className="limits-label timing-heading"><div><p className="eyebrow">Janela de execução</p><h3>Tempo e intervalo</h3></div></div>
      <div className="config-grid timing-config-grid">
        <label className="config-field"><span>{form.bidTriggerMode === "at_fixed_time" ? "Dar lance quando faltarem (segundos)" : "Tempo restante mínimo (segundos)"}</span><Input type="number" min="1" max="60" step="1" value={form.minimumSecondsRemaining} onChange={event => { setNumber("minimumSecondsRemaining", event.target.value); setSaveFeedback(""); }} disabled={savingBusy} data-testid="input-minimumSecondsRemaining" /><small className="timing-hint">{form.bidTriggerMode === "at_fixed_time" ? "Dispara quando restar esse tempo ou menos; se o bot liderar, aguarda o próximo reinício." : "Evita responder quando a disputa estiver perto demais do encerramento."}</small></label>
        {form.bidTriggerMode === "on_outbid" && <label className="config-field"><span>Intervalo após ser superado (segundos)</span><Input type="number" min="1" max="3600" step="1" value={form.minimumDelaySeconds} onChange={event => { setNumber("minimumDelaySeconds", event.target.value); setSaveFeedback(""); }} disabled={savingBusy} data-testid="input-minimumDelaySeconds" /><small className="timing-hint">Aguarda esse tempo após o lance maior antes de responder.</small></label>}
      </div>
      {!consistent && <div className="inline-error" role="alert" data-testid="automation-limit-error">Ignore os limites em zero: os limites positivos precisam seguir a ordem lance ≤ disputa ≤ dia.</div>}
      {formError && <div className="inline-error" role="alert" data-testid="automation-save-error">{formError}</div>}
      {!numericValid && <div className="inline-error" role="alert">Revise os valores: um ou mais parâmetros estão fora dos intervalos permitidos.</div>}
      <div className="config-footer settings-save-footer">
        <span>{dirty ? "Alterações locais ainda não aplicadas." : `Regras salvas · ${date(config.updatedAt)}`}</span>
        <div>{saveFeedback && <span className="save-feedback" data-testid="automation-save-feedback"><Check size={13} />{saveFeedback}</span>}
          <Button className="btn primary" disabled={savingBusy || saveBlocked || !dirty} onClick={() => { setFormError(""); setSaveFeedback(""); update.mutate(toAutomationInput(form, config.operatorRules.status)); }} data-testid="button-save-automation">{update.isPending ? "Salvando…" : "Salvar regras"} <Check size={14} /></Button>
        </div>
      </div>
    </section>

    <section className="panel settings-section funding-section" data-testid="automation-funding-section">
      <div className="settings-section-heading"><div><p className="eyebrow">03 / Saldo da conta</p><h2>Aporte confirmado</h2><p>Registre somente valores já recebidos e vinculados a um comprovante.</p></div><CircleDollarSign size={19} /></div>
      <div className="funding-form-grid">
        <div className="funding-balance-card"><span>CARTEIRA DA CONTA SALVA</span><strong>{config.botUserId ? config.botName : "Nenhuma conta salva"}</strong><b>{money(config.botWalletBalanceCents)}</b><small>Saldo real informado pelo serviço</small></div>
        <div className="funding-form">
          {form.botUserId !== config.botUserId && <div className="field-hint funding-selection-warning">Salve as regras da conta antes de registrar um aporte para ela.</div>}
          <label className="input-label" htmlFor="fund-amount">Valor a creditar (centavos)</label><Input id="fund-amount" type="number" min="1" max="100000000" step="1" value={fundingAmount} onChange={event => setFundingAmount(event.target.value)} data-testid="input-funding-amount" placeholder="Ex.: 5000" />
          <label className="input-label" htmlFor="receipt-reference">Referência do comprovante</label><Input id="receipt-reference" minLength={3} maxLength={120} value={receipt} onChange={event => setReceipt(event.target.value)} data-testid="input-funding-reference" placeholder="Identificador do comprovante" />
          <label className="confirm-row"><input type="checkbox" checked={cashConfirmed} onChange={event => setCashConfirmed(event.target.checked)} data-testid="checkbox-cash-confirmed" /> Confirmo que o valor foi recebido.</label>
          {fundingResult && <p className="success-note" data-testid="funding-success"><Check size={14} />{fundingResult}</p>}
          {fund.isError && <div className="inline-error" role="alert">{errorMessage(fund.error)}</div>}
          <Button className="btn primary full-button" disabled={fund.isPending || form.botUserId !== config.botUserId || !cashConfirmed || !Number.isInteger(Number(fundingAmount)) || Number(fundingAmount) < 1 || Number(fundingAmount) > 100000000 || receipt.trim().length < 3} onClick={() => fund.mutate({ amountCents: Number(fundingAmount), receiptReference: receipt.trim(), cashReceived: true })} data-testid="button-record-funding">{fund.isPending ? "Registrando…" : "Confirmar aporte"} <ArrowRight size={14} /></Button>
          <p className="funding-assurance"><ShieldCheck size={13} /> A carteira só recebe crédito após sua confirmação explícita.</p>
        </div>
      </div>
    </section>
  </div>;
}
function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><ErrorBoundary><AuthGate /></ErrorBoundary></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}
export default App;
