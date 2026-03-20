"use client";

import { useState, useRef, useEffect } from "react";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  suggestedPrompts?: string[];
}

export default function ChatInput({
  onSend,
  disabled = false,
  placeholder = "Type your message...",
  suggestedPrompts,
}: ChatInputProps) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [message]);

  const handleSubmit = () => {
    const trimmed = message.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setMessage("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="space-y-2">
      {/* Suggested Prompts */}
      {suggestedPrompts && suggestedPrompts.length > 0 && message === "" && (
        <div className="flex flex-wrap gap-2 px-1">
          {suggestedPrompts.map((prompt, i) => (
            <button
              key={i}
              onClick={() => onSend(prompt)}
              disabled={disabled}
              className="text-xs px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-full hover:bg-indigo-100 transition-colors disabled:opacity-50 border border-indigo-100"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Input Area */}
      <div className="flex items-end gap-2 bg-white border border-gray-300 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition-all">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          rows={1}
          className="flex-1 resize-none text-sm text-gray-800 placeholder-gray-400 outline-none disabled:bg-transparent disabled:cursor-not-allowed min-h-[36px] max-h-[120px] py-1"
        />
        <button
          onClick={handleSubmit}
          disabled={!message.trim() || disabled}
          className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5m0 0l-7 7m7-7l7 7" />
          </svg>
        </button>
      </div>
      <p className="text-[10px] text-gray-400 text-center">
        Press Enter to send, Shift+Enter for new line
      </p>
    </div>
  );
}
