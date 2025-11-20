# Fantasy Football League Manager - Design Guidelines

## Design Approach

**Selected Approach:** Design System (Material Design + Custom Dark Theme)
**Rationale:** Utility-focused dashboard application requiring clear information hierarchy, form handling, and data display. Material Design provides excellent patterns for cards, lists, and interactive elements while allowing customization for the dark theme with light blue accents.

## Core Design Elements

### Typography
- **Primary Font:** Inter (Google Fonts) - clean, highly legible for data-heavy interfaces
- **Headings:** 
  - H1: 32px/40px, font-weight 700 (Page titles)
  - H2: 24px/32px, font-weight 600 (Section headers)
  - H3: 18px/24px, font-weight 600 (Card titles)
- **Body Text:** 16px/24px, font-weight 400
- **Small/Meta Text:** 14px/20px, font-weight 400 (league info, timestamps)

### Layout System
**Tailwind Spacing Units:** Consistently use 4, 6, 8, 12, 16 for predictable rhythm
- Component padding: p-6 to p-8
- Section spacing: space-y-8 or space-y-12
- Card gaps: gap-6
- Form field spacing: space-y-4

**Container Strategy:**
- Max-width: max-w-4xl for main content (optimal for forms and lists)
- Centered layouts: mx-auto
- Full-width dashboard when showing multiple leagues

### Component Library

**Authentication/Sign Up:**
- Centered card layout (max-w-md mx-auto)
- Clean form with input fields stacked vertically (space-y-4)
- Large, prominent CTA button
- Minimal branding at top

**League Linking Interface:**
- Clear instructional text explaining how to find ESPN league URL/ID
- Single prominent input field for league URL or ID
- "Connect League" primary action button
- Visual feedback on successful connection

**League List/Dashboard:**
- Card-based grid layout (grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6)
- Each league card contains:
  - League name (H3 typography)
  - League image/logo placeholder
  - Key metadata: Sport type, Season, Team count
  - "Select League" button or entire card clickable
  - Subtle hover state (elevation/border glow)

**Selected League View:**
- Full-width header showing selected league name
- Breadcrumb or back button to return to league list
- Placeholder for future features (standings, team info, etc.)

**Navigation:**
- Top app bar with site logo/name left-aligned
- User account info right-aligned
- Logout option in dropdown menu

### Icons
**Library:** Heroicons (outline style via CDN)
- Dashboard icon for home/leagues
- Link icon for connecting leagues
- User icon for profile
- Logout icon
- Check/success icons for confirmations

### Component Structure

**Card Pattern:**
```
- Rounded corners (rounded-lg)
- Consistent padding (p-6)
- Elevation through subtle borders with light blue accent
- Hover state with border glow intensification
```

**Buttons:**
- Primary: Full width on mobile, auto width on desktop
- Height: h-12
- Padding: px-6
- Rounded: rounded-lg
- Font weight: font-semibold

**Form Inputs:**
- Height: h-12
- Padding: px-4
- Rounded: rounded-lg
- Border with light blue accent on focus
- Clear label above each input (mb-2)

### Interaction Patterns

**Loading States:**
- Skeleton cards for league loading
- Spinner for form submissions
- Disable buttons during processing

**Empty States:**
- Centered illustration or icon
- Clear message: "No leagues connected yet"
- Primary CTA to connect first league

**Success Feedback:**
- Toast notification on successful league connection
- Visual confirmation (checkmark) when league appears in list

### Responsive Behavior
- **Mobile (base):** Single column, stacked layouts, full-width buttons
- **Tablet (md:):** Two-column league grid
- **Desktop (lg:):** Three-column league grid, side-by-side form layouts where appropriate

### Images
No hero image needed for this utility app. Use:
- ESPN logo placeholder in instructions
- League logo/image placeholders in cards (fallback to sport icon if unavailable)
- Empty state illustrations (simple, flat style icons)

### Animations
**Minimal approach:**
- Smooth transitions on hover (transition-colors duration-200)
- Fade-in for toast notifications
- NO scroll animations, complex transitions, or distracting effects