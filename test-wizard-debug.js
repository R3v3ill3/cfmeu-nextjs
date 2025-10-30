// Test script to verify wizard navigation and functionality
// This script can be run in the browser console to debug issues

function testWizardNavigation() {
  console.log('=== Testing Wizard Navigation ===');

  // Find the wizard element
  const wizard = document.querySelector('[data-testid="rating-wizard"]');
  if (!wizard) {
    console.log('Wizard not found');
    return;
  }

  // Find navigation buttons
  const nextButton = document.querySelector('button[type="submit"], button:contains("Next")');
  const prevButton = document.querySelector('button:contains("Previous")');
  const submitButton = document.querySelector('button:contains("Submit")');

  console.log('Navigation buttons found:', {
    next: !!nextButton,
    previous: !!prevButton,
    submit: !!submitButton
  });

  // Check button states
  if (nextButton) {
    console.log('Next button disabled:', nextButton.disabled);
    console.log('Next button visible:',
      nextButton.offsetParent !== null &&
      nextButton.offsetHeight > 0
    );
  }

  // Find radio buttons
  const radioButtons = document.querySelectorAll('input[type="radio"]');
  console.log('Radio buttons found:', radioButtons.length);

  // Check if form data is being set correctly
  const formElements = document.querySelectorAll('input[name], textarea[name], select[name]');
  const formData = {};
  formElements.forEach(element => {
    if (element.type === 'radio') {
      if (element.checked) {
        formData[element.name] = element.value;
      }
    } else {
      formData[element.name] = element.value;
    }
  });

  console.log('Form data:', formData);

  // Check for validation errors
  const errorElements = document.querySelectorAll('[role="alert"], .text-destructive');
  console.log('Validation errors:', errorElements.length);

  return {
    wizard: !!wizard,
    buttons: { next: !!nextButton, previous: !!prevButton, submit: !!submitButton },
    radioButtons: radioButtons.length,
    formData,
    errors: errorElements.length
  };
}

// Test function to check modal visibility
function testModalVisibility() {
  const modal = document.querySelector('[role="dialog"]');
  if (!modal) {
    console.log('Modal not found');
    return false;
  }

  const isVisible = modal.offsetParent !== null &&
                   modal.offsetHeight > 0 &&
                   !modal.classList.contains('hidden');

  console.log('Modal visible:', isVisible);
  console.log('Modal styles:', {
    display: getComputedStyle(modal).display,
    visibility: getComputedStyle(modal).visibility,
    opacity: getComputedStyle(modal).opacity,
    zIndex: getComputedStyle(modal).zIndex
  });

  return isVisible;
}

// Run tests
console.log('Starting wizard debug tests...');
testModalVisibility();
testWizardNavigation();