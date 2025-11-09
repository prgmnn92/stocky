import {
  Box,
  Heading,
  SimpleGrid,
  VStack,
  HStack,
  Text,
  Badge,
  Switch,
  Button,
  useColorModeValue,
  Skeleton,
  Card,
  CardBody,
  Code,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  ModalFooter,
  FormControl,
  FormLabel,
  Input,
  Select,
  Textarea,
  useDisclosure,
  IconButton,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  useToast,
} from '@chakra-ui/react'
import { FiPlus, FiTrash2, FiInfo, FiTrendingUp } from 'react-icons/fi'
import { useState, useRef } from 'react'
import { useStrategies, useAvailableStrategies, useCreateStrategy, useUpdateStrategy, useDeleteStrategy, useSymbols } from '@/hooks/useApiQueries'
import * as api from '@/services/api'
import BacktestChart from '@/components/BacktestChart'

export default function Strategies() {
  const { data: strategies, isLoading } = useStrategies()
  const { data: availableStrategies, isLoading: isLoadingAvailable } = useAvailableStrategies()
  const { data: symbols } = useSymbols()
  const createStrategy = useCreateStrategy()
  const updateStrategy = useUpdateStrategy()
  const deleteStrategy = useDeleteStrategy()
  const toast = useToast()

  const { isOpen, onOpen, onClose } = useDisclosure()
  const { isOpen: isInfoOpen, onOpen: onInfoOpen, onClose: onInfoClose } = useDisclosure()
  const { isOpen: isBacktestOpen, onOpen: onBacktestOpen, onClose: onBacktestClose } = useDisclosure()
  const [strategyToDelete, setStrategyToDelete] = useState<any>(null)
  const [strategyToBacktest, setStrategyToBacktest] = useState<any>(null)
  const [backtestParams, setBacktestParams] = useState({
    symbol: '',
    from_date: '',
    to_date: '',
  })
  const [backtestResults, setBacktestResults] = useState<any>(null)
  const [backtestPriceData, setBacktestPriceData] = useState<any>(null)
  const [isBacktesting, setIsBacktesting] = useState(false)
  const cancelRef = useRef<HTMLButtonElement>(null)

  const [newStrategy, setNewStrategy] = useState({
    key: '',
    name: '',
    params_json: '{}',
  })

  const handleToggle = async (strategyId: number, enabled: boolean) => {
    await updateStrategy.mutateAsync({ strategyId, data: { enabled } })
  }

  const handleCreate = async () => {
    try {
      // Validate JSON
      JSON.parse(newStrategy.params_json)
      await createStrategy.mutateAsync(newStrategy)
      setNewStrategy({ key: '', name: '', params_json: '{}' })
      onClose()
    } catch (error: any) {
      toast({
        title: 'Invalid JSON',
        description: 'Please provide valid JSON for parameters',
        status: 'error',
        duration: 3000,
      })
    }
  }

  const handleDeleteClick = (strategy: any) => {
    setStrategyToDelete(strategy)
  }

  const confirmDelete = async () => {
    if (strategyToDelete) {
      await deleteStrategy.mutateAsync(strategyToDelete.id)
      setStrategyToDelete(null)
    }
  }

  const handleBacktestClick = (strategy: any) => {
    setStrategyToBacktest(strategy)
    setBacktestParams({
      symbol: symbols?.[0]?.symbol || '',
      from_date: '',
      to_date: '',
    })
    setBacktestResults(null)
    setBacktestPriceData(null)
    onBacktestOpen()
  }

  const runBacktest = async () => {
    if (!strategyToBacktest || !backtestParams.symbol) return

    setIsBacktesting(true)
    try {
      // Fetch both backtest results and price data in parallel
      const [backtestResponse, priceResponse] = await Promise.all([
        api.backtestStrategy(strategyToBacktest.id, backtestParams),
        api.getPrices(
          backtestParams.symbol,
          backtestParams.from_date || undefined,
          backtestParams.to_date || undefined
        ),
      ])

      setBacktestResults(backtestResponse.data)
      setBacktestPriceData(priceResponse.data)
    } catch (error: any) {
      toast({
        title: 'Backtest Failed',
        description: error.response?.data?.detail || 'Failed to run backtest',
        status: 'error',
        duration: 5000,
      })
    } finally {
      setIsBacktesting(false)
    }
  }

  return (
    <VStack spacing={6} align="stretch">
      <HStack justify="space-between">
        <HStack spacing={2}>
          <Heading size="lg">Strategies</Heading>
          <IconButton
            aria-label="Strategy information"
            icon={<FiInfo />}
            size="sm"
            variant="ghost"
            onClick={onInfoOpen}
          />
        </HStack>
        <Button leftIcon={<FiPlus />} colorScheme="blue" onClick={onOpen}>
          Create Strategy
        </Button>
      </HStack>

      {isLoading ? (
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} height="200px" />
          ))}
        </SimpleGrid>
      ) : strategies && strategies.length > 0 ? (
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
          {strategies.map((strategy) => (
            <StrategyCard
              key={strategy.id}
              strategy={strategy}
              onToggle={handleToggle}
              onDelete={handleDeleteClick}
              onBacktest={handleBacktestClick}
              isUpdating={updateStrategy.isPending}
            />
          ))}
        </SimpleGrid>
      ) : (
        <Box
          p={8}
          textAlign="center"
          bg={useColorModeValue('white', 'gray.800')}
          borderRadius="lg"
        >
          <Text color="gray.500">No strategies configured yet.</Text>
          <Button
            leftIcon={<FiPlus />}
            colorScheme="blue"
            mt={4}
            onClick={onOpen}
          >
            Create Your First Strategy
          </Button>
        </Box>
      )}

      {/* Create Strategy Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Create New Strategy</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Strategy Type</FormLabel>
                <Select
                  placeholder="Select a strategy..."
                  value={newStrategy.key}
                  onChange={(e) => {
                    const selectedStrategy = availableStrategies?.find(s => s.key === e.target.value)
                    setNewStrategy({
                      ...newStrategy,
                      key: e.target.value,
                      name: selectedStrategy?.name || '',
                      params_json: selectedStrategy?.default_params
                        ? JSON.stringify(selectedStrategy.default_params, null, 2)
                        : '{}',
                    })
                  }}
                  isDisabled={isLoadingAvailable}
                >
                  {availableStrategies?.map((strategy) => (
                    <option key={strategy.key} value={strategy.key}>
                      {strategy.name}
                    </option>
                  ))}
                </Select>
              </FormControl>
              <FormControl isRequired>
                <FormLabel>Strategy Name</FormLabel>
                <Input
                  placeholder="e.g., My SMA Strategy"
                  value={newStrategy.name}
                  onChange={(e) =>
                    setNewStrategy({ ...newStrategy, name: e.target.value })
                  }
                />
              </FormControl>
              <FormControl>
                <FormLabel>Parameters (JSON)</FormLabel>
                <Textarea
                  placeholder='{"fast_period": 10, "slow_period": 20}'
                  value={newStrategy.params_json}
                  onChange={(e) =>
                    setNewStrategy({ ...newStrategy, params_json: e.target.value })
                  }
                  rows={6}
                  fontFamily="monospace"
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button
              colorScheme="blue"
              onClick={handleCreate}
              isLoading={createStrategy.isPending}
              isDisabled={!newStrategy.key || !newStrategy.name}
            >
              Create Strategy
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        isOpen={!!strategyToDelete}
        leastDestructiveRef={cancelRef}
        onClose={() => setStrategyToDelete(null)}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete Strategy
            </AlertDialogHeader>
            <AlertDialogBody>
              Are you sure you want to delete <strong>{strategyToDelete?.name}</strong>?
              This action cannot be undone.
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={() => setStrategyToDelete(null)}>
                Cancel
              </Button>
              <Button
                colorScheme="red"
                onClick={confirmDelete}
                ml={3}
                isLoading={deleteStrategy.isPending}
              >
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      {/* Backtest Modal */}
      <Modal isOpen={isBacktestOpen} onClose={onBacktestClose} size="6xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            Backtest Strategy: {strategyToBacktest?.name}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Symbol</FormLabel>
                <Select
                  value={backtestParams.symbol}
                  onChange={(e) =>
                    setBacktestParams({ ...backtestParams, symbol: e.target.value })
                  }
                >
                  <option value="">Select a symbol...</option>
                  {symbols?.map((symbol) => (
                    <option key={symbol.symbol} value={symbol.symbol}>
                      {symbol.symbol} - {symbol.name}
                    </option>
                  ))}
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel>From Date (optional)</FormLabel>
                <Input
                  type="date"
                  value={backtestParams.from_date}
                  onChange={(e) =>
                    setBacktestParams({ ...backtestParams, from_date: e.target.value })
                  }
                />
              </FormControl>
              <FormControl>
                <FormLabel>To Date (optional)</FormLabel>
                <Input
                  type="date"
                  value={backtestParams.to_date}
                  onChange={(e) =>
                    setBacktestParams({ ...backtestParams, to_date: e.target.value })
                  }
                />
              </FormControl>

              {backtestResults && (
                <Box width="full" mt={4}>
                  <VStack align="stretch" spacing={3}>
                    <Heading size="sm">Backtest Results</Heading>
                    <HStack spacing={4}>
                      <Badge colorScheme="blue">
                        Total Signals: {backtestResults.metrics?.total_signals || 0}
                      </Badge>
                      <Badge colorScheme="green">
                        Buy: {backtestResults.metrics?.buy_signals || 0}
                      </Badge>
                      <Badge colorScheme="red">
                        Sell: {backtestResults.metrics?.sell_signals || 0}
                      </Badge>
                    </HStack>

                    {backtestResults.error && (
                      <Text color="red.500" fontSize="sm">
                        {backtestResults.error}
                      </Text>
                    )}

                    {backtestPriceData && backtestResults.signals && backtestResults.signals.length > 0 && (
                      <Box>
                        <Heading size="sm" mb={3}>
                          Price Chart with Signals
                        </Heading>
                        <BacktestChart
                          priceData={backtestPriceData}
                          signals={backtestResults.signals}
                        />
                      </Box>
                    )}

                    {backtestResults.signals && backtestResults.signals.length > 0 && (
                      <Box
                        maxH="300px"
                        overflowY="auto"
                        borderWidth="1px"
                        borderRadius="md"
                        p={3}
                      >
                        <VStack align="stretch" spacing={2}>
                          {backtestResults.signals.map((signal: any, idx: number) => (
                            <HStack
                              key={idx}
                              justify="space-between"
                              p={2}
                              bg={useColorModeValue('gray.50', 'gray.700')}
                              borderRadius="md"
                            >
                              <VStack align="start" spacing={0}>
                                <Text fontSize="xs" color="gray.500">
                                  {new Date(signal.ts).toLocaleDateString()}
                                </Text>
                                <Badge
                                  colorScheme={signal.action === 'BUY' ? 'green' : 'red'}
                                  fontSize="xs"
                                >
                                  {signal.action}
                                </Badge>
                              </VStack>
                              <Text fontSize="sm">
                                Confidence: {(signal.confidence * 100).toFixed(0)}%
                              </Text>
                            </HStack>
                          ))}
                        </VStack>
                      </Box>
                    )}
                  </VStack>
                </Box>
              )}
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onBacktestClose}>
              Close
            </Button>
            <Button
              colorScheme="purple"
              onClick={runBacktest}
              isLoading={isBacktesting}
              isDisabled={!backtestParams.symbol}
              leftIcon={<FiTrendingUp />}
            >
              Run Backtest
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Info Modal */}
      <Modal isOpen={isInfoOpen} onClose={onInfoClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>How Strategies Work</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack align="stretch" spacing={4}>
              <Box>
                <Text fontWeight="bold" mb={2}>
                  What are Trading Strategies?
                </Text>
                <Text fontSize="sm">
                  Trading strategies are automated rules that analyze market data and generate buy/sell signals
                  for your tracked symbols. Each strategy has configurable parameters that control its behavior.
                </Text>
              </Box>

              <Box>
                <Text fontWeight="bold" mb={2}>
                  Creating a Strategy
                </Text>
                <VStack align="stretch" spacing={2} fontSize="sm">
                  <Text>
                    <strong>1. Strategy Key:</strong> A unique identifier (e.g., "sma_cross", "rsi_strategy").
                    This key must match a strategy implementation in the backend code.
                  </Text>
                  <Text>
                    <strong>2. Strategy Name:</strong> A human-readable name for display purposes
                    (e.g., "SMA Crossover Strategy").
                  </Text>
                  <Text>
                    <strong>3. Parameters (JSON):</strong> Configuration values that control strategy behavior.
                    Must be valid JSON format.
                  </Text>
                </VStack>
              </Box>

              <Box>
                <Text fontWeight="bold" mb={2}>
                  Parameter Examples
                </Text>
                <VStack align="stretch" spacing={2}>
                  <Box>
                    <Text fontSize="sm" fontWeight="semibold">
                      SMA Crossover:
                    </Text>
                    <Code fontSize="xs" p={2} borderRadius="md" display="block">
                      {`{"fast": 10, "slow": 50}`}
                    </Code>
                    <Text fontSize="xs" color="gray.500" mt={1}>
                      Fast and slow period for moving averages
                    </Text>
                  </Box>
                  <Box>
                    <Text fontSize="sm" fontWeight="semibold">
                      RSI Strategy:
                    </Text>
                    <Code fontSize="xs" p={2} borderRadius="md" display="block">
                      {`{"oversold": 30, "overbought": 70, "period": 14}`}
                    </Code>
                    <Text fontSize="xs" color="gray.500" mt={1}>
                      Thresholds and period for RSI indicator
                    </Text>
                  </Box>
                </VStack>
              </Box>

              <Box>
                <Text fontWeight="bold" mb={2}>
                  Available Strategies
                </Text>
                <VStack align="stretch" spacing={1} fontSize="sm">
                  {availableStrategies?.map((strategy) => (
                    <HStack key={strategy.key}>
                      <Code fontSize="xs">{strategy.key}</Code>
                      <Text fontSize="xs" color="gray.500">
                        - {strategy.name}
                      </Text>
                    </HStack>
                  ))}
                  {(!availableStrategies || availableStrategies.length === 0) && (
                    <Text fontSize="xs" color="gray.500">
                      No strategies available. Contact administrator.
                    </Text>
                  )}
                </VStack>
              </Box>

              <Box>
                <Text fontWeight="bold" mb={2}>
                  How Strategies Generate Signals
                </Text>
                <VStack align="stretch" spacing={2} fontSize="sm">
                  <Text>
                    <strong>Daily Job:</strong> The system runs a daily job that fetches latest price data
                    for all tracked symbols.
                  </Text>
                  <Text>
                    <strong>Strategy Execution:</strong> Each enabled strategy analyzes the price data using
                    its parameters and generates BUY or SELL signals when conditions are met.
                  </Text>
                  <Text>
                    <strong>Signal Storage:</strong> Generated signals are stored and can be viewed in the
                    Signals page, where you can act on them manually or automatically.
                  </Text>
                </VStack>
              </Box>

              <Box>
                <Text fontWeight="bold" mb={2}>
                  Managing Strategies
                </Text>
                <VStack align="stretch" spacing={2} fontSize="sm">
                  <Text>
                    <strong>Enable/Disable:</strong> Toggle strategies on/off without deleting them.
                    Disabled strategies won't generate new signals.
                  </Text>
                  <Text>
                    <strong>Delete:</strong> Permanently remove a strategy. This doesn't affect previously
                    generated signals.
                  </Text>
                  <Text>
                    <strong>Personal Strategies:</strong> Each user has their own strategies. You can only
                    see and manage your own.
                  </Text>
                </VStack>
              </Box>

              <Box bg="blue.50" p={3} borderRadius="md">
                <Text fontSize="sm" color="blue.800">
                  <strong>💡 Tip:</strong> Start with the pre-configured SMA crossover strategy and adjust
                  parameters based on your backtesting results. Always test new strategies with small
                  positions first.
                </Text>
              </Box>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="blue" onClick={onInfoClose}>
              Got it
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </VStack>
  )
}

