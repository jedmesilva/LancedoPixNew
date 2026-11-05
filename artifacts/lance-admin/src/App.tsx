import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Route, Switch as RouteSwitch, useLocation, useParams, Router as WouterRouter } from 'wouter';
import {
  Activity, ArrowDownLeft, ArrowLeft, ArrowRight, Bot, Check,
  CircleAlert, CircleDollarSign, FileSearch, KeyRound, LayoutDashboard,
  LogOut, RefreshCw, Search, ShieldCheck, SlidersHorizontal, Wallet, X,
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
  getAdminTreasury, getAutomationConfig, listAdminDisputes, listAdminPayouts,
  listAutomationEvents, updateAutomationConfig, recordAutomationFunding,
} from './generated/adminApi';
import type {
  AdminDashboard, AdminDisputeSummary, AdminPayoutStatus, AutomationConfigInput, AutomationFundingInput,
} from './generated/adminApi.schemas';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, refetchInterval: 30_000, retry: 1, refetchOnWindowFocus: true } },
});
const SESSION_KEY = ['/api/admin/auth/session'];
const DASHBOARD_KEY = ['/api/admin/dashboard'];
const TREASURY_KEY = ['/api/admin/treasury'];
const CONFIG_KEY = ['/api/admin/automation/config'];
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
function Metric({ label, value, note, icon: Icon }: { label: string; value: string; note: string; icon: typeof Wallet }) {
  return <article className="panel stat-card"><div className="stat-icon"><Icon size={18} /></div><div className="stat-label">{label}</div><div className="stat-value" data-testid={`metric-${label.toLowerCase().replaceAll(' ', '-')}`}>{value}</div><div className="stat-foot">{note}</div></article>;
}
function DisputeRows({ items }: { items: AdminDisputeSummary[] }) {
  return <div className="table-wrap"><table className="table"><thead><tr><th>Disputa</th><th>Status</th><th>Participante do lance atual</th><th>Lances</th><th>Prêmio</th><th>Criada</th><th /></tr></thead><tbody>
    {items.map(item => <tr key={item.id}><td className="mono">#{item.number}</td><td><Status value={item.status} /></td><td>{item.leaderName || '—'}</td><td>{item.bidsCount}</td><td>{money(item.prizeCents)}</td><td>{date(item.createdAt)}</td><td><Link href={`/disputes/${encodeURIComponent(item.id)}`} className="table-link" data-testid={`link-dispute-${item.id}`}>Abrir <ArrowRight size={13} /></Link></td></tr>)}
  </tbody></table></div>;
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
  const [location] = useLocation();
  const isAuthError = session.error instanceof AdminApiError && (session.error.status === 401 || session.error.status === 403);
  useEffect(() => { if (isAuthError) queryClient.setQueryData(SESSION_KEY, { authenticated: false }); }, [isAuthError, queryClient]);

  if (session.isPending) return <main className="auth-loading"><div className="skeleton-card" /><div className="skeleton-card" /><span>Verificando sessão segura…</span></main>;
  if (session.data?.authenticated) return <Shell location={location} signOut={() => signOut.mutate()} signOutBusy={signOut.isPending} />;
  if (session.isError && !isAuthError) return <main className="login-page"><section className="login-art"><div className="login-logo"><span className="brand-mark">L</span> Lance do Pix <span className="login-tag">OPERAÇÕES</span></div><div><h1 className="login-headline">A operação,<br /><span>sob controle.</span></h1><p className="login-caption">Console interno de operação e acompanhamento da plataforma.</p></div><p className="login-foot">Acesso restrito a operadores autorizados.</p></section><section className="login-form-side"><div className="login-card"><div className="lock-icon"><ShieldCheck size={20} /></div><p className="eyebrow">Conexão protegida</p><h1>Console indisponível</h1><p>Não foi possível verificar a sessão agora.</p><QueryError error={session.error} retry={() => void session.refetch()} /></div></section></main>;
  return <main className="login-page">
    <section className="login-art"><div className="login-logo"><span className="brand-mark">L</span><span>Lance do Pix <small>OPERAÇÕES</small></span><span className="login-tag">ADMIN</span></div><div className="login-story"><p className="login-overline">AMBIENTE INTERNO · ACESSO RESTRITO</p><h1 className="login-headline">Visão clara.<br /><span>Decisão segura.</span></h1><p className="login-caption">Acompanhe disputas, caixa, resgates e automações num único lugar.</p></div><p className="login-foot">Este console é separado da experiência pública.</p><div className="login-orbit orbit-one" /><div className="login-orbit orbit-two" /></section>
    <section className="login-form-side"><form className="login-card" onSubmit={event => { event.preventDefault(); setSubmitError(''); if (!key.trim()) { setSubmitError('Informe a chave de acesso para continuar.'); return; } keyRef.current = key; setKey(''); login.mutate(); }}>
      <div className="lock-icon"><KeyRound size={20} /></div><p className="eyebrow">Identificação administrativa</p><h1>Entrar no console</h1><p>Use sua chave privada de operador. Ela será enviada somente ao servidor.</p>
      <label className="input-label" htmlFor="admin-key">Chave de acesso</label><Input id="admin-key" data-testid="input-admin-key" type="password" autoComplete="off" value={key} maxLength={512} onChange={event => setKey(event.target.value)} placeholder="Insira sua chave privada" disabled={login.isPending} />
      {submitError && <div className="inline-error" role="alert">{submitError}</div>}
      <Button className="btn primary login-submit" type="submit" disabled={login.isPending} data-testid="button-admin-login">{login.isPending ? 'Validando acesso…' : 'Acessar console'} <ArrowRight size={15} /></Button>
      <div className="lock-note"><ShieldCheck size={15} /><span>A chave não é salva neste dispositivo. A sessão é mantida por cookie seguro HttpOnly.</span></div>
    </form></section>
  </main>;
}
const navItems = [
  { href: '/', label: 'Visão geral', icon: LayoutDashboard },
  { href: '/disputes', label: 'Disputas', icon: FileSearch },
  { href: '/payouts', label: 'Resgates', icon: ArrowDownLeft },
  { href: '/treasury', label: 'Tesouraria', icon: Wallet },
  { href: '/automation', label: 'Automação', icon: Bot },
];
function Shell({ location, signOut, signOutBusy }: { location: string; signOut: () => void; signOutBusy: boolean }) {
  const [path] = useLocation();
  return <div className="shell">
    <aside className="sidebar"><div className="brand"><div className="brand-mark">L</div><div><div className="brand-name">Lance do Pix</div><div className="brand-sub">Console de operação</div></div></div>
      <div className="nav-label">Plataforma</div><nav className="navlist">{navItems.map(item => { const Icon = item.icon; const active = item.href === '/' ? path === '/' : path.startsWith(item.href); return <Link key={item.href} href={item.href} className={`navlink ${active ? 'active' : ''}`} data-testid={`nav-${item.label.toLowerCase().replaceAll(' ', '-')}`}><Icon size={17} />{item.label}</Link>; })}</nav>
      <div className="sidebar-bottom"><div className="bot-tile"><div className="bot-status"><span className="pulse-dot" /> Ambiente privado</div><div className="bot-note">Dados operacionais atualizados automaticamente.</div></div><button className="logout" onClick={signOut} disabled={signOutBusy} data-testid="button-admin-logout"><LogOut size={15} />{signOutBusy ? 'Encerrando…' : 'Encerrar sessão'}</button></div>
    </aside>
    <main className="main"><header className="topbar"><div className="crumb">Lance do Pix <span>/</span> <strong>{navItems.find(item => item.href === (path.startsWith('/disputes') ? '/disputes' : path))?.label || 'Operação'}</strong></div><div className="topbar-right"><span className="secure"><ShieldCheck size={14} /> Sessão segura</span><span className="operator-dot">OP</span></div></header>
      <div className="content"><RouteSwitch>
        <Route path="/" component={Overview} />
        <Route path="/disputes" component={DisputesPage} />
        <Route path="/disputes/:id" component={DisputeDetailPage} />
        <Route path="/payouts" component={PayoutsPage} />
        <Route path="/treasury" component={TreasuryPage} />
        <Route path="/automation" component={AutomationPage} />
        <Route component={NotFound} />
      </RouteSwitch></div>
    </main>
  </div>;
}
function Overview() {
  const query = useQuery({ queryKey: DASHBOARD_KEY, queryFn: getAdminDashboard });
  const dashboard = query.data as AdminDashboard | undefined;
  if (query.isPending) return <><Heading eyebrow="Painel operacional" title="Visão geral" description="Um retrato atual da operação." /><LoadingPanel /></>;
  if (query.isError || !dashboard) return <><Heading eyebrow="Painel operacional" title="Visão geral" /><QueryError error={query.error} retry={() => void query.refetch()} /></>;
  const treasury = dashboard.treasury;
  return <div className="appear">
    <Heading eyebrow="Painel operacional" title="Visão geral" description="Um retrato atual da operação. Os dados são atualizados periodicamente."><button className="btn" onClick={() => void query.refetch()} data-testid="button-refresh-dashboard"><RefreshCw size={14} /> Atualizar</button></Heading>
    <div className="grid stats">
      <Metric label="Conexões ativas" value={dashboard.activeConnections.toLocaleString('pt-BR')} note="Conectadas agora" icon={Activity} />
      <Metric label="Resgates pendentes" value={dashboard.pendingPayoutCount.toLocaleString('pt-BR')} note="Fila informada pela API" icon={ArrowDownLeft} />
      <Metric label="Caixa livre" value={money(treasury.freeCashCents)} note="Posição sem simulações" icon={CircleDollarSign} />
      <Metric label="Caixa liquidado" value={money(treasury.settledCashCents)} note="Valores efetivamente liquidados" icon={Wallet} />
    </div>
    <div className="grid dash-lower">
      <section className="panel current"><div className="current-label">Disputa em destaque</div>{dashboard.currentDispute ? <><h2 className="current-number">#{dashboard.currentDispute.number}</h2><div className="current-meta"><Status value={dashboard.currentDispute.status} /> <span> · {dashboard.currentDispute.bidsCount} lances</span></div><div className="current-value">{money(dashboard.currentDispute.currentValueCents)}</div><Link href={`/disputes/${encodeURIComponent(dashboard.currentDispute.id)}`} className="current-link">Ver detalhes <ArrowRight size={13} /></Link></> : <div className="current-empty">Nenhuma disputa ativa informada.</div>}</section>
      <section className="panel quick-panel"><div className="section-head"><h2 className="section-title">Visão de caixa</h2><Link href="/treasury" className="small-link">Detalhes <ArrowRight size={13} /></Link></div><div className="quick-line"><span>Saídas de caixa</span><strong>{money(treasury.cashOutflowsCents)}</strong></div><div className="quick-line"><span>Carteiras bloqueadas</span><strong>{money(treasury.lockedWalletCents)}</strong></div><div className="quick-line"><span>Prêmios não pagos</span><strong>{money(treasury.unpaidPrizeCents)}</strong></div><div className="quick-line"><span>Bônus reservados</span><strong>{money(treasury.reservedBonusCents)}</strong></div><p className="data-footnote">Posição real · sem valores simulados</p></section>
    </div>
    <section className="panel section-panel"><div className="section-head"><div><p className="eyebrow">Histórico recente</p><h2 className="section-title">Disputas</h2></div><Link href="/disputes" className="small-link">Pesquisar disputas <ArrowRight size={13} /></Link></div>{dashboard.recentDisputes.length ? <DisputeRows items={dashboard.recentDisputes} /> : <Empty title="Sem disputas recentes" text="A API não retornou disputas para este painel." />}</section>
  </div>;
}
function DisputesPage() {
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 20;
  const query = useQuery({ queryKey: ['/api/admin/disputes', { q, limit, offset }], queryFn: () => listAdminDisputes({ q: q || undefined, limit, offset }) });
  const total = query.data?.total || 0;
  return <><Heading eyebrow="Pesquisa e histórico" title="Disputas" description="Consulte disputas e seus registros operacionais." />
    <form className="panel toolbar" onSubmit={event => { event.preventDefault(); setOffset(0); setQ(input.trim()); }}><div className="search-wrap"><Search size={16} /><Input className="search" aria-label="Pesquisar disputas" data-testid="input-dispute-search" placeholder="Buscar por número, ID ou termo" maxLength={100} value={input} onChange={event => setInput(event.target.value)} /></div><Button className="btn primary" type="submit" data-testid="button-search-disputes"><Search size={14} /> Pesquisar</Button>{q && <button type="button" className="btn" onClick={() => { setInput(''); setQ(''); setOffset(0); }}><X size={14} /> Limpar</button>}</form>
    {query.isPending ? <LoadingPanel /> : query.isError ? <QueryError error={query.error} retry={() => void query.refetch()} /> : query.data?.items.length ? <><section className="panel"><div className="section-head"><h2 className="section-title">Resultados <span className="total-count">{total.toLocaleString('pt-BR')}</span></h2><span className="section-kicker">{offset + 1}–{Math.min(offset + limit, total)} de {total}</span></div><DisputeRows items={query.data.items} /></section><Pagination offset={offset} limit={limit} total={total} setOffset={setOffset} /></> : <section className="panel"><Empty title="Nenhuma disputa encontrada" text={q ? 'Tente outro termo de pesquisa.' : 'Ainda não há disputas disponíveis no histórico.'} /></section>}
  </>;
}
function Pagination({ offset, limit, total, setOffset }: { offset: number; limit: number; total: number; setOffset: (n: number) => void }) {
  return <div className="pagination"><span>{total.toLocaleString('pt-BR')} registros</span><div><button className="btn" onClick={() => setOffset(Math.max(0, offset - limit))} disabled={offset === 0} data-testid="button-page-prev"><ArrowLeft size={14} /> Anterior</button><button className="btn" onClick={() => setOffset(offset + limit)} disabled={offset + limit >= total} data-testid="button-page-next">Próxima <ArrowRight size={14} /></button></div></div>;
}
function DisputeDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const decoded = decodeURIComponent(id);
  const query = useQuery({ queryKey: ['/api/admin/disputes', decoded], queryFn: () => getAdminDispute(decoded), enabled: !!decoded });
  if (query.isPending) return <><Link href="/disputes" className="back-link"><ArrowLeft size={14} /> Voltar às disputas</Link><div className="spacer" /><LoadingPanel /></>;
  if (query.isError || !query.data) return <><Link href="/disputes" className="back-link"><ArrowLeft size={14} /> Voltar às disputas</Link><div className="spacer" /><QueryError error={query.error} retry={() => void query.refetch()} /></>;
  const dispute = query.data.dispute;
  return <div className="appear"><Link href="/disputes" className="back-link"><ArrowLeft size={14} /> Voltar às disputas</Link><div className="spacer" /><Heading eyebrow={`Disputa #${dispute.number}`} title="Detalhes da disputa" description={`Criada em ${date(dispute.createdAt)}`}><Status value={dispute.status} /></Heading>
    <div className="grid detail-grid"><div className="panel detail-metric">Prêmio<strong>{money(dispute.prizeCents)}</strong></div><div className="panel detail-metric">Lance atual<strong>{money(dispute.currentValueCents)}</strong></div><div className="panel detail-metric">Incremento<strong>{money(dispute.stepCents)}</strong></div><div className="panel detail-metric">Total de lances<strong>{dispute.bidsCount.toLocaleString('pt-BR')}</strong></div><div className="panel detail-metric">Início<strong>{date(dispute.startedAt)}</strong></div><div className="panel detail-metric">Encerramento<strong>{date(dispute.endedAt)}</strong></div></div>
    <section className="panel section-panel"><div className="section-head"><div><p className="eyebrow">Histórico público</p><h2 className="section-title">Lances registrados</h2></div><span className="section-kicker">{query.data.bids.length} eventos</span></div>{query.data.bids.length ? <div className="table-wrap"><table className="table"><thead><tr><th>Participante</th><th>Valor</th><th>Custo</th><th>Resultado</th><th>Data</th></tr></thead><tbody>{query.data.bids.map(bid => <tr key={bid.id}><td>{bid.automated ? <span className="bot-name"><Bot size={14} /> {bid.bidderName} <Badge variant="secondary">Participante automatizado da plataforma</Badge></span> : bid.bidderName}</td><td>{money(bid.amountCents)}</td><td>{money(bid.costCents)}</td><td>{bid.result ? <span className={`result-pill ${bid.result}`}>{bid.result === 'won' ? 'Venceu' : 'Não venceu'}</span> : '—'}</td><td>{date(bid.createdAt)}</td></tr>)}</tbody></table></div> : <Empty title="Sem lances registrados" text="A API não retornou lances para esta disputa." />}</section>
  </div>;
}
function PayoutsPage() {
  const [status, setStatus] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 20;
  const query = useQuery({ queryKey: ['/api/admin/payouts', { status, limit, offset }], queryFn: () => listAdminPayouts({ status: (status || undefined) as AdminPayoutStatus | undefined, limit, offset }) });
  const total = query.data?.total || 0;
  return <><Heading eyebrow="Solicitações e status" title="Resgates" description="Acompanhe a fila de solicitações e seus estados atuais." />
    <div className="panel toolbar"><label className="filter-label" htmlFor="payout-status"><SlidersHorizontal size={15} /> Filtrar status</label><select id="payout-status" className="field" value={status} onChange={event => { setStatus(event.target.value); setOffset(0); }} data-testid="select-payout-status"><option value="">Todos os status</option><option value="requested">Solicitado</option><option value="under_review">Em análise</option><option value="paid">Pago</option><option value="rejected">Recusado</option></select><span className="section-kicker">{total.toLocaleString('pt-BR')} solicitações</span></div>
    {query.isPending ? <LoadingPanel /> : query.isError ? <QueryError error={query.error} retry={() => void query.refetch()} /> : query.data?.items.length ? <><section className="panel"><div className="table-wrap"><table className="table"><thead><tr><th>Solicitante</th><th>Status</th><th>Valor</th><th>Prêmio</th><th>Bônus</th><th>Chave Pix</th><th>Solicitado</th><th>Atualizado</th></tr></thead><tbody>{query.data.items.map(payout => <tr key={payout.id}><td>{payout.userName}</td><td><Status value={payout.status} /></td><td>{money(payout.amountCents)}</td><td>{money(payout.prizeCents)}</td><td>{money(payout.bonusCents)}</td><td><span className="key-type">{payout.pixKeyType}</span></td><td>{date(payout.requestedAt)}</td><td>{date(payout.updatedAt)}</td></tr>)}</tbody></table></div></section><Pagination offset={offset} limit={limit} total={total} setOffset={setOffset} /></> : <section className="panel"><Empty title="Fila vazia" text="A API não retornou solicitações com este filtro." /></section>}
  </>;
}
function TreasuryPage() {
  const query = useQuery({ queryKey: TREASURY_KEY, queryFn: getAdminTreasury });
  if (query.isPending) return <><Heading eyebrow="Posição financeira" title="Tesouraria" description="Valores reais de caixa; simulações não são incluídas." /><LoadingPanel /></>;
  if (query.isError || !query.data) return <><Heading eyebrow="Posição financeira" title="Tesouraria" /><QueryError error={query.error} retry={() => void query.refetch()} /></>;
  const data = query.data;
  return <><Heading eyebrow="Posição financeira" title="Tesouraria" description="Posição informada pela API administrativa."><button className="btn" onClick={() => void query.refetch()} data-testid="button-refresh-treasury"><RefreshCw size={14} /> Atualizar posição</button></Heading>
    <div className="treasury-banner"><div className="treasury-icon"><Wallet size={20} /></div><div><span>Caixa livre</span><strong>{money(data.freeCashCents)}</strong><small>Liquidez disponível segundo a posição atual</small></div><div className="real-pill"><Check size={13} /> Dados reais</div></div>
    <div className="treasury-columns"><section className="treasury-ledger"><div className="ledger-head"><span>POSIÇÃO DE CAIXA</span><span>VALOR</span></div><LedgerRow title="Caixa liquidado" detail="Valores efetivamente liquidados" value={data.settledCashCents} tone="positive" /><LedgerRow title="Saídas de caixa" detail="Pagamentos e saídas registrados" value={data.cashOutflowsCents} /><LedgerRow title="Carteiras bloqueadas" detail="Saldo retido em carteiras" value={data.lockedWalletCents} /><LedgerRow title="Prêmios não pagos" detail="Obrigações de prêmio em aberto" value={data.unpaidPrizeCents} /><LedgerRow title="Bônus reservados" detail="Bônus comprometidos" value={data.reservedBonusCents} /><div className="ledger-foot"><span>Caixa livre</span><strong>{money(data.freeCashCents)}</strong></div></section><aside className="panel treasury-aside"><div className="aside-emblem"><ShieldCheck size={19} /></div><h2>Sem estimativas</h2><p>A tesouraria exibe apenas os valores retornados pela API. Nenhum saldo foi projetado ou simulado.</p><div className="truth-stamp">INCLUDES SIMULATED <strong>{data.includesSimulated ? 'SIM' : 'NÃO'}</strong></div></aside></div>
  </>;
}
function LedgerRow({ title, detail, value, tone }: { title: string; detail: string; value: number; tone?: string }) {
  return <div className="ledger-row"><div><strong>{title}</strong><small>{detail}</small></div><span className={tone || ''}>{money(value)}</span></div>;
}
const automationModes: Array<{
  value: AutomationConfigInput["mode"];
  label: string;
  detail: string;
}> = [
  {
    value: "counterbids_only",
    label: "Só contralances",
    detail: "Responde aos lances de outros participantes.",
  },
  {
    value: "bids_and_counterbids",
    label: "Lances e contralances",
    detail: "Abre disputas sem lance e responde a outros participantes.",
  },
  {
    value: "bids_only",
    label: "Só lances",
    detail: "Abre disputas sem lance, sem responder a outros participantes.",
  },
];
const defaultConfig: AutomationConfigInput = { enabled: false, mode: "counterbids_only", maxBidCents: 0, perDisputeLimitCents: 0, dailyLimitCents: 0, maxBidsPerDispute: 0, minimumSecondsRemaining: 1, minimumDelaySeconds: 1 };
function AutomationPage() {
  const queryClient = useQueryClient();
  const configQuery = useQuery({ queryKey: CONFIG_KEY, queryFn: getAutomationConfig });
  const eventsQuery = useQuery({ queryKey: EVENTS_KEY, queryFn: () => listAutomationEvents({ limit: 30, offset: 0 }) });
  const [form, setForm] = useState<AutomationConfigInput>(defaultConfig);
  const [fundingAmount, setFundingAmount] = useState('');
  const [receipt, setReceipt] = useState('');
  const [cashConfirmed, setCashConfirmed] = useState(false);
  const [fundingResult, setFundingResult] = useState('');
  const [formError, setFormError] = useState('');
  useEffect(() => { const data = configQuery.data; if (data) setForm({ enabled: data.enabled, mode: data.mode, maxBidCents: data.maxBidCents, perDisputeLimitCents: data.perDisputeLimitCents, dailyLimitCents: data.dailyLimitCents, maxBidsPerDispute: data.maxBidsPerDispute, minimumSecondsRemaining: data.minimumSecondsRemaining, minimumDelaySeconds: data.minimumDelaySeconds }); }, [configQuery.data]);
  const update = useMutation({
    mutationFn: (input: AutomationConfigInput) => updateAutomationConfig(input),
    onSuccess: data => { queryClient.setQueryData(CONFIG_KEY, data); void queryClient.invalidateQueries({ queryKey: EVENTS_KEY }); void queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY }); },
    onError: error => setFormError(errorMessage(error)),
  });
  const fund = useMutation({
    mutationFn: (input: AutomationFundingInput) => recordAutomationFunding(input),
    onSuccess: result => {
      setFundingResult(`Crédito registrado: ${money(result.amountCents)} · saldo informado ${money(result.botWalletBalanceCents)}.`);
      setFundingAmount(''); setReceipt(''); setCashConfirmed(false);
      queryClient.setQueryData(CONFIG_KEY, (old: typeof configQuery.data) => old ? { ...old, botWalletBalanceCents: result.botWalletBalanceCents } : old);
      void queryClient.invalidateQueries({ queryKey: EVENTS_KEY }); void queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY });
    },
  });
  if (configQuery.isPending) return <><Heading eyebrow="Participante automatizado" title="Automação" description="Configuração e histórico do bot da plataforma." /><LoadingPanel /></>;
  if (configQuery.isError || !configQuery.data) return <><Heading eyebrow="Participante automatizado" title="Automação" /><QueryError error={configQuery.error} retry={() => void configQuery.refetch()} /></>;
  const config = configQuery.data;
  const setNumber = (key: keyof AutomationConfigInput, raw: string) => setForm(previous => ({ ...previous, [key]: raw === '' ? 0 : Number(raw) }));
  const configValid = form.maxBidCents >= 0 && form.maxBidCents <= 100000000
    && form.perDisputeLimitCents >= 0 && form.perDisputeLimitCents <= 100000000
    && form.dailyLimitCents >= 0 && form.dailyLimitCents <= 100000000
    && form.maxBidsPerDispute >= 0 && form.maxBidsPerDispute <= 10000
    && form.minimumSecondsRemaining >= 1 && form.minimumSecondsRemaining <= 60
    && form.minimumDelaySeconds >= 1 && form.minimumDelaySeconds <= 3600;
  return <><Heading eyebrow="Participante automatizado" title="Automação" description="O bot é um participante automatizado da plataforma, não um operador humano."><span className="bot-identity"><Bot size={16} /> {config.botName}</span></Heading>
    {configQuery.isFetching && <div className="refresh-note"><span className="pulse-dot" /> Atualizando dados de automação…</div>}
    <div className="notice"><CircleAlert size={16} /><span>Este participante automatizado pode aparecer no histórico público de lances. Os controles e limites abaixo são exatamente os valores devolvidos pela API.</span></div>
    {!config.botExists && <div className="notice notice-error"><CircleAlert size={16} /><span>A API informa que o participante automatizado ainda não existe.</span></div>}
    <div className="grid automation-layout">
      <section className="panel config-panel"><div className="section-head"><div><p className="eyebrow">Parâmetros do participante</p><h2 className="section-title">Controles de automação</h2></div><span className={`state-chip ${config.enabled ? 'state-on' : ''}`}><i />{config.enabled ? 'Ativa' : 'Desativada'}</span></div>
        <div className="toggle-row"><div><strong>Automação habilitada</strong><small>Estado atual informado pelo serviço</small></div><ToggleSwitch checked={form.enabled} disabled={(!config.canEnable && !form.enabled) || update.isPending} onCheckedChange={(checked: boolean) => setForm(previous => ({ ...previous, enabled: checked }))} data-testid="switch-automation-enabled" /></div>
        {!config.canEnable && config.blockedReasons.length > 0 && <div className="blocked-list"><strong>Não pode ser habilitada</strong>{config.blockedReasons.map((reason, index) => <div key={`${index}-${reason}`}><CircleAlert size={13} />{reason}</div>)}</div>}
        <fieldset className="automation-mode-group" disabled={update.isPending}>
          <legend>Quais ações o bot pode fazer?</legend>
          <div className="automation-mode-list">
            {automationModes.map(mode => <label className={`automation-mode-option ${form.mode === mode.value ? 'selected' : ''}`} key={mode.value}>
              <input type="radio" name="automation-mode" value={mode.value} checked={form.mode === mode.value} onChange={() => setForm(previous => ({ ...previous, mode: mode.value }))} data-testid={`radio-automation-mode-${mode.value}`} />
              <span><strong>{mode.label}</strong><small>{mode.detail}</small></span>
            </label>)}
          </div>
        </fieldset>
        <div className="config-grid">{([
          ['maxBidCents', 'Lance máximo (centavos)', 0, 100000000],
          ['perDisputeLimitCents', 'Limite por disputa (centavos)', 0, 100000000],
          ['dailyLimitCents', 'Limite diário (centavos)', 0, 100000000],
          ['maxBidsPerDispute', 'Máx. lances por disputa', 0, 10000],
          ['minimumSecondsRemaining', 'Segundos mínimos restantes', 1, 60],
          ['minimumDelaySeconds', 'Intervalo mínimo (segundos)', 1, 3600],
        ] as const).map(([key, label, min, max]) => <label className="config-field" key={key}><span>{label}</span><Input type="number" min={min} max={max} value={form[key]} onChange={event => setNumber(key, event.target.value)} data-testid={`input-${key}`} /></label>)}</div>
        {formError && <div className="inline-error" role="alert">{formError}</div>}
        {!configValid && <div className="inline-error" role="alert">Revise os valores: um ou mais parâmetros estão fora dos limites permitidos.</div>}
        <div className="config-footer"><span>Atualizado: {date(config.updatedAt)}</span><Button className="btn primary" disabled={update.isPending || !configValid || (form.enabled && !config.canEnable)} onClick={() => { setFormError(''); update.mutate(form); }} data-testid="button-save-automation">{update.isPending ? 'Salvando…' : 'Salvar configuração'} <Check size={14} /></Button></div>
      </section>
      <div className="side-stack">
        <section className="panel wallet-panel"><div className="section-head"><div><p className="eyebrow">Saldo do participante</p><h2 className="section-title">Carteira automatizada</h2></div><Bot size={18} className="soft-icon" /></div><div className="wallet-balance">{money(config.botWalletBalanceCents)}</div><p>Saldo informado pelo serviço, sem estimativas.</p><div className="funding-divider" /><h3 className="mini-title">Registrar aporte recebido</h3><p className="field-hint">Registre somente após confirmar o recebimento real.</p>
          <label className="input-label" htmlFor="fund-amount">Valor (centavos)</label><Input id="fund-amount" type="number" min="1" max="100000000" value={fundingAmount} onChange={event => setFundingAmount(event.target.value)} data-testid="input-funding-amount" placeholder="Ex.: 5000" />
          <label className="input-label" htmlFor="receipt-reference">Referência do comprovante</label><Input id="receipt-reference" minLength={3} maxLength={120} value={receipt} onChange={event => setReceipt(event.target.value)} data-testid="input-funding-reference" placeholder="Identificador do comprovante" />
          <label className="confirm-row"><input type="checkbox" checked={cashConfirmed} onChange={event => setCashConfirmed(event.target.checked)} data-testid="checkbox-cash-confirmed" /> Confirmo que o valor foi recebido.</label>
          {fundingResult && <p className="success-note"><Check size={14} />{fundingResult}</p>}
          {fund.isError && <div className="inline-error" role="alert">{errorMessage(fund.error)}</div>}
          <Button className="btn primary full-button" disabled={fund.isPending || !cashConfirmed || Number(fundingAmount) < 1 || receipt.trim().length < 3} onClick={() => fund.mutate({ amountCents: Number(fundingAmount), receiptReference: receipt.trim(), cashReceived: true })} data-testid="button-record-funding">{fund.isPending ? 'Registrando…' : 'Confirmar aporte'} <ArrowRight size={14} /></Button>
        </section>
      </div>
    </div>
    <section className="panel section-panel events-panel"><div className="section-head"><div><p className="eyebrow">Registro de atividade</p><h2 className="section-title">Histórico da automação</h2></div><span className="section-kicker">{eventsQuery.data?.total ?? '—'} eventos</span></div>
      {eventsQuery.isPending ? <div className="event-skeleton"><div className="skeleton" /><div className="skeleton" /><div className="skeleton" /></div> : eventsQuery.isError ? <QueryError error={eventsQuery.error} retry={() => void eventsQuery.refetch()} /> : eventsQuery.data?.items.length ? <div className="event-list">{eventsQuery.data.items.map(event => <div className="event-row" key={event.id}><div className="event-mark">{event.eventType === 'funding' ? <CircleDollarSign size={14} /> : event.eventType === 'bid' ? <ArrowDownLeft size={14} /> : <Activity size={14} />}</div><div className="event-body"><div className="event-title"><strong>{event.summary}</strong><span className={`event-type ${event.eventType}`}>{event.eventType.replaceAll('_', ' ')}</span></div><div className="event-text">{event.disputeNumber != null && <span>Disputa #{event.disputeNumber} · </span>}{event.amountCents != null && <span>{money(event.amountCents)} · </span>}<span>{date(event.createdAt)}</span></div></div></div>)}</div> : <Empty title="Sem eventos registrados" text="A API não retornou eventos para o histórico de automação." />}
    </section>
  </>;
}
function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><ErrorBoundary><AuthGate /></ErrorBoundary></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}
export default App;
