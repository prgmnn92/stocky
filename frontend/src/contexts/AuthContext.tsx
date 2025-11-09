import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import * as apiService from '@/services/api'
import { api } from '@/services/api'
import type { AuthUser, LoginResponse } from '@/types/api'

interface AuthContextType {
  user: AuthUser | null
  isLoading: boolean
  login: (username: string, password: string) => Promise<void>
  signup: (username: string, password: string) => Promise<void>
  logout: () => void
  isAdmin: () => boolean
  isManager: () => boolean
  canManageUsers: () => boolean
  canUseChat: () => boolean
  canRunDailyJob: () => boolean
  canAddSymbols: () => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const TOKEN_KEY = 'stocky_auth_token'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const navigate = useNavigate()

  // Set up axios interceptor to add token to requests and handle auth errors
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY)

    // Add request interceptor to add Authorization header
    const requestInterceptor = api.interceptors.request.use(
      (config) => {
        const currentToken = localStorage.getItem(TOKEN_KEY)
        if (currentToken) {
          config.headers.Authorization = `Bearer ${currentToken}`
        }
        return config
      },
      (error) => Promise.reject(error)
    )

    // Add response interceptor to handle 403/401 errors
    const responseInterceptor = api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 403 || error.response?.status === 401) {
          // Clear invalid token and redirect to login
          localStorage.removeItem(TOKEN_KEY)
          setUser(null)
          if (window.location.pathname !== '/login') {
            navigate('/login')
          }
        }
        return Promise.reject(error)
      }
    )

    // Initialize user from token
    const initAuth = async () => {
      if (token) {
        try {
          const response = await apiService.getMe()
          setUser(response.data)
        } catch (error) {
          console.error('Failed to fetch user:', error)
          localStorage.removeItem(TOKEN_KEY)
        }
      }
      setIsLoading(false)
    }

    initAuth()

    // Cleanup interceptors on unmount
    return () => {
      api.interceptors.request.eject(requestInterceptor)
      api.interceptors.response.eject(responseInterceptor)
    }
  }, [navigate])

  const login = async (username: string, password: string) => {
    const response = await apiService.login({ username, password })
    const data: LoginResponse = response.data

    localStorage.setItem(TOKEN_KEY, data.access_token)
    setUser(data.user)
    navigate('/')
  }

  const signup = async (username: string, password: string) => {
    const response = await apiService.signup({ username, password })
    const data: LoginResponse = response.data

    localStorage.setItem(TOKEN_KEY, data.access_token)
    setUser(data.user)
    navigate('/')
  }

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY)
    setUser(null)
    navigate('/login')
  }

  const isAdmin = () => user?.role === 'ADMIN'
  const isManager = () => user?.role === 'MANAGER'
  const canManageUsers = () => user?.role === 'ADMIN' || user?.role === 'MANAGER'
  const canUseChat = () => user?.role !== 'TEST_USER'
  const canRunDailyJob = () => user?.role === 'ADMIN' || user?.role === 'MANAGER'
  const canAddSymbols = () => user?.role !== 'TEST_USER'

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        signup,
        logout,
        isAdmin,
        isManager,
        canManageUsers,
        canUseChat,
        canRunDailyJob,
        canAddSymbols,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
