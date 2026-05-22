import React, { useState, useEffect, FormEvent } from 'react';
import { 
  Wrench, 
  ClipboardList, 
  CheckCircle, 
  Clock, 
  LogIn, 
  LogOut, 
  Plus, 
  Search, 
  AlertTriangle, 
  Trash2, 
  Database, 
  Copy, 
  Check, 
  User as UserIcon, 
  ShieldAlert, 
  Tag, 
  MapPin, 
  ArrowRight,
  Filter,
  X,
  FileCode,
  HardHat,
  ChevronDown,
  CheckSquare
} from 'lucide-react';
import { Ticket, TicketPriority, User, UserRole } from './types';
import { ticketService, isSupabaseConfigured, SUPABASE_SQL_SCHEMA } from './lib/supabase';

export default function App() {
  // Authentication state (checked against sessionStorage first)
  const [user, setUser] = useState<User | null>(() => {
    const saved = sessionStorage.getItem('sistema_chamados_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');

  // Tickets state
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Filter and Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'todos' | 'aberto' | 'concluido'>('todos');
  const [filterPriority, setFilterPriority] = useState<'todos' | 'baixa' | 'media' | 'alta'>('todos');

  // Operator form states
  const [isNewTicketOpen, setIsNewTicketOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newSector, setNewSector] = useState('');
  const [newPriority, setNewPriority] = useState<TicketPriority>('media');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Mechanic form states (for specific tickets being completed)
  const [resolvingTicketId, setResolvingTicketId] = useState<string | null>(null);
  const [solucaoInput, setSolucaoInput] = useState('');

  // SQL Schema Modal State
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Ticket being confirmed for deletion
  const [deletingTicketId, setDeletingTicketId] = useState<string | null>(null);

  // Load tickets on mount and whenever authentication changes
  useEffect(() => {
    if (user) {
      loadTickets();
    }
  }, [user]);

  // Automatic feedback cleanup after 5 seconds
  useEffect(() => {
    if (feedbackMessage) {
      const timer = setTimeout(() => {
        setFeedbackMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [feedbackMessage]);

  const loadTickets = async () => {
    setIsLoading(true);
    try {
      const data = await ticketService.getTickets();
      setTickets(data);
    } catch (err) {
      showFeedback('Erro ao carregar chamados. Verifique a tabela no banco.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const showFeedback = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setFeedbackMessage({ text, type });
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const normalizedUser = usernameInput.trim().toLowerCase();

    if (normalizedUser === 'operador' && passwordInput === 'operador123') {
      const loggedUser: User = { username: 'operador', role: 'operador', name: 'Operador Principal' };
      setUser(loggedUser);
      sessionStorage.setItem('sistema_chamados_user', JSON.stringify(loggedUser));
      showFeedback('Bem-vindo, Operador!', 'success');
    } else if (normalizedUser === 'mecanico' && passwordInput === 'mecanico123') {
      const loggedUser: User = { username: 'mecanico', role: 'mecanico', name: 'Mecânico Residente' };
      setUser(loggedUser);
      sessionStorage.setItem('sistema_chamados_user', JSON.stringify(loggedUser));
      showFeedback('Bem-vindo, Mecânico!', 'success');
    } else {
      setLoginError('Credenciais incorretas. Tente novamente.');
    }
  };

  // Quick fill logins for testing the applet seamlessly
  const fillCredentialsAndLogin = (role: 'operador' | 'mecanico') => {
    if (role === 'operador') {
      setUsernameInput('operador');
      setPasswordInput('operador123');
    } else {
      setUsernameInput('mecanico');
      setPasswordInput('mecanico123');
    }
  };

  const handleLogout = () => {
    setUser(null);
    sessionStorage.removeItem('sistema_chamados_user');
    setUsernameInput('');
    setPasswordInput('');
    setIsNewTicketOpen(false);
    setResolvingTicketId(null);
    showFeedback('Sessão encerrada com sucesso.', 'info');
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDesc.trim() || !newSector.trim()) {
      showFeedback('Por favor, preencha todos os campos obrigatórios.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await ticketService.createTicket({
        titulo: newTitle.trim(),
        descricao: newDesc.trim(),
        setor: newSector.trim(),
        prioridade: newPriority,
        operador: user?.name || 'operador'
      });
      
      showFeedback('Chamado aberto com sucesso!', 'success');
      
      // Reset form fields
      setNewTitle('');
      setNewDesc('');
      setNewSector('');
      setNewPriority('media');
      setIsNewTicketOpen(false);

      // Refresh list
      await loadTickets();
    } catch (err) {
      showFeedback('Ocorreu um erro ao abrir o chamado.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolveTicket = async (e: React.FormEvent, ticketId: string) => {
    e.preventDefault();
    if (!solucaoInput.trim()) {
      showFeedback('O mecânico deve fornecer detalhes do que foi feito.', 'error');
      return;
    }

    try {
      await ticketService.resolveTicket(ticketId, solucaoInput.trim(), user?.name || 'Mecânico');
      showFeedback('Chamado encerrado e arquivado com sucesso!', 'success');
      
      // Clear values
      setSolucaoInput('');
      setResolvingTicketId(null);

      // Refresh list
      await loadTickets();
    } catch (err) {
      showFeedback('Não foi possível salvar o encerramento do chamado.', 'error');
    }
  };

  const handleDeleteTicket = async (ticketId: string) => {
    try {
      await ticketService.deleteTicket(ticketId);
      showFeedback('Chamado removido permanente.', 'info');
      setDeletingTicketId(null);
      await loadTickets();
    } catch (err) {
      showFeedback('Falha em excluir chamado.', 'error');
    }
  };

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  // Filtered tickets
  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = 
      ticket.titulo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.descricao.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.setor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ticket.mecanico && ticket.mecanico.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (ticket.solucao && ticket.solucao.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = filterStatus === 'todos' || ticket.status === filterStatus;
    const matchesPriority = filterPriority === 'todos' || ticket.prioridade === filterPriority;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  // Calculate metrics
  const totalCount = tickets.length;
  const openCount = tickets.filter(t => t.status === 'aberto').length;
  const closedCount = tickets.filter(t => t.status === 'concluido').length;
  const altaPriorityCount = tickets.filter(t => t.status === 'aberto' && t.prioridade === 'alta').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-slate-900" id="main_container">
      
      {/* Dynamic Floating Feedback Banner */}
      {feedbackMessage && (
        <div 
          id="local_feedback" 
          className={`fixed top-4 right-4 z-50 max-w-sm rounded-lg p-4 shadow-xl border flex items-start gap-3 transition-all duration-300 transform translate-y-0 scale-100`}
          style={{
            backgroundColor: feedbackMessage.type === 'success' ? '#064e3b' : feedbackMessage.type === 'error' ? '#7f1d1d' : '#1e3a8a',
            borderColor: feedbackMessage.type === 'success' ? '#10b981' : feedbackMessage.type === 'error' ? '#f43f5e' : '#3b82f6',
          }}
        >
          {feedbackMessage.type === 'success' && <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />}
          {feedbackMessage.type === 'error' && <ShieldAlert className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />}
          {feedbackMessage.type === 'info' && <Clock className="h-5 w-5 text-cyan-400 shrink-0 mt-0.5" />}
          <div>
            <p className="text-sm font-medium">{feedbackMessage.text}</p>
          </div>
          <button onClick={() => setFeedbackMessage(null)} className="text-slate-300 hover:text-white ml-auto">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* TOP HEADER STATUS */}
      <header id="app_header" className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 md:px-8 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-cyan-500 to-indigo-600 p-2 rounded-xl text-slate-950 shadow-lg" id="logo_block">
            <Wrench className="h-6 w-6 stroke-[2.2]" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5 leading-none">
              Mecano<span className="text-cyan-400 font-normal">Flow</span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">Painel Integrado de Manutenção</p>
          </div>
        </div>

        {/* Database Settings Status Indicator */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button 
            onClick={() => setIsSqlModalOpen(true)}
            className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-750 border border-slate-700/80 hover:border-slate-600 text-slate-300 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer"
            id="btn_sql_setup"
          >
            <Database className="h-3.5 w-3.5 text-cyan-400" />
            <span>Ver Configuração Supabase</span>
          </button>

          {isSupabaseConfigured ? (
            <div id="supa_connected_badge" className="flex items-center gap-1.5 bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 text-xs font-semibold px-2.5 py-1.5 rounded-lg shadow-sm">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Supabase Conectado</span>
            </div>
          ) : (
            <div id="supa_local_badge" className="flex items-center gap-1.5 bg-amber-950/80 border border-amber-500/30 text-amber-400 text-xs font-semibold px-2.5 py-1.5 rounded-lg shadow-sm">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-500"></span>
              <span>Banco Local (LocalStorage)</span>
            </div>
          )}

          {user && (
            <div className="flex items-center gap-2 border-l border-slate-800 pl-3.5 ml-1">
              <div className="text-right">
                <div className="text-xs text-slate-400 font-medium">Logado como:</div>
                <div className="text-sm font-semibold text-slate-200 flex items-center justify-end gap-1">
                  <span>{user.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-bold uppercase ${
                    user.role === 'operador' ? 'bg-indigo-950 text-indigo-300 border border-indigo-500/20' : 'bg-amber-950 text-amber-300 border border-amber-500/20'
                  }`}>
                    {user.role}
                  </span>
                </div>
              </div>
              <button 
                onClick={handleLogout}
                className="bg-slate-800/80 hover:bg-rose-950/50 hover:text-rose-400 text-slate-300 p-2 rounded-lg border border-slate-700 hover:border-rose-500/30 transition shadow-sm cursor-pointer"
                title="Sair do Sistema"
                id="btn_logout"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* DETAILED SUPABASE SQL SCHEMATICS DRAWER/MODAL  */}
      {isSqlModalOpen && (
        <div id="sql_modal_overlay" className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <dialog open className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-6 shadow-2xl overflow-hidden flex flex-col text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="bg-cyan-500/10 p-2 rounded-lg">
                  <FileCode className="h-5 w-5 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Configuração do Supabase</h3>
                  <p className="text-xs text-slate-400">Como conectar seu banco na nuvem</p>
                </div>
              </div>
              <button onClick={() => setIsSqlModalOpen(false)} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="py-4 space-y-4 text-sm max-h-[60vh] overflow-y-auto pr-1">
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-3.5 space-y-2">
                <p className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">Status Atual:</p>
                {isSupabaseConfigured ? (
                  <p className="text-slate-200">🚀 O sistema está rodando conectado ao seu banco Supabase real!</p>
                ) : (
                  <div className="space-y-1.5">
                    <p className="text-slate-200 font-medium">📂 Modo demonstrativo inteligente ativo.</p>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Para mudar para o banco de dados na nuvem Supabase, vá na aba de <strong className="text-slate-300">Configurações/Secrets</strong> do AI Studio à direita/topo e adicione as seguintes variáveis de ambiente:
                    </p>
                    <ul className="list-disc list-inside text-xs font-mono text-cyan-300 pl-1 space-y-1">
                      <li>VITE_SUPABASE_URL</li>
                      <li>VITE_SUPABASE_ANON_KEY</li>
                    </ul>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">SQL para criação da Tabela:</span>
                  <button 
                    onClick={handleCopyToClipboard}
                    className="flex items-center gap-1 text-xs bg-slate-850 hover:bg-slate-800 border border-slate-750 hover:border-slate-600 px-2.5 py-1 rounded transition text-slate-300 cursor-pointer"
                  >
                    {copiedSql ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copiar Código SQL</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="relative">
                  <pre className="text-xs font-mono bg-slate-950 border border-slate-850 p-4 rounded-lg text-slate-300 overflow-x-auto max-h-56 leading-relaxed">
                    {SUPABASE_SQL_SCHEMA}
                  </pre>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800 mt-2">
              <button 
                onClick={() => setIsSqlModalOpen(false)}
                className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 px-4 py-2 rounded-lg font-semibold text-xs transition cursor-pointer"
              >
                Entendido, Fechar Janela
              </button>
            </div>
          </dialog>
        </div>
      )}

      {/* MAIN CONTAINER */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-8 py-6 flex flex-col gap-6" id="dashboard_main">
        
        {/* UNAUTHORIZED / LOGIN VIEW */}
        {!user ? (
          <div className="flex-1 flex items-center justify-center py-10" id="login_screen">
            <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 md:p-8 space-y-6 relative overflow-hidden" id="login_card">
              
              {/* Subtle background decoration */}
              <div className="absolute top-0 right-0 w-36 h-36 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none"></div>
              <div className="absolute -bottom-8 -left-8 w-44 h-44 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none"></div>

              <div className="text-center space-y-2">
                <div className="inline-flex bg-slate-800/70 p-3.5 rounded-2xl border border-slate-700 text-cyan-400 mb-2">
                  <Wrench className="h-7 w-7" />
                </div>
                <h2 className="text-2xl font-extrabold tracking-tight text-white">Acesse o MecanoFlow</h2>
                <p className="text-sm text-slate-400">Selecione seu perfil ou insira os dados de autenticação para gerenciar chamados técnicos.</p>
              </div>

              {loginError && (
                <div id="login_error" className="bg-rose-950/50 border border-rose-500/20 text-rose-300 p-3 rounded-lg flex items-center gap-2 text-xs">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Login / Usuário</label>
                  <input 
                    type="text" 
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    placeholder="Ex: operador ou mecanico" 
                    className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500/50 px-3.5 py-2.5 rounded-lg text-sm text-slate-100 outline-none transition"
                    id="input_username"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Senha</label>
                  <input 
                    type="password" 
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="••••••••••••" 
                    className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500/50 px-3.5 py-2.5 rounded-lg text-sm text-slate-100 outline-none transition"
                    id="input_password"
                    required
                  />
                </div>

                <button 
                  type="submit" 
                  className="w-full cursor-pointer bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-600 hover:to-indigo-700 text-slate-950 font-bold py-3 rounded-lg text-xs tracking-wider uppercase transition shadow-lg shrink-0 flex items-center justify-center gap-2 "
                  id="btn_submit_login"
                >
                  <LogIn className="h-4 w-4" />
                  <span>Entrar no Painel</span>
                </button>
              </form>

              <div className="relative flex py-3 items-center">
                <div className="flex-grow border-t border-slate-800"></div>
                <span className="flex-shrink mx-3 text-[10px] text-slate-500 font-bold uppercase tracking-wider">Acesso Rápido de Teste</span>
                <div className="flex-grow border-t border-slate-800"></div>
              </div>

              {/* Seamless role selector cards for testing */}
              <div className="grid grid-cols-2 gap-3.5">
                <button
                  type="button"
                  onClick={() => fillCredentialsAndLogin('operador')}
                  className="bg-slate-850 hover:bg-slate-800 border border-slate-750 hover:border-indigo-500/30 p-2.5 rounded-xl transition text-left space-y-1.5 focus:outline-none group cursor-pointer"
                  id="fill_operador"
                >
                  <p className="text-xs text-indigo-400 font-bold flex items-center gap-1">
                    <UserIcon className="h-3 w-3" />
                    <span>Operador</span>
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono">
                    U: operador<br/>
                    S: operador123
                  </p>
                  <p className="text-[10px] text-indigo-300 group-hover:text-indigo-200 transition font-medium flex items-center gap-0.5 pt-0.5">
                    Preencher e login <ArrowRight className="h-2.5 w-2.5" />
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => fillCredentialsAndLogin('mecanico')}
                  className="bg-slate-850 hover:bg-slate-800 border border-slate-750 hover:border-amber-500/30 p-2.5 rounded-xl transition text-left space-y-1.5 focus:outline-none group cursor-pointer"
                  id="fill_mecanico"
                >
                  <p className="text-xs text-amber-400 font-bold flex items-center gap-1">
                    <HardHat className="h-3 w-3" />
                    <span>Mecânico</span>
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono">
                    U: mecanico<br/>
                    S: mecanico123
                  </p>
                  <p className="text-[10px] text-amber-300 group-hover:text-amber-200 transition font-medium flex items-center gap-0.5 pt-0.5">
                    Preencher e login <ArrowRight className="h-2.5 w-2.5" />
                  </p>
                </button>
              </div>

            </div>
          </div>
        ) : (
          /* AUTHORIZED SYSTEM DASHBOARD CONTENT */
          <div className="space-y-6" id="dashboard_panel">
            
            {/* 1. METRICS BENTO TILES */}
            <section id="metrics_bento" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center gap-4 shadow-md">
                <div className="bg-slate-800 text-slate-300 p-3 rounded-lg leading-none shrink-0 border border-slate-700/50">
                  <ClipboardList className="h-6 w-6 stroke-[1.8]" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-medium tracking-wide">Total de Chamados</p>
                  <p className="text-2xl font-bold font-mono text-white mt-0.5">{totalCount}</p>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center gap-4 shadow-md">
                <div className="bg-amber-950/40 text-amber-400 p-3 rounded-lg leading-none shrink-0 border border-amber-500/10">
                  <Clock className="h-6 w-6 stroke-[1.8] animate-pulse" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-medium tracking-wide">Abertos (Pedentes)</p>
                  <p className="text-2xl font-bold font-mono text-amber-400 mt-0.5">{openCount}</p>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center gap-4 shadow-md">
                <div className="bg-emerald-950/40 text-emerald-400 p-3 rounded-lg leading-none shrink-0 border border-emerald-500/10">
                  <CheckCircle className="h-6 w-6 stroke-[1.8]" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-medium tracking-wide">Chamados Concluídos</p>
                  <p className="text-2xl font-bold font-mono text-emerald-400 mt-0.5">{closedCount}</p>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center gap-4 shadow-md col-span-2 lg:col-span-1">
                <div className="bg-rose-950/40 text-rose-400 p-3 rounded-lg leading-none shrink-0 border border-rose-500/10">
                  <AlertTriangle className="h-6 w-6 stroke-[1.8]" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-medium tracking-wide">Críticos Ativos (Prioridade Alta)</p>
                  <p className="text-2xl font-bold font-mono text-rose-400 mt-0.5">{altaPriorityCount}</p>
                </div>
              </div>

            </section>

            {/* 2. OPERATOR SPECIAL TRIGGER AREA */}
            {user.role === 'operador' && (
              <section id="operator_actions" className="bg-gradient-to-r from-slate-900 to-indigo-950 border border-indigo-900/30 hover:border-indigo-800/40 p-4 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-md transition-colors">
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span className="w-1.5 h-6 bg-indigo-500 rounded-full"></span>
                    Central do Operador
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Você observou algum defeito mecânico ou problemas nas máquinas? Registre seu chamado agora de forma precisa para a equipe técnica de engenharia.
                  </p>
                </div>
                <button
                  onClick={() => setIsNewTicketOpen(!isNewTicketOpen)}
                  className="bg-indigo-500 hover:bg-indigo-600 text-slate-950 font-bold text-xs px-4 py-2.5 rounded-lg flex items-center gap-2.5 transition shrink-0 shadow-lg cursor-pointer max-md:w-full justify-center"
                  id="btn_novo_chamado"
                >
                  {isNewTicketOpen ? (
                    <>
                      <X className="h-4 w-4 stroke-[2.5]" />
                      <span>Fechar Formulário</span>
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 stroke-[2.5]" />
                      <span>Abrir Novo Chamado</span>
                    </>
                  )}
                </button>
              </section>
            )}

            {/* SLIDE DOWN FORM: NEW TICKET */}
            {user.role === 'operador' && isNewTicketOpen && (
              <div 
                id="novo_chamado_form_wrapper" 
                className="bg-slate-900 border border-indigo-900/40 rounded-xl p-5 md:p-6 shadow-xl space-y-4 transition-all duration-300"
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <ClipboardList className="h-4.5 w-4.5 text-indigo-400" />
                    <span>Formulário de Abertura de Chamado</span>
                  </h3>
                  <button 
                    onClick={() => setIsNewTicketOpen(false)}
                    className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <form onSubmit={handleCreateTicket} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-xs font-semibold text-slate-400">Título do Defeito / Problema</label>
                    <input 
                      type="text"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="Ex: Sensor acionador ou aquecimento na bomba XYZ"
                      maxLength={80}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500/50 px-3 py-2 rounded-lg text-sm text-slate-100 outline-none transition"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-400">Setor / Linha</label>
                    <input 
                      type="text"
                      value={newSector}
                      onChange={(e) => setNewSector(e.target.value)}
                      placeholder="Ex: Logística, Produção Linha 2, etc"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500/50 px-3 py-2 rounded-lg text-sm text-slate-100 outline-none transition"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-400">Nível de Prioridade</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['baixa', 'media', 'alta'] as TicketPriority[]).map((prio) => (
                        <button
                          key={prio}
                          type="button"
                          onClick={() => setNewPriority(prio)}
                          className={`py-1.8 rounded-lg text-xs font-semibold text-center transition capitalize cursor-pointer border ${
                            newPriority === prio 
                              ? prio === 'baixa' ? 'bg-blue-950 border-blue-500 text-blue-400'
                                : prio === 'media' ? 'bg-amber-950 border-amber-500 text-amber-400'
                                : 'bg-red-950 border-red-500 text-red-400'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-300'
                          }`}
                        >
                          {prio}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="md:col-span-3 space-y-1">
                    <label className="text-xs font-semibold text-slate-400">Descrição Detalhada da Ocorrência</label>
                    <textarea 
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      placeholder="Por favor, descreva com detalhes o som que ouviu, o comportamento da máquina, erros no display eletrônico ou qualquer outro sintoma importante para instruir o mecânico..."
                      rows={3}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500/50 px-3 py-2 rounded-lg text-sm text-slate-100 outline-none transition resize-none"
                      required
                    ></textarea>
                  </div>

                  <div className="md:col-span-3 flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsNewTicketOpen(false)}
                      className="bg-slate-800 hover:bg-slate-750 text-slate-300 px-4 py-2 rounded-lg font-semibold text-xs transition cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-slate-950 font-bold px-5 py-2 rounded-lg text-xs tracking-wide uppercase transition shadow-lg shrink-0 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <span>Registrando...</span>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4" />
                          <span>Confirmar e Criar Chamado</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* MECHANIC ROLE TIPS */}
            {user.role === 'mecanico' && (
              <section id="mechanic_actions" className="bg-gradient-to-r from-slate-900 to-amber-950 border border-amber-900/30 p-4 rounded-xl shadow-md space-y-1">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span className="w-1.5 h-6 bg-amber-500 rounded-full"></span>
                  Central de Atendimento Técnico (Engenharia)
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Você está logado como mecânico. Analise os chamados com status <span className="text-amber-400 font-semibold">"Aberto"</span> abaixo. Execute o trabalho no setor correspondente, e clique no botão <span className="text-cyan-400 font-semibold">"Encerrar Chamado"</span> para descrever com precisão os reparos efetuados.
                </p>
              </section>
            )}

            {/* 3. SEARCH & CONTROLS TOOLBAR */}
            <section id="filters_toolbar" className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4">
              
              {/* Search input */}
              <div className="w-full md:max-w-md relative">
                <Search className="absolute left-3 top-3 h-4.5 w-4.5 text-slate-400" />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Pesquisar por chamado, setor, descrição..." 
                  className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500/50 px-10 py-2.5 rounded-lg text-sm text-slate-100 outline-none transition"
                  id="search_tickets"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 top-3.5 text-slate-400 hover:text-white">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Advanced multi-filters group */}
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
                
                {/* Status filter tab selecter */}
                <div className="flex bg-slate-950 border border-slate-800 p-1 rounded-lg">
                  <button 
                    onClick={() => setFilterStatus('todos')}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition cursor-pointer ${filterStatus === 'todos' ? 'bg-slate-800 text-cyan-400' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    Todos
                  </button>
                  <button 
                    onClick={() => setFilterStatus('aberto')}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition cursor-pointer ${filterStatus === 'aberto' ? 'bg-amber-950/20 text-amber-400' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    Abertos
                  </button>
                  <button 
                    onClick={() => setFilterStatus('concluido')}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition cursor-pointer ${filterStatus === 'concluido' ? 'bg-emerald-950/20 text-emerald-400' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    Concluídos
                  </button>
                </div>

                {/* Priority filter */}
                <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 px-2.5 py-1.5 rounded-lg text-xs text-slate-300">
                  <Filter className="h-3 w-3 text-slate-400 mr-1" />
                  <span className="text-[10px] uppercase font-bold text-slate-500">Priv:</span>
                  <select
                    value={filterPriority}
                    onChange={(e) => setFilterPriority(e.target.value as any)}
                    className="bg-transparent text-slate-100 outline-none border-none pr-1 uppercase text-xs font-semibold cursor-pointer"
                  >
                    <option value="todos" className="bg-slate-950 text-slate-100">TODAS</option>
                    <option value="alta" className="bg-slate-950 text-red-400">ALTA</option>
                    <option value="media" className="bg-slate-950 text-amber-400">MÉDIA</option>
                    <option value="baixa" className="bg-slate-950 text-blue-400">BAIXA</option>
                  </select>
                </div>

                {/* Reload data action */}
                <button
                  onClick={loadTickets}
                  disabled={isLoading}
                  className="bg-slate-950 hover:bg-slate-850 p-2 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-lg transition shrink-0 cursor-pointer"
                  title="Atualizar lista"
                  id="btn_reload"
                >
                  <svg className={`h-4.5 w-4.5 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 4.582L20 5.4a1 1 0 00-.312.788M20 5h5" />
                  </svg>
                </button>

              </div>
            </section>

            {/* 4. TICKET RESULTS COMPONENT */}
            <section id="tickets_list_area" className="space-y-4">
              
              <div className="flex items-center justify-between px-1">
                <h4 className="text-xs font-extrabold uppercase text-slate-400 tracking-wider">
                  Listagem ({filteredTickets.length} exibidos)
                </h4>
                {isLoading && <span className="text-xs text-slate-500 animate-pulse">Buscando atualizações de dados no Supabase...</span>}
              </div>

              {filteredTickets.length === 0 ? (
                <div id="empty_tickets_state" className="bg-slate-900 border border-dashed border-slate-800 rounded-2xl p-12 text-center space-y-3.5">
                  <div className="inline-flex bg-slate-950 text-slate-500 p-4 rounded-full border border-slate-800">
                    <ClipboardList className="h-8 w-8" />
                  </div>
                  <div className="space-y-1.5">
                    <h5 className="text-base font-bold text-white">Nenhum chamado encontrado</h5>
                    <p className="text-slate-400 text-xs max-w-sm mx-auto leading-relaxed">
                      Não encontramos registros que correspondam aos filtros ou termo de busca selecionados. Ajuste os termos ou registre novo chamado se for operador.
                    </p>
                  </div>
                  {(searchQuery || filterStatus !== 'todos' || filterPriority !== 'todos') && (
                    <button 
                      onClick={() => {
                        setSearchQuery('');
                        setFilterStatus('todos');
                        setFilterPriority('todos');
                      }} 
                      className="bg-slate-800 hover:bg-slate-750 text-xs px-3.5 py-1.5 rounded-lg text-white font-semibold transition inline-block cursor-pointer"
                    >
                      Limpar Todos os Filtros
                    </button>
                  )}
                </div>
              ) : (
                /* TICKETS LIST GRID  */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="tickets_grid">
                  {filteredTickets.map((ticket) => (
                    <div 
                      key={ticket.id} 
                      className={`bg-slate-900 rounded-xl shadow-lg border relative flex flex-col justify-between overflow-hidden transition-all duration-200 ${
                        ticket.status === 'concluido' 
                          ? 'border-slate-800/80 bg-slate-900/60' 
                          : ticket.prioridade === 'alta' 
                            ? 'border-red-900/40 shadow-red-950/5' 
                            : ticket.prioridade === 'media'
                              ? 'border-amber-900/40 shadow-amber-950/5'
                              : 'border-slate-800'
                      }`}
                      id={`ticket_card_${ticket.id}`}
                    >
                      {/* Ticket header styling based on state */}
                      <div className="p-4 md:p-5 space-y-3 flex-1 flex flex-col justify-between">
                        
                        <div className="space-y-2.5">
                          {/* Badges indicators */}
                          <div className="flex items-center justify-between gap-2.5">
                            <span className="text-[10px] font-mono text-slate-500 lowercase bg-slate-950 px-2 py-0.5 rounded border border-slate-850 truncate max-w-[120px]" title={ticket.id}>
                              ID: {ticket.id.substring(0, 8)}...
                            </span>
                            
                            <div className="flex items-center gap-1.5 shrink-0">
                              {/* Priority color rendering */}
                              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                                ticket.prioridade === 'alta' 
                                  ? 'bg-rose-950/55 text-rose-400 border-rose-500/20' 
                                  : ticket.prioridade === 'media'
                                    ? 'bg-amber-950/55 text-amber-400 border-amber-500/20'
                                    : 'bg-blue-950/55 text-blue-400 border-blue-500/10'
                              }`}>
                                <Tag className="h-2.5 w-2.5" />
                                <span>{ticket.prioridade}</span>
                              </span>

                              {/* Status indicators */}
                              {ticket.status === 'concluido' ? (
                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-950/60 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                                  <CheckSquare className="h-2.5 w-2.5 text-emerald-400" />
                                  <span>Concluído</span>
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-950/60 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                  <span>Aberto</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Desk, Sector and Creator */}
                          <div className="space-y-1">
                            <h5 className="text-base font-bold text-white line-clamp-1 group-hover:text-cyan-400 transition" title={ticket.titulo}>
                              {ticket.titulo}
                            </h5>
                            
                            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-400">
                              <span className="flex items-center gap-1 text-slate-300 font-medium">
                                <MapPin className="h-3.5 w-3.5 text-teal-400 shrink-0" />
                                <span>{ticket.setor}</span>
                              </span>
                              <span className="text-slate-600">•</span>
                              <span className="flex items-center gap-1">
                                <UserIcon className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                <span>Op: <strong className="text-slate-300">{ticket.operador}</strong></span>
                              </span>
                            </div>
                          </div>

                          {/* Main problem description */}
                          <div className="bg-slate-950/80 border border-slate-850 p-3 rounded-lg text-xs leading-relaxed text-slate-300 whitespace-pre-wrap">
                            {ticket.descricao}
                          </div>
                          
                          <div className="text-[10px] font-medium text-slate-500/90 flex items-center gap-1">
                            <Clock className="h-3 w-3 shrink-0" />
                            <span>Aberto em: {new Date(ticket.criado_em).toLocaleString('pt-BR')}</span>
                          </div>

                        </div>

                        {/* CLOSED SOLUTIONS BOX */}
                        {ticket.status === 'concluido' && (
                          <div className="mt-4 pt-3.5 border-t border-slate-800 space-y-2 bg-emerald-950/10 border-l-2 border-l-emerald-500 p-3 rounded-r-lg">
                            <p className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                              <Wrench className="h-3.5 w-3.5 text-emerald-400" />
                              <span>Intervenção do Mecânico</span>
                            </p>
                            <div className="text-xs text-slate-300 leading-relaxed italic">
                              "{ticket.solucao}"
                            </div>
                            <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500">
                              <span>Mecânico: <strong className="text-slate-300 uppercase">{ticket.mecanico}</strong></span>
                              {ticket.resolvido_em && (
                                <span>Resolvido: {new Date(ticket.resolvido_em).toLocaleString('pt-BR')}</span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* INLINE SOLUTION ACTION (only for mechanic when resolving this ticket) */}
                        {user.role === 'mecanico' && ticket.status === 'aberto' && resolvingTicketId === ticket.id && (
                          <form 
                            onSubmit={(e) => handleResolveTicket(e, ticket.id)}
                            className="mt-4 pt-3.5 border-t border-slate-800 space-y-3 transition-all duration-300"
                            id={`solution_form_${ticket.id}`}
                          >
                            <div className="space-y-1">
                              <label className="text-xs font-bold text-cyan-400 block pb-1">Descrever o que foi realizado/consertado:</label>
                              <textarea
                                value={solucaoInput}
                                onChange={(e) => setSolucaoInput(e.target.value)}
                                placeholder="Especifique as peças trocadas, procedimentos de calibração ou soldas efetuadas para resolver de forma transparente..."
                                rows={2}
                                className="w-full bg-slate-950 border border-cyan-500/30 focus:border-cyan-500/80 px-2.5 py-1.8 rounded-lg text-xs text-slate-100 outline-none transition resize-none leading-relaxed"
                                required
                              />
                            </div>
                            
                            <div className="flex items-center justify-end gap-2 text-xs">
                              <button
                                type="button"
                                onClick={() => {
                                  setResolvingTicketId(null);
                                  setSolucaoInput('');
                                }}
                                className="bg-slate-850 hover:bg-slate-800 text-slate-300 px-3 py-1.5 rounded-lg text-xs transition cursor-pointer"
                              >
                                Cancelar
                              </button>
                              <button
                                type="submit"
                                className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold px-4 py-1.5 rounded-lg text-xs leading-5 transition shadow flex items-center gap-1 cursor-pointer shrink-0"
                              >
                                <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                                <span>Concluir e Encerrar Chamado</span>
                              </button>
                            </div>
                          </form>
                        )}

                        {/* DELETE CONFIRM OVERLAY */}
                        {deletingTicketId === ticket.id && (
                          <div className="mt-4 p-3 bg-red-950/40 border border-red-500/20 rounded-lg space-y-3">
                            <p className="text-xs text-red-300 leading-relaxed font-semibold flex items-center gap-1">
                              <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
                              <span>Deletar este chamado em definitivo?</span>
                            </p>
                            <div className="flex justify-end gap-2">
                              <button 
                                onClick={() => setDeletingTicketId(null)}
                                className="bg-slate-800 hover:bg-slate-750 px-2.5 py-1 rounded text-[10px] font-bold text-slate-200 uppercase tracking-wide cursor-pointer"
                              >
                                Cancelar
                              </button>
                              <button 
                                onClick={() => handleDeleteTicket(ticket.id)}
                                className="bg-red-600 hover:bg-red-700 text-white px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wide cursor-pointer"
                              >
                                Sim, Excluir
                              </button>
                            </div>
                          </div>
                        )}

                      </div>

                      {/* CARD FOOTER CONTROL ACTIONS & ROLE EXCLUSIVES */}
                      {((ticket.status === 'aberto' && user.role === 'mecanico' && resolvingTicketId !== ticket.id) || 
                        (user.role === 'operador' && !deletingTicketId)) && (
                        <div className="bg-slate-950/30 px-4 py-2.5 border-t border-slate-850 shrink-0 flex items-center justify-between gap-3 text-xs">
                          <span className="text-[10px] text-slate-500 italic">
                            {ticket.status === 'concluido' ? 'Uso somente para auditoria' : 'Ação requerida'}
                          </span>

                          <div className="flex items-center gap-2">
                            {/* Deleting capability for operator */}
                            {user.role === 'operador' && (
                              <button
                                onClick={() => setDeletingTicketId(ticket.id)}
                                className="bg-slate-900/50 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 p-1.5 rounded-md border border-slate-800 hover:border-rose-500/10 transition cursor-pointer"
                                title="Excluir Chamado permanente"
                                id={`btn_delete_ticket_${ticket.id}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}

                            {/* Resolving capability for Mechanic */}
                            {user.role === 'mecanico' && ticket.status === 'aberto' && (
                              <button
                                onClick={() => {
                                  setResolvingTicketId(ticket.id);
                                  setSolucaoInput('');
                                }}
                                className="bg-gradient-to-r from-cyan-500 to-indigo-600 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-[11px] leading-tight hover:shadow-cyan-500/5 transition tracking-wide flex items-center gap-1 cursor-pointer"
                                id={`btn_resolve_trigger_${ticket.id}`}
                              >
                                <Wrench className="h-3 w-3 inline-block" />
                                <span>Encerrar Chamado</span>
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                    </div>
                  ))}
                </div>
              )}

            </section>

          </div>
        )}
      </main>

      {/* FOOTER METRICS SYSTEM INFO */}
      <footer id="app_footer_nav" className="mt-auto bg-slate-900/50 border-t border-slate-850 py-5 text-center px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-slate-400 text-xs">
          <div className="flex items-center gap-2 font-medium">
            <span>© 2026 MecanoFlow — Controle Interno de Manutenção</span>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="text-[10px] bg-slate-950 text-slate-400 px-2 py-0.5 rounded font-mono">
              v1.2.0 (Supabase Ready)
            </span>
            <span className="text-slate-600">|</span>
            <button 
              onClick={() => setIsSqlModalOpen(true)}
              className="text-cyan-400 hover:underline hover:text-cyan-300 font-medium cursor-pointer"
            >
              Exibir Esquema de Banco
            </button>
          </div>
        </div>
      </footer>

    </div>
  );
}
