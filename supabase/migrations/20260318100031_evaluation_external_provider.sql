-- SurveyCraft external provider integration for Training Evaluations
-- Migration: 20260318100031_evaluation_external_provider.sql

-- Allow an evaluation template to be authored/rendered by an external survey tool.
-- external_provider identifies the tool (e.g. 'surveycraft'); surveycraft_slug is the
-- survey slug used to build the embed URL. Both nullable: native templates leave them null.
ALTER TABLE evaluation_templates
  ADD COLUMN IF NOT EXISTS external_provider TEXT,
  ADD COLUMN IF NOT EXISTS surveycraft_slug TEXT;
