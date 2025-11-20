# Fantasy League Manager

## Overview

Fantasy League Manager is a full-stack web application that allows users to connect and manage their ESPN Fantasy Football leagues in a centralized dashboard. The application provides authentication, league connection via ESPN's API, and a clean interface for viewing and organizing multiple fantasy leagues.

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
- `/login` - User login page
- `/signup` - User registration page
- Protected routes automatically redirect based on authentication state

### Backend Architecture

**Server Framework**
- Express.js for HTTP server and API routing
- Session-based authentication using Passport.js with local strategy
- PostgreSQL session store for persistent sessions

**API Design**
- RESTful API endpoints under `/api` prefix
- Authentication endpoints: `/api/login`, `/api/signup`, `/api/auth/user`
- League endpoints: `/api/leagues`, `/api/leagues/connect`
- Middleware for authentication verification on protected routes

**Authentication & Security**
- Username/password authentication with bcrypt hashing (10 salt rounds)
- Express sessions with secure cookie configuration
- CSRF protection through SameSite cookie policy
- Session TTL of 7 days

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
- **ESPN Fantasy Football API**: League data retrieval
  - Accessed via `espn-fantasy-football-api` Node.js client
  - Requires CommonJS module loading (createRequire wrapper)
  - Used to fetch league information by ID and season

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
- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Secret key for session encryption
- `NODE_ENV`: Environment flag (development/production)

**Design System**
- Inter font family from Google Fonts
- Custom CSS variables for theming
- Dark mode as default with light mode support