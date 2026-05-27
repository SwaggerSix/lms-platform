-- SurveyCraft external provider integration for Assessments
-- Migration: 20260318100032_assessment_external_provider.sql

-- Allow an assessment to be authored/rendered by an external survey tool.
-- external_provider identifies the tool (e.g. 'surveycraft'); surveycraft_slug is the
-- survey slug used to build the embed URL. Both nullable: native assessments leave them null.
ALTER TABLE assessments
  ADD COLUMN IF NOT EXISTS external_provider TEXT,
  ADD COLUMN IF NOT EXISTS surveycraft_slug TEXT;
