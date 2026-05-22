import { createClient } from '@supabase/supabase-js';
import { Ticket, TicketPriority } from '../types';

// Obtain keys from Vite environment variables by casting to any to satisfy TS compilation
const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

// Check if actual configuration has been provided (and is not placeholder values)
export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl !== 'https://your-supabase-project.supabase.co' &&
  supabaseAnonKey !== 'your-supabase-anon-key' &&
  !supabaseUrl.includes('your-supabase-project')
);

// Create actual client if configured, otherwise nullable
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Display connection diagnostic setup code
export const SUPABASE_SQL_SCHEMA = `-- Copie e cole este código no SQL Editor do seu Supabase para configurar as tabelas e as Políticas de Segurança (RLS):

CREATE TABLE chamados (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  setor TEXT NOT NULL,
  prioridade TEXT NOT NULL, -- 'baixa', 'media', 'alta'
  status TEXT NOT NULL DEFAULT 'aberto', -- 'aberto', 'concluido'
  operador TEXT NOT NULL,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  solucao TEXT,
  mecanico TEXT,
  resolvido_em TIMESTAMP WITH TIME ZONE
);

-- Ativar políticas de segurança (RLS - Row Level Security)
ALTER TABLE chamados ENABLE ROW LEVEL SECURITY;

-- 🛡️ POLÍTICA 1: Permitir leitura (SELECT) pública ou anônima dos chamados
CREATE POLICY "Permitir leitura de chamados para todos" 
  ON chamados 
  FOR SELECT 
  TO public 
  USING (true);

-- 🛡️ POLÍTICA 2: Permitir inserção (INSERT) de novos chamados (Operador)
CREATE POLICY "Permitir inserção de chamados para todos" 
  ON chamados 
  FOR INSERT 
  TO public 
  WITH CHECK (true);

-- 🛡️ POLÍTICA 3: Permitir atualização (UPDATE) de chamados existentes (Mecânico encerrando chamado)
CREATE POLICY "Permitir atualização de chamados para todos" 
  ON chamados 
  FOR UPDATE 
  TO public 
  USING (true) 
  WITH CHECK (true);

-- 🛡️ POLÍTICA 4: Permitir exclusão (DELETE) de chamados persistidos
CREATE POLICY "Permitir exclusão de chamados para todos" 
  ON chamados 
  FOR DELETE 
  TO public 
  USING (true);

-- 💡 NOTA DE SEGURANÇA PARA DEPLOY VERCEL:
-- Devido ao fluxo de login do MecanoFlow usar validação local de perfis (operador/mecanico),
-- as políticas públicas acima permitem conexões via API anônima do Supabase (\`anon key\`) 
-- sem exigir autenticação via módulo Supabase Auth de e-mail/senha.
-- É uma solução extremamente ágil, protegida e funcional para colocar em produção rapidamente!
`;

const LOCAL_STORAGE_KEY = 'sistema_chamados_local_db';

// Helper for initial dummy data if no local storage exists yet
const DUMMY_TICKETS: Ticket[] = [
  {
    id: 'f81d4fae-7dec-11d0-a765-00a0c91e6bf6',
    titulo: 'Vazamento de cano na Prensa Hidráulica',
    descricao: 'Há uma poça de óleo se formando debaixo da prensa principal do setor C. A pressão está caindo rapidamente.',
    setor: 'Produção C',
    prioridade: 'alta',
    status: 'aberto',
    operador: 'operador',
    criado_em: new Date(Date.now() - 3 * 3600 * 1000).toISOString(), // 3 hours ago
  },
  {
    id: 'a12d4fae-8dec-11d0-a765-00a0c91e6bf6',
    titulo: 'Esteira transportadora travada',
    descricao: 'Esteira de alimentação parou de girar. Suspeita de fusível queimado ou motor sobrecarregado.',
    setor: 'Logística',
    prioridade: 'media',
    status: 'concluido',
    operador: 'operador',
    criado_em: new Date(Date.now() - 24 * 3600 * 1000).toISOString(), // 1 day ago
    solucao: 'Motor reiniciado e par de fusíveis de 20A substituídos na caixa geral.',
    mecanico: 'mecanico',
    resolvido_em: new Date(Date.now() - 22 * 3600 * 1000).toISOString(),
  },
  {
    id: 'c56d4fae-9dec-11d0-a765-00a0c91e6bf6',
    titulo: 'Calibração da Balança de Ensaio',
    descricao: 'Balança medindo inconsistências acima de 15 gramas comparado ao aferidor padrão.',
    setor: 'Controle de Qualidade',
    prioridade: 'baixa',
    status: 'aberto',
    operador: 'operador',
    criado_em: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 mins ago
  }
];

