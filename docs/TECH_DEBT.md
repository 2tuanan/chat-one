# Tech Debt

## TD-01 — Username collision error message
Source: Story 1.1 QA
Impact: Low — affects signup UX when username taken
Fix: Catch Postgres unique constraint error in 
handle_new_user and surface friendly message

## TD-02 — normalizeAuthError coverage
Source: Story 1.1 QA  
Impact: Low — raw Supabase errors shown in edge cases
Fix: Expand error map in actions/auth.ts

## TD-03 — Vitest jsdom config
Source: Story 1.1 QA
Impact: None until component tests added
Fix: Add environment: "jsdom" when component tests needed

## TD-04 — confirmMessage no-match pendingIds delete
Source: Story 1.2 QA
Impact: None — harmless edge case
Fix: Guard delete with existence check if needed later

## TD-05 — selectRoomList tie-breaker missing
Source: Story 1.2 QA
Impact: Negligible — identical updated_at rare in practice
Fix: Add id as secondary sort key if ordering issues appear

## TD-06 — selectActiveRoom/prependMessages indirect coverage
Source: Story 1.2 QA
Impact: Low — paths exercised but not directly asserted
Fix: Add explicit assertions on Day 14 coverage pass
