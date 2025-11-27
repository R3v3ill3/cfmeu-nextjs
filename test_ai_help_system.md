# AI Help System Testing Framework

## Test Query Set for Quality Validation

### 1. Core Feature Questions (Expected High Confidence)

#### Mobile & PWA Features
- "How do I install the mobile app on my iPhone?"
- "What's the Site Visit Wizard?"
- "How do I conduct a site visit when I have no internet?"
- "Why won't my photos upload?"
- "How do I find projects closest to my location?"

#### Ratings & Compliance
- "What is the traffic light rating system?"
- "How does Ratings System v2 work?"
- "What is sham contracting detection?"
- "How do I complete a compliance audit?"

#### Delegate & Task Management
- "How do I register a site delegate?"
- "How do I assign tasks to delegates?"
- "What's the delegate task management system?"

#### Core Platform Features
- "How do I create a new project?"
- "What are user roles and permissions?"
- "How do I import BCI data?"
- "What's the organizing universe?"

### 2. Edge Case Questions (Expected Medium/Low Confidence)

- "Can I delete all projects at once?"
- "How do I export to SAP?"
- "What's the keyboard shortcut for quick actions?"
- "Can I customize the dashboard colors?"
- "How do I integrate with external CRM systems?"

### 3. Role-Specific Questions

#### Admin Questions
- "How do I manage user permissions?"
- "What's involved in the FWC lookup process?"
- "How do I resolve duplicate employers?"

#### Lead Organiser Questions
- "How do I assign patches to organisers?"
- "What's the co-ordinator console used for?"
- "How do I run Incolink sync?"

#### Organiser Questions
- "How do I record a site visit?"
- "What information goes on mapping sheets?"
- "How do I create a campaign activity?"

### 4. Context-Aware Questions

#### When on Dashboard
- "What do the metrics mean?"
- "How do I filter by tier?"

#### When on Project Page
- "How do I add an employer?"
- "What's the mapping sheet for?"

#### When on Mobile
- "How do I enable offline mode?"
- "Why is GPS not working?"

## Testing Methodology

### Scoring Criteria
1. **Accuracy (40%)**: Is the information correct and current?
2. **Completeness (25%)**: Does it fully answer the question?
3. **Source Quality (20%)**: Are cited sources relevant and trustworthy?
4. **Helpfulness (15%)**: Is the response practical and actionable?

### Confidence Validation
- **High (0.8+)**: Should match specific documentation exactly
- **Medium (0.6-0.8)**: Should synthesize from multiple docs
- **Low (<0.6)**: Should fallback appropriately

### Hallucination Detection
- Any mention of non-existent features = FAIL
- Invented workflows = FAIL
- Incorrect permissions/roles = FAIL
- Made-up technical details = FAIL

## Expected Test Results

### Documentation Coverage Analysis
Based on DOCUMENTATION_STRUCTURE.json (285 documents):

**Mobile Features**: ✅ Well covered (15+ docs)
- PWA installation, Site Visit Wizard, offline sync, GPS features
- Camera, voice input, mobile forms
- Expected confidence: 0.85+

**Ratings System**: ✅ Well covered (8+ docs)
- Traffic light system, v2 methodology, sham contracting
- Expected confidence: 0.80+

**Core Workflows**: ✅ Well covered (20+ docs)
- Delegate registration, project creation, campaign activities
- Expected confidence: 0.75+

**Admin Features**: ✅ Covered (12+ docs)
- User roles, data imports, system configuration
- Expected confidence: 0.70+

### Edge Case Handling
- Should politely decline non-existent features
- Should redirect to platform capabilities
- Should suggest alternative approaches when possible

## Test Execution Plan

### Phase 1: Core Feature Validation
1. Test all 20 core feature questions
2. Verify source citations match DOCUMENTATION_STRUCTURE.json
3. Check confidence scoring aligns with documentation availability

### Phase 2: Edge Case Testing
1. Test 10 edge case/hallucination prevention questions
2. Verify fallback behavior and appropriate responses
3. Confirm no invented features or workflows

### Phase 3: Role-Based Testing
1. Test questions from each user role perspective
2. Verify role-filtering works correctly
3. Check appropriate permissions guidance

### Phase 4: Context Awareness Testing
1. Test questions from different page contexts
2. Verify page-relevant suggestions appear
3. Check contextual help triggers

### Phase 5: Mobile vs Desktop Testing
1. Test mobile-specific questions
2. Verify PWA and offline documentation coverage
3. Check touch-optimized workflow guidance

## Quality Metrics

### Success Criteria
- **Accuracy**: ≥95% correct information
- **Source Quality**: ≥90% relevant source citations
- **Hallucination Prevention**: 0% invented features
- **Helpfulness**: ≥85% user satisfaction in feedback
- **Confidence Scoring**: Appropriate levels for query types

### Performance Targets
- **Response Time**: ≤3 seconds for most queries
- **Source Retrieval**: ≤500ms for semantic search
- **Availability**: ≥99.5% uptime

### Analytics Tracking
- Monitor help_common_questions view weekly
- Track help_low_confidence_questions for documentation gaps
- Analyze feedback patterns for improvement opportunities
