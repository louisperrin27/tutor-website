import express from 'express';
import nodemailer from 'nodemailer'; // send emails via SMTP
import bodyParser from 'body-parser'; // parse JSON/form bodies into req.body
import dotenv from 'dotenv'; // load .env variables
import fs from 'fs'; // simple file storage (mailing list)
import path from 'path'; // path utilities
import { fileURLToPath } from 'url'; // for __dirname in ES modules
import { dirname } from 'path'; // for __dirname in ES modules
import { createHash, randomBytes } from 'crypto'; // crypto for token hashing
import os from 'os'; // network interfaces for IP detection
import Database from 'better-sqlite3'; // lightweight SQLite DB
import Stripe from 'stripe'; // Stripe SDK for Checkout + verification
import helmet from 'helmet'; // security headers middleware
import rateLimit from 'express-rate-limit'; // rate limiting middleware
import session from 'express-session'; // session management
import bcrypt from 'bcrypt'; // password hashing
import logger from './logger.js'; // structured logging utility

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 1) Load environment variables from .env (e.g., EMAIL_USER, EMAIL_PASS, EMAIL_TO)
dotenv.config();
logger.info('Environment variables loaded', { emailTo: process.env.EMAIL_TO ? 'configured' : 'not configured' });

// Validate required environment variables in production
if (process.env.NODE_ENV === 'production') {
  const requiredEnvVars = [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'SESSION_SECRET',
    'ADMIN_KEY',
    'EMAIL_USER',
    'EMAIL_PASS',
    'EMAIL_TO'
  ];

  const missing = requiredEnvVars.filter(v => {
    // Check both STRIPE_SECRET_KEY and STRIPE_SECRET (for backward compatibility)
    if (v === 'STRIPE_SECRET_KEY') {
      return !process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET;
    }
    return !process.env[v];
  });

  if (missing.length > 0) {
    logger.error('Missing required environment variables', { missing });
    console.error('❌ Missing required environment variables:', missing.join(', '));
    console.error('Please set these in your .env file or environment.');
    process.exit(1);
  }
}

// 2) Create the Express app instance
const app = express();

// Trust proxy for accurate IP addresses and protocol detection behind reverse proxy
app.set('trust proxy', true);

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const isMobile = isMobileRequest(req);
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.request(req, res, duration, { isMobile });
  });
  next();
});

// 3) Global middleware
// - Security headers via Helmet (protects against common web vulnerabilities)
//   Content Security Policy (CSP) configured to allow:
//   - Font Awesome from cdnjs.cloudflare.com
//   - YouTube embeds
//   - Google reCAPTCHA
//   - Google Analytics
//   - Stripe payment iframes
//   - FullCalendar from cdn.jsdelivr.net
//   Note: 'unsafe-inline' is used for inline scripts/styles (can be replaced with nonces in future)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://www.googletagmanager.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.stripe.com", "https://www.youtube.com"],
      frameSrc: ["https://js.stripe.com", "https://hooks.stripe.com", "https://www.youtube.com"],
      fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow YouTube iframes
}));

// - For Stripe webhooks we need the raw body, so we mount that route-specific
//   middleware BEFORE the JSON parser below.
// - bodyParser makes req.body available for JSON and URL-encoded form data
app.use(bodyParser.urlencoded({ extended: true }));

// Session middleware (must be before routes that use req.session)
app.use(session({
  secret: process.env.SESSION_SECRET || (() => {
    if (process.env.NODE_ENV === 'production') {
      logger.error('SESSION_SECRET is required in production');
      process.exit(1);
    }
    logger.warn('Using insecure default SESSION_SECRET in development');
    return 'change-me-in-production-use-env-variable';
  })(),
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true, // Prevent XSS attacks
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax'
  }
}));

// In development, ensure session cookies work over HTTP on mobile devices
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    // Refresh session cookie on each request to ensure it persists on mobile Safari
    if (req.session && req.sessionID) {
      req.session.touch();
    }
    next();
  });
}

// -----------------------------------
// YouTube helper: return latest video by channel
// No API key needed; uses public RSS feed. Accepts one of:
//   ?handle=YourHandle   (without @)
//   ?channelId=UCxxxxxx  (preferred)
//   ?user=LegacyUserName
// -----------------------------------
app.get('/api/youtube/latest', async (req, res) => {
  try {
    let { handle, channelId } = req.query;
    const { user } = req.query;
    if (typeof handle === 'string' && handle.startsWith('@')) {
      handle = handle.slice(1);
    }

    // Use env YOUTUBE_CHANNEL_ID if set (reliable fallback when scrape fails)
    if (!channelId && process.env.YOUTUBE_CHANNEL_ID) {
      channelId = process.env.YOUTUBE_CHANNEL_ID.trim();
      if (!/^UC[\w-]{22}$/.test(channelId)) { channelId = null; }
    }

    // Resolve channelId from handle if needed
    if (!channelId && handle) {
      try {
        const resp = await fetch(`https://www.youtube.com/@${encodeURIComponent(handle)}`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Bot/1.0)' },
        });
        if (!resp.ok) {
          logger.warn('YouTube handle lookup failed', { handle, status: resp.status });
        } else {
          const html = await resp.text();
          const m = html.match(/"channelId":"(UC[\w-]{22})"/)
            || html.match(/"channelId":"(UC[^"]+)"/)
            || html.match(/channel_id=([A-Za-z0-9_-]{22,})/)
            || html.match(/\/channel\/(UC[\w-]+)/);
          if (m) { channelId = m[1]; }
        }
      } catch (fetchErr) {
        logger.warn('YouTube handle fetch error', { handle, error: fetchErr });
      }
    }

    // If a legacy username is supplied, use that feed directly
    if (!channelId && user) {
      const feedUrl = `https://www.youtube.com/feeds/videos.xml?user=${encodeURIComponent(user)}`;
      const xml = await fetch(feedUrl).then((r) => r.text());
      const idMatch = xml.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
      const titleMatch = xml.match(/<entry>[\s\S]*?<title>([^<]+)<\/title>/);
      const pubMatch = xml.match(/<entry>[\s\S]*?<published>([^<]+)<\/published>/);
      if (!idMatch) {return res.status(404).json({ error: 'No videos found' });}
      const videoId = idMatch[1];
      return res.json({
        videoId,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        title: titleMatch?.[1] || null,
        published: pubMatch?.[1] || null,
      });
    }

    if (!channelId) {
      // If handle was provided but channelId resolution failed, try using handle directly in RSS feed
      if (handle) {
        try {
          const feedUrl = `https://www.youtube.com/feeds/videos.xml?user=${encodeURIComponent(handle)}`;
          const xml = await fetch(feedUrl).then((r) => {
            if (!r.ok) {throw new Error(`RSS feed returned ${r.status}`);}
            return r.text();
          });
          const idMatch = xml.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
          const titleMatch = xml.match(/<entry>[\s\S]*?<title>([^<]+)<\/title>/);
          const pubMatch = xml.match(/<entry>[\s\S]*?<published>([^<]+)<\/published>/);
          if (idMatch) {
            const videoId = idMatch[1];
            return res.json({
              videoId,
              url: `https://www.youtube.com/watch?v=${videoId}`,
              title: titleMatch?.[1] || null,
              published: pubMatch?.[1] || null,
            });
          }
        } catch (feedErr) {
          logger.warn('YouTube RSS feed fetch failed for handle', { handle, error: feedErr });
        }
      }
      return res.status(400).json({ error: 'Unable to resolve YouTube channel. Please provide channelId or a valid handle.' });
    }

    const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
    const xml = await fetch(feedUrl).then((r) => {
      if (!r.ok) {throw new Error(`RSS feed returned ${r.status}`);}
      return r.text();
    });
    const idMatch = xml.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
    const titleMatch = xml.match(/<entry>[\s\S]*?<title>([^<]+)<\/title>/);
    const pubMatch = xml.match(/<entry>[\s\S]*?<published>([^<]+)<\/published>/);
    if (!idMatch) {return res.status(404).json({ error: 'No videos found' });}
    const videoId = idMatch[1];
    res.json({
      videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      title: titleMatch?.[1] || null,
      published: pubMatch?.[1] || null,
      channelId,
    });
  } catch (err) {
    logger.error('YouTube latest video fetch failed', {
      error: err,
      path: req.path,
      query: req.query,
    });
    res.status(500).json({ error: 'Failed to resolve latest video' });
  }
});

// Healthcheck endpoint for monitoring and load balancers
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// -----------------------------------
// Stripe + Database setup
// -----------------------------------
const stripeSecret = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET;
export const stripe = stripeSecret ? new Stripe(stripeSecret) : null;

