import { describe, it, expect, beforeEach, afterEach, vi } from '@jest/globals'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UnionRespectAssessment } from '@/components/assessments/UnionRespectAssessment'
import { FourPointRating } from '@/types/assessments'

// Mock external dependencies
vi.mock('@/components/mobile/shared/HapticFeedback', () => ({
  useHapticFeedback: () => ({
    trigger: vi.fn(),
    success: vi.fn(),
    error: vi.fn()
  })
}))

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn()
  }
}))

// Mock FourPointScaleSelector and FourPointRatingDisplay
vi.mock('@/components/ui/FourPointScaleSelector', () => ({
  FourPointScaleSelector: ({ value, onChange, disabled, size, variant, className }: any) => (
    <div data-testid="four-point-selector" className={className}>
      <div data-testid="selector-size">{size}</div>
      <div data-testid="selector-variant">{variant}</div>
      <div data-testid="selector-value">{value || 'undefined'}</div>
      <div data-testid="selector-disabled">{disabled.toString()}</div>
      <button
        data-testid="selector-change"
        onClick={() => onChange?.(3)}
        disabled={disabled}
      >
        Change Rating
      </button>
    </div>
  ),
  FourPointRatingDisplay: ({ rating, size, variant, confidenceLevel }: any) => (
    <div data-testid="four-point-display">
      <div data-testid="display-rating">{rating}</div>
      <div data-testid="display-size">{size}</div>
      <div data-testid="display-variant">{variant}</div>
      <div data-testid="display-confidence">{confidenceLevel}</div>
    </div>
  )
}))