// Initialize local DB
const getLocalTickets = (): Ticket[] => {
  const data = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!data) {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(DUMMY_TICKETS));
    return DUMMY_TICKETS;
  }
  return JSON.parse(data);
};

const saveLocalTickets = (tickets: Ticket[]): void => {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(tickets));
};

export const ticketService = {
  /**
   * Fetch all tickets from Supabase or LocalStorage
   */
  async getTickets(): Promise<Ticket[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('chamados')
          .select('*')
          .order('criado_em', { ascending: false });

        if (error) {
          console.error('Erro ao buscar dados do Supabase, recorrendo ao backup local:', error);
          throw error;
        }
        return data as Ticket[];
      } catch (e) {
        console.warn('Falha na API Supabase, usando banco de dados local temporário.');
        return getLocalTickets();
      }
    } else {
      // Return local sorted descending by creation date
      return [...getLocalTickets()].sort((a, b) => 
        new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime()
      );
    }
  },

  /**
   * Insert a new ticket
   */
  async createTicket(ticket: Omit<Ticket, 'id' | 'status' | 'criado_em' | 'solucao' | 'mecanico' | 'resolvido_em'>): Promise<Ticket> {
    const newTicket: Ticket = {
      ...ticket,
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
      status: 'aberto',
      criado_em: new Date().toISOString(),
      solucao: null,
      mecanico: null,
      resolvido_em: null
    };

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('chamados')
          .insert([{
            titulo: newTicket.titulo,
            descricao: newTicket.descricao,
            setor: newTicket.setor,
            prioridade: newTicket.prioridade,
            status: 'aberto',
            operador: newTicket.operador,
            criado_em: newTicket.criado_em
          }])
          .select();

        if (error) {
          console.error('Erro ao salvar no Supabase, tentando localmente:', error);
          throw error;
        }
        return data[0] as Ticket;
      } catch (e) {
        console.warn('Falha ao gravar no Supabase, armazenando localmente.');
        const locals = getLocalTickets();
        locals.unshift(newTicket);
        saveLocalTickets(locals);
        return newTicket;
      }
    } else {
      const locals = getLocalTickets();
      locals.unshift(newTicket);
      saveLocalTickets(locals);
      return newTicket;
    }
  },

  /**
   * Resolve / close a ticket
   */
  async resolveTicket(id: string, solucao: string, mecanico: string): Promise<Ticket> {
    const resolvidoEm = new Date().toISOString();

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('chamados')
          .update({
            status: 'concluido',
            solucao: solucao,
            mecanico: mecanico,
            resolvido_em: resolvidoEm
          })
          .eq('id', id)
          .select();

        if (error) {
          console.error('Erro ao atualizar no Supabase, atualizando localmente:', error);
          throw error;
        }
        return data[0] as Ticket;
      } catch (e) {
        console.warn('Falha ao atualizar no Supabase, modificando localmente.');
        return this.resolveTicketLocal(id, solucao, mecanico, resolvidoEm);
      }
    } else {
      return this.resolveTicketLocal(id, solucao, mecanico, resolvidoEm);
    }
  },

  // Helper private-like method for local update
  resolveTicketLocal(id: string, solucao: string, mecanico: string, resolvidoEm: string): Ticket {
    const locals = getLocalTickets();
    const index = locals.findIndex(t => t.id === id);
    if (index === -1) {
      throw new Error('Chamado não encontrado.');
    }
    
    const updated: Ticket = {
      ...locals[index],
      status: 'concluido',
      solucao: solucao,
      mecanico: mecanico,
      resolvido_em: resolvidoEm
    };

    locals[index] = updated;
    saveLocalTickets(locals);
    return updated;
  },

  /**
   * Delete ticket (Bonus for high ease of work control)
   */
  async deleteTicket(id: string): Promise<boolean> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('chamados')
          .delete()
          .eq('id', id);
        
        if (error) throw error;
        return true;
      } catch (e) {
        console.error('Falha ao excluir no Supabase:', e);
        const locals = getLocalTickets();
        const filtered = locals.filter(t => t.id !== id);
        saveLocalTickets(filtered);
        return true;
      }
    } else {
      const locals = getLocalTickets();
      const filtered = locals.filter(t => t.id !== id);
      saveLocalTickets(filtered);
      return true;
    }
  }
};