// Initialize SQLite database (file created if missing). Use SQLITE_DB_PATH for persistent storage on PaaS (e.g. mounted volume).
const dbPath = process.env.SQLITE_DB_PATH || path.join(__dirname, 'data.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Helper: ISO string now (needed for migrations)
const nowISO = () => new Date().toISOString();

// Create minimal schema for booking system
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

// Migrate existing users table if it has old schema (add missing columns)
try {
  const tableInfo = db.pragma('table_info(users)');
  const columnNames = tableInfo.map(col => col.name);
  
  logger.info('Checking users table schema', { existingColumns: columnNames });
  
  // Check if password_hash column exists, if not, migrate
  if (!columnNames.includes('password_hash')) {
    logger.info('Migrating users table: adding password_hash, created_at, updated_at columns');
    // Note: SQLite doesn't support adding NOT NULL columns to existing tables easily
    // So we'll add them as nullable first, then handle existing data
    try {
      db.exec(`
        ALTER TABLE users ADD COLUMN password_hash TEXT;
        ALTER TABLE users ADD COLUMN created_at TEXT;
        ALTER TABLE users ADD COLUMN updated_at TEXT;
      `);
      
      // Set default timestamps for existing rows (if any)
      const defaultTime = nowISO();
      const updateResult = db.prepare('UPDATE users SET created_at = ?, updated_at = ? WHERE created_at IS NULL').run(defaultTime, defaultTime);
      
      logger.info('Users table migration completed', { 
        rowsUpdated: updateResult.changes,
        columnsAdded: ['password_hash', 'created_at', 'updated_at']
      });
    } catch (migrateErr) {
      logger.error('Users table migration failed', { 
        error: migrateErr,
        errorMessage: migrateErr.message,
        errorStack: migrateErr.stack
      });
      // Don't throw - let it try to continue, but log the error clearly
    }
  } else {
    logger.info('Users table already has required columns, no migration needed');
  }
} catch (err) {
  // Table doesn't exist yet, which is fine - it will be created above with correct schema
  if (err.message && err.message.includes('no such table')) {
    logger.info('Users table does not exist yet, will be created with full schema');
  } else {
    logger.error('Error checking users table schema', { 
      error: err,
      errorMessage: err.message 
    });
  }
}

// Create remaining tables (services, slots, bookings, mailing_list_subscribers)
db.exec(`
  CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    price_pence INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_id INTEGER NOT NULL,
    start TEXT NOT NULL,
    end TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'available', -- available | reserved | booked
    reserve_until TEXT,                       -- ISO timestamp when hold expires
    stripe_session_id TEXT,                   -- set after Checkout session created
    FOREIGN KEY(service_id) REFERENCES services(id)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_slots_unique ON slots(service_id, start, end);

  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slot_id INTEGER UNIQUE,                   -- one booking per slot
    user_email TEXT NOT NULL,
    amount_pence INTEGER NOT NULL,
    stripe_payment_intent TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(slot_id) REFERENCES slots(id)
  );

  CREATE TABLE IF NOT EXISTS mailing_list_subscribers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    consent_given INTEGER NOT NULL DEFAULT 1, -- 0 = false, 1 = true (SQLite boolean)
    consent_timestamp TEXT NOT NULL,
    source TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_subscribers_email ON mailing_list_subscribers(email);
  CREATE INDEX IF NOT EXISTS idx_subscribers_source ON mailing_list_subscribers(source);

  CREATE TABLE IF NOT EXISTS password_resets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL,
    request_ip TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
  CREATE INDEX IF NOT EXISTS idx_password_resets_token_hash ON password_resets(token_hash);
  CREATE INDEX IF NOT EXISTS idx_password_resets_user_id ON password_resets(user_id);
  CREATE INDEX IF NOT EXISTS idx_password_resets_expires_at ON password_resets(expires_at);
`);

// Seed services for different plans
// Service IDs: 1=GCSE Free (30min), 2=GCSE 1-1 (1hr), 3=GCSE Group (1hr), 4=A-Level Free (30min), 5=A-Level 1-1 (1hr), 6=A-Level Group (1hr)
// Legacy service ID 1 kept for backward compatibility
db.prepare(
  "INSERT OR IGNORE INTO services (id, name, price_pence) VALUES (1, 'Tutoring Session (1 hour)', 3000)"
).run();
db.prepare(
  "INSERT OR IGNORE INTO services (id, name, price_pence) VALUES (2, 'GCSE Free Session (30 min)', 0)"
).run();
db.prepare(
  "INSERT OR IGNORE INTO services (id, name, price_pence) VALUES (3, 'GCSE 1-to-1 Session (1 hour)', 3500)"
).run();
db.prepare(
  "INSERT OR IGNORE INTO services (id, name, price_pence) VALUES (4, 'GCSE Group Session (1 hour)', 2000)"
).run();
db.prepare(
  "INSERT OR IGNORE INTO services (id, name, price_pence) VALUES (5, 'A-Level Free Session (30 min)', 0)"
).run();
db.prepare(
  "INSERT OR IGNORE INTO services (id, name, price_pence) VALUES (6, 'A-Level 1-to-1 Session (1 hour)', 4500)"
).run();
db.prepare(
  "INSERT OR IGNORE INTO services (id, name, price_pence) VALUES (7, 'A-Level Group Session (1 hour)', 2500)"
).run();

// Migration: add calendar_key to slots (required for 10-calendar flow)
try {
  db.exec("ALTER TABLE slots ADD COLUMN calendar_key TEXT NOT NULL DEFAULT 'legacy'");
  logger.info('Slots table: added calendar_key column');
} catch (e) {
  if (!e.message || !e.message.includes('duplicate column')) { logger.warn('Slots calendar_key migration', { error: e.message }); }
}

// 10 calendars: each has a service_id for price/display (service IDs 8-17)
const CALENDAR_KEYS = [
  'gcse-maths-1to1', 'gcse-physics-1to1', 'gcse-maths-group', 'gcse-physics-group',
  'alevel-maths-1to1', 'alevel-further-maths-1to1', 'alevel-physics-1to1',
  'alevel-maths-group', 'alevel-further-maths-group', 'alevel-physics-group'
];
const calendarServices = [
  [8, 'GCSE Maths 1-1', 3500], [9, 'GCSE Physics 1-1', 3500], [10, 'GCSE Maths Group', 2000], [11, 'GCSE Physics Group', 2000],
  [12, 'A Level Maths 1-1', 4500], [13, 'A Level Further Maths 1-1', 4500], [14, 'A Level Physics 1-1', 4500],
  [15, 'A Level Maths Group', 2500], [16, 'A Level Further Maths Group', 2500], [17, 'A Level Physics Group', 2500]
];
calendarServices.forEach((row) => {
  db.prepare('INSERT OR IGNORE INTO services (id, name, price_pence) VALUES (?, ?, ?)').run(row[0], row[1], row[2]);
});
const calendarKeyToServiceId = {
  'gcse-maths-1to1': 8, 'gcse-physics-1to1': 9, 'gcse-maths-group': 10, 'gcse-physics-group': 11,
  'alevel-maths-1to1': 12, 'alevel-further-maths-1to1': 13, 'alevel-physics-1to1': 14,
  'alevel-maths-group': 15, 'alevel-further-maths-group': 16, 'alevel-physics-group': 17
};

// -----------------------------------
// Input Validation & Sanitization Helpers
// -----------------------------------

// Email validation regex (RFC 5322 compliant, simplified)
const isValidEmail = (email) => {
  if (typeof email !== 'string') {return false;}
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim()) && email.length <= 254; // RFC 5321 max length
};

// Sanitize string: trim, limit length, remove control characters
const sanitizeString = (str, maxLength = 1000) => {
  if (typeof str !== 'string') {return '';}
  return str
    .trim()
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .slice(0, maxLength);
};

// Sanitize text for email (strip HTML, limit length)
const sanitizeText = (text, maxLength = 5000) => {
  if (typeof text !== 'string') {return '';}
  // Remove HTML tags and decode entities
  return text
    .replace(/<[^>]*>/g, '') // Strip HTML tags
    .replace(/&[#\w]+;/g, '') // Remove HTML entities (basic)
    .trim()
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .slice(0, maxLength);
};

// Validate and sanitize email
const validateAndSanitizeEmail = (email) => {
  if (!email || typeof email !== 'string') {return null;}
  const trimmed = email.trim().toLowerCase();
  if (!isValidEmail(trimmed)) {return null;}
  return trimmed;
};

// Validate slotId is a positive integer
const validateSlotId = (slotId) => {
  const id = Number(slotId);
  return Number.isInteger(id) && id > 0 ? id : null;
};

// Helper: Detect mobile user agent
const isMobileRequest = (req) => {
  const ua = req.get('user-agent') || '';
  return /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
};

// -----------------------------------
// Rate Limiting Configuration
// -----------------------------------

// General API rate limiter: 100 requests per 15 minutes per IP
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { message: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: (req) => req.ip || req.connection?.remoteAddress || 'unknown',
});

// Contact form rate limiter: 5 submissions per 15 minutes per IP
const contactFormLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 contact form submissions per windowMs
  message: { message: 'Too many contact form submissions. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || req.connection?.remoteAddress || 'unknown',
});

// Mailing list rate limiter: 3 signups per hour per IP
const mailingListLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // limit each IP to 3 mailing list signups per hour
  message: { message: 'Too many signup attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || req.connection?.remoteAddress || 'unknown',
});

// Booking/Checkout rate limiter: 10 attempts per 15 minutes per IP
const bookingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 booking attempts per windowMs
  message: { message: 'Too many booking attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || req.connection?.remoteAddress || 'unknown',
});

// Mount JSON parser AFTER webhook raw-body needs (see webhook route below)

