"use client";

import { useState } from "react";

interface NuggetData {
  id: string;
  title: string;
  content_type: "tip" | "flashcard" | "quiz" | "video_clip" | "infographic" | "checklist";
  content: Record<string, any>;
  difficulty?: string;
  estimated_seconds?: number;
  tags?: string[];
  view_count?: number;
  user_status?: string | null;
}

interface NuggetCardProps {
  nugget: NuggetData;
  onComplete?: (nuggetId: string, score?: number) => void;
  onBookmark?: (nuggetId: string) => void;
}

const typeIcons: Record<string, string> = {
  tip: "💡",
  flashcard: "🔄",
  quiz: "❓",
  video_clip: "🎬",
  infographic: "📊",
  checklist: "✅",
};

const typeColors: Record<string, string> = {
  tip: "from-amber-500 to-orange-600",
  flashcard: "from-blue-500 to-indigo-600",
  quiz: "from-purple-500 to-violet-600",
  video_clip: "from-red-500 to-rose-600",
  infographic: "from-green-500 to-emerald-600",
  checklist: "from-cyan-500 to-teal-600",
};

const difficultyColors: Record<string, string> = {
  beginner: "bg-green-100 text-green-800",
  intermediate: "bg-yellow-100 text-yellow-800",
  advanced: "bg-red-100 text-red-800",
};

