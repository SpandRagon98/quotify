import { Component } from "react";

/**
 * Top-level error boundary: a render crash anywhere below shows a friendly
 * recovery screen instead of a blank white page. Reload restores the app —
 * data is safe (localStorage + cloud are written through on every change).
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[Qyrova] render crash:", error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="crash-screen">
        <div className="crash-card">
          <h2>Something went wrong</h2>
          <p>
            An unexpected error interrupted the page. Your data is safe — every
            change is saved as you work. Reload to continue.
          </p>
          <pre className="crash-detail">{String(this.state.error?.message || this.state.error)}</pre>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            Reload Qyrova
          </button>
        </div>
      </div>
    );
  }
}
