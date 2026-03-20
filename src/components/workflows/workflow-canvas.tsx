"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { StepNode } from "./step-node";

export interface CanvasStep {
  id: string;
  workflow_id: string;
  step_type: "condition" | "action" | "delay" | "branch" | "loop";
  step_config: Record<string, unknown>;
  position_x: number;
  position_y: number;
  next_step_id: string | null;
  true_step_id: string | null;
  false_step_id: string | null;
  sequence_order: number;
}

interface WorkflowCanvasProps {
  steps: CanvasStep[];
  selectedStepId: string | null;
  onSelectStep: (id: string | null) => void;
  onUpdateStep: (id: string, updates: Partial<CanvasStep>) => void;
  onDeleteStep: (id: string) => void;
}

interface Connection {
  fromId: string;
  toId: string;
  type: "next" | "true" | "false";
}

export function WorkflowCanvas({
  steps,
  selectedStepId,
  onSelectStep,
  onUpdateStep,
  onDeleteStep,
}: WorkflowCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Build connection list
  const connections: Connection[] = [];
  for (const step of steps) {
    if (step.next_step_id) {
      connections.push({ fromId: step.id, toId: step.next_step_id, type: "next" });
    }
    if (step.true_step_id) {
      connections.push({ fromId: step.id, toId: step.true_step_id, type: "true" });
    }
    if (step.false_step_id) {
      connections.push({ fromId: step.id, toId: step.false_step_id, type: "false" });
    }
  }

  const stepMap = new Map(steps.map((s) => [s.id, s]));

  // Node dimensions
  const NODE_WIDTH = 220;
  const NODE_HEIGHT = 72;

  const handleNodeMouseDown = useCallback(
    (e: React.MouseEvent, stepId: string) => {
      e.stopPropagation();
      if (e.button !== 0) return;
      const step = stepMap.get(stepId);
      if (!step) return;
      setDraggingId(stepId);
      setDragOffset({
        x: e.clientX - (step.position_x + pan.x),
        y: e.clientY - (step.position_y + pan.y),
      });
    },
    [stepMap, pan]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (draggingId) {
        const newX = e.clientX - dragOffset.x - pan.x;
        const newY = e.clientY - dragOffset.y - pan.y;
        onUpdateStep(draggingId, { position_x: Math.max(0, newX), position_y: Math.max(0, newY) });
      } else if (isPanning) {
        setPan({
          x: e.clientX - panStart.x,
          y: e.clientY - panStart.y,
        });
      }
    },
    [draggingId, dragOffset, pan, isPanning, panStart, onUpdateStep]
  );

  const handleMouseUp = useCallback(() => {
    setDraggingId(null);
    setIsPanning(false);
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current || (e.target as HTMLElement).dataset.canvasBg) {
      if (e.button === 0) {
        onSelectStep(null);
        setIsPanning(true);
        setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      }
    }
  };

  // Render SVG connections
  function renderConnections() {
    return connections.map((conn) => {
      const from = stepMap.get(conn.fromId);
      const to = stepMap.get(conn.toId);
      if (!from || !to) return null;

      const x1 = from.position_x + NODE_WIDTH / 2;
      const y1 = from.position_y + NODE_HEIGHT;
      const x2 = to.position_x + NODE_WIDTH / 2;
      const y2 = to.position_y;

      const midY = (y1 + y2) / 2;

      const pathD = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;

      let strokeColor = "#94a3b8"; // gray for next
      if (conn.type === "true") strokeColor = "#22c55e"; // green
      if (conn.type === "false") strokeColor = "#ef4444"; // red

      return (
        <g key={`${conn.fromId}-${conn.toId}-${conn.type}`}>
          <path
            d={pathD}
            fill="none"
            stroke={strokeColor}
            strokeWidth={2}
            strokeDasharray={conn.type !== "next" ? "6,4" : "none"}
          />
          {/* Arrow head */}
          <circle cx={x2} cy={y2} r={4} fill={strokeColor} />
          {/* Label for branch connections */}
          {conn.type !== "next" && (
            <text
              x={(x1 + x2) / 2}
              y={midY - 8}
              textAnchor="middle"
              className="text-[10px] font-medium"
              fill={strokeColor}
            >
              {conn.type === "true" ? "Yes" : "No"}
            </text>
          )}
        </g>
      );
    });
  }

  // Compute SVG viewBox to encompass all nodes
  const maxX = steps.reduce((m, s) => Math.max(m, s.position_x + NODE_WIDTH + 50), 800);
  const maxY = steps.reduce((m, s) => Math.max(m, s.position_y + NODE_HEIGHT + 50), 600);

  return (
    <div
      ref={canvasRef}
      className="w-full h-full overflow-hidden relative cursor-grab active:cursor-grabbing select-none"
      onMouseDown={handleCanvasMouseDown}
      data-canvas-bg="true"
    >
      {/* Grid background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle, #e2e8f0 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          backgroundPosition: `${pan.x % 24}px ${pan.y % 24}px`,
        }}
      />

      {/* Empty state */}
      {steps.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center text-gray-400">
            <div className="text-4xl mb-2 opacity-30">+</div>
            <p className="font-medium">No steps yet</p>
            <p className="text-sm mt-1">Click &quot;Add Step&quot; below to build your workflow</p>
          </div>
        </div>
      )}

      {/* SVG layer for connections */}
      <svg
        className="absolute top-0 left-0 pointer-events-none"
        width={maxX}
        height={maxY}
        style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}
      >
        {renderConnections()}
      </svg>

      {/* Node layer */}
      <div
        className="absolute top-0 left-0"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px)`,
          width: maxX,
          height: maxY,
        }}
      >
        {steps.map((step) => (
          <div
            key={step.id}
            className="absolute"
            style={{
              left: step.position_x,
              top: step.position_y,
              width: NODE_WIDTH,
            }}
            onMouseDown={(e) => handleNodeMouseDown(e, step.id)}
          >
            <StepNode
              step={step}
              isSelected={selectedStepId === step.id}
              onClick={() => onSelectStep(step.id)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
