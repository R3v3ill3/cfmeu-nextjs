# Site Visit Workflow Guide - CFMEU NSW Construction Union Organising Database

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Overview](#system-overview)
3. [Pre-Visit Preparation](#pre-visit-preparation)
4. [Mobile App Setup and Configuration](#mobile-app-setup-and-configuration)
5. [On-Site Workflow](#on-site-workflow)
6. [Site Visit Wizard Usage](#site-visit-wizard-usage)
7. [Project Mapping Workflow](#project-mapping-workflow)
8. [Compliance Audit Workflow](#compliance-audit-workflow)
9. [Data Capture and Evidence Collection](#data-capture-and-evidence-collection)
10. [Post-Visit Actions](#post-visit-actions)
11. [Offline Operation and Sync](#offline-operation-and-sync)
12. [Troubleshooting](#troubleshooting)
13. [Best Practices](#best-practices)

---

## Executive Summary

### What is the Site Visit Workflow System?

The Site Visit Workflow System is a comprehensive mobile-first platform designed specifically for CFMEU NSW construction union organisers to conduct efficient and effective site visits. The system streamlines the entire site visit process from preparation through data collection, compliance auditing, and follow-up actions.

### Why Does It Exist?

The site visit system serves several critical purposes for union organising work:

- **Standardised Data Collection**: Ensures consistent, high-quality data collection across all site visits
- **Mobile-First Field Operations**: Optimised for iPhone 13+ devices used in construction site environments
- **Real-Time Compliance Tracking**: Immediate traffic light rating updates and compliance status monitoring
- **Offline Capability**: Full functionality in areas with poor or no internet connectivity
- **Organiser Efficiency**: Reduces administrative burden while increasing data quality
- **Strategic Organising**: Provides actionable intelligence for organising campaigns and compliance interventions

### Key System Components

1. **Site Visit Wizard**: Mobile-optimized interface for quick site navigation and action selection
2. **Project Mapping Workflow**: Tools for mapping employers, workforce, and union presence
3. **Compliance Audit System**: Traffic light rating assessments with evidence capture
4. **Geofencing Integration**: Automatic project detection and nearby site alerts
5. **Offline Sync System**: Reliable data capture and synchronization capabilities
6. **Reporting Dashboard**: Real-time analytics and follow-up task management

### Target Users

- **Primary Users**: Field organisers using iPhone 13+ devices
- **Secondary Users**: Lead organisers, administrators, and union delegates
- **Technical Skill Level**: Designed for users with limited technical proficiency
- **Environment**: Construction sites, outdoor field conditions, variable connectivity

---

## System Overview

### Architecture

The site visit system operates as a multi-component platform:

```
Mobile Site Visit App (iPhone) ←→ Backend Services ←→ Database
         ↓                              ↓                ↓
   Offline Sync                    Real-time API      Supabase
   Local Storage                    Processing      PostgreSQL
   Geofencing                     Background       Materialized
   Camera Capture                  Workers          Views
```

### Core Technologies

- **Frontend**: Next.js 14 with React Native Web for mobile optimization
- **Mobile**: Progressive Web App (PWA) with native-like iOS integration
- **Database**: Supabase (PostgreSQL) with spatial data support
- **Offline**: Local storage with intelligent sync capabilities
- **Geolocation**: HTML5 Geolocation API with iOS PWA enhancements
- **Camera**: Mobile-optimized photo capture with compression

### Mobile App Features

#### Site Visit Wizard
- Two-phase interface (Project Selection → Action Menu)
- Geolocation-based project detection
- Large touch-friendly buttons (minimum 56px height)
- Intelligent visit reason pre-selection
- Auto-save functionality

#### Project Mapping
- Employer and workforce data entry
- Union delegate identification
- Trade and role classification
- Photo evidence capture
- Real-time validation

#### Compliance Auditing
- Traffic light rating assessments
- 4-point evaluation system
- Evidence attachment capabilities
- Sham contracting detection
- Automated score calculation

#### Offline Capabilities
- Full offline data capture
- Local storage with encryption
- Intelligent sync when online
- Conflict resolution handling
- Progress indicators

---

## Pre-Visit Preparation

### Equipment Checklist

#### Required Devices
- **iPhone 13+** (recommended) with iOS 15+
- **Portable charger** or power bank (minimum 10,000mAh)
- **Protective case** with screen protector
- **Sturdy vehicle mount** for safe access while driving

#### Optional but Recommended Equipment
- **Bluetooth keyboard** for extensive data entry
- **Portable Wi-Fi hotspot** for areas with poor cellular coverage
- **External battery pack** for all-day field operations
- **Waterproof phone case** for construction site conditions
- **Vehicle charger** for between-site charging

#### Personal Preparation Items
- **High-visibility vest** with ID badge
- **Steel-toed boots** (site requirement)
- **Hard hat** (if required by site)
- **Notebook and pen** for backup documentation
- **Business cards** for delegate and worker contacts

### Mobile App Preparation

#### Pre-Visit App Setup

1. **Install the PWA**
   - Open Safari and navigate to the app URL
   - Tap "Share" → "Add to Home Screen"
   - Name it "CFMEU Site Visits"
   - Ensure it appears on your home screen

2. **Configure Settings**
   - Enable Location Services: Settings → Privacy → Location Services → CFMEU → "While Using"
   - Enable Notifications: Settings → Notifications → CFMEU → Allow Notifications
   - Clear Storage: Settings → Safari → Clear History and Website Data (if experiencing issues)

3. **Update App Data**
   - Open app while connected to Wi-Fi
   - Allow 5-10 minutes for data synchronization
   - Verify projects load in your assigned patches
   - Test geofencing with a known site location

#### Data Preparation

1. **Review Assigned Patches**
   - Check your patch assignments via the dashboard
   - Identify priority projects (high value, compliance concerns, active organising)
   - Note any specific objectives for each visit
   - Download relevant project data for offline access

2. **Check Connectivity**
   - Verify mobile data coverage in target areas
   - Identify known connectivity dead zones
   - Prepare offline workarounds for poor coverage areas
   - Test hotspot functionality if using external Wi-Fi

3. **Prepare Reference Materials**
   - Screenshot key project details and contacts
   - Download relevant EBA documents
   - Prepare compliance checklists specific to project type
   - Save directions and site access information

### Site Visit Planning

#### Daily Route Planning

1. **Geographic Efficiency**
   - Use the mobile map to identify nearby projects
   - Plan routes to minimize travel time between sites
   - Consider traffic patterns and site access times
   - Schedule visits during optimal site access hours

2. **Site Access Preparation**
   - Research site-specific access requirements
   - Prepare required personal protective equipment (PPE)
   - Note site manager contact information
   - Check for any special access protocols or induction requirements

3. **Objective Setting**
   - Define specific goals for each site visit
   - Prioritize compliance audits for high-risk employers
   - Identify delegate recruitment opportunities
   - Plan worker engagement activities

#### Pre-Visit Data Review

1. **Project Status Check**
   - Review current compliance ratings
   - Check recent visit history and findings
   - Note any outstanding issues or follow-up items
   - Identify key employers and subcontractors on site

2. **Compliance History**
   - Review traffic light rating trends
   - Check for sham contracting flags
   - Note EBA status and expiry dates
   - Identify previous safety incidents or disputes

3. **Organising Intelligence**
   - Review union membership levels
   - Check delegate presence and activity
   - Note any recent industrial action or disputes
   - Identify key worker contacts for engagement

---

## Mobile App Setup and Configuration

### Installation and Initial Setup

#### Installing the Progressive Web App (PWA)

1. **Open Safari Browser**
   - Navigate to the CFMEU app URL
   - Ensure you're using Safari (not Chrome or other browsers)

2. **Add to Home Screen**
   - Tap the "Share" icon (square with arrow)
   - Scroll down and tap "Add to Home Screen"
   - Verify the name "CFMEU Site Visits"
   - Tap "Add" to complete installation

3. **Verify Installation**
   - Look for the CFMEU icon on your home screen
   - Tap to open - should launch full-screen
   - Test that it works offline (open without internet)

#### First-Time Configuration

1. **Login and Authentication**
   - Enter your CFMEU credentials
   - Allow biometric login if prompted
   - Enable "Stay logged in" for convenience
   - Test login/logout functionality

2. **Location Services Setup**
   - When prompted for location access, select "While Using"
   - This enables geofencing and nearby project detection
   - Essential for automatic site identification

3. **Notification Permissions**
   - Allow notifications for important updates
   - Enables alerts for compliance issues and tasks
   - Critical for urgent organising communications

### Settings and Preferences

#### App Configuration

1. **Geofencing Settings**
   - Enable automatic site detection
   - Set preferred radius (default: 100 meters)
   - Enable background location updates
   - Configure notification preferences

2. **Offline Settings**
   - Enable offline mode (recommended)
   - Set auto-sync interval (default: 30 seconds)
   - Configure storage limits
   - Enable backup to cloud when online

3. **Camera and Photo Settings**
   - Allow camera access for evidence capture
   - Allow photo library access for file attachments
   - Configure photo quality settings
   - Enable automatic compression

#### Personal Preferences

1. **Display Settings**
   - Adjust font size for readability
   - Enable high contrast mode if needed
   - Configure night mode for evening visits
   - Set preferred language

2. **Notification Settings**
   - Choose which notifications to receive
   - Set quiet hours for non-urgent alerts
   - Configure vibration settings
   - Enable notification sounds

3. **Data Usage Settings**
   - Configure Wi-Fi only downloads for large files
   - Set data usage limits
   - Enable low data usage mode when needed
   - Configure auto-update settings

### Testing and Verification

#### Pre-Use Testing Checklist

1. **Basic Functionality Test**
   - [ ] App opens successfully from home screen
   - [ ] Login works without errors
   - [ ] Dashboard loads with assigned patches
   - [ ] Projects are visible and accessible

2. **Geofencing Test**
   - [ ] Location permission is granted
   - [ ] Nearby projects are detected
   - [ ] Site visit wizard launches correctly
   - [ ] GPS coordinates are accurate

3. **Offline Test**
   - [ ] App works without internet connection
   - [ ] Data can be entered offline
   - [ ] Photos can be captured offline
   - [ ] Sync works when reconnected

4. **Camera Test**
   - [ ] Camera permission is granted
   - [ ] Photos can be captured and attached
   - [ ] Photo quality is acceptable
   - [ ] File uploads work when online

### Troubleshooting Common Setup Issues

#### PWA Installation Problems

**Issue**: "Add to Home Screen" option not available
- **Solution**: Ensure you're using Safari, not Chrome or other browsers
- **Alternative**: Check that the website meets PWA install requirements

**Issue**: App opens in browser instead of full-screen
- **Solution**: Delete and reinstall the PWA
- **Alternative**: Check iOS version compatibility (requires iOS 13+)

#### Permission Issues

**Issue**: Location permission not working
- **Solution**: Go to Settings → Privacy → Location Services → CFMEU → "While Using"
- **Alternative**: Reset location services and regrant permission

**Issue**: Camera not accessible
- **Solution**: Go to Settings → Privacy & Security → Camera → CFMEU → Enable
- **Alternative**: Restart the app after granting permission

#### Login Issues

**Issue**: Cannot login with credentials
- **Solution**: Verify username and password with system administrator
- **Alternative**: Reset password through official CFMEU channels

**Issue**: Login keeps failing
- **Solution**: Clear Safari cache and website data
- **Alternative**: Try login on different network/Wi-Fi

---

## On-Site Workflow

### Arrival and Site Check-in

#### GPS Check-in Process

1. **Automatic Detection**
   - When you approach a registered job site (within 100 meters)
   - Your phone will automatically detect the site
   - A notification may appear: "Near [Project Name] - Start Site Visit?"
   - The Site Visit Wizard will pre-select the detected project

2. **Manual Check-in**
   - Open the CFMEU Site Visit app from your home screen
   - Tap "Start Site Visit" or use the floating action button
   - The wizard will show your current location
   - Select the correct project from the list

3. **Location Verification**
   - Confirm you're at the correct address
   - Verify project details match the physical site
   - Note any discrepancies in project information
   - Update site access information if needed

#### Site Safety Assessment

1. **Initial Site Safety Check**
   - Observe site conditions from a safe distance
   - Note any obvious safety hazards
   - Check for appropriate signage and barriers
   - Verify personal protective equipment requirements

2. **Access Point Identification**
   - Locate main site entrance and security office
   - Identify visitor check-in procedures
   - Note site manager or contact person location
   - Determine if site induction is required

3. **Site Orientation**
   - Take note of site layout and key areas
   - Identify worker congregation areas
   - Locate amenities and break areas
   - Note any restricted access areas

### Site Contact Interactions

#### Professional Approach

1. **Introduction and Identification**
   - Present CFMEU identification clearly
   - State your name and role clearly
   - Explain purpose of visit professionally
   - Request appropriate site access

2. **Site Manager Contact**
   - Introduce yourself to site management
   - Explain union rights of entry
   - Request meeting with appropriate representatives
   - Document any access restrictions or objections

3. **Building Rapport**
   - Maintain professional, respectful demeanor
   - Listen actively to site concerns
   - Explain compliance process clearly
   - Offer assistance with worker representation

#### Handling Difficult Situations

1. **Access Denied**
   - Remain calm and professional
   - Clearly explain legal rights of entry
   - Document refusal and circumstances
   - Contact supervisor if necessary
   - Consider follow-up actions

2. **Hostile Reception**
   - Prioritize personal safety
   - Maintain professional boundaries
   - Document specific concerns or threats
   - Leave site if feeling unsafe
   - Report incidents immediately

3. **Safety Concerns**
   - Immediately address any safety hazards
   - Request site safety officer if needed
   - Document safety concerns in detail
   - Report to appropriate authorities
   - Consider work stoppage if serious hazards exist

### Site Navigation and Data Collection

#### Systematic Site Approach

1. **Workforce Areas**
   - Visit worker congregation points
   - Observe working conditions and practices
   - Note subcontractor presence and activity
   - Identify potential union members or delegates

2. **Safety Facilities**
   - Check amenities and facilities
   - Review safety signage and procedures
   - Observe safety equipment usage
   - Document any safety concerns

3. **Project Management Areas**
   - Locate site office or management facilities
   - Review project documentation displays
   - Check for EBA and rights notices
   - Document compliance posting requirements

#### Environmental Considerations

1. **Weather Conditions**
   - Plan data collection around weather
   - Protect electronic equipment from rain/dust
   - Consider worker locations based on weather
   - Document weather impacts on site conditions

2. **Site Layout Challenges**
   - Navigate complex or multi-level sites systematically
   - Use site maps or directories when available
   - Document site layout for future reference
   - Note access limitations or restrictions

3. **Timing Considerations**
   - Plan visits during worker presence
   - Avoid meal breaks or shift changes if possible
   - Consider project schedule and critical activities
   - Document worker density and activity levels

---

## Site Visit Wizard Usage

### Overview and Navigation

#### Wizard Interface

The Site Visit Wizard is designed for simplicity and efficiency, featuring:

- **Large Touch Targets**: Minimum 56px height buttons for easy field use
- **Clear Visual Hierarchy**: Important actions prominently displayed
- **Consistent Navigation**: Back button and clear section indicators
- **Progress Tracking**: Visual indicators of wizard completion
- **Mobile Optimization**: Optimized for single-handed use

#### Phase Structure

**Phase 1: Project Selection**
- Automatic geolocation-based project detection
- Manual search and selection capabilities
- Project verification and confirmation
- Access to project summary information

**Phase 2: Action Menu**
- Seven primary action options
- Project information summary
- Quick access to key functions
- Navigation controls and exit options

### Phase 1: Project Selection

#### Automatic Geolocation Detection

1. **GPS-Based Detection**
   - When within 100 meters of a registered job site
   - System automatically detects nearby projects
   - Shows "Is this your job?" prompt with project details
   - Large YES/NO buttons for easy selection

2. **Project Information Display**
   - Project name and address
   - Builder/contractor information
   - Current compliance rating (if available)
   - Recent visit history

3. **Selection Confirmation**
   - Tap "YES" to confirm project selection
   - Tap "NO" to see other nearby options
   - Tap "Other" for manual search
   - Tap "Search" to search by project name/address

#### Manual Project Search

1. **Search Interface**
   - Search by project name
   - Search by address or location
   - Filter by assigned patches
   - Sort by distance or relevance

2. **Search Results**
   - List of matching projects
   - Distance from current location
   - Basic project information
   - Compliance status indicators

3. **Project Selection**
   - Tap to select correct project
   - Review project details
   - Confirm selection to proceed
   - Access project summary information

### Phase 2: Action Menu

#### Main Action Options

The action menu provides seven main options in a 2-column grid:

1. **Contacts** - View and edit site contacts
   - Project Manager, Site Manager, Delegate, HSR
   - Contact information and role details
   - Communication history and notes
   - Auto-save functionality (800ms debounce)

2. **Mapping** - Map trades and employers
   - Employer identification and classification
   - Workforce composition data
   - Union membership tracking
   - Photo evidence capture

3. **Ratings** - Employer compliance ratings
   - Traffic light rating system
   - 4-point assessment scale
   - Evidence documentation
   - Compliance history

4. **EBA** - Enterprise agreement status
   - Current EBA information
   - Coverage verification
   - Expiry tracking
   - Compliance monitoring

5. **Incolink** - Payment status integration
   - Incolink payment verification
   - Member status checking
   - Payment history
   - Compliance status

6. **Project Details** - Full project information
   - Complete project overview
   - Site specifications
   - Timeline and progress
   - Contact information

7. **Pick New Project** - Change project selection
   - Return to project selection
   - Start new site visit
   - Access different projects
   - Multi-site visit management

#### Navigation Controls

1. **Back Navigation**
   - Consistent back button in header
   - Maintains wizard state
   - Preserves entered data
   - Clear navigation path

2. **Project Summary Card**
   - Current project information
   - Builder and address details
   - Quick reference during visit
   - Visual project identification

3. **Exit Site Visit**
   - Triggers site visit recording dialog
   - Intelligent reason pre-selection
   - Data saving and synchronization
   - Exit confirmation process

### Site Visit Recording

#### Exit Dialog Process

1. **Automatic Trigger**
   - Shown when attempting to exit wizard
   - Only appears if project was selected
   - Pre-selects reasons based on visited sections
   - Options to record or skip recording

2. **Reason Pre-selection Logic**
   - Visited Ratings section → "Compliance Audit" pre-selected
   - Visited other sections → "General Visit" as fallback
   - Multiple reasons can be selected
   - Custom reason entry available

3. **Visit Summary**
   - Project information
   - Selected visit reasons
   - Duration estimation
   - Data capture confirmation

#### Data Saving Process

1. **Immediate Local Save**
   - All data saved to device storage
   - Offline capability maintained
   - Automatic backup creation
   - Progress indicators shown

2. **Synchronization Queue**
   - Data queued for server sync
   - Priority-based processing
   - Automatic retry on failure
   - Conflict resolution handling

3. **Confirmation and Feedback**
   - Success confirmation message
   - Sync status indicator
   - Error notification if needed
   - Option to review saved data

---

## Project Mapping Workflow

### Accessing Project Mapping

#### From Site Visit Wizard

1. **Launch Mapping**
   - From the Action Menu, tap "Mapping"
   - Opens mobile-optimized mapping interface
   - Auto-loads current project data
   - Preserves wizard context

2. **Direct Access**
   - Navigate to `/mobile/projects/[projectId]/mapping`
   - Bypasses wizard for quick mapping access
   - Full mapping functionality available
   - Suitable for experienced users

#### Interface Overview

The mobile mapping interface features:

- **Touch-Optimized Forms**: Large input fields and buttons
- **Auto-Save Functionality**: Data saved automatically during entry
- **Progressive Disclosure**: Complex forms broken into logical sections
- **Offline Capability**: Full functionality without internet connection
- **Photo Integration**: Direct camera access for evidence capture

### Employer Data Collection

#### Employer Identification

1. **Primary Contractor Information**
   - Enter main contractor/builder details
   - Verify ABN and business information
   - Document contact person and role
   - Note contractual relationships

2. **Subcontractor Identification**
   - List all subcontractors on site
   - Classify by trade or specialty
   - Estimate workforce size per contractor
   - Note employment arrangements

3. **Trade Classification**
   - Select appropriate trade categories
   - Document specialized trades
   - Note workforce composition
   - Record apprentice presence

#### Data Entry Process

1. **Employer Details**
   ```
   Required Fields:
   - Employer Name (text)
   - ABN (number, validation)
   - Trade/Specialty (dropdown)
   - Workforce Size (number)
   - Contact Person (text)
   - Contact Phone (phone number)

   Optional Fields:
   - Email Address (email)
   - Physical Address (text)
   - Notes (text area)
   - Employment Type (dropdown)
   ```

2. **Workforce Information**
   ```
   Required Fields:
   - Total Workers (number)
   - Union Members (number)
   - Estimated Union Density (%)
   - Apprentice Count (number)

   Optional Fields:
   - Worker Nationalities (multiselect)
   - Employment Arrangements (multiselect)
   - Contract Details (text)
   - Specialized Skills (multiselect)
   ```

3. **Contact Information**
   ```
   Required Fields:
   - Contact Name (text)
   - Role/Position (text)
   - Phone Number (phone)

   Optional Fields:
   - Email Address (email)
   - Best Contact Time (time)
   - Alternative Contact (text)
   - Notes (text area)
   ```

### Delegate Identification

#### Union Delegate Discovery

1. **Existing Delegate Verification**
   - Confirm known delegate presence
   - Verify delegate contact information
   - Update delegate status and activity
   - Document delegate effectiveness

2. **Potential Delegate Identification**
   - Identify workers with leadership potential
   - Note union membership status
   - Document worker concerns and issues
   - Assess delegate readiness

3. **Safety Representative Contact**
   - Locate Health and Safety Representatives
   - Document HSR contact information
   - Note HSR effectiveness and cooperation
   - Record safety issues raised

#### Delegate Data Collection

1. **Delegate Information**
   ```
   Required Fields:
   - Delegate Name (text)
   - Trade/Specialty (dropdown)
   - Contact Phone (phone)
   - Is Current Delegate (boolean)

   Optional Fields:
   - Email Address (email)
   - Years in Role (number)
   - Training Completed (multiselect)
   - Languages Spoken (multiselect)
   - Notes (text area)
   ```

2. **Delegate Assessment**
   ```
   Assessment Fields:
   - Effectiveness Rating (1-5 scale)
   - Communication Skills (1-5 scale)
   - Worker Support Level (1-5 scale)
   - Training Needs (multiselect)
   - Development Priorities (text)
   ```

3. **Leadership Potential**
   ```
   Potential Fields:
   - Leadership Indicators (checkbox list)
   - Influence Level (dropdown)
   - Worker Relationships (text)
   - Union Commitment (1-5 scale)
   - Development Plan (text)
   ```

### Photo Evidence Capture

#### Camera Integration

1. **Direct Camera Access**
   - Tap camera icon to launch camera
   - Photo captures automatically tagged with location
   - Automatic compression for mobile optimization
   - Immediate preview and retake options

2. **Photo Categories**
   - **Site Overview**: General site conditions and layout
   - **Workforce Areas**: Worker congregations and working conditions
   - **Safety Signage**: Safety notices, warning signs, procedures
   - **Amenities**: Facilities, break areas, amenities

3. **Photo Metadata**
   - Automatic GPS location tagging
   - Timestamp capture
   - Photo category classification
   - Optional descriptions and notes

#### Best Practices for Photo Evidence

1. **Quality Considerations**
   - Ensure good lighting conditions
   - Include scale reference when possible
   - Capture context in wider shots
   - Focus on relevant details

2. **Privacy and Consent**
   - Avoid photographing individual workers without permission
   - Focus on conditions and environments, not people
   - Obtain consent for any identifiable individuals
   - Respect privacy in amenities and personal areas

3. **Documentation Standards**
   - Include descriptive captions
   - Note photo context and relevance
   - Capture before/after when documenting improvements
   - Maintain organized photo categorization

### Auto-Save and Data Integrity

#### Automatic Saving

1. **Debounced Auto-Save**
   - Data saved automatically every 2 seconds during typing
   - Reduces risk of data loss from app crashes
   - Preserves form state across app restarts
   - Manual save option also available

2. **Local Storage Backup**
   - Multiple backup copies maintained
   - Version history for data recovery
   - Corruption detection and repair
   - Export capability for data portability

3. **Conflict Resolution**
   - Automatic detection of data conflicts
   - Manual conflict resolution interface
   - Version comparison tools
   - Merge capabilities for conflicting changes

#### Data Validation

1. **Real-Time Validation**
   - Field-level validation during entry
   - Format checking (ABN, phone, email)
   - Required field enforcement
   - Duplicate detection and warnings

2. **Business Rule Validation**
   - Workforce size consistency checks
   - Trade classification validation
   - Contact information verification
   - Geographic consistency checks

3. **Quality Assurance**
   - Data completeness indicators
   - Quality scoring for entered data
   - Improvement suggestions
   - Review workflow for verification

---

## Compliance Audit Workflow

### Accessing Compliance Auditing

#### From Site Visit Wizard

1. **Launch Compliance Audit**
   - From the Action Menu, tap "Ratings"
   - Opens mobile compliance audit interface
   - Loads current employer data
   - Displays existing compliance history

2. **Employer Selection**
   - Choose employer to audit from project list
   - View current traffic light rating
   - Review assessment history
   - Start new assessment process

#### Compliance Audit Interface

The mobile compliance interface features:

- **Touch-Optimized Assessments**: Large buttons and clear rating scales
- **Evidence Integration**: Direct photo and document attachment
- **Guided Assessment Flow**: Step-by-step assessment process
- **Real-Time Scoring**: Immediate calculation of compliance scores
- **Offline Operation**: Complete audits without internet connection

### Traffic Light Rating System

#### Rating Categories

1. **Green Rating**
   - Excellent compliance across all areas
   - No outstanding issues or concerns
   - Strong relationship with union
   - Reliable partner for workers

2. **Yellow Rating**
   - Good overall performance
   - Minor areas requiring improvement
   - Generally compliant with requirements
   - Cooperative relationship

3. **Amber Rating**
   - Moderate concerns requiring attention
   - Some compliance issues present
   - Relationship needs improvement
   - Requires monitoring and follow-up

4. **Red Rating**
   - Significant compliance problems
   - Poor relationship with union
   - Immediate action required
   - May require enforcement action

#### Assessment Framework

The compliance audit uses four main assessment categories:

1. **Union Respect Assessment**
   - Right of Entry access
   - Delegate accommodation and support
   - Information access and transparency
   - Union involvement in inductions
   - EBA status and compliance

2. **Safety Assessment**
   - Site safety standards
   - Safety procedure implementation
   - Incident reporting transparency
   - Worker safety training
   - Equipment and facility safety

3. **Subcontractor Assessment**
   - Fair subcontractor treatment
   - Payment practices and timeliness
   - Contract fairness and transparency
   - Sham contracting detection
   - Industry compliance standards

4. **Role-Specific Assessment**
   - Varies by employer role (builder, subcontractor, etc.)
   - Industry reputation
   - Work quality standards
   - Financial stability
   - Technical expertise

### 4-Point Assessment Scale

#### Scale Definitions

**1 - Good (Exceeds Expectations)**
- Performance is exceptional
- Goes above and beyond requirements
- Sets positive examples
- No concerns identified

**2 - Fair (Meets Expectations)**
- Performance is acceptable
- Meets standard requirements
- Generally compliant
- Minor improvements possible

**3 - Poor (Below Expectations)**
- Performance is concerning
- Does not consistently meet requirements
- Issues need to be addressed
- Requires improvement

**4 - Terrible (Major Concerns)**
- Serious problems identified
- Significant non-compliance
- Major relationship issues
- Requires immediate action

#### Rating Process

1. **Criterion Assessment**
   - Rate each criterion using 1-4 scale
   - Provide specific evidence for ratings
   - Note observable behaviors and conditions
   - Document worker feedback and concerns

2. **Confidence Level Setting**
   - **High**: Direct, recent experience with strong evidence
   - **Medium**: Reliable information with adequate evidence
   - **Low**: Limited information with minimal evidence
   - **Very Low**: Very limited information, hearsay

3. **Notes and Evidence**
   - Detailed notes explaining ratings
   - Photo evidence where applicable
   - Worker testimony documentation
   - Specific examples and observations

### Sham Contracting Detection

#### What is Sham Contracting?

Sham contracting occurs when employers misclassify employees as independent contractors to avoid:

- Payroll tax obligations
- Superannuation contributions
- Workers' compensation insurance
- Leave entitlements
- Union coverage under EBAs

#### Detection Indicators

1. **Employment Arrangements**
   - Workers classified as contractors but working like employees
   - Payment by hour/week rather than by project
   - Employer provides tools and equipment
   - Workers have no business independence

2. **Control and Integration**
   - High level of employer control over work
   - Workers integrated into business operations
   - No independent business identity
   - No other clients or customers

3. **Documentation Issues**
   - Lack of proper contractor agreements
   - ABN registration without genuine business
   - No business registration or licenses
   - No insurance or liability coverage

#### Reporting Requirements

1. **Mandatory Documentation**
   - Detailed notes explaining sham contracting evidence
   - Specific examples and observations
   - Dates, locations, and circumstances
   - Worker information (with consent)

2. **Evidence Collection**
   - Photographic evidence of working arrangements
   - Documentation of payment methods
   - Worker statements (where appropriate)
   - Contract or agreement copies (if available)

3. **Rating Impact**
   - Sham contracting creates "hard block" preventing green ratings
   - Maximum possible rating becomes Yellow/Amber
   - Immediate investigation and action required
   - Potential for enforcement action

### Evidence Collection and Documentation

#### Photo Evidence

1. **Compliance Photography**
   - Safety condition documentation
   - Signage and notice board photos
   - Working condition evidence
   - Facility and amenity documentation

2. **Privacy Considerations**
   - Avoid individual worker photography without consent
   - Focus on conditions and environments
   - Blur faces in documentation photos
   - Respect privacy in sensitive areas

3. **Technical Requirements**
   - Clear, well-lit photos
   - Include context and scale reference
   - Timestamp and location metadata
   - Descriptive captions and notes

#### Documentary Evidence

1. **Document Types**
   - EBA copies and variations
   - Safety management systems
   - Payment records and timesheets
   - Contract and agreement documentation

2. **Collection Methods**
   - Direct document photography
   - Request copies from employers
   - Download from digital systems
   - Scan physical documents

3. **Quality Standards**
   - Clear, legible documentation
   - Complete document sets
   - Proper attribution and dating
   - Relevance to compliance issues

---

## Data Capture and Evidence Collection

### Mobile Camera Integration

#### Camera Functionality

1. **Direct Camera Access**
   - Single-tap camera launch from any data entry screen
   - Automatic optimization for construction site conditions
   - HDR and flash control for challenging lighting
   - Front/rear camera selection as needed

2. **Image Optimization**
   - Automatic compression for mobile data efficiency
   - Resolution optimization for documentation quality
   - Format standardization (JPEG with metadata)
   - Size management for offline storage

3. **Camera Settings**
   ```
   Default Settings:
   - Resolution: 1920x1080 pixels
   - Quality: 80% compression
   - Format: JPEG with EXIF metadata
   - Location tagging: Enabled
   - Timestamp: Automatic
   ```

#### Photo Categories and Standards

1. **Site Documentation Photos**
   - **Purpose**: Overall site conditions and layout
   - **Requirements**: Wide shots showing site context
   - **Standards**: Include site entrance, layout, general conditions
   - **Frequency**: One per site visit, updated when conditions change

2. **Safety Evidence Photos**
   - **Purpose**: Document safety conditions and compliance
   - **Requirements**: Clear shots of safety equipment, signage, procedures
   - **Standards**: Show both compliance and non-compliance examples
   - **Frequency**: As needed for safety documentation

3. **Workforce Documentation**
   - **Purpose**: Document working conditions and practices
   - **Requirements**: General shots avoiding individual identification
   - **Standards**: Focus on conditions, not specific workers
   - **Privacy**: Avoid faces and personal identification

4. **Evidence Photos**
   - **Purpose**: Document specific compliance issues or violations
   - **Requirements**: Clear evidence of specific issues
   - **Standards**: Include context and scale references
   - **Documentation**: Detailed captions explaining photo significance

#### Privacy and Consent Guidelines

1. **Worker Privacy Protection**
   - Never photograph individual workers without explicit consent
   - Focus on conditions and environments, not people
   - Use wide shots that don't identify specific individuals
   - Blur faces if workers are unavoidably included

2. **Consent Requirements**
   - Obtain verbal consent before photographing any identifiable person
   - Explain purpose and use of photographs
   - Respect requests not to be photographed
   - Document consent when obtained

3. **Sensitive Area Restrictions**
   - Avoid photography in amenities and change areas
   - Respect privacy in personal spaces
   - Don't photograph confidential documentation
   - Follow site-specific photography restrictions

### File Management and Organization

#### Photo Organization

1. **Automatic Categorization**
   - Photos automatically sorted by category
   - Project-based organization
   - Date and time sequencing
   - Employer and compliance tagging

2. **Metadata Standards**
   ```
   Standard Metadata:
   - GPS coordinates (when available)
   - Timestamp (accurate to second)
   - Photo category
   - Project ID
   - Employer ID (if applicable)
   - Assessment type
   - User ID
   ```

3. **File Naming Convention**
   - Format: `YYYY-MM-DD_ProjectID_Category_Sequence.jpg`
   - Example: `2024-03-15_PRJ123_Safety_001.jpg`
   - Ensures chronological organization
   - Facilitates search and retrieval

#### Storage Management

1. **Local Storage Optimization**
   - Automatic compression and optimization
   - Storage usage monitoring
   - Old file cleanup options
   - Backup and export capabilities

2. **Cloud Synchronization**
   - Automatic sync when online
   - Progress indicators for uploads
   - Retry mechanism for failed uploads
   - Conflict resolution for concurrent changes

3. **Storage Limits**
   ```
   Default Storage Limits:
   - Local cache: 2GB maximum
   - Individual photos: 5MB maximum
   - Project photos: 100 photos maximum
   - Auto-cleanup: Files older than 6 months
   ```

### Document Attachment

#### Supported File Types

1. **Image Files**
   - JPEG, PNG, HEIC (photos)
   - GIF (for simple graphics)
   - BMP, TIFF (with automatic conversion)
   - Maximum size: 10MB per file

2. **Document Files**
   - PDF (preferred for documents)
   - DOC, DOCX (Microsoft Word)
   - XLS, XLSX (Microsoft Excel)
   - PPT, PPTX (Microsoft PowerPoint)

3. **Audio Files**
   - M4A, MP3 (voice recordings)
   - WAV (high-quality audio)
   - Maximum size: 50MB per file
   - Automatic transcription where available

#### Document Capture Methods

1. **Camera Capture**
   - Direct photo capture from app
   - Document scanning mode
   - Automatic edge detection
   - Perspective correction

2. **File Upload**
   - Select from device storage
   - Import from cloud services
   - Email attachment import
   - Drag and drop support

3. **Voice Recording**
   - In-app voice recording
   - Automatic transcription
   - Background recording capability
   - Noise reduction processing

### Data Quality Standards

#### Photo Quality Requirements

1. **Technical Standards**
   ```
   Minimum Requirements:
   - Resolution: 1280x720 pixels
   - File size: At least 500KB
   - Focus: Clear and sharp
   - Lighting: Adequate for detail visibility
   - Composition: Shows relevant context
   ```

2. **Content Standards**
   - Relevant to compliance assessment
   - Clear evidence of specific conditions
   - Includes reference points for scale
   - Shows both positive and negative examples

3. **Documentation Standards**
   - Descriptive captions explaining photo significance
   - Date, time, and location accuracy
   - Context explanation for clarity
   - Assessment relevance noted

#### Validation and Verification

1. **Automated Quality Checks**
   - Image quality assessment
   - File format validation
   - Size and resolution verification
   - Metadata completeness checking

2. **Content Validation**
   - Category appropriateness checking
   - Duplicate detection
   - Privacy compliance verification
   - Documentation completeness review

3. **Manual Review Process**
   - Quality score assignment
   - Improvement suggestions
   - Review workflow for verification
   - Approval process for critical documentation

---

## Post-Visit Actions

### Data Submission and Synchronization

#### Immediate Post-Visit Actions

1. **Site Visit Completion**
   - Complete site visit recording dialog
   - Confirm visit reasons and duration
   - Review captured data for completeness
   - Submit visit record for processing

2. **Data Validation Check**
   - Review all entered data for errors
   - Confirm photo and document attachments
   - Validate required field completion
   - Check for duplicate or conflicting information

3. **Local Save Confirmation**
   - Ensure all data saved locally
   - Verify offline sync queue status
   - Confirm backup creation
   - Check data integrity indicators

#### Synchronization Process

1. **Automatic Sync**
   ```
   Sync Triggers:
   - Internet connection detected
   - App backgrounded with data pending
   - Manual sync initiated
   - Scheduled sync interval reached

   Sync Priority:
   1. Site visit records (highest)
   2. Compliance assessments
   3. Project mapping data
   4. Photo evidence (largest files)
   ```

2. **Sync Status Monitoring**
   - Real-time sync progress indicators
   - Success/failure notifications
   - Retry mechanism for failed uploads
   - Conflict resolution prompts when needed

3. **Data Verification**
   - Server-side data validation
   - Duplicate detection and merging
   - Quality scoring and feedback
   - Integration with main database

### Follow-up Task Creation

#### Automatic Task Generation

1. **Compliance Follow-up Tasks**
   - Automatically created for red/amber ratings
   - Assigned based on severity and urgency
   - Include specific action requirements
   - Set deadlines based on priority

2. **Delegate Development Tasks**
   - Created when potential delegates identified
   - Include training and development requirements
   - Set follow-up contact schedules
   - Track delegate progress over time

3. **Site Visit Follow-up**
   - Scheduled based on compliance findings
   - Frequency determined by rating level
   - Includes specific objectives for next visit
   - Assigned to appropriate organiser

#### Manual Task Creation

1. **Custom Task Types**
   - Union membership campaigns
   - EBA negotiation support
   - Safety complaint resolution
   - Worker dispute assistance

2. **Task Assignment**
   - Assign to specific organisers or teams
   - Set priority levels and deadlines
   - Include required resources and tools
   - Define success criteria

3. **Task Management**
   - Progress tracking and status updates
   - Collaboration tools for team tasks
   - Document and resource sharing
   - Deadline management and alerts

### Delegate Assignment and Management

#### Delegate Task Assignment

1. **Delegate Engagement Tasks**
   - Worker outreach and communication
   - Safety issue identification and reporting
   - Membership recruitment campaigns
   - Training and development activities

2. **Task Communication**
   - Clear task descriptions and objectives
   - Expected timelines and deadlines
   - Available resources and support
   - Success criteria and measurements

3. **Progress Monitoring**
   - Regular check-ins and updates
   - Barrier identification and removal
   - Success recognition and celebration
   - Performance feedback and coaching

#### Delegate Support System

1. **Training and Development**
   - Identify delegate skill gaps
   - Provide relevant training opportunities
   - Mentor relationships with experienced delegates
   - Ongoing education and skill building

2. **Resource Provision**
   - Union materials and documentation
   - Communication tools and templates
   - Legal support and advice
   - Network connections and relationships

3. **Performance Support**
   - Regular consultation and advice
   - Problem-solving assistance
   - Advocacy support when needed
   - Recognition and appreciation

### Reporting Requirements

#### Visit Reporting

1. **Standard Visit Report**
   ```
   Required Elements:
   - Project details and location
   - Date and duration of visit
   - Employers and subcontractors identified
   - Workforce composition data
   - Compliance assessment results
   - Issues identified and actions taken
   - Photos and evidence attached
   - Follow-up tasks created
   ```

2. **Compliance Specific Reports**
   - Traffic light rating assessments
   - Safety condition evaluations
   - Sham contracting allegations
   - EBA compliance verification
   - Worker feedback and concerns

3. **Special Incident Reports**
   - Serious safety incidents
   - Access denial incidents
   - Industrial disputes or actions
   - Media inquiries or attention
   - Legal or regulatory involvement

#### Quality Assurance

1. **Data Quality Reviews**
   - Completeness and accuracy checking
   - Consistency verification across visits
   - Trend analysis and identification
   - Performance metric calculation

2. **Follow-up Verification**
   - Task completion verification
   - Outcome assessment and measurement
   - Lessons learned and best practices
   - Process improvement recommendations

3. **Reporting Analytics**
   - Visit frequency and coverage analysis
   - Compliance trend monitoring
   - Delegate development tracking
   - Campaign effectiveness measurement

---

## Offline Operation and Sync

### Offline Capabilities

#### Full Offline Functionality

The site visit system provides complete offline capabilities:

1. **Data Capture**
   - Complete project mapping without internet
   - Full compliance audit functionality
   - Photo capture with local storage
   - Site visit recording and tracking

2. **Local Data Storage**
   ```
   Storage Allocation:
   - Site visit records: 100MB
   - Project data: 200MB
   - Photos and media: 1GB
   - Cache and temp files: 100MB
   - Total available: 1.4GB
   ```

3. **Offline Navigation**
   - Downloaded maps and project locations
   - Cached project information and contacts
   - Previous compliance history
   - Route planning and directions

#### Offline Data Management

1. **Pre-Visit Data Download**
   - Automatic data caching when online
   - Manual data refresh options
   - Priority-based data downloading
   - Storage space management

2. **Local Data Validation**
   - Real-time data validation offline
   - Business rule enforcement
   - Format checking and error detection
   - Quality scoring and feedback

3. **Offline-First Design**
   - All operations work offline first
   - Online features enhance, don't replace
   - Graceful degradation when offline
   - Clear offline status indicators

### Synchronization System

#### Intelligent Sync Process

1. **Prioritized Sync Queue**
   ```
   Sync Priority Levels:
   1. Critical: Site visit records, safety incidents
   2. High: Compliance assessments, sham contracting reports
   3. Medium: Project mapping updates, delegate information
   4. Low: Photos, documents, large media files
   5. Background: Analytics, usage data, system logs
   ```

2. **Conflict Resolution**
   - Automatic conflict detection
   - Manual resolution interface
   - Version comparison tools
   - Merge and override options

3. **Progressive Sync**
   - Small data syncs immediately
   - Large files sync when on Wi-Fi
   - Batch processing for efficiency
   - Resume capability for interrupted syncs

#### Sync Status and Monitoring

1. **Visual Indicators**
   - Green: All data synced
   - Blue: Sync in progress
   - Amber: Some data pending sync
   - Red: Sync errors or failures

2. **Detailed Status Information**
   - Number of items pending sync
   - Estimated sync completion time
   - Failed sync details and retry options
   - Last successful sync timestamp

3. **Sync Controls**
   - Manual sync initiation
   - Wi-Fi only sync option
   - Sync pause and resume
   - Sync history and logs

### Data Integrity and Recovery

#### Backup Systems

1. **Multiple Backup Layers**
   - Local device storage
   - iCloud backup (iOS)
   - Server-side backup
   - External export options

2. **Version History**
   - Automatic version creation
   - Rollback capability
   - Change tracking
   - Recovery points

3. **Data Recovery**
   - Deleted data recovery
   - Corrupted data repair
   - Lost device data restoration
   - Emergency data export

#### Error Handling

1. **Sync Error Management**
   - Automatic retry with exponential backoff
   - Manual retry options
   - Error categorization and prioritization
   - User notification and guidance

2. **Data Corruption Prevention**
   - Checksum verification
   - Data validation on sync
   - Backup before sync operations
   - Rollback on corruption detection

3. **Network Error Handling**
   - Intermittent connection management
   - Timeout and retry logic
   - Network quality assessment
   - Adaptive sync strategies

### Performance Optimization

#### Offline Performance

1. **Local Database Optimization**
   - Indexed queries for fast access
   - Cached frequently accessed data
   - Lazy loading of large datasets
   - Background data processing

2. **Storage Management**
   - Automatic cleanup of old data
   - Compression of large media files
   - Storage space monitoring
   - User control over data retention

3. **Memory Management**
   - Efficient memory usage
   - Garbage collection optimization
   - Background task management
   - Memory leak prevention

#### Sync Optimization

1. **Delta Sync Technology**
   - Only sync changed data
   - Binary diff for large files
   - Compression during transfer
   - Interruptible transfers

2. **Bandwidth Management**
   - Adaptive quality settings
   - Network condition awareness
   - Priority-based bandwidth allocation
   - Cost-conscious sync options

---

## Troubleshooting

### Connectivity Issues

#### No Internet Connection

**Problem**: App shows "Offline mode" or cannot sync data

**Immediate Solutions**:
1. **Check Physical Connection**
   - Verify cellular data is enabled
   - Check Wi-Fi connection status
   - Test other apps for internet access
   - Restart phone if necessary

2. **Network Settings Check**
   - Settings → Cellular → Cellular Data (ensure ON)
   - Settings → Wi-Fi → Select known network
   - Settings → Airplane Mode (ensure OFF)
   - Settings → Carrier → Update carrier settings

3. **App-Specific Troubleshooting**
   - Force close and reopen the app
   - Check app has necessary permissions
   - Clear app cache if needed
   - Reinstall app if persistent issues

**Field Workarounds**:
- Continue working offline - all data will be saved locally
- Use mobile hotspot if available
- Note sync issues for later resolution
- Document any connectivity problems

**When to Report**:
- Persistent offline mode in known good coverage areas
- Data failing to sync after multiple attempts
- Sync errors persisting after troubleshooting
- Multiple sites experiencing similar issues

#### Poor Connection Quality

**Problem**: Slow data loading or sync failures

**Assessment Steps**:
1. **Connection Quality Test**
   - Speed test using browser or dedicated app
   - Check signal strength indicator
   - Test with different connection types
   - Compare with nearby devices

2. **App Performance Check**
   - Monitor app response times
   - Check sync progress indicators
   - Note specific functions failing
   - Test with different app features

**Optimization Strategies**:
- Enable "Wi-Fi only sync" in settings
- Use lower quality photo settings
- Work in offline mode during poor connectivity
- Batch data entry for better efficiency

### GPS and Location Issues

#### GPS Not Working

**Problem**: Cannot detect current location or nearby projects

**Immediate Solutions**:
1. **Location Services Check**
   - Settings → Privacy → Location Services → System Services → Location Services (ON)
   - Settings → Privacy → Location Services → CFMEU → "While Using"
   - Ensure location accuracy is set to "High"

2. **GPS Reset Procedures**
   - Toggle Location Services off/on
   - Restart the iPhone
   - Toggle Airplane Mode off/on
   - Update iOS if outdated

3. **Environmental Considerations**
   - Move to open area away from buildings
   - Wait 30 seconds for GPS acquisition
   - Check for tall building interference
   - Verify weather isn't affecting GPS

**Field Workarounds**:
- Use manual project search instead of GPS detection
- Enter project address manually
- Use offline maps and directions
- Note GPS issues for later resolution

#### Inaccurate Location

**Problem**: Location showing incorrectly or drifting

**Troubleshooting Steps**:
1. **Location Accuracy Check**
   - Compare with physical surroundings
   - Check compass direction accuracy
   - Verify street-level accuracy
   - Test with different location apps

2. **Calibration Procedures**
   - Move in figure-8 pattern to calibrate compass
   - Ensure case isn't blocking GPS antenna
   - Remove from vehicle for better accuracy
   - Allow time for full GPS lock

3. **System Verification**
   - Test with Apple Maps or Google Maps
   - Compare coordinates with known locations
   - Check for system-wide GPS issues
   - Update iOS for GPS improvements

### App Performance Issues

#### App Crashing or Freezing

**Problem**: App closes unexpectedly or becomes unresponsive

**Immediate Actions**:
1. **Force Close and Restart**
   - Swipe up from bottom and hold
   - Find CFMEU app in app switcher
   - Swipe up to force close
   - Restart app from home screen

2. **Device Restart**
   - Hold power button and volume up
   - Slide to power off
   - Wait 30 seconds
   - Power on and try app again

3. **Storage Check**
   - Settings → General → iPhone Storage
   - Ensure adequate free space (1GB+ recommended)
   - Clear unused apps and data if needed
   - Check available memory

**Data Recovery**:
- Most data saved automatically to local storage
- Check that data syncs when app restarts
- Verify recent entries are preserved
- Report any data loss immediately

#### Slow App Performance

**Problem**: App responding slowly or lagging

**Performance Optimization**:
1. **App-Specific Solutions**
   - Close other apps running in background
   - Clear app cache in settings
   - Reduce photo quality settings
   - Enable low data usage mode

2. **Device Optimization**
   - Restart device to clear memory
   - Free up storage space
   - Update iOS for performance improvements
   - Check for battery optimization settings

3. **Workload Management**
   - Process data in smaller batches
   - Use offline mode for better responsiveness
   - Limit concurrent operations
   - Save frequently to prevent data loss

### Data Sync Issues

#### Data Not Syncing

**Problem**: Changes made not appearing on server

**Troubleshooting Steps**:
1. **Sync Status Check**
   - Check sync indicator in app
   - Review sync history and logs
   - Verify internet connection
   - Check for sync error messages

2. **Manual Sync Initiation**
   - Find sync button in app settings
   - Initiate manual sync
   - Monitor sync progress
   - Note any error messages

3. **Data Validation**
   - Check data completeness
   - Verify required fields are filled
   - Ensure photo attachments are proper format
   - Validate data formats and constraints

**Recovery Procedures**:
- Export data locally for backup
- Try sync from different network
- Clear sync queue and restart
- Contact support if issues persist

#### Sync Conflicts

**Problem**: Multiple versions of same data causing conflicts

**Resolution Options**:
1. **Automatic Resolution**
   - App will attempt automatic merging
   - Most recent changes typically take priority
   - Non-conflicting changes auto-merged
   - Check results for accuracy

2. **Manual Resolution**
   - Review conflict details in app
   - Choose which version to keep
   - Manually merge conflicting data
   - Verify final data integrity

3. **Prevention Strategies**
   - Avoid multiple devices editing same data
   - Sync frequently to prevent divergence
   - Use offline mode for single-device editing
   - Coordinate with other users

### Photo and Media Issues

#### Camera Not Working

**Problem**: Cannot take photos within app

**Solutions**:
1. **Permission Check**
   - Settings → Privacy & Security → Camera → CFMEU → Allow
   - Restart app after granting permission
   - Test with native Camera app
   - Check for iOS camera restrictions

2. **App-Specific Camera Issues**
   - Force close and restart app
   - Restart device
   - Update iOS version
   - Reinstall app if necessary

3. **Storage Check**
   - Verify adequate device storage
   - Check photo library space
   - Clear recently deleted photos
   - Manage storage in Settings → General → iPhone Storage

#### Photo Quality Issues

**Problem**: Photos blurry, dark, or poor quality

**Improvement Steps**:
1. **Camera Settings Check**
   - Clean camera lens thoroughly
   - Check for protective case obstruction
   - Enable HDR for challenging lighting
   - Use proper lighting techniques

2. **Photography Best Practices**
   - Keep phone steady when shooting
   - Allow camera to focus before shooting
   - Use adequate lighting
   - Include scale reference objects

3. **Technical Solutions**
   - Check camera focus and exposure
   - Use back camera for better quality
   - Enable grid for better composition
   - Consider external lighting for poor conditions

### Account and Authentication Issues

#### Login Problems

**Problem**: Cannot login to app or account locked

**Resolution Steps**:
1. **Credential Verification**
   - Verify username and password
   - Check for caps lock
   - Ensure using CFMEU credentials (not personal)
   - Reset password if needed through official channels

2. **Account Status Check**
   - Verify account is active
   - Check for account lockout
   - Confirm role and permissions
   - Contact administrator if issues persist

3. **System Status**
   - Check for system-wide outages
   - Verify maintenance schedules
   - Test with different network
   - Contact IT support for system issues

#### Permission Errors

**Problem**: Cannot access certain features or data

**Troubleshooting**:
1. **Role Verification**
   - Confirm assigned role in system
   - Check patch assignments
   - Verify permission level
   - Contact administrator for role changes

2. **Data Access Issues**
   - Verify project assignments
   - Check geographic restrictions
   - Confirm time-based access rules
   - Report access issues to supervisor

---

## Best Practices

### Pre-Visit Planning Best Practices

#### Route Optimization

1. **Geographic Efficiency**
   - Group nearby projects to minimize travel time
   - Consider traffic patterns and peak hours
   - Plan routes to minimize backtracking
   - Use app's mapping features for route planning

2. **Site Access Timing**
   - Schedule visits during worker presence
   - Avoid meal breaks and shift changes
   - Consider site-specific access restrictions
   - Plan around site schedules and deliveries

3. **Contingency Planning**
   - Have backup project options
   - Plan for weather contingencies
   - Prepare alternative access routes
   - Build flexibility into daily schedule

#### Equipment Preparation

1. **Device Readiness**
   - Fully charge devices before departure
   - Bring backup power sources
   - Test all app functions before leaving
   - Ensure protective cases are secure

2. **Documentation Preparation**
   - Print backup forms for critical data
   - Bring physical notebooks for notes
   - Prepare site-specific checklists
   - Have business cards ready for contacts

3. **Safety Preparation**
   - Verify required PPE for each site
   - Check site-specific safety requirements
   - Bring first aid supplies
   - Have emergency contact information ready

### On-Site Data Collection Best Practices

#### Professional Conduct

1. **Union Representation Standards**
   - Maintain professional appearance and demeanor
   - Clearly identify yourself and your role
   - Explain rights and responsibilities clearly
   - Build relationships based on respect and trust

2. **Safety First Approach**
   - Prioritize personal safety at all times
   - Follow all site safety procedures
   - Wear required PPE without exception
   - Report safety concerns immediately

3. **Effective Communication**
   - Listen actively to worker concerns
   - Explain complex issues clearly
   - Use appropriate language for audience
   - Document commitments and follow-up items

#### Data Quality Standards

1. **Accuracy Requirements**
   - Verify information with multiple sources when possible
   - Double-check data entry for errors
   - Use precise measurements and descriptions
   - Cross-reference with existing records

2. **Completeness Standards**
   - Fill all required fields completely
   - Provide detailed descriptions and context
   - Include all relevant employers and contractors
   - Document unknown or uncertain information

3. **Consistency Principles**
   - Use standard terminology and classifications
   - Apply consistent rating criteria
   - Maintain consistent data formats
   - Follow established procedures consistently

#### Evidence Collection Standards

1. **Photographic Evidence**
   - Focus on conditions, not people
   - Include context and scale references
   - Ensure good lighting and focus
   - Add descriptive captions

2. **Documentation Standards**
   - Use clear, objective language
   - Include specific details and examples
   - Note dates, times, and locations
   - Reference relevant standards or regulations

3. **Privacy Protection**
   - Obtain consent for photographs of individuals
   - Blur faces when workers are included
   - Avoid photographing sensitive areas
   - Respect privacy and confidentiality

### Mobile App Usage Best Practices

#### Battery and Performance Management

1. **Battery Conservation**
   - Lower screen brightness in bright conditions
   - Close background apps when not needed
   - Use battery-saving mode when appropriate
   - Monitor battery levels throughout day

2. **Performance Optimization**
   - Restart app if performance degrades
   - Clear cache regularly for better performance
   - Use offline mode for faster response
   - Limit concurrent operations

3. **Data Management**
   - Sync regularly to prevent data loss
   - Monitor storage usage
   - Delete unnecessary photos and files
   - Export important data for backup

#### Data Entry Efficiency

1. **Form Navigation**
   - Use tab order for efficient data entry
   - Take advantage of auto-complete features
   - Use voice-to-text for longer descriptions
   - Master keyboard shortcuts and gestures

2. **Quality Control**
   - Review data before submission
   - Check for completeness and accuracy
   - Verify photo attachments are clear
   - Ensure consistent formatting

3. **Offline Operation**
   - Download necessary data before leaving office
   - Work in offline mode when connection is poor
   - Monitor sync status when connection returns
   - Resolve sync conflicts promptly

### Compliance Assessment Best Practices

#### Fair and Objective Assessment

1. **Consistent Standards**
   - Apply same criteria to all employers
   - Use objective evidence for ratings
   - Avoid personal bias in assessments
   - Document reasoning for all ratings

2. **Evidence-Based Evaluation**
   - Base ratings on observable evidence
   - Collect specific examples and incidents
   - Use multiple information sources
   - Document both positive and negative findings

3. **Professional Judgment**
   - Consider context and circumstances
   - Balance compliance with practical realities
   - Recognize improvement efforts
   - Provide constructive feedback

#### Follow-up and Documentation

1. **Clear Documentation**
   - Write detailed, specific notes
   - Include dates, times, and locations
   - Quote directly when appropriate
   - Document worker comments accurately

2. **Action Planning**
   - Create specific, measurable follow-up tasks
   - Assign clear responsibilities and deadlines
   - Set realistic improvement expectations
   - Plan regular progress reviews

3. **Communication Standards**
   - Share assessment findings constructively
   - Explain rating rationale clearly
   - Provide specific improvement guidance
   - Document all communications

### Safety and Risk Management

#### Personal Safety

1. **Situational Awareness**
   - Be aware of surroundings at all times
   - Note potential safety hazards
   - Trust instincts about dangerous situations
   - Have exit strategies planned

2. **Site Safety Compliance**
   - Follow all site safety procedures
   - Wear required PPE consistently
   - Participate in site inductions when required
   - Report safety concerns to appropriate parties

3. **Emergency Preparedness**
   - Know emergency procedures
   - Have emergency contacts readily available
   - Carry first aid supplies
   - Plan for communication difficulties

#### Risk Mitigation

1. **Conflict Resolution**
   - Maintain professional demeanor during conflicts
   - De-escalate tense situations calmly
   - Know when to disengage and seek help
   - Document conflicts and resolutions

2. **Legal Compliance**
   - Understand and respect rights of entry
   - Follow privacy and documentation laws
   - Maintain appropriate boundaries
   - Seek legal advice when uncertain

3. **Professional Boundaries**
   - Maintain appropriate professional relationships
   - Avoid conflicts of interest
   - Keep personal and professional separate
   - Document all significant interactions

### Continuous Improvement

#### Learning and Development

1. **Skill Enhancement**
   - Seek feedback on assessment quality
   - Learn from experienced organisers
   - Stay updated on industry changes
   - Participate in training opportunities

2. **Process Improvement**
   - Identify inefficiencies in workflows
   - Suggest app improvements to developers
   - Share best practices with colleagues
   - Adapt processes based on experience

3. **Quality Monitoring**
   - Review own work for improvement areas
   - Seek peer reviews of assessments
   - Track personal performance metrics
   - Set professional development goals

#### Technology Adaptation

1. **Feature Utilization**
   - Learn new app features as released
   - Explore advanced functionality
   - Provide feedback for app improvements
   - Share usage tips with colleagues

2. **Problem Resolution**
   - Report technical issues promptly
   - Document solutions for future reference
   - Contribute to troubleshooting knowledge base
   - Help others resolve technical problems

3. **Innovation Contribution**
   - Suggest new features based on field experience
   - Participate in beta testing when available
   - Provide detailed feedback on usability
   - Help shape future system development

---

## Quick Reference

### Emergency Procedures

#### Immediate Safety Concerns
- **Life-threatening emergency**: Call 000 immediately
- **Serious injury**: Call 000, then notify site management
- **Safety hazard**: Report to site supervisor immediately
- **Access denied**: Contact supervisor, document details

#### Technical Emergencies
- **App crash**: Force close and restart, check data integrity
- **Data loss**: Check local backups, contact support
- **Device failure**: Use backup device, manual forms
- **Security breach**: Contact IT support immediately

### Contact Information

#### Technical Support
- **App issues**: Contact IT support team
- **Data sync problems**: Check status, then contact support
- **Account issues**: Contact system administrator
- **Urgent issues**: Call support hotline

#### Union Support
- **Field support**: Contact lead organiser
- **Legal advice**: Contact union legal department
- **Safety concerns**: Contact union safety officer
- **Emergency assistance**: Call union headquarters

### Performance Metrics

#### Site Visit Targets
- **Visit frequency**: Minimum monthly for active sites
- **Data quality**: 95% completeness target
- **Photo evidence**: Minimum 3 photos per compliance issue
- **Follow-up compliance**: 100% of red/amber ratings addressed

#### App Usage Standards
- **Battery management**: Minimum 8 hours field operation
- **Data sync**: 95% successful sync rate
- **Offline capability**: Full functionality without internet
- **Response time**: <3 seconds for most operations

---

*This guide is designed to help you effectively use the Site Visit Workflow System. For technical support or questions about the system, contact your system administrator or IT support team.*