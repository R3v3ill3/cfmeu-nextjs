# CFMEU Organiser Platform User Guide

This guide provides an overview of the CFMEU Organiser Platform for Administrators, Co-ordinators, and Organisers. It covers the key features, pages, and workflows to help you get started with testing and using the application.

## 1. Overview of Features

The CFMEU Organiser Platform is a comprehensive tool designed to streamline the work of union organisers. It provides a centralized system for managing projects, employers, workers, and organising activities.

Key features include:

*   **Dashboard:** A central hub for viewing key metrics, recent activities, and important updates.
*   **Project Management:** Track construction projects, including details about builders, contracts, and job sites.
*   **Employer and Worker Database:** Maintain a comprehensive database of employers and workers, with detailed profiles and history.
*   **Patch Management:** Organise and manage geographic areas ("patches") for organisers, including site assignments and tracking.
*   **Site Visits:** Record and report on site visits, including issues identified, actions taken, and follow-ups.
*   **Campaigns:** Create and manage organising campaigns, track activities, and measure progress.
*   **Mapping:** Visualize projects, sites, and patches on an interactive map.
*   **User Management (Admins & Co-ordinators):** Manage user accounts, roles, and permissions.
*   **Data Import/Export:** Tools for importing and exporting data for analysis and reporting.

## 2. Page Summaries

Here is a brief summary of the main pages available in the platform. Access to these pages may vary based on your user role.

*   **Dashboard (`/`):** The landing page after logging in. It provides a high-level overview of key statistics and activities.
*   **Projects (`/projects`):** A list of all construction projects. You can view project details, search, and filter projects.
*   **Employers (`/employers`):** A database of all employers. It allows for searching, viewing employer profiles, and managing employer-related information.
*   **Workers (`/workers`):** A database of all workers. It provides access to worker profiles, work history, and membership status.
*   **Map (`/map`):** An interactive map showing the locations of projects, job sites, and organisational patches.
*   **Patch (`/patch`):** (Organisers, Co-ordinators, Admins) A dedicated page for managing your assigned patch, including sites, workers, and activities.
*   **Site Visits (`/site-visits`):** (Organisers, Co-ordinators, Admins) A log of all site visits. You can record new visits, view past reports, and track follow-up actions.
*   **Campaigns (`/campaigns`):** (Organisers, Co-ordinators, Admins) A tool for managing and tracking organising campaigns.
*   **Co-ordinator Console (`/lead`):** (Co-ordinators, Admins) A management console for Co-ordinators to oversee organisers, manage patch assignments, and review activities.
*   **Administration (`/admin`):** (Admins and Co-ordinators) A section for system administration, including user management, data uploads, and system settings.

## 3. Page Breakdown

This section provides a detailed look at each page, outlining its purpose, features, and the specific actions available to different user roles.

### 3.1 Dashboard (`/`)

The Dashboard is the first page you see after logging in. It offers a real-time, role-specific overview of organising activities and key performance indicators.

**Common Elements:**

*   **Compliance Alerts:** Highlights potential compliance issues that require attention.
*   **EBA Coverage:** Displays statistics related to Enterprise Bargaining Agreement coverage across projects.
*   **Project Metrics:** Provides a summary of projects in different stages (e.g., active construction, pre-construction).
*   **Organising Universe Summary:** A comprehensive, filterable summary of organising metrics. You can filter by project tier, stage, universe, and EBA status.

**Role-Specific Views:**

*   **For Organisers:**
    *   Your dashboard will display a set of cards, each representing a "Patch" assigned to you.
    *   Each patch card shows key metrics, such as the number of active projects, EBA coverage, and builder information.
    *   You can click on a patch card to navigate to the detailed **Patch page** (`/patch`) or view all **Projects** (`/projects`) within that patch.

*   **For Co-ordinators (`lead_organiser`):**
    *   You will see a "Co-ordinator Summary" card that provides an overview of all the patches and organisers you manage.
    *   This card is expandable, allowing you to see a breakdown of each patch within your area of responsibility.
    *   From here, you can navigate to individual **Patch pages** or filtered **Project lists**.

