import { describe, it, expect, beforeEach, afterEach, vi } from '@jest/globals'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FourPointScaleSelector, FourPointRatingDisplay, FourPointScaleMobile } from '@/components/ui/FourPointScaleSelector'
import { FourPointRating } from '@/types/assessments'

// Mock haptic feedback hook
vi.mock('@/components/mobile/shared/HapticFeedback', () => ({
  useHapticFeedback: () => ({
    trigger: vi.fn()
  })
}))

describe('FourPointScaleSelector Component', () => {
  const mockOnChange = vi.fn()
  const user = userEvent.setup()

  beforeEach(() => {
    mockOnChange.mockClear()
  })

  describe('Basic Functionality', () => {
    it('should render all four rating options', () => {
      render(
        <FourPointScaleSelector
          value={undefined}
          onChange={mockOnChange}
        />
      )

      // Check for all rating labels
      expect(screen.getByText('Poor')).toBeInTheDocument()
      expect(screen.getByText('Fair')).toBeInTheDocument()
      expect(screen.getByText('Good')).toBeInTheDocument()
      expect(screen.getByText('Excellent')).toBeInTheDocument()

      // Check for rating badges
      expect(screen.getByText('1/4')).toBeInTheDocument()
      expect(screen.getByText('2/4')).toBeInTheDocument()
      expect(screen.getByText('3/4')).toBeInTheDocument()
      expect(screen.getByText('4/4')).toBeInTheDocument()
    })

    it('should call onChange when a rating is selected', async () => {
      render(
        <FourPointScaleSelector
          value={undefined}
          onChange={mockOnChange}
        />
      )

      const goodButton = screen.getByText('Good')
      await user.click(goodButton)

      expect(mockOnChange).toHaveBeenCalledWith(3)
      expect(mockOnChange).toHaveBeenCalledTimes(1)
    })

    it('should display the currently selected value', () => {
      render(
        <FourPointScaleSelector
          value={4}
          onChange={mockOnChange}
        />
      )

      // The selected button should be in a selected state (shadow and scale)
      const excellentButton = screen.getByText('Excellent')
      expect(excellentButton.closest('button')).toHaveClass('shadow-md', 'scale-105')
    })

    it('should show descriptions when variant is detailed', () => {
      render(
        <FourPointScaleSelector
          value={undefined}
          onChange={mockOnChange}
          variant="detailed"
        />
      )

      // Check for descriptions
      expect(screen.getByText('Significant issues require immediate attention')).toBeInTheDocument()
      expect(screen.getByText('Some areas need improvement')).toBeInTheDocument()
      expect(screen.getByText('Meets expectations consistently')).toBeInTheDocument()
      expect(screen.getByText('Exceeds expectations, sets best practice')).toBeInTheDocument()
    })

    it('should handle compact variant correctly', () => {
      render(
        <FourPointScaleSelector
          value={2}
          onChange={mockOnChange}
          variant="compact"
        />
      )

      // Should render buttons without cards
      expect(screen.getAllByRole('button')).toHaveLength(4)

      // Should not contain detailed descriptions
      expect(screen.queryByText('Significant issues require immediate attention')).not.toBeInTheDocument()
    })
  })

  describe('Visual Feedback and Interactions', () => {
    it('should show hover effects when mouse enters rating option', async () => {
      render(
        <FourPointScaleSelector
          value={undefined}
          onChange={mockOnChange}
        />
      )

      const goodButton = screen.getByText('Good')
      await user.hover(goodButton)

      // Button should have hover scale effect
      expect(goodButton.closest('button')).toHaveClass('scale-105')
    })

    it('should remove hover effects when mouse leaves', async () => {
      render(
        <FourPointScaleSelector
          value={undefined}
          onChange={mockOnChange}
        />
      )

      const goodButton = screen.getByText('Good')
      await user.hover(goodButton)
      await user.unhover(goodButton)

      // Wait for transition to complete
      await waitFor(() => {
        expect(goodButton.closest('button')).not.toHaveClass('scale-105')
      })
    })

    it('should apply color styling when showColors is true', () => {
      render(
        <FourPointScaleSelector
          value={4}
          onChange={mockOnChange}
          showColors={true}
        />
      )

      const excellentButton = screen.getByText('Excellent').closest('button')
      expect(excellentButton).toHaveStyle({
        backgroundColor: '#16a34a' // Excellent color
      })
    })

    it('should not apply color styling when showColors is false', () => {
      render(
        <FourPointScaleSelector
          value={4}
          onChange={mockOnChange}
          showColors={false}
        />
      )

      const excellentButton = screen.getByText('Excellent').closest('button')
      expect(excellentButton).not.toHaveStyle({
        backgroundColor: '#16a34a'
      })
    })
  })

  describe('Size Variations', () => {
    it('should render with small size', () => {
      render(
        <FourPointScaleSelector
          value={undefined}
          onChange={mockOnChange}
          size="sm"
        />
      )

      const buttons = screen.getAllByRole('button')
      buttons.forEach(button => {
        expect(button).toHaveClass('h-8', 'w-8', 'text-xs')
      })
    })

    it('should render with large size', () => {
      render(
        <FourPointScaleSelector
          value={undefined}
          onChange={mockOnChange}
          size="lg"
        />
      )

      const buttons = screen.getAllByRole('button')
      buttons.forEach(button => {
        expect(button).toHaveClass('h-16', 'w-16', 'text-2xl')
      })
    })

    it('should render with medium size by default', () => {
      render(
        <FourPointScaleSelector
          value={undefined}
          onChange={mockOnChange}
        />
      )

      const buttons = screen.getAllByRole('button')
      buttons.forEach(button => {
        expect(button).toHaveClass('h-12', 'w-12', 'text-sm')
      })
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      render(
        <FourPointScaleSelector
          value={3}
          onChange={mockOnChange}
        />
      )

      const buttons = screen.getAllByRole('button')
      expect(buttons).toHaveLength(4)

      // Each button should be focusable and have proper text content
      buttons.forEach(button => {
        expect(button).toHaveAttribute('type', 'button')
      })
    })

    it('should be keyboard navigable', async () => {
      render(
        <FourPointScaleSelector
          value={undefined}
          onChange={mockOnChange}
        />
      )

      const firstButton = screen.getAllByRole('button')[0]
      firstButton.focus()
      expect(firstButton).toHaveFocus()

      // Tab to next button
      await user.tab()
      const secondButton = screen.getAllByRole('button')[1]
      expect(secondButton).toHaveFocus()

      // Activate with Enter key
      await user.keyboard('{Enter}')
      expect(mockOnChange).toHaveBeenCalledWith(2)
    })

    it('should handle disabled state correctly', () => {
      render(
        <FourPointScaleSelector
          value={2}
          onChange={mockOnChange}
          disabled={true}
        />
      )

      const buttons = screen.getAllByRole('button')
      buttons.forEach(button => {
        expect(button).toBeDisabled()
        expect(button).toHaveClass('opacity-50', 'cursor-not-allowed')
      })
    })

    it('should have appropriate color contrast', () => {
      render(
        <FourPointScaleSelector
          value={4}
          onChange={mockOnChange}
          showColors={true}
        />
      )

      const excellentButton = screen.getByText('Excellent')
      const buttonElement = excellentButton.closest('button')

      // White text on colored background should have good contrast
      expect(buttonElement).toHaveClass('text-white')
    })
  })

  describe('Touch Interaction', () => {
    it('should handle touch events on mobile devices', async () => {
      render(
        <FourPointScaleSelector
          value={undefined}
          onChange={mockOnChange}
        />
      )

      const goodButton = screen.getByText('Good')

      // Simulate touch event
      fireEvent.touchStart(goodButton)
      fireEvent.touchEnd(goodButton)

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith(3)
      })
    })

    it('should not trigger onChange when disabled and touched', async () => {
      render(
        <FourPointScaleSelector
          value={undefined}
          onChange={mockOnChange}
          disabled={true}
        />
      )

      const goodButton = screen.getByText('Good')
      await user.click(goodButton)

      expect(mockOnChange).not.toHaveBeenCalled()
    })
  })

  describe('Form Integration', () => {
    it('should work with form validation', async () => {
      const Component = () => {
        const [value, setValue] = useState<FourPointRating | undefined>(undefined)
        const [error, setError] = useState<string>('')

        const handleChange = (newValue: FourPointRating) => {
          setValue(newValue)
          if (newValue < 2) {
            setError('Rating must be at least Fair')
          } else {
            setError('')
          }
        }

        return (
          <form>
            <FourPointScaleSelector value={value} onChange={handleChange} />
            {error && <span className="error">{error}</span>}
          </form>
        )
      }

      render(<Component />)

      // Select Poor rating
      const poorButton = screen.getByText('Poor')
      await user.click(poorButton)

      // Should show validation error
      expect(screen.getByText('Rating must be at least Fair')).toBeInTheDocument()

      // Select Good rating
      const goodButton = screen.getByText('Good')
      await user.click(goodButton)

      // Error should be cleared
      expect(screen.queryByText('Rating must be at least Fair')).not.toBeInTheDocument()
    })
  })
})

