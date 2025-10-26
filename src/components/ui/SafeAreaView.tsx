/**
 * Safe Area View Component
 *
 * Visual safe area boundary component for debugging and testing safe area implementations.
 * This component provides visual overlays showing safe area boundaries for modern iPhone displays.
 */

import { useState, useRef, useEffect, useMemo, CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import {
  useSafeArea,
  getDeviceInfo,
  getEnhancedSafeAreaInsets,
  getSafeViewport,
  SafeAreaInsets
} from '@/styles/safe-area-utilities';

export interface SafeAreaViewProps {
  /**
   * Show safe area boundaries visually
   * @default true
   */
  showBoundaries?: boolean;
  /**
   * Show device information
   * @default true
   */
  showDeviceInfo?: boolean;
  /**
   * Show safe area measurements
   * @default true
   */
  showMeasurements?: boolean;
  /**
   * Color theme for the overlay
   * @default 'debug'
   */
  theme?: 'debug' | 'production' | 'dark' | 'light';
  /**
   * Position of the info panel
   * @default 'top-left'
   */
  infoPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  /**
   * Boundary line width
   * @default 2
   */
  boundaryWidth?: number;
  /**
   * Opacity of the overlay
   * @default 0.7
   */
  opacity?: number;
  /**
   * Enable interactive resizing
   * @default false
   */
  interactive?: boolean;
  /**
   * Custom CSS classes
   */
  className?: string;
  /**
   * Show orientation indicator
   * @default true
   */
  showOrientation?: boolean;
  /**
   * Show Dynamic Island indicator
   * @default true
   */
  showDynamicIsland?: boolean;
  /**
   * Show home indicator
   * @default true
   */
  showHomeIndicator?: boolean;
}

/**
 * Color themes for safe area visualization
 */
const THEMES = {
  debug: {
    background: 'rgba(0, 0, 0, 0.1)',
    boundary: 'rgba(255, 0, 0, 0.8)',
    text: 'rgba(0, 0, 0, 0.9)',
    backgroundPanel: 'rgba(255, 255, 255, 0.95)',
    dynamicIsland: 'rgba(0, 122, 255, 0.6)',
    homeIndicator: 'rgba(255, 195, 0, 0.6)',
  },
  production: {
    background: 'rgba(0, 0, 0, 0.05)',
    boundary: 'rgba(59, 130, 246, 0.3)',
    text: 'rgba(0, 0, 0, 0.7)',
    backgroundPanel: 'rgba(255, 255, 255, 0.9)',
    dynamicIsland: 'rgba(59, 130, 246, 0.3)',
    homeIndicator: 'rgba(59, 130, 246, 0.3)',
  },
  dark: {
    background: 'rgba(255, 255, 255, 0.1)',
    boundary: 'rgba(147, 51, 234, 0.8)',
    text: 'rgba(255, 255, 255, 0.9)',
    backgroundPanel: 'rgba(0, 0, 0, 0.85)',
    dynamicIsland: 'rgba(147, 51, 234, 0.6)',
    homeIndicator: 'rgba(168, 85, 247, 0.6)',
  },
  light: {
    background: 'rgba(0, 0, 0, 0.05)',
    boundary: 'rgba(16, 185, 129, 0.6)',
    text: 'rgba(0, 0, 0, 0.8)',
    backgroundPanel: 'rgba(249, 250, 251, 0.95)',
    dynamicIsland: 'rgba(16, 185, 129, 0.5)',
    homeIndicator: 'rgba(16, 185, 129, 0.5)',
  },
};

/**
 * SafeAreaView Component
 */
export const SafeAreaView: React.FC<SafeAreaViewProps> = ({
  showBoundaries = true,
  showDeviceInfo = true,
  showMeasurements = true,
  theme = 'debug',
  infoPosition = 'top-left',
  boundaryWidth = 2,
  opacity = 0.7,
  interactive = false,
  className,
  showOrientation = true,
  showDynamicIsland = true,
  showHomeIndicator = true,
}) => {
  const { deviceInfo, safeAreaInsets, safeViewport } = useSafeArea();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [highlightedEdge, setHighlightedEdge] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const colors = THEMES[theme];

  // Dynamic Island dimensions
  const dynamicIslandHeight = deviceInfo.hasDynamicIsland ? 32 : 0;
  const dynamicIslandWidth = deviceInfo.hasDynamicIsland ? 126 : 0;

  // Home indicator dimensions
  const homeIndicatorHeight = deviceInfo.orientation === 'portrait' ? 34 : 21;
  const homeIndicatorWidth = 134;

  // Calculate boundary positions
  const boundaries = useMemo(() => {
    const { width: screenWidth, height: screenHeight } = deviceInfo.screenSize;

    return {
      top: safeAreaInsets.top,
      right: safeAreaInsets.right,
      bottom: safeAreaInsets.bottom,
      left: safeAreaInsets.left,
      screenWidth,
      screenHeight,
      safeWidth: safeViewport.width,
      safeHeight: safeViewport.height,
    };
  }, [safeAreaInsets, safeViewport, deviceInfo.screenSize]);

  // Toggle fullscreen mode
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Handle edge highlighting for interactive mode
  const handleEdgeHover = (edge: string) => {
    if (interactive) {
      setHighlightedEdge(edge);
    }
  };

  // Generate info panel position styles
  const getInfoPanelStyles = (): CSSProperties => {
    const baseStyles: CSSProperties = {
      position: 'absolute',
      padding: '12px 16px',
      borderRadius: '8px',
      backgroundColor: colors.backgroundPanel,
      color: colors.text,
      fontSize: '12px',
      fontFamily: 'monospace',
      zIndex: 9999,
      maxWidth: '300px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      backdropFilter: 'blur(8px)',
    };

    switch (infoPosition) {
      case 'top-left':
        return { ...baseStyles, top: '20px', left: '20px' };
      case 'top-right':
        return { ...baseStyles, top: '20px', right: '20px' };
      case 'bottom-left':
        return { ...baseStyles, bottom: '20px', left: '20px' };
      case 'bottom-right':
        return { ...baseStyles, bottom: '20px', right: '20px' };
      case 'center':
        return {
          ...baseStyles,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        };
      default:
        return { ...baseStyles, top: '20px', left: '20px' };
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        'safe-area-view',
        'fixed inset-0 pointer-events-none z-[9998]',
        isFullscreen && 'pointer-events-auto',
        className
      )}
      style={{ opacity }}
    >
      {/* Safe Area Background */}
      {showBoundaries && (
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: colors.background,
            border: `${boundaryWidth}px solid ${colors.boundary}`,
            borderRadius: interactive ? '12px' : '0',
            transition: interactive ? 'all 0.2s ease' : 'none',
          }}
        />
      )}

      {/* Safe Area Boundaries */}
      {showBoundaries && (
        <>
          {/* Top boundary */}
          <div
            className="absolute left-0 right-0"
            style={{
              top: 0,
              height: `${boundaries.top}px`,
              backgroundColor: highlightedEdge === 'top'
                ? 'rgba(255, 0, 0, 0.3)'
                : colors.dynamicIsland,
              border: highlightedEdge === 'top'
                ? '2px solid rgba(255, 0, 0, 0.8)'
                : 'none',
              cursor: interactive ? 'pointer' : 'default',
            }}
            onMouseEnter={() => handleEdgeHover('top')}
            onMouseLeave={() => handleEdgeHover(null)}
          />

          {/* Right boundary */}
          <div
            className="absolute top-0 bottom-0"
            style={{
              right: 0,
              width: `${boundaries.right}px`,
              backgroundColor: highlightedEdge === 'right'
                ? 'rgba(255, 0, 0, 0.3)'
                : colors.boundary,
              border: highlightedEdge === 'right'
                ? '2px solid rgba(255, 0, 0, 0.8)'
                : 'none',
              cursor: interactive ? 'pointer' : 'default',
            }}
            onMouseEnter={() => handleEdgeHover('right')}
            onMouseLeave={() => handleEdgeHover(null)}
          />

          {/* Bottom boundary */}
          <div
            className="absolute left-0 right-0"
            style={{
              bottom: 0,
              height: `${boundaries.bottom}px`,
              backgroundColor: highlightedEdge === 'bottom'
                ? 'rgba(255, 0, 0, 0.3)'
                : colors.homeIndicator,
              border: highlightedEdge === 'bottom'
                ? '2px solid rgba(255, 0, 0, 0.8)'
                : 'none',
              cursor: interactive ? 'pointer' : 'default',
            }}
            onMouseEnter={() => handleEdgeHover('bottom')}
            onMouseLeave={() => handleEdgeHover(null)}
          />

          {/* Left boundary */}
          <div
            className="absolute top-0 bottom-0"
            style={{
              left: 0,
              width: `${boundaries.left}px`,
              backgroundColor: highlightedEdge === 'left'
                ? 'rgba(255, 0, 0, 0.3)'
                : colors.boundary,
              border: highlightedEdge === 'left'
                ? '2px solid rgba(255, 0, 0, 0.8)'
                : 'none',
              cursor: interactive ? 'pointer' : 'default',
            }}
            onMouseEnter={() => handleEdgeHover('left')}
            onMouseLeave={() => handleEdgeHover(null)}
          />
        </>
      )}

      {/* Dynamic Island Indicator */}
      {showDynamicIsland && deviceInfo.hasDynamicIsland && (
        <div
          className="absolute left-1/2 transform -translate-x-1/2"
          style={{
            top: `${Math.min(boundaries.top, 60)}px`,
            width: `${dynamicIslandWidth}px`,
            height: `${dynamicIslandHeight}px`,
            backgroundColor: colors.dynamicIsland,
            borderRadius: '20px',
            border: `1px solid ${colors.boundary}`,
          }}
        />
      )}

      {/* Home Indicator */}
      {showHomeIndicator && deviceInfo.isiPhone && boundaries.bottom > 0 && (
        <div
          className="absolute left-1/2 transform -translate-x-1/2"
          style={{
            bottom: '8px',
            width: `${homeIndicatorWidth}px`,
            height: '5px',
            backgroundColor: colors.homeIndicator,
            borderRadius: '100px',
          }}
        />
      )}

      {/* Info Panel */}
      {(showDeviceInfo || showMeasurements) && (
        <div style={getInfoPanelStyles()}>
          {showDeviceInfo && (
            <div className="mb-3">
              <h4 className="font-bold text-sm mb-2">Device Info</h4>
              <div className="space-y-1 text-xs">
                <div>Model: {deviceInfo.model}</div>
                <div>OS: {deviceInfo.isIOS ? 'iOS' : 'Other'}</div>
                <div>iPhone: {deviceInfo.isiPhone ? 'Yes' : 'No'}</div>
                {deviceInfo.hasDynamicIsland && <div>Dynamic Island: Yes</div>}
                {deviceInfo.hasNotch && <div>Notch: Yes</div>}
                {showOrientation && <div>Orientation: {deviceInfo.orientation}</div>}
                <div>
                  Screen: {boundaries.screenWidth} × {boundaries.screenHeight}
                </div>
                <div>
                  Safe: {boundaries.safeWidth} × {boundaries.safeHeight}
                </div>
              </div>
            </div>
          )}

          {showMeasurements && (
            <div>
              <h4 className="font-bold text-sm mb-2">Safe Area (px)</h4>
              <div className="space-y-1 text-xs">
                <div>Top: {boundaries.top}px</div>
                <div>Right: {boundaries.right}px</div>
                <div>Bottom: {boundaries.bottom}px</div>
                <div>Left: {boundaries.left}px</div>
              </div>
            </div>
          )}

          {interactive && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <button
                onClick={toggleFullscreen}
                className="text-xs bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 transition-colors"
              >
                {isFullscreen ? 'Exit Debug' : 'Fullscreen Debug'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Interactive mode instructions */}
      {interactive && !isFullscreen && (
        <div
          className="absolute bottom-4 left-4 text-xs text-gray-600"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            padding: '8px 12px',
            borderRadius: '6px',
          }}
        >
          Hover over boundaries to highlight • Click debug panel for fullscreen
        </div>
      )}
    </div>
  );
};

