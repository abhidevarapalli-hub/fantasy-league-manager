import type { CapacitorConfig } from '@capacitor/cli';

// Read the mode from environment - matches Vite's mode system
// 'development' when running locally, 'production' for builds
const isDevelopment = process.env.NODE_ENV !== 'production';

const config: CapacitorConfig = {
  appId: 'com.cricfantasy.app',
  appName: 'CricFantasy',
  webDir: 'dist',
  server: {
    // Local development: connect to Vite dev server
    // Production: connect to production website
    url: isDevelopment ? 'http://localhost:8080' : 'https://cricfantasy.app/',
    cleartext: isDevelopment, // Allow http only for local dev
  },
  plugins: {
    App: {
      scheme: 'com.cricfantasy.app',
    },
  },
};

export default config;
