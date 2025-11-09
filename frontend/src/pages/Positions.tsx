import {
  Box,
  Heading,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Button,
  HStack,
  VStack,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Input,
  NumberInput,
  NumberInputField,
  Text,
  useColorModeValue,
  Skeleton,
  IconButton,
  Tooltip,
  Select,
  useToast,
  Spinner,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
} from '@chakra-ui/react'
import { FiPlus, FiX, FiRefreshCw } from 'react-icons/fi'
import { useState } from 'react'
import { format } from 'date-fns'
import {
  usePositions,
  useCreatePosition,
  useClosePosition,
  useSymbols,
} from '@/hooks/useApiQueries'
import * as api from '@/services/api'
import { useAuth } from '@/contexts/AuthContext'

export default function Positions() {
  const { data: openPositions, isLoading: openLoading } = usePositions('OPEN')
  const { data: closedPositions, isLoading: closedLoading } = usePositions('CLOSED')
  const { data: symbols } = useSymbols()
  const { user } = useAuth()

  const { isOpen: isOpenModal, onOpen: onOpenModal, onClose: onCloseModal } = useDisclosure()
  const {
    isOpen: isCloseModal,
    onOpen: onOpenCloseModal,
    onClose: onCloseCloseModal,
  } = useDisclosure()

  const createPosition = useCreatePosition()
  const closePosition = useClosePosition()
  const toast = useToast()

  const [newPosition, setNewPosition] = useState({
    symbol: '',
    qty: 0,
    price: 0,
  })

  const [positionToClose, setPositionToClose] = useState<{
    id: number
    symbol: string
    price: number
  } | null>(null)

  const [fetchingPrice, setFetchingPrice] = useState(false)

  const cardBg = useColorModeValue('white', 'gray.800')
  const borderColor = useColorModeValue('gray.200', 'gray.700')

  const handleOpenPosition = async () => {
    await createPosition.mutateAsync(newPosition)
    setNewPosition({ symbol: '', qty: 0, price: 0 })
    onCloseModal()
  }

  const handleClosePosition = async () => {
    if (!positionToClose) return
    await closePosition.mutateAsync({
      positionId: positionToClose.id,
      data: { price: positionToClose.price },
    })
    setPositionToClose(null)
    onCloseCloseModal()
  }

  const initiateClose = (position: any) => {
    setPositionToClose({
      id: position.id,
      symbol: position.symbol,
      price: position.avg_price, // Default to entry price
    })
    onOpenCloseModal()
  }

  const handleGetCurrentPrice = async () => {
    if (!newPosition.symbol) {
      toast({
        title: 'Please select a symbol first',
        status: 'warning',
        duration: 3000,
      })
      return
    }

    setFetchingPrice(true)
    try {
      const response = await api.getCurrentPrice(newPosition.symbol)
      setNewPosition({ ...newPosition, price: response.data.price })
      toast({
        title: 'Price fetched',
        description: `Current price for ${newPosition.symbol}: $${response.data.price.toFixed(2)}`,
        status: 'success',
        duration: 3000,
      })
    } catch (error) {
      toast({
        title: 'Failed to fetch price',
        description: 'Could not get current price for this symbol',
        status: 'error',
        duration: 3000,
      })
    } finally {
      setFetchingPrice(false)
    }
  }

  // Calculate portfolio metrics
  const investedAmount = openPositions?.reduce(
    (sum, pos) => sum + pos.qty * pos.avg_price,
    0
  ) || 0

  const currentValue = openPositions?.reduce(
    (sum, pos) => sum + (pos.current_value || pos.qty * pos.avg_price),
    0
  ) || 0

  const unrealizedPnL = openPositions?.reduce(
    (sum, pos) => sum + (pos.unrealized_pnl || 0),
    0
  ) || 0

  const totalBalance = (user?.balance || 0) + currentValue

  const pnlPercentage = investedAmount > 0 ? (unrealizedPnL / investedAmount) * 100 : 0

  return (
    <VStack spacing={6} align="stretch">
      <HStack justify="space-between">
        <Heading size="lg">Positionen</Heading>
        <Button leftIcon={<FiPlus />} colorScheme="green" onClick={onOpenModal}>
          Position öffnen
        </Button>
      </HStack>

      {/* Portfolio Summary */}
      <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={6}>
        <Box
          bg={cardBg}
          p={6}
          borderRadius="lg"
          borderWidth="1px"
          borderColor={borderColor}
        >
          <Stat>
            <StatLabel>Verfügbares Kapital</StatLabel>
            <StatNumber color="blue.500">
              ${user?.balance.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
            </StatNumber>
            <StatHelpText>Bereit zum Investieren</StatHelpText>
          </Stat>
        </Box>

        <Box
          bg={cardBg}
          p={6}
          borderRadius="lg"
          borderWidth="1px"
          borderColor={borderColor}
        >
          <Stat>
            <StatLabel>Investiert</StatLabel>
            <StatNumber color="purple.500">
              ${investedAmount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </StatNumber>
            <StatHelpText>In {openPositions?.length || 0} Positionen</StatHelpText>
          </Stat>
        </Box>

        <Box
          bg={cardBg}
          p={6}
          borderRadius="lg"
          borderWidth="1px"
          borderColor={borderColor}
        >
          <Stat>
            <StatLabel>Aktueller Wert</StatLabel>
            <StatNumber>
              ${currentValue.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </StatNumber>
            <StatHelpText>
              <StatArrow type={unrealizedPnL >= 0 ? 'increase' : 'decrease'} />
              {pnlPercentage >= 0 ? '+' : ''}{pnlPercentage.toFixed(2)}%
            </StatHelpText>
          </Stat>
        </Box>

        <Box
          bg={cardBg}
          p={6}
          borderRadius="lg"
          borderWidth="1px"
          borderColor={borderColor}
        >
          <Stat>
            <StatLabel>Gesamtes Portfolio</StatLabel>
            <StatNumber color="green.500">
              ${totalBalance.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </StatNumber>
            <StatHelpText>
              G/V: <Text as="span" color={unrealizedPnL >= 0 ? 'green.500' : 'red.500'} fontWeight="bold">
                ${unrealizedPnL.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </StatHelpText>
          </Stat>
        </Box>
      </SimpleGrid>

      <Tabs colorScheme="green">
        <TabList>
          <Tab>Offene Positionen ({openPositions?.length || 0})</Tab>
          <Tab>Geschlossene Positionen ({closedPositions?.length || 0})</Tab>
        </TabList>

        <TabPanels>
          {/* Open Positions */}
          <TabPanel px={0}>
            <Box
              bg={cardBg}
              p={6}
              borderRadius="lg"
              borderWidth="1px"
              borderColor={borderColor}
            >
              {openLoading ? (
                <VStack>
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} height="40px" width="100%" />
                  ))}
                </VStack>
              ) : openPositions && openPositions.length > 0 ? (
                <Table variant="simple">
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
                      <Th>Tage</Th>
                      <Th>Aktionen</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {openPositions.map((position) => {
                      const hasPriceData = position.current_price !== null && position.current_price !== undefined
                      const entryValue = position.qty * position.avg_price
                      const currentValue = position.current_value || entryValue
                      const pnlColor = hasPriceData
                        ? (position.unrealized_pnl || 0) >= 0
                          ? 'green'
                          : 'red'
                        : 'gray'

                      return (
                        <Tr key={position.id}>
                          <Td fontWeight="bold" fontSize="lg">
                            {position.symbol}
                          </Td>
                          <Td isNumeric>{position.qty}</Td>
                          <Td isNumeric>${position.avg_price.toFixed(2)}</Td>
                          <Td isNumeric>
                            {hasPriceData ? (
                              <Text fontWeight="bold" color="blue.500">
                                ${position.current_price!.toFixed(2)}
                              </Text>
                            ) : (
                              <Text color="gray.500" fontSize="sm">
                                N/A
                              </Text>
                            )}
                          </Td>
                          <Td isNumeric>
                            <Text color="gray.600">
                              ${entryValue.toFixed(2)}
                            </Text>
                          </Td>
                          <Td isNumeric fontWeight="bold">
                            <Text 
                              fontSize="lg"
                              color={hasPriceData ? (currentValue >= entryValue ? 'green.500' : 'red.500') : 'inherit'}
                            >
                              ${currentValue.toFixed(2)}
                            </Text>
                          </Td>
                          <Td isNumeric>
                            <Badge
                              colorScheme={pnlColor}
                              fontSize="sm"
                              px={2}
                              py={1}
                            >
                              {hasPriceData
                                ? `$${(position.unrealized_pnl || 0).toFixed(2)}`
                                : 'N/A'}
                            </Badge>
                          </Td>
                          <Td isNumeric>
                            <Badge
                              colorScheme={pnlColor}
                              fontSize="sm"
                              px={2}
                              py={1}
                            >
                              {hasPriceData
                                ? `${(position.pnl_percentage || 0) >= 0 ? '+' : ''}${(position.pnl_percentage || 0).toFixed(2)}%`
                                : 'N/A'}
                            </Badge>
                          </Td>
                          <Td>
                            <VStack align="start" spacing={0}>
                              <Text fontSize="sm" fontWeight="bold">
                                {position.days_open !== null && position.days_open !== undefined
                                  ? `${position.days_open}d`
                                  : 'N/A'}
                              </Text>
                              <Text fontSize="xs" color="gray.500">
                                {format(new Date(position.opened_at), 'dd. MMM')}
                              </Text>
                            </VStack>
                          </Td>
                          <Td>
                            <Tooltip label="Position schließen">
                              <IconButton
                                aria-label="Position schließen"
                                icon={<FiX />}
                                size="sm"
                                colorScheme="red"
                                onClick={() => initiateClose(position)}
                              />
                            </Tooltip>
                          </Td>
                        </Tr>
                      )
                    })}
                  </Tbody>
                </Table>
              ) : (
                <Text color="gray.500">
                  Keine offenen Positionen. Öffne eine Position basierend auf Signalen.
                </Text>
              )}

              {openPositions && openPositions.length > 0 && (
                <Box mt={6} p={4} bg="blue.50" borderRadius="md">
                  <HStack justify="space-between">
                    <Text fontWeight="bold" color="gray.700">
                      Gesamter unrealisierter G/V:
                    </Text>
                    <Text
                      fontSize="2xl"
                      fontWeight="bold"
                      color={
                        openPositions.reduce((sum, pos) => sum + (pos.unrealized_pnl || 0), 0) >= 0
                          ? 'green.600'
                          : 'red.600'
                      }
                    >
                      {openPositions.some((p) => p.current_price !== null && p.current_price !== undefined)
                        ? `$${openPositions
                            .reduce((sum, pos) => sum + (pos.unrealized_pnl || 0), 0)
                            .toFixed(2)}`
                        : 'N/A (Preisdaten nicht verfügbar)'}
                    </Text>
                  </HStack>
                  <HStack justify="space-between" mt={2}>
                    <Text fontSize="sm" color="gray.600">
                      Gesamter aktueller Wert:
                    </Text>
                    <Text fontSize="lg" fontWeight="bold" color="gray.700">
                      $
                      {openPositions
                        .reduce((sum, pos) => sum + (pos.current_value || pos.qty * pos.avg_price), 0)
                        .toFixed(2)}
                    </Text>
                  </HStack>
                </Box>
              )}
            </Box>
          </TabPanel>

          {/* Closed Positions */}
          <TabPanel px={0}>
            <Box
              bg={cardBg}
              p={6}
              borderRadius="lg"
              borderWidth="1px"
              borderColor={borderColor}
            >
              {closedLoading ? (
                <VStack>
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} height="40px" width="100%" />
                  ))}
                </VStack>
              ) : closedPositions && closedPositions.length > 0 ? (
                <Table variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Symbol</Th>
                      <Th isNumeric>Qty</Th>
                      <Th isNumeric>Entry</Th>
                      <Th isNumeric>Exit</Th>
                      <Th isNumeric>P&L</Th>
                      <Th>Duration</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {closedPositions.map((position) => {
                      const exitPrice =
                        position.pnl !== null
                          ? position.avg_price + position.pnl / position.qty
                          : 0

                      return (
                        <Tr key={position.id}>
                          <Td fontWeight="bold">{position.symbol}</Td>
                          <Td isNumeric>{position.qty}</Td>
                          <Td isNumeric>${position.avg_price.toFixed(2)}</Td>
                          <Td isNumeric>${exitPrice.toFixed(2)}</Td>
                          <Td isNumeric>
                            <Badge
                              colorScheme={
                                (position.pnl || 0) >= 0 ? 'green' : 'red'
                              }
                              fontSize="md"
                              px={2}
                              py={1}
                            >
                              ${position.pnl?.toFixed(2)}
                            </Badge>
                          </Td>
                          <Td>
                            <Text fontSize="sm">
                              {position.closed_at
                                ? format(
                                    new Date(position.closed_at),
                                    'MMM dd, yyyy'
                                  )
                                : '-'}
                            </Text>
                          </Td>
                        </Tr>
                      )
                    })}
                  </Tbody>
                </Table>
              ) : (
                <Text color="gray.500">Noch keine geschlossenen Positionen.</Text>
              )}

              {closedPositions && closedPositions.length > 0 && (
                <Box mt={6} p={4} bg="green.50" borderRadius="md">
                  <HStack justify="space-between">
                    <Text fontWeight="bold" color="gray.700">
                      Gesamt G/V:
                    </Text>
                    <Text fontSize="2xl" fontWeight="bold" color="green.600">
                      $
                      {closedPositions
                        .reduce((sum, pos) => sum + (pos.pnl || 0), 0)
                        .toFixed(2)}
                    </Text>
                  </HStack>
                </Box>
              )}
            </Box>
          </TabPanel>
        </TabPanels>
      </Tabs>

      {/* Open Position Modal */}
      <Modal isOpen={isOpenModal} onClose={onCloseModal}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Neue Position öffnen</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Symbol</FormLabel>
                <Select
                  placeholder="Symbol auswählen"
                  value={newPosition.symbol}
                  onChange={(e) =>
                    setNewPosition({
                      ...newPosition,
                      symbol: e.target.value,
                      price: 0, // Reset price when symbol changes
                    })
                  }
                >
                  {symbols?.map((s) => (
                    <option key={s.symbol} value={s.symbol}>
                      {s.symbol} {s.name ? `- ${s.name}` : ''}
                    </option>
                  ))}
                </Select>
              </FormControl>
              <FormControl isRequired>
                <FormLabel>Anzahl</FormLabel>
                <NumberInput
                  min={0.01}
                  precision={2}
                  value={newPosition.qty}
                  onChange={(_, num) =>
                    setNewPosition({ ...newPosition, qty: num })
                  }
                >
                  <NumberInputField placeholder="10" />
                </NumberInput>
              </FormControl>
              <FormControl isRequired>
                <FormLabel>Einstiegspreis</FormLabel>
                <HStack>
                  <NumberInput
                    flex="1"
                    min={0.01}
                    precision={2}
                    value={newPosition.price}
                    onChange={(_, num) =>
                      setNewPosition({ ...newPosition, price: num })
                    }
                  >
                    <NumberInputField placeholder="185.50" />
                  </NumberInput>
                  <Tooltip label="Aktuellen Preis von Yahoo Finance abrufen">
                    <IconButton
                      aria-label="Aktuellen Preis abrufen"
                      icon={fetchingPrice ? <Spinner size="sm" /> : <FiRefreshCw />}
                      onClick={handleGetCurrentPrice}
                      isDisabled={!newPosition.symbol || fetchingPrice}
                      colorScheme="blue"
                    />
                  </Tooltip>
                </HStack>
              </FormControl>
              <Box w="full" p={3} bg="gray.100" borderRadius="md">
                <HStack justify="space-between">
                  <Text fontSize="sm" fontWeight="bold">
                    Gesamtwert:
                  </Text>
                  <Text fontSize="lg" fontWeight="bold">
                    ${(newPosition.qty * newPosition.price).toFixed(2)}
                  </Text>
                </HStack>
              </Box>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onCloseModal}>
              Abbrechen
            </Button>
            <Button
              colorScheme="green"
              onClick={handleOpenPosition}
              isLoading={createPosition.isPending}
              isDisabled={
                !newPosition.symbol || newPosition.qty <= 0 || newPosition.price <= 0
              }
            >
              Position öffnen
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Close Position Modal */}
      <Modal isOpen={isCloseModal} onClose={onCloseCloseModal}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Position schließen</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {positionToClose && (
              <VStack spacing={4} align="stretch">
                <Text>
                  Position für <strong>{positionToClose.symbol}</strong> wird geschlossen
                </Text>
                <FormControl isRequired>
                  <FormLabel>Ausstiegspreis</FormLabel>
                  <NumberInput
                    min={0.01}
                    precision={2}
                    value={positionToClose.price}
                    onChange={(_, num) =>
                      setPositionToClose({ ...positionToClose, price: num })
                    }
                  >
                    <NumberInputField />
                  </NumberInput>
                </FormControl>
              </VStack>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onCloseCloseModal}>
              Abbrechen
            </Button>
            <Button
              colorScheme="red"
              onClick={handleClosePosition}
              isLoading={closePosition.isPending}
            >
              Position schließen
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </VStack>
  )
}
