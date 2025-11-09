import {
  Box,
  Heading,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  VStack,
  HStack,
  Select,
  Input,
  Text,
  useColorModeValue,
  Skeleton,
  Progress,
} from '@chakra-ui/react'
import { useState } from 'react'
import { format } from 'date-fns'
import { useSignals, useSymbols, useStrategies } from '@/hooks/useApiQueries'

export default function Signals() {
  const [filters, setFilters] = useState<{
    symbol?: string
    strategy_key?: string
    limit: number
  }>({ limit: 50 })

  const { data: signals, isLoading } = useSignals(filters)
  const { data: symbols } = useSymbols()
  const { data: strategies } = useStrategies()

  const cardBg = useColorModeValue('white', 'gray.800')
  const borderColor = useColorModeValue('gray.200', 'gray.700')

  return (
    <VStack spacing={6} align="stretch">
      <Heading size="lg">Signals</Heading>

      {/* Filters */}
      <Box bg={cardBg} p={4} borderRadius="lg" borderWidth="1px" borderColor={borderColor}>
        <HStack spacing={4} wrap="wrap">
          <Box flex="1" minW="200px">
            <Text mb={2} fontSize="sm" fontWeight="medium">
              Symbol
            </Text>
            <Select
              placeholder="All symbols"
              value={filters.symbol || ''}
              onChange={(e) =>
                setFilters({ ...filters, symbol: e.target.value || undefined })
              }
            >
              {symbols?.map((s) => (
                <option key={s.symbol} value={s.symbol}>
                  {s.symbol}
                </option>
              ))}
            </Select>
          </Box>

          <Box flex="1" minW="200px">
            <Text mb={2} fontSize="sm" fontWeight="medium">
              Strategy
            </Text>
            <Select
              placeholder="All strategies"
              value={filters.strategy_key || ''}
              onChange={(e) =>
                setFilters({ ...filters, strategy_key: e.target.value || undefined })
              }
            >
              {strategies?.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Box>

          <Box flex="1" minW="150px">
            <Text mb={2} fontSize="sm" fontWeight="medium">
              Limit
            </Text>
            <Input
              type="number"
              value={filters.limit}
              onChange={(e) =>
                setFilters({ ...filters, limit: parseInt(e.target.value) || 50 })
              }
              min={1}
              max={500}
            />
          </Box>
        </HStack>
      </Box>

      {/* Signals Table */}
      <Box bg={cardBg} p={6} borderRadius="lg" borderWidth="1px" borderColor={borderColor}>
        {isLoading ? (
          <VStack>
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} height="40px" width="100%" />
            ))}
          </VStack>
        ) : signals && signals.length > 0 ? (
          <Box overflowX="auto">
            <Table variant="simple">
              <Thead>
                <Tr>
                  <Th>Symbol</Th>
                  <Th>Action</Th>
                  <Th>Strategy</Th>
                  <Th>Confidence</Th>
                  <Th>Date</Th>
                  <Th>Price</Th>
                </Tr>
              </Thead>
              <Tbody>
                {signals.map((signal) => {
                  let meta: any = {}
                  try {
                    meta = JSON.parse(signal.meta_json)
                  } catch (e) {}

                  return (
                    <Tr key={signal.id}>
                      <Td fontWeight="bold" fontSize="lg">
                        {signal.symbol}
                      </Td>
                      <Td>
                        <Badge
                          colorScheme={signal.action === 'BUY' ? 'green' : 'red'}
                          fontSize="sm"
                          px={3}
                          py={1}
                        >
                          {signal.action}
                        </Badge>
                      </Td>
                      <Td>
                        <Text fontSize="sm">{signal.strategy_key}</Text>
                      </Td>
                      <Td>
                        <VStack align="stretch" spacing={1}>
                          <Text fontSize="sm">
                            {(signal.confidence * 100).toFixed(0)}%
                          </Text>
                          <Progress
                            value={signal.confidence * 100}
                            size="sm"
                            colorScheme="green"
                            borderRadius="md"
                          />
                        </VStack>
                      </Td>
                      <Td>
                        <Text fontSize="sm">
                          {format(new Date(signal.ts), 'MMM dd, yyyy')}
                        </Text>
                        <Text fontSize="xs" color="gray.500">
                          {format(new Date(signal.ts), 'HH:mm')}
                        </Text>
                      </Td>
                      <Td>
                        {meta.price ? (
                          <Text fontSize="sm" fontWeight="medium">
                            ${meta.price.toFixed(2)}
                          </Text>
                        ) : (
                          <Text fontSize="sm" color="gray.500">
                            -
                          </Text>
                        )}
                      </Td>
                    </Tr>
                  )
                })}
              </Tbody>
            </Table>
          </Box>
        ) : (
          <Text color="gray.500">
            No signals found. Run the daily job to generate signals.
          </Text>
        )}
      </Box>
    </VStack>
  )
}
