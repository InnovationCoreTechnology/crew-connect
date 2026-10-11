import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State { failed: boolean }

// Catches a crash (or a page chunk that failed to download on a bad network) so the user sees a message and a
// Reload button instead of a blank screen. React only supports this as a class component.
// Docs: https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // TODO (Phase 2.5): send this to Sentry. Until then it is only visible in the browser console.
    console.error('App crashed:', error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="center-note" role="alert">
        <p>Something went wrong. Please check your internet connection and try again.</p>
        <button type="button" className="btn" onClick={() => window.location.reload()}>Reload</button>
      </div>
    )
  }
}
