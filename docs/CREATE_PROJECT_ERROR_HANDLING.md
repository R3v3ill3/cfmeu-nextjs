# CreateProjectDialog - Comprehensive Error Handling Implementation

## Overview
This document details the comprehensive error handling added to the CreateProjectDialog component to improve user experience during project creation - a critical user workflow.

## File Modified
- **Path**: `/Volumes/DataDrive/cursor_repos/cfmeu-nextjs/src/components/projects/CreateProjectDialog.tsx`

## Error Scenarios Handled

### 1. Form Validation Errors

#### Required Fields
- **Project Name**:
  - Required field validation
  - Minimum 3 characters
  - Maximum 200 characters
  - Error: "Project name is required" / "Project name must be at least 3 characters"

- **Main Job Site Address**:
  - Required field validation
  - Must be selected from Google Autocomplete (with place_id)
  - Integrated with GoogleAddressInput validation
  - Error: "Main job site address is required"

#### Email Validation
- **ROE Email** (optional field):
  - Regex validation: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
  - Only validates if user enters a value
  - Error: "Please enter a valid email address"

#### Date Validation
- **Proposed Start/Finish Dates**:
  - Cross-field validation: finish date must be after start date
  - Error: "Finish date must be after start date"

#### Numeric Validation
- **Project Value**:
  - Must be a positive number
  - Maximum value check (10 billion) to catch unrealistic inputs
  - Error: "Project value must be a positive number" / "Project value seems unusually high - please verify"

- **State Funding**:
  - Must be a positive number
  - Error: "State funding must be a positive number"

- **Federal Funding**:
  - Must be a positive number
  - Error: "Federal funding must be a positive number"

### 2. Database/API Errors

#### Project Creation Errors
- **Duplicate Project (23505)**: "A project with this name already exists. Please use a different name."
- **Invalid Builder Reference (23503)**: "Invalid builder selected. Please choose a different builder or leave it empty."
- **Permission Error (PGRST116)**: "Unable to create project. Please check your permissions."
- **Permission Error (general)**: "You don't have permission to create projects. Please contact an administrator."
- **Generic Error**: "Failed to create project: [error message]"

#### Job Site Creation Errors
- Automatic cleanup: If job site creation fails, the partially created project is deleted
- Error: "Failed to create job site: [error message]"

#### Job Site Linking Errors
- Error: "Failed to link job site: [error message]"

#### Optional Operations (Non-Critical)
- **Builder Assignment**: Failures are logged but don't stop project creation
- **JV Status Update**: Failures are logged but don't stop project creation

### 3. Network Errors
- Detection of fetch/network errors
- User-friendly message: "Network error. Please check your connection and try again."

### 4. Navigation Errors
- Graceful handling if redirect fails after successful creation
- Message: "Project created but failed to navigate. Please refresh the page."

## User Experience Improvements

### 1. Inline Field Validation
- Errors appear directly below the relevant field
- Red border highlights fields with errors
- AlertCircle icon prefixes error messages
- Errors clear automatically when user starts typing

### 2. Alert Banners
- **General Error Alert**: Displays at top of form for system-level errors (red/destructive variant)
- **Success Alert**: Shows green confirmation message during redirect

### 3. Loading States
- Submit button shows "Creating..." with spinner animation during submission
- All form fields disabled during submission to prevent changes
- Back button disabled during submission

### 4. Success Feedback
- Toast notification: "Project created successfully! Redirecting to project page..."
- Green success alert in dialog
- 1-second delay before redirect to show success state
- Form data preserved until successful redirect

### 5. Error Feedback
- Toast notification with error details (5-second duration)
- Inline field errors for validation issues
- General error alert for system errors
- Console logging for debugging

## Implementation Details

### State Management
```typescript
// Error state
const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
const [showSuccess, setShowSuccess] = useState(false);
const [addressValidationError, setAddressValidationError] = useState<AddressValidationError | null>(null);

// ValidationErrors type
type ValidationErrors = {
  name?: string;
  address?: string;
  value?: string;
  start?: string;
  finish?: string;
  roeEmail?: string;
  stateFunding?: string;
  federalFunding?: string;
  general?: string;
}
```

