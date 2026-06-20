// Boostify Instagram Extension — Constants

// Use localhost for development, production URL for deployed version
const IS_DEV = !chrome?.runtime?.getManifest || chrome.runtime.getManifest()?.version === '1.0.0';
export const API_BASE_URL = IS_DEV ? 'http://localhost:5000' : 'https://boostifymusic.com';

// Sync intervals (in minutes)
export const SYNC_INTERVAL_MINUTES = 5;
export const TREND_CHECK_HOURS = 6;

// Chrome alarms
export const ALARM_SYNC_STATS = 'boostify-ig-sync-stats';
export const ALARM_CHECK_TRENDS = 'boostify-ig-check-trends';

// Storage keys
export const STORAGE_SYNC_TOKEN = 'boostify_ig_sync_token';
export const STORAGE_CONNECTION_ID = 'boostify_ig_connection_id';
export const STORAGE_USER_ID = 'boostify_ig_user_id';
export const STORAGE_IG_USERNAME = 'boostify_ig_username';
export const STORAGE_IG_DISPLAY_NAME = 'boostify_ig_display_name';
export const STORAGE_LAST_SYNC = 'boostify_ig_last_sync';
export const STORAGE_PENDING_ACTIONS = 'boostify_ig_pending_actions';
export const STORAGE_SETTINGS = 'boostify_ig_settings';

// Extension ID
export const EXTENSION_ID = chrome?.runtime?.id || 'boostify-ig-ext';

// Badge colors
export const BADGE_COLOR_CONNECTED = '#22c55e';
export const BADGE_COLOR_SYNCING = '#f97316';
export const BADGE_COLOR_ERROR = '#ef4444';
export const BADGE_COLOR_PENDING = '#3b82f6';
