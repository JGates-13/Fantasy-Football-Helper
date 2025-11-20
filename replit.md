# Fantasy League Manager

## Overview

Fantasy League Manager is a full-stack web application that allows users to connect and manage their ESPN Fantasy Football leagues in a centralized dashboard. The application provides username/password authentication, league connection via ESPN's API, and real-time viewing of weekly matchups and team rosters.

Users can:
- Create an account with username/password authentication
- Connect multiple ESPN Fantasy Football leagues
- Select a league to view detailed information
- View weekly matchups with scores for all teams
- Browse team rosters and player statistics

The application is built as a modern single-page application (SPA) with a clear separation between client and server, using TypeScript throughout for type safety.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System**
- React 18 with TypeScript for the UI layer
- Vite as the build tool and development server
- Wouter for lightweight client-side routing
- TanStack Query (React Query) for server state management and caching

**UI Component System**
- Shadcn/ui component library based on Radix UI primitives
- Tailwind CSS for styling with a custom design system
- Material Design-inspired approach with a dark theme focus
- Components configured in "new-york" style variant

**State Management Strategy**
- React Query handles all server state (user data, leagues)
- Local component state using React hooks for UI state
- No global state management library needed due to query-based architecture

**Routing Structure**
- `/` - Landing page (unauthenticated) or Home dashboard (authenticated)
- `/login` - User login page with username/password
- `/signup` - User registration page with username/password
- `/league/:id` - League detail page showing matchups and team rosters (protected)
- All protected routes require authentication and redirect to login if not authenticated

### Backend Architecture

**Server Framework**
- Express.js for HTTP server and API routing
- Session-based authentication using Passport.js with local strategy
- PostgreSQL session store for persistent sessions

**API Design**
- RESTful API endpoints under `/api` prefix
- Authentication endpoints: `/api/login`, `/api/signup`, `/api/logout`, `/api/auth/user`
- League management: `/api/leagues`, `/api/leagues/connect`, `/api/leagues/:id/select`
- ESPN data endpoints: `/api/leagues/:id/matchups`, `/api/leagues/:id/teams`
- All protected endpoints verify authentication and league ownership before returning data
- Middleware for authentication verification on protected routes

**Authentication & Security**
- Custom username/password authentication system (no external auth provider)
- Passport.js local strategy for authentication
- bcrypt password hashing with 10 salt rounds
- Express sessions with PostgreSQL storage
- Secure cookie configuration with httpOnly, sameSite: "lax"
- CSRF protection through SameSite cookie policy
- Session TTL of 7 days
- All user operations verify ownership before allowing access

**Data Layer**
- Drizzle ORM for type-safe database queries
- Database storage abstraction pattern (IStorage interface)
- Neon serverless PostgreSQL connection pooling

### Database Schema

**Tables**
1. `users` - User accounts with credentials
   - UUID primary key
   - Username (unique), hashed password
   - Optional: email, first name, last name, profile image
   - Timestamps for creation and updates

2. `espn_leagues` - Connected ESPN league data
   - UUID primary key
   - Foreign key to users (cascade delete)
   - ESPN league ID and season ID (composite unique constraint)
   - League metadata: name, team count
   - Selection flag for active league

3. `sessions` - Session persistence
   - Session ID primary key
   - Session data (JSON)
   - Expiration timestamp with index

**Key Constraints & Indexes**
- Unique constraint on user league + season combinations
- Cascading deletes when users are removed
- Session expiration index for cleanup queries

### External Dependencies

**Third-Party Services**
- **Neon Database**: Serverless PostgreSQL hosting
  - Connection via `@neondatabase/serverless` with WebSocket support
  - Connection string required in `DATABASE_URL` environment variable

**External APIs**
- **ESPN Fantasy Football API**: Real-time fantasy football data
  - Accessed via `espn-fantasy-football-api` Node.js client (CommonJS)
  - Endpoints used:
    - `getLeagueInfo()`: League metadata (name, size, season)
    - `getBoxscoreForWeek()`: Weekly matchup scores and results
    - `getTeamsAtWeek()`: Team rosters and player statistics
  - Supports only public ESPN leagues (private leagues require cookies)
  - All API calls wrapped in timeout protection (10-15 seconds)
  - Automatic current NFL week calculation for default data queries

**Authentication & Session Management**
- **Passport.js**: Authentication middleware framework
- **connect-pg-simple**: PostgreSQL session store adapter
- **bcrypt**: Password hashing library

**UI Component Libraries**
- **Radix UI**: Headless component primitives (@radix-ui/* packages)
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library

**Development Tools**
- **Vite**: Build tool with HMR and development server
- **Drizzle Kit**: Database migration tool
- **TypeScript**: Type checking and compilation
- **ESBuild**: Server-side bundling for production

**Environment Variables Required**
- `DATABASE_URL`: PostgreSQL connection string (Neon serverless database)
- `SESSION_SECRET`: Secret key for session encryption and signing
- `NODE_ENV`: Environment flag (development/production)
- `PORT`: Server port (defaults to 5000)

**Design System**
- Inter font family from Google Fonts
- Custom CSS variables for theming
- Dark mode as default with light mode support
## Recent Changes

**November 20, 2024**
- Migrated from Replit Auth to custom username/password authentication
  - Added username and password fields to users table
  - Implemented Passport.js local strategy authentication
  - Created login and signup pages with form validation
  - Added bcrypt password hashing for security
  - Configured secure session cookies with sameSite protection
- Added ESPN Fantasy Football data features
  - Created backend routes for fetching weekly matchups
  - Created backend routes for fetching team rosters
  - Built LeagueView page with tabs for Matchups and Team Rosters
  - Implemented real-time data fetching from ESPN API
  - Added automatic NFL week calculation for current data
  - Integrated proper error handling and loading states
- Updated navigation
  - Added /league/:id route for viewing league details
  - Updated home page with "View League" buttons
  - Improved user experience with better league selection flow