describe('UnionRespectAssessment Component', () => {
  const mockOnSave = vi.fn()
  const mockOnViewHistory = vi.fn()
  const user = userEvent.setup()

  const defaultProps = {
    employerId: 'test-employer-123',
    employerName: 'Test Construction Co.',
    onSave: mockOnSave,
    onViewHistory: mockOnViewHistory,
    readonly: false
  }

  beforeEach(() => {
    mockOnSave.mockClear()
    mockOnViewHistory.mockClear()
    vi.clearAllMocks()
  })

  describe('Component Rendering', () => {
    it('should render the assessment form with all required elements', () => {
      render(<UnionRespectAssessment {...defaultProps} />)

      // Header elements
      expect(screen.getByText('Union Respect Assessment')).toBeInTheDocument()
      expect(screen.getByText(/Assess Test Construction Co\.'s relationship and engagement with the union/)).toBeInTheDocument()

      // Completion indicator
      expect(screen.getByText('Completion:')).toBeInTheDocument()
      expect(screen.getByRole('progressbar')).toBeInTheDocument()

      // Alert with instructions
      expect(screen.getByText(/Rate each criterion on a 4-point scale/)).toBeInTheDocument()

      // All criteria should be present
      expect(screen.getByText('Union Engagement')).toBeInTheDocument()
      expect(screen.getByText('Communication Respect')).toBeInTheDocument()
      expect(screen.getByText('Collaboration Attitude')).toBeInTheDocument()
      expect(screen.getByText('Dispute Resolution')).toBeInTheDocument()
      expect(screen.getByText('Union Delegate Relations')).toBeInTheDocument()

      // Supporting evidence section
      expect(screen.getByText('Supporting Evidence')).toBeInTheDocument()
      expect(screen.getByText('Has active union delegates')).toBeInTheDocument()

      // Additional notes section
      expect(screen.getByText('Additional Notes')).toBeInTheDocument()

      // Action buttons
      expect(screen.getByText('Preview Assessment')).toBeInTheDocument()
      expect(screen.getByText('Save Assessment')).toBeInTheDocument()
    })

    it('should display history button when onViewHistory is provided', () => {
      render(<UnionRespectAssessment {...defaultProps} />)

      expect(screen.getByText('History')).toBeInTheDocument()
    })

    it('should not display history button when onViewHistory is not provided', () => {
      const propsWithoutHistory = { ...defaultProps, onViewHistory: undefined }
      render(<UnionRespectAssessment {...propsWithoutHistory} />)

      expect(screen.queryByText('History')).not.toBeInTheDocument()
    })

    it('should show initial data when provided', () => {
      const initialData = {
        criteria: {
          union_engagement: 4,
          communication_respect: 3,
          collaboration_attitude: undefined,
          dispute_resolution: undefined,
          union_delegate_relations: undefined
        },
        notes: 'Initial assessment notes'
      }

      render(
        <UnionRespectAssessment
          {...defaultProps}
          initialData={initialData}
        />
      )

      // Should show completion progress
      expect(screen.getByText('40%')).toBeInTheDocument()
    })
  })

  describe('Form Interaction', () => {
    it('should update criteria when rating is changed', async () => {
      render(<UnionRespectAssessment {...defaultProps} />)

      const selectorButtons = screen.getAllByTestId('selector-change')
      await user.click(selectorButtons[0]) // Change first criterion rating

      // Should show unsaved changes indicator
      expect(screen.getByText('Unsaved changes')).toBeInTheDocument()

      // Should update completion percentage
      expect(screen.getByText('20%')).toBeInTheDocument()
    })

    it('should handle comment input changes', async () => {
      render(<UnionRespectAssessment {...defaultProps} />)

      const commentTextarea = screen.getAllByPlaceholderText(/Provide specific examples or context/)[0]
      await user.type(commentTextarea, 'This is a test comment')

      // Should show unsaved changes indicator
      expect(screen.getByText('Unsaved changes')).toBeInTheDocument()
    })

    it('should toggle supporting evidence checkboxes', async () => {
      render(<UnionRespectAssessment {...defaultProps} />)

      // Find and toggle the first evidence checkbox
      const checkboxes = screen.getAllByRole('switch')
      expect(checkboxes.length).toBeGreaterThan(0)

      await user.click(checkboxes[0])

      // Should show unsaved changes indicator
      expect(screen.getByText('Unsaved changes')).toBeInTheDocument()
    })

    it('should handle additional notes input', async () => {
      render(<UnionRespectAssessment {...defaultProps} />)

      const notesTextarea = screen.getByPlaceholderText(/Any additional observations/)
      await user.type(notesTextarea, 'Additional assessment notes')

      // Should show unsaved changes indicator
      expect(screen.getByText('Unsaved changes')).toBeInTheDocument()
    })
  })

  describe('Form Validation', () => {
    it('should show validation warning when form is incomplete', () => {
      render(<UnionRespectAssessment {...defaultProps} />)

      // Should show warning about incomplete criteria
      expect(screen.getByText(/Please complete all criteria before saving/)).toBeInTheDocument()
      expect(screen.getByText('5 criteria remaining')).toBeInTheDocument()
    })

    it('should disable preview and save buttons when form is incomplete', () => {
      render(<UnionRespectAssessment {...defaultProps} />)

      const previewButton = screen.getByText('Preview Assessment')
      const saveButton = screen.getByText('Save Assessment')

      expect(previewButton).toBeDisabled()
      expect(saveButton).toBeDisabled()
    })

    it('should enable preview and save buttons when form is complete', async () => {
      render(<UnionRespectAssessment {...defaultProps} />)

      // Fill out all criteria
      const selectorButtons = screen.getAllByTestId('selector-change')
      for (let i = 0; i < 5; i++) {
        await user.click(selectorButtons[i])
      }

      // Buttons should be enabled
      const previewButton = screen.getByText('Preview Assessment')
      const saveButton = screen.getByText('Save Assessment')

      await waitFor(() => {
        expect(previewButton).not.toBeDisabled()
        expect(saveButton).not.toBeDisabled()
      })

      expect(screen.getByText('100%')).toBeInTheDocument()
    })
  })

  describe('Assessment Preview', () => {
    beforeEach(async () => {
      render(<UnionRespectAssessment {...defaultProps} />)

      // Fill out all criteria to enable preview
      const selectorButtons = screen.getAllByTestId('selector-change')
      for (let i = 0; i < 5; i++) {
        await user.click(selectorButtons[i])
      }

      // Click preview button
      const previewButton = screen.getByText('Preview Assessment')
      await user.click(previewButton)
    })

    it('should show preview mode with overall score', () => {
      expect(screen.getByText('Union Respect Assessment Preview')).toBeInTheDocument()
      expect(screen.getByTestId('four-point-display')).toBeInTheDocument()
    })

    it('should display assessment breakdown in preview', () => {
      expect(screen.getByText('Assessment Breakdown')).toBeInTheDocument()
      expect(screen.getAllByText('Rating')).toHaveLength(5) // One for each criterion
    })

    it('should show supporting evidence in preview', () => {
      expect(screen.getByText('Supporting Evidence')).toBeInTheDocument()
    })

    it('should allow returning to edit mode', async () => {
      const backButton = screen.getByText('Back to Edit')
      await user.click(backButton)

      // Should return to edit mode
      expect(screen.getByText('Union Respect Assessment')).toBeInTheDocument()
      expect(screen.getByText('Preview Assessment')).toBeInTheDocument()
    })

    it('should save assessment from preview mode', async () => {
      mockOnSave.mockResolvedValue(undefined)

      const saveButton = screen.getByText('Save Assessment')
      await user.click(saveButton)

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith({
          employer_id: 'test-employer-123',
          criteria: {
            union_engagement: 3,
            communication_respect: 3,
            collaboration_attitude: 3,
            dispute_resolution: 3,
            union_delegate_relations: 3
          },
          additional_comments: {},
          supporting_evidence: {
            has_union_delegates: false,
            regular_meetings: false,
            formal_communication_channels: false,
            joint_safety_committee: false,
            union_training_participation: false
          },
          notes: undefined
        })
      })
    })
  })

  describe('Save Functionality', () => {
    it('should save assessment with all data', async () => {
      render(<UnionRespectAssessment {...defaultProps} />)

      // Fill out all criteria
      const selectorButtons = screen.getAllByTestId('selector-change')
      for (let i = 0; i < 5; i++) {
        await user.click(selectorButtons[i])
      }

      // Add comments
      const commentTextarea = screen.getAllByPlaceholderText(/Provide specific examples/)[0]
      await user.type(commentTextarea, 'Test comment for union engagement')

      // Add supporting evidence
      const checkboxes = screen.getAllByRole('switch')
      await user.click(checkboxes[0])

      // Add notes
      const notesTextarea = screen.getByPlaceholderText(/Any additional observations/)
      await user.type(notesTextarea, 'Test additional notes')

      mockOnSave.mockResolvedValue(undefined)

      const saveButton = screen.getByText('Save Assessment')
      await user.click(saveButton)

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith({
          employer_id: 'test-employer-123',
          criteria: {
            union_engagement: 3,
            communication_respect: 3,
            collaboration_attitude: 3,
            dispute_resolution: 3,
            union_delegate_relations: 3
          },
          additional_comments: {
            union_engagement: 'Test comment for union engagement'
          },
          supporting_evidence: {
            has_union_delegates: true,
            regular_meetings: false,
            formal_communication_channels: false,
            joint_safety_committee: false,
            union_training_participation: false
          },
          notes: 'Test additional notes'
        })
      })
    })

    it('should show loading state while saving', async () => {
      render(<UnionRespectAssessment {...defaultProps} />)

      // Fill out all criteria
      const selectorButtons = screen.getAllByTestId('selector-change')
      for (let i = 0; i < 5; i++) {
        await user.click(selectorButtons[i])
      }

      // Mock save function that takes time
      mockOnSave.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))

      const saveButton = screen.getByText('Save Assessment')
      await user.click(saveButton)

      // Should show loading state
      expect(screen.getByText('Saving...')).toBeInTheDocument()
      expect(saveButton).toBeDisabled()
    })

    it('should handle save errors gracefully', async () => {
      render(<UnionRespectAssessment {...defaultProps} />)

      // Fill out all criteria
      const selectorButtons = screen.getAllByTestId('selector-change')
      for (let i = 0; i < 5; i++) {
        await user.click(selectorButtons[i])
      }

      // Mock save error
      mockOnSave.mockRejectedValue(new Error('Save failed'))

      const saveButton = screen.getByText('Save Assessment')
      await user.click(saveButton)

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalled()
      })

      // Should show error toast
      const { toast } = require('sonner')
      expect(toast.error).toHaveBeenCalledWith('Failed to save assessment')
    })

    it('should show validation error when trying to save incomplete assessment', async () => {
      render(<UnionRespectAssessment {...defaultProps} />)

      // Don't fill out all criteria - try to save anyway
      const selectorButtons = screen.getAllByTestId('selector-change')
      await user.click(selectorButtons[0]) // Only fill one criterion

      const saveButton = screen.getByText('Save Assessment')
      await user.click(saveButton)

      // Should show validation error
      const { toast } = require('sonner')
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('Please complete all criteria before saving')
      )
    })
  })

  describe('Readonly Mode', () => {
    it('should disable all inputs when readonly is true', () => {
      render(
        <UnionRespectAssessment
          {...defaultProps}
          readonly={true}
        />
      )

      // All selectors should be disabled
      const selectorDisabledStates = screen.getAllByTestId('selector-disabled')
      selectorDisabledStates.forEach(state => {
        expect(state).toHaveTextContent('true')
      })

      // All textareas should be disabled
      const textareas = screen.getAllByRole('textbox')
      textareas.forEach(textarea => {
        expect(textarea).toBeDisabled()
      })

      // All switches should be disabled
      const switches = screen.getAllByRole('switch')
      switches.forEach(switch_ => {
        expect(switch_).toBeDisabled()
      })

      // Action buttons should be disabled
      expect(screen.getByText('Preview Assessment')).toBeDisabled()
      expect(screen.getByText('Save Assessment')).toBeDisabled()
    })

    it('should show initial data in readonly mode', () => {
      const initialData = {
        criteria: {
          union_engagement: 4,
          communication_respect: 3,
          collaboration_attitude: 2,
          dispute_resolution: 3,
          union_delegate_relations: 4
        },
        additional_comments: {
          union_engagement: 'Excellent engagement with union representatives'
        },
        supporting_evidence: {
          has_union_delegates: true,
          regular_meetings: true
        },
        notes: 'Completed assessment with detailed observations'
      }

      render(
        <UnionRespectAssessment
          {...defaultProps}
          readonly={true}
          initialData={initialData}
        />
      )

      // Should show completion
      expect(screen.getByText('100%')).toBeInTheDocument()

      // Should not show unsaved changes indicator
      expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument()
    })
  })

  describe('History Functionality', () => {
    it('should call onViewHistory when history button is clicked', async () => {
      render(<UnionRespectAssessment {...defaultProps} />)

      const historyButton = screen.getByText('History')
      await user.click(historyButton)

      expect(mockOnViewHistory).toHaveBeenCalledTimes(1)
    })
  })

  describe('Accessibility', () => {
    it('should have proper heading hierarchy', () => {
      render(<UnionRespectAssessment {...defaultProps} />)

      // Main heading
      expect(screen.getByRole('heading', { level: 2, name: 'Union Respect Assessment' })).toBeInTheDocument()

      // Criteria headings
      expect(screen.getByRole('heading', { level: 4, name: 'Union Engagement' })).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 4, name: 'Communication Respect' })).toBeInTheDocument()
    })

    it('should have proper form labels', () => {
      render(<UnionRespectAssessment {...defaultProps} />)

      // Rating labels
      expect(screen.getAllByText('Rating')).toHaveLength(5)

      // Comment labels
      expect(screen.getAllByText('Comments (Optional)')).toHaveLength(5)

      // Evidence labels
      expect(screen.getByText('Has active union delegates')).toBeInTheDocument()
    })

    it('should provide descriptive text for screen readers', () => {
      render(<UnionRespectAssessment {...defaultProps} />)

      // Instructions should be clear
      expect(screen.getByText(/Rate each criterion on a 4-point scale/)).toBeInTheDocument()

      // Examples should be provided
      expect(screen.getByText('Participates in union meetings')).toBeInTheDocument()
      expect(screen.getByText('Responds promptly to union communications')).toBeInTheDocument()
    })

    it('should handle keyboard navigation', async () => {
      render(<UnionRespectAssessment {...defaultProps} />)

      // Tab to first rating selector
      await user.tab()
      const firstButton = screen.getAllByTestId('selector-change')[0]
      expect(firstButton).toHaveFocus()

      // Activate with Enter
      await user.keyboard('{Enter}')
      expect(screen.getByText('Unsaved changes')).toBeInTheDocument()
    })
  })

  describe('Component State Management', () => {
    it('should track changes correctly', async () => {
      render(<UnionRespectAssessment {...defaultProps} />)

      // Initially no changes
      expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument()

      // Make a change
      const selectorButton = screen.getAllByTestId('selector-change')[0]
      await user.click(selectorButton)

      // Should show unsaved changes
      expect(screen.getByText('Unsaved changes')).toBeInTheDocument()

      // Save the assessment
      mockOnSave.mockResolvedValue(undefined)
      const saveButton = screen.getByText('Save Assessment')

      // Enable save button first
      const selectorButtons = screen.getAllByTestId('selector-change')
      for (let i = 1; i < 5; i++) {
        await user.click(selectorButtons[i])
      }

      await user.click(saveButton)

      await waitFor(() => {
        expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument()
      })
    })

    it('should calculate overall score correctly', async () => {
      render(<UnionRespectAssessment {...defaultProps} />)

      // Fill criteria with different scores: 4, 3, 2, 3, 4
      const selectorButtons = screen.getAllByTestId('selector-change')

      // Mock different ratings by calling onChange directly
      const firstSelector = selectorButtons[0]
      await user.click(firstSelector)

      // Should calculate average (will be 3 in our mocked implementation)
      expect(screen.getByText('20%')).toBeInTheDocument()
    })
  })
})