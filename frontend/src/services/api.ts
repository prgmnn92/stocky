import axios from 'axios'
import type {
  Symbol,
  Signal,
  Position,
  Strategy,
  AvailableStrategy,
  Execution,
  Transaction,
  SymbolCreate,
  StrategyCreate,
  StrategyUpdate,
  PositionCreate,
  PositionClose,
  HealthResponse,
  DailyJobResponse,
  CurrentPrice,
  PriceBar,
  AuthUser,
  SentimentDetail,
} from '@/types/api'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Health
export const healthCheck = () =>
  api.get<HealthResponse>('/health')

// Symbols
export const getSymbols = () =>
  api.get<Symbol[]>('/symbols')

export const createSymbol = (data: SymbolCreate) =>
  api.post<Symbol>('/symbols', data)

export const deleteSymbol = (symbol: string) =>
  api.delete(`/symbols/${symbol}`)

export const getCurrentPrice = (symbol: string) =>
  api.get<CurrentPrice>(`/symbols/${symbol}/price`)

// Signals
export const getSignals = (params?: {
  symbol?: string
  strategy_key?: string
  limit?: number
}) => api.get<Signal[]>('/signals', { params })

// Positions
export const getPositions = (status?: 'OPEN' | 'CLOSED') =>
  api.get<Position[]>('/positions', { params: status ? { status } : undefined })

export const createPosition = (data: PositionCreate) =>
  api.post<Position>('/positions', data)

export const closePosition = (positionId: number, data: PositionClose) =>
  api.post<Position>(`/positions/${positionId}/close`, data)

export const getPositionExecutions = (positionId: number) =>
  api.get<Execution[]>(`/positions/${positionId}/executions`)

export const getTransactions = () =>
  api.get<Transaction[]>('/transactions')

// Strategies
export const getAvailableStrategies = () =>
  api.get<AvailableStrategy[]>('/strategies/available')

export const getStrategies = () =>
  api.get<Strategy[]>('/strategies')

export const createStrategy = (data: StrategyCreate) =>
  api.post<Strategy>('/strategies', data)

export const updateStrategy = (strategyId: number, data: StrategyUpdate) =>
  api.patch<Strategy>(`/strategies/${strategyId}`, data)

export const deleteStrategy = (strategyId: number) =>
  api.delete(`/strategies/${strategyId}`)

export const backtestStrategy = (strategyId: number, params: {
  symbol: string
  from_date?: string
  to_date?: string
}) =>
  api.post(`/strategies/${strategyId}/backtest`, null, { params })

// Daily Job
export const triggerDailyJob = () =>
  api.post<DailyJobResponse>('/run/daily')

// Prices
export const getPrices = (symbol: string, fromDate?: string, toDate?: string) =>
  api.get<PriceBar[]>(`/prices/${symbol}`, {
    params: {
      from_date: fromDate,
      to_date: toDate,
    },
  })

// Sentiment Analysis
export const analyzeSentiment = (symbol: string) =>
  api.post(`/symbols/${symbol}/sentiment`)

export const getLatestSentiment = (symbol: string) =>
  api.get<SentimentDetail>(`/symbols/${symbol}/sentiment/latest`)

// Authentication
export const login = (data: { username: string; password: string }) =>
  api.post('/auth/login', data)

export const signup = (data: { username: string; password: string }) =>
  api.post('/auth/signup', data)

export const getMe = () =>
  api.get('/auth/me')

// User Management
export const listUsers = () =>
  api.get<AuthUser[]>('/users')

export const updateUserRole = (userId: number, role: string) =>
  api.patch(`/users/${userId}/role`, { role })

export const deleteUser = (userId: number) =>
  api.delete(`/users/${userId}`)

export const updateUserBalance = (userId: number, balance: number) =>
  api.patch(`/users/${userId}/balance`, { balance })

export default api
