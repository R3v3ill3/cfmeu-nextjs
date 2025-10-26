# Mobile Testing Setup for CFMEU Next.js Application

This document provides a comprehensive guide for mobile testing setup using Playwright with iPhone 13+ device emulation.

## 📱 Overview

The mobile testing infrastructure is designed to audit the CFMEU Next.js application across iPhone 13, iPhone 14, and iPhone 15 Pro series devices. It includes comprehensive test coverage for navigation, employer views, scan review workflows, authentication, and mobile-specific interactions.

## 🚀 Quick Start

### Prerequisites

1. **Node.js 18+** installed
2. **Playwright browsers** installed
3. **Development server** running on `http://localhost:3000`

### Installation

```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install

# Verify setup
npm run test:mobile:check-setup
```

### Running Tests

```bash
# Run all mobile tests
npm run test:mobile

# Run tests with visual browser (for debugging)
npm run test:mobile:headed

# Run tests for specific iPhone device
npm run test:mobile:iphone

# Run tests in debug mode
npm run test:mobile:debug
```

## 📋 Test Categories

### 1. Navigation Tests (`navigation.spec.ts`)
- Mobile menu functionality
- Touch target validation
- Navigation between routes
- Orientation change handling
- Performance testing
- Accessibility compliance

### 2. Employer Views Tests (`employer-views.spec.ts`)
- Employer listing display
- Search and filtering
- Employer detail views
- Alias management
- Responsive design
- Form interactions

### 3. Scan Review Workflow Tests (`scan-review-workflow.spec.ts`)
- Scan review interface
- Employer matching workflow
- Bulk operations
- Horizontal scrolling
- Swipe gestures
- Performance optimization

## 📱 Device Coverage

### iPhone 13 Series
- **iPhone 13**: 390×844px
- **iPhone 13 Pro**: 390×844px
- **iPhone 13 Pro Max**: 428×926px

### iPhone 14 Series
- **iPhone 14**: 390×844px
- **iPhone 14 Pro**: 393×852px
- **iPhone 14 Pro Max**: 430×932px

### iPhone 15 Series
- **iPhone 15**: 393×852px
- **iPhone 15 Plus**: 430×932px
- **iPhone 15 Pro**: 393×852px
- **iPhone 15 Pro Max**: 430×932px

## 🛠️ Testing Infrastructure

### Configuration Files

- **`playwright.mobile.config.ts`**: Main mobile testing configuration
- **`global-setup.ts`**: Test environment initialization
- **`global-teardown.ts`**: Test cleanup and report generation

### Helper Classes

#### MobileHelpers (`tests/mobile/helpers/mobile-helpers.ts`)
- Touch interactions (tap, swipe, pinch, long press)
- Touch target validation (44x44px minimum)
- Viewport overflow detection
- Network condition simulation
- Screenshot capture (portrait/landscape)
- Performance measurement
- Accessibility checking
- Orientation change handling
- Keyboard simulation

#### AuthHelpers (`tests/mobile/helpers/auth-helpers.ts`)
- Mobile-optimized login/logout
- Authentication token management
- MFA handling
- Password reset flow
- Registration testing

#### ReportingHelpers (`tests/mobile/helpers/reporting-helpers.ts`)
- Comprehensive issue tracking
- HTML/JSON/CSV report generation
- Performance metrics collection
- Accessibility reporting
- Recommendation generation

### Test Data Fixtures (`tests/mobile/fixtures/test-data.ts`)
- Test users and credentials
- Sample employers and projects
- Test scans and workflows
- Mobile breakpoints
- Network conditions
- Performance baselines

## 🧪 Running Specific Tests

### Navigation Tests
```bash
npm run test:mobile:navigation
```

### Employer Views Tests
```bash
npm run test:mobile:employers
```

### Scan Review Tests
```bash
npm run test:mobile:scan-review
```

### Full Audit
```bash
npm run test:mobile:audit
```

## 📊 Reporting and Analysis

### Test Results Location
```
test-results/
├── screenshots/          # Mobile screenshots (portrait/landscape)
├── videos/              # Test execution videos
├── traces/              # Performance traces
├── reports/             # Generated reports
│   ├── mobile-test-report.html
│   ├── mobile-test-report.json
│   └── mobile-test-report.csv
└── mobile-test-summary.json
```

### View Reports
```bash
# Open HTML report
npm run test:mobile:report

# View performance traces
npm run test:mobile:trace

# List screenshots
npm run test:mobile:screenshots
```

## 🔧 Configuration Options

### Custom Device Configuration

