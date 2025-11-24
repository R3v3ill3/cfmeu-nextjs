# Calendar Layout Fix - React Day Picker Mobile Alignment Issue

## Problem Description

On mobile devices, the calendar day header row (Su, Mo, Tu, We, Th, Fr, Sa) displayed incorrectly:
- **First day (Su)**: Horizontally centered over its date block
- **Other 6 days**: Clustered and offset to the right
- **Blank space**: Appeared under the clustered offset days, preventing the calendar date grid from rendering properly below them

This issue occurred specifically in the public audit & compliance webform on mobile devices, affecting both CBUS and INCOLINK date picker fields.

## Root Cause Analysis

### The Core Issue: Table Structure vs. Flex Layout Conflict

React Day Picker uses a **native HTML `<table>` structure** internally:
```html
<table>
  <thead>
    <tr>  <!-- This is head_row -->
      <th>Su</th>  <!-- These are head_cell -->
      <th>Mo</th>
      ...
    </tr>
  </thead>
  <tbody>
    <tr>  <!-- This is row -->
      <td>...</td>  <!-- These are cell -->
      ...
    </tr>
  </tbody>
</table>
```

### Why Initial Fixes Failed

**Attempt 1: Grid Layout**
```tsx
head_row: "grid grid-cols-7 gap-0"
```
**Why it failed**: CSS Grid cannot be directly applied to `<tr>` elements. Table rows (`<tr>`) have specific display behavior that doesn't support grid layout. The browser ignores or overrides grid properties on table rows.

**Attempt 2: Flex Without Proper Distribution**
```tsx
head_row: "flex"
head_cell: "w-9"  // Fixed width
```
**Why it failed**: 
- Flex containers without explicit distribution (`justify-between`, `justify-evenly`, or `flex-1` on children) default to `justify-start`
- Fixed-width children (`w-9`) in a flex container without proper distribution cause uneven spacing
- The first cell centers itself due to parent container centering (from `caption: "flex justify-center"`), while others cluster to the right

### The Real Problem

1. **Table elements resist flex/grid**: Native table elements (`<tr>`, `<th>`, `<td>`) have default display properties that conflict with modern layout techniques
2. **Missing flex distribution**: Even when using flex, cells need `flex-1` or explicit width distribution to share space equally
3. **CSS specificity**: React Day Picker's internal styles or browser defaults were overriding our custom classes
4. **Component-level classes insufficient**: Tailwind classes applied via `classNames` prop weren't strong enough to override table display behavior

## Effective Solution

### Multi-Layered Approach

The fix required **both component-level changes AND global CSS overrides**:

#### 1. Component-Level Changes (`src/components/ui/calendar.tsx`)

```tsx
classNames={{
  head_row: "flex w-full",  // Changed from "grid grid-cols-7"
  head_cell: "text-muted-foreground rounded-md font-normal text-[0.8rem] text-center flex-1 min-w-0",  // Added flex-1 min-w-0
  row: "flex w-full mt-2",
  cell: "h-9 flex-1 min-w-0 text-center text-sm p-0 relative ...",  // Changed from "w-9" to "flex-1 min-w-0"
  // ...
}}
```

**Key changes**:
- `head_row`: Use `flex w-full` instead of grid
- `head_cell`: Add `flex-1 min-w-0` for equal distribution
- `cell`: Change from fixed `w-9` to `flex-1 min-w-0` to match header

#### 2. Global CSS Override (`src/app/globals.css`)

```css
/* React Day Picker Calendar Fix - Mobile Day Header Alignment */
/* Force table rows to use flex layout for proper day header distribution */
/* Target both react-day-picker's default classes and our custom classNames */
table[role="grid"] thead tr,
table[role="grid"] tbody tr,
.rdp-table thead tr,
.rdp-table tbody tr {
  display: flex !important;
  width: 100% !important;
}

table[role="grid"] thead th,
table[role="grid"] tbody td,
.rdp-table thead th,
.rdp-table tbody td {
  flex: 1 1 0% !important;
  min-width: 0 !important;
}

/* Ensure day header cells are centered and evenly distributed */
table[role="grid"] thead th,
.rdp-table thead th {
  text-align: center !important;
}
```

**Why this works**:
- `display: flex !important`: Forces table rows to use flex layout, overriding browser defaults
- `flex: 1 1 0% !important`: Ensures all cells get equal width distribution
- `min-width: 0`: Prevents flex items from maintaining minimum content width
- Multiple selectors: Catches react-day-picker's rendered structure regardless of class names
- `!important`: Overrides any conflicting styles from the library or browser defaults

## Key Learnings

### 1. Table Elements Require Special Handling

**Problem**: Native HTML table elements (`<table>`, `<tr>`, `<th>`, `<td>`) have default display properties that resist modern layout techniques.

**Solution**: Use `display: flex !important` or `display: grid !important` with `!important` to force the layout change.

### 2. Flex Distribution is Critical

**Problem**: Flex containers without proper distribution cause uneven spacing.

**Solution**: Always use one of:
- `flex-1` on children for equal distribution
- `justify-between` / `justify-evenly` / `justify-around` on container
- Explicit widths with `flex-basis`

### 3. Component Classes + Global CSS

**Problem**: Component-level Tailwind classes may not be sufficient for overriding library defaults.

**Solution**: Combine component-level classes with global CSS overrides using `!important` when dealing with third-party libraries.

### 4. Mobile-Specific Issues

**Problem**: Layout issues may only appear on mobile due to:
- Different viewport constraints
- Touch target requirements affecting spacing
- Mobile browser rendering differences

**Solution**: Always test on actual mobile devices, not just browser dev tools.

### 5. Library-Specific Considerations

**Problem**: React Day Picker uses a table structure internally, which conflicts with modern flex/grid layouts.

**Solution**: 
- Inspect the rendered HTML to understand the actual structure
- Use multiple CSS selectors to catch different class name patterns
- Use `!important` sparingly but effectively when dealing with library overrides

## Testing Checklist

After applying this fix, verify:

- [ ] All 7 day headers (Su, Mo, Tu, We, Th, Fr, Sa) are evenly distributed
- [ ] No centering of the first day
- [ ] Days align properly with calendar grid below
- [ ] Works on both CBUS and INCOLINK date pickers
- [ ] Calendar displays correctly in Popover on mobile
- [ ] Works in both portrait and landscape orientations
- [ ] No blank space under day headers
- [ ] Calendar date grid renders properly below headers

## Prevention Strategies

1. **When using table-based libraries**: Always check if they use native `<table>` elements
2. **For flex layouts**: Always specify distribution (`flex-1`, `justify-*`, etc.)
3. **For third-party components**: Be prepared to use global CSS overrides with `!important`
4. **Mobile testing**: Test on actual devices, especially for layout-sensitive components
5. **Documentation**: Document layout fixes for future reference (like this file!)

## Related Files

- `src/components/ui/calendar.tsx` - Calendar component with classNames
- `src/app/globals.css` - Global CSS overrides for react-day-picker
- `src/components/public/AssessmentFormFields.tsx` - Usage of Calendar component in date pickers

## References

- React Day Picker documentation: https://react-day-picker.js.org/
- CSS Table Display: https://developer.mozilla.org/en-US/docs/Web/CSS/display#table
- Flexbox Layout: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Flexible_Box_Layout



