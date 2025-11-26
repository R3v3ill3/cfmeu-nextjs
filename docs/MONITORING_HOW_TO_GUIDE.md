# Monitoring How-To Guide: Finding and Reporting Bugs

This guide walks you through using Sentry and PostHog to identify issues in the CFMEU uConstruct application and report them to a Cursor agent for investigation and fixing.

---

## Quick Reference

| Need to find... | Use this tool |
|-----------------|---------------|
| JavaScript errors, API failures, crashes | **Sentry** |
| User confusion, UX issues, "why did this happen?" | **PostHog Session Replay** |
| Which features are used most/least | **PostHog Analytics** |
| Performance problems (slow pages) | **Sentry Performance** |

---

## Part 1: Using Sentry for Error Tracking

### Accessing Sentry

1. Go to [sentry.io](https://sentry.io) and sign in
2. Select your **cfmeu-uconstruct** project from the dashboard

### Finding Errors

#### View Recent Issues
1. Click **Issues** in the left sidebar
2. You'll see a list of errors sorted by frequency and recency
3. Each issue shows:
   - Error message
   - Number of occurrences (events)
   - Number of affected users
   - First and last seen timestamps

#### Filter Issues
Use the search bar to filter:
```
is:unresolved              # Only unresolved issues
user.email:name@cfmeu.org  # Errors for specific user
environment:production     # Only production errors
level:error                # Only errors (not warnings)
```

### Investigating an Error

1. **Click on an issue** to open the detail view
2. Key information to gather:

#### Error Details Tab
- **Exception type and message** - What went wrong
- **Stack trace** - Where in the code it happened
- **Tags** - Environment, browser, OS, user role

#### Breadcrumbs Tab
- Shows the sequence of events leading up to the error
- Includes: page navigations, button clicks, API calls, console logs

#### User Tab
- Which user experienced the error
- Their role and assigned patches

### Copying Error Information for Cursor

When you find an error to fix, copy this information:

```markdown
## Error Report from Sentry

**Error:** [Copy the error message]
**File:** [Copy the file path from stack trace, e.g., src/app/projects/[id]/page.tsx]
**Line:** [Line number from stack trace]
**Occurrences:** [Number of times this happened]
**Users Affected:** [Number of users]

### Stack Trace
[Copy the relevant stack trace - usually top 5-10 lines]

### Breadcrumbs (what happened before the error)
[Copy the last 5-10 breadcrumbs showing user actions]

### User Context
- Role: [organiser/lead_organiser/admin]
- Browser: [Chrome/Safari/etc]
- Device: [Desktop/iPhone/Android]

### Additional Context
[Any other relevant information you noticed]
```

---

## Part 2: Using PostHog for Session Recordings

### Accessing PostHog

1. Go to [app.posthog.com](https://app.posthog.com) (or your region's URL)
2. Select your project from the dropdown

### Viewing Session Recordings

1. Click **Session Replay** in the left sidebar
2. You'll see a list of recorded sessions with:
   - User identifier (email if logged in)
   - Session duration
   - Pages visited
   - Number of clicks/events

#### Filtering Sessions
Use filters to find specific sessions:
- **Person** - Filter by user email
- **Event** - Sessions containing specific events (e.g., "error_occurred")
- **Page** - Sessions that visited a specific page
- **Duration** - Short or long sessions

### Watching a Recording

1. **Click on a session** to open the player
2. Use the playback controls:
   - Play/pause, speed up (2x, 4x)
   - Timeline scrubber to jump to specific points
   - Event markers on timeline (clicks, page loads, errors)

3. **Key things to watch for:**
   - User confusion (repeated clicks, back-and-forth navigation)
   - Form errors (validation messages, failed submissions)
   - UI issues (elements not visible, layout problems)
   - Slow page loads (spinner showing for long time)

### Creating a Bug Report from a Session

When you spot an issue in a recording:

```markdown
## Bug Report from PostHog Session

**Session ID:** [Copy from PostHog URL or session details]
**User:** [User email/ID if available]
**Date/Time:** [When the session occurred]
**Duration:** [How long the session was]

### Issue Description
[Describe what you observed in the recording]

### Steps to Reproduce (from watching the session)
1. User went to [page]
2. User clicked [element]
3. User entered [data] in [field]
4. [What went wrong]

### Expected Behavior
[What should have happened]

### Actual Behavior
[What actually happened]

### Screenshots/Timestamps
- At 0:45 - User clicked submit button
- At 0:47 - Error message appeared
- At 0:52 - User tried again with same result

### Device/Browser
[From session details]
```

---

## Part 3: Reporting Issues to Cursor Agent

### Template for Cursor Agent

Use this template when asking Cursor to investigate and fix an issue:

```markdown
I found an issue in [Sentry/PostHog] that needs investigation and fixing.

## Issue Summary
[One sentence describing the problem]

## Source
- **Tool:** Sentry / PostHog Session Replay
- **Issue ID/Session ID:** [ID]
- **Severity:** Critical / High / Medium / Low
- **Users Affected:** [Number or "specific user"]

## Details
[Paste the relevant error report or bug report from above]

## My Observations
[Any additional context you noticed, patterns, or suspicions about the cause]

## Request
Please investigate this issue, identify the root cause, and implement a fix.
```

### Example: Reporting a Sentry Error

```markdown
I found an issue in Sentry that needs investigation and fixing.

## Issue Summary
Users are getting "Cannot read property 'name' of undefined" when viewing project details.

## Source
- **Tool:** Sentry
- **Issue ID:** CFMEU-123
- **Severity:** High
- **Users Affected:** 8

## Details
**Error:** TypeError: Cannot read property 'name' of undefined
**File:** src/app/projects/[id]/page.tsx
**Line:** 45

### Stack Trace
```
TypeError: Cannot read property 'name' of undefined
    at ProjectDetails (src/app/projects/[id]/page.tsx:45:23)
    at renderWithHooks (react-dom.development.js:14985:18)
    at mountIndeterminateComponent (react-dom.development.js:17811:13)
```

### Breadcrumbs
- User navigated to /projects
- User clicked on project "Sydney Metro Stage 2"
- API call GET /api/projects/abc123 succeeded
- Error occurred

### User Context
- Role: organiser
- Browser: Safari 17
- Device: iPhone 13

## My Observations
This seems to happen when the project's builder employer hasn't been assigned yet.
The API returns the project but with builder: null.

## Request
Please investigate this issue, identify the root cause, and implement a fix.
```

### Example: Reporting a PostHog Session Issue

```markdown
I found an issue in PostHog that needs investigation and fixing.

## Issue Summary
Mobile users can't submit the mapping form - the submit button appears cut off on iPhone.

## Source
- **Tool:** PostHog Session Replay
- **Session ID:** 018c7f2a-1234-5678-abcd-ef0123456789
- **Severity:** High
- **Users Affected:** Multiple (saw in 3 different sessions)

## Details
### Steps to Reproduce (from watching the session)
1. User went to /projects/abc123/mapping on iPhone
2. User scrolled down and filled in all form fields
3. User scrolled to bottom looking for submit button
4. Submit button was partially visible at bottom edge
5. User tapped the visible part but nothing happened
6. User scrolled up and down several times trying to find button
7. User gave up and left the page

### Expected Behavior
Submit button should be fully visible and tappable

### Actual Behavior
Button appears cut off at bottom of screen, tap doesn't register

### Screenshots/Timestamps
- At 1:23 - User reaches bottom of form
- At 1:25 - Button barely visible
- At 1:30 - User attempts to tap (no response)
- At 1:45 - User abandons form

### Device/Browser
- iPhone 13 Pro
- Safari 17.1
- iOS 17.2

## My Observations
This might be related to the safe area insets on iPhone not being applied correctly.
I've seen this on multiple iPhone users' sessions today.

## Request
Please investigate this issue, identify the root cause, and implement a fix.
```

---

## Part 4: Daily Monitoring Routine

### Morning Check (5 minutes)

1. **Sentry Quick Look**
   - Check **Issues** → sort by "Last Seen"
   - Look for any new errors in the last 24 hours
   - Note any errors with high occurrence counts

2. **PostHog Quick Look**
   - Check **Session Replay** → filter by last 24 hours
   - Scan for sessions with error events
   - Note any unusually short sessions (might indicate problems)

### Weekly Review (30 minutes)

1. **Sentry Trends**
   - Go to **Issues** → **Trends**
   - Look for errors that are increasing in frequency
   - Review any unresolved issues older than a week

2. **PostHog Analytics**
   - Check which pages have highest drop-off rates
   - Review average session duration trends
   - Look at most common user paths

3. **Create Issue List**
   - Compile a list of top 3-5 issues for the week
   - Prioritise by: user impact, frequency, severity
   - Report to Cursor agent for fixing

---

## Part 5: Troubleshooting the Monitoring Tools

### Sentry Not Receiving Errors

1. Check environment variables in Vercel:
   - `NEXT_PUBLIC_SENTRY_DSN` must be set
   - `SENTRY_DSN` must be set (same value)

2. Trigger a test error in browser console:
   ```javascript
   Sentry.captureException(new Error("Test error from console"));
   ```

3. Check browser DevTools Network tab for requests to `sentry.io`

### PostHog Not Recording Sessions

1. Check environment variables in Vercel:
   - `NEXT_PUBLIC_POSTHOG_KEY` must be set
   - `NEXT_PUBLIC_POSTHOG_HOST` must be set

2. Disable ad blocker and try in incognito window

3. Check PostHog project settings:
   - Session Recording must be enabled
   - Check recording quota

4. Verify in browser console:
   ```javascript
   posthog.sessionRecordingStarted?.()  // Should return true
   posthog.isFeatureEnabled('session-recording')
   ```

### Known Suppressed Warnings

Some warnings are intentionally suppressed because they come from third-party dependencies:

#### DEP0169: url.parse() Deprecation (JAVASCRIPT-NEXTJS-6)
- **Source**: `posthog-node@5.14.0` dependency
- **Status**: Suppressed via `NODE_OPTIONS='--no-warnings'`
- **Reason**: Third-party code, waiting for upstream fix
- **Action**: Monitor for posthog-node updates, test periodically
- **Documentation**: See `docs/DEPRECATION_WARNING_SUPPRESSION.md`

If you see this warning reappear in Sentry:
1. Verify `NODE_OPTIONS` environment variable is set in Vercel
2. Check if a new deployment removed the suppression
3. Refer to the suppression documentation for remediation steps

---

## Quick Shortcuts

### Sentry
- **All unresolved issues:** Issues → `is:unresolved`
- **Today's errors:** Issues → Last 24 hours filter
- **Specific user's errors:** Issues → Search `user.email:name@example.com`
- **Mobile-only errors:** Issues → Tag filter `device:Mobile`

### PostHog
- **Error sessions:** Session Replay → Filter by "error_occurred" event
- **Specific user:** Session Replay → Filter by Person → email
- **Mobile sessions:** Session Replay → Filter by Device → Mobile
- **Long sessions (confusion?):** Session Replay → Duration > 10 minutes

---

## Summary Checklist

When reporting an issue to Cursor agent, ensure you include:

- [ ] Clear issue summary (one sentence)
- [ ] Source (Sentry issue ID or PostHog session ID)
- [ ] Severity level
- [ ] Number of affected users
- [ ] Error details or steps to reproduce
- [ ] Device/browser information
- [ ] Your observations about possible cause
- [ ] Clear request for what you need (investigate, fix, explain)


