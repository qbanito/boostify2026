// Boostify YouTube Extension — Constants

// API base URL — change to your production URL when deploying
export const API_BASE_URL = 'https://boostifymusic.com';

// Sync intervals (in minutes)
export const SYNC_INTERVAL_MINUTES = 5;
export const COMPETITOR_CHECK_HOURS = 24;
export const TREND_CHECK_HOURS = 6;
export const FULL_AUDIT_HOURS = 24;

// Chrome alarms
export const ALARM_SYNC_STATS = 'boostify-sync-stats';
export const ALARM_CHECK_TRENDS = 'boostify-check-trends';
export const ALARM_COMPETITOR_CHECK = 'boostify-competitor-check';
export const ALARM_FULL_AUDIT = 'boostify-full-audit';

// Storage keys
export const STORAGE_SYNC_TOKEN = 'boostify_sync_token';
export const STORAGE_CONNECTION_ID = 'boostify_connection_id';
export const STORAGE_USER_ID = 'boostify_user_id';
export const STORAGE_CHANNEL_ID = 'boostify_channel_id';
export const STORAGE_CHANNEL_NAME = 'boostify_channel_name';
export const STORAGE_LAST_SYNC = 'boostify_last_sync';
export const STORAGE_PENDING_ACTIONS = 'boostify_pending_actions';
export const STORAGE_SETTINGS = 'boostify_settings';

// Extension ID (for messaging)
export const EXTENSION_ID = chrome?.runtime?.id || 'boostify-yt-ext';

// Badge colors
export const BADGE_COLOR_CONNECTED = '#22c55e';   // green
export const BADGE_COLOR_SYNCING = '#f97316';      // orange
export const BADGE_COLOR_ERROR = '#ef4444';         // red
export const BADGE_COLOR_PENDING = '#3b82f6';       // blue