// -----------------------------------
// Stripe Webhook (marks slots booked after successful payment)
// NOTE: This must be registered before other JSON body parsers.
// -----------------------------------
app.post(
  '/stripe/webhook',
  bodyParser.raw({ type: 'application/json' }),
  async (req, res) => {
    try {
      if (!stripe) {return res.status(200).send('Stripe not configured');}
      const sig = req.headers['stripe-signature']; // provided by Stripe
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      let event;
      try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      } catch (err) {
        logger.error('Stripe webhook signature verification failed', {
          error: err,
          path: req.path,
          ip: req.ip,
        });
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const slotId = validateSlotId(session.metadata?.slot_id);
        const rawEmail = session.customer_details?.email || session.customer_email;
        const email = validateAndSanitizeEmail(rawEmail) || 'unknown@example.com';
        const amount = typeof session.amount_total === 'number' && session.amount_total >= 0 
          ? session.amount_total 
          : 0;
        const paymentIntent = session.payment_intent?.toString() || '';

        if (!slotId) {
          logger.warn('Webhook received checkout.session.completed but slot_id is invalid', {
            sessionId: session.id,
            metadata: session.metadata,
          });
          return res.json({ received: true });
        }

        const bookTxn = db.transaction(() => {
          // Try to update slot - check both reserved with matching session_id, or just reserved (fallback)
          const update = db
            .prepare(
              "UPDATE slots SET status='booked' WHERE id=? AND status='reserved' AND stripe_session_id=?"
            )
            .run(slotId, session.id);
          
          // If that didn't work, try without stripe_session_id check (handles timing issues)
          if (update.changes !== 1) {
            const updateFallback = db
              .prepare("UPDATE slots SET status='booked' WHERE id=? AND status='reserved'")
              .run(slotId);
            if (updateFallback.changes !== 1) {
              logger.warn('Webhook: Slot not found or already booked', {
                slotId,
                sessionId: session.id,
                slotStatus: db.prepare('SELECT status FROM slots WHERE id=?').get(slotId)?.status,
              });
              return false; // already processed or not reserved
            }
          }
          
          // Check if booking already exists
          const existing = db.prepare('SELECT id FROM bookings WHERE slot_id=?').get(slotId);
          if (!existing) {
            const insert = db
              .prepare(
                'INSERT INTO bookings (slot_id, user_email, amount_pence, stripe_payment_intent, created_at) VALUES (?,?,?,?,?)'
              )
              .run(slotId, email, amount, paymentIntent, nowISO());
            logger.info('Webhook: Booking created', {
              slotId,
              email,
              amount,
              insertChanges: insert.changes,
            });
          } else {
            logger.info('Webhook: Booking already exists', { slotId, email });
          }
          return true;
        });
        
        if (bookTxn()) {
          sendBookingEmailSafe({ email, slotId });
        } else {
          logger.warn('Webhook: Booking transaction failed', { slotId, email, sessionId: session.id });
        }
      }

      if (event.type === 'checkout.session.expired') {
        const session = event.data.object;
        db.prepare(
          "UPDATE slots SET status='available', reserve_until=NULL, stripe_session_id=NULL WHERE stripe_session_id=? AND status='reserved'"
        ).run(session.id);
      }

      res.json({ received: true });
    } catch (err) {
      logger.error('Stripe webhook handler error', {
        error: err,
        path: req.path,
        ip: req.ip,
      });
      res.status(500).send('Webhook handler failed');
    }
  }
);

// Now enable JSON body parsing for the rest of the app
app.use(bodyParser.json());

// -----------------------------------
// Contact Form Route (/send-message)
// Purpose: Accept contact form submissions and email them to you
// -----------------------------------
app.post('/send-message', contactFormLimiter, async (req, res) => {
  // Extract and sanitize fields from the client
  const { firstName, lastName, email, subject, message } = req.body;

  // Validate required fields exist
  if (!firstName || !email || !subject || !message) {
    return res
      .status(400)
      .json({ message: 'Please fill in all required fields.' });
  }

  // Sanitize and validate inputs
  const sanitizedFirstName = sanitizeString(firstName, 100);
  const sanitizedLastName = lastName ? sanitizeString(lastName, 100) : '';
  const validatedEmail = validateAndSanitizeEmail(email);
  const sanitizedSubject = sanitizeString(subject, 200);
  const sanitizedMessage = sanitizeText(message, 5000);

  // Validate sanitized inputs
  if (!sanitizedFirstName || sanitizedFirstName.length < 1) {
    return res.status(400).json({ message: 'First name is required and must be valid.' });
  }
  if (!validatedEmail) {
    return res.status(400).json({ message: 'Please provide a valid email address.' });
  }
  if (!sanitizedSubject || sanitizedSubject.length < 1) {
    return res.status(400).json({ message: 'Subject is required and must be valid.' });
  }
  if (!sanitizedMessage || sanitizedMessage.length < 1) {
    return res.status(400).json({ message: 'Message is required and must be valid.' });
  }

  // Configure the SMTP transporter (uses your iCloud SMTP in this example)
  const transporter = nodemailer.createTransport({
    host: 'smtp.mail.me.com',
    port: 587,
    secure: false, // TLS is started via STARTTLS on port 587
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  // Build the email contents using sanitized values
  const fullName = sanitizedLastName 
    ? `${sanitizedFirstName} ${sanitizedLastName}` 
    : sanitizedFirstName;
  const mailOptions = {
    from: `"${fullName}" <${validatedEmail}>`, // show sender's name/email
    to: process.env.EMAIL_TO, // your inbox
    subject: `New message from ${fullName}: ${sanitizedSubject}`,
    text: `You have received a new message from your tutoring contact form.\n\nName: ${fullName}\nEmail: ${validatedEmail}\n\nMessage:\n${sanitizedMessage}`,
  };

  try {
    // Attempt to send the email
    await transporter.sendMail(mailOptions);
    logger.email('sent', {
      to: process.env.EMAIL_TO,
      from: validatedEmail,
      subject: sanitizedSubject,
      path: req.path,
    });
    return res.status(200).json({ message: 'Message sent successfully!' });
  } catch (error) {
    // If SMTP fails, return a 500 so the client can show an error
    logger.error('Contact email send failed', {
      error: error,
      to: process.env.EMAIL_TO,
      from: validatedEmail,
      subject: sanitizedSubject,
      path: req.path,
    });
    return res
      .status(500)
      .json({ message: 'Failed to send message. Please try again later.' });
  }
});

// -----------------------------------
// Booking API
// -----------------------------------

// Get available slots (hidden if reserved and still within hold period)
// Utility: ensure slots exist for the next N days following time rules
function ensureSlotsForNextDays(days = 14) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  end.setHours(23, 59, 59, 999);

  const insert = db.prepare(
    "INSERT OR IGNORE INTO slots (service_id, start, end, status) VALUES (1, ?, ?, 'available')"
  );

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const day = new Date(d);
    const dow = day.getDay(); // 0=Sun..6=Sat
    let times = [];
    if (dow >= 1 && dow <= 5) {
      // Mon-Fri 18:00–21:00 -> starts at 18,19,20
      times = [18, 19, 20];
    } else {
      // Sat-Sun 09:00–18:00 -> starts 9..17
      times = Array.from({ length: 9 }, (_, i) => 9 + i);
    }
    for (const hour of times) {
      const startISO = new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate(), hour, 0, 0)).toISOString();
      const endISO = new Date(Date.parse(startISO) + 60 * 60 * 1000).toISOString();
      insert.run(startISO, endISO);
    }
  }
}

// Get available slots (only slots explicitly created by admin). Optional ?calendar= filters by calendar_key.
app.get('/api/slots', generalLimiter, (req, res) => {
  const now = nowISO();
  const calendarKey = typeof req.query.calendar === 'string' ? req.query.calendar.trim() : null;
  const validCalendar = calendarKey && CALENDAR_KEYS.includes(calendarKey);
  const sql = validCalendar
    ? `SELECT s.id, s.start, s.end, sv.name AS service_name, sv.price_pence, s.status, s.reserve_until
       FROM slots s
       JOIN services sv ON sv.id = s.service_id
       WHERE s.calendar_key = ? AND (s.status = 'available' OR (s.status='reserved' AND (s.reserve_until IS NULL OR s.reserve_until < ?)))
       ORDER BY s.start`
    : `SELECT s.id, s.start, s.end, sv.name AS service_name, sv.price_pence, s.status, s.reserve_until
       FROM slots s
       JOIN services sv ON sv.id = s.service_id
       WHERE (s.status = 'available' OR (s.status='reserved' AND (s.reserve_until IS NULL OR s.reserve_until < ?)))
       ORDER BY s.start`;
  const rows = validCalendar
    ? db.prepare(sql).all(calendarKey, now)
    : db.prepare(sql).all(now);
  const available = rows.filter(r => !(r.status === 'reserved' && r.reserve_until && r.reserve_until > now));
  const events = available.map((r) => ({ id: r.id, title: r.service_name, start: r.start, end: r.end }));
  res.json(events);
});

