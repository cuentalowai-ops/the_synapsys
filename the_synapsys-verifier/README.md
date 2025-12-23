# the_synapsys-verifier

EUDI Wallet Relying Party Backend Service

## Overview

Backend service for **the_synapsys** EUDI (European Digital Identity) Wallet Relying Party implementation. This service serves as the verification backend for digital identity credentials in compliance with eIDAS 2.0 regulations.

## Compliance

This implementation follows:

- **eIDAS 2.0**
  - Article 45: Requirements for qualified electronic signature creation devices
  - Article 64: Liability of trust service providers
- **ISO 27001**
  - A.12.4.1: Event logging
- **GDPR**
  - Article 5: Principles relating to processing of personal data

## Tech Stack

- **Runtime**: Node.js 20+
- **Framework**: Express 4
- **Language**: TypeScript (strict mode)
- **Testing**: Jest + ts-jest
- **Logging**: Winston (PII-sanitized)
- **Code Quality**: ESLint + Prettier (Airbnb style guide)

## Project Structure

```
the_synapsys-verifier/
├── src/
│   ├── index.ts              # Main application entry point
│   ├── config/
│   │   └── logger.ts         # Winston logger configuration
│   └── routes/
│       ├── health.ts         # Health check endpoint
│       └── version.ts        # Version information endpoint
├── tests/
│   └── health.test.ts        # Health endpoint tests
├── .github/
│   └── workflows/
│       └── ci.yml            # GitHub Actions CI configuration
└── package.json
```

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
# Run development server with hot reload
npm run dev

# Run linter
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Check code formatting
npm run format:check
```

## Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm test:watch

# Run tests with coverage
npm run test:coverage
```

## Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

## API Endpoints

### GET /health

Health check endpoint for monitoring service availability.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "the-synapsys-verifier",
  "uptime": 123.456
}
```

### GET /version

Version and compliance information endpoint.

**Response:**
```json
{
  "name": "the-synapsys-verifier",
  "version": "0.1.0",
  "description": "EUDI Wallet Relying Party Backend",
  "compliance": {
    "eidas2": ["Art. 45", "Art. 64"],
    "iso27001": ["A.12.4.1"],
    "gdpr": ["Art. 5"]
  },
  "nodeVersion": "v20.x.x",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Environment Variables

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Logging
LOG_LEVEL=info
```

## CI/CD

GitHub Actions workflow is configured to run on every push and pull request to `main` and `develop` branches:

- Node.js 20 environment
- Linting checks
- Code formatting checks
- Unit tests
- Build verification
- Code coverage reporting

## Security & Privacy

- **PII Protection**: Logger is configured to sanitize and redact personally identifiable information
- **Structured Logging**: All logs follow a structured format for auditability
- **Error Handling**: Comprehensive error handling with proper status codes
- **Type Safety**: Strict TypeScript configuration for enhanced code safety

## License

MIT

## Contributing

1. Create a feature branch from `develop`
2. Make your changes following the code style
3. Ensure all tests pass
4. Submit a pull request

## Week 1 Status

✅ Bootstrap complete with skeleton functional structure
- Express server with health and version endpoints
- Winston logging (PII-sanitized)
- Jest test suite with passing tests
- ESLint + Prettier configuration
- GitHub Actions CI with Node 20
- TypeScript strict mode enabled
- Full project documentation
