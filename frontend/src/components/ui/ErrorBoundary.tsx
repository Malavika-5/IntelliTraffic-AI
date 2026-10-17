import { Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  info: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, info: null }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ info })
    console.error('[ErrorBoundary]', error, info)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, info: null })
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md w-full bg-white border border-red-100 rounded-2xl shadow-sm p-8 text-center">
            <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-7 h-7 text-red-500" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">Something went wrong</h2>
            <p className="text-sm text-gray-500 mb-2">
              The page crashed unexpectedly. Please try again.
            </p>
            {this.state.error && (
              <details className="text-left bg-gray-50 rounded-xl p-3 mb-5 text-xs text-gray-600 font-mono overflow-auto max-h-40">
                <summary className="cursor-pointer font-semibold mb-1 text-red-600">Error details</summary>
                <p className="mt-1 whitespace-pre-wrap break-all">{this.state.error.message}</p>
                {this.state.info && (
                  <p className="mt-2 whitespace-pre-wrap break-all text-gray-400">
                    {this.state.info.componentStack}
                  </p>
                )}
              </details>
            )}
            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-700 text-white text-sm font-semibold rounded-xl hover:bg-primary-800 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Go to Home
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
