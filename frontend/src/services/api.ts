import axios from 'axios'
import { getToken, removeToken } from './auth'

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor: attach JWT & normalize url
api.interceptors.request.use((config) => {
  if (config.url?.startsWith('/api/')) {
    config.url = config.url.slice(4)
  }
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor: handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      removeToken()
      // Don't redirect here to avoid circular dependencies
      // Let the auth context handle it
    }
    return Promise.reject(error)
  }
)

export default api
