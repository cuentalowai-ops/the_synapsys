# the_synapsys-website

Next.js Landing Page for EUDI Wallet Relying Party

## Overview

Landing page website for **the_synapsys** EUDI (European Digital Identity) Wallet Relying Party. This Next.js 15 application provides a modern, responsive landing page showcasing the platform's features, compliance, and capabilities.

## Tech Stack

- **Framework**: Next.js 15
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Runtime**: Node.js 20+

## Project Structure

```
the_synapsys-website/
├── app/
│   ├── layout.tsx        # Root layout with metadata
│   ├── page.tsx          # Landing page with sections
│   └── globals.css       # Global styles with Tailwind
├── tailwind.config.ts    # Tailwind configuration
├── next.config.js        # Next.js configuration
└── package.json
```

## Features

### Landing Page Sections

1. **Hero Section**
   - Bold branding with gradient text
   - Clear value proposition
   - Call-to-action buttons

2. **Features Section**
   - Secure Verification
   - Real-time Processing
   - Comprehensive Dashboard

3. **Compliance Section**
   - eIDAS 2.0 (Articles 45, 64)
   - ISO 27001 (A.12.4.1)
   - GDPR (Article 5)

4. **Contact Section**
   - Contact information
   - Email link
   - Status indicator

5. **Footer**
   - Copyright information
   - Version number

## Setup

### Prerequisites

- Node.js 20.x or higher
- npm or pnpm

### Installation

```bash
# Install dependencies
npm install

# or using pnpm
pnpm install
```

## Development

```bash
# Run development server
npm run dev

# Open http://localhost:3000
```

## Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

## Deployment

### Vercel (Recommended)

This project is optimized for Vercel deployment:

1. Push to GitHub repository
2. Import project in Vercel
3. Deploy automatically

### Environment Variables

No environment variables are required for the basic setup.

## Design System

### Color Scheme

- **Primary**: Blue gradient (#3b82f6 to #8b5cf6)
- **Background**: Dark gradient (#0a0a0a to #000000)
- **Text Primary**: White (#ffffff)
- **Text Secondary**: Gray (#9ca3af)

### Theme Support

The application supports dark mode by default with the `dark` class on the `<html>` element.

## Tailwind Configuration

Custom Tailwind configuration includes:

- Extended primary color palette
- Dark mode class strategy
- Full content scanning

## Compliance References

The landing page includes references to key compliance standards:

- **eIDAS 2.0**: European Digital Identity framework
- **ISO 27001**: Information Security Management
- **GDPR**: Data Protection Regulation

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## Performance

- Server-side rendering (SSR) enabled
- Optimized for Core Web Vitals
- Tailwind CSS purging for minimal bundle size

## SEO

- Metadata configured in `layout.tsx`
- Semantic HTML structure
- Optimized meta descriptions and keywords

## License

MIT

## Contributing

1. Create a feature branch from `develop`
2. Make your changes
3. Submit a pull request

## Week 1 Status

✅ Bootstrap complete with landing page structure

- Next.js 15 with App Router
- Tailwind CSS styling
- Dark theme implementation
- Hero, Features, Compliance, Contact sections
- Vercel-ready configuration
- TypeScript strict mode
