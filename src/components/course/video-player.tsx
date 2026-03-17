"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/utils/cn";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  SkipBack,
  SkipForward,
  Settings,
  Captions,
  CaptionsOff,
} from "lucide-react";

export interface VideoTrack {
  label: string;
  src: string;
  srcLang: string;
  kind: "subtitles" | "captions";
  default?: boolean;
}

export interface VideoPlayerProps {
  /** Video source URL (MP4, WebM, or HLS) */
  src: string;
  /** Poster image URL */
  poster?: string;
  /** Course/lesson title */
  title?: string;
  /** Caption/subtitle tracks */
  tracks?: VideoTrack[];
  /** Callback when video reaches certain progress (0-100) */
  onProgress?: (percent: number) => void;
  /** Callback when video completes */
  onComplete?: () => void;
  /** Callback with current time and duration on each time update */
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  /** Starting position in seconds */
  startAt?: number;
  /** Whether to auto-play */
  autoPlay?: boolean;
  /** Custom className */
  className?: string;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VideoPlayer({
  src,
  poster,
  title,
  tracks = [],
  onProgress,
  onComplete,
  onTimeUpdate,
  startAt = 0,
  autoPlay = false,
  className,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [buffered, setBuffered] = useState(0);
  const [hasCompleted, setHasCompleted] = useState(false);

  const controlsTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastReportedProgress = useRef(0);

  // Hide controls after inactivity
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    if (isPlaying) {
      controlsTimeout.current = setTimeout(() => setShowControls(false), 3000);
    }
  }, [isPlaying]);