// Create Stripe Checkout session and reserve slot to prevent oversell
app.post('/api/create-checkout-session', bookingLimiter, async (req, res) => {
  // Declare variables outside try block for error logging
  let validatedSlotId = null;
  let validatedEmail = null;
  
  try {
    if (!stripe) {return res.status(500).json({ message: 'Stripe not configured' });}
    const { slotId, email, plan, price } = req.body;
    
    // Validate and sanitize inputs
    validatedSlotId = validateSlotId(slotId);
    
    // If user is logged in, use their session email; otherwise use provided email
    if (req.session && req.session.userEmail) {
      validatedEmail = validateAndSanitizeEmail(req.session.userEmail);
    } else {
      validatedEmail = validateAndSanitizeEmail(email);
    }
    
    if (!validatedSlotId || !validatedEmail) {
      return res.status(400).json({ message: 'Valid slotId and email are required' });
    }

    const now = nowISO();
    const holdUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min hold

    // Atomically mark slot as reserved if available
    const reserve = db
      .prepare(
        "UPDATE slots SET status='reserved', reserve_until=?, stripe_session_id=NULL WHERE id=? AND status='available' AND (reserve_until IS NULL OR reserve_until < ?)"
      )
      .run(holdUntil, validatedSlotId, now);
    if (reserve.changes !== 1)
      {return res.status(409).json({ message: 'Slot is no longer available' });}

    // Read service info
    const slot = db.prepare('SELECT service_id, start, end FROM slots WHERE id=?').get(validatedSlotId);
    if (!slot) {
      return res.status(404).json({ message: 'Slot not found' });
    }
    const svc = db.prepare('SELECT name, price_pence FROM services WHERE id=?').get(slot.service_id);

    // Use plan price if provided, otherwise fall back to service price
    let pricePence = svc.price_pence;
    if (typeof price === 'number' && price >= 0) {
      pricePence = Math.round(price * 100); // Convert pounds to pence
    }

    // Build base URL from request (works in dev and production)
    const protocol = req.protocol || 'http';
    const host = req.get('host');
    if (!host) {
      logger.error('Unable to determine host from request headers', { headers: req.headers });
      return res.status(500).json({ message: 'Server configuration error' });
    }
    const baseUrl = `${protocol}://${host}`;

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: validatedEmail,
      billing_address_collection: 'required', // Require billing address including postal code
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            unit_amount: pricePence,
            product_data: {
              name: plan ? `${plan} - ${svc.name}` : svc.name,
              description: new Date(slot.start).toLocaleString(),
            },
          },
          quantity: 1,
        },
      ],
      metadata: { slot_id: String(validatedSlotId), plan: plan || '' },
      success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/calendar.html`,
    });

    // Link the session id to the reserved slot
    db.prepare('UPDATE slots SET stripe_session_id=? WHERE id=?').run(session.id, validatedSlotId);

    res.json({ url: session.url });
    logger.payment('checkout session created', {
      slotId: validatedSlotId,
      email: validatedEmail,
      sessionId: session.id,
      path: req.path,
    });
  } catch (err) {
    logger.error('Stripe checkout session creation failed', {
      error: err,
      slotId: validatedSlotId,
      email: validatedEmail,
      path: req.path,
    });
    res.status(500).json({ message: 'Failed to create checkout session' });
  }
});

// Success redirect: send user to confirmation page
app.get('/checkout/success', async (req, res) => {
  try {
    // Build base URL from request (works in dev and production)
    const protocol = req.protocol || 'http';
    const host = req.get('host');
    if (!host) {
      logger.error('Unable to determine host from request headers', { headers: req.headers });
      return res.status(500).json({ message: 'Server configuration error' });
    }
    const baseUrl = `${protocol}://${host}`;
    
    if (!stripe) {return res.redirect(`${baseUrl}/confirmation.html`);}
    const { session_id } = req.query;
    const session = await stripe.checkout.sessions.retrieve(session_id);
    const email = session.customer_details?.email || session.customer_email || '';
    
    // Store guest purchaser email in session for post-payment account upgrade flow
    if (email) {
      req.session.lastBookingEmail = email;
    }
    
    // Fallback: Ensure booking is created if webhook hasn't fired yet
    // This handles local development or webhook delays
    if (session.payment_status === 'paid' && session.metadata?.slot_id) {
      const slotId = validateSlotId(session.metadata.slot_id);
      // Use session email for logged-in users, otherwise use email from Stripe session
      let validatedEmail;
      if (req.session && req.session.userEmail) {
        validatedEmail = validateAndSanitizeEmail(req.session.userEmail);
      } else {
        validatedEmail = validateAndSanitizeEmail(email);
      }
      if (!validatedEmail) {validatedEmail = 'unknown@example.com';}
      const amount = typeof session.amount_total === 'number' && session.amount_total >= 0 
        ? session.amount_total 
        : 0;
      const paymentIntent = session.payment_intent?.toString() || '';
      
      if (slotId) {
        // Check if booking already exists (webhook may have already created it)
        const existing = db.prepare('SELECT id FROM bookings WHERE slot_id=?').get(slotId);
        if (!existing) {
          // Create booking as fallback
          try {
            const txn = db.transaction(() => {
              // Mark slot as booked if it's reserved
              const update = db
                .prepare("UPDATE slots SET status='booked' WHERE id=? AND status IN ('reserved', 'available')")
                .run(slotId);
              
              // Insert booking
              db
                .prepare(
                  'INSERT INTO bookings (slot_id, user_email, amount_pence, stripe_payment_intent, created_at) VALUES (?,?,?,?,?)'
                )
                .run(slotId, validatedEmail, amount, paymentIntent, nowISO());
              
              return true;
            });
            txn();
            logger.info('Booking created via checkout/success fallback', { slotId, email: validatedEmail });
            // Send email in background
            sendBookingEmailSafe({ email: validatedEmail, slotId });
          } catch (fallbackErr) {
            logger.error('Fallback booking creation failed', { error: fallbackErr, slotId, email: validatedEmail });
          }
        }
      }
    }
    
    // Redirect to confirmation page with email pre-filled
    const url = new URL(`${baseUrl}/confirmation.html`);
    if (email) {url.searchParams.set('email', email);}
    res.redirect(url.toString());
  } catch (err) {
    logger.error('Checkout success redirect error', {
      error: err,
      sessionId: req.query.session_id,
      path: req.path,
    });
    const protocol = req.protocol || 'http';
    const host = req.get('host');
    if (!host) {
      logger.error('Unable to determine host in error handler', { headers: req.headers });
      return res.status(500).send('Server configuration error');
    }
    const baseUrl = `${protocol}://${host}`;
    res.redirect(`${baseUrl}/confirmation.html`);
  }
});

// User: list their bookings by email
app.get('/api/my-bookings', generalLimiter, (req, res) => {
  const rawEmail = (req.query.email || '').toString();
  const email = validateAndSanitizeEmail(rawEmail);
  if (!email) {return res.json([]);}
  const rows = db
    .prepare(
      `SELECT b.id, s.start, s.end, sv.name as service_name, b.amount_pence
       FROM bookings b
       JOIN slots s ON s.id = b.slot_id
       JOIN services sv ON sv.id = s.service_id
       WHERE b.user_email = ?
       ORDER BY s.start`
    )
    .all(email);
  res.json(rows);
});

// Optional simple booking endpoint (manual fallback). Marks a slot as booked.
app.post('/api/book', bookingLimiter, (req, res) => {
  const { slotId, email, amount_pence } = req.body || {};
  
  // Validate and sanitize inputs
  const validatedSlotId = validateSlotId(slotId);
  
  // If user is logged in, use their session email; otherwise use provided email
  let validatedEmail;
  if (req.session && req.session.userEmail) {
    validatedEmail = validateAndSanitizeEmail(req.session.userEmail);
  } else {
    validatedEmail = validateAndSanitizeEmail(email);
  }
  
  if (!validatedSlotId || !validatedEmail) {
    return res.status(400).json({ message: 'Valid slotId and email are required' });
  }
  
  let price = 0; // Declare outside try block for logging
  try {
    const txn = db.transaction(() => {
      const updated = db.prepare("UPDATE slots SET status='booked' WHERE id=? AND status!='booked'").run(validatedSlotId);
      if (updated.changes !== 1) {return false;}
      const svcPrice = db.prepare('SELECT sv.price_pence FROM slots s JOIN services sv ON sv.id=s.service_id WHERE s.id=?').get(validatedSlotId);
      // Validate amount_pence is a non-negative integer if provided
      if (typeof amount_pence === 'number' && Number.isInteger(amount_pence) && amount_pence >= 0) {
        price = amount_pence;
      } else {
        price = svcPrice?.price_pence || 0;
      }
      db.prepare('INSERT OR IGNORE INTO bookings (slot_id, user_email, amount_pence, created_at) VALUES (?,?,?,?)').run(validatedSlotId, validatedEmail, price, nowISO());
      return true;
    });
    const ok = txn();
    if (!ok) {return res.status(409).json({ message: 'Slot already booked' });}
    // Fire-and-forget confirmation email
    sendBookingEmailSafe({ email: validatedEmail, slotId: validatedSlotId });
    res.json({ booked: true });
    logger.info('Slot booked successfully', {
      slotId: validatedSlotId,
      email: validatedEmail,
      amountPence: price,
      path: req.path,
    });
  } catch (e) {
    logger.error('Booking failed', {
      error: e,
      slotId: validatedSlotId,
      email: validatedEmail,
      path: req.path,
    });
    res.status(500).json({ message: 'Failed to book' });
  }
});

// Convenience alias to match alternative frontend expectations
app.get('/api/available-slots', (req, res) => {
  res.redirect(307, '/api/slots');
});

// -----------------------------------
// Authentication & User Account Routes
// -----------------------------------

// Helper: require user to be logged in
const requireLogin = (req, res, next) => {
  if (req.session && req.session.userId && req.session.userEmail) {
    return next();
  }
  return res.status(401).json({ message: 'Authentication required' });
};

// Rate limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 auth attempts per windowMs
  message: { message: 'Too many authentication attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || req.connection?.remoteAddress || 'unknown',
});

// Rate limiter for password reset requests (by IP)
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // limit each IP to 5 reset requests per hour
  message: { message: 'Too many password reset requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || req.connection?.remoteAddress || 'unknown',
});

// Rate limiter for password reset requests (by email - stored in memory)
const emailResetLimiter = new Map(); // email -> { count, resetTime }
setInterval(() => {
  const now = Date.now();
  for (const [email, data] of emailResetLimiter.entries()) {
    if (now > data.resetTime) {
      emailResetLimiter.delete(email);
    }
  }
}, 60 * 60 * 1000); // Clean up every hour

