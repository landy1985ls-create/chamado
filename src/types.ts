export type UserRole = 'operador' | 'mecanico';

export interface User {
  username: string;
  role: UserRole;
  name: string;
}

export type TicketPriority = 'baixa' | 'media' | 'alta';

export interface Ticket {
  id: string; // Will store Supabase UUID or local numeric ID
  titulo: string;
  descricao: string;
  setor: string;
  prioridade: TicketPriority;
  status: 'aberto' | 'concluido';
  operador: string;
  criado_em: string;
  solucao?: string | null;
  mecanico?: string | null;
  resolvido_em?: string | null;
}
