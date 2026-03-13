import { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { AlertTriangle } from './icons';
import i18n from '@openbunny/shared/i18n';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(_error: Error): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const t = i18n.t.bind(i18n);

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <Card className="max-w-2xl w-full p-6 space-y-4">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-destructive flex items-center gap-2">
                <AlertTriangle className="w-6 h-6" />
                {t('error.title')}
              </h1>
              <p className="text-muted-foreground">
                {t('error.description')}
              </p>
            </div>

            {this.state.error && (
              <div className="space-y-2">
                <h2 className="font-semibold">{t('error.info')}</h2>
                <pre className="p-4 bg-muted rounded-lg text-sm overflow-auto max-h-40">
                  {this.state.error.toString()}
                </pre>
              </div>
            )}

            {this.state.errorInfo && (
              <details className="space-y-2">
                <summary className="font-semibold cursor-pointer hover:text-primary">
                  {t('error.stackTrace')}
                </summary>
                <pre className="p-4 bg-muted rounded-lg text-xs overflow-auto max-h-60 mt-2">
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}

            <div className="flex gap-2">
              <Button onClick={this.handleReset} variant="default">
                {t('common.retry')}
              </Button>
              <Button onClick={() => window.location.reload()} variant="outline">
                {t('error.refreshPage')}
              </Button>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