### Validation Function
```typescript
const validateForm = (): boolean => {
  const errors: ValidationErrors = {};

  // Validation logic for all fields
  // Returns true if no errors, false otherwise

  setValidationErrors(errors);
  return Object.keys(errors).length === 0;
};
```

### Error Clearing
```typescript
const clearFieldError = (field: keyof ValidationErrors) => {
  if (validationErrors[field]) {
    setValidationErrors(prev => {
      const updated = { ...prev };
      delete updated[field];
      return updated;
    });
  }
};
```

### Mutation Error Handling
```typescript
const createMutation = useMutation({
  mutationFn: async () => {
    // Validate before submission
    if (!validateForm()) {
      throw new Error("Please fix the validation errors before submitting");
    }

    try {
      // Project creation logic with specific error handling
      // ...
    } catch (error: any) {
      // Network error detection
      if (error.message?.includes('fetch') || error.message?.includes('network')) {
        throw new Error("Network error. Please check your connection and try again.");
      }
      throw error;
    }
  },
  onSuccess: (id) => {
    // Success handling with delayed redirect
  },
  onError: (error: any) => {
    // Set form error and show toast
  }
});
```

## Testing Recommendations

### 1. Validation Testing
- [ ] Submit form with empty required fields (name, address)
- [ ] Enter project name < 3 characters
- [ ] Enter project name > 200 characters
- [ ] Enter invalid email format
- [ ] Enter finish date before start date
- [ ] Enter negative project value
- [ ] Enter extremely high project value (> 10 billion)
- [ ] Enter negative funding amounts

### 2. User Interaction Testing
- [ ] Verify errors clear when user starts typing in field
- [ ] Verify submit button is disabled when form is invalid
- [ ] Verify all fields are disabled during submission
- [ ] Verify back button is disabled during submission
- [ ] Verify success message appears before redirect
- [ ] Verify form data is not lost on validation errors

### 3. API Error Testing
- [ ] Test with duplicate project name (if possible)
- [ ] Test with invalid builder ID
- [ ] Test without proper permissions (as non-admin user)
- [ ] Test with network disconnected
- [ ] Test job site creation failure scenario

### 4. Edge Cases
- [ ] Test rapid clicking of submit button
- [ ] Test closing dialog during submission
- [ ] Test with very long address
- [ ] Test with special characters in project name
- [ ] Test builder assignment failure (should not block creation)
- [ ] Test JV status update failure (should not block creation)

### 5. Accessibility Testing
- [ ] Verify error messages are announced to screen readers
- [ ] Verify keyboard navigation works with errors present
- [ ] Verify color contrast for error messages
- [ ] Verify focus management after validation errors

## Error Message Examples

### User-Facing Messages
- "Project name is required"
- "Please enter a valid email address"
- "Finish date must be after start date"
- "A project with this name already exists. Please use a different name."
- "Network error. Please check your connection and try again."
- "Project created successfully! Redirecting to project page..."

### Technical Messages (Console)
- "Project creation error: [detailed error]"
- "Failed to assign builder role: [error]"
- "Navigation error: [error]"

## Benefits

1. **Better UX**: Clear, actionable error messages help users fix issues quickly
2. **Data Preservation**: Form data is never lost due to validation or API errors
3. **Graceful Degradation**: Optional operations (builder, JV) don't block project creation
4. **Developer-Friendly**: Comprehensive console logging for debugging
5. **Accessibility**: Screen reader support with proper ARIA labels and alerts
6. **Performance**: Inline validation prevents unnecessary API calls
7. **Reliability**: Transaction-like behavior with cleanup on failure

## Related Components

- **GoogleAddressInput**: Provides address validation and error handling
- **DateInput**: Date field component
- **Alert/AlertDescription**: UI components for displaying errors
- **SingleEmployerDialogPicker**: Builder selection component
- **JVSelector**: Joint venture selection component

## Future Improvements

1. Add rate limiting feedback if too many requests
2. Add retry mechanism for network errors
3. Add ability to save draft projects
4. Add validation summary at top of form
5. Add field-level help text for complex fields
6. Add optimistic UI updates
7. Add analytics tracking for error types
