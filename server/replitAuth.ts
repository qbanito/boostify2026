/**
 * Replit Auth Configuration
 * Sistema de autenticación basado en OpenID Connect de Replit
 * Mantiene Firestore intacto, solo reemplaza Firebase Auth
 */
import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";
import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { db } from "./db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 semana
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: sessionTtl,
      sameSite: 'lax',
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(claims: any) {
  try {
    // Buscar usuario existente por replitId
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.replitId, claims["sub"]))
      .limit(1);

    if (existingUser) {
      // Actualizar usuario existente
      const [updatedUser] = await db
        .update(users)
        .set({
          email: claims["email"],
          firstName: claims["first_name"],
          lastName: claims["last_name"],
          profileImageUrl: claims["profile_image_url"],
        })
        .where(eq(users.replitId, claims["sub"]))
        .returning();
      return updatedUser;
    } else {
      // Crear nuevo usuario
      const [newUser] = await db
        .insert(users)
        .values({
          replitId: claims["sub"],
          email: claims["email"],
          firstName: claims["first_name"],
          lastName: claims["last_name"],
          profileImageUrl: claims["profile_image_url"],
          role: "artist",
        })
        .returning();
      return newUser;
    }
  } catch (error) {
    console.error("Error upserting user:", error);
    throw error;
  }
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    try {
      // Create user object with session data
      const user: any = {};
      updateUserSession(user, tokens);
      
      // Upsert user in database and get the result
      const dbUser = await upsertUser(tokens.claims());
      
      // Merge DB user data with session data
      Object.assign(user, {
        id: dbUser.id,
        replitId: dbUser.replitId,
        email: dbUser.email,
        firstName: dbUser.firstName,
        lastName: dbUser.lastName,
        role: dbUser.role,
      });
      
      verified(null, user);
    } catch (error) {
      console.error('❌ [VERIFY] Error verifying user:', error);
      verified(error as Error, false);
    }
  };

  // Keep track of registered strategies
  const registeredStrategies = new Set<string>();

  // Helper function to ensure strategy exists for a domain
  const ensureStrategy = (domain: string) => {
    const strategyName = `replitauth:${domain}`;
    if (!registeredStrategies.has(strategyName)) {
      const strategy = new Strategy(
        {
          name: strategyName,
          config,
          scope: "openid email profile offline_access",
          callbackURL: `https://${domain}/api/callback`,
        },
        verify
      );
      passport.use(strategy);
      registeredStrategies.add(strategyName);
    }
  };

  passport.serializeUser((user: Express.User, cb) => {
    cb(null, user);
  });
  
  passport.deserializeUser((user: Express.User, cb) => {
    cb(null, user);
  });

  // Login route - Direct to Replit Auth without consent page
  app.get("/api/login", (req, res, next) => {
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  // Callback route
  app.get("/api/callback", (req, res, next) => {
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, (err: any, user: any, info: any) => {
      if (err) {
        console.error('❌ [AUTH CALLBACK] Error:', err);
        return res.redirect("/api/login");
      }
      
      if (!user) {
        console.error('❌ [AUTH CALLBACK] No user returned');
        return res.redirect("/api/login");
      }
      
      req.logIn(user, (loginErr) => {
        if (loginErr) {
          console.error('❌ [AUTH CALLBACK] Login error:', loginErr);
          return res.redirect("/api/login");
        }
        
        return res.redirect("/dashboard");
      });
    })(req, res, next);
  });

  // Logout route
  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });

  // NOTE: /api/auth/user is now registered in server/index.ts to bypass Vite interception
  // The route was moved there to ensure it's registered before Vite's catch-all middleware
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  console.log('🔐 [isAuthenticated] Checking authentication...');
  console.log('🔐 [isAuthenticated] req.isAuthenticated():', req.isAuthenticated ? req.isAuthenticated() : 'undefined');
  console.log('🔐 [isAuthenticated] user:', user ? { id: user.id, email: user.email, hasExpiresAt: !!user.expires_at } : 'null');

  if (!req.isAuthenticated()) {
    console.log('❌ [isAuthenticated] Not authenticated via passport');
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (!user || !user.id) {
    console.log('❌ [isAuthenticated] No user or user.id');
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Si no hay expires_at, significa que es una sesión deserializada sin tokens
  // En ese caso, permitir el acceso ya que el usuario está autenticado
  if (!user.expires_at) {
    console.log('✅ [isAuthenticated] User authenticated (no token expiry check needed)');
    return next();
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    console.log('✅ [isAuthenticated] Token still valid');
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    console.log('❌ [isAuthenticated] Token expired and no refresh token');
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    console.log('🔄 [isAuthenticated] Refreshing token...');
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    console.log('✅ [isAuthenticated] Token refreshed successfully');
    return next();
  } catch (error) {
    console.error('❌ [isAuthenticated] Error refreshing token:', error);
    return res.status(401).json({ message: "Unauthorized" });
  }
};
