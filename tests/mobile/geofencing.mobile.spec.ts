import { test, expect } from '@playwright/test'

const MOCK_COORDS = { latitude: -33.865143, longitude: 151.2099 }
const MOCK_SITES = [
  {
    id: 'test-site-1',
    name: 'Mock Site',
    project_id: 'project-1',
    project_name: 'Mock Project',
    latitude: MOCK_COORDS.latitude,
    longitude: MOCK_COORDS.longitude,
  },
]

test.describe('Mobile geofencing foreground reminders', () => {
  test('shows nearby site reminders while the settings page is open', async ({ page, context }) => {
    await context.grantPermissions(['geolocation'])

    await page.addInitScript(({ coords, sites }) => {
      const position = {
        coords: {
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: 5,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      }

      Object.defineProperty(navigator, 'geolocation', {
        value: {
          getCurrentPosition: (success: any) => success({ ...position }),
          watchPosition: (success: any) => {
            const id = Math.floor(Math.random() * 10_000)
            setTimeout(() => success({ ...position, timestamp: Date.now() }), 50)
            return id
          },
          clearWatch: () => undefined,
        },
        configurable: true,
      })

      window.__GEOFENCE_TEST_SITES = sites
    }, { coords: MOCK_COORDS, sites: MOCK_SITES })

    await page.goto('/settings')
    if ((await page.url()).includes('/login')) {
      test.skip('Settings page requires authentication')
    }

    const toggle = page.getByTestId('geofencing-toggle')
    await toggle.click()

    await expect(page.getByText('Geofencing enabled')).toBeVisible()
    await expect(page.getByText('Mock Site')).toBeVisible()

    const pendingVisit = await page.evaluate(() => sessionStorage.getItem('pendingSiteVisit'))
    expect(pendingVisit).toContain('"job_site_id":"test-site-1"')
  })
})

