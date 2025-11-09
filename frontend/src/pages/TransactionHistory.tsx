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
  Spinner,
  Text,
  Card,
  CardBody,
} from '@chakra-ui/react'
import { useTransactions } from '@/hooks/useApiQueries'
import { format } from 'date-fns'

export default function TransactionHistory() {
  const { data: transactions, isLoading, error } = useTransactions()

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minH="400px">
        <Spinner size="xl" />
      </Box>
    )
  }

  if (error) {
    return (
      <Box>
        <Text color="red.500">Failed to load transaction history</Text>
      </Box>
    )
  }

  return (
    <Box>
      <Heading mb={6}>Transaction History</Heading>

      <Card>
        <CardBody overflowX="auto">
          {transactions && transactions.length > 0 ? (
            <Table variant="simple">
              <Thead>
                <Tr>
                  <Th>Date</Th>
                  <Th>Symbol</Th>
                  <Th>Side</Th>
                  <Th isNumeric>Quantity</Th>
                  <Th isNumeric>Price</Th>
                  <Th isNumeric>Total</Th>
                  <Th isNumeric>Fee</Th>
                  <Th>Status</Th>
                  <Th isNumeric>Position P&L</Th>
                </Tr>
              </Thead>
              <Tbody>
                {transactions.map((tx) => (
                  <Tr key={tx.id}>
                    <Td>
                      <Text fontSize="sm">
                        {format(new Date(tx.ts), 'MMM dd, yyyy')}
                      </Text>
                      <Text fontSize="xs" color="gray.500">
                        {format(new Date(tx.ts), 'HH:mm:ss')}
                      </Text>
                    </Td>
                    <Td fontWeight="semibold">{tx.symbol}</Td>
                    <Td>
                      <Badge colorScheme={tx.side === 'BUY' ? 'green' : 'red'}>
                        {tx.side}
                      </Badge>
                    </Td>
                    <Td isNumeric>{tx.qty.toFixed(2)}</Td>
                    <Td isNumeric>${tx.price.toFixed(2)}</Td>
                    <Td isNumeric fontWeight="semibold">
                      ${tx.total.toFixed(2)}
                    </Td>
                    <Td isNumeric>${tx.fee.toFixed(2)}</Td>
                    <Td>
                      <Badge
                        colorScheme={tx.position_status === 'OPEN' ? 'blue' : 'gray'}
                      >
                        {tx.position_status}
                      </Badge>
                    </Td>
                    <Td isNumeric>
                      {tx.position_pnl !== null ? (
                        <Text
                          color={tx.position_pnl >= 0 ? 'green.500' : 'red.500'}
                          fontWeight="semibold"
                        >
                          ${tx.position_pnl.toFixed(2)}
                        </Text>
                      ) : (
                        <Text color="gray.500">-</Text>
                      )}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          ) : (
            <Box textAlign="center" py={10}>
              <Text color="gray.500">No transactions yet</Text>
              <Text color="gray.400" fontSize="sm" mt={2}>
                Open your first position to see transaction history
              </Text>
            </Box>
          )}
        </CardBody>
      </Card>

      {transactions && transactions.length > 0 && (
        <Box mt={4}>
          <Text fontSize="sm" color="gray.500">
            Showing {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
          </Text>
        </Box>
      )}
    </Box>
  )
}