*   **For Admins:**
    *   The admin dashboard provides the highest-level view, displaying a summary for all Co-ordinators in the system.
    *   Each Co-ordinator has an expandable summary card, showing their assigned patches and organisers.
    *   This allows admins to monitor the overall performance of the organising team and drill down into specific areas as needed.

### 3.2 Projects (`/projects`)

This page is the central repository for all construction projects. It's a powerful tool for tracking, managing, and analyzing project data across the union's territory.

**Key Features:**

*   **Multiple Views:** You can switch between different views to visualize project data:
    *   **Card View (Default):** Displays each project as a detailed card, showing key information like the builder, EBA status, key contractor coverage, and assigned patch/organiser.
    *   **List View:** A compact, tabular view of projects, suitable for quickly scanning a large number of entries.
    *   **Map View:** An interactive map that plots the geographical location of each project, helping to visualize their distribution.

*   **Powerful Filtering and Sorting:**
    *   A comprehensive set of filters allows you to narrow down the project list based on various criteria, including:
        *   **Project Tier:** (e.g., Tier 1, Tier 2)
        *   **Organising Universe:** (Active, Potential, Excluded)
        *   **Project Stage:** (e.g., Pre-construction, Construction)
        *   **EBA Status:** (e.g., Builder EBA Active)
        *   **Patch:** (Filter by one or more organiser patches)
    *   You can also sort the projects by name, value, tier, and other metrics.

*   **Quick Actions:**
    *   From a project card, you can directly navigate to the full **Project Detail page** or open the **Mapping Sheets** for that project.
    *   You can also view high-level details about the primary builder and other contractors.

**Workflow by Role:**

*   **For Organisers:**
    *   You can view all projects, but you will likely focus on projects within your assigned patch(es). You can use the "Patch" filter to see your specific projects.
    *   You are able to **create new projects**. The "New Project" button opens a form where you can enter all the initial details of a project, including its name, address, value, and builder. This is a critical step for getting new projects into the system for tracking.

*   **For Co-ordinators:**
    *   You have the same capabilities as Organisers but will use the page to get a broader overview of all projects your team is responsible for.
    *   You can use the filters to review the pipeline of work for your organisers, track the status of key projects, and ensure data is being entered correctly.

*   **For Admins:**
    *   You have full access to all projects and all filtering capabilities.
    *   The Projects page is a key tool for you to conduct high-level analysis of construction activity, monitor the overall project landscape, and manage the master project database.

### 3.3 Employers (`/employers`)

The Employers page is a comprehensive database of all companies the union interacts with, from major builders to small subcontractors.

**Key Features:**

*   **Multiple Views:**
    *   **Card View (Default):** Each employer is shown as a card with key details like their name, ABN, contact information, and EBA status.
    *   **List View:** A compact table view for quickly scanning and sorting employers.

*   **Filtering and Sorting:**
    *   **Search:** A powerful search bar to find employers by name, ABN, or other contact details.
    *   **Engagement Filter:** You can toggle between viewing "Engaged" employers (those active on projects or with recent EBA activity) and all employers.
    *   **EBA Status Filter:** Filter employers based on their EBA status (e.g., Active, Lodged, No EBA).
    *   **Contractor Type:** Filter by the type of contractor, such as Builder, Large Contractor, etc.
    *   **Sorting:** Sort the list by name, estimated number of workers, or the recency of their EBA.

*   **Detailed Employer Profiles:**
    *   Clicking on any employer opens a detailed modal view. This modal provides a comprehensive look at the employer, including:
        *   An **overview** with their contact details and corporate structure.
        *   A list of **projects** they are associated with.
        *   Their **EBA history**.
        *   A list of **workers** linked to them.

**Workflow by Role:**

*   **For Organisers, Co-ordinators, and Admins:**
    *   The workflow on this page is broadly similar for all roles. The primary use is to look up information about specific employers.
    *   You can use this page to check an employer's EBA status before a site visit, see what other projects a contractor is working on, or find contact details.
    *   There is no direct "Create Employer" functionality on this page. New employers are typically added to the system through project mapping sheets or data import processes managed by Admins.

### 3.4 Workers (`/workers`)

The Workers page is the central database for all workers known to the union. It's designed for searching, viewing, and managing worker information.

**Key Features:**