// Signup: create new user account
app.post('/api/signup', authLimiter, async (req, res) => {
  const { name, email, password } = req.body;

  // Validate and sanitize inputs
  const validatedName = sanitizeString(name, 100);
  const validatedEmail = validateAndSanitizeEmail(email);

  if (!validatedName || validatedName.length < 2) {
    return res.status(400).json({ message: 'Name must be at least 2 characters long' });
  }

  if (!validatedEmail) {
    return res.status(400).json({ message: 'Please provide a valid email address' });
  }

  if (!password || typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters long' });
  }

  try {
    // Check if user already exists
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(validatedEmail);
    if (existingUser) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const createdAt = nowISO();
    const updatedAt = createdAt;
    const result = db
      .prepare(
        'INSERT INTO users (email, name, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
      )
      .run(validatedEmail, validatedName, passwordHash, createdAt, updatedAt);

    // Create session
    req.session.userId = result.lastInsertRowid;
    req.session.userEmail = validatedEmail;
    req.session.userName = validatedName;

    logger.info('User account created', {
      userId: result.lastInsertRowid,
      email: validatedEmail,
      path: req.path,
    });

    // Clear lastBookingEmail if it exists (user completed post-payment account upgrade)
    if (req.session.lastBookingEmail) {
      delete req.session.lastBookingEmail;
    }

    // Check if this signup came from booking flow (via query param or referrer)
    const fromBooking = req.query.from === 'booking' || req.body.from === 'booking';

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      user: {
        id: result.lastInsertRowid,
        email: validatedEmail,
        name: validatedName,
      },
      redirectTo: fromBooking ? '/my-bookings.html' : '/account.html',
    });
  } catch (err) {
    // Log detailed error for debugging
    logger.error('Signup failed', {
      error: err,
      errorMessage: err.message,
      errorCode: err.code,
      errorStack: err.stack,
      email: validatedEmail,
      name: validatedName,
      path: req.path,
    });
    
    // Check for specific database errors
    if (err.message && err.message.includes('no such column')) {
      return res.status(500).json({ 
        message: 'Database schema error. Please restart the server to run migrations.',
        error: 'Schema mismatch'
      });
    }
    if (err.code === 'SQLITE_CONSTRAINT' && err.message && err.message.includes('UNIQUE')) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }
    
    // Check for bcrypt errors (common after v6 update)
    if (err.message && (err.message.includes('bcrypt') || err.message.includes('password'))) {
      logger.error('bcrypt error detected - may need to rebuild', { error: err });
      return res.status(500).json({ 
        message: 'Password hashing error. Please contact support if this persists.',
        error: 'bcrypt_error',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
    
    // Provide more helpful error in development
    const errorMessage = process.env.NODE_ENV === 'development' 
      ? `Failed to create account: ${err.message}` 
      : 'Failed to create account. Please try again later.';
    
    res.status(500).json({ 
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? err.code : undefined
    });
  }
});

// Login: authenticate user and create session
app.post('/api/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;

  // Validate and sanitize email
  const validatedEmail = validateAndSanitizeEmail(email);
  if (!validatedEmail) {
    return res.status(400).json({ message: 'Please provide a valid email address' });
  }

  if (!password || typeof password !== 'string') {
    return res.status(400).json({ message: 'Password is required' });
  }

  try {
    // Find user by email
    const user = db.prepare('SELECT id, email, name, password_hash FROM users WHERE email = ?').get(validatedEmail);
    if (!user) {
      // Don't reveal if email exists (security best practice)
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Create session
    req.session.userId = user.id;
    req.session.userEmail = user.email;

    logger.info('User logged in', {
      userId: user.id,
      email: user.email,
      path: req.path,
    });

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (err) {
    logger.error('Login failed', {
      error: err,
      email: validatedEmail,
      path: req.path,
    });
    res.status(500).json({ message: 'Login failed. Please try again later.' });
  }
});

// Logout: destroy session
app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      logger.error('Logout session destroy failed', { error: err, path: req.path });
      return res.status(500).json({ message: 'Logout failed' });
    }
    res.clearCookie('connect.sid'); // Clear session cookie
    res.json({ message: 'Logged out successfully' });
  });
});

// -----------------------------------
// Password Reset Routes
// -----------------------------------

// Helper: Generate secure random token
const generateResetToken = () => {
  return randomBytes(32).toString('hex');
};

// Helper: Hash token for storage (SHA-256)
const hashToken = (token) => {
  return createHash('sha256').update(token).digest('hex');
};

// Helper: Get base URL for reset links
const getBaseUrl = (req) => {
  if (process.env.APP_BASE_URL) {
    return process.env.APP_BASE_URL.replace(/\/$/, ''); // Remove trailing slash
  }
  const protocol = req.protocol || 'http';
  let host = req.get('host');
  
  // Normalize host: ensure port is included if missing
  if (host && !host.includes(':')) {
    const port = process.env.PORT || 3000;
    host = `${host}:${port}`;
  }
  
  // If host is localhost/127.0.0.1 and we're in development, try to use the actual network IP
  // This allows password reset links to work when accessed from mobile devices
  if (host && (host.includes('localhost') || host.includes('127.0.0.1'))) {
    // In development, try to detect the network IP
    // For production, APP_BASE_URL should be set
    const networkInterfaces = os.networkInterfaces();
    for (const name of Object.keys(networkInterfaces)) {
      for (const iface of networkInterfaces[name]) {
        // Skip internal (loopback) and non-IPv4 addresses
        if (iface.family === 'IPv4' && !iface.internal) {
          // Use the first non-internal IPv4 address
          const port = process.env.PORT || 3000;
          host = `${iface.address}:${port}`;
          logger.info('Using network IP for password reset link', { 
            host, 
            originalHost: req.get('host'),
            userAgent: req.get('user-agent'),
            isMobile: isMobileRequest(req)
          });
          break;
        }
      }
      if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
        break;
      }
    }
  }
  
  // Validate host before returning
  if (!host || host.length === 0) {
    logger.error('Unable to determine host for password reset', { 
      headers: req.headers,
      userAgent: req.get('user-agent'),
      ip: req.ip,
      isMobile: isMobileRequest(req)
    });
    throw new Error('Server configuration error: unable to determine base URL');
  }
  
  // Log for debugging mobile requests
  if (isMobileRequest(req)) {
    logger.info('Password reset URL generated for mobile device', {
      host,
      protocol,
      userAgent: req.get('user-agent'),
      ip: req.ip
    });
  }
  
  return `${protocol}://${host}`;
};

// Helper: Send password reset email
const sendPasswordResetEmail = async (email, resetToken, baseUrl) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    logger.warn('Email not configured - cannot send password reset email', { email });
    return false;
  }

  const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.mail.me.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_PORT === '465',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_FROM || `"Louis Perrin Tutor" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Password Reset Request',
    text: `You requested a password reset for your account.

Click the following link to reset your password:
${resetUrl}

This link will expire in 1 hour and can only be used once.

If you did not request this password reset, please ignore this email.`,
    html: `
      <p>You requested a password reset for your account.</p>
      <p><a href="${resetUrl}" style="background: #0056ff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a></p>
      <p>Or copy and paste this link into your browser:</p>
      <p>${resetUrl}</p>
      <p><strong>This link will expire in 1 hour and can only be used once.</strong></p>
      <p>If you did not request this password reset, please ignore this email.</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.email('password reset email sent', { email, baseUrl, resetUrl });
    return true;
  } catch (err) {
    logger.error('Password reset email send failed', { 
      error: err, 
      email,
      errorMessage: err.message,
      errorCode: err.code,
      smtpHost: process.env.EMAIL_HOST || 'smtp.mail.me.com',
      smtpPort: process.env.EMAIL_PORT || '587'
    });
    return false;
  }
};

// GET /forgot-password - Serve forgot password page
app.get('/forgot-password', (req, res) => {
  res.sendFile(path.join(__dirname, 'forgot-password.html'));
});

