"use client";

import { useState, useEffect, useRef } from "react";
import { PlayCircle, Camera, ExternalLink, Maximize2, Minimize2 } from "lucide-react";

interface XRContent {
  id: string;
  content_type: "vr_360" | "vr_interactive" | "ar_overlay" | "3d_model";
  file_url: string;
  fallback_url?: string | null;
  metadata?: Record<string, any>;
  player_config?: Record<string, any>;
  compatibility?: string[];
}

interface XRViewerProps {
  content: XRContent;
  onSessionStart?: () => void;
  onSessionEnd?: (duration: number) => void;
}

function getDeviceType(): string {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("oculus") || ua.includes("quest") || ua.includes("vive") || ua.includes("pico")) return "headset";
  if (/mobile|android|iphone|ipad/.test(ua)) return "mobile";
  return "desktop";
}

export default function XRViewer({ content, onSessionStart, onSessionEnd }: XRViewerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const deviceType = getDeviceType();

  const isCompatible = !content.compatibility || content.compatibility.includes(deviceType);
  const displayUrl = isCompatible ? content.file_url : content.fallback_url || content.file_url;

  useEffect(() => {
    return () => {
      if (sessionStartTime && onSessionEnd) {
        onSessionEnd(Math.floor((Date.now() - sessionStartTime) / 1000));
      }
    };
  }, [sessionStartTime, onSessionEnd]);

  const handleStartSession = () => {
    setSessionStartTime(Date.now());
    onSessionStart?.();
  };

  const handleToggleFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (!isFullscreen) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      // Fullscreen not supported
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const renderContentViewer = () => {
    switch (content.content_type) {
      case "vr_360":
        return (
          <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-gray-400 text-sm">Loading 360 content...</span>
                </div>
              </div>
            )}
            <iframe
              src={displayUrl}
              className="w-full h-full"
              allow="xr-spatial-tracking; gyroscope; accelerometer"
              allowFullScreen
              onLoad={() => {
                setIsLoading(false);
                handleStartSession();
              }}
              onError={() => {
                setIsLoading(false);
                setError("Failed to load 360 content");
              }}
            />
          </div>
        );

      case "vr_interactive":
        return (
          <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
            {!sessionStartTime ? (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary-900 to-purple-900">
                <div className="text-center">
                  <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                    <PlayCircle className="w-10 h-10 text-white" strokeWidth={1.5} />
                  </div>
                  <h3 className="text-white text-lg font-semibold mb-2">Interactive VR Experience</h3>
                  <p className="text-gray-300 text-sm mb-4 max-w-sm mx-auto">
                    {content.metadata?.description || "Launch the interactive VR environment to begin."}
                  </p>
                  <button
                    onClick={handleStartSession}
                    className="px-6 py-2.5 bg-white text-primary-900 rounded-lg font-medium text-sm hover:bg-gray-100 transition-colors"
                  >
                    Launch Experience
                  </button>
                  {!isCompatible && (
                    <p className="text-amber-300 text-xs mt-3">
                      Best viewed on a VR headset. Showing desktop fallback.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <iframe
                src={displayUrl}
                className="w-full h-full"
                allow="xr-spatial-tracking; gyroscope; accelerometer; microphone"
                allowFullScreen
                onLoad={() => setIsLoading(false)}
              />
            )}
          </div>
        );

      case "ar_overlay":
        return (
          <div className="relative w-full aspect-video bg-gray-900 rounded-lg overflow-hidden flex items-center justify-center">
            <div className="text-center p-8">
              <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Camera className="w-8 h-8 text-white" strokeWidth={1.5} />
              </div>
              <h3 className="text-white text-lg font-semibold mb-2">AR Overlay</h3>
              <p className="text-gray-400 text-sm mb-4 max-w-sm mx-auto">
                Point your device camera at a target surface to view the AR content overlay.
              </p>
              {deviceType === "mobile" ? (
                <a
                  href={displayUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-cyan-600 text-white rounded-lg font-medium text-sm hover:bg-cyan-700 transition-colors"
                  onClick={() => handleStartSession()}
                >
                  <ExternalLink className="w-4 h-4" strokeWidth={2} />
                  Open AR View
                </a>
              ) : (
                <p className="text-amber-400 text-xs">AR overlay requires a mobile device with camera access.</p>
              )}
            </div>
          </div>
        );

      case "3d_model":
        return (
          <div className="relative w-full aspect-video bg-gray-900 rounded-lg overflow-hidden">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <div className="w-8 h-8 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {/* model-viewer Web Component or iframe fallback */}
            <iframe
              src={displayUrl}
              className="w-full h-full"
              allow="xr-spatial-tracking"
              allowFullScreen
              onLoad={() => {
                setIsLoading(false);
                handleStartSession();
              }}
              onError={() => {
                setIsLoading(false);
                setError("Failed to load 3D model");
              }}
            />
          </div>
        );

      default:
        return (
          <div className="w-full aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
            <p className="text-gray-500 text-sm">Unsupported XR content type</p>
          </div>
        );
    }
  };

  return (
    <div ref={containerRef} className="space-y-3">
      {error ? (
        <div className="w-full aspect-video bg-red-50 rounded-lg flex items-center justify-center border border-red-200">
          <div className="text-center">
            <p className="text-red-600 font-medium">{error}</p>
            {content.fallback_url && (
              <a
                href={content.fallback_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary-600 hover:underline mt-2 inline-block"
              >
                View fallback content
              </a>
            )}
          </div>
        </div>
      ) : (
        renderContentViewer()
      )}

      {/* Controls Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {content.metadata?.resolution && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
              {content.metadata.resolution as string}
            </span>
          )}
          {content.metadata?.format && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
              {(content.metadata.format as string).toUpperCase()}
            </span>
          )}
          {content.metadata?.file_size && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
              {content.metadata.file_size as string}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isCompatible && (
            <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">
              Fallback mode
            </span>
          )}
          <button
            onClick={handleToggleFullscreen}
            className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
            title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" strokeWidth={2} />
            ) : (
              <Maximize2 className="w-4 h-4" strokeWidth={2} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
