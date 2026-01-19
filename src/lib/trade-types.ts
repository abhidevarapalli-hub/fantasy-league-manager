export interface Trade {
  id: string;
  proposerId: string;
  targetId: string;
  proposerPlayers: string[];
  targetPlayers: string[];
  status: 'pending' | 'accepted' | 'rejected' | 'countered';
  parentTradeId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DbTrade {
  id: string;
  proposer_id: string;
  target_id: string;
  proposer_players: string[];
  target_players: string[];
  status: string;
  parent_trade_id: string | null;
  created_at: string;
  updated_at: string;
}

export const mapDbTrade = (db: DbTrade): Trade => ({
  id: db.id,
  proposerId: db.proposer_id,
  targetId: db.target_id,
  proposerPlayers: db.proposer_players || [],
  targetPlayers: db.target_players || [],
  status: db.status as Trade['status'],
  parentTradeId: db.parent_trade_id || undefined,
  createdAt: new Date(db.created_at),
  updatedAt: new Date(db.updated_at),
});
