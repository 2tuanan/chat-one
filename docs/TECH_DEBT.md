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

## TD-07 — jsdom/RTL setup missing
Source: Story 1.3 QA
Impact: Server action integration tests and dialog 
component tests cannot run until jsdom configured
Fix: Add environment: "jsdom" to vitest.config.ts
and install @testing-library/react when component 
tests are needed (Day 14 buffer)

## TD-08 — useEffect(,[]) exhaustive-deps risk
Source: Story 1.3 QA
Impact: None until react-hooks/exhaustive-deps lint
rule is enabled
Fix: Replace with useRef guard pattern if lint rule
added: const hydrated = useRef(false)

## TD-09 — isValidRoomId accepts non-UUID structure
Source: Story 1.4 QA
Impact: None — RLS + member guard handle invalid IDs
Fix: Replace regex with proper UUID v4 validation:
/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab]
[0-9a-f]{3}-[0-9a-f]{12}$/i

## TD-10 — appendNewMessage no dedup by message id
Source: Story 1.4 QA (intentional, Story 2.1 concern)
Impact: Duplicate message if Realtime fires twice
for foreign sender — rare in practice
Fix: Add id-based dedup in appendNewMessage or
in use-realtime-messages.ts in Story 2.1

## TD-11 — useThrottle render-time setState needs comment
Source: Story 1.5 QA
Impact: Future devs may flag as bug
Fix: Comment added in apply-qa-fixes ✅

## TD-12 — Non-string generic payload test coverage
Source: Story 1.5 QA  
Impact: <T> claim unproven empirically for number/object
Fix: One test per hook added in apply-qa-fixes ✅

## TD-13 — F-02 member management bug blocks two-user presence smoke test
Source: Story 2.3, F-02
Impact: Medium — smoke test of presence between two real users
impossible until member management (invite/join by link) is built
Fix: Complete F-02 member join flow; then re-run two-user
presence smoke test manually
**Status: RESOLVED ✅ — Story 2.5 (addRoomMember, inline Add Member UI, memberCount fix)**