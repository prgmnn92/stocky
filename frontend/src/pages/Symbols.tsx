import {
  Box,
  Heading,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Button,
  HStack,
  Badge,
  IconButton,
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
  VStack,
  useColorModeValue,
  Skeleton,
  Text,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  useToast,
  Tooltip,
  List,
  ListItem,
  ListIcon,
  Divider,
  Spinner,
} from '@chakra-ui/react'
import { FiPlus, FiTrash2, FiActivity, FiCheckCircle } from 'react-icons/fi'
import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { useSymbols, useCreateSymbol, useDeleteSymbol } from '@/hooks/useApiQueries'
import * as api from '@/services/api'
import type { SentimentData, SentimentDetail } from '@/types/api'
import { useAuth } from '@/contexts/AuthContext'

export default function Symbols() {
  const navigate = useNavigate()
  const { data: symbols, isLoading, refetch } = useSymbols()
  const createSymbol = useCreateSymbol()
  const deleteSymbol = useDeleteSymbol()
  const toast = useToast()
  const { canAddSymbols } = useAuth()

  const { isOpen, onOpen, onClose } = useDisclosure()
  const {
    isOpen: isSentimentModalOpen,
    onOpen: onSentimentModalOpen,
    onClose: onSentimentModalClose,
  } = useDisclosure()
  const [symbolToDelete, setSymbolToDelete] = useState<string | null>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  const [newSymbol, setNewSymbol] = useState({ symbol: '', name: '' })
  const [analyzingSymbol, setAnalyzingSymbol] = useState<string | null>(null)
  const [selectedSentiment, setSelectedSentiment] = useState<SentimentDetail | null>(null)
  const [loadingSentiment, setLoadingSentiment] = useState(false)

  const cardBg = useColorModeValue('white', 'gray.800')
  const borderColor = useColorModeValue('gray.200', 'gray.700')

  const handleCreate = async () => {
    if (!newSymbol.symbol) return
    await createSymbol.mutateAsync({
      symbol: newSymbol.symbol.toUpperCase(),
      name: newSymbol.name || undefined,
    })
    setNewSymbol({ symbol: '', name: '' })
    onClose()
  }

  const handleDelete = (symbol: string) => {
    setSymbolToDelete(symbol)
  }

  const confirmDelete = async () => {
    if (symbolToDelete) {
      await deleteSymbol.mutateAsync(symbolToDelete)
      setSymbolToDelete(null)
    }
  }

  const handleAnalyzeSentiment = async (symbol: string, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent row click navigation
    setAnalyzingSymbol(symbol)

    try {
      await api.analyzeSentiment(symbol)
      await refetch() // Refresh symbols to show new sentiment
      toast({
        title: 'Sentiment analyzed',
        description: `Sentiment analysis completed for ${symbol}`,
        status: 'success',
        duration: 3000,
      })
    } catch (error) {
      toast({
        title: 'Analysis failed',
        description: 'Could not complete sentiment analysis',
        status: 'error',
        duration: 3000,
      })
    } finally {
      setAnalyzingSymbol(null)
    }
  }

  const getSentimentBadgeColor = (classification: string) => {
    switch (classification) {
      case 'VERY_BULLISH':
        return 'green'
      case 'BULLISH':
        return 'teal'
      case 'NEUTRAL':
        return 'gray'
      case 'BEARISH':
        return 'orange'
      case 'VERY_BEARISH':
        return 'red'
      default:
        return 'gray'
    }
  }

  const getSentimentLabel = (classification: string) => {
    return classification.replace('_', ' ')
  }

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'HIGH':
        return 'green.500'
      case 'MEDIUM':
        return 'yellow.500'
      case 'LOW':
        return 'orange.500'
      default:
        return 'gray.500'
    }
  }

  const handleSentimentClick = async (symbol: string, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent row click navigation
    setLoadingSentiment(true)

    try {
      const response = await api.getLatestSentiment(symbol)
      setSelectedSentiment(response.data)
      onSentimentModalOpen()
    } catch (error) {
      toast({
        title: 'Failed to load sentiment details',
        description: 'Could not retrieve detailed sentiment analysis',
        status: 'error',
        duration: 3000,
      })
    } finally {
      setLoadingSentiment(false)
    }
  }

  return (
    <VStack spacing={6} align="stretch">
      <HStack justify="space-between">
        <Heading size="lg">Symbols</Heading>
        {canAddSymbols() && (
          <Button
            leftIcon={<FiPlus />}
            colorScheme="green"
            onClick={onOpen}
          >
            Add Symbol
          </Button>
        )}
      </HStack>

      <Box bg={cardBg} p={6} borderRadius="lg" borderWidth="1px" borderColor={borderColor}>
        {isLoading ? (
          <VStack>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} height="40px" width="100%" />
            ))}
          </VStack>
        ) : symbols && symbols.length > 0 ? (
          <Table variant="simple">
            <Thead>
              <Tr>
                <Th>Symbol</Th>
                <Th>Name</Th>
                <Th isNumeric>Last Price</Th>
                <Th>Sentiment</Th>
                <Th>Status</Th>
                <Th>Added</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {symbols.map((symbol) => (
                <Tr
                  key={symbol.symbol}
                  onClick={() => navigate(`/symbols/${symbol.symbol}`)}
                  cursor="pointer"
                  _hover={{ bg: useColorModeValue('gray.50', 'gray.700') }}
                  transition="background 0.2s"
                >
                  <Td fontWeight="bold" fontSize="lg">
                    {symbol.symbol}
                  </Td>
                  <Td>{symbol.name || '-'}</Td>
                  <Td isNumeric>
                    {symbol.last_price ? (
                      <VStack align="end" spacing={0}>
                        <Text fontWeight="bold">${symbol.last_price.toFixed(2)}</Text>
                        {symbol.last_price_date && (
                          <Text fontSize="xs" color="gray.500">
                            {format(new Date(symbol.last_price_date), 'MMM dd, yyyy')}
                          </Text>
                        )}
                      </VStack>
                    ) : (
                      <Text color="gray.500">N/A</Text>
                    )}
                  </Td>
                  <Td onClick={(e) => e.stopPropagation()}>
                    {symbol.sentiment ? (
                      <Tooltip label="Click to view details">
                        <VStack
                          align="start"
                          spacing={0}
                          cursor="pointer"
                          onClick={(e) => handleSentimentClick(symbol.symbol, e)}
                          _hover={{ opacity: 0.8 }}
                        >
                          <Badge
                            colorScheme={getSentimentBadgeColor(symbol.sentiment.classification)}
                            fontSize="xs"
                          >
                            {getSentimentLabel(symbol.sentiment.classification)}
                          </Badge>
                          <Text fontSize="xs" color="gray.500">
                            Score: {symbol.sentiment.score.toFixed(2)}
                          </Text>
                        </VStack>
                      </Tooltip>
                    ) : (
                      <Text color="gray.500" fontSize="sm">
                        Not analyzed
                      </Text>
                    )}
                  </Td>
                  <Td>
                    <Badge colorScheme={symbol.active ? 'green' : 'gray'}>
                      {symbol.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </Td>
                  <Td>{format(new Date(symbol.added_at), 'MMM dd, yyyy')}</Td>
                  <Td onClick={(e) => e.stopPropagation()}>
                    <HStack spacing={2}>
                      <Tooltip label="Analyze sentiment">
                        <IconButton
                          aria-label="Analyze sentiment"
                          icon={<FiActivity />}
                          size="sm"
                          colorScheme="purple"
                          variant="ghost"
                          onClick={(e) => handleAnalyzeSentiment(symbol.symbol, e)}
                          isLoading={analyzingSymbol === symbol.symbol}
                        />
                      </Tooltip>
                      <IconButton
                        aria-label="Delete symbol"
                        icon={<FiTrash2 />}
                        size="sm"
                        colorScheme="red"
                        variant="ghost"
                        onClick={() => handleDelete(symbol.symbol)}
                      />
                    </HStack>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        ) : (
          <Text color="gray.500">
            No symbols yet. Add your first symbol to get started.
          </Text>
        )}
      </Box>

      {/* Add Symbol Modal */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Add New Symbol</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Symbol</FormLabel>
                <Input
                  placeholder="AAPL"
                  value={newSymbol.symbol}
                  onChange={(e) =>
                    setNewSymbol({ ...newSymbol, symbol: e.target.value.toUpperCase() })
                  }
                />
              </FormControl>
              <FormControl>
                <FormLabel>Name (Optional)</FormLabel>
                <Input
                  placeholder="Apple Inc."
                  value={newSymbol.name}
                  onChange={(e) => setNewSymbol({ ...newSymbol, name: e.target.value })}
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button
              colorScheme="green"
              onClick={handleCreate}
              isLoading={createSymbol.isPending}
              isDisabled={!newSymbol.symbol}
            >
              Add Symbol
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete Confirmation */}
      <AlertDialog
        isOpen={!!symbolToDelete}
        leastDestructiveRef={cancelRef}
        onClose={() => setSymbolToDelete(null)}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete Symbol
            </AlertDialogHeader>
            <AlertDialogBody>
              Are you sure you want to delete <strong>{symbolToDelete}</strong>? This will
              deactivate the symbol.
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={() => setSymbolToDelete(null)}>
                Cancel
              </Button>
              <Button
                colorScheme="red"
                onClick={confirmDelete}
                ml={3}
                isLoading={deleteSymbol.isPending}
              >
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      {/* Sentiment Detail Modal */}
      <Modal
        isOpen={isSentimentModalOpen}
        onClose={onSentimentModalClose}
        size="xl"
        scrollBehavior="inside"
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            Sentiment Analysis Details
            {selectedSentiment && (
              <Text fontSize="md" fontWeight="normal" color="gray.500" mt={1}>
                {selectedSentiment.symbol}
              </Text>
            )}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            {loadingSentiment ? (
              <VStack py={8}>
                <Spinner size="xl" color="blue.500" />
                <Text color="gray.500">Loading sentiment details...</Text>
              </VStack>
            ) : selectedSentiment ? (
              <VStack spacing={4} align="stretch">
                {/* Classification and Score */}
                <HStack justify="space-between">
                  <Box>
                    <Text fontSize="sm" color="gray.500" mb={1}>
                      Classification
                    </Text>
                    <Badge
                      colorScheme={getSentimentBadgeColor(selectedSentiment.classification)}
                      fontSize="md"
                      px={3}
                      py={1}
                    >
                      {getSentimentLabel(selectedSentiment.classification)}
                    </Badge>
                  </Box>
                  <Box textAlign="right">
                    <Text fontSize="sm" color="gray.500" mb={1}>
                      Score
                    </Text>
                    <Text fontSize="2xl" fontWeight="bold">
                      {selectedSentiment.score.toFixed(2)}
                    </Text>
                  </Box>
                  <Box textAlign="right">
                    <Text fontSize="sm" color="gray.500" mb={1}>
                      Confidence
                    </Text>
                    <Text
                      fontSize="2xl"
                      fontWeight="bold"
                      color={getConfidenceColor(selectedSentiment.confidence)}
                    >
                      {selectedSentiment.confidence}
                    </Text>
                  </Box>
                </HStack>

                <Divider />

                {/* Reasoning */}
                <Box>
                  <Text fontSize="md" fontWeight="bold" mb={2}>
                    Analysis Reasoning
                  </Text>
                  <Text fontSize="sm" color={useColorModeValue('gray.700', 'gray.300')}>
                    {selectedSentiment.reasoning}
                  </Text>
                </Box>

                <Divider />

                {/* Key Factors */}
                <Box>
                  <Text fontSize="md" fontWeight="bold" mb={3}>
                    Key Factors
                  </Text>
                  <List spacing={2}>
                    {selectedSentiment.key_factors.map((factor, index) => (
                      <ListItem key={index} display="flex" alignItems="flex-start">
                        <ListIcon as={FiCheckCircle} color="green.500" mt={1} />
                        <Text fontSize="sm" flex={1}>
                          {factor}
                        </Text>
                      </ListItem>
                    ))}
                  </List>
                </Box>

                <Divider />

                {/* Time Window */}
                <Box>
                  <Text fontSize="sm" color="gray.500">
                    Analysis Period:{' '}
                    {format(new Date(selectedSentiment.window_start), 'MMM dd, yyyy')} -{' '}
                    {format(new Date(selectedSentiment.window_end), 'MMM dd, yyyy')}
                  </Text>
                </Box>
              </VStack>
            ) : (
              <Text color="gray.500">No sentiment data available</Text>
            )}
          </ModalBody>
          <ModalFooter>
            <Button onClick={onSentimentModalClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </VStack>
  )
}