*   **Multiple Views:**
    *   **Card View (Default):** Displays each worker in a card format, showing a summary of their key details, including their name, member number (if applicable), and contact information.
    *   **List View:** A more compact, tabular format that is useful for quickly scanning through a large list of workers.

*   **Advanced Filtering and Sorting:**
    *   **Search:** Find workers by name, email, or phone number.
    *   **Membership Status:** Filter the list to show only CFMEU Members, Non-members, or all workers.
    *   **Project Tier:** Filter workers based on the tier of projects they have been placed on.
    *   **Employer:** Filter to see all workers associated with a specific employer.
    *   **Incolink Status:** Filter workers based on whether they have an Incolink record.
    *   **Sorting:** Sort the worker list by name, member number, or the number of placements they have had.

*   **Detailed Worker Profiles:**
    *   Clicking on a worker opens a detailed modal. This view provides a complete profile of the worker, including:
        *   Personal and contact details.
        *   Union membership information.
        *   A history of their work placements on various projects.
        *   Any union roles they may hold (e.g., delegate, HSR).
        *   Training and induction records.

**Workflow by Role:**

*   **For Organisers, Co-ordinators, and Admins:**
    *   The functionality on this page is consistent across all three roles. The primary use is for information retrieval.
    *   Before visiting a site, you can look up workers to check their membership status or work history.
    *   The detailed worker profile is crucial for understanding a worker's engagement with the union and their experience in the industry.
    *   Similar to the Employers page, new workers are generally added to the system via data imports or when they are linked to a project, rather than through a direct "Create Worker" button on this page.

### 3.5 Patch (`/patch`)

This page is the primary workspace for **Organisers** and is also accessible to **Co-ordinators** and **Admins** for oversight. It provides a focused view of a specific geographical "patch."

**Key Features:**

*   **Patch Selector:** Co-ordinators and Admins can switch between different patches using a dropdown menu to view the workspace of different organisers. For Organisers, this will be locked to their assigned patch(es).
*   **Patch Overview:** A header section displays key information about the selected patch, including its name, the assigned organiser(s), and high-level metrics (e.g., total projects, EBA coverage).
*   **Interactive Map:** A prominent map visualizes the boundaries of the patch and the locations of all projects within it. This is a key tool for planning site visits and understanding the geographic layout of the work.
*   **Project List:** A filterable and sortable table lists all the projects within the patch. You can search for specific projects or filter by tier, universe, stage, etc., similar to the main Projects page.
*   **Quick Actions:** From the project list, you can perform several actions:
    *   **Create a Visit Sheet:** Opens the form to log a new site visit for a project.
    *   **View Worker List:** Navigates to a filtered view of the Workers page, showing all workers on that specific project.

**Workflow by Role:**

*   **For Organisers:**
    *   This is your main day-to-day page. It gives you a complete overview of your assigned area.
    *   You'll use the map to plan your travel and the project list to prepare for site visits.
    *   The quick actions make it easy to log your visit reports and check who is on a particular site.

*   **For Co-ordinators:**
    *   You can use the patch selector to review the work of the organisers you manage.
    *   This page allows you to monitor the activity levels in each patch, check the status of key projects, and provide support to your team.

*   **For Admins:**
    *   You have full visibility across all patches.
    *   This page is useful for understanding how the work is distributed geographically and for getting a detailed view of on-the-ground organising activities.

### 3.6 Site Visits (`/site-visits`)

This page is a log of all on-the-ground interactions and is accessible to **Organisers, Co-ordinators, and Admins**. It's crucial for maintaining a record of site activities and ensuring compliance.

**Key Features:**

*   **Recent Visits Table:** The main part of the page is a table listing recent site visits. It includes essential details like the date, the organiser who conducted the visit, the project and site, the employer(s) involved, and a summary of the notes.
*   **New Visit Form:** The "New Visit" button opens a comprehensive form to log a new site visit. The process is as follows:
    1.  **Select Project and Site:** You first select the project and then the specific job site you visited.
    2.  **Select Employers:** The form will then show a list of all employers known to be on that site. You can select one, multiple, or all employers that were part of the visit.
    3.  **Enter Details:** You then fill in the date of the visit, your notes (observations, issues, etc.), and any actions that were taken.