describe('FourPointRatingDisplay Component', () => {
  it('should display rating with label and description', () => {
    render(
      <FourPointRatingDisplay
        value={3}
        showLabel={true}
        showColor={true}
      />
    )

    expect(screen.getByText('Good')).toBeInTheDocument()
    expect(screen.getByText('3/4')).toBeInTheDocument()
    expect(screen.getByText('Meets expectations consistently')).toBeInTheDocument()
  })

  it('should hide label when showLabel is false', () => {
    render(
      <FourPointRatingDisplay
        value={3}
        showLabel={false}
        showColor={true}
      />
    )

    expect(screen.queryByText('Good')).not.toBeInTheDocument()
    expect(screen.queryByText('Meets expectations consistently')).not.toBeInTheDocument()
  })

  it('should apply correct colors when showColor is true', () => {
    render(
      <FourPointRatingDisplay
        value={4}
        showLabel={true}
        showColor={true}
      />
    )

    const colorContainer = screen.getByText('Excellent').closest('div').parentElement
    expect(colorContainer).toHaveStyle({
      backgroundColor: '#16a34a'
    })
  })

  it('should render with different sizes', () => {
    const { rerender } = render(
      <FourPointRatingDisplay value={3} size="sm" />
    )
    expect(screen.getByText('Good').closest('div').parentElement).toHaveClass('h-6', 'w-6', 'text-xs')

    rerender(<FourPointRatingDisplay value={3} size="lg" />)
    expect(screen.getByText('Good').closest('div').parentElement).toHaveClass('h-10', 'w-10', 'text-lg')
  })
})