// POST /forgot-password - Request password reset
app.post('/api/forgot-password', passwordResetLimiter, async (req, res) => {
  const { email } = req.body;

  // Validate email
  const validatedEmail = validateAndSanitizeEmail(email);
  if (!validatedEmail) {
    // Generic response to prevent email enumeration
    return res.status(200).json({ 
      message: 'If that email exists in our system, we\'ve sent a password reset link.' 
    });
  }

  // Rate limit by email (in addition to IP rate limiting)
  const emailLimit = emailResetLimiter.get(validatedEmail);
  const now = Date.now();
  if (emailLimit && now < emailLimit.resetTime && emailLimit.count >= 3) {
    // Generic response even when rate limited
    return res.status(200).json({ 
      message: 'If that email exists in our system, we\'ve sent a password reset link.' 
    });
  }

  try {
    // Find user by email
    const user = db.prepare('SELECT id, email FROM users WHERE email = ?').get(validatedEmail);
    
    // Generic response regardless of whether user exists (security best practice)
    const genericResponse = { 
      message: 'If that email exists in our system, we\'ve sent a password reset link.' 
    };

    if (!user) {
      // Still return success to prevent email enumeration
      return res.status(200).json(genericResponse);
    }

    // Invalidate any existing unused reset tokens for this user
    db.prepare('DELETE FROM password_resets WHERE user_id = ? AND used_at IS NULL').run(user.id);

    // Generate reset token
    const resetToken = generateResetToken();
    const tokenHash = hashToken(resetToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
    const createdAt = nowISO();
    const requestIp = req.ip || req.connection?.remoteAddress || null;

    // Store token hash in database
    db.prepare(
      'INSERT INTO password_resets (user_id, token_hash, expires_at, created_at, request_ip) VALUES (?, ?, ?, ?, ?)'
    ).run(user.id, tokenHash, expiresAt, createdAt, requestIp);

    // Update email rate limiter
    emailResetLimiter.set(validatedEmail, {
      count: (emailLimit?.count || 0) + 1,
      resetTime: now + (60 * 60 * 1000), // 1 hour
    });

    // Send reset email
    const baseUrl = getBaseUrl(req);
    await sendPasswordResetEmail(validatedEmail, resetToken, baseUrl);

    logger.info('Password reset requested', { 
      userId: user.id, 
      email: validatedEmail,
      ip: requestIp,
      isMobile: isMobileRequest(req),
      userAgent: req.get('user-agent')
    });

    return res.status(200).json(genericResponse);
  } catch (err) {
    logger.error('Password reset request failed', {
      error: err,
      email: validatedEmail,
      path: req.path,
    });
    // Still return generic response on error
    return res.status(200).json({ 
      message: 'If that email exists in our system, we\'ve sent a password reset link.' 
    });
  }
});

// GET /reset-password - Validate token and serve reset form
app.get('/reset-password', (req, res) => {
  const { token } = req.query;

  if (!token || typeof token !== 'string') {
    return res.sendFile(path.join(__dirname, 'reset-password.html'));
  }

  // Validate token
  const tokenHash = hashToken(token);
  const now = nowISO();
  
  const resetRecord = db.prepare(
    `SELECT pr.id, pr.user_id, pr.expires_at, pr.used_at, u.email 
     FROM password_resets pr 
     JOIN users u ON u.id = pr.user_id 
     WHERE pr.token_hash = ? AND pr.expires_at > ? AND pr.used_at IS NULL`
  ).get(tokenHash, now);

  if (!resetRecord) {
    // Token invalid, expired, or already used - still serve page but with error state
    return res.sendFile(path.join(__dirname, 'reset-password.html'));
  }

  // Token is valid - serve page (token will be validated again on POST)
  res.sendFile(path.join(__dirname, 'reset-password.html'));
});

// POST /reset-password - Reset password with token
app.post('/api/reset-password', passwordResetLimiter, async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body;

    // Log request for debugging mobile issues
    logger.info('Password reset attempt', {
      hasToken: !!token,
      hasPassword: !!password,
      passwordLength: password ? password.length : 0,
      passwordsMatch: password === confirmPassword,
      isMobile: isMobileRequest(req),
      userAgent: req.get('user-agent'),
      ip: req.ip,
      contentType: req.get('content-type')
    });

    // Validate token
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ message: 'Reset token is required' });
    }

    // Validate passwords
    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters long' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }
    // Hash token and find valid reset record
    const tokenHash = hashToken(token);
    const now = nowISO();
    
    const resetRecord = db.prepare(
      `SELECT pr.id, pr.user_id, pr.expires_at, pr.used_at, u.email 
       FROM password_resets pr 
       JOIN users u ON u.id = pr.user_id 
       WHERE pr.token_hash = ? AND pr.expires_at > ? AND pr.used_at IS NULL`
    ).get(tokenHash, now);

    if (!resetRecord) {
      return res.status(400).json({ 
        message: 'Invalid or expired reset token. Please request a new password reset.' 
      });
    }

    // Hash new password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Update password and mark token as used (atomic transaction)
    const txn = db.transaction(() => {
      // Update user password
      db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(
        passwordHash,
        now,
        resetRecord.user_id
      );

      // Mark token as used
      db.prepare('UPDATE password_resets SET used_at = ? WHERE id = ?').run(now, resetRecord.id);

      return true;
    });

    txn();

    logger.info('Password reset completed', {
      userId: resetRecord.user_id,
      email: resetRecord.email,
      isMobile: isMobileRequest(req),
      userAgent: req.get('user-agent')
    });

    // Optionally invalidate all existing sessions for this user
    // (This would require session store modification - skipping for now)

    res.status(200).json({ 
      message: 'Password reset successfully. You can now log in with your new password.',
      redirectTo: '/login.html'
    });
  } catch (err) {
    logger.error('Password reset failed', {
      error: err,
      errorMessage: err.message,
      errorStack: err.stack,
      path: req.path,
      isMobile: isMobileRequest(req),
      userAgent: req.get('user-agent'),
      ip: req.ip,
      body: req.body ? { hasToken: !!req.body.token, hasPassword: !!req.body.password } : 'no body'
    });
    res.status(500).json({ message: 'Failed to reset password. Please try again.' });
  }
});

// Account entry point: redirect to account.html if authenticated, else login.html
app.get('/account-entry', (req, res) => {
  if (req.session && req.session.userId && req.session.userEmail) {
    return res.redirect('/account.html');
  }
  return res.redirect('/login.html');
});

// Smart "manage bookings" route: routes based on session state
app.get('/manage-bookings', (req, res) => {
  // If user is logged in, go straight to my-bookings
  if (req.session && req.session.userId && req.session.userEmail) {
    return res.redirect('/my-bookings.html');
  }
  
  // If guest purchaser with lastBookingEmail, redirect to signup
  if (req.session && req.session.lastBookingEmail) {
    return res.redirect('/singup.html?from=booking');
  }
  
  // Otherwise, redirect to login
  return res.redirect('/login.html');
});

// Serve confirmation.html with server-side login state injection
app.get('/confirmation.html', (req, res, next) => {
  const isLoggedIn = !!(req.session && req.session.userId && req.session.userEmail);
  const filePath = path.join(__dirname, 'confirmation.html');
  
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    
    // Inject script to set login state flag
    const loginStateScript = `
      <script>
        // Login state injected by server
        window.__IS_LOGGED_IN__ = ${isLoggedIn};
      </script>`;
    
    // Inject script before closing head tag
    const modifiedData = data.replace('</head>', loginStateScript + '</head>');
    
    res.setHeader('Content-Type', 'text/html');
    res.send(modifiedData);
  } catch (err) {
    logger.error('Failed to serve confirmation.html with login state', { error: err });
    next(); // Fall back to static file serving
  }
});

// Serve singup.html with server-side email injection for ?from=booking mode
app.get('/singup.html', (req, res, next) => {
  const fromBooking = req.query.from === 'booking';
  const lastBookingEmail = req.session?.lastBookingEmail;
  
  if (fromBooking && lastBookingEmail) {
    // Read the file, inject email, and send
    const filePath = path.join(__dirname, 'singup.html');
    
    try {
      const data = fs.readFileSync(filePath, 'utf8');
      
      // Escape HTML in email for safety
      const escapedEmail = lastBookingEmail.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
      
      // Replace the email input to prefill and lock it
      const emailInputRegex = /<input type="email" id="email"[^>]*>/;
      const emailInputWithPrefill = `<input type="email" id="email" value="${escapedEmail}" readonly style="background-color: #f5f5f5; cursor: not-allowed;" placeholder="Email Address" required pattern="[^\\s@]+@[^\\s@]+\\.[^\\s@]+" title="Please enter a valid email address (e.g., name@example.com)" aria-required="true" aria-describedby="emailError"`;
      
      // Replace the email input
      const modifiedData = data.replace(emailInputRegex, emailInputWithPrefill);
      
      // Also add a script to ensure email is locked and indicate this is from booking
      const scriptInjection = `
      <script>
        // Ensure email is locked and prefilled from booking
        document.addEventListener('DOMContentLoaded', () => {
          const emailInput = document.getElementById('email');
          if (emailInput) {
            emailInput.setAttribute('readonly', 'readonly');
            emailInput.style.backgroundColor = '#f5f5f5';
            emailInput.style.cursor = 'not-allowed';
            emailInput.setAttribute('data-from-booking', 'true');
          }
        });
      </script>`;
      
      // Inject script before closing body tag
      const finalData = modifiedData.replace('</body>', scriptInjection + '</body>');
      
      res.setHeader('Content-Type', 'text/html');
      res.send(finalData);
    } catch (err) {
      logger.error('Failed to serve singup.html with booking email', { error: err });
      next(); // Fall back to static file serving
    }
  } else {
    // Normal flow - serve static file
    next();
  }
});

// Map amount_pence to Activity display label
const mapAmountToActivity = (amountPence) => {
  if (amountPence === 0) {
    return 'Trial Session (30 mins)';
  } else if (amountPence === 4000 || amountPence === 3500 || amountPence === 4500) {
    return 'Tutoring session (1 hour)';
  } else if (amountPence === 2000 || amountPence === 2500) {
    return 'Tutoring session (1 hour)';
  } else {
    return 'Unknown';
  }
};

// Get current user's bookings (authenticated, split into future/previous)
app.get('/api/user-bookings', requireLogin, (req, res) => {
  try {
    const now = nowISO();
    const rows = db
      .prepare(
        `SELECT b.id, s.start, s.end, sv.name as service_name, b.amount_pence
         FROM bookings b
         JOIN slots s ON s.id = b.slot_id
         JOIN services sv ON sv.id = s.service_id
         WHERE b.user_email = ?
         ORDER BY s.start`
      )
      .all(req.session.userEmail);

    // Split into future and previous based on slot start time, and map activity
    const future = [];
    const previous = [];
    for (const row of rows) {
      const activity = mapAmountToActivity(row.amount_pence);
      
      // Log warning if activity is unknown
      if (activity === 'Unknown') {
        logger.warn('Unknown booking amount_pence value', {
          bookingId: row.id,
          amountPence: row.amount_pence,
          userId: req.session.userId,
          email: req.session.userEmail,
        });
      }
      
      const bookingWithActivity = {
        ...row,
        activity
      };
      
      if (row.start >= now) {
        future.push(bookingWithActivity);
      } else {
        previous.push(bookingWithActivity);
      }
    }

    res.json({
      future,
      previous
    });
  } catch (err) {
    logger.error('Get user bookings failed', {
      error: err,
      userId: req.session.userId,
      email: req.session.userEmail,
      path: req.path,
    });
    res.status(500).json({ message: 'Failed to fetch bookings' });
  }
});

