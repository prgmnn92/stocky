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
  useColorModeValue,
  Skeleton,
  Text,
  useToast,
  IconButton,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  Button,
  useDisclosure,
  NumberInput,
  NumberInputField,
} from '@chakra-ui/react'
import { useState, useEffect, useRef } from 'react'
import { format } from 'date-fns'
import { FiTrash2 } from 'react-icons/fi'
import * as api from '@/services/api'
import type { AuthUser } from '@/types/api'
import { useAuth } from '@/contexts/AuthContext'

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'purple',
  MANAGER: 'blue',
  USER: 'green',
  TEST_USER: 'gray',
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  USER: 'User',
  TEST_USER: 'Test User',
}

export default function Users() {
  const [users, setUsers] = useState<AuthUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [updatingUserId, setUpdatingUserId] = useState<number | null>(null)
  const [userToDelete, setUserToDelete] = useState<AuthUser | null>(null)
  const [editingBalanceUserId, setEditingBalanceUserId] = useState<number | null>(null)
  const [balanceValue, setBalanceValue] = useState<string>('')
  const { isOpen, onOpen, onClose } = useDisclosure()
  const cancelRef = useRef<HTMLButtonElement>(null)
  const { user: currentUser, isAdmin, isManager } = useAuth()
  const toast = useToast()

  const cardBg = useColorModeValue('white', 'gray.800')
  const borderColor = useColorModeValue('gray.200', 'gray.700')

  const fetchUsers = async () => {
    try {
      const response = await api.listUsers()
      setUsers(response.data)
    } catch (error) {
      toast({
        title: 'Failed to load users',
        status: 'error',
        duration: 3000,
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleRoleChange = async (userId: number, newRole: string) => {
    setUpdatingUserId(userId)

    try {
      await api.updateUserRole(userId, newRole)
      await fetchUsers()
      toast({
        title: 'Role updated',
        description: 'User role has been successfully updated',
        status: 'success',
        duration: 3000,
      })
    } catch (error: any) {
      toast({
        title: 'Failed to update role',
        description: error.response?.data?.detail || 'Could not update user role',
        status: 'error',
        duration: 3000,
      })
    } finally {
      setUpdatingUserId(null)
    }
  }

  const handleBalanceUpdate = async (userId: number) => {
    const newBalance = parseFloat(balanceValue)
    if (isNaN(newBalance) || newBalance < 0) {
      toast({
        title: 'Invalid balance',
        description: 'Balance must be a positive number',
        status: 'error',
        duration: 3000,
      })
      return
    }

    try {
      await api.updateUserBalance(userId, newBalance)
      await fetchUsers()
      setEditingBalanceUserId(null)
      setBalanceValue('')
      toast({
        title: 'Balance updated',
        description: 'User balance has been successfully updated',
        status: 'success',
        duration: 3000,
      })
    } catch (error: any) {
      toast({
        title: 'Failed to update balance',
        description: error.response?.data?.detail || 'Could not update user balance',
        status: 'error',
        duration: 3000,
      })
    }
  }

  const canEditBalance = (user: AuthUser) => {
    if (!currentUser) return false
    if (currentUser.id === user.id) return false // Can't edit own balance

    if (isAdmin()) return true

    if (isManager()) {
      // Managers can only edit test user balances
      return user.role === 'TEST_USER'
    }

    return false
  }

  const canEditUser = (user: AuthUser) => {
    if (currentUser?.id === user.id) return false // Can't edit yourself

    if (isAdmin()) return true

    if (isManager()) {
      // Managers can only edit test users
      return user.role === 'TEST_USER'
    }

    return false
  }

  const getAvailableRoles = (user: AuthUser) => {
    if (isAdmin()) {
      return ['ADMIN', 'MANAGER', 'USER', 'TEST_USER']
    }

    if (isManager() && user.role === 'TEST_USER') {
      return ['USER', 'TEST_USER']
    }

    return []
  }

  const handleDeleteClick = (user: AuthUser) => {
    setUserToDelete(user)
    onOpen()
  }

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return

    try {
      await api.deleteUser(userToDelete.id)
      await fetchUsers()
      toast({
        title: 'User deleted',
        description: `User ${userToDelete.username} has been deleted`,
        status: 'success',
        duration: 3000,
      })
    } catch (error: any) {
      toast({
        title: 'Failed to delete user',
        description: error.response?.data?.detail || 'Could not delete user',
        status: 'error',
        duration: 3000,
      })
    } finally {
      onClose()
      setUserToDelete(null)
    }
  }

  const canDeleteUser = (user: AuthUser) => {
    // Only admins can delete
    if (!isAdmin()) return false
    // Can't delete yourself
    if (currentUser?.id === user.id) return false
    return true
  }

  return (
    <VStack spacing={6} align="stretch">
      <Heading size="lg">User Management</Heading>

      <Box bg={cardBg} p={6} borderRadius="lg" borderWidth="1px" borderColor={borderColor}>
        {isLoading ? (
          <VStack>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} height="40px" width="100%" />
            ))}
          </VStack>
        ) : users && users.length > 0 ? (
          <Table variant="simple">
            <Thead>
              <Tr>
                <Th>Username</Th>
                <Th>Role</Th>
                <Th>Balance</Th>
                <Th>Status</Th>
                <Th>Created</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {users.map((user) => (
                <Tr key={user.id}>
                  <Td fontWeight="bold">{user.username}</Td>
                  <Td>
                    {canEditUser(user) ? (
                      <Select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        isDisabled={updatingUserId === user.id}
                        size="sm"
                        maxW="150px"
                      >
                        {getAvailableRoles(user).map((role) => (
                          <option key={role} value={role}>
                            {ROLE_LABELS[role]}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <Badge colorScheme={ROLE_COLORS[user.role]}>
                        {ROLE_LABELS[user.role]}
                      </Badge>
                    )}
                  </Td>
                  <Td>
                    {canEditBalance(user) ? (
                      editingBalanceUserId === user.id ? (
                        <HStack spacing={2}>
                          <NumberInput
                            size="sm"
                            maxW="120px"
                            value={balanceValue}
                            onChange={setBalanceValue}
                            min={0}
                            precision={2}
                          >
                            <NumberInputField />
                          </NumberInput>
                          <Button
                            size="sm"
                            colorScheme="blue"
                            onClick={() => handleBalanceUpdate(user.id)}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingBalanceUserId(null)
                              setBalanceValue('')
                            }}
                          >
                            Cancel
                          </Button>
                        </HStack>
                      ) : (
                        <Text
                          cursor="pointer"
                          color="blue.500"
                          _hover={{ textDecoration: 'underline' }}
                          onClick={() => {
                            setEditingBalanceUserId(user.id)
                            setBalanceValue(user.balance.toString())
                          }}
                        >
                          ${user.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Text>
                      )
                    ) : (
                      <Text>
                        ${user.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Text>
                    )}
                  </Td>
                  <Td>
                    <Badge colorScheme={user.active ? 'green' : 'gray'}>
                      {user.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </Td>
                  <Td>
                    {user.created_at
                      ? format(new Date(user.created_at), 'MMM dd, yyyy')
                      : 'N/A'}
                  </Td>
                  <Td>
                    {canDeleteUser(user) && (
                      <IconButton
                        aria-label="Delete user"
                        icon={<FiTrash2 />}
                        colorScheme="red"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteClick(user)}
                      />
                    )}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        ) : (
          <Text color="gray.500">No users found.</Text>
        )}
      </Box>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        isOpen={isOpen}
        leastDestructiveRef={cancelRef}
        onClose={onClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete User
            </AlertDialogHeader>

            <AlertDialogBody>
              Are you sure you want to delete user <strong>{userToDelete?.username}</strong>?
              This action cannot be undone.
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onClose}>
                Cancel
              </Button>
              <Button colorScheme="red" onClick={handleDeleteConfirm} ml={3}>
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </VStack>
  )
}
