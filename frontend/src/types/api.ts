// API types matching backend models

export interface SentimentData {
  score: number // -1.0 to 1.0
  classification: 'VERY_BULLISH' | 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'VERY_BEARISH' | 'UNKNOWN'
  analyzed_at: string
}

export interface SentimentDetail {
  symbol: string
  score: number
  classification: 'VERY_BULLISH' | 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'VERY_BEARISH' | 'UNKNOWN'
  reasoning: string
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  key_factors: string[]
  window_start: string
  window_end: string
}

export interface Symbol {
  symbol: string
  name: string | null
  active: boolean
  added_at: string
  last_price: number | null
  last_price_date: string | null
  sentiment: SentimentData | null
}

export interface CurrentPrice {
  symbol: string
  price: number
}

export interface PriceBar {
  id: number
  symbol: string
  ts: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface Strategy {
  id: number
  key: string
  name: string
  params_json: string
  enabled: boolean
}

export interface AvailableStrategy {
  key: string
  name: string
  default_params: Record<string, any>
}

export interface Signal {
  id: number
  symbol: string
  ts: string
  strategy_key: string
  action: 'BUY' | 'SELL'
  confidence: number
  meta_json: string
}

export interface Position {
  id: number
  symbol: string
  opened_at: string
  qty: number
  avg_price: number
  status: 'OPEN' | 'CLOSED'
  closed_at: string | null
  pnl: number | null
  meta_json: string
  // Enhanced fields for open positions
  current_price?: number | null
  current_value?: number | null
  unrealized_pnl?: number | null
  pnl_percentage?: number | null
  days_open?: number | null
}

export interface Execution {
  id: number
  position_id: number
  ts: string
  side: 'BUY' | 'SELL'
  qty: number
  price: number
  fee: number
  meta_json: string
}

export interface Transaction {
  id: number
  position_id: number
  symbol: string
  ts: string
  side: 'BUY' | 'SELL'
  qty: number
  price: number
  fee: number
  total: number
  position_status: 'OPEN' | 'CLOSED'
  position_pnl: number | null
  meta_json: string
}

// Request types
export interface SymbolCreate {
  symbol: string
  name?: string
}

export interface StrategyCreate {
  key: string
  name: string
  params_json?: string
}

export interface StrategyUpdate {
  enabled?: boolean
  params_json?: string
}

export interface PositionCreate {
  symbol: string
  qty: number
  price: number
  meta_json?: string
}

export interface PositionClose {
  price: number
}

// Response types
export interface HealthResponse {
  status: string
}

export interface DailyJobResponse {
  ok: boolean
  message?: string
}

// Dashboard stats
export interface DashboardStats {
  totalSymbols: number
  activeStrategies: number
  recentSignals: number
  openPositions: number
  totalPnl: number
}

// Chat types
export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatRequest {
  messages: ChatMessage[]
  model?: string
}

export interface ChatStreamChunk {
  type: 'content' | 'tool_call' | 'done' | 'error'
  data: string | any
}

// Auth types
export interface AuthUser {
  id: number
  username: string
  role: 'ADMIN' | 'MANAGER' | 'USER' | 'TEST_USER'
  active: boolean
  balance: number
  created_at?: string
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  access_token: string
  token_type: string
  user: AuthUser
}

export interface SignupRequest {
  username: string
  password: string
}
