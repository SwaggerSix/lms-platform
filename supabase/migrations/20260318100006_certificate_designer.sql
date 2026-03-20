-- Certificate templates with design data
CREATE TABLE IF NOT EXISTS certificate_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  design_data JSONB NOT NULL DEFAULT '{}',
  -- design_data format:
  -- {
  --   "background": { "color": "#fff", "image_url": null, "pattern": "classic" },
  --   "dimensions": { "width": 1056, "height": 816, "orientation": "landscape" },
  --   "elements": [
  --     { "type": "text", "id": "title", "content": "Certificate of Completion", "x": 528, "y": 120, "fontSize": 36, "fontFamily": "serif", "fontWeight": "bold", "color": "#1a1a2e", "align": "center" },
  --     { "type": "text", "id": "recipient", "content": "{{learner_name}}", "x": 528, "y": 280, "fontSize": 28, "fontFamily": "serif", "color": "#333", "align": "center" },
  --     { "type": "text", "id": "course", "content": "{{course_name}}", "x": 528, "y": 380, "fontSize": 20, "fontFamily": "sans-serif", "color": "#555", "align": "center" },
  --     { "type": "text", "id": "date", "content": "{{completion_date}}", "x": 528, "y": 480, "fontSize": 16, "fontFamily": "sans-serif", "color": "#777", "align": "center" },
  --     { "type": "line", "id": "divider", "x1": 200, "y1": 340, "x2": 856, "y2": 340, "strokeColor": "#4f46e5", "strokeWidth": 2 },
  --     { "type": "image", "id": "logo", "url": "{{company_logo}}", "x": 50, "y": 50, "width": 120, "height": 60 }
  --   ],
  --   "border": { "enabled": true, "color": "#4f46e5", "width": 3, "style": "double", "padding": 20 }
  -- }
  thumbnail_url TEXT,
  is_default BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Link templates to certifications
ALTER TABLE certifications ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES certificate_templates(id);

-- Public verification
ALTER TABLE user_certifications ADD COLUMN IF NOT EXISTS verification_code TEXT UNIQUE;
ALTER TABLE user_certifications ADD COLUMN IF NOT EXISTS pdf_url TEXT;
ALTER TABLE user_certifications ADD COLUMN IF NOT EXISTS public_url TEXT;

CREATE INDEX IF NOT EXISTS idx_cert_verification ON user_certifications(verification_code);