export default function NuggetCard({ nugget, onComplete, onBookmark }: NuggetCardProps) {
  const [flipped, setFlipped] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());

  const handleQuizSubmit = () => {
    if (selectedAnswer === null) return;
    setShowResult(true);
    const correct = nugget.content.correct_answer === selectedAnswer;
    onComplete?.(nugget.id, correct ? 100 : 0);
  };

  const handleChecklistToggle = (index: number) => {
    const next = new Set(checkedItems);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setCheckedItems(next);

    const items = nugget.content.items as string[];
    if (items && next.size === items.length) {
      onComplete?.(nugget.id, 100);
    }
  };

  const renderContent = () => {
    switch (nugget.content_type) {
      case "tip":
        return (
          <div className="p-5">
            <p className="text-gray-700 leading-relaxed text-sm">
              {nugget.content.text || nugget.content.body || ""}
            </p>
            {nugget.content.source && (
              <p className="mt-3 text-xs text-gray-400 italic">Source: {nugget.content.source as string}</p>
            )}
          </div>
        );

      case "flashcard":
        return (
          <div
            className="p-5 cursor-pointer min-h-[120px] flex items-center justify-center"
            onClick={() => setFlipped(!flipped)}
          >
            <div className="text-center">
              {!flipped ? (
                <>
                  <p className="text-gray-700 font-medium">{nugget.content.front as string}</p>
                  <p className="mt-3 text-xs text-gray-400">Tap to flip</p>
                </>
              ) : (
                <>
                  <p className="text-indigo-700 font-medium">{nugget.content.back as string}</p>
                  <p className="mt-3 text-xs text-gray-400">Tap to flip back</p>
                </>
              )}
            </div>
          </div>
        );

      case "quiz":
        return (
          <div className="p-5">
            <p className="text-gray-700 font-medium mb-3">{nugget.content.question as string}</p>
            <div className="space-y-2">
              {((nugget.content.options as string[]) || []).map((opt, i) => (
                <button
                  key={i}
                  onClick={() => !showResult && setSelectedAnswer(i)}
                  className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                    showResult
                      ? i === nugget.content.correct_answer
                        ? "bg-green-50 border-green-400 text-green-700"
                        : i === selectedAnswer
                        ? "bg-red-50 border-red-400 text-red-700"
                        : "border-gray-200 text-gray-500"
                      : selectedAnswer === i
                      ? "bg-indigo-50 border-indigo-400 text-indigo-700"
                      : "border-gray-200 hover:border-indigo-300 text-gray-600"
                  }`}
                  disabled={showResult}
                >
                  {opt}
                </button>
              ))}
            </div>
            {!showResult && selectedAnswer !== null && (
              <button
                onClick={handleQuizSubmit}
                className="mt-3 w-full py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Submit Answer
              </button>
            )}
            {showResult && nugget.content.explanation && (
              <p className="mt-3 text-xs text-gray-500 bg-gray-50 p-2 rounded">
                {nugget.content.explanation as string}
              </p>
            )}
          </div>
        );

      case "video_clip":
        return (
          <div className="p-5">
            <div className="bg-gray-900 rounded-lg aspect-video flex items-center justify-center mb-3">
              {nugget.content.url ? (
                <iframe
                  src={nugget.content.url as string}
                  className="w-full h-full rounded-lg"
                  allowFullScreen
                />
              ) : (
                <div className="text-gray-400 text-sm">Video clip placeholder</div>
              )}
            </div>
            {nugget.content.caption && (
              <p className="text-sm text-gray-600">{nugget.content.caption as string}</p>
            )}
          </div>
        );

      case "infographic":
        return (
          <div className="p-5">
            {nugget.content.image_url ? (
              <img
                src={nugget.content.image_url as string}
                alt={nugget.title}
                className="w-full rounded-lg"
              />
            ) : (
              <div className="bg-gray-100 rounded-lg aspect-[4/3] flex items-center justify-center text-gray-400 text-sm">
                Infographic placeholder
              </div>
            )}
            {nugget.content.caption && (
              <p className="mt-2 text-sm text-gray-600">{nugget.content.caption as string}</p>
            )}
          </div>
        );

      case "checklist":
        return (
          <div className="p-5">
            <div className="space-y-2">
              {((nugget.content.items as string[]) || []).map((item, i) => (
                <label key={i} className="flex items-start gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={checkedItems.has(i)}
                    onChange={() => handleChecklistToggle(i)}
                    className="mt-0.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span
                    className={`text-sm transition-colors ${
                      checkedItems.has(i) ? "text-gray-400 line-through" : "text-gray-700"
                    }`}
                  >
                    {item}
                  </span>
                </label>
              ))}
            </div>
            {nugget.content.items && (
              <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                  style={{
                    width: `${(checkedItems.size / (nugget.content.items as string[]).length) * 100}%`,
                  }}
                />
              </div>
            )}
          </div>
        );

      default:
        return (
          <div className="p-5 text-sm text-gray-500">Unsupported content type</div>
        );
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
      {/* Header */}
      <div className={`bg-gradient-to-r ${typeColors[nugget.content_type] || "from-gray-500 to-gray-600"} px-5 py-3`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{typeIcons[nugget.content_type]}</span>
            <span className="text-white text-xs font-medium uppercase tracking-wide">
              {nugget.content_type.replace("_", " ")}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {nugget.difficulty && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${difficultyColors[nugget.difficulty]}`}>
                {nugget.difficulty}
              </span>
            )}
            {nugget.estimated_seconds && (
              <span className="text-white/80 text-xs">
                {nugget.estimated_seconds < 60
                  ? `${nugget.estimated_seconds}s`
                  : `${Math.round(nugget.estimated_seconds / 60)}m`}
              </span>
            )}
          </div>
        </div>
        <h3 className="text-white font-semibold mt-1 text-sm leading-tight">{nugget.title}</h3>
      </div>

      {/* Content */}
      {renderContent()}

      {/* Footer */}
      <div className="px-5 py-3 border-t border-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {(nugget.tags || []).slice(0, 3).map((tag) => (
            <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
              {tag}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {onBookmark && (
            <button
              onClick={() => onBookmark(nugget.id)}
              className={`p-1.5 rounded-lg transition-colors ${
                nugget.user_status === "bookmarked"
                  ? "text-amber-500 bg-amber-50"
                  : "text-gray-400 hover:text-amber-500 hover:bg-amber-50"
              }`}
              title="Bookmark"
            >
              <svg className="w-4 h-4" fill={nugget.user_status === "bookmarked" ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </button>
          )}
          {onComplete && nugget.user_status !== "completed" && nugget.content_type !== "quiz" && (
            <button
              onClick={() => onComplete(nugget.id)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-green-500 hover:bg-green-50 transition-colors"
              title="Mark complete"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </button>
          )}
          {nugget.user_status === "completed" && (
            <span className="text-xs text-green-600 font-medium flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Done
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