describe('FourPointScaleMobile Component', () => {
  it('should render mobile-optimized layout', () => {
    render(
      <FourPointScaleMobile
        value={3}
        onChange={mockOnChange}
      />
    )

    // Should render in 2x2 grid for mobile
    const container = screen.getByText('Good').closest('div').parentElement
    expect(container).toHaveClass('grid', 'grid-cols-2')

    // Should have larger touch targets
    const buttons = screen.getAllByRole('button')
    buttons.forEach(button => {
      expect(button).toHaveClass('h-20')
    })
  })

  it('should handle mobile touch interactions', async () => {
    render(
      <FourPointScaleMobile
        value={undefined}
        onChange={mockOnChange}
      />
    )

    const excellentButton = screen.getByText('Excellent')
    await user.click(excellentButton)

    expect(mockOnChange).toHaveBeenCalledWith(4)
  })

  it('should show both label and score on mobile', () => {
    render(
      <FourPointScaleMobile
        value={4}
        onChange={mockOnChange}
      />
    )

    expect(screen.getByText('Excellent')).toBeInTheDocument()
    expect(screen.getByText('4/4')).toBeInTheDocument()
  })

  it('should apply visual feedback for selected state', () => {
    render(
      <FourPointScaleMobile
        value={3}
        onChange={mockOnChange}
      />
    )

    const goodButton = screen.getByText('Good').closest('button')
    expect(goodButton).toHaveClass('shadow-lg', 'scale-105')
    expect(goodButton).toHaveStyle({
      backgroundColor: '#84cc16' // Good color
    })
  })

  it('should handle disabled state on mobile', () => {
    render(
      <FourPointScaleMobile
        value={2}
        onChange={mockOnChange}
        disabled={true}
      />
    )

    const buttons = screen.getAllByRole('button')
    buttons.forEach(button => {
      expect(button).toBeDisabled()
    })
  })
})

describe('Component Integration', () => {
  it('should maintain consistency across all variants', () => {
    const variants = [
      { component: FourPointScaleSelector, props: { variant: 'default' } },
      { component: FourPointScaleSelector, props: { variant: 'compact' } },
      { component: FourPointScaleSelector, props: { variant: 'detailed' } },
      { component: FourPointScaleMobile, props: {} }
    ]

    variants.forEach(({ component: Component, props }) => {
      const { unmount } = render(
        <Component
          value={3}
          onChange={mockOnChange}
          {...props}
        />
      )

      // All variants should display the same core information
      expect(screen.getByText('Good')).toBeInTheDocument()

      unmount()
    })
  })

  it('should handle rapid value changes without errors', async () => {
    render(
      <FourPointScaleSelector
        value={undefined}
        onChange={mockOnChange}
      />
    )

    const buttons = screen.getAllByRole('button')

    // Rapidly click different values
    await user.click(buttons[0]) // Poor
    await user.click(buttons[1]) // Fair
    await user.click(buttons[2]) // Good
    await user.click(buttons[3]) // Excellent

    expect(mockOnChange).toHaveBeenCalledTimes(4)
    expect(mockOnChange).toHaveBeenLastCalledWith(4)
  })

  it('should cleanup properly on unmount', () => {
    const { unmount } = render(
      <FourPointScaleSelector
        value={2}
        onChange={mockOnChange}
      />
    )

    // Should not throw errors on unmount
    expect(() => unmount()).not.toThrow()
  })
})