  // Toggle play/pause
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  }, []);

  // Seek
  const seek = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
  }, []);

  // Click on progress bar
  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    const bar = progressRef.current;
    if (!video || !bar) return;
    const rect = bar.getBoundingClientRect();
    const fraction = (e.clientX - rect.left) / rect.width;
    video.currentTime = fraction * video.duration;
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          seek(-10);
          break;
        case "ArrowRight":
          e.preventDefault();
          seek(10);
          break;
        case "ArrowUp":
          e.preventDefault();
          setVolume((v) => Math.min(1, v + 0.1));
          break;
        case "ArrowDown":
          e.preventDefault();
          setVolume((v) => Math.max(0, v - 0.1));
          break;
        case "m":
          setIsMuted((m) => !m);
          break;
        case "f":
          if (document.fullscreenElement) {
            document.exitFullscreen();
          } else {
            containerRef.current?.requestFullscreen();
          }
          break;
        case "c":
          setCaptionsEnabled((c) => !c);
          break;
      }
    };

    const container = containerRef.current;
    container?.addEventListener("keydown", handleKeyDown);
    return () => container?.removeEventListener("keydown", handleKeyDown);
  }, [togglePlay, seek]);

  // Sync volume
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
      videoRef.current.muted = isMuted;
    }
  }, [volume, isMuted]);

  // Sync playback rate
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Track fullscreen changes
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Start at position
  useEffect(() => {
    if (videoRef.current && startAt > 0) {
      videoRef.current.currentTime = startAt;
    }
  }, [startAt]);

  // Caption track visibility
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    for (let i = 0; i < video.textTracks.length; i++) {
      video.textTracks[i].mode = captionsEnabled ? "showing" : "hidden";
    }
  }, [captionsEnabled]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Handle missing or invalid src
  if (!src) {
    return (
      <div
        className={cn(
          "flex aspect-video items-center justify-center rounded-lg bg-black",
          className
        )}
      >
        <div className="text-center">
          <Play className="mx-auto h-12 w-12 text-gray-500" />
          <p className="mt-3 text-sm text-gray-400">No video source available</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "group relative overflow-hidden rounded-lg bg-black",
        isFullscreen ? "fixed inset-0 z-[9999]" : "aspect-video",
        className
      )}
      onMouseMove={resetControlsTimer}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      tabIndex={0}
      role="region"
      aria-label={title ? `Video player: ${title}` : "Video player"}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        autoPlay={autoPlay}
        className="h-full w-full object-contain"
        onClick={togglePlay}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => {
          const time = e.currentTarget.currentTime;
          const dur = e.currentTarget.duration || duration;
          setCurrentTime(time);

          // Fire onTimeUpdate callback
          if (onTimeUpdate && dur > 0) {
            onTimeUpdate(time, dur);
          }

          // Report progress at 25%, 50%, 75%, 100%
          if (onProgress && dur > 0) {
            const pct = Math.floor((time / dur) * 100);
            const milestones = [25, 50, 75, 100];
            for (const m of milestones) {
              if (pct >= m && lastReportedProgress.current < m) {
                lastReportedProgress.current = m;
                onProgress(m);
              }
            }
          }

          // Fire onComplete when 90%+ watched
          if (!hasCompleted && dur > 0 && time / dur >= 0.9) {
            setHasCompleted(true);
            onComplete?.();
          }
        }}
        onProgress={() => {
          const video = videoRef.current;
          if (video && video.buffered.length > 0) {
            setBuffered((video.buffered.end(video.buffered.length - 1) / video.duration) * 100);
          }
        }}
        onEnded={() => {
          setIsPlaying(false);
          if (!hasCompleted) {
            setHasCompleted(true);
            onComplete?.();
          }
        }}
      >
        {tracks.map((track) => (
          <track
            key={track.srcLang}
            label={track.label}
            src={track.src}
            srcLang={track.srcLang}
            kind={track.kind}
            default={track.default}
          />
        ))}
      </video>

      {/* Play overlay (when paused and not showing controls) */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center">
          <button
            onClick={togglePlay}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-gray-900 shadow-lg transition-transform hover:scale-110"
            aria-label="Play video"
          >
            <Play className="h-7 w-7 ml-1" />
          </button>
        </div>
      )}

      {/* Controls overlay */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-4 pb-3 pt-16 transition-opacity duration-300",
          showControls || !isPlaying ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        {/* Title */}
        {title && (
          <p className="mb-2 text-sm font-medium text-white/90 drop-shadow">{title}</p>
        )}

        {/* Progress bar */}
        <div
          ref={progressRef}
          className="group/progress relative mb-3 h-1.5 w-full cursor-pointer rounded-full bg-white/30 transition-all hover:h-2.5"
          onClick={handleProgressClick}
          role="slider"
          aria-label="Video progress"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
          tabIndex={0}
        >
          {/* Buffered */}
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-white/30"
            style={{ width: `${buffered}%` }}
          />
          {/* Progress */}
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-indigo-500"
            style={{ width: `${progress}%` }}
          />
          {/* Thumb */}
          <div
            className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-white opacity-0 shadow transition-opacity group-hover/progress:opacity-100"
            style={{ left: `calc(${progress}% - 7px)` }}
          />
        </div>

        {/* Control buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={togglePlay}
              className="rounded p-1 text-white/90 hover:text-white"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </button>

            <button
              onClick={() => seek(-10)}
              className="rounded p-1 text-white/90 hover:text-white"
              aria-label="Rewind 10 seconds"
            >
              <SkipBack className="h-4 w-4" />
            </button>

            <button
              onClick={() => seek(10)}
              className="rounded p-1 text-white/90 hover:text-white"
              aria-label="Forward 10 seconds"
            >
              <SkipForward className="h-4 w-4" />
            </button>

            {/* Volume */}
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="rounded p-1 text-white/90 hover:text-white"
              aria-label={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="h-5 w-5" />
              ) : (
                <Volume2 className="h-5 w-5" />
              )}
            </button>

            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                setVolume(Number(e.target.value));
                setIsMuted(false);
              }}
              className="w-20 accent-white"
              aria-label="Volume"
            />

            {/* Time */}
            <span className="ml-2 text-xs font-mono text-white/80">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Captions toggle */}
            {tracks.length > 0 && (
              <button
                onClick={() => setCaptionsEnabled(!captionsEnabled)}
                className={cn(
                  "rounded p-1 hover:text-white",
                  captionsEnabled ? "text-indigo-400" : "text-white/70"
                )}
                aria-label={captionsEnabled ? "Disable captions" : "Enable captions"}
              >
                {captionsEnabled ? (
                  <Captions className="h-5 w-5" />
                ) : (
                  <CaptionsOff className="h-5 w-5" />
                )}
              </button>
            )}

            {/* Settings */}
            <div className="relative">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="rounded p-1 text-white/70 hover:text-white"
                aria-label="Playback settings"
                aria-expanded={showSettings}
              >
                <Settings className="h-5 w-5" />
              </button>
              {showSettings && (
                <div className="absolute bottom-full right-0 mb-2 rounded-lg bg-gray-900/95 p-3 shadow-xl backdrop-blur">
                  <p className="mb-2 text-xs font-medium text-white/60">Speed</p>
                  <div className="flex gap-1">
                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                      <button
                        key={rate}
                        onClick={() => {
                          setPlaybackRate(rate);
                          setShowSettings(false);
                        }}
                        className={cn(
                          "rounded px-2 py-1 text-xs font-medium transition-colors",
                          playbackRate === rate
                            ? "bg-indigo-600 text-white"
                            : "text-white/70 hover:bg-white/10 hover:text-white"
                        )}
                      >
                        {rate}x
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Fullscreen */}
            <button
              onClick={() => {
                if (document.fullscreenElement) {
                  document.exitFullscreen();
                } else {
                  containerRef.current?.requestFullscreen();
                }
              }}
              className="rounded p-1 text-white/70 hover:text-white"
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {isFullscreen ? (
                <Minimize className="h-5 w-5" />
              ) : (
                <Maximize className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
