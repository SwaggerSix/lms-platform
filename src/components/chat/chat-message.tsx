"use client";

interface ChatMessageProps {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: string;
}

export default function ChatMessage({ role, content, timestamp }: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
          isUser
            ? "bg-indigo-600 text-white"
            : "bg-gradient-to-br from-emerald-400 to-teal-500 text-white"
        }`}
      >
        {isUser ? "You" : "AI"}
      </div>

      {/* Message Bubble */}
      <div className={`max-w-[75%] ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? "bg-indigo-600 text-white rounded-br-md"
              : "bg-white border border-gray-200 text-gray-800 rounded-bl-md shadow-sm"
          }`}
        >
          {/* Render markdown-like content */}
          {content.split("\n").map((line, i) => {
            if (line.startsWith("```")) {
              return null; // Simplified - skip code fence markers
            }
            if (line.startsWith("# ")) {
              return (
                <p key={i} className="font-bold text-base mt-2 mb-1">
                  {line.slice(2)}
                </p>
              );
            }
            if (line.startsWith("## ")) {
              return (
                <p key={i} className="font-semibold mt-2 mb-1">
                  {line.slice(3)}
                </p>
              );
            }
            if (line.startsWith("- ") || line.startsWith("* ")) {
              return (
                <p key={i} className="pl-4 before:content-['•'] before:mr-2 before:text-gray-400">
                  {line.slice(2)}
                </p>
              );
            }
            if (line.match(/^\d+\.\s/)) {
              return (
                <p key={i} className="pl-4">
                  {line}
                </p>
              );
            }
            if (line.startsWith("**") && line.endsWith("**")) {
              return (
                <p key={i} className="font-semibold">
                  {line.slice(2, -2)}
                </p>
              );
            }
            if (line.trim() === "") {
              return <br key={i} />;
            }
            // Render inline bold
            const parts = line.split(/(\*\*[^*]+\*\*)/g);
            return (
              <p key={i}>
                {parts.map((part, j) => {
                  if (part.startsWith("**") && part.endsWith("**")) {
                    return (
                      <strong key={j}>{part.slice(2, -2)}</strong>
                    );
                  }
                  // Inline code
                  const codeParts = part.split(/(`[^`]+`)/g);
                  return codeParts.map((cp, k) => {
                    if (cp.startsWith("`") && cp.endsWith("`")) {
                      return (
                        <code
                          key={k}
                          className={`px-1 py-0.5 rounded text-xs font-mono ${
                            isUser
                              ? "bg-indigo-500 text-indigo-100"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {cp.slice(1, -1)}
                        </code>
                      );
                    }
                    return cp;
                  });
                })}
              </p>
            );
          })}
        </div>
        {timestamp && (
          <p
            className={`text-[10px] text-gray-400 mt-1 ${
              isUser ? "text-right" : "text-left"
            }`}
          >
            {new Date(timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        )}
      </div>
    </div>
  );
}
