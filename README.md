# 📝 Avenster / No-Limits Notes — Notion-like Collaborative Workspace

A modern, high-polish, full-stack **Notion-like collaborative workspace** application built with React Router v8, Express.js, Prisma ORM, PostgreSQL, and BlockNote.

---

## 🌟 Key Features

### 🎨 BlockNote Rich Text Editor
- **Rich Block-Based Editing**: Supports headings, bullet lists, ordered lists, callout boxes, check-lists, toggle blocks, and dividers.
- **Interactive Code Blocks**: Code snippets with syntax highlighting powered by `highlight.js` and a floating **one-click Copy** overlay button.
- **Markdown Export**: Download any page as a standard `.md` file with one click.
- **Font & Style Customization**: Select custom editor fonts (Inter, System, Serif, Mono) from profile settings that persist dynamically across browser reloads.

### 🏢 Workspaces & Spaces (Groups)
- **Collaborative Group Spaces**: Create multiple workspaces with unique shareable join codes.
- **Role-Based Group Memberships**: Manage owners, editors, and guests within spaces.
- **Page Tree & Hierarchical Organization**: Organize notes under nested parent-child structures.

### 🔑 Authentication & Guest Access
- **Dual Authentication**: Sign in via **Google OAuth 2.0** or **GitHub OAuth** with Passport.js.
- **Instant Guest Mode**: Anonymous users can create or join groups using display names without creating an account (authenticated via signed, persistent 30-day cookies).

### 🎨 Custom Design System & Dynamic Themes
- **Light & Dark Mode**: Flawless real-time theme switcher with CSS custom variables and anti-flash inline hydration scripts.
- **Accent Color Picker**: Choose between Violet, Blue, Emerald, Rose, Amber, and Cyan accents.
- **Command Palette (`⌘K` / `Ctrl+K`)**: Instant search across all joined workspaces and pages.

### 📜 Revision History & Page Management
- **Snapshot Revision History**: Every save creates an automatic revision snapshot, allowing users to view prior versions and restore content with undoable safety.
- **Page Operations**: Duplicate pages, rename on the fly, mark favorites/bookmarks, and soft delete pages.
- **Public Share Links**: Generate public read-only URLs (`/p/:slug`) to share notes with anyone outside the workspace.
- **Recent Activity Feed**: Real-time audit log of recent page edits across all user workspaces.

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 19, React Router v8 (SSR & Client Routing)
- **Editor**: BlockNote (`@blocknote/react`, `@blocknote/mantine`, `@blocknote/core`)
- **Styling**: Tailwind CSS v4, Vanilla CSS Custom Variables System
- **Syntax Highlighting**: `highlight.js`
- **Build Tool**: Vite v8, TypeScript

### Backend
- **Runtime**: Go (`net/http`)
- **Database access**: `pgx` PostgreSQL driver with a bounded connection pool
- **Database**: PostgreSQL
- **Authentication**: GitHub and Google OAuth 2.0 with signed, HTTP-only sessions
- **Security**: Signed HTTP-only cookies, CORS credential policies

---

## 📁 Project Directory Structure

```
notion-like-app/
├── README.md
├── backend-go/                 # Production Go API; uses the existing database schema
│   ├── cmd/server/             # API entrypoint and handlers
│   ├── Dockerfile
│   └── .env.example
├── backend/                    # Legacy Express implementation (not used for new deployments)
│       ├── passport.js         # Passport OAuth strategies configuration
│       ├── prisma.js           # Shared Prisma Client instance
│       ├── routes/
│       │   ├── activity.js     # GET /activity/recent feed
│       │   ├── auth.js         # OAuth login, logout, profile updates
│       │   ├── favorite.js     # Favorite page toggles & listing
│       │   ├── group.js        # Group creation, join, member management
│       │   ├── page.js         # Page CRUD, revision history, sharing
│       │   ├── publicPage.js   # Public read-only page slug routes
│       │   └── search.js       # Global search route (⌘K)
│       └── services/
│           ├── groupStore.js   # Group DB service helper logic
│           ├── membership.js   # Group authorization & guest membership validation
│           └── pageStore.js    # Page DB service & revision snapshot helper logic
└── frontend/
    ├── package.json
    ├── vite.config.ts
    ├── app/
    │   ├── app.css             # Design tokens, themes, & utility classes
    │   ├── root.tsx            # HTML layout shell, theme hydration script, & providers
    │   ├── routes.ts           # React Router v8 sitemap definitions
    │   ├── component/
    │   │   ├── index.tsx       # Home dashboard view
    │   │   ├── CommandPalette.tsx # Global search modal (⌘K)
    │   │   └── ThemeToggle.tsx # Theme switcher component
    │   ├── lib/
    │   │   ├── auth.server.ts  # Server-side user authentication loaders
    │   │   ├── pages.server.ts # Server-side page & group fetchers
    │   │   └── theme.tsx       # React Theme Context & accent color state provider
    │   ├── login/
    │   │   └── Login.tsx       # Login page view
    │   ├── pages/
    │   │   ├── create.tsx      # Create group workspace page
    │   │   ├── join.tsx        # Join group by code page
    │   │   ├── list.tsx        # Group page directory view
    │   │   ├── note.tsx        # Primary Note Editor layout & sidebar
    │   │   ├── NoteEditor.tsx  # BlockNote component wrapper & copy overlay
    │   │   └── profile.tsx     # User profile, theme settings, & font picker
    │   └── public-page/
    │       └── public-page.tsx # Public read-only note view
```