// Delete user's own booking
app.delete('/api/user-bookings/:bookingId', requireLogin, (req, res) => {
  try {
    const bookingId = Number(req.params.bookingId);
    if (!Number.isInteger(bookingId) || bookingId <= 0) {
      return res.status(400).json({ message: 'Invalid booking ID' });
    }

    // Verify booking exists and belongs to the logged-in user
    const booking = db.prepare('SELECT id, slot_id, user_email FROM bookings WHERE id=?').get(bookingId);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (booking.user_email !== req.session.userEmail) {
      return res.status(403).json({ message: 'You do not have permission to delete this booking' });
    }

    // Delete booking and remove the slot from the system
    const txn = db.transaction(() => {
      // Delete the booking
      const deleteResult = db.prepare('DELETE FROM bookings WHERE id=?').run(bookingId);
      
      // Delete the slot entirely (removes it from calendar and admin views)
      db.prepare('DELETE FROM slots WHERE id=?').run(booking.slot_id);
      
      return deleteResult.changes > 0;
    });

    if (txn()) {
      logger.info('User deleted booking', {
        bookingId,
        slotId: booking.slot_id,
        userId: req.session.userId,
        email: req.session.userEmail,
      });
      res.json({ message: 'Booking deleted successfully' });
    } else {
      res.status(500).json({ message: 'Failed to delete booking' });
    }
  } catch (err) {
    logger.error('Delete user booking failed', {
      error: err,
      bookingId: req.params.bookingId,
      userId: req.session.userId,
      email: req.session.userEmail,
      path: req.path,
    });
    res.status(500).json({ message: 'Failed to delete booking' });
  }
});

// Get current user account info (protected)
app.get('/api/account', requireLogin, (req, res) => {
  try {
    const user = db
      .prepare('SELECT id, email, name, created_at, updated_at FROM users WHERE id = ?')
      .get(req.session.userId);

    if (!user) {
      // Session exists but user was deleted
      req.session.destroy();
      return res.status(401).json({ message: 'User not found' });
    }

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      created_at: user.created_at,
      updated_at: user.updated_at,
    });
  } catch (err) {
    logger.error('Get account failed', {
      error: err,
      userId: req.session.userId,
      path: req.path,
    });
    res.status(500).json({ message: 'Failed to fetch account information' });
  }
});

// Admin calendar alias as per spec
app.get('/api/calendar', (req, res, _next) => requireAdmin(req, res, () => {
  const rows = db
    .prepare(`SELECT b.id, s.start, s.end, sv.name as service_name, b.user_email, b.amount_pence
              FROM bookings b
              JOIN slots s ON s.id = b.slot_id
              JOIN services sv ON sv.id = s.service_id
              ORDER BY s.start DESC`).all();
  res.json(rows);
}));

// Helper: send confirmation email; ignores failures in background
function sendBookingEmailSafe({ email, slotId }) {
  setImmediate(() => {
    try {
      // Check if email is configured before attempting to send
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        logger.warn('Email not configured - skipping booking confirmation', { email, slotId });
        return;
      }
      
      const slot = db.prepare('SELECT s.start, sv.name, sv.price_pence FROM slots s JOIN services sv ON sv.id=s.service_id WHERE s.id=?').get(slotId);
      if (!slot || !email) {return;}
      const when = new Date(slot.start).toLocaleString();
      const price = (slot.price_pence/100).toFixed(2);
      const transporter = nodemailer.createTransport({
        host: 'smtp.mail.me.com',
        port: 587,
        secure: false,
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
      });
      const toUser = {
        from: `"Louis Perrin Tutor" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `Booking confirmed: ${slot.name}`,
        text: `Your tutoring session is booked for ${when}. Price: £${price}.`,
      };
      const toAdmin = {
        from: `"Booking" <${process.env.EMAIL_USER}>`,
        to: process.env.EMAIL_TO || process.env.EMAIL_USER,
        subject: `New booking from ${email}`,
        text: `${slot.name} at ${when} for ${email}.`,
      };
      transporter.sendMail(toUser).catch((err) => {
        logger.error('Booking confirmation email to user failed', {
          error: err,
          email,
          slotId,
        });
      });
      transporter.sendMail(toAdmin).catch((err) => {
        logger.error('Booking notification email to admin failed', {
          error: err,
          email,
          slotId,
        });
      });
      logger.email('booking confirmation sent', {
        email,
        slotId,
        when: slot.start,
      });
    } catch (e) {
      logger.error('sendBookingEmailSafe failed', {
        error: e,
        email,
        slotId,
      });
    }
  });
}

// -----------------------------------
// Admin endpoints (simple key check)
// -----------------------------------
// Admin login endpoint
app.post('/admin/login', bodyParser.json(), (req, res) => {
  const { adminKey } = req.body || {};
  if (!process.env.ADMIN_KEY) {
    return res.status(500).json({ message: 'Admin key not configured on server' });
  }
  if (adminKey === process.env.ADMIN_KEY) {
    req.session.adminAuthenticated = true;
    return res.json({ message: 'Login successful' });
  }
  return res.status(401).json({ message: 'Invalid admin key' });
});

// Check admin authentication status
app.get('/admin/check-auth', (req, res) => {
  if (req.session && req.session.adminAuthenticated) {
    return res.json({ authenticated: true });
  }
  return res.status(401).json({ authenticated: false });
});

// Admin logout endpoint
app.post('/admin/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: 'Logout failed' });
    }
    return res.json({ message: 'Logged out successfully' });
  });
});

const requireAdmin = (req, res, next) => {
  // Check session first (new method)
  if (req.session && req.session.adminAuthenticated) {
    return next();
  }
  // Fallback to query/header for backward compatibility during transition
  const key = req.query.adminKey || req.headers['x-admin-key']; 
  if (!process.env.ADMIN_KEY) {
    return res.status(500).json({ message: 'Admin key not configured on server' });
  }
  if (key === process.env.ADMIN_KEY) {
    // Set session for future requests
    req.session.adminAuthenticated = true;
    return next();
  }
  return res.status(401).json({ message: 'Invalid admin key' });
};

// Generate slots over a date range with given daily times. Body must include calendarKey (one of the 10 calendars).
// Body: { startDate, endDate, times: ['17:00','19:00'], calendarKey: 'gcse-maths-1to1' }
app.post('/admin/generate-slots', requireAdmin, (req, res) => {
  const { startDate, endDate, times = ['17:00'], calendarKey } = req.body;
  if (!startDate || !endDate) { return res.status(400).json({ message: 'startDate and endDate required' }); }
  if (!calendarKey || typeof calendarKey !== 'string') {
    return res.status(400).json({ message: 'Calendar (session type) is required. Please select one from the dropdown.' });
  }
  const key = calendarKey.trim();
  const validatedServiceId = calendarKeyToServiceId[key];
  if (!validatedServiceId) {
    return res.status(400).json({ message: 'Invalid calendar. Please select a valid option from the dropdown.' });
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
    return res.status(400).json({ message: 'Dates must be in YYYY-MM-DD format' });
  }
  if (!Array.isArray(times) || times.length === 0) {
    return res.status(400).json({ message: 'times must be a non-empty array' });
  }
  const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
  const validatedTimes = times
    .filter(t => typeof t === 'string' && timeRegex.test(t.trim()))
    .map(t => t.trim());
  if (validatedTimes.length === 0) {
    return res.status(400).json({ message: 'All times must be in HH:MM format (24-hour)' });
  }
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T23:59:59`);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return res.status(400).json({ message: 'Invalid date values' });
  }
  if (start > end) {
    return res.status(400).json({ message: 'startDate must be before or equal to endDate' });
  }

  const durationMs = 60 * 60 * 1000; // 1 hour for all 10 calendar types
  const insert = db.prepare(
    "INSERT OR IGNORE INTO slots (service_id, start, end, status, calendar_key) VALUES (?,?,?, 'available', ?)"
  );
  let added = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const day = d.toISOString().slice(0, 10);
    for (const t of validatedTimes) {
      const startISO = new Date(`${day}T${t}:00`).toISOString();
      const endISO = new Date(new Date(`${day}T${t}:00`).getTime() + durationMs).toISOString();
      const resIns = insert.run(validatedServiceId, startISO, endISO, key);
      added += resIns.changes;
    }
  }
  res.json({ added });
});

// Admin: delete a slot by ID
app.delete('/admin/slots/:slotId', requireAdmin, (req, res) => {
  const slotId = validateSlotId(req.params.slotId);
  if (!slotId) {
    return res.status(400).json({ message: 'Invalid slot ID' });
  }

  // Check if slot exists and is not booked
  const slot = db.prepare('SELECT id, status FROM slots WHERE id=?').get(slotId);
  if (!slot) {
    return res.status(404).json({ message: 'Slot not found' });
  }

  // Only allow deletion of available or reserved slots (not booked slots)
  if (slot.status === 'booked') {
    return res.status(400).json({ message: 'Cannot delete a booked slot' });
  }

  // Delete the slot
  const result = db.prepare('DELETE FROM slots WHERE id=?').run(slotId);
  if (result.changes === 0) {
    return res.status(404).json({ message: 'Slot not found' });
  }

  logger.info('Admin deleted slot', { slotId, adminKey: req.query.adminKey || req.headers['x-admin-key'] ? 'provided' : 'missing' });
  res.json({ message: 'Slot deleted successfully', deleted: result.changes });
});

// Admin: list available slots (for a date range, optional)
app.get('/admin/slots', requireAdmin, (req, res) => {
  const { startDate, endDate } = req.query;
  let query = `SELECT s.id, s.start, s.end, sv.name AS service_name, s.status
               FROM slots s
               JOIN services sv ON sv.id = s.service_id`;
  let params = [];
  
  if (startDate && endDate) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      return res.status(400).json({ message: 'Dates must be in YYYY-MM-DD format' });
    }
    query += ` WHERE s.start >= ? AND s.start <= ?`;
    params = [`${startDate}T00:00:00`, `${endDate}T23:59:59`];
  }
  
  query += ` ORDER BY s.start`;
  const rows = db.prepare(query).all(...params);
  res.json(rows);
});

// Admin: list all bookings
app.get('/admin/bookings', requireAdmin, (req, res) => {
  const rows = db
    .prepare(
      `SELECT b.id, s.start, s.end, sv.name as service_name, b.user_email, b.amount_pence
       FROM bookings b
       JOIN slots s ON s.id = b.slot_id
       JOIN services sv ON sv.id = s.service_id
       ORDER BY s.start DESC`
    )
    .all();
  res.json(rows);
});