*   **Compliance Integration:** When you log a new visit for an employer, the system automatically creates a placeholder compliance check record for that employer. This serves as a reminder to follow up on compliance items like CBUS and Incolink checks, which can be updated in more detail from the employer's profile.

**Workflow by Role:**

*   **For Organisers:**
    *   This is a primary data entry page for you. After every site visit, you should come here to log the details.
    *   Your name will be automatically selected in the "Organiser" field. Your main task is to accurately select the site and employers and provide clear, concise notes.

*   **For Co-ordinators:**
    *   You can view all site visits conducted by the organisers on your team.
    *   When creating a new visit, you can select the relevant organiser from a dropdown list, allowing you to log a visit on behalf of one of your team members if necessary.
    *   This page is a key tool for you to monitor the frequency and quality of site visits across your patches.

*   **For Admins:**
    *   You have a complete overview of all site visits across the entire organisation.
    *   You can also log visits on behalf of any organiser.
    *   This provides a valuable dataset for analysing organising activity, identifying trends in site issues, and ensuring records are being kept accurately.

### 3.7 Co-ordinator Console (`/lead`)

This page is a dedicated management hub for **Co-ordinators** and **Admins**. It provides tools to manage the structure of organising work.

**Key Features:**

*   **Summary Statistics:** At the top of the page, Co-ordinators will see a summary of their area of responsibility, including the total number of patches they manage, the number of active organisers, and the total number of projects in their patches.
*   **Organiser Assignment Tool:** This is the core feature of the page. It's a simple form that allows you to:
    1.  Select an **Organiser** from a dropdown list of all available organisers.
    2.  Select a **Patch** from a dropdown list of all patches managed by you.
    3.  Click "Assign" to create the link between that organiser and the patch.
*   **Current Assignments Table:** A table displays all the current assignments of organisers to patches. This gives you a clear overview of who is responsible for which area.

**Workflow by Role:**

*   **For Organisers:**
    *   This page is not visible or accessible to you.

*   **For Co-ordinators (`lead_organiser`):**
    *   This is your primary tool for managing your team. You will use this page to:
        *   Assign new organisers to their patches.
        *   Re-assign patches if an organiser's responsibilities change.
        *   Get a quick overview of your team's structure and workload.

*   **For Admins:**
    *   You have a super-user view of this console. While a Co-ordinator sees only the patches and organisers they manage, you can see and manage assignments across the entire organisation.
    *   This allows you to handle high-level restructuring, such as assigning a patch to a different Co-ordinator's team or managing the master list of organisers.

### 3.8 Administration / Management (`/admin`)

This page is the central control panel for managing the platform itself. Access is restricted to **Admins** and **Co-ordinators**, with different sets of tools available to each role. The page is titled "Administration" for Admins and "Co-ordinator Management" for Co-ordinators.

**For Co-ordinators (`lead_organiser`):**

You have access to a set of tools focused on managing your team and data:

*   **Invites:** This is your primary area. You can view pending invitations for new users and invite new Organisers to the platform.
*   **Patches:** You can manage the patches that are under your area of responsibility.
*   **Scoping:** This allows you to define data visibility rules for the organisers on your team.
*   **Data Management:** You have access to tools for uploading data and resolving duplicate employer records, which is crucial for maintaining data quality.

**For Admins:**

You have full access to all administrative functions, including all the tools available to Co-ordinators, plus several more advanced features:

*   **Users:** A complete list of all active users on the platform. You can manage user roles and profiles from here.
*   **Hierarchy:** A tool to define the reporting structure of the union, establishing the relationships between Co-ordinators and the Organisers they manage.
*   **Spatial Assignment:** A map-based tool for visually drawing and assigning the geographical boundaries of patches.
*   **Navigation:** You can control which main navigation items (e.g., Projects, Employers, Map) are visible to users.
*   **System Health:** A dashboard for monitoring the technical performance and health of the application.

---
This guide provides an initial overview of the platform. As you begin testing, please use the Fider feedback tool (`fider.uconstruct.app`) to report any bugs, suggest feature improvements, or share your thoughts on the user experience. Your feedback is essential for making this platform a powerful tool for all organisers.
