-- =============================================================
-- Seed: pre-built campaigns — one per focus area, each containing
-- all global seed actions from that category in order.
-- Campaigns with NULL organization_id / created_by are global
-- templates visible to every org's managers.
-- =============================================================

DO $$
DECLARE
  cats TEXT[] := ARRAY[
    'Purpose','Strategy','Values','Efficiency','Customer',
    'Collaboration','Empowered Teams','Capability Development',
    'Learning','Change Ready','Future Focused','Community',
    'Psychological Safety','DEIA','Wellbeing','General'
  ];
  cat TEXT;
  camp_id UUID;
  action_rec RECORD;
  pos INT;
BEGIN
  FOREACH cat IN ARRAY cats LOOP
    -- Create the campaign
    INSERT INTO public.nudge_campaigns (
      organization_id, created_by, name, category, frequency,
      send_morning_email, send_evening_email, timezone,
      status, total_nudges
    ) VALUES (
      NULL, NULL,
      cat || ' Development Series',
      cat, 'weekdays',
      TRUE, TRUE, 'America/New_York',
      'active', 0
    ) RETURNING id INTO camp_id;

    -- Add all global seed actions from this category as ordered items
    pos := 0;
    FOR action_rec IN
      SELECT id FROM public.nudge_actions
      WHERE category = cat
        AND is_active = true
        AND organization_id IS NULL
        AND created_by IS NULL
      ORDER BY created_at ASC, id ASC
    LOOP
      pos := pos + 1;
      INSERT INTO public.nudge_campaign_items (campaign_id, nudge_action_id, position)
      VALUES (camp_id, action_rec.id, pos);
    END LOOP;

    -- Update total_nudges to match actual item count
    UPDATE public.nudge_campaigns SET total_nudges = pos WHERE id = camp_id;
  END LOOP;
END $$;
