# Mobile Search Functionality Analysis Report

## Executive Summary

After comprehensive analysis of the mobile search functionality on the patch projects page, I've identified several critical issues causing the poor user experience. The main problems are related to React re-render cycles, URL parameter updates, and improper focus management on mobile devices.

## Detailed Flow Analysis

### 1. Search Input Event Flow

When a user types in the search field on mobile:

**Step 1: User Types Character**
```
Input onChange → setSearchInput() updates local state
```
- This updates `searchInput` state immediately
- Input remains focused at this point
- No re-render yet (React batches state updates)

**Step 2: Debounce Timer (300ms)**
```typescript
useEffect(() => {
  const handler = window.setTimeout(() => {
    // Save scroll position
    scrollPositionRef.current = window.pageYOffset

    // Check if search actually changed
    const currentParam = searchParams.get("q") || ""
    if (searchInput === currentParam) return

    // Trigger parent update
    onFiltersChange({ q: searchInput.length > 0 ? searchInput : undefined })
  }, 300)

  return () => window.clearTimeout(handler)
}, [searchInput, onFiltersChange, searchParams])
```

**Step 3: Parent Component Update**
```typescript
handleFiltersChange → setParams() → router.replace()
```
- Updates URL parameters using Next.js router
- This triggers a complete page re-render in Next.js App Router
- **CRITICAL ISSUE**: Page re-render causes scroll to reset to top

**Step 4: Scroll Restoration Attempt**
```typescript
if (isMobile) {
  requestAnimationFrame(() => {
    window.scrollTo(0, scrollPositionRef.current)
  })
}
```
- Tries to restore scroll position AFTER re-render
- **ISSUE**: This happens AFTER the visual jump, causing jarring UX

### 2. React Query Data Fetching

**Query Key:**
```typescript
queryKey: ['projects-server-side', params, workerEnabled]
```

**Process Flow:**
1. URL params change → React Query detects new query key
2. Immediately marks query as stale
3. Triggers API request to `/api/projects`
4. Shows loading state (projects array becomes empty)
5. API returns with filtered results
6. React Query updates data and re-renders

**ISSUE**: The loading state causes the projects list to flash empty between requests, which is especially noticeable on slower mobile connections.

### 3. Permission Checking (Row Level Security)

The API endpoint checks permissions:

```typescript
// In /api/projects/route.ts
const ALLOWED_ROLES = ['organiser', 'lead_organiser', 'admin']
```

**Potential Issues:**
- If user session expires mid-search, subsequent requests fail
- No client-side caching of permission failures
- Error handling might not be user-friendly on mobile

### 4. Mobile-Specific Issues Identified

#### 4.1 Focus Loss
- The `requestAnimationFrame` scroll restoration may cause iOS Safari to lose input focus
- iOS has aggressive focus management, especially during scroll/position changes
- The sticky header implementation might interfere with focus

#### 4.2 Keyboard Behavior
```css
/* In globals.css */
input, select, textarea {
  font-size: 16px !important;
}
```
- This prevents zoom but may affect focus behavior
- No explicit `autoFocus` or focus preservation logic

#### 4.3 Visual Viewport Issues
- iOS Safari's visual viewport shrinks when keyboard appears
- The scroll position calculations use `window.pageYOffset` which may not account for visual viewport changes
- Sticky positioning with visual viewport can cause jumping

#### 4.4 Component Re-mounting
The search input may be re-mounting due to:
- Key changes in parent component
- Conditional rendering based on mobile/desktop
- React key prop issues

### 5. Root Causes Analysis

#### 5.1 Primary Issue: Page Re-render on Every Keystroke
```
Type character → Debounce → URL update → Full page re-render → Scroll reset → Attempt restoration
```

This creates a "jumpy" experience because:
1. User is typing (focused on input)
2. Page suddenly re-renders (input loses context)
3. Scroll jumps to top
4. Scroll attempts to restore (but user has already lost their place)

#### 5.2 Secondary Issue: No Proper Focus Management
- No explicit focus preservation during re-renders
- iOS Safari's aggressive focus policies
- No consideration for visual viewport changes

#### 5.3 Tertiary Issue: Loading State Flash
- Empty projects list during loading
- No skeleton or preserved content during fetch
- Especially noticeable on slower mobile networks

### 6. The Search Results Problem

**Why Search Returns No Results:**

1. **Timing Issue**: If user types quickly:
   - First keystroke triggers search
   - Second keystroke arrives before first completes
   - React Query cancels first request
   - User sees empty results

2. **Permission Issue**:
   - Organiser permissions are patch-specific
   - If patch ID is not properly set or expired
   - API returns empty results with no error message

3. **Debounce Confusion**:
   - Local state `searchInput` might differ from URL param `q`
   - User sees they typed something but search is using old value

### 7. Key Technical Problems

#### 7.1 State Synchronization
```typescript
// Multiple sources of truth:
const [searchInput, setSearchInput] = useState(() => searchParams.get("q") || "")
const q = searchParams.get("q") || ""
```
This creates confusion about which value is the "source of truth".

#### 7.2 Scroll Restoration Race Condition
```typescript
// This happens AFTER the visual change
requestAnimationFrame(() => {
  window.scrollTo(0, scrollPositionRef.current)
})
```

#### 7.3 No Focus Preservation
There's no logic like:
```typescript
// Missing: Preserve focus during re-renders
useEffect(() => {
  if (searchInput && inputRef.current) {
    inputRef.current.focus()
  }
}, [searchParams])
```

### 8. Recommended Solutions

#### 8.1 Immediate Fixes
1. **Remove URL-based search state** - Use local state only, sync to URL on blur/submit
2. **Add explicit focus preservation**
3. **Preserve previous results during loading**
4. **Use React Transition for non-urgent updates**

#### 8.2 Better Architecture
1. **Implement proper search state management**
2. **Use React Query's placeholderData to preserve old results**
3. **Add debounced URL sync without re-renders**
4. **Implement proper mobile viewport handling**

### 9. Code Examples of Problems

#### Problem 1: Input Re-mounting
```tsx
// In PatchProjectsFilterBar.tsx
{isMobile ? (
  <Tabs>
    <TabsContent value="name">
      <Input ... /> // This re-mounts on every mobile check
    </TabsContent>
  </Tabs>
) : (
  <Input ... /> // Different instance
)}
```

#### Problem 2: No Focus Ref
```tsx
<Input
  // Missing: ref={inputRef}
  id="patch-project-search-mobile"
  // No focus preservation logic
/>
```

#### Problem 3: Aggressive Re-renders
```typescript
// This triggers on EVERY change
router.replace(next ? `${pathname}?${next}` : pathname)
```

### 10. Testing Recommendations

To verify these issues:
1. Add console.log to track input mount/unmount
2. Log scroll position changes
3. Monitor focus events
4. Check React Query dev tools for request cancellations
5. Test with slower network (3G) to see loading flashes

## Conclusion

The mobile search issues stem from:
1. **Architectural**: URL-based state management causing full re-renders
2. **Technical**: No focus preservation on mobile
3. **UX**: Poor loading states and scroll behavior
4. **Performance**: Aggressive re-mounting of components

The fix requires addressing the core state management approach rather than just visual tweaks. The current implementation treats mobile search the same as desktop, ignoring mobile-specific UX constraints.