interface StrategyCardProps {
  strategy: any
  onToggle: (strategyId: number, enabled: boolean) => void
  onDelete: (strategy: any) => void
  onBacktest: (strategy: any) => void
  isUpdating: boolean
}

function StrategyCard({ strategy, onToggle, onDelete, onBacktest, isUpdating }: StrategyCardProps) {
  const cardBg = useColorModeValue('white', 'gray.800')
  const borderColor = useColorModeValue('gray.200', 'gray.700')

  let params: any = {}
  try {
    params = JSON.parse(strategy.params_json || '{}')
  } catch (e) {
    params = {}
  }

  return (
    <Card bg={cardBg} borderWidth="1px" borderColor={borderColor}>
      <CardBody>
        <VStack align="stretch" spacing={4}>
          <HStack justify="space-between">
            <Heading size="md">{strategy.name}</Heading>
            <HStack spacing={2}>
              <Badge colorScheme={strategy.enabled ? 'green' : 'gray'}>
                {strategy.enabled ? 'Enabled' : 'Disabled'}
              </Badge>
              <IconButton
                aria-label="Delete strategy"
                icon={<FiTrash2 />}
                size="sm"
                colorScheme="red"
                variant="ghost"
                onClick={() => onDelete(strategy)}
              />
            </HStack>
          </HStack>

          <Text fontSize="sm" color="gray.500">
            Key: <Code>{strategy.key}</Code>
          </Text>

          {Object.keys(params).length > 0 && (
            <VStack align="stretch" spacing={2}>
              <Text fontSize="sm" fontWeight="bold">
                Parameters:
              </Text>
              {Object.entries(params).map(([key, value]) => (
                <HStack key={key} justify="space-between">
                  <Text fontSize="sm" color="gray.500">
                    {key}:
                  </Text>
                  <Code fontSize="sm">{String(value)}</Code>
                </HStack>
              ))}
            </VStack>
          )}

          <HStack justify="space-between" pt={2}>
            <Text fontSize="sm">Enable Strategy</Text>
            <Switch
              isChecked={strategy.enabled}
              onChange={(e) => onToggle(strategy.id, e.target.checked)}
              isDisabled={isUpdating}
              colorScheme="green"
            />
          </HStack>

          <Button
            leftIcon={<FiTrendingUp />}
            size="sm"
            colorScheme="purple"
            variant="outline"
            onClick={() => onBacktest(strategy)}
            width="full"
          >
            Backtest Strategy
          </Button>
        </VStack>
      </CardBody>
    </Card>
  )
}
