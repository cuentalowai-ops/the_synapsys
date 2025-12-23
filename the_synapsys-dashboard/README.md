# 🎯 SYNAPSYS Dashboard

> Next.js 15 Dashboard MVP para administradores de Relying Party (RP) - Gestión de sesiones de verificación digital EUDI Wallet

[![Next.js](https://img.shields.io/badge/Next.js-15.1.3-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3.3-blue)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4.17-38bdf8)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Development](#development)
- [Backend Integration](#backend-integration)
- [Documentation](#documentation)

---

## 🌟 Overview

Dashboard administrativo para Relying Parties que permite:
- Gestionar sesiones de verificación digital
- Visualizar estadísticas en tiempo real
- Administrar múltiples wallets (Gataca, iGrant.io)
- Monitorear compliance y analytics

**Status**: ✅ MVP Core Completado (Week 8) - Pendiente integración backend

---

## ✨ Features

### Implementado (MVP)

✅ **Authentication**
- Login JWT-based
- Auto-redirect & logout
- Protected routes

✅ **Dashboard Home**
- 4 stats cards (Total, Completadas, Pendientes, Fallidas)
- Sesiones recientes (últimas 5)
- Quick actions

✅ **Sessions Management**
- Tabla completa de sesiones
- Status badges color-coded
- Filtros por wallet type

✅ **Navigation**
- Sidebar con 7 secciones
- Navbar responsive
- Mobile-friendly

### Próximamente (Week 9+)

⚠️ Backend integration
⚠️ QR code generation
⚠️ Real-time updates
⚠️ Analytics dashboard
⚠️ Compliance metrics
⚠️ Settings page

---

## 🚀 Quick Start

### Prerequisites

- Node.js 20+ (required)
- npm 9+

### Installation

```bash
# 1. Navigate to dashboard
cd the_synapsys-dashboard

# 2. Install dependencies
npm install

# 3. Install Tailwind PostCSS plugin (REQUIRED)
npm install @tailwindcss/postcss

# 4. Create environment file
cp .env.example .env.local

# 5. Edit .env.local with your backend URL
# NEXT_PUBLIC_API_URL=http://localhost:3000

# 6. Start development server
npm run dev
```

Dashboard will be available at **http://localhost:3000** (or next available port)

### First Run

The dashboard will redirect to `/login` by default. Until backend integration:
- Use mock token in localStorage: `localStorage.setItem('token', 'mock-jwt-token')`
- Refresh page to access dashboard

---

## 📁 Project Structure

```
the_synapsys-dashboard/
├── app/                          # Next.js App Router
│   ├── layout.tsx               # Root layout
│   ├── page.tsx                 # Home (→ /dashboard)
│   ├── globals.css              # Global styles
│   └── dashboard/
│       ├── layout.tsx           # Protected layout
│       ├── page.tsx             # Main dashboard
│       └── sessions/
│           └── page.tsx         # Sessions table
├── components/
│   └── dashboard/               # Dashboard UI components
│       ├── Sidebar.tsx          # Navigation
│       ├── Navbar.tsx           # Top bar
│       ├── DashboardStats.tsx   # Stats cards
│       ├── RecentSessions.tsx   # Sessions list
│       └── QuickActions.tsx     # Quick buttons
├── lib/
│   ├── hooks/                   # Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── useSessions.ts
│   │   └── useWallets.ts
│   └── utils/
│       └── formatters.ts        # Date/status utils
├── next.config.mjs              # Next.js config
├── tailwind.config.ts           # Tailwind config
├── postcss.config.mjs           # PostCSS config
└── tsconfig.json                # TypeScript config
```

---

## 💻 Development

### Available Scripts

```bash
npm run dev         # Start development server
npm run build       # Build for production
npm start           # Start production server
npm run lint        # Run ESLint
npm run lint:fix    # Fix lint errors
npm run format      # Format code with Prettier
```

### Development Workflow

1. **Start dev server**: `npm run dev`
2. **Open browser**: http://localhost:3000
3. **Mock auth** (until backend):
   ```javascript
   // In browser console
   localStorage.setItem('token', 'mock-jwt-token');
   localStorage.setItem('user', JSON.stringify({
     id: '1',
     name: 'Admin User',
     email: 'admin@synapsys.io',
     rpId: 'rp-001',
     rpName: 'Test RP'
   }));
   location.reload();
   ```
4. **Navigate**: Dashboard should now load

---

## 🔌 Backend Integration

### API Endpoints Required

The dashboard expects these endpoints from `the_synapsys-verifier`:

```typescript
// Authentication
POST   /api/auth/login           // { email, password }
GET    /api/auth/me              // Headers: Authorization: Bearer <token>
POST   /api/auth/logout

// Sessions
GET    /api/sessions             // List all sessions
POST   /api/sessions/create      // { walletType }
POST   /api/sessions/:id/revoke

// Wallets
GET    /api/wallets/available    // List wallet providers
```

### Data Models

See `DASHBOARD_IMPLEMENTATION.md` for complete TypeScript interfaces.

**Quick reference**:
- `AuthUser`: User authentication data
- `WalletSession`: Session with status, credentials, QR
- `WalletProvider`: Available wallet integrations

### CORS Configuration

Backend must allow:
```javascript
Access-Control-Allow-Origin: http://localhost:3000
Access-Control-Allow-Headers: Authorization, Content-Type
Access-Control-Allow-Methods: GET, POST, PUT, DELETE
```

---

## 📚 Documentation

- **[DASHBOARD_IMPLEMENTATION.md](./DASHBOARD_IMPLEMENTATION.md)** - Complete implementation guide
  - Architecture details
  - API specifications
  - Setup instructions
  - Next steps roadmap
  
- **Backend Docs**: `../the_synapsys-verifier/README.md`
- **Phase 3 Report**: `../PHASE_3_REPORT.md`

---

## 🎨 Tech Stack

| Category | Technology |
|----------|-----------|
| Framework | Next.js 15.1.3 (App Router) |
| Language | TypeScript 5.3.3 (strict) |
| Styling | Tailwind CSS 3.4.17 |
| State | React Hooks |
| HTTP | Axios 1.7.9 |
| Icons | Lucide React 0.468.0 |
| Dates | date-fns 4.1.0 |
| Charts | Recharts 2.15.0 |

---

## 🧪 Testing

### Current Status
- Unit tests: ❌ Pending
- Integration tests: ❌ Pending
- E2E tests: ❌ Pending

### Planned Testing
```bash
# To be added in Week 9
npm run test             # Jest unit tests
npm run test:e2e         # Playwright E2E
npm run test:coverage    # Coverage report
```

---

## 🔒 Security Notes

1. **Token Storage**: Uses localStorage (dev only)
   - ⚠️ Production: Use httpOnly cookies
   
2. **API Security**: All requests include Authorization header
   - 401 responses → auto-logout
   
3. **Input Validation**: Client-side validation needed

---

## 📊 MVP Progress

- [x] **Week 1-6**: Backend development (OpenID4VP)
- [x] **Week 7**: Testing & compliance
- [x] **Week 8**: Dashboard MVP ← **You are here**
- [ ] **Week 9**: Backend integration
- [ ] **Week 10**: Advanced features
- [ ] **Week 11**: Testing & optimization
- [ ] **Week 12**: Deployment & docs

**Current**: 75% complete (9/12 weeks)

---

## 👥 Contributing

### For Frontend Developers
- Follow Next.js 15 App Router conventions
- Use TypeScript strict mode
- Implement custom hooks for business logic
- Keep components small and focused

### For Backend Developers
- Implement APIs listed in Backend Integration
- Use JWT for authentication
- Return ISO 8601 dates
- Support Spanish locale messages

---

## 📞 Support

- **Issues**: Check `DASHBOARD_IMPLEMENTATION.md` first
- **Backend**: See `the_synapsys-verifier` docs
- **API Testing**: Use Postman collection (to be added)

---

## 📄 License

MIT License - See LICENSE file

---

## 🙏 Acknowledgments

- **Verifier Backend**: OpenID4VP implementation
- **Wallet Integrations**: Gataca & iGrant.io
- **Design System**: Tailwind CSS community

---

**Built with ❤️ for EUDI Wallet ecosystem**

*Last updated: 23/12/2025 - Week 8 MVP*