/**
 * Safe Area Debug Hook
 */
export const useSafeAreaDebug = () => {
  const { deviceInfo, safeAreaInsets, safeViewport } = useSafeArea();

  return {
    /**
     * Check if safe area is properly configured
     */
    isSafeAreaConfigured: () => {
      return deviceInfo.isiPhone && (
        safeAreaInsets.top > 0 ||
        safeAreaInsets.bottom > 0 ||
        safeAreaInsets.left > 0 ||
        safeAreaInsets.right > 0
      );
    },

    /**
     * Get safe area validation results
     */
    getValidationResults: () => {
      const issues: string[] = [];

      if (deviceInfo.isiPhone) {
        if (safeAreaInsets.top === 0 && (deviceInfo.hasDynamicIsland || deviceInfo.hasNotch)) {
          issues.push('No top safe area detected on device with Dynamic Island/Notch');
        }
        if (safeAreaInsets.bottom === 0 && deviceInfo.orientation === 'portrait') {
          issues.push('No bottom safe area detected on iPhone');
        }
      }

      return {
        isValid: issues.length === 0,
        issues,
        deviceInfo,
        safeAreaInsets,
        safeViewport,
      };
    },

    /**
     * Export safe area configuration
     */
    exportConfig: () => ({
      deviceInfo,
      safeAreaInsets,
      safeViewport,
      timestamp: new Date().toISOString(),
    }),
  };
};

/**
 * Safe Area Quick Test Component
 */
export const SafeAreaQuickTest: React.FC<{ onComplete?: (results: any) => void }> = ({ onComplete }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<any>(null);
  const debug = useSafeAreaDebug();

  const runTest = async () => {
    setIsRunning(true);

    // Simulate test delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    const testResults = debug.getValidationResults();
    setResults(testResults);

    onComplete?.(testResults);
    setIsRunning(false);
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-md max-w-md">
      <h3 className="font-bold text-lg mb-2">Safe Area Test</h3>

      <button
        onClick={runTest}
        disabled={isRunning}
        className="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400 transition-colors"
      >
        {isRunning ? 'Testing...' : 'Run Safe Area Test'}
      </button>

      {results && (
        <div className="mt-4">
          <div className={`text-sm font-medium ${results.isValid ? 'text-green-600' : 'text-red-600'}`}>
            {results.isValid ? '✅ Safe Area is properly configured' : '❌ Safe Area issues detected'}
          </div>

          {results.issues.length > 0 && (
            <div className="mt-2 space-y-1">
              {results.issues.map((issue: string, index: number) => (
                <div key={index} className="text-xs text-red-600">• {issue}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SafeAreaView;