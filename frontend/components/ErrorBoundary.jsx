import React from 'react';
import { AlertTriangle, Home } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorInfo: null,
      errorCount: 0 
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details
    console.error('Error caught by boundary:', error, errorInfo);
    
    this.setState(prevState => ({
      error,
      errorInfo,
      errorCount: prevState.errorCount + 1
    }));

    // You can also log the error to an error reporting service here
    // logErrorToService(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ 
      hasError: false, 
      error: null,
      errorInfo: null
    });
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-8 space-y-6 shadow-lg">
            {/* Error Icon */}
            <div className="flex justify-center">
              <div className="p-4 bg-red-100 rounded-full">
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
            </div>

            {/* Error Message */}
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold text-foreground">Oops! Something went wrong</h1>
              <p className="text-sm text-muted-foreground">
                We encountered an unexpected error. Our team has been notified.
              </p>
            </div>

            {/* Error Details (Development Only) */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-2">
                <p className="text-xs font-semibold text-red-900">Error Details:</p>
                <p className="text-xs text-red-700 font-mono break-words">
                  {this.state.error.toString()}
                </p>
                {this.state.errorInfo && (
                  <details className="text-xs text-red-700">
                    <summary className="cursor-pointer font-semibold">Stack Trace</summary>
                    <pre className="mt-2 overflow-auto max-h-32 bg-red-100 p-2 rounded text-[10px]">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            {/* Error Count Warning */}
            {this.state.errorCount > 2 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-800">
                  <strong>Multiple errors detected.</strong> Please refresh the page or contact support if the problem persists.
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col gap-3">
              <Button 
                onClick={this.handleReset}
                className="w-full"
              >
                Try Again
              </Button>
              <Button 
                onClick={this.handleGoHome}
                variant="outline"
                className="w-full"
              >
                <Home className="h-4 w-4 mr-2" />
                Go to Home
              </Button>
            </div>

            {/* Support Link */}
            <p className="text-xs text-center text-muted-foreground">
              If this problem persists, please{' '}
              <a 
                href="mailto:support@teambuilderz.com" 
                className="text-primary hover:underline"
              >
                contact support
              </a>
            </p>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