// Admin: list all mailing list subscribers
app.get('/admin/mailing-list', requireAdmin, (req, res) => {
  try {
    const { search, source } = req.query;
    let query = `SELECT email, consent_given, consent_timestamp, source, created_at, updated_at 
                 FROM mailing_list_subscribers 
                 WHERE 1=1`;
    const params = [];

    // Filter by email search (case-insensitive partial match)
    if (search && typeof search === 'string' && search.trim()) {
      query += ` AND email LIKE ?`;
      params.push(`%${search.trim().toLowerCase()}%`);
    }

    // Filter by source (exact match)
    if (source && typeof source === 'string' && source.trim()) {
      query += ` AND source = ?`;
      params.push(sanitizeString(source.trim(), 100));
    }

    query += ` ORDER BY created_at DESC`;

    const rows = db.prepare(query).all(...params);
    
    // Convert SQLite boolean (0/1) to true/false for JSON response
    const formattedRows = rows.map(row => ({
      email: row.email,
      consent_given: row.consent_given === 1,
      consent_timestamp: row.consent_timestamp,
      source: row.source,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    res.json(formattedRows);
  } catch (err) {
    logger.error('Admin mailing list fetch failed', {
      error: err,
      path: req.path,
      query: req.query,
    });
    res.status(500).json({ message: 'Failed to fetch mailing list subscribers' });
  }
});

// -----------------------------------
// Mailing List Signup Route (/join-mailing-list)
// Purpose: Save subscriber to database with consent tracking
// Design: Return 200 immediately after saving so the client can redirect
// -----------------------------------
app.post('/join-mailing-list', mailingListLimiter, async (req, res) => {
  // 1) Read and validate the user email and source from the JSON body
  const { email, source } = req.body;

  // 2) Validate and sanitize email
  const validatedEmail = validateAndSanitizeEmail(email);
  if (!validatedEmail) {
    return res.status(400).json({ message: 'Please provide a valid email address.' });
  }

  // 3) Validate and sanitize source (default to 'unknown' if not provided)
  const validatedSource = sanitizeString(source || 'unknown', 100) || 'unknown';

  // 4) Set consent fields (consent_given=true since form includes explicit consent text)
  const consentGiven = 1; // SQLite boolean: 1 = true
  const consentTimestamp = nowISO();
  const createdAt = nowISO();
  const updatedAt = nowISO();

  try {
    // 5) Insert subscriber (deduplicate by email - INSERT OR IGNORE prevents duplicates)
    const insertResult = db
      .prepare(
        `INSERT OR IGNORE INTO mailing_list_subscribers 
         (email, consent_given, consent_timestamp, source, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(validatedEmail, consentGiven, consentTimestamp, validatedSource, createdAt, updatedAt);

    // 6) Check if this was a new subscriber (insertResult.changes === 1) or duplicate (0)
    const isNewSubscriber = insertResult.changes === 1;

    // 7) Respond 200 right away so the frontend can continue/redirect
    res.status(200).json({ 
      message: isNewSubscriber 
        ? "Thanks for joining! You're on the list." 
        : "Thanks for joining! You're already on the list." 
    });

    // 8) Fire-and-forget: send the notification email AFTER responding (only for new subscribers)
    if (isNewSubscriber) {
      setImmediate(async () => {
        try {
          const transporter = nodemailer.createTransport({
            host: 'smtp.mail.me.com',
            port: 587,
            secure: false,
            auth: {
              user: process.env.EMAIL_USER,
              pass: process.env.EMAIL_PASS,
            },
          });

          const mailOptions = {
            from: `"Mailing List Signup" <${process.env.EMAIL_USER}>`,
            to: process.env.EMAIL_TO,
            subject: `New mailing list signup: ${validatedEmail}`,
            text: `A new user has joined your mailing list:\nEmail: ${validatedEmail}\nSource: ${validatedSource}`,
          };

          await transporter.sendMail(mailOptions);
          logger.email('mailing list signup notification sent', {
            email: validatedEmail,
            source: validatedSource,
            path: req.path,
          });
        } catch (bgErr) {
          // Background failures should not affect the user flow
          logger.error('Background mailing list signup email send failed', {
            error: bgErr,
            email: validatedEmail,
            source: validatedSource,
            path: req.path,
          });
        }
      });
    }

    logger.info('Mailing list signup processed', {
      email: validatedEmail,
      source: validatedSource,
      isNewSubscriber,
      path: req.path,
    });
  } catch (dbErr) {
    // If database operation failed, we inform the client
    logger.error('Mailing list database operation failed', {
      error: dbErr,
      email: validatedEmail,
      source: validatedSource,
      path: req.path,
    });
    return res
      .status(500)
      .json({ message: 'Failed to join mailing list. Try again later.' });
  }
});

// -----------------------------------
// Serve Static Files (HTML, CSS, JS, images, etc.)
// This must be after all API routes to ensure API routes are matched first
// Explicitly set Content-Type for CSS files to ensure browser applies styles
// Disable caching for CSS during development to prevent stale cache issues
// -----------------------------------

// Explicit route for CSS file to ensure it's always accessible
app.get('/styles.css', (req, res) => {
  const cssPath = path.join(__dirname, 'styles.css');
  res.setHeader('Content-Type', 'text/css; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  logger.info('Serving CSS file via explicit route', { path: req.path, ip: req.ip, userAgent: req.get('user-agent') });
  res.sendFile(cssPath);
});

// Explicit route for homepage to ensure proper serving
app.get('/', (req, res) => {
  const indexPath = path.join(__dirname, 'index.html');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Disable caching for HTML in development to prevent stale cache issues
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  logger.info('Serving homepage via explicit route', { path: req.path, ip: req.ip, userAgent: req.get('user-agent') });
  
  // Read file to verify CSS link is present before sending
  try {
    const htmlContent = fs.readFileSync(indexPath, 'utf8');
    const hasCssLink = htmlContent.includes('href="/styles.css"');
    logger.info('Homepage file check', { hasCssLink, cssLinkCount: (htmlContent.match(/styles\.css/g) || []).length });
  } catch (readErr) {
    logger.error('Error reading index.html', { error: readErr });
  }
  
  res.sendFile(indexPath);
});

// Explicit routes for common JS files (ensures they're accessible on mobile Safari)
const jsFiles = ['analytics.js', 'load-navigation.js', 'fetch-with-timeout.js', 'email-validation.js', 'form-validation.js', 'client-logger.js'];
jsFiles.forEach(jsFile => {
  app.get(`/${jsFile}`, (req, res) => {
    const jsPath = path.join(__dirname, jsFile);
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    logger.info('Serving JS file via explicit route', { path: req.path, file: jsFile, ip: req.ip });
    res.sendFile(jsPath);
  });
});

// CHANGED: Explicit route for navigation.html so Safari iOS gets correct Content-Type and no 404
app.get('/navigation.html', (req, res) => {
  const navPath = path.join(__dirname, 'navigation.html');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  logger.info('Serving navigation.html via explicit route', { path: req.path, ip: req.ip, userAgent: req.get('user-agent') });
  res.sendFile(navPath);
});

// Serve PDFs from PDF folder at /pdfs/ (e.g. /pdfs/Physics_Paper_1_2023.pdf)
app.use('/pdfs', express.static(path.join(__dirname, 'PDF'), {
  setHeaders: (res, filePath) => {
    if (path.extname(filePath).toLowerCase() === '.pdf') {
      res.setHeader('Content-Type', 'application/pdf');
    }
  }
}));

// Debug middleware: Log HTML responses and check for CSS/JS requests
app.use((req, res, next) => {
  if (req.path === '/' || req.path.endsWith('.html')) {
    const originalSend = res.send;
    res.send = function(data) {
      if (typeof data === 'string' && data.includes('<html')) {
        const hasCssLink = data.includes('styles.css');
        const cssLinkAbsolute = data.includes('href="/styles.css"');
        logger.info('HTML response check', { 
          path: req.path, 
          hasCssLink,
          cssLinkAbsolute,
          cssLinkCount: (data.match(/styles\.css/g) || []).length,
          ip: req.ip,
          userAgent: req.get('user-agent')
        });
      }
      return originalSend.call(this, data);
    };
  }
  next();
});

// Log all static asset requests for debugging
app.use((req, res, next) => {
  if (req.path.endsWith('.css') || req.path.endsWith('.js')) {
    logger.info('Static asset request', {
      path: req.path,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
  }
  next();
});

app.use(express.static('.', {
  setHeaders: (res, filePath) => {
    // Ensure proper MIME types for all static files (important for Safari/iOS)
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.css') {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
      // Disable caching for CSS in development to prevent stale cache
      if (process.env.NODE_ENV !== 'production') {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
      // Log CSS requests for debugging
      logger.info('Serving CSS file via static middleware', { filePath, contentType: 'text/css', ip: res.req?.ip });
    } else if (ext === '.js') {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    } else if (ext === '.html') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      // Disable caching for HTML in development
      if (process.env.NODE_ENV !== 'production') {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
    } else if (ext === '.pdf') {
      res.setHeader('Content-Type', 'application/pdf');
    }
    // Add CORS headers for static assets (helps with cross-origin issues)
    res.setHeader('Access-Control-Allow-Origin', '*');
    // Additional headers for Safari compatibility
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }
}));

// -----------------------------------
// Start the Server
// -----------------------------------
const PORT = process.env.PORT || 3000;
// Listen on all network interfaces (0.0.0.0) to allow access from other devices on the same network
app.listen(PORT, '0.0.0.0', () => {
  logger.info('Server started', {
    port: PORT,
    nodeEnv: process.env.NODE_ENV || 'development',
    host: '0.0.0.0', // Accessible from all network interfaces
  });
});
