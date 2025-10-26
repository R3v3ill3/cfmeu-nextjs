"use client"

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { Input } from '@/components/ui/input'
import { useMobileKeyboard } from '@/hooks/useMobileKeyboard'
import { GoogleAddressInput } from '@/components/projects/GoogleAddressInput'
import '@testing-library/jest-dom'

// Mock window methods for mobile detection
Object.defineProperty(window, 'ontouchstart', {
  writable: true,
  value: true,
})

// Mock navigator.geolocation
const mockGeolocation = {
  getCurrentPosition: jest.fn(),
  watchPosition: jest.fn(),
  clearWatch: jest.fn(),
}
Object.defineProperty(navigator, 'geolocation', {
  value: mockGeolocation,
  writable: true,
})

// Mock Google Maps
const mockGoogleMaps = {
  maps: {
    places: {
      Autocomplete: jest.fn(),
    },
    Geocoder: jest.fn(),
  },
}
Object.defineProperty(window, 'google', {
  value: mockGoogleMaps,
  writable: true,
})

describe('Mobile Keyboard Optimization', () => {
  beforeEach(() => {
    // Reset window.innerHeight for keyboard detection
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 800,
    })

    // Mock scrollTo
    window.scrollTo = jest.fn()

    // Mock getComputedStyle for safe area insets
    Object.defineProperty(window, 'getComputedStyle', {
      value: jest.fn(() => ({
        getPropertyValue: jest.fn(() => '0px'),
      })),
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Input Component Mobile Optimization', () => {
    it('should apply mobile-specific inputMode for different types', () => {
      render(<Input type="email" mobileOptimization={true} />)
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('inputmode', 'email')
    })

    it('should apply appropriate autoComplete attributes', () => {
      render(<Input name="email" type="email" mobileOptimization={true} />)
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('autocomplete', 'email')
    })

    it('should set spellcheck and autocapitalize correctly for email inputs', () => {
      render(<Input type="email" mobileOptimization={true} />)
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('spellcheck', 'false')
      expect(input).toHaveAttribute('autocapitalize', 'none')
    })

    it('should set appropriate enterKeyHint', () => {
      render(<Input type="search" mobileOptimization={true} />)
      const input = screen.getByRole('searchbox')
      expect(input).toHaveAttribute('enterkeyhint', 'search')
    })

    it('should use pattern for Australian phone numbers', () => {
      render(<Input name="phone-australia" type="tel" mobileOptimization={true} />)
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('pattern', '^0[2-9]\\d{8}$|\\+61[2-9]\\d{8}$')
    })

    it('should use decimal inputMode for number inputs', () => {
      render(<Input type="number" mobileOptimization={true} />)
      const input = screen.getByRole('spinbutton')
      expect(input).toHaveAttribute('inputmode', 'decimal')
    })

    it('should have 44x44px minimum touch targets on mobile', () => {
      render(<Input mobileOptimization={true} />)
      const input = screen.getByRole('textbox')
      const styles = window.getComputedStyle(input)

      // Check that mobile classes are applied
      expect(input).toHaveClass('max-lg:min-h-[44px]', 'max-lg:px-4', 'max-lg:py-3', 'max-lg:text-base')
    })
  })

  describe('useMobileKeyboard Hook', () => {
    let MobileKeyboardTestComponent: React.FC

    beforeEach(() => {
      MobileKeyboardTestComponent = () => {
        const { keyboardState, scrollToInput, dismissKeyboard, isInputVisible } = useMobileKeyboard()

        return (
          <div>
            <div data-testid="keyboard-visible">{keyboardState.isVisible ? 'visible' : 'hidden'}</div>
            <div data-testid="keyboard-height">{keyboardState.height}</div>
            <button onClick={() => scrollToInput(document.createElement('input'))}>
              Scroll to input
            </button>
            <button onClick={dismissKeyboard}>Dismiss keyboard</button>
          </div>
        )
      }
    })

    it('should initialize with keyboard hidden', () => {
      render(<MobileKeyboardTestComponent />)

      expect(screen.getByTestId('keyboard-visible')).toHaveTextContent('hidden')
      expect(screen.getByTestId('keyboard-height')).toHaveTextContent('0')
    })

    it('should detect keyboard appearance', async () => {
      render(<MobileKeyboardTestComponent />)

      // Simulate keyboard appearance by changing viewport height
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 600, // 200px difference suggests keyboard
      })

      // Trigger resize event
      fireEvent(window, new Event('resize'))

      await waitFor(() => {
        expect(screen.getByTestId('keyboard-visible')).toHaveTextContent('visible')
        expect(screen.getByTestId('keyboard-height')).toHaveTextContent('200')
      })
    })

    it('should call scrollTo when scrollToInput is triggered', async () => {
      render(<MobileKeyboardTestComponent />)

      const button = screen.getByText('Scroll to input')
      fireEvent.click(button)

      await waitFor(() => {
        expect(window.scrollTo).toHaveBeenCalled()
      })
    })

    it('should dismiss keyboard when dismissKeyboard is called', async () => {
      // Create a mock focused input
      const mockInput = document.createElement('input')
      mockInput.focus = jest.fn()
      mockInput.blur = jest.fn()
      document.body.appendChild(mockInput)
      mockInput.focus()

      render(<MobileKeyboardTestComponent />)

      const button = screen.getByText('Dismiss keyboard')
      fireEvent.click(button)

      await waitFor(() => {
        expect(mockInput.blur).toHaveBeenCalled()
      })

      // Clean up
      document.body.removeChild(mockInput)
    })
  })

  describe('GoogleAddressInput Mobile Features', () => {
    beforeEach(() => {
      // Mock successful geolocation
      mockGeolocation.getCurrentPosition.mockImplementation((success) => {
        success({
          coords: {
            latitude: -33.8688,
            longitude: 151.2093,
          },
        })
      })

      // Mock Google Maps Geocoder
      mockGoogleMaps.maps.Geocoder.mockImplementation(() => ({
        geocode: jest.fn((request, callback) => {
          callback(
            [
              {
                formatted_address: '123 Main St, Sydney NSW 2000, Australia',
                address_components: [
                  { types: ['street_number'], long_name: '123' },
                  { types: ['route'], long_name: 'Main St' },
                  { types: ['locality'], long_name: 'Sydney' },
                  { types: ['administrative_area_level_1'], long_name: 'NSW' },
                  { types: ['postal_code'], long_name: '2000' },
                  { types: ['country'], long_name: 'Australia' },
                ],
                place_id: 'test_place_id',
                geometry: {
                  location: {
                    lat: () => -33.8688,
                    lng: () => 151.2093,
                  },
                },
              },
            ],
            'OK'
          )
        }),
      }))
    })

    it('should render geolocation button on touch devices', () => {
      render(
        <GoogleAddressInput
          value=""
          onChange={jest.fn()}
          enableGeolocation={true}
        />
      )

      // Geolocation button should be present on touch devices
      expect(screen.getByTitle('Use current location')).toBeInTheDocument()
    })

    it('should handle geolocation request', async () => {
      const mockOnChange = jest.fn()

      render(
        <GoogleAddressInput
          value=""
          onChange={mockOnChange}
          enableGeolocation={true}
        />
      )

      const geoButton = screen.getByTitle('Use current location')
      fireEvent.click(geoButton)

      await waitFor(() => {
        expect(mockGeolocation.getCurrentPosition).toHaveBeenCalledWith(
          expect.any(Function),
          expect.any(Function),
          expect.objectContaining({
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 300000,
          })
        )
      })
    })

    it('should apply mobile optimization to address input', () => {
      render(
        <GoogleAddressInput
          value=""
          onChange={jest.fn()}
          enableGeolocation={true}
        />
      )

      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('autocomplete', 'street-address')
      expect(input).toHaveAttribute('name', 'street-address')
      expect(input).toHaveAttribute('mobileoptimization', 'true')
    })

    it('should show loading state while getting location', async () => {
      // Make geolocation take time
      mockGeolocation.getCurrentPosition.mockImplementation(() => {
        // Don't call success/failure immediately
      })

      render(
        <GoogleAddressInput
          value=""
          onChange={jest.fn()}
          enableGeolocation={true}
        />
      )

      const geoButton = screen.getByTitle('Use current location')
      fireEvent.click(geoButton)

      // Should show loading spinner
      expect(screen.getByText('Use current location')).toBeInTheDocument()
      expect(geoButton).toBeDisabled()
    })
  })

  describe('Keyboard Overlap Prevention', () => {
    it('should ensure inputs are visible when keyboard appears', async () => {
      render(
        <div style={{ height: '2000px' }}>
          <Input
            data-testid="bottom-input"
            style={{ marginTop: '1500px' }}
            mobileOptimization={true}
          />
        </div>
      )

      const input = screen.getByTestId('bottom-input')

      // Focus the input (triggers keyboard)
      fireEvent.focus(input)

      // Simulate keyboard appearance
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 400,
      })

      fireEvent(window, new Event('resize'))

      await waitFor(() => {
        // Should scroll to make input visible
        expect(window.scrollTo).toHaveBeenCalledWith({
          top: expect.any(Number),
          behavior: 'smooth',
        })
      })
    })

    it('should dismiss keyboard on scroll if enabled', async () => {
      const TestComponent = () => {
        const { dismissKeyboard } = useMobileKeyboard({
          enableDismissOnScroll: true,
        })

        return (
          <button onClick={dismissKeyboard}>Dismiss on scroll test</button>
        )
      }

      render(<TestComponent />)

      // Simulate keyboard visibility
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 600,
      })

      fireEvent(window, new Event('resize'))
      fireEvent(window, new Event('scroll'))

      // Should dismiss keyboard on scroll
      const button = screen.getByText('Dismiss on scroll test')
      fireEvent.click(button)
    })
  })

  describe('Form Validation Timing', () => {
    it('should validate inputs on blur with proper timing', async () => {
      const mockOnChange = jest.fn()

      render(
        <GoogleAddressInput
          value=""
          onChange={mockOnChange}
          requireSelection={true}
        />
      )

      const input = screen.getByRole('textbox')

      // Focus and blur the input
      fireEvent.focus(input)
      fireEvent.blur(input)

      // Wait for delayed validation
      await waitFor(
        () => {
          expect(mockOnChange).toHaveBeenCalledWith(
            expect.objectContaining({ formatted: '' }),
            expect.any(Object)
          )
        },
        { timeout: 1000 }
      )
    })

    it('should not validate immediately during typing', () => {
      const mockOnChange = jest.fn()

      render(
        <GoogleAddressInput
          value=""
          onChange={mockOnChange}
          requireSelection={true}
        />
      )

      const input = screen.getByRole('textbox')

      // Type in the input
      fireEvent.change(input, { target: { value: '123' } })

      // Should not validate immediately during typing
      expect(mockOnChange).toHaveBeenCalledTimes(1) // Only for the change, not validation
    })
  })
})