---

## 🗄️ Database Schema (`prisma/schema.prisma`)

```prisma
enum AuthProvider {
  google
  github
}

enum MemberRole {
  owner
  editor
  viewer
}

model User {
  id         String       @id @default(cuid())
  provider   AuthProvider
  providerId String
  name       String
  email      String?
  avatarUrl  String?
  createdAt  DateTime     @default(now())

  memberships GroupMember[]
  ownedGroups Group[]       @relation("GroupOwner")
  pagesCreated Page[]       @relation("PageCreatedBy")
  revisions   Revision[]
  favorites   Favorite[]
}

model Group {
  id          String   @id @default(cuid())
  name        String
  code        String   @unique
  isAnonymous Boolean  @default(true)
  ownerId     String?
  createdAt   DateTime @default(now())

  owner   User?         @relation("GroupOwner", fields: [ownerId], references: [id])
  members GroupMember[]
  pages   Page[]
}

model GroupMember {
  id        String     @id @default(cuid())
  groupId   String
  userId    String?
  guestId   String?
  guestName String?
  role      MemberRole @default(editor)
  joinedAt  DateTime   @default(now())

  group Group @relation(fields: [groupId], references: [id], onDelete: Cascade)
  user  User? @relation(fields: [userId], references: [id])
}

model Page {
  id               String   @id @default(cuid())
  groupId          String
  parentId         String?
  title            String   @default("Untitled")
  icon             String?
  content          Json     @default("{}")
  order            Int      @default(0)
  createdBy        String?
  lastEditedByName String?
  isPublic         Boolean  @default(false)
  publicSlug       String?  @unique
  updatedAt        DateTime @updatedAt
  createdAt        DateTime @default(now())

  group     Group      @relation(fields: [groupId], references: [id], onDelete: Cascade)
  parent    Page?      @relation("PageTree", fields: [parentId], references: [id])
  children  Page[]     @relation("PageTree")
  creator   User?      @relation("PageCreatedBy", fields: [createdBy], references: [id])
  revisions Revision[]
  favorites Favorite[]
}

model Revision {
  id           String   @id @default(cuid())
  pageId       String
  memberId     String?
  editedByName String?
  snapshot     Json
  createdAt    DateTime @default(now())

  page Page  @relation(fields: [pageId], references: [id], onDelete: Cascade)
  user User? @relation(fields: [memberId], references: [id])
}

model Favorite {
  id      String  @id @default(cuid())
  userId  String?
  guestId String?
  pageId  String

  page Page  @relation(fields: [pageId], references: [id], onDelete: Cascade)
  user User? @relation(fields: [userId], references: [id])
}
```

---

## 📡 Backend API Endpoints Reference

### 🔐 Auth (`/auth`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/auth/me` | Fetches currently logged-in user profile |
| `POST` | `/auth/logout` | Clears current session |
| `PUT` | `/auth/profile` | Updates user display name |
| `GET` | `/auth/google` | Initiates Google OAuth authentication |
| `GET` | `/auth/google/callback` | Google OAuth redirect callback handler |
| `GET` | `/auth/github` | Initiates GitHub OAuth authentication |
| `GET` | `/auth/github/callback` | GitHub OAuth redirect callback handler |

### 👥 Workspace Groups (`/group`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/group/my-groups` | Lists groups for current user or guest session |
| `POST` | `/group/create` | Creates a new group workspace |
| `POST` | `/group/join` | Joins a group by code (user or guest) |
| `GET` | `/group/:groupId/members` | Returns member list for a workspace |
| `PUT` | `/group/:groupId` | Renames a group workspace |
| `DELETE` | `/group/:groupId/members/me` | Leaves a group workspace |

