import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@chakra-ui/react'
import * as api from '@/services/api'
import type {
  SymbolCreate,
  StrategyCreate,
  StrategyUpdate,
  PositionCreate,
  PositionClose,
} from '@/types/api'

// Query keys
export const queryKeys = {
  health: ['health'] as const,
  symbols: ['symbols'] as const,
  signals: (filters?: any) => ['signals', filters] as const,
  positions: (status?: string) => ['positions', status] as const,
  strategies: ['strategies'] as const,
  availableStrategies: ['availableStrategies'] as const,
  executions: (positionId: number) => ['executions', positionId] as const,
  transactions: ['transactions'] as const,
}

// Health
export const useHealth = () =>
  useQuery({
    queryKey: queryKeys.health,
    queryFn: async () => (await api.healthCheck()).data,
    refetchInterval: 30000, // Poll every 30s
  })

// Symbols
export const useSymbols = () =>
  useQuery({
    queryKey: queryKeys.symbols,
    queryFn: async () => (await api.getSymbols()).data,
  })

export const useCreateSymbol = () => {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: (data: SymbolCreate) => api.createSymbol(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.symbols })
      toast({
        title: 'Symbol added',
        status: 'success',
        duration: 3000,
      })
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to add symbol',
        description: error.response?.data?.detail || error.message,
        status: 'error',
        duration: 5000,
      })
    },
  })
}

export const useDeleteSymbol = () => {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: (symbol: string) => api.deleteSymbol(symbol),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.symbols })
      toast({
        title: 'Symbol removed',
        status: 'success',
        duration: 3000,
      })
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to remove symbol',
        description: error.response?.data?.detail || error.message,
        status: 'error',
        duration: 5000,
      })
    },
  })
}

// Signals
export const useSignals = (filters?: {
  symbol?: string
  strategy_key?: string
  limit?: number
}) =>
  useQuery({
    queryKey: queryKeys.signals(filters),
    queryFn: async () => (await api.getSignals(filters)).data,
  })

// Positions
export const usePositions = (status?: 'OPEN' | 'CLOSED') =>
  useQuery({
    queryKey: queryKeys.positions(status),
    queryFn: async () => (await api.getPositions(status)).data,
  })

export const useCreatePosition = () => {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: (data: PositionCreate) => api.createPosition(data),
    onSuccess: () => {
      // Invalidate all position queries (both OPEN and CLOSED tabs)
      queryClient.invalidateQueries({ queryKey: ['positions'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions })
      toast({
        title: 'Position opened',
        status: 'success',
        duration: 3000,
      })
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to open position',
        description: error.response?.data?.detail || error.message,
        status: 'error',
        duration: 5000,
      })
    },
  })
}

export const useClosePosition = () => {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: ({ positionId, data }: { positionId: number; data: PositionClose }) =>
      api.closePosition(positionId, data),
    onSuccess: () => {
      // Invalidate all position queries (both OPEN and CLOSED tabs)
      queryClient.invalidateQueries({ queryKey: ['positions'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions })
      toast({
        title: 'Position closed',
        status: 'success',
        duration: 3000,
      })
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to close position',
        description: error.response?.data?.detail || error.message,
        status: 'error',
        duration: 5000,
      })
    },
  })
}

export const usePositionExecutions = (positionId: number) =>
  useQuery({
    queryKey: queryKeys.executions(positionId),
    queryFn: async () => (await api.getPositionExecutions(positionId)).data,
    enabled: !!positionId,
  })

export const useTransactions = () =>
  useQuery({
    queryKey: queryKeys.transactions,
    queryFn: async () => (await api.getTransactions()).data,
  })

// Strategies
export const useAvailableStrategies = () =>
  useQuery({
    queryKey: queryKeys.availableStrategies,
    queryFn: async () => (await api.getAvailableStrategies()).data,
  })

export const useStrategies = () =>
  useQuery({
    queryKey: queryKeys.strategies,
    queryFn: async () => (await api.getStrategies()).data,
  })

export const useCreateStrategy = () => {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: (data: StrategyCreate) => api.createStrategy(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.strategies })
      toast({
        title: 'Strategy created',
        status: 'success',
        duration: 3000,
      })
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to create strategy',
        description: error.response?.data?.detail || error.message,
        status: 'error',
        duration: 5000,
      })
    },
  })
}

export const useUpdateStrategy = () => {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: ({ strategyId, data }: { strategyId: number; data: StrategyUpdate }) =>
      api.updateStrategy(strategyId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.strategies })
      toast({
        title: 'Strategy updated',
        status: 'success',
        duration: 3000,
      })
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to update strategy',
        description: error.response?.data?.detail || error.message,
        status: 'error',
        duration: 5000,
      })
    },
  })
}

export const useDeleteStrategy = () => {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: (strategyId: number) => api.deleteStrategy(strategyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.strategies })
      toast({
        title: 'Strategy deleted',
        status: 'success',
        duration: 3000,
      })
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to delete strategy',
        description: error.response?.data?.detail || error.message,
        status: 'error',
        duration: 5000,
      })
    },
  })
}

// Daily Job
export const useTriggerDaily = () => {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: () => api.triggerDailyJob(),
    onSuccess: () => {
      toast({
        title: 'Daily job triggered',
        description: 'Data ingestion and signal generation started',
        status: 'info',
        duration: 5000,
        isClosable: true,
      })
      // Invalidate all data queries
      queryClient.invalidateQueries({ queryKey: ['signals'] })
      queryClient.invalidateQueries({ queryKey: ['positions'] })
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to trigger daily job',
        description: error.response?.data?.detail || error.message,
        status: 'error',
        duration: 5000,
      })
    },
  })
}
