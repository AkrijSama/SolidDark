"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  fallbackTitle?: string;
};

type State = {
  hasError: boolean;
  message: string;
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    message: "",
  };

  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error.message,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("SolidDark error boundary caught an error.", { error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="panel-card mx-auto my-10 max-w-2xl p-6">
          <h2 className="font-heading text-2xl font-semibold text-[var(--text-primary)]">
            {this.props.fallbackTitle ?? "Something failed"}
          </h2>
          <p className="mt-3 text-sm text-[var(--accent-red)]">{this.state.message}</p>
          <p className="mt-3 text-sm text-[var(--text-secondary)]">
            Nothing fails silently here. Reload the page. If this keeps happening, fix the root cause before relying on the output.
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}