### 📄 Pages & Revisions (`/group/:groupId/pages`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/group/:groupId/pages` | Lists all pages in a group |
| `POST` | `/group/:groupId/pages` | Creates a new page in a group |
| `GET` | `/group/:groupId/pages/:pageId` | Fetches single page content |
| `PUT` | `/group/:groupId/pages/:pageId` | Saves page title/content & captures revision snapshot |
| `DELETE` | `/group/:groupId/pages/:pageId` | Deletes a page |
| `POST` | `/group/:groupId/pages/:pageId/duplicate` | Duplicates a page |
| `GET` | `/group/:groupId/pages/:pageId/revisions` | Returns page edit history snapshots |
| `POST` | `/group/:groupId/pages/:pageId/restore/:revisionId` | Restores a page to a previous revision |
| `POST` | `/group/:groupId/pages/:pageId/share` | Toggles public link sharing (`isPublic`) |
| `POST` | `/group/:groupId/pages/:pageId/favorite` | Toggles favorite state for a page |
| `GET` | `/group/:groupId/pages/favorites` | Returns list of favorited page IDs |

### 🌐 Public Pages, Search, & Activity
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/public/pages/:slug` | Reads a public read-only page by slug |
| `GET` | `/search?q=...` | Global page search across joined workspaces |
| `GET` | `/activity/recent` | Recent edit activity feed across user workspaces |

---

## 💻 Frontend Routes Sitemap

| Path | View Component | Description |
|---|---|---|
| `/` | `app/routes/home.tsx` | Index redirect / landing page |
| `/home` | `app/component/index.tsx` | Workspace Dashboard with quick actions & recent activity |
| `/login` | `app/login/Login.tsx` | OAuth Sign-In options page |
| `/create` | `app/pages/create.tsx` | Workspace creation page |
| `/join` | `app/pages/join.tsx` | Workspace join code entry page |
| `/profile` | `app/pages/profile.tsx` | Profile settings, accent color picker, & font selector |
| `/group/:groupId/pages` | `app/pages/list.tsx` | Space directory list page |
| `/group/:groupId/pages/:pageId` | `app/pages/note.tsx` | Interactive Note Editor layout with collapsible sidebar |
| `/p/:slug` | `app/public-page/public-page.tsx` | Public read-only note view |

---

## ⚡ Local Setup & Installation Guide

### Prerequisites
- **Node.js**: `v18.x` or higher
- **PostgreSQL**: Running instance on `localhost` (Port 5432)

---

### 1️⃣ Go backend setup

Navigate to the Go backend directory:
```bash
cd backend-go
```

Create its environment file:
```bash
cp .env.example .env
```

Configure `.env` inside `backend-go/`:
```env
PORT=4000
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:4000
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/notion_app?schema=public"
SESSION_SECRET="replace-this-with-a-long-random-secret-at-least-32-characters"
# Keep this within the database's connection limit. Defaults are 20 and 2.
DB_MAX_CONNS=20
DB_MIN_CONNS=2

# OAuth Keys (Optional for Local Dev)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GOOGLE_CALLBACK_URL="http://localhost:4000/auth/google/callback"

GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"
GITHUB_CALLBACK_URL="http://localhost:4000/auth/github/callback"
```

Set a long, random `SESSION_SECRET`, configure `DATABASE_URL`, and (if needed)
configure the OAuth credentials. The GitHub callback URL in the GitHub OAuth
App must exactly match `GITHUB_CALLBACK_URL`.

The Go backend uses the existing PostgreSQL schema. For a fresh database, use
the checked-in Prisma migrations once; no data migration is needed for an
existing deployment.
```bash
cd ../backend
npx prisma migrate deploy
cd ../backend-go
```

Start the backend development server:
```bash
go run ./cmd/server
```
The server will run on **http://localhost:4000**.

### Render deployment and GitHub login

Deploy `backend-go/` as the API service (using its included Dockerfile). Set
`BACKEND_URL` to its public HTTPS URL and `FRONTEND_URL` to the public frontend
URL. Use the same long `SESSION_SECRET` as the previous Express deployment to
keep existing signed sessions valid during the cutover.

In the GitHub OAuth App, set **Authorization callback URL** to exactly:

```text
https://your-api.onrender.com/auth/github/callback
```

This must exactly equal `GITHUB_CALLBACK_URL` in Render—protocol, hostname,
and path included. Also set `COOKIE_SECURE=true` in Render. An old or incorrect
callback URL, a client secret from a different OAuth App, or a reused callback
code is what causes GitHub's “Failed to obtain access token” error.

---

### 2️⃣ Frontend Setup

Open a new terminal and navigate to the `frontend` directory:
```bash
cd frontend
```

Install dependencies:
```bash
npm install
```

Start the Vite development server:
```bash
npm run dev
```
The app will run on **http://localhost:5173**.

---

## 🛡️ License

Distributed under the MIT License.
