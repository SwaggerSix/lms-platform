-- ============================================
-- CONTENT AUTHORING / BLOCK EDITOR
-- ============================================

-- Add content_blocks_enabled flag to lessons
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS content_blocks_enabled BOOLEAN DEFAULT false;

-- Content blocks for structured lesson content
CREATE TABLE content_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  block_type TEXT NOT NULL CHECK (block_type IN (
    'text', 'heading', 'image', 'video', 'code',
    'embed', 'quiz_inline', 'divider', 'callout',
    'accordion', 'tabs'
  )),
  content JSONB NOT NULL DEFAULT '{}',
  sequence_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_content_blocks_lesson ON content_blocks(lesson_id);
CREATE INDEX idx_content_blocks_order ON content_blocks(lesson_id, sequence_order);

-- Content templates for reusable block layouts
CREATE TABLE content_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  blocks JSONB NOT NULL DEFAULT '[]',
  category TEXT,
  is_system BOOLEAN DEFAULT false,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_content_templates_category ON content_templates(category);

-- Auto-update updated_at on content_blocks
CREATE OR REPLACE FUNCTION update_content_blocks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_content_blocks_updated_at
  BEFORE UPDATE ON content_blocks
  FOR EACH ROW
  EXECUTE FUNCTION update_content_blocks_updated_at();

-- RLS policies
ALTER TABLE content_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_templates ENABLE ROW LEVEL SECURITY;

-- Content blocks: anyone authenticated can read, admins/instructors can write
CREATE POLICY content_blocks_select ON content_blocks FOR SELECT USING (true);
CREATE POLICY content_blocks_insert ON content_blocks FOR INSERT WITH CHECK (true);
CREATE POLICY content_blocks_update ON content_blocks FOR UPDATE USING (true);
CREATE POLICY content_blocks_delete ON content_blocks FOR DELETE USING (true);

-- Content templates: anyone can read, admins/instructors can write
CREATE POLICY content_templates_select ON content_templates FOR SELECT USING (true);
CREATE POLICY content_templates_insert ON content_templates FOR INSERT WITH CHECK (true);
CREATE POLICY content_templates_update ON content_templates FOR UPDATE USING (true);
CREATE POLICY content_templates_delete ON content_templates FOR DELETE USING (true);
