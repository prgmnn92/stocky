import { useState, useRef, useEffect } from 'react'
import {
  Box,
  VStack,
  HStack,
  Input,
  IconButton,
  Text,
  Container,
  useColorModeValue,
  Spinner,
  Badge,
  Flex,
  Switch,
  FormControl,
  FormLabel,
  Tooltip,
} from '@chakra-ui/react'
import { FiSend, FiGlobe } from 'react-icons/fi'
import ReactMarkdown from 'react-markdown'
import type { ChatMessage, ChatStreamChunk } from '../types/api'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [webSearchEnabled, setWebSearchEnabled] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const bgColor = useColorModeValue('white', 'gray.800')
  const userBgColor = useColorModeValue('blue.50', 'blue.900')
  const assistantBgColor = useColorModeValue('gray.50', 'gray.700')

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const sendMessage = async () => {
    if (!input.trim() || isStreaming) return

    const userMessage: ChatMessage = {
      role: 'user',
      content: input.trim(),
    }

    // Add user message
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setError(null)
    setIsStreaming(true)

    // Start streaming response
    try {
      const token = localStorage.getItem('stocky_auth_token')
      const response = await fetch(`${API_BASE_URL}/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          model: 'gpt-4o-mini',
          web_search_enabled: webSearchEnabled,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No reader available')
      }

      const decoder = new TextDecoder()
      let assistantMessage = ''
      let toolCallInfo: any = null

      // Add empty assistant message that we'll update
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '' },
      ])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n\n')

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) continue

          try {
            const jsonStr = line.replace('data: ', '')
            const data: ChatStreamChunk = JSON.parse(jsonStr)

            if (data.type === 'content') {
              // Append content to assistant message
              assistantMessage += data.data
              setMessages((prev) => {
                const updated = [...prev]
                updated[updated.length - 1].content = assistantMessage
                return updated
              })
            } else if (data.type === 'tool_call') {
              // Store tool call info to display
              toolCallInfo = data.data
            } else if (data.type === 'done') {
              // Streaming complete
              break
            } else if (data.type === 'error') {
              throw new Error(data.data)
            }
          } catch (e) {
            console.error('Error parsing SSE chunk:', e)
          }
        }
      }

      setIsStreaming(false)
    } catch (err) {
      console.error('Chat error:', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
      setIsStreaming(false)

      // Remove empty assistant message on error
      setMessages((prev) => {
        const updated = [...prev]
        if (updated[updated.length - 1].content === '') {
          updated.pop()
        }
        return updated
      })
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <VStack h="calc(100vh - 40px)" spacing={0}>
      {/* Header */}
      <Box w="full" p={4} borderBottomWidth="1px">
        <Container maxW="container.lg">
          <HStack justify="space-between">
            <Box>
              <Text fontSize="2xl" fontWeight="bold">
                Stock Analysis Assistant
              </Text>
              <Text fontSize="sm" color="gray.500" mt={1}>
                Ask me about your portfolio, recent signals, or stock market analysis
              </Text>
            </Box>
            <HStack spacing={4}>
              <Tooltip label="Enable web search for real-time news and market data">
                <FormControl display="flex" alignItems="center">
                  <FormLabel htmlFor="web-search" mb="0" fontSize="sm" mr={2}>
                    <HStack spacing={1}>
                      <FiGlobe />
                      <Text>Web Search</Text>
                    </HStack>
                  </FormLabel>
                  <Switch
                    id="web-search"
                    isChecked={webSearchEnabled}
                    onChange={(e) => setWebSearchEnabled(e.target.checked)}
                    colorScheme="green"
                  />
                </FormControl>
              </Tooltip>
              <Badge colorScheme={isStreaming ? 'green' : 'gray'}>
                {isStreaming ? 'Thinking...' : 'Ready'}
              </Badge>
            </HStack>
          </HStack>
        </Container>
      </Box>

      {/* Messages */}
      <Box flex="1" w="full" overflowY="auto" p={4}>
        <Container maxW="container.lg">
          <VStack spacing={4} align="stretch">
            {messages.length === 0 && (
              <VStack spacing={4} py={8} color="gray.500">
                <Text fontSize="lg">Start a conversation!</Text>
                <VStack spacing={2} align="start" fontSize="sm">
                  <Text>💡 Try asking:</Text>
                  <Text pl={4}>• "What symbols am I tracking?"</Text>
                  <Text pl={4}>• "Show me recent BUY signals"</Text>
                  <Text pl={4}>• "How are my positions performing?"</Text>
                  <Text pl={4}>• "Analyze AAPL stock"</Text>
                </VStack>
              </VStack>
            )}

            {messages.map((msg, idx) => (
              <Flex
                key={idx}
                justify={msg.role === 'user' ? 'flex-end' : 'flex-start'}
              >
                <Box
                  maxW="80%"
                  bg={msg.role === 'user' ? userBgColor : assistantBgColor}
                  p={4}
                  borderRadius="lg"
                  boxShadow="sm"
                >
                  <Text
                    fontSize="xs"
                    fontWeight="bold"
                    mb={2}
                    color={msg.role === 'user' ? 'blue.600' : 'green.600'}
                  >
                    {msg.role === 'user' ? 'You' : 'Assistant'}
                  </Text>
                  {msg.content ? (
                    <Box
                      sx={{
                        '& p': { mb: 2 },
                        '& ul, & ol': { ml: 4, mb: 2 },
                        '& li': { mb: 1 },
                        '& code': {
                          bg: 'gray.700',
                          px: 2,
                          py: 1,
                          borderRadius: 'md',
                          fontSize: 'sm',
                        },
                        '& pre': {
                          bg: 'gray.700',
                          p: 3,
                          borderRadius: 'md',
                          overflowX: 'auto',
                          mb: 2,
                        },
                        '& h1, & h2, & h3': { fontWeight: 'bold', mb: 2 },
                        '& strong': { fontWeight: 'bold' },
                        '& em': { fontStyle: 'italic' },
                        '& a': {
                          color: 'cyan.400',
                          textDecoration: 'underline',
                          _hover: { color: 'cyan.300' },
                        },
                      }}
                    >
                      <ReactMarkdown
                        components={{
                          a: ({ node, ...props }) => (
                            <a {...props} target="_blank" rel="noopener noreferrer" />
                          ),
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </Box>
                  ) : (
                    <HStack spacing={2}>
                      <Spinner size="sm" />
                      <Text fontSize="sm" color="gray.500">
                        Thinking...
                      </Text>
                    </HStack>
                  )}
                </Box>
              </Flex>
            ))}

            {error && (
              <Box bg="red.100" color="red.800" p={4} borderRadius="lg">
                <Text fontWeight="bold">Error</Text>
                <Text fontSize="sm">{error}</Text>
              </Box>
            )}

            <div ref={messagesEndRef} />
          </VStack>
        </Container>
      </Box>

      {/* Input */}
      <Box w="full" p={4} borderTopWidth="1px" bg={bgColor}>
        <Container maxW="container.lg">
          <HStack spacing={2}>
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask about your portfolio or stock analysis..."
              size="lg"
              disabled={isStreaming}
            />
            <IconButton
              aria-label="Send message"
              icon={<FiSend />}
              colorScheme="brand"
              size="lg"
              onClick={sendMessage}
              isLoading={isStreaming}
              disabled={!input.trim() || isStreaming}
            />
          </HStack>
        </Container>
      </Box>
    </VStack>
  )
}
