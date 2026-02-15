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
  status: string;
  parent_trade_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbTradePlayer {
  id: string;
  trade_id: string;
  player_id: string;
  side: string; // 'proposer' | 'target'
}

export const mapDbTrade = (db: DbTrade, tradePlayers?: DbTradePlayer[]): Trade => ({
  id: db.id,
  proposerId: db.proposer_id,
  targetId: db.target_id,
  proposerPlayers: tradePlayers
    ? tradePlayers.filter(tp => tp.trade_id === db.id && tp.side === 'proposer').map(tp => tp.player_id)
    : [],
  targetPlayers: tradePlayers
    ? tradePlayers.filter(tp => tp.trade_id === db.id && tp.side === 'target').map(tp => tp.player_id)
    : [],
  status: db.status as Trade['status'],
  parentTradeId: db.parent_trade_id || undefined,
  createdAt: new Date(db.created_at),
  updatedAt: new Date(db.updated_at),
});
