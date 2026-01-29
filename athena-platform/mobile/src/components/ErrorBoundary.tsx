/**
 * Error Boundary Component
 * Phase 5: Mobile Parity - Error handling with fallback UI
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// ============================================
// TYPES
// ============================================

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

// ============================================
// ERROR BOUNDARY CLASS
// ============================================

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    
    // Call custom error handler
    this.props.onError?.(error, errorInfo);
    
    // Log to console in development
    if (__DEV__) {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onReset={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}

// ============================================
// DEFAULT FALLBACK COMPONENT
// ============================================

interface ErrorFallbackProps {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  onReset: () => void;
}

const ErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  errorInfo,
  onReset,
}) => {
  const [showDetails, setShowDetails] = React.useState(false);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Ionicons name="warning-outline" size={64} color="#EF4444" />
        
        <Text style={styles.title}>Oops! Something went wrong</Text>
        
        <Text style={styles.message}>
          We're sorry, but something unexpected happened. Please try again.
        </Text>

        <TouchableOpacity style={styles.button} onPress={onReset}>
          <Ionicons name="refresh" size={20} color="#fff" />
          <Text style={styles.buttonText}>Try Again</Text>
        </TouchableOpacity>

        {__DEV__ && (
          <>
            <TouchableOpacity
              style={styles.detailsToggle}
              onPress={() => setShowDetails(!showDetails)}
            >
              <Text style={styles.detailsToggleText}>
                {showDetails ? 'Hide Details' : 'Show Details'}
              </Text>
              <Ionicons
                name={showDetails ? 'chevron-up' : 'chevron-down'}
                size={16}
                color="#666"
              />
            </TouchableOpacity>

            {showDetails && (
              <ScrollView style={styles.detailsContainer}>
                <Text style={styles.errorName}>{error?.name}</Text>
                <Text style={styles.errorMessage}>{error?.message}</Text>
                {errorInfo && (
                  <Text style={styles.stackTrace}>
                    {errorInfo.componentStack}
                  </Text>
                )}
              </ScrollView>
            )}
          </>
        )}
      </View>
    </View>
  );
};

// ============================================
// SPECIALIZED ERROR COMPONENTS
// ============================================

interface NetworkErrorProps {
  onRetry: () => void;
}

export const NetworkError: React.FC<NetworkErrorProps> = ({ onRetry }) => {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Ionicons name="cloud-offline-outline" size={64} color="#6B7280" />
        
        <Text style={styles.title}>No Internet Connection</Text>
        
        <Text style={styles.message}>
          Please check your internet connection and try again.
        </Text>

        <TouchableOpacity style={styles.button} onPress={onRetry}>
          <Ionicons name="refresh" size={20} color="#fff" />
          <Text style={styles.buttonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = 'search-outline',
  title,
  message,
  actionLabel,
  onAction,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Ionicons name={icon} size={64} color="#9CA3AF" />
        
        <Text style={styles.title}>{title}</Text>
        
        <Text style={styles.message}>{message}</Text>

        {actionLabel && onAction && (
          <TouchableOpacity style={styles.button} onPress={onAction}>
            <Text style={styles.buttonText}>{actionLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

interface LoadingErrorProps {
  message?: string;
  onRetry: () => void;
}

export const LoadingError: React.FC<LoadingErrorProps> = ({
  message = 'Failed to load data',
  onRetry,
}) => {
  return (
    <View style={styles.inlineError}>
      <Ionicons name="alert-circle-outline" size={24} color="#EF4444" />
      <Text style={styles.inlineErrorText}>{message}</Text>
      <TouchableOpacity onPress={onRetry}>
        <Ionicons name="refresh" size={24} color="#3B82F6" />
      </TouchableOpacity>
    </View>
  );
};

interface NotFoundProps {
  title?: string;
  message?: string;
  onGoBack?: () => void;
}

export const NotFound: React.FC<NotFoundProps> = ({
  title = 'Not Found',
  message = "The content you're looking for doesn't exist or has been removed.",
  onGoBack,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.notFoundCode}>404</Text>
        
        <Text style={styles.title}>{title}</Text>
        
        <Text style={styles.message}>{message}</Text>

        {onGoBack && (
          <TouchableOpacity style={styles.button} onPress={onGoBack}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
            <Text style={styles.buttonText}>Go Back</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

interface MaintenanceProps {
  message?: string;
}

export const Maintenance: React.FC<MaintenanceProps> = ({
  message = "We're currently performing scheduled maintenance. Please check back soon.",
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Ionicons name="construct-outline" size={64} color="#F59E0B" />
        
        <Text style={styles.title}>Under Maintenance</Text>
        
        <Text style={styles.message}>{message}</Text>
      </View>
    </View>
  );
};

interface PermissionDeniedProps {
  permission: string;
  onRequestPermission?: () => void;
}

export const PermissionDenied: React.FC<PermissionDeniedProps> = ({
  permission,
  onRequestPermission,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Ionicons name="lock-closed-outline" size={64} color="#EF4444" />
        
        <Text style={styles.title}>Permission Required</Text>
        
        <Text style={styles.message}>
          {`This feature requires ${permission} access. Please grant permission in your device settings.`}
        </Text>

        {onRequestPermission && (
          <TouchableOpacity style={styles.button} onPress={onRequestPermission}>
            <Text style={styles.buttonText}>Grant Permission</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    alignItems: 'center',
    maxWidth: 320,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 24,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  detailsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
  },
  detailsToggleText: {
    color: '#666',
    fontSize: 14,
    marginRight: 4,
  },
  detailsContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    maxHeight: 200,
    width: '100%',
  },
  errorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
  errorMessage: {
    fontSize: 12,
    color: '#374151',
    marginTop: 4,
  },
  stackTrace: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 8,
    fontFamily: 'monospace',
  },
  inlineError: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    margin: 16,
  },
  inlineErrorText: {
    flex: 1,
    color: '#991B1B',
    fontSize: 14,
    marginHorizontal: 12,
  },
  notFoundCode: {
    fontSize: 72,
    fontWeight: '700',
    color: '#E5E7EB',
  },
});

export default ErrorBoundary;
