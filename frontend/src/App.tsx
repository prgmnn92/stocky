import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Symbols from './pages/Symbols'
import SymbolDetail from './pages/SymbolDetail'
import Strategies from './pages/Strategies'
import Signals from './pages/Signals'
import Positions from './pages/Positions'
import TransactionHistory from './pages/TransactionHistory'
import Chat from './pages/Chat'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Users from './pages/Users'
import { Box, Spinner, Center } from '@chakra-ui/react'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <Center h="100vh">
        <Spinner size="xl" />
      </Center>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, canManageUsers } = useAuth()

  if (isLoading) {
    return (
      <Center h="100vh">
        <Spinner size="xl" />
      </Center>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!canManageUsers()) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="symbols" element={<Symbols />} />
        <Route path="symbols/:symbol" element={<SymbolDetail />} />
        <Route path="strategies" element={<Strategies />} />
        <Route path="signals" element={<Signals />} />
        <Route path="positions" element={<Positions />} />
        <Route path="transactions" element={<TransactionHistory />} />
        <Route path="chat" element={<Chat />} />
        <Route
          path="users"
          element={
            <AdminRoute>
              <Users />
            </AdminRoute>
          }
        />
      </Route>
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}

export default App
