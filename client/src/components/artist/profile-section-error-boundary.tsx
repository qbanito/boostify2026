import { Component, type ReactNode } from 'react';

interface Props {
  sectionId: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

/**
 * ProfileSectionErrorBoundary
 *
 * Catches runtime errors thrown by individual artist profile module components
 * so that a single broken module does not white-screen the entire profile.
 * Renders a minimal error card that is visually consistent with the dark theme.
 */
export class ProfileSectionErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : String(error);
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown, info: { componentStack: string }) {
    // Log to console without exposing internal stack to users
    console.error(`[ProfileSectionErrorBoundary] Section "${this.props.sectionId}" crashed:`, error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        className="rounded-2xl px-4 py-5 border text-center space-y-2"
        style={{
          background: 'rgba(239,68,68,0.05)',
          borderColor: 'rgba(239,68,68,0.2)',
        }}
      >
        <p className="text-[11px] font-semibold text-red-400">
          This module encountered an error
        </p>
        <p className="text-[10px] text-gray-600">
          {this.props.sectionId}
        </p>
        <button
          type="button"
          onClick={this.handleRetry}
          className="text-[10px] px-3 py-1 rounded-full border border-red-500/25 text-red-400 hover:bg-red-500/10 transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }
}
