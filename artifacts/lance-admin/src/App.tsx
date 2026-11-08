import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Route, Switch as RouteSwitch, useLocation, useParams, Router as WouterRouter } from 'wouter';
import {
  Activity, ArrowDownLeft, ArrowLeft, ArrowRight, Bot, Check, ChevronDown,
  ChevronRight, CircleAlert, CircleCheck, CircleDollarSign, CircleX, Command,
  FileSearch, Fingerprint, KeyRound, Layers3, LogOut, Pause, Play, RefreshCw, Search,
  Settings2, ShieldCheck, SlidersHorizontal, Square, Wallet, X,
} from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch as ToggleSwitch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { AdminApiError } from './custom-fetch';
import { AdminRealtimeProvider, useAdminRealtime } from '@/lib/admin-realtime';
import ActionCenterPage from './pages/action-center';
import {
  closeAdminDispute, createAdminSession, endAdminSession, getAdminDashboard, getAdminDispute, getAdminSession,
  getAutomationConfig, listAdminDisputes, listAdminPayouts,
  listAdminTreasuryMovements, recordAdminTreasuryContribution, updateAdminPayout,
  listAutomationAccounts, listAutomationEvents, updateAutomationConfig,
} from './generated/adminApi';
import type {
  AdminDashboard, AdminDisputeSummary, AdminPayout, AdminPayoutStatus,
  AdminPayoutUpdateInput, AdminTreasuryContributionInput, AdminTreasuryMovement,
  AutomationConfigInput, AutomationAccount,
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
function DisputeRow({
  item,
  monitoring = false,
  expandOnMount = false,
  showDetailLink = true,
}: {
  item: AdminDisputeSummary;
  monitoring?: boolean;
  expandOnMount?: boolean;
  showDetailLink?: boolean;
}) {
  const [expanded, setExpanded] = useState(expandOnMount);
  const detail = useQuery({
    queryKey: ['/api/admin/disputes', item.id],
    queryFn: () => getAdminDispute(item.id, { cache: 'no-store' }),
    enabled: expanded,
    staleTime: 0,
  });
  const botOutcome = !monitoring
    ? null
    : item.status === 'ended'
      ? item.bidsCount === 0
        ? 'Sem lances'
        : item.automationBotWon
          ? 'Bot venceu'
          : 'Bot não venceu'
      : item.status === 'live'
        ? item.automationBotLeading
          ? 'Bot lidera'
          : item.automationBidCount > 0
            ? 'Bot participou'
            : 'Bot ainda não deu lance'
        : item.status === 'paused'
          ? 'Disputa pausada'
          : null;
  const botOutcomeTone = botOutcome === 'Bot venceu' || botOutcome === 'Bot lidera'
    ? 'positive'
    : botOutcome === 'Bot não venceu'
      ? 'negative'
      : 'neutral';
  return <article className={`dispute-record ${expanded ? 'expanded' : ''}`} data-testid={`card-dispute-${item.id}`}>
    <button type="button" className="record-trigger" aria-expanded={expanded} onClick={() => setExpanded(value => !value)} data-testid={`button-expand-dispute-${item.id}`}>
      <span className="record-copy">
        <strong>Disputa #{item.number}</strong>
        <small>{date(item.createdAt)} · {item.bidsCount} lances · {item.status === 'ended' ? item.winnerName ? `Vencedor: ${item.winnerName}` : 'Encerrada sem vencedor' : item.leaderName ? `Líder: ${item.leaderName}` : 'Sem lances'}</small>
      </span>
      <span className="record-trailing">
        <Status value={item.status} />
        {botOutcome && <span className={`automation-result-pill ${botOutcomeTone}`}>{botOutcome}</span>}
        <strong>{item.currentValueCents == null ? 'Sem lances' : money(item.currentValueCents)}</strong>
        <ChevronDown size={16} className="record-chevron" />
      </span>
    </button>
    {expanded && <div className="record-expanded">
      <div className={`record-facts ${monitoring ? 'automation-record-facts' : ''}`}>
        <span><small>Prêmio</small><strong>{money(item.prizeCents)}</strong></span>
        <span><small>Incremento mínimo</small><strong>{money(item.stepCents)}</strong></span>
        <span><small>Vencedor</small><strong>{item.winnerName || '—'}</strong></span>
        {monitoring && <span><small>Lances do bot</small><strong>{item.automationBidCount}</strong></span>}
        {monitoring && <span><small>Resultado do bot</small><strong>{botOutcome || '—'}</strong></span>}
      </div>
      {detail.isPending ? <div className="record-loading">Carregando lances registrados…</div>
        : detail.isError ? <QueryError error={detail.error} retry={() => void detail.refetch()} />
        : detail.data?.bids.length ? <div className="bid-record-list" aria-label={`Lances da disputa ${item.number}`}>
          {detail.data.bids.map(bid => <div className="bid-record" key={bid.id} data-testid={`row-bid-${bid.id}`}>
            <span><strong>{bid.bidderName}</strong>{bid.automated && <small>{monitoring ? 'Lance do bot' : 'Participante automatizado'}</small>}</span>
            <span><strong>{money(bid.amountCents)}</strong><small>{date(bid.createdAt)}</small></span>
            <span className={`result-pill ${bid.result || ''}`}>{bid.result === 'won' ? 'Venceu' : bid.result === 'lost' ? 'Não venceu' : 'Em aberto'}</span>
          </div>)}
        </div> : <div className="record-loading">Nenhum lance registrado nesta disputa.</div>}
      {showDetailLink && <Link href={`/disputes/${encodeURIComponent(item.id)}`} className="table-link record-detail-link" data-testid={`link-dispute-${item.id}`}>Abrir detalhes completos <ArrowRight size={13} /></Link>}
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
  { href: '/', label: 'Central de trabalho', icon: Layers3 },
  { href: '/payouts', label: 'Resgates', icon: ArrowDownLeft },
  { href: '/disputes', label: 'Disputas', icon: FileSearch },
  { href: '/treasury', label: 'Caixa', icon: Wallet },
  { href: '/automation', label: 'Automação', icon: Bot },
];
function Shell({ signOut, signOutBusy }: { signOut: () => void; signOutBusy: boolean }) {
  const [path] = useLocation();
  const realtimeConnected = useAdminRealtime();
  const automation = useQuery({ queryKey: CONFIG_KEY, queryFn: getAutomationConfig });
  const dashboard = useQuery({ queryKey: DASHBOARD_KEY, queryFn: getAdminDashboard });
  const automationStatus = automation.data?.operatorRules.status;
  const activeItem = navItems.find(item => item.href === '/' ? path === '/' : path.startsWith(item.href));
  const linkGroup = (items: typeof navItems) => items.map(item => {
    const active = item.href === '/' ? path === '/' : path.startsWith(item.href);
    const Icon = item.icon;
    const count = item.href === '/payouts'
      ? dashboard.data?.pendingPayoutCount
      : item.href === '/disputes'
        ? dashboard.data?.liveDisputes.length
        : undefined;
    return <Link key={item.href} href={item.href} className={`ac-side-link${active ? ' active' : ''}`} aria-current={active ? 'page' : undefined} data-testid={`nav-${item.label.toLowerCase().replaceAll(' ', '-')}`}>
      <Icon size={16} />{item.label}{count !== undefined && <span className="ac-side-count">{count.toLocaleString('pt-BR')}</span>}{active && item.href === '/' && <ChevronRight size={14} />}
    </Link>;
  });
  const statusLabel = automationStatus === 'ativa'
    ? 'Automação ativa'
    : automationStatus === 'pausada'
      ? 'Automação pausada'
      : automationStatus === 'desativada'
        ? 'Automação desativada'
        : automation.isError
          ? 'Automação indisponível'
          : 'Verificando automação…';
  const statusClass = automationStatus === 'ativa'
    ? 'ac-status-active'
    : automationStatus === 'pausada'
      ? 'ac-status-paused'
      : 'ac-status-inactive';
  return <AdminRealtimeProvider><div className="ac-root" data-testid="admin-app-shell">
    <header className="ac-topbar">
      <Link href="/" className="ac-brand" data-testid="link-admin-home">
        <span className="ac-brand-mark" aria-hidden="true"><Command size={18} strokeWidth={2.3} /></span>
        <span className="ac-brand-name">Lance do Pix</span>
        <span className="ac-admin-tag">OPERAÇÕES</span>
      </Link>
      <div className="ac-top-right">
        <span className={`ac-preview-label ${statusClass}`} data-testid="header-automation-status" aria-live="polite">
          <i className="ac-preview-dot" />{statusLabel}
        </span>
        <button className="ac-button ac-logout" onClick={signOut} disabled={signOutBusy} data-testid="button-admin-logout"><LogOut size={15} />{signOutBusy ? 'Saindo…' : 'Sair'}</button>
      </div>
    </header>
    <div className="ac-layout">
      <aside className="ac-sidebar" aria-label="Navegação administrativa">
        <div className="ac-sidebar-group">
          <p className="ac-side-heading">Operação</p>
          {linkGroup(navItems.slice(0, 3))}
          <button className="ac-side-link ac-sidebar-link-disabled" type="button" disabled title="A API administrativa ainda não fornece uma fila de fraude"><Fingerprint size={16} />Fraude<span className="ac-side-count">—</span></button>
          <button className="ac-side-link ac-sidebar-link-disabled" type="button" disabled title="A API administrativa ainda não fornece uma fila de incidentes"><Activity size={16} />Incidentes<span className="ac-side-count">—</span></button>
        </div>
        <div className="ac-sidebar-group">
          <p className="ac-side-heading">Gestão</p>
          {linkGroup(navItems.slice(3))}
        </div>
        <div className="ac-sidebar-group ac-governance-group">
          <p className="ac-side-heading">Governança</p>
          <button className="ac-side-link ac-sidebar-link-disabled" type="button" disabled title="A API administrativa ainda não oferece este módulo"><FileSearch size={16} />Auditoria</button>
          <button className="ac-side-link ac-sidebar-link-disabled" type="button" disabled title="A API administrativa ainda não oferece este módulo"><ShieldCheck size={16} />Acessos e permissões</button>
        </div>
        <div className="ac-sidebar-note">
          <div className="ac-sidebar-note-title"><ShieldCheck size={15} />Decisão segura</div>
          <p>Confirme o contexto e as obrigações antes de liberar pagamentos ou alterar uma disputa.</p>
        </div>
      </aside>
      <main className="ac-main">
        <div className="ac-route-content" data-page={activeItem?.label || 'Central de trabalho'}><RouteSwitch>
          <Route path="/" component={Overview} />
          <Route path="/disputes" component={DisputesPage} />
          <Route path="/disputes/:id" component={DisputeDetailPage} />
          <Route path="/payouts" component={PayoutsPage} />
          <Route path="/treasury" component={TreasuryPage} />
          <Route path="/automation/settings" component={AutomationPage} />
          <Route path="/automation" component={AutomationPage} />
          <Route component={NotFound} />
        </RouteSwitch></div>
      </main>
    </div>
  </div></AdminRealtimeProvider>;
}
function Overview() {
  return <ActionCenterPage />;
}
function DisputesPage() {
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 20;
  const query = useQuery({ queryKey: ['/api/admin/disputes', { q, limit, offset }], queryFn: () => listAdminDisputes({ q: q || undefined, limit, offset }) });
  const total = query.data?.total || 0;
  return <div className="disputes-page appear">
    <Heading eyebrow="Operação / histórico" title="Disputas" description="Acompanhe disputas em andamento e consulte os lances registrados." />
    <section className="prototype-section">
      <div className="prototype-section-head"><p className="ey">Histórico de disputas</p><span className="prototype-note">{total.toLocaleString('pt-BR')} registros</span></div>
      <form className="prototype-search" onSubmit={event => { event.preventDefault(); setOffset(0); setQ(input.trim()); }}>
        <Search size={16} aria-hidden="true" />
        <Input aria-label="Pesquisar disputas" data-testid="input-dispute-search" placeholder="Buscar por nº, prêmio, usuário ou bot" maxLength={100} value={input} onChange={event => setInput(event.target.value)} />
        {q && <button type="button" className="prototype-clear" onClick={() => { setInput(''); setQ(''); setOffset(0); }} data-testid="button-clear-dispute-search"><X size={15} /> Limpar</button>}
      </form>
    </section>
    {query.isPending ? <LoadingPanel /> : query.isError ? <QueryError error={query.error} retry={() => void query.refetch()} /> : query.data?.items.length ? <><DisputeRows items={query.data.items} /><Pagination offset={offset} limit={limit} total={total} setOffset={setOffset} /></> : <Empty title="Nenhuma disputa encontrada" text={q ? 'Tente outro termo de pesquisa.' : 'Ainda não há disputas disponíveis no histórico.'} />}
  </div>;
}
function Pagination({ offset, limit, total, setOffset }: { offset: number; limit: number; total: number; setOffset: (n: number) => void }) {
  return <div className="pagination"><span>{total.toLocaleString('pt-BR')} registros</span><div><button className="btn" onClick={() => setOffset(Math.max(0, offset - limit))} disabled={offset === 0} data-testid="button-page-prev"><ArrowLeft size={14} /> Anterior</button><button className="btn" onClick={() => setOffset(offset + limit)} disabled={offset + limit >= total} data-testid="button-page-next">Próxima <ArrowRight size={14} /></button></div></div>;
}
function DisputeDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const decoded = decodeURIComponent(id);
  const queryClient = useQueryClient();
  const [closeReason, setCloseReason] = useState('');
  const [closeFormOpen, setCloseFormOpen] = useState(false);
  const query = useQuery({ queryKey: ['/api/admin/disputes', decoded], queryFn: () => getAdminDispute(decoded), enabled: !!decoded });
  const closeMutation = useMutation({
    mutationFn: (reason: string) => closeAdminDispute(decoded, { reason }),
    onSuccess: async () => {
      setCloseFormOpen(false);
      setCloseReason('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['/api/admin/disputes'] }),
        queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY }),
      ]);
    },
  });
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
        {query.data.manualClosure && <section className="manual-close-audit" aria-label="Registro de encerramento manual">
          <div><strong>Encerrada manualmente</strong><span>{date(query.data.manualClosure.createdAt)}</span></div>
          <p><b>Motivo:</b> {query.data.manualClosure.reason}</p>
          <p><b>Créditos devolvidos:</b> {money(query.data.manualClosure.refundedCreditsCents)} em {query.data.manualClosure.refundedBidCount} lances</p>
        </section>}
        {closeMutation.data && <div className="manual-close-success" role="status">
          <CircleCheck size={16} />
          <span>{closeMutation.data.refundedBidCount} lances estornados; {money(closeMutation.data.refundedCreditsCents)} devolvidos às carteiras.</span>
        </div>}
        {(dispute.status === 'live' || dispute.status === 'paused') && <section className="manual-close-panel">
          <div className="manual-close-heading">
            <div><p className="ey">Ação operacional</p><h2 className="section-title">Encerrar disputa</h2></div>
            {!closeFormOpen && <Button className="btn danger-outline" type="button" onClick={() => setCloseFormOpen(true)} data-testid="button-open-manual-close">Encerrar e devolver créditos</Button>}
          </div>
          {closeFormOpen && <form className="manual-close-form" onSubmit={event => { event.preventDefault(); closeMutation.mutate(closeReason.trim()); }}>
            <p>Todos os créditos cobrados pelos lances serão devolvidos. A disputa ficará encerrada sem vencedor e o prêmio não será pago. Esta ação não pode ser desfeita.</p>
            <label className="input-label" htmlFor="manual-close-reason">Motivo do encerramento</label>
            <Input id="manual-close-reason" data-testid="input-manual-close-reason" value={closeReason} onChange={event => setCloseReason(event.target.value)} minLength={3} maxLength={500} required disabled={closeMutation.isPending} placeholder="Explique por que a disputa precisa ser encerrada" />
            {closeMutation.error && <div className="inline-error" role="alert">{closeMutation.error instanceof Error ? closeMutation.error.message : 'Não foi possível encerrar a disputa.'}</div>}
            <div className="manual-close-actions">
              <Button className="btn" type="button" onClick={() => { setCloseFormOpen(false); setCloseReason(''); closeMutation.reset(); }} disabled={closeMutation.isPending}>Cancelar</Button>
              <Button className="btn danger" type="submit" disabled={closeMutation.isPending || closeReason.trim().length < 3} data-testid="button-confirm-manual-close">{closeMutation.isPending ? 'Encerrando e devolvendo…' : 'Confirmar encerramento'}</Button>
            </div>
          </form>}
        </section>}
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
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  const [offset, setOffset] = useState(0);
  const [notice, setNotice] = useState('');
  const limit = 20;
  const query = useQuery({ queryKey: ['/api/admin/payouts', { status, q, limit, offset }], queryFn: () => listAdminPayouts({ status: (status || undefined) as AdminPayoutStatus | undefined, q: q || undefined, limit, offset }) });
  const total = query.data?.total || 0;
  return <div className="payouts-page appear">
    <Heading eyebrow="Financeiro / operações" title="Resgates" description="Revise solicitações, registre pagamentos e mantenha decisões justificadas." />
    <section className="prototype-section" aria-label="Buscar e filtrar resgates">
      <div className="prototype-section-head"><p className="ey">Resgates</p><span className="prototype-note">{total.toLocaleString('pt-BR')} solicitações</span></div>
      <form className="prototype-search" onSubmit={event => { event.preventDefault(); const search = input.trim(); setInput(search); setOffset(0); setQ(search); }}>
        <Search size={16} aria-hidden="true" />
        <Input aria-label="Pesquisar resgates" data-testid="input-payout-search" placeholder="Buscar por nome, e-mail ou ID da solicitação" maxLength={100} value={input} onChange={event => setInput(event.target.value)} />
        {q && <button type="button" className="prototype-clear" onClick={() => { setInput(''); setQ(''); setOffset(0); }} data-testid="button-clear-payout-search"><X size={15} /> Limpar</button>}
      </form>
      <div className="prototype-chips" role="group" aria-label="Status dos resgates">
        {[['', 'Todos'], ['requested', 'Solicitado'], ['under_review', 'Em análise'], ['paid', 'Pago'], ['rejected', 'Recusado']].map(([value, label]) =>
          <button key={value || 'all'} type="button" aria-pressed={status === value} onClick={() => { setStatus(value); setOffset(0); }} data-testid={`filter-payout-${value || 'all'}`}>{label}</button>,
        )}
      </div>
    </section>
    {notice && <div className="automation-feedback" role="status" data-testid="payout-action-success"><Check size={15} />{notice}</div>}
    {query.isPending ? <LoadingPanel /> : query.isError ? <QueryError error={query.error} retry={() => void query.refetch()} /> : query.data?.items.length ? <><PayoutRows items={query.data.items} onUpdated={setNotice} /><Pagination offset={offset} limit={limit} total={total} setOffset={setOffset} /></> : <Empty title={q ? 'Nenhuma solicitação encontrada' : 'Fila vazia'} text={q ? 'Tente outro nome, e-mail ou ID de solicitação.' : 'A API não retornou solicitações com este filtro.'} />}
  </div>;
}
function PayoutRows({ items, onUpdated }: { items: AdminPayout[]; onUpdated: (message: string) => void }) {
  const keyNames: Record<string, string> = { cpf: 'CPF', email: 'E-mail', phone: 'Telefone', random: 'Aleatória' };
  return <div className="prototype-record-list">{items.map(payout =>
    <PayoutRow key={payout.id} payout={payout} keyName={keyNames[payout.pixKeyType] || payout.pixKeyType} onUpdated={onUpdated} />,
  )}</div>;
}
function PayoutRow({ payout, keyName, onUpdated }: { payout: AdminPayout; keyName: string; onUpdated: (message: string) => void }) {
  const queryClient = useQueryClient();
  const [action, setAction] = useState<'paid' | 'rejected' | null>(null);
  const [pixE2eId, setPixE2eId] = useState('');
  const [reason, setReason] = useState('');
  const update = useMutation({
    mutationFn: (input: AdminPayoutUpdateInput) => updateAdminPayout(payout.id, input),
    onSuccess: result => {
      const labels: Record<AdminPayout['status'], string> = {
        requested: 'reenfileirado', under_review: 'encaminhado para análise', paid: 'marcado como pago', rejected: 'recusado',
      };
      onUpdated(`Resgate de ${payout.userName} ${labels[result.status]}.`);
      setAction(null);
      setPixE2eId('');
      setReason('');
      void queryClient.invalidateQueries({ queryKey: ['/api/admin/payouts'] });
      void queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY });
      void queryClient.invalidateQueries({ queryKey: ['/api/admin/treasury/movements'] });
    },
  });
  const submitAction = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (action === 'paid') {
      const reference = pixE2eId.trim();
      if (reference.length < 3) return;
      update.mutate({ status: 'paid', pixE2eId: reference });
    } else if (action === 'rejected') {
      const rejection = reason.trim();
      if (rejection.length < 3) return;
      update.mutate({ status: 'rejected', reason: rejection });
    }
  };
  const updateDirectly = (status: AdminPayoutUpdateInput['status']) => update.mutate({ status });
  return <article className="prototype-card prototype-payout" data-testid={`card-payout-${payout.id}`}>
    <div className="prototype-record-top">
      <div><strong>{money(payout.amountCents)}</strong><small>{payout.userName} · {date(payout.requestedAt)}</small></div>
      <Status value={payout.status} />
    </div>
    <div className="prototype-record-detail"><span>Resgate · {keyName}</span><span>Prêmio {money(payout.prizeCents)} · Bônus {money(payout.bonusCents)}</span></div>
    <small className="prototype-note">Atualizado {date(payout.updatedAt)}</small>
    {update.isError && <div className="inline-error" role="alert" data-testid={`error-payout-${payout.id}`}>{errorMessage(update.error)}</div>}
    {payout.status === 'requested' && <div className="payout-actions">
      <Button className="btn primary" disabled={update.isPending} onClick={() => updateDirectly('under_review')} data-testid={`button-payout-review-${payout.id}`}>{update.isPending ? 'Atualizando…' : 'Iniciar análise'} <ArrowRight size={14} /></Button>
    </div>}
    {payout.status === 'under_review' && !action && <div className="payout-actions">
      <Button className="btn primary" disabled={update.isPending} onClick={() => setAction('paid')} data-testid={`button-payout-pay-${payout.id}`}>Registrar pagamento</Button>
      <Button className="btn payout-reject-button" disabled={update.isPending} onClick={() => setAction('rejected')} data-testid={`button-payout-reject-${payout.id}`}>Recusar resgate</Button>
    </div>}
    {payout.status === 'rejected' && <div className="payout-actions">
      <Button className="btn" disabled={update.isPending} onClick={() => updateDirectly('requested')} data-testid={`button-payout-requeue-${payout.id}`}>{update.isPending ? 'Atualizando…' : 'Reenfileirar'} <RefreshCw size={13} /></Button>
    </div>}
    {action && <form className="payout-action-form" onSubmit={submitAction} data-testid={`form-payout-${action}-${payout.id}`}>
      {action === 'paid' ? <>
        <div className="payout-action-warning"><CircleAlert size={15} /><span>Confirme somente depois de concluir a transferência Pix. O identificador E2E será registrado no histórico.</span></div>
        <label className="input-label" htmlFor={`payout-e2e-${payout.id}`}>Identificador E2E do Pix</label>
        <Input id={`payout-e2e-${payout.id}`} data-testid={`input-payout-e2e-${payout.id}`} value={pixE2eId} minLength={3} maxLength={128} required disabled={update.isPending} onChange={event => setPixE2eId(event.target.value)} placeholder="Cole o identificador da transferência" />
      </> : <>
        <label className="input-label" htmlFor={`payout-reason-${payout.id}`}>Motivo da recusa</label>
        <Input id={`payout-reason-${payout.id}`} data-testid={`input-payout-reason-${payout.id}`} value={reason} minLength={3} maxLength={240} required disabled={update.isPending} onChange={event => setReason(event.target.value)} placeholder="Explique o motivo ao usuário" />
      </>}
      <div className="payout-actions">
        <Button className="btn primary" type="submit" disabled={update.isPending || (action === 'paid' ? pixE2eId.trim().length < 3 : reason.trim().length < 3)} data-testid={`button-payout-confirm-${payout.id}`}>{update.isPending ? 'Salvando…' : action === 'paid' ? 'Confirmar pagamento' : 'Confirmar recusa'} <Check size={14} /></Button>
        <Button className="btn" type="button" disabled={update.isPending} onClick={() => { setAction(null); setPixE2eId(''); setReason(''); }} data-testid={`button-payout-cancel-${payout.id}`}>Cancelar</Button>
      </div>
    </form>}
  </article>;
}
function TreasuryPage() {
  const [filter, setFilter] = useState<'all' | AdminTreasuryMovement['category']>('all');
  const [contributionOpen, setContributionOpen] = useState(false);
  const [contributionNotice, setContributionNotice] = useState('');
  const heading = <Heading eyebrow="Financeiro / caixa" title="Caixa" description="Acompanhe entradas confirmadas, obrigações e saídas liquidadas." />;
  const dashboardQuery = useQuery({ queryKey: DASHBOARD_KEY, queryFn: getAdminDashboard });
  const movementQuery = useQuery({
    queryKey: ['/api/admin/treasury/movements', { limit: 50, offset: 0 }],
    queryFn: () => listAdminTreasuryMovements({ limit: 50, offset: 0 }),
  });
  if (dashboardQuery.isPending || movementQuery.isPending) return <div className="treasury-page prototype-dashboard">{heading}<LoadingPanel /></div>;
  if (dashboardQuery.isError || !dashboardQuery.data) return <div className="treasury-page prototype-dashboard">{heading}<QueryError error={dashboardQuery.error} retry={() => void dashboardQuery.refetch()} /></div>;
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
  return <div className="treasury-page prototype-dashboard appear">
    {heading}
    <section className="prototype-section" data-testid="treasury-summary">
      <div className="prototype-section-head"><p className="ey">Caixa</p><div className="treasury-actions">
        <button className="prototype-refresh" onClick={() => { void dashboardQuery.refetch(); void movementQuery.refetch(); }} data-testid="button-refresh-treasury"><RefreshCw size={14} /> Atualizar</button>
        {!contributionOpen && <Button className="btn primary" onClick={() => { setContributionNotice(''); setContributionOpen(true); }} data-testid="button-open-treasury-contribution"><CircleDollarSign size={14} /> Registrar aporte</Button>}
      </div></div>
      {contributionNotice && <div className="automation-feedback" role="status" data-testid="treasury-contribution-success"><Check size={15} />{contributionNotice}</div>}
      {contributionOpen && <TreasuryContributionForm onCancel={() => setContributionOpen(false)} onSaved={message => { setContributionNotice(message); setContributionOpen(false); }} />}
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
function TreasuryContributionForm({ onCancel, onSaved }: { onCancel: () => void; onSaved: (message: string) => void }) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [receiptReference, setReceiptReference] = useState('');
  const [note, setNote] = useState('');
  const [cashReceived, setCashReceived] = useState(false);
  const contribution = useMutation({
    mutationFn: (input: AdminTreasuryContributionInput) => recordAdminTreasuryContribution(input),
    onSuccess: result => {
      onSaved(`Aporte de ${money(result.amountCents)} registrado.`);
      void queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY });
      void queryClient.invalidateQueries({ queryKey: ['/api/admin/treasury/movements'] });
    },
  });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amountCents = Math.round(Number(amount) * 100);
    if (!Number.isSafeInteger(amountCents) || amountCents < 1 || amountCents > 100_000_000) return;
    const reference = receiptReference.trim();
    if (reference.length < 3 || !cashReceived) return;
    contribution.mutate({
      amountCents,
      receiptReference: reference,
      ...(note.trim() ? { note: note.trim() } : {}),
      cashReceived: true,
    });
  };
  return <form className="treasury-contribution-form" onSubmit={submit} data-testid="form-treasury-contribution">
    <div className="treasury-contribution-heading"><div><strong>Registrar aporte recebido</strong><small>O registro altera o caixa e não pode ser desfeito por este formulário.</small></div><button className="prototype-clear" type="button" onClick={onCancel} disabled={contribution.isPending} data-testid="button-close-treasury-contribution"><X size={14} /> Fechar</button></div>
    <div className="treasury-contribution-fields">
      <label className="treasury-field" htmlFor="treasury-contribution-amount"><span className="input-label">Valor em reais</span>
        <Input id="treasury-contribution-amount" data-testid="input-treasury-contribution-amount" type="number" min="0.01" max="1000000" step="0.01" required value={amount} disabled={contribution.isPending} onChange={event => setAmount(event.target.value)} placeholder="0,00" />
      </label>
      <label className="treasury-field" htmlFor="treasury-contribution-reference"><span className="input-label">Referência do comprovante</span>
        <Input id="treasury-contribution-reference" data-testid="input-treasury-contribution-reference" minLength={3} maxLength={120} required value={receiptReference} disabled={contribution.isPending} onChange={event => setReceiptReference(event.target.value)} placeholder="Identificador único do recebimento" />
      </label>
      <label className="treasury-field treasury-note-label" htmlFor="treasury-contribution-note"><span className="input-label">Observação (opcional)</span>
        <Input id="treasury-contribution-note" data-testid="input-treasury-contribution-note" maxLength={60} value={note} disabled={contribution.isPending} onChange={event => setNote(event.target.value)} placeholder="Até 60 caracteres" />
      </label>
    </div>
    <label className="treasury-confirm-row"><input type="checkbox" data-testid="checkbox-treasury-cash-received" checked={cashReceived} disabled={contribution.isPending} onChange={event => setCashReceived(event.target.checked)} /><span>Confirmo que o valor foi recebido e que a referência corresponde ao comprovante.</span></label>
    {contribution.isError && <div className="inline-error" role="alert" data-testid="treasury-contribution-error">{errorMessage(contribution.error)}</div>}
    <div className="treasury-contribution-footer">
      <Button className="btn" type="button" disabled={contribution.isPending} onClick={onCancel} data-testid="button-cancel-treasury-contribution">Cancelar</Button>
      <Button className="btn primary" type="submit" disabled={contribution.isPending || !cashReceived || !receiptReference.trim() || Number(amount) <= 0} data-testid="button-submit-treasury-contribution">{contribution.isPending ? 'Registrando…' : 'Confirmar aporte'} <Check size={14} /></Button>
    </div>
    <small className="prototype-note">Referências já utilizadas não podem ser registradas novamente.</small>
  </form>;
}
function LedgerRow({ title, detail, value, tone }: { title: string; detail: string; value: number; tone?: string }) {
  return <div className="ledger-row"><div><strong>{title}</strong><small>{detail}</small></div><span className={tone || ''}>{money(value)}</span></div>;
}
type AutomationStatus = AutomationConfigInput["operatorRules"]["status"];
type AutomationRuleKey = "opening" | "counter";
const statusOptions: Array<{ value: AutomationStatus; label: string }> = [
  { value: "ativa", label: "Ativa" },
  { value: "pausada", label: "Pausada" },
  { value: "desativada", label: "Desativada" },
];
const limitRows = [
  { key: "bidsPerDispute", label: "Lances por disputa", unit: "lances", kind: "count" },
  { key: "bidsPerDay", label: "Lances por dia", unit: "lances", kind: "count" },
  { key: "disputesPerDay", label: "Disputas por dia", unit: "disputas", kind: "count" },
  { key: "maxBidCents", label: "Valor máximo por lance", unit: "R$", kind: "money" },
  { key: "perDisputeCents", label: "Total máximo somado por disputa", unit: "R$", kind: "money" },
  { key: "dailySpendCents", label: "Gasto máximo por dia", unit: "R$", kind: "money" },
] as const;
const multipliers = [1, 2, 3, 5, 10];
const makeInput = (config: import("./generated/adminApi.schemas").AutomationConfig): AutomationConfigInput => ({
  enabled: config.enabled,
  mode: config.mode,
  bidTriggerMode: config.bidTriggerMode,
  botUserId: config.botUserId,
  maxBidCents: config.maxBidCents,
  perDisputeLimitCents: config.perDisputeLimitCents,
  dailyLimitCents: config.dailyLimitCents,
  maxBidsPerDispute: config.maxBidsPerDispute,
  minimumSecondsRemaining: config.minimumSecondsRemaining,
  minimumDelaySeconds: config.minimumDelaySeconds,
  operatorRules: config.operatorRules,
});
const toInputWithRules = (form: AutomationConfigInput, status: AutomationStatus): AutomationConfigInput => ({
  ...form,
  enabled: status === "ativa",
  mode: form.operatorRules.opening.on && form.operatorRules.counter.on ? "bids_and_counterbids" : form.operatorRules.opening.on ? "bids_only" : "counterbids_only",
  bidTriggerMode: form.operatorRules.counter.trigger === "final" || form.operatorRules.opening.trigger === "final" ? "at_fixed_time" : "on_outbid",
  minimumSecondsRemaining: Math.max(form.operatorRules.opening.seconds, form.operatorRules.counter.seconds),
  maxBidCents: form.operatorRules.limits.maxBidCents,
  perDisputeLimitCents: form.operatorRules.limits.perDisputeCents,
  dailyLimitCents: form.operatorRules.limits.dailySpendCents,
  maxBidsPerDispute: form.operatorRules.limits.bidsPerDispute,
  operatorRules: { ...form.operatorRules, status },
});
function AutomationPage() {
  const queryClient = useQueryClient();
  const realtimeConnected = useAdminRealtime();
  const configQuery = useQuery({ queryKey: CONFIG_KEY, queryFn: getAutomationConfig });
  const accountsQuery = useQuery({ queryKey: AUTOMATION_ACCOUNTS_KEY, queryFn: listAutomationAccounts });
  const eventsLimit = 100;
  const eventsQuery = useQuery({
    queryKey: [...EVENTS_KEY, { limit: eventsLimit, offset: 0 }],
    queryFn: () =>
      listAutomationEvents(
        { limit: eventsLimit, offset: 0 },
        { cache: "no-store" },
      ),
    refetchInterval: realtimeConnected ? false : 5_000,
  });
  const disputesLimit = 50;
  const disputesQuery = useQuery({
    queryKey: ["/api/admin/disputes", { limit: disputesLimit, offset: 0 }],
    queryFn: () =>
      listAdminDisputes(
        { limit: disputesLimit, offset: 0 },
        { cache: "no-store" },
      ),
    refetchInterval: realtimeConnected ? false : 5_000,
  });
  const [form, setForm] = useState<AutomationConfigInput | null>(null);
  const [dirty, setDirty] = useState(false);
  const [validation, setValidation] = useState<{ ok: boolean; messages: string[] } | null>(null);
  const [saveError, setSaveError] = useState("");
  const [statusError, setStatusError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [customMultiplier, setCustomMultiplier] = useState<Record<AutomationRuleKey, boolean>>({ opening: false, counter: false });
  const initialized = useRef(false);
  useEffect(() => {
    if (configQuery.data && (!initialized.current || !dirty)) {
      setForm(makeInput(configQuery.data));
      setCustomMultiplier({
        opening: !multipliers.includes(configQuery.data.operatorRules.opening.multiplier as typeof multipliers[number]),
        counter: !multipliers.includes(configQuery.data.operatorRules.counter.multiplier as typeof multipliers[number]),
      });
      initialized.current = true;
    }
  }, [configQuery.data, dirty]);
  const save = useMutation({
    mutationFn: (input: AutomationConfigInput) => updateAutomationConfig(input),
    onSuccess: data => {
      queryClient.setQueryData(CONFIG_KEY, data);
      setForm(makeInput(data));
      setDirty(false);
      setSaveError("");
      setFeedback("Configuração salva.");
      void queryClient.invalidateQueries({ queryKey: EVENTS_KEY });
    },
    onError: error => setSaveError(errorMessage(error)),
  });
  const changeStatus = useMutation({
    mutationFn: (input: AutomationConfigInput) => updateAutomationConfig(input),
    onMutate: async input => {
      await queryClient.cancelQueries({ queryKey: CONFIG_KEY });
      const previousConfig = queryClient.getQueryData<
        import("./generated/adminApi.schemas").AutomationConfig
      >(CONFIG_KEY);
      if (previousConfig) {
        queryClient.setQueryData(CONFIG_KEY, {
          ...previousConfig,
          enabled: input.operatorRules.status === "ativa",
          operatorRules: input.operatorRules,
        });
      }
      return { previousConfig };
    },
    onSuccess: data => {
      queryClient.setQueryData(CONFIG_KEY, data);
      setStatusError("");
      setFeedback(`Status atualizado: ${data.operatorRules.status}.`);
      void queryClient.invalidateQueries({ queryKey: EVENTS_KEY });
    },
    onError: (error, _input, context) => {
      if (context?.previousConfig) {
        queryClient.setQueryData(CONFIG_KEY, context.previousConfig);
      }
      setStatusError(errorMessage(error));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: CONFIG_KEY });
    },
  });
  if (configQuery.isPending) return <><Heading eyebrow="Operação / automação" title="Automação" /><LoadingPanel count={4} /></>;
  if (configQuery.isError || !configQuery.data) return <><Heading eyebrow="Operação / automação" title="Automação" /><QueryError error={configQuery.error} retry={() => void configQuery.refetch()} /></>;
  const config = configQuery.data;
  const draft = form ?? makeInput(config);
  const accounts = accountsQuery.data?.items ?? [];
  const selected = accounts.find(item => item.id === draft.botUserId && !item.testAccount);
  const savedStatus = config.operatorRules.status;
  const accountReady = Boolean(selected);
  const walletCents = selected?.walletBalanceCents ?? (config.botUserId === draft.botUserId ? config.botWalletBalanceCents : 0);
  const realBids = (eventsQuery.data?.items ?? []).filter(event => event.eventType === "bid");
  const disputeItems = disputesQuery.data?.items ?? [];
  const activeDisputes = disputeItems.filter(item => item.status === "live" || item.status === "paused");
  const scheduledDisputes = disputeItems.filter(item => item.status === "scheduled").slice(0, 3);
  const recentResults = disputeItems.filter(item => item.status === "ended").slice(0, 8);
  const draftReady = Boolean(accountReady && (draft.operatorRules.opening.on || draft.operatorRules.counter.on));
  const setDraft = (next: AutomationConfigInput) => { setForm(next); setDirty(true); setFeedback(""); setValidation(null); };
  const patchRule = (key: AutomationRuleKey, patch: Partial<AutomationConfigInput["operatorRules"][AutomationRuleKey]>) => {
    setDraft({ ...draft, operatorRules: { ...draft.operatorRules, [key]: { ...draft.operatorRules[key], ...patch } } });
  };
  const updateStatus = (status: AutomationStatus) => {
    if (status === savedStatus || changeStatus.isPending) return;
    setStatusError(""); setFeedback("");
    const savedInput = makeInput(config);
    changeStatus.mutate(toInputWithRules(savedInput, status));
  };
  const checkConfiguration = () => {
    const messages: string[] = [];
    if (!accountReady) messages.push("Escolha uma conta real para a automação.");
    if (selected?.testAccount) messages.push("Contas de teste não podem ser selecionadas.");
    if (!(draft.operatorRules.opening.on || draft.operatorRules.counter.on)) messages.push("Ative Lance, Contralance ou ambos.");
    for (const key of ["opening", "counter"] as const) {
      const rule = draft.operatorRules[key];
      if (rule.on && rule.trigger === "final" && (!Number.isInteger(rule.seconds) || rule.seconds < 0 || rule.seconds > 60)) messages.push(`${key === "opening" ? "Lance" : "Contralance"}: segundos restantes devem estar entre 0 e 60.`);
      if (rule.on && (!Number.isInteger(rule.multiplier) || rule.multiplier < 1 || rule.multiplier > 1000)) messages.push(`${key === "opening" ? "Lance" : "Contralance"}: múltiplo deve estar entre 1 e 1000.`);
    }
    if (Object.values(draft.operatorRules.limits).some(value => !Number.isInteger(value) || value < 0)) messages.push("Os limites devem ser inteiros iguais ou maiores que zero.");
    if (accountReady && walletCents <= 0) messages.push("A carteira real está sem saldo; não há teto disponível para lances.");
    setValidation({ ok: messages.length === 0, messages });
  };
  const statusLabel = statusOptions.find(option => option.value === savedStatus)?.label ?? "Desativada";
  const statusTone = savedStatus === "ativa" ? "active" : savedStatus === "pausada" ? "paused" : "off";
  const accountName = selected?.publicName || (config.botUserId === draft.botUserId ? config.botName : "Selecione uma conta");
  const winCount = selected?.wonDisputeCount ?? 0;
  const wonTotal = selected?.wonPrizeTotalCents ?? 0;
  const botLeadingCount = activeDisputes.filter(item => item.status === "live" && item.automationBotLeading).length;
  const statusBusy = changeStatus.isPending;
  const statusActions: Array<{
    id: "start" | "resume" | "pause" | "stop";
    status: AutomationStatus;
    label: string;
    icon: typeof Play;
    style: "primary" | "secondary" | "danger";
  }> = savedStatus === "ativa"
    ? [
        { id: "pause", status: "pausada", label: "Pausar", icon: Pause, style: "secondary" },
        { id: "stop", status: "desativada", label: "Parar", icon: Square, style: "danger" },
      ]
    : savedStatus === "pausada"
      ? [
          { id: "resume", status: "ativa", label: "Retomar", icon: Play, style: "primary" },
          { id: "stop", status: "desativada", label: "Parar", icon: Square, style: "danger" },
        ]
      : [{ id: "start", status: "ativa", label: "Iniciar", icon: Play, style: "primary" }];
  return <div className="automation-page automation-console appear" data-testid="automation-console">
    <Heading eyebrow="Operação / automação" title="Automação" description="Acompanhe disputas, lances e resultados, e controle o bot sem sair desta tela." />
    {configQuery.isFetching && <div className="refresh-note"><span className="pulse-dot" /> Atualizando configuração…</div>}
    {feedback && <div className="automation-feedback" role="status"><Check size={15} />{feedback}</div>}
    {statusError && <div className="automation-message error" role="alert">{statusError}</div>}

    <section className="prototype-section automation-block" data-testid="automation-status">
      <div className="ey">Status da automação</div>
      <div className="automation-state-summary">
        <div>
          <span className={`automation-state-dot ${statusTone}`} />
          <strong className="automation-status-value" aria-live="polite">{statusLabel}</strong>
          <span className="automation-status-caption">
            {statusBusy
              ? "Atualizando status…"
              : savedStatus === "ativa"
                ? "Dando lances conforme as regras."
                : savedStatus === "pausada"
                  ? "Sem dar lances, configuração mantida."
                  : "Automação desligada."}
          </span>
        </div>
        <div className="automation-status-actions" role="group" aria-label="Ações da automação">
          {statusActions.map(action => {
            const Icon = action.icon;
            const actionPending =
              statusBusy &&
              changeStatus.variables?.operatorRules.status === action.status;
            return <button key={action.id} type="button" className={`btn automation-status-action ${action.style}`} disabled={statusBusy || (action.status === "ativa" && !config.canEnable)} onClick={() => updateStatus(action.status)} data-testid={`automation-action-${action.id}`}><Icon size={17} />{actionPending ? "Atualizando…" : action.label}</button>;
          })}
        </div>
      </div>
      {!config.canEnable && savedStatus !== "ativa" && config.blockedReasons.length > 0 && <div className="automation-blocked" role="note"><strong>Para ativar:</strong> {config.blockedReasons.join(" ")}</div>}
      <p className="prototype-note">O status muda na hora, sem salvar. Pausada: para de dar lances e mantém a configuração. Desativada: automação desligada.</p>
    </section>

    <section className="prototype-section automation-block" data-testid="automation-account-section">
      <div className="ey">Conta da automação</div>
      {accountsQuery.isPending ? <div className="skeleton-card automation-account-loading" aria-label="Carregando contas" />
        : accountsQuery.isError ? <QueryError error={accountsQuery.error} retry={() => void accountsQuery.refetch()} />
        : <label className="automation-select-label" htmlFor="automation-account-select">Conta real
          <Select value={draft.botUserId ?? ""} onValueChange={value => setDraft({ ...draft, botUserId: value || null })}>
            <SelectTrigger id="automation-account-select" className="field full automation-select automation-select-trigger" aria-label="Conta real da automação" disabled={save.isPending || changeStatus.isPending} data-testid="select-automation-account">
              <SelectValue placeholder="Selecione uma conta" />
            </SelectTrigger>
            <SelectContent className="automation-select-content" position="popper">
              {accounts.filter(account => !account.testAccount).map(account => <SelectItem key={account.id} value={account.id} className="automation-select-item">{account.publicName} · saldo {money(account.walletBalanceCents)}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>}
      <div className="automation-account-facts">
        <div className="automation-fact"><span>Saldo da carteira de créditos</span><strong data-testid="automation-wallet-balance">{selected || config.botUserId === draft.botUserId ? money(walletCents) : "—"}</strong><small>{accountName}</small></div>
        <div className="automation-fact"><span>Disputas vencidas pela conta</span><strong>{winCount.toLocaleString("pt-BR")} · {money(wonTotal)}</strong><small>Vitórias · prêmios vencidos</small></div>
      </div>
      <p className="prototype-note">Os lances usam os créditos desta conta e os prêmios vencidos ficam disponíveis para ela. O saldo real da carteira é sempre o teto absoluto de gasto, inclusive quando os limites estão sem limite.</p>
    </section>

    <section className="automation-operations-board" data-testid="automation-operations-board">
      <div className="automation-operations-heading">
        <div>
          <p className="ey">Central de operação</p>
          <h2>Disputas, lances e resultados</h2>
          <p>Veja o que está acontecendo agora, confira quem lidera e acompanhe o resultado de cada disputa.</p>
        </div>
        <div className={`automation-live-indicator ${realtimeConnected ? "connected" : "reconnecting"}`} role="status" aria-live="polite">
          <span />
          {realtimeConnected ? "Canal ao vivo conectado" : "Reconectando · atualização automática ativa"}
        </div>
      </div>
      <div className="automation-ops-metrics">
        <article><span>Disputas em andamento</span><strong>{disputesQuery.data ? activeDisputes.length : "—"}</strong></article>
        <article><span>Bot na liderança</span><strong>{disputesQuery.data ? botLeadingCount : "—"}</strong></article>
        <article><span>Lances do bot · últimos 100</span><strong>{eventsQuery.data ? realBids.length : "—"}</strong></article>
        <article><span>Vitórias da conta selecionada</span><strong>{selected ? winCount.toLocaleString("pt-BR") : "—"}</strong></article>
      </div>
      {disputesQuery.isPending && !disputesQuery.data
        ? <LoadingPanel count={2} />
        : disputesQuery.isError && !disputesQuery.data
          ? <QueryError error={disputesQuery.error} retry={() => void disputesQuery.refetch()} />
          : <div className="automation-operations-grid">
            <section className="automation-monitor-panel" data-testid="automation-active-disputes">
              <div className="automation-monitor-heading">
                <div><h3>Disputas em andamento</h3><p>As disputas ativas abrem os lances automaticamente para acompanhamento.</p></div>
                <span>{activeDisputes.length}</span>
              </div>
              {activeDisputes.length
                ? <div className="record-list">{activeDisputes.map(item => <DisputeRow key={item.id} item={item} monitoring expandOnMount={item.status === "live"} showDetailLink={false} />)}</div>
                : <Empty title="Nenhuma disputa em andamento" text="As disputas ativas aparecerão aqui com liderança e lances." />}
            </section>
            <section className="automation-monitor-panel" data-testid="automation-scheduled-disputes">
              <div className="automation-monitor-heading">
                <div><h3>Próximas disputas</h3><p>Disputas já agendadas para entrar em operação.</p></div>
                <span>{scheduledDisputes.length}</span>
              </div>
              {scheduledDisputes.length
                ? <div className="record-list">{scheduledDisputes.map(item => <DisputeRow key={item.id} item={item} monitoring showDetailLink={false} />)}</div>
                : <Empty title="Nenhuma disputa agendada" text="Não há uma próxima disputa registrada neste momento." />}
            </section>
            <section className="automation-monitor-panel automation-results-panel" data-testid="automation-dispute-results">
              <div className="automation-monitor-heading">
                <div><h3>Resultados recentes</h3><p>Vencedor, quantidade de lances do bot e resultado da automação.</p></div>
                <span>{recentResults.length}</span>
              </div>
              {recentResults.length
                ? <div className="record-list">{recentResults.map(item => <DisputeRow key={item.id} item={item} monitoring showDetailLink={false} />)}</div>
                : <Empty title="Sem resultados recentes" text="As disputas encerradas aparecerão aqui com o vencedor registrado." />}
            </section>
          </div>}
      <section className="prototype-section automation-block automation-bid-history automation-ops-bid-history" data-testid="automated-bid-history">
        <div className="prototype-section-head"><p className="ey">Lances do bot</p><span className="prototype-note">{eventsQuery.data ? `${realBids.length} eventos · últimos ${eventsLimit}` : "Eventos reais"}</span></div>
        {eventsQuery.isPending ? <div className="event-skeleton"><div className="skeleton" /><div className="skeleton" /><div className="skeleton" /></div>
          : eventsQuery.isError ? <QueryError error={eventsQuery.error} retry={() => void eventsQuery.refetch()} />
          : realBids.length ? <div className="event-list">{realBids.map(event => <article className="event-row event-bid" key={event.id} data-testid={`bid-row-${event.id}`}>
            <div className="event-mark"><Activity size={15} /></div><div className="event-body"><div className="event-title"><strong>{event.summary || "Lance automático"}</strong><span className="event-type bid">Lance do bot</span></div>
              <div className="event-text">{event.disputeNumber != null && <span>Disputa #{event.disputeNumber} · </span>}{event.amountCents != null && <span>{money(event.amountCents)} · </span>}{date(event.createdAt)}</div></div>
          </article>)}</div>
          : <Empty title="Nenhum lance automático ainda" text="Os registros aparecerão aqui quando houver eventos reais de lance." />}
      </section>
    </section>

    {([
      { key: "opening", title: "Lance", description: "Abre a disputa: dá o primeiro lance quando ninguém lançou ainda." },
      { key: "counter", title: "Contralance", description: "Cobre o lance de outro usuário quando ele lidera a disputa." },
    ] as const).map(ruleMeta => {
      const rule = draft.operatorRules[ruleMeta.key];
      const name = ruleMeta.key === "opening" ? "Lance" : "Contralance";
      return <section className={`prototype-section automation-block automation-rule ${rule.on ? "rule-enabled" : ""}`} key={ruleMeta.key} data-testid={`automation-rule-${ruleMeta.key}`}>
        <div className="automation-rule-heading"><div><div className="ey">{name}</div><p className="prototype-note">{ruleMeta.description}</p></div>
          <ToggleSwitch aria-label={`Ativar ${name}`} checked={rule.on} disabled={save.isPending || changeStatus.isPending} onCheckedChange={checked => patchRule(ruleMeta.key, { on: checked })} data-testid={`switch-automation-${ruleMeta.key}`} />
        </div>
        {rule.on && <div className="automation-rule-controls">
          <label className="config-field"><span>Gatilho</span>
            <Select value={rule.trigger} onValueChange={value => patchRule(ruleMeta.key, { trigger: value as "immediate" | "final" })}>
              <SelectTrigger className="field full automation-select-trigger" aria-label={`Gatilho de ${name}`} data-testid={`select-trigger-${ruleMeta.key}`}><SelectValue /></SelectTrigger>
              <SelectContent className="automation-select-content" position="popper">
                <SelectItem value="immediate" className="automation-select-item">{ruleMeta.key === "opening" ? "Imediato — ao iniciar a disputa" : "Imediato — assim que for superado"}</SelectItem>
                <SelectItem value="final" className="automation-select-item">Nos segundos finais</SelectItem>
              </SelectContent>
            </Select>
          </label>
          {rule.trigger === "final" && <label className="config-field"><span>Segundos restantes para agir</span><Input type="number" min="0" max="60" step="1" value={rule.seconds} onChange={event => patchRule(ruleMeta.key, { seconds: event.target.value === "" ? 0 : Number(event.target.value) })} data-testid={`input-seconds-${ruleMeta.key}`} /></label>}
          <label className="config-field"><span>Tamanho do lance (múltiplo do incremento mínimo de cada disputa)</span>
            <Select value={multipliers.includes(rule.multiplier as typeof multipliers[number]) ? String(rule.multiplier) : "custom"} onValueChange={value => {
              if (value === "custom") { setCustomMultiplier(previous => ({ ...previous, [ruleMeta.key]: true })); patchRule(ruleMeta.key, { multiplier: rule.multiplier }); }
              else { setCustomMultiplier(previous => ({ ...previous, [ruleMeta.key]: false })); patchRule(ruleMeta.key, { multiplier: Number(value) }); }
            }}>
              <SelectTrigger className="field full automation-select-trigger" aria-label={`Tamanho do lance de ${name}`} data-testid={`select-multiplier-${ruleMeta.key}`}><SelectValue /></SelectTrigger>
              <SelectContent className="automation-select-content" position="popper">
                {multipliers.map(value => <SelectItem key={value} value={String(value)} className="automation-select-item">{value === 1 ? "Lance mínimo (1x)" : `${value}x o lance mínimo`}</SelectItem>)}
                <SelectItem value="custom" className="automation-select-item">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </label>
          {customMultiplier[ruleMeta.key] && <label className="config-field"><span>Outro múltiplo</span><div className="automation-custom-mult"><Input type="number" min="1" max="1000" step="1" value={rule.multiplier} onChange={event => patchRule(ruleMeta.key, { multiplier: event.target.value === "" ? 1 : Number(event.target.value) })} data-testid={`input-custom-multiplier-${ruleMeta.key}`} /><span>x</span></div></label>}
        </div>}
      </section>;
    })}

    <section className="prototype-section automation-block" data-testid="automation-limits">
      <div className="ey">Limites</div>
      <p className="prototype-note">Valem para lance e contralance somados. Se o lance maior estourar um limite ou o saldo, o bot cai para o lance mínimo.</p>
      <div className="automation-limit-list">{limitRows.map(row => {
        const amount = draft.operatorRules.limits[row.key];
        const maximum = row.kind === "money" ? 100000000 : row.key === "bidsPerDay" ? 100000 : 10000;
        return <label className="automation-limit-row" key={row.key}>
          <span className="automation-limit-name">{row.label}<small>{row.unit}</small></span>
          <Input className="automation-limit-input" aria-label={`${row.label}${amount === 0 ? " — Sem limite" : ""}`} type="number" min="0" max={row.kind === "money" ? maximum / 100 : maximum} step={row.kind === "money" ? "0.1" : "1"} value={amount === 0 ? "" : row.kind === "money" ? (amount / 100).toString() : amount} placeholder="Sem limite" disabled={save.isPending} onChange={event => {
            const value = event.target.value === "" ? 0 : row.kind === "money" ? Math.round(Number(event.target.value) * 100) : Number(event.target.value);
            setDraft({ ...draft, operatorRules: { ...draft.operatorRules, limits: { ...draft.operatorRules.limits, [row.key]: value } } });
          }} data-testid={`input-limit-${row.key}`} />
          <span className={`limit-unbounded ${amount === 0 ? "is-unbounded" : ""}`} aria-label={amount === 0 ? "Sem limite" : undefined}>{amount === 0 ? "Sem limite" : row.kind === "money" ? money(amount) : amount.toLocaleString("pt-BR")}</span>
        </label>;
      })}</div>
      <div className="automation-limit-footer">
        <span>{dirty ? "Rascunho não salvo" : `Configuração salva · ${date(config.updatedAt)}`}</span>
        <Button className="btn primary automation-save-button" disabled={!dirty || save.isPending || changeStatus.isPending} onClick={() => { setSaveError(""); setFeedback(""); save.mutate(toInputWithRules(draft, savedStatus)); }} data-testid="button-save-automation">{save.isPending ? "Salvando…" : "Salvar configuração"} <Check size={14} /></Button>
      </div>
      {saveError && <div className="automation-message error" role="alert" data-testid="automation-save-error">{saveError}</div>}
    </section>

    <section className="prototype-section automation-block automation-test-section" data-testid="automation-test-section">
      <div className="ey">Teste</div>
      <p className="prototype-note">Valide a configuração e a conta real sem gerar lances, disputas ou qualquer dado. Esta checagem não altera o servidor.</p>
      <Button className="btn automation-test-button" type="button" onClick={checkConfiguration} data-testid="button-validate-automation"><ShieldCheck size={15} /> Validar configuração</Button>
      {validation && <div className={`automation-validation ${validation.ok ? "valid" : "invalid"}`} role={validation.ok ? "status" : "alert"} data-testid="automation-validation">
        {validation.ok ? <><CircleCheck size={16} /><span><strong>Configuração válida</strong><small>Conta real selecionada, regras coerentes e carteira verificada. Nenhuma disputa foi criada.</small></span></>
          : <><CircleAlert size={16} /><span><strong>Revisão necessária</strong><small>{validation.messages.join(" ")}</small></span></>}
      </div>}
    </section>

  </div>;
}
function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><ErrorBoundary><AuthGate /></ErrorBoundary></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}
export default App;
