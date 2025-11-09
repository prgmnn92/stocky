import {
  Box,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  Heading,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Button,
  VStack,
  HStack,
  useColorModeValue,
  Skeleton,
  Text,
  Icon,
} from '@chakra-ui/react'
import { FiActivity, FiTarget, FiTrendingUp, FiDollarSign, FiPlay, FiPieChart } from 'react-icons/fi'
import { format } from 'date-fns'
import {
  useSymbols,
  useStrategies,
  useSignals,
  usePositions,
  useTriggerDaily,
} from '@/hooks/useApiQueries'
import { useAuth } from '@/contexts/AuthContext'

export default function Dashboard() {
  const { data: symbols, isLoading: symbolsLoading } = useSymbols()
  const { data: strategies, isLoading: strategiesLoading } = useStrategies()
  const { data: signals, isLoading: signalsLoading } = useSignals({ limit: 10 })
  const { data: openPositions, isLoading: positionsLoading } = usePositions('OPEN')
  const { data: closedPositions } = usePositions('CLOSED')
  const { canRunDailyJob } = useAuth()

  const triggerDaily = useTriggerDaily()

  const totalPnl =
    closedPositions?.reduce((sum, pos) => sum + (pos.pnl || 0), 0) || 0

  const unrealizedPnL = openPositions?.reduce(
    (sum, pos) => sum + (pos.unrealized_pnl || 0),
    0
  ) || 0

  const currentValue = openPositions?.reduce(
    (sum, pos) => sum + (pos.current_value || pos.qty * pos.avg_price),
    0
  ) || 0

  const investedAmount = openPositions?.reduce(
    (sum, pos) => sum + pos.qty * pos.avg_price,
    0
  ) || 0

  const pnlPercentage = investedAmount > 0 ? (unrealizedPnL / investedAmount) * 100 : 0

  const activeStrategies = strategies?.filter((s) => s.enabled).length || 0

  const cardBg = useColorModeValue('white', 'gray.800')
  const borderColor = useColorModeValue('gray.200', 'gray.700')

  return (
    <VStack spacing={6} align="stretch">
      <HStack justify="space-between">
        <Heading size="lg">Dashboard</Heading>
        {canRunDailyJob() && (
          <Button
            leftIcon={<FiPlay />}
            colorScheme="green"
            onClick={() => triggerDaily.mutate()}
            isLoading={triggerDaily.isPending}
            loadingText="Läuft..."
          >
            Daily Job starten
          </Button>
        )}
      </HStack>

      {/* Stats Cards */}
      <SimpleGrid columns={{ base: 1, md: 2, lg: 5 }} spacing={6}>
        <StatsCard
          title="Aktive Symbole"
          value={symbols?.length || 0}
          icon={FiActivity}
          isLoading={symbolsLoading}
        />
        <StatsCard
          title="Aktive Strategien"
          value={activeStrategies}
          icon={FiTarget}
          isLoading={strategiesLoading}
        />
        <StatsCard
          title="Neue Signale"
          value={signals?.length || 0}
          icon={FiTrendingUp}
          isLoading={signalsLoading}
        />
        <StatsCard
          title="Offene Positionen"
          value={openPositions?.length || 0}
          icon={FiDollarSign}
          isLoading={positionsLoading}
          helpText={`Investiert: $${investedAmount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        />
        <Box bg={cardBg} p={6} borderRadius="lg" borderWidth="1px" borderColor={borderColor}>
          <Stat>
            <HStack justify="space-between" mb={2}>
              <StatLabel>Unrealisierter G/V</StatLabel>
              <Icon as={FiPieChart} w={5} h={5} color={unrealizedPnL >= 0 ? 'green.400' : 'red.400'} />
            </HStack>
            {positionsLoading ? (
              <Skeleton height="40px" />
            ) : (
              <>
                <StatNumber fontSize="3xl" color={unrealizedPnL >= 0 ? 'green.500' : 'red.500'}>
                  ${unrealizedPnL.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </StatNumber>
                <StatHelpText>
                  <StatArrow type={unrealizedPnL >= 0 ? 'increase' : 'decrease'} />
                  {pnlPercentage >= 0 ? '+' : ''}{pnlPercentage.toFixed(2)}%
                </StatHelpText>
              </>
            )}
          </Stat>
        </Box>
      </SimpleGrid>

      {/* Recent Signals */}
      <Box bg={cardBg} p={6} borderRadius="lg" borderWidth="1px" borderColor={borderColor}>
        <Heading size="md" mb={4}>
          Aktuelle Signale
        </Heading>
        {signalsLoading ? (
          <VStack>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} height="40px" width="100%" />
            ))}
          </VStack>
        ) : signals && signals.length > 0 ? (
          <Table variant="simple" size="sm">
            <Thead>
              <Tr>
                <Th>Symbol</Th>
                <Th>Aktion</Th>
                <Th>Strategie</Th>
                <Th>Konfidenz</Th>
                <Th>Datum</Th>
              </Tr>
            </Thead>
            <Tbody>
              {signals.slice(0, 10).map((signal) => (
                <Tr key={signal.id}>
                  <Td fontWeight="bold">{signal.symbol}</Td>
                  <Td>
                    <Badge colorScheme={signal.action === 'BUY' ? 'green' : 'red'}>
                      {signal.action}
                    </Badge>
                  </Td>
                  <Td>{signal.strategy_key}</Td>
                  <Td>{(signal.confidence * 100).toFixed(0)}%</Td>
                  <Td>{format(new Date(signal.ts), 'dd. MMM yyyy')}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        ) : (
          <Text color="gray.500">Noch keine Signale. Starte den Daily Job, um Signale zu generieren.</Text>
        )}
      </Box>

      {/* Open Positions Summary */}
      <Box bg={cardBg} p={6} borderRadius="lg" borderWidth="1px" borderColor={borderColor}>
        <Heading size="md" mb={4}>
          Offene Positionen
        </Heading>
        {positionsLoading ? (
          <VStack>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} height="40px" width="100%" />
            ))}
          </VStack>
        ) : openPositions && openPositions.length > 0 ? (
          <>
            <Table variant="simple" size="sm">
              <Thead>
                <Tr>
                  <Th>Symbol</Th>
                  <Th isNumeric>Anzahl</Th>
                  <Th isNumeric>Einstieg</Th>
                  <Th isNumeric>Aktuell</Th>
                  <Th isNumeric>Eingangswert</Th>
                  <Th isNumeric>Aktueller Wert</Th>
                  <Th isNumeric>G/V</Th>
                  <Th isNumeric>%</Th>
                  <Th>Eröffnet</Th>
                </Tr>
              </Thead>
              <Tbody>
                {openPositions.map((position) => {
                  const hasPriceData = position.current_price !== null && position.current_price !== undefined
                  const entryValue = position.qty * position.avg_price
                  const currentVal = position.current_value || entryValue
                  const pnlColor = hasPriceData
                    ? (position.unrealized_pnl || 0) >= 0
                      ? 'green'
                      : 'red'
                    : 'gray'
                  
                  return (
                    <Tr key={position.id}>
                      <Td fontWeight="bold">{position.symbol}</Td>
                      <Td isNumeric>{position.qty}</Td>
                      <Td isNumeric>${position.avg_price.toFixed(2)}</Td>
                      <Td isNumeric>
                        {hasPriceData ? (
                          <Text fontWeight="bold" color="blue.500">
                            ${position.current_price!.toFixed(2)}
                          </Text>
                        ) : (
                          <Text color="gray.500" fontSize="xs">N/A</Text>
                        )}
                      </Td>
                      <Td isNumeric>
                        <Text color="gray.600" fontSize="sm">
                          ${entryValue.toFixed(2)}
                        </Text>
                      </Td>
                      <Td isNumeric>
                        <Text 
                          fontWeight="bold"
                          color={hasPriceData ? (currentVal >= entryValue ? 'green.500' : 'red.500') : 'inherit'}
                        >
                          ${currentVal.toFixed(2)}
                        </Text>
                      </Td>
                      <Td isNumeric>
                        <Badge colorScheme={pnlColor} fontSize="xs">
                          {hasPriceData ? `$${(position.unrealized_pnl || 0).toFixed(2)}` : 'N/A'}
                        </Badge>
                      </Td>
                      <Td isNumeric>
                        <Badge colorScheme={pnlColor} fontSize="xs">
                          {hasPriceData
                            ? `${(position.pnl_percentage || 0) >= 0 ? '+' : ''}${(position.pnl_percentage || 0).toFixed(2)}%`
                            : 'N/A'}
                        </Badge>
                      </Td>
                      <Td>{format(new Date(position.opened_at), 'dd. MMM')}</Td>
                    </Tr>
                  )
                })}
              </Tbody>
            </Table>
            <Box mt={4} p={3} bg="blue.50" borderRadius="md">
              <HStack justify="space-between">
                <Text fontSize="sm" fontWeight="bold" color="gray.700">
                  Gesamter aktueller Wert:
                </Text>
                <Text fontSize="lg" fontWeight="bold" color="gray.800">
                  ${currentValue.toFixed(2)}
                </Text>
              </HStack>
            </Box>
          </>
        ) : (
          <Text color="gray.500">
            Keine offenen Positionen. Öffne eine Position basierend auf Signalen.
          </Text>
        )}
      </Box>
    </VStack>
  )
}

interface StatsCardProps {
  title: string
  value: number
  icon: any
  isLoading?: boolean
  helpText?: string
}

function StatsCard({ title, value, icon, isLoading, helpText }: StatsCardProps) {
  const cardBg = useColorModeValue('white', 'gray.800')
  const borderColor = useColorModeValue('gray.200', 'gray.700')

  return (
    <Box bg={cardBg} p={6} borderRadius="lg" borderWidth="1px" borderColor={borderColor}>
      <Stat>
        <HStack justify="space-between" mb={2}>
          <StatLabel>{title}</StatLabel>
          <Icon as={icon} w={5} h={5} color="green.400" />
        </HStack>
        {isLoading ? (
          <Skeleton height="40px" />
        ) : (
          <>
            <StatNumber fontSize="3xl">{value}</StatNumber>
            {helpText && <StatHelpText>{helpText}</StatHelpText>}
          </>
        )}
      </Stat>
    </Box>
  )
}
