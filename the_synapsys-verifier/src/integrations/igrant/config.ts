// iGrant.io Configuration
export const IGRANT_CONFIG = {
  clientId: process.env.IGRANT_CLIENT_ID || 'synapsys-test',
  clientSecret: process.env.IGRANT_CLIENT_SECRET || '',
  redirectUri: process.env.IGRANT_REDIRECT_URI || 'http://localhost:3000/callback/igrant',
  discoveryUrl: 'https://api.igrant.io/.well-known/openid-configuration',
  scopes: ['openid', 'profile', 'email', 'credentials'],
  responseType: 'code id_token',
  issuer: 'https://api.igrant.io'
};

export const IGRANT_ENDPOINTS = {
  authorize: 'https://api.igrant.io/oauth/authorize',
  token: 'https://api.igrant.io/oauth/token',
  userinfo: 'https://api.igrant.io/oauth/userinfo',
  revoke: 'https://api.igrant.io/oauth/revoke',
  credentials: 'https://api.igrant.io/credentials/list'
};