Add new devices to `playwright.mobile.config.ts`:

```typescript
{
  name: 'custom-iphone',
  use: {
    ...devices['iPhone 15'],
    // Custom configuration
    userAgent: 'Custom User Agent',
    viewport: { width: 390, height: 844 },
    // Additional settings
  },
  testMatch: '**/mobile/**/*.spec.ts',
}
```

### Network Conditions

Test different network speeds:

```typescript
await mobileHelpers.setNetworkConditions('slow3g');
await mobileHelpers.setNetworkConditions('fast3g');
await mobileHelpers.setNetworkConditions('offline');
await mobileHelpers.setNetworkConditions('online');
```

### Touch Interactions

```typescript
// Swipe gestures
await mobileHelpers.swipe({ direction: 'left' });
await mobileHelpers.swipe({ direction: 'up', distance: 100 });

// Pinch to zoom
await mobileHelpers.pinchOut(element, 1.5);

// Long press
await mobileHelpers.longPress(element, 1000);
```

## 🎯 Test Scenarios

### Core Functionality Testing
- ✅ Navigation and routing
- ✅ Authentication flows
- ✅ Data entry forms
- ✅ Search and filtering
- ✅ Modal dialogs
- ✅ Tables and data grids

### Mobile-Specific Testing
- ✅ Touch target sizes (minimum 44x44px)
- ✅ Viewport overflow detection
- ✅ Orientation changes
- ✅ Swipe gestures
- ✅ Pull-to-refresh
- ✅ Keyboard handling

### Performance Testing
- ✅ Load time measurement
- ✅ Interaction responsiveness
- ✅ Network condition simulation
- ✅ Virtual scrolling verification
- ✅ Asset loading optimization

### Accessibility Testing
- ✅ Color contrast validation
- ✅ Screen reader compatibility
- ✅ Keyboard navigation
- ✅ Form labels and descriptions
- ✅ Focus management

## 🐛 Troubleshooting

### Common Issues

1. **Tests fail with "Application not running"**
   - Ensure development server is running: `npm run dev`
   - Check if port 3000 is available

2. **Mobile devices not found**
   - Install Playwright browsers: `npx playwright install`
   - Check browser installation: `npx playwright install --dry-run`

3. **Touch interactions not working**
   - Verify element visibility before interaction
   - Use `await element.isVisible()` before tap operations
   - Check if element is not obscured by other elements

4. **Performance timeouts**
   - Increase timeout values in configuration
   - Check network conditions
   - Verify application performance under test

### Debug Mode

Run tests with debugging enabled:

```bash
# Debug specific test
npm run test:mobile:debug tests/mobile/audit/navigation.spec.ts

# Debug with specific device
npx playwright test --config=playwright.mobile.config.ts --project=iphone-15-pro --debug
```

### Visual Testing

```bash
# Run tests with visual browser
npm run test:mobile:headed

# Run on specific device with browser
npx playwright test --config=playwright.mobile.config.ts --project=iphone-14-pro --headed
```

## 📈 Best Practices

### Test Organization
- Group tests by feature/functionality
- Use descriptive test names
- Implement proper cleanup in teardown
- Use fixtures for test data

### Mobile Testing Guidelines
- Test on real device viewports
- Validate touch target sizes
- Test different orientations
- Simulate various network conditions
- Check for viewport overflow

### Performance Considerations
- Measure load times under different conditions
- Test with slow network connections
- Verify asset optimization
- Check for memory leaks

### Accessibility Requirements
- Minimum touch target: 44x44px
- Sufficient color contrast (4.5:1 for normal text)
- Proper form labels and descriptions
- Logical focus order
- Screen reader compatibility

## 🔍 Continuous Integration

### GitHub Actions Setup

```yaml
name: Mobile Tests
on: [push, pull_request]

jobs:
  mobile-tests:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:mobile
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: mobile-test-results
          path: test-results/
```

## 📞 Support

For questions or issues with the mobile testing setup:

1. Check the troubleshooting section above
2. Review the Playwright documentation: https://playwright.dev
3. Examine test results in the generated reports
4. Use debug mode to step through problematic tests

## 🔄 Updates and Maintenance

- Regularly update Playwright: `npm update @playwright/test`
- Keep browsers updated: `npx playwright install`
- Review and update test data as application evolves
- Monitor performance baselines and adjust as needed
- Add new device configurations as needed

---

This comprehensive mobile testing setup provides a solid foundation for auditing the CFMEU Next.js application across iPhone 13+ devices, ensuring optimal mobile user experience and accessibility compliance.