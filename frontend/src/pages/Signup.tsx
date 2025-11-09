import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Heading,
  Input,
  VStack,
  Text,
  useColorModeValue,
  useToast,
  Link as ChakraLink,
  Alert,
  AlertIcon,
} from '@chakra-ui/react'
import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export default function Signup() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { signup } = useAuth()
  const toast = useToast()

  const cardBg = useColorModeValue('white', 'gray.800')
  const borderColor = useColorModeValue('gray.200', 'gray.700')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password !== confirmPassword) {
      toast({
        title: 'Passwords do not match',
        status: 'error',
        duration: 3000,
      })
      return
    }

    setIsLoading(true)

    try {
      await signup(username, password)
    } catch (error: any) {
      toast({
        title: 'Signup failed',
        description: error.response?.data?.detail || 'Could not create account',
        status: 'error',
        duration: 3000,
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Box minH="100vh" display="flex" alignItems="center" justifyContent="center" p={4}>
      <Box
        bg={cardBg}
        p={8}
        borderRadius="lg"
        borderWidth="1px"
        borderColor={borderColor}
        maxW="400px"
        w="full"
      >
        <VStack spacing={6} align="stretch">
          <Heading size="lg" textAlign="center">
            Sign up for Stocky
          </Heading>

          <Alert status="info" borderRadius="md">
            <AlertIcon />
            <Text fontSize="sm">New accounts start as test users with limited features.</Text>
          </Alert>

          <form onSubmit={handleSubmit}>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Username</FormLabel>
                <Input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Choose a username"
                />
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Password</FormLabel>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Choose a password"
                />
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Confirm Password</FormLabel>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                />
              </FormControl>

              <Button
                type="submit"
                colorScheme="green"
                width="full"
                isLoading={isLoading}
                isDisabled={!username || !password || !confirmPassword}
              >
                Sign Up
              </Button>
            </VStack>
          </form>

          <Text textAlign="center">
            Already have an account?{' '}
            <ChakraLink as={RouterLink} to="/login" color="green.500">
              Login
            </ChakraLink>
          </Text>
        </VStack>
      </Box>
    </Box>
  )
}
