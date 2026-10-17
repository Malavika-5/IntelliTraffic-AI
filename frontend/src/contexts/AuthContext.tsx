import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '@/services/api'
import { getToken, setToken, removeToken, getStoredUser, setStoredUser } from '@/services/auth'
import type { User, AuthResponse } from '@/types'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string, emergency_contact_phone?: string, emergency_contact_name?: string) => Promise<{ user: User }>
  register: (data: RegisterData) => Promise<void>
  updateProfile: (data: Partial<User>) => Promise<User>
  logout: () => void
  refreshUser: () => Promise<void>
}

interface RegisterData {
  email: string
  password: string
  full_name: string
  phone?: string
  emergency_contact_phone?: string
  emergency_contact_name?: string
  role?: string
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(getStoredUser())
  const [isLoading, setIsLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    const token = getToken()
    if (!token) {
      setUser(null)
      setIsLoading(false)
      return
    }
    try {
      const response = await api.get<User>('/auth/me')
      setUser(response.data)
      setStoredUser(response.data)
    } catch {
      removeToken()
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshUser()
  }, [refreshUser])

  const login = async (
    email: string,
    password: string,
    emergency_contact_phone?: string,
    emergency_contact_name?: string
  ): Promise<{ user: User }> => {
    const response = await api.post<AuthResponse>('/auth/login', {
      email,
      password,
      emergency_contact_phone: emergency_contact_phone || undefined,
      emergency_contact_name: emergency_contact_name || undefined,
    })
    
    setToken(response.data.access_token)
    setUser(response.data.user)
    setStoredUser(response.data.user)
    return { user: response.data.user }
  }

  const register = async (data: RegisterData) => {
    const response = await api.post<AuthResponse>('/auth/register', data)
    setToken(response.data.access_token)
    setUser(response.data.user)
    setStoredUser(response.data.user)
  }

  const updateProfile = async (data: Partial<User>): Promise<User> => {
    const response = await api.patch<User>('/auth/me', data)
    setUser(response.data)
    setStoredUser(response.data)
    return response.data
  }

  const logout = () => {
    removeToken()
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        updateProfile,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
