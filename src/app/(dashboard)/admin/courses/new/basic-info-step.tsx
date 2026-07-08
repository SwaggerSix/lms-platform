'use client';

import { useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { slugify, formatDuration } from '@/utils/format';
import { Upload, X } from 'lucide-react';
import {
  difficultyOptions,
  typeOptions,
  type BasicInfo,
} from './course-new-shared';

interface BasicInfoStepProps {
  value: BasicInfo;
  onChange: (value: BasicInfo) => void;
  categories: { id: string; name: string }[];
  onCategoriesChange: (categories: { id: string; name: string }[]) => void;
  /** Sum of lesson durations from step 2, for the "Match content" helper. */
  contentDuration: number;
  coverPreview: string | null;
  onCoverSelect: (file: File | null) => void;
  onCoverClear: () => void;
}

export default function BasicInfoStep({
  value,
  onChange,
  categories,
  onCategoriesChange,
  contentDuration,
  coverPreview,
  onCoverSelect,
  onCoverClear,
}: BasicInfoStepProps) {
  const toast = useToast();
  const [tagInput, setTagInput] = useState('');

  const set = <K extends keyof BasicInfo>(key: K, val: BasicInfo[K]) =>
    onChange({ ...value, [key]: val });

  const handleTitleChange = (val: string) => {
    onChange({ ...value, title: val, slug: slugify(val) });
  };

  const addTag = () => {
    if (tagInput.trim() && !value.tags.includes(tagInput.trim())) {
      set('tags', [...value.tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const addCategory = async () => {
    const name = window.prompt('New category name:')?.trim();
    if (!name) return;
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add category');
      onCategoriesChange(
        [...categories, { id: data.id, name: data.name }].sort((a, b) => a.name.localeCompare(b.name))
      );
      set('categoryId', data.id);
      toast.success('Category added.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add category');
    }
  };

  const renameCategory = async () => {
    const current = categories.find((c) => c.id === value.categoryId);
    if (!current) {
      toast.error('Select a category to rename first.');
      return;
    }
    const name = window.prompt('Rename category:', current.name)?.trim();
    if (!name || name === current.name) return;
    try {
      const res = await fetch('/api/categories', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: value.categoryId, name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to rename category');
      onCategoriesChange(
        categories
          .map((c) => (c.id === value.categoryId ? { ...c, name: data.name } : c))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      toast.success('Category renamed.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to rename category');
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">Basic Information</h2>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Course Title</label>
        <input type="text" value={value.title} onChange={(e) => handleTitleChange(e.target.value)} placeholder="e.g. Introduction to Data Science" className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Slug</label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">/courses/</span>
          <input type="text" value={value.slug} onChange={(e) => set('slug', e.target.value)} className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
        <textarea rows={4} value={value.description} onChange={(e) => set('description', e.target.value)} placeholder="Detailed course description..." className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Short Description</label>
        <input type="text" value={value.shortDescription} onChange={(e) => set('shortDescription', e.target.value)} placeholder="Brief summary (max 160 characters)" maxLength={160} className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Learning Objectives</label>
        <textarea rows={4} value={value.learningObjectives} onChange={(e) => set('learningObjectives', e.target.value)} placeholder="One objective per line, e.g.&#10;Understand core concepts&#10;Apply best practices" className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
        <p className="mt-1 text-xs text-gray-400">One per line. Shown to learners as &ldquo;What you&rsquo;ll learn&rdquo;.</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Optimal Audience</label>
        <input type="text" value={value.optimalAudience} onChange={(e) => set('optimalAudience', e.target.value)} placeholder="Who is this course best suited for?" className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
          <select value={value.categoryId} onChange={(e) => set('categoryId', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
            <option value="">Uncategorized</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="mt-1 flex gap-3">
            <button type="button" onClick={addCategory} className="text-xs font-medium text-indigo-600 hover:text-indigo-700">+ Add category</button>
            <button type="button" onClick={renameCategory} className="text-xs font-medium text-gray-500 hover:text-gray-700">Edit selected</button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Course Type</label>
          <select value={value.courseType} onChange={(e) => set('courseType', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
            {typeOptions.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Difficulty Level</label>
          <select value={value.difficulty} onChange={(e) => set('difficulty', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
            {difficultyOptions.map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Course Length (minutes)</label>
        <div className="flex items-center gap-2">
          <input type="number" min={0} value={value.duration} onChange={(e) => set('duration', parseInt(e.target.value) || 0)} className="w-32 rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
          <span className="text-sm text-gray-400">({formatDuration(value.duration)})</span>
          <Button type="button" variant="secondary" size="sm" onClick={() => set('duration', contentDuration)}>
            Match content ({formatDuration(contentDuration)})
          </Button>
        </div>
        {value.duration !== contentDuration && (
          <p className="mt-1 text-xs text-amber-600">
            Course length must match the total of your lesson durations ({formatDuration(contentDuration)}) before publishing.
          </p>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Cover image</label>
        {coverPreview ? (
          <div className="relative h-40 w-full overflow-hidden rounded-lg border border-gray-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={coverPreview} alt="Cover preview" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={onCoverClear}
              className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-white/90 px-2 py-1 text-xs font-medium text-red-600 shadow-sm hover:bg-white"
            >
              <X className="h-3.5 w-3.5" /> Remove
            </button>
          </div>
        ) : (
          <label className="flex h-40 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 transition-colors hover:bg-gray-100">
            <div className="text-center">
              <Upload className="mx-auto h-8 w-8 text-gray-400" />
              <p className="mt-2 text-sm text-gray-500">Click to upload</p>
              <p className="text-xs text-gray-400">PNG, JPG, WebP, GIF up to 5MB</p>
            </div>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              onChange={(e) => {
                onCoverSelect(e.target.files?.[0] ?? null);
                e.target.value = '';
              }}
            />
          </label>
        )}
        <p className="mt-1 text-xs text-gray-400">Optional. If omitted, a cover is generated automatically.</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Tags</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {value.tags.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
              {tag}
              <button onClick={() => set('tags', value.tags.filter((t) => t !== tag))} className="text-indigo-400 hover:text-indigo-600"><X className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())} placeholder="Add a tag..." className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
          <Button variant="secondary" onClick={addTag}>Add</Button>
        </div>
      </div>
    </div>
  );
}
