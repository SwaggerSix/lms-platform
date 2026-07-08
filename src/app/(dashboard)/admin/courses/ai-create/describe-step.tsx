'use client';

import { useState } from 'react';
import { cn } from '@/utils/cn';
import { AlertTriangle, Bot, BrainCircuit, FileUp, Loader2, Sparkles } from 'lucide-react';
import {
  audienceOptions,
  courseTypeOptions,
  difficultyOptions,
  durationOptions,
  type CourseData,
  type GenerationOptions,
  type ModuleData,
} from './ai-create-shared';

interface DescribeStepProps {
  options: GenerationOptions;
  onOptionsChange: (options: GenerationOptions) => void;
  /** Called with the generated outline; the parent stores it and advances to step 2. */
  onGenerated: (course: CourseData) => void;
}

export default function DescribeStep({ options, onOptionsChange, onGenerated }: DescribeStepProps) {
  const [inputMode, setInputMode] = useState<'topic' | 'paste'>('topic');
  const [topic, setTopic] = useState('');
  const [sourceMaterial, setSourceMaterial] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const set = (key: keyof GenerationOptions, value: string) =>
    onOptionsChange({ ...options, [key]: value });

  const handleGenerate = async () => {
    const input = inputMode === 'topic' ? topic.trim() : sourceMaterial.trim();
    if (!input) {
      setGenerateError(inputMode === 'topic' ? 'Please describe what you want to teach.' : 'Please paste your source material.');
      return;
    }

    setGenerating(true);
    setGenerateError(null);

    try {
      const body: Record<string, string> = {
        difficulty: options.difficulty.toLowerCase(),
        estimated_duration: options.duration,
        target_audience: options.audience,
        course_type: options.courseType.toLowerCase().replace('-', '_').replace(' ', '_'),
      };

      if (inputMode === 'topic') {
        body.topic = input;
      } else {
        body.source_material = input;
      }

      const res = await fetch('/api/ai/generate-course', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to generate course');
      }

      const data = await res.json();

      const modules: ModuleData[] = (data.modules || []).map((m: any, mi: number) => ({
        id: `m-${mi}-${Date.now()}`,
        title: m.title,
        description: m.description || '',
        lessons: (m.lessons || []).map((l: any, li: number) => ({
          id: `l-${mi}-${li}-${Date.now()}`,
          title: l.title,
          contentType: l.content_type || 'document',
          duration: l.duration || 10,
          description: l.description || '',
        })),
      }));

      onGenerated({
        title: data.title || '',
        description: data.description || '',
        shortDescription: data.short_description || '',
        modules,
        tags: data.tags || [],
        suggestedCategory: data.suggested_category || 'Technical',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      setGenerateError(message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Bot className="h-6 w-6 text-purple-500" />
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Describe Your Course</h2>
          <p className="text-sm text-gray-500">Tell us what you want to teach, and AI will create a structured course outline.</p>
        </div>
      </div>

      {/* Input mode toggle */}
      <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1 w-fit">
        <button
          onClick={() => setInputMode('topic')}
          aria-pressed={inputMode === 'topic'}
          className={cn(
            'rounded-md px-4 py-2 text-sm font-medium transition-colors',
            inputMode === 'topic' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          )}
        >
          <BrainCircuit className="inline h-4 w-4 mr-1.5" />
          Describe Topic
        </button>
        <button
          onClick={() => setInputMode('paste')}
          aria-pressed={inputMode === 'paste'}
          className={cn(
            'rounded-md px-4 py-2 text-sm font-medium transition-colors',
            inputMode === 'paste' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          )}
        >
          <FileUp className="inline h-4 w-4 mr-1.5" />
          Paste Content
        </button>
      </div>

      {inputMode === 'topic' ? (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">What do you want to teach?</label>
          <textarea
            rows={4}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. A comprehensive course on React.js for web developers, covering hooks, state management, and building production-ready applications..."
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Paste your existing content</label>
          <textarea
            rows={8}
            value={sourceMaterial}
            onChange={(e) => setSourceMaterial(e.target.value)}
            placeholder="Paste text from your documents, PDFs, notes, or any existing material. AI will analyze and structure it into a course..."
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 font-mono text-xs"
          />
          <p className="mt-1 text-xs text-gray-400">Supports up to ~12,000 characters of source material</p>
        </div>
      )}

      {/* Options grid */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Difficulty Level</label>
          <select
            value={options.difficulty}
            onChange={(e) => set('difficulty', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
          >
            {difficultyOptions.map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Estimated Duration</label>
          <select
            value={options.duration}
            onChange={(e) => set('duration', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
          >
            {durationOptions.map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Target Audience</label>
          <select
            value={options.audience}
            onChange={(e) => set('audience', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
          >
            {audienceOptions.map((a) => <option key={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Course Type</label>
          <select
            value={options.courseType}
            onChange={(e) => set('courseType', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
          >
            {courseTypeOptions.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {generateError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {generateError}
        </div>
      )}

      <button
        onClick={handleGenerate}
        disabled={generating}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-3 text-sm font-medium text-white shadow-sm hover:from-purple-700 hover:to-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
      >
        {generating ? (
          <>
            <div className="relative flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>AI is generating your course outline...</span>
            </div>
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Generate Course Outline
          </>
        )}
      </button>

      {generating && (
        <div className="flex items-center justify-center gap-3 py-4">
          <div className="flex gap-1">
            <div className="h-2 w-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="h-2 w-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="h-2 w-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <p className="text-sm text-gray-500">This usually takes 15-30 seconds</p>
        </div>
      )}
    </div>
  );
}
