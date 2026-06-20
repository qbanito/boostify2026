/**
 * Email Verification Service
 * Valida emails antes de enviarlos para reducir bounce rate
 * 
 * Capas de verificación:
 * 1. Sintaxis y formato
 * 2. Dominios desechables (disposable emails)
 * 3. Validación MX records del dominio
 * 4. APIs externas (ZeroBounce, Hunter.io, etc.)
 * 5. Historial de bounces interno
 */

import dns from 'dns';
import { promisify } from 'util';

const resolveMx = promisify(dns.resolveMx);

// === CONFIGURACIÓN ===
const ZEROBOUNCE_API_KEY = process.env.ZEROBOUNCE_API_KEY || '';
const HUNTER_API_KEY = process.env.HUNTER_API_KEY || '';
const NEVERBOUNCE_API_KEY = process.env.NEVERBOUNCE_API_KEY || '';

// === TIPOS ===
export type EmailVerificationStatus = 
  | 'valid'           // Email válido y entregable
  | 'invalid'         // Sintaxis inválida
  | 'risky'           // Puede hacer bounce (catch-all, role-based)
  | 'unknown'         // No se pudo verificar
  | 'disposable'      // Email temporal/desechable
  | 'mx_invalid'      // Dominio sin MX records
  | 'bounced'         // Ha hecho bounce antes
  | 'spam_trap'       // Posible trampa de spam
  | 'role_based'      // Email genérico (info@, admin@, etc.)
  | 'free_email';     // Gmail, Yahoo, etc.

export interface EmailVerificationResult {
  email: string;
  status: EmailVerificationStatus;
  score: number;           // 0-100, mayor es mejor
  isDeliverable: boolean;
  reason: string;
  checks: {
    syntax: boolean;
    mxRecords: boolean;
    disposable: boolean;
    roleEmail: boolean;
    freeEmail: boolean;
    historicalBounce: boolean;
  };
  provider?: string;       // Si usó API externa
  suggestedEmail?: string; // Corrección sugerida (typos)
  processedAt: Date;
}

export interface BulkVerificationResult {
  total: number;
  valid: number;
  invalid: number;
  risky: number;
  removed: number;
  validEmails: string[];
  invalidEmails: { email: string; reason: string }[];
  riskyEmails: { email: string; reason: string }[];
}

// === LISTAS DE DOMINIOS ===

// Dominios de email desechables/temporales conocidos
const DISPOSABLE_DOMAINS = new Set([
  // Más populares
  'tempmail.com', 'temp-mail.org', 'guerrillamail.com', 'mailinator.com',
  '10minutemail.com', 'throwawaymail.com', 'yopmail.com', 'sharklasers.com',
  'trashmail.com', 'fakeinbox.com', 'getnada.com', 'maildrop.cc',
  'dispostable.com', 'mailnesia.com', 'tempr.email', 'tempail.com',
  'emailondeck.com', 'spamgourmet.com', 'mytrashmail.com', 'mintemail.com',
  'mohmal.com', 'tempsky.com', 'fakemail.net', 'fakemailgenerator.com',
  'throwaway.email', 'burnermail.io', 'guerrillamail.info', 'guerrillamail.biz',
  'guerrillamail.de', 'guerrillamail.net', 'guerrillamail.org', 'temp-mail.io',
  'temp-mail.ru', 'tempinbox.com', 'tempinbox.co.uk', 'spambox.us',
  'mailcatch.com', 'mailexpire.com', 'mailnull.com', 'meltmail.com',
  'anonymbox.com', 'binkmail.com', 'bobmail.info', 'burnthespam.info',
  'deadaddress.com', 'deadspam.com', 'discardmail.com', 'disposeamail.com',
  'dodgeit.com', 'dontreg.com', 'e4ward.com', 'emailmiser.com',
  'emailsensei.com', 'emailtemporanea.com', 'emailtemporar.ro', 'emailxfer.com',
  'evopo.com', 'explodemail.com', 'fastacura.com', 'fastchevy.com',
  'fastchrysler.com', 'fastmazda.com', 'fastnissan.com', 'fasttoyota.com',
  'fettomeyer.com', 'gishpuppy.com', 'haltospam.com', 'hidemail.de',
  'incognitomail.com', 'instant-mail.de', 'ipoo.org', 'jetable.com',
  'kasmail.com', 'kulturbetrieb.info', 'kurzepost.de', 'lhsdv.com',
  'lifebyfood.com', 'lookugly.com', 'mail-temporaire.fr', 'mailbidon.com',
  'mailblocks.com', 'mailfreeonline.com', 'mailguard.me', 'mailimate.com',
  'mailmoat.com', 'mailscrap.com', 'mailshell.com', 'mailsiphon.com',
  'mailzilla.com', 'mbx.cc', 'mega.zik.dj', 'msgos.com', 'nervmich.net',
  'nospam.ze.tc', 'nospamfor.us', 'nowmymail.com', 'nurfuerspam.de',
  'oneoffemail.com', 'pjjkp.com', 'pookmail.com', 'privacy.net',
  'proxymail.eu', 'recode.me', 'rtrtr.com', 's0ny.net', 'safe-mail.net',
  'safetymail.info', 'sandelf.de', 'saynotospams.com', 'selfdestructingmail.com',
  'shortmail.net', 'smellfear.com', 'snakemail.com', 'sneakemail.com',
  'sofort-mail.de', 'sogetthis.com', 'spam.la', 'spamavert.com', 'spambob.com',
  'spambog.com', 'spambog.de', 'spambog.ru', 'spambox.info', 'spambox.irishspringrealty.com',
  'spamcannon.com', 'spamcannon.net', 'spamcon.org', 'spamcorptastic.com',
  'spamcowboy.com', 'spamcowboy.net', 'spamcowboy.org', 'spamday.com',
  'spamex.com', 'spamfree24.com', 'spamfree24.de', 'spamfree24.eu',
  'spamfree24.info', 'spamfree24.net', 'spamfree24.org', 'spamhole.com',
  'spamify.com', 'spaminator.de', 'spamkill.info', 'spaml.com', 'spaml.de',
  'spamobox.com', 'spamsalad.in', 'spamspot.com', 'spamthis.co.uk',
  'spamtroll.net', 'speed.1s.fr', 'supergreatmail.com', 'supermailer.jp',
  'superstachel.de', 'teewars.org', 'tempalias.com', 'temporaryemail.net',
  'temporaryforwarding.com', 'temporaryinbox.com', 'thankyou2010.com',
  'trash-amil.com', 'trash-mail.at', 'trash-mail.com', 'trash-mail.de',
  'trash2009.com', 'trashdevil.com', 'trashdevil.de', 'trashemail.de',
  'trashmail.at', 'trashmail.de', 'trashmail.me', 'trashmail.net',
  'trashmail.org', 'trashmail.ws', 'trashmailer.com', 'trashymail.com',
  'trashymail.net', 'twinmail.de', 'tyldd.com', 'upliftnow.com', 'venompen.com',
  'veryrealemail.com', 'wegwerfadresse.de', 'wegwerfemail.de', 'wegwerfmail.de',
  'wegwerfmail.info', 'wegwerfmail.net', 'wegwerfmail.org', 'wh4f.org',
  'whyspam.me', 'willhackforfood.biz', 'willselfdestruct.com', 'winemaven.info',
  'wronghead.com', 'wuzup.net', 'wuzupmail.net', 'xagloo.com', 'xemaps.com',
  'xents.com', 'xmaily.com', 'xoxy.net', 'yep.it', 'yogamaven.com',
  'yuurok.com', 'zippymail.info', 'zoemail.net', 'zoemail.org',
  // Agregados adicionales
  'nespj.com', 'fxavaj.com', 'abyssmail.com', 'anonbox.net', 
  'crazymailing.com', 'dropmail.me', 'emailfake.com', 'getairmail.com'
]);

// Proveedores de email gratuitos
const FREE_EMAIL_PROVIDERS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
  'mail.com', 'protonmail.com', 'zoho.com', 'icloud.com', 'me.com',
  'live.com', 'msn.com', 'ymail.com', 'inbox.com', 'mail.ru',
  'gmx.com', 'gmx.net', 'fastmail.com', 'tutanota.com', 'hushmail.com',
  'yahoo.co.uk', 'yahoo.es', 'hotmail.es', 'hotmail.co.uk', 'outlook.es'
]);

// Prefijos de emails basados en roles (role-based)
const ROLE_BASED_PREFIXES = new Set([
  'info', 'admin', 'support', 'sales', 'contact', 'help', 'office',
  'mail', 'hello', 'team', 'marketing', 'press', 'media', 'news',
  'webmaster', 'postmaster', 'hostmaster', 'abuse', 'noreply', 'no-reply',
  'donotreply', 'billing', 'accounts', 'careers', 'jobs', 'hr', 'legal',
  'privacy', 'security', 'feedback', 'enquiries', 'enquiry', 'general',
  'reception', 'booking', 'bookings', 'reservations', 'order', 'orders',
  'service', 'services', 'customerservice', 'customersupport', 'helpdesk'
]);

// Correcciones de typos comunes
const DOMAIN_TYPO_CORRECTIONS: Record<string, string> = {
  'gmial.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.cm': 'gmail.com',
  'gmail.om': 'gmail.com',
  'hotmal.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmail.co': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'outloo.com': 'outlook.com',
  'outllok.com': 'outlook.com',
  'yahho.com': 'yahoo.com',
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'yhaoo.com': 'yahoo.com',
  'iclod.com': 'icloud.com',
  'icoud.com': 'icloud.com'
};

// Cache de bounces históricos (en producción esto sería una DB)
const bouncedEmails = new Set<string>();
const mxCache = new Map<string, { valid: boolean; checkedAt: Date }>();

// === FUNCIONES DE VERIFICACIÓN ===

/**
 * Valida sintaxis del email
 */
function validateSyntax(email: string): { valid: boolean; normalized: string } {
  if (!email || typeof email !== 'string') {
    return { valid: false, normalized: '' };
  }
  
  const normalized = email.toLowerCase().trim();
  
  // Regex más estricto para validación
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  if (!emailRegex.test(normalized)) {
    return { valid: false, normalized };
  }
  
  // Verificaciones adicionales
  const [localPart, domain] = normalized.split('@');
  
  // Local part no puede empezar/terminar con punto
  if (localPart.startsWith('.') || localPart.endsWith('.')) {
    return { valid: false, normalized };
  }
  
  // No puede haber puntos consecutivos
  if (localPart.includes('..') || domain.includes('..')) {
    return { valid: false, normalized };
  }
  
  // Dominio debe tener al menos un punto
  if (!domain.includes('.')) {
    return { valid: false, normalized };
  }
  
  // TLD debe tener al menos 2 caracteres
  const tld = domain.split('.').pop();
  if (!tld || tld.length < 2) {
    return { valid: false, normalized };
  }
  
  return { valid: true, normalized };
}

/**
 * Extrae el dominio de un email
 */
function getDomain(email: string): string {
  const parts = email.toLowerCase().split('@');
  return parts.length === 2 ? parts[1] : '';
}

/**
 * Verifica si es un email desechable
 */
function isDisposable(email: string): boolean {
  const domain = getDomain(email);
  return DISPOSABLE_DOMAINS.has(domain);
}

/**
 * Verifica si es un email de proveedor gratuito
 */
function isFreeEmail(email: string): boolean {
  const domain = getDomain(email);
  return FREE_EMAIL_PROVIDERS.has(domain);
}

/**
 * Verifica si es un email basado en rol
 */
function isRoleEmail(email: string): boolean {
  const localPart = email.toLowerCase().split('@')[0];
  return ROLE_BASED_PREFIXES.has(localPart);
}

/**
 * Verifica MX records del dominio
 */
async function verifyMxRecords(domain: string): Promise<boolean> {
  // Revisar cache (válido por 24 horas)
  const cached = mxCache.get(domain);
  if (cached) {
    const hoursSinceCached = (Date.now() - cached.checkedAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceCached < 24) {
      return cached.valid;
    }
  }
  
  try {
    const mxRecords = await resolveMx(domain);
    const valid = mxRecords && mxRecords.length > 0;
    mxCache.set(domain, { valid, checkedAt: new Date() });
    return valid;
  } catch (error) {
    mxCache.set(domain, { valid: false, checkedAt: new Date() });
    return false;
  }
}

/**
 * Sugiere corrección de typos comunes
 */
function suggestCorrection(email: string): string | undefined {
  const domain = getDomain(email);
  const correction = DOMAIN_TYPO_CORRECTIONS[domain];
  
  if (correction) {
    const localPart = email.split('@')[0];
    return `${localPart}@${correction}`;
  }
  
  return undefined;
}

/**
 * Verifica un email con ZeroBounce API
 */
async function verifyWithZeroBounce(email: string): Promise<{ 
  status: EmailVerificationStatus; 
  subStatus?: string;
} | null> {
  if (!ZEROBOUNCE_API_KEY) return null;
  
  try {
    const response = await fetch(
      `https://api.zerobounce.net/v2/validate?api_key=${ZEROBOUNCE_API_KEY}&email=${encodeURIComponent(email)}`
    );
    
    const data = await response.json();
    
    if (data.status === 'valid') {
      return { status: 'valid' };
    } else if (data.status === 'invalid') {
      return { status: 'invalid', subStatus: data.sub_status };
    } else if (data.status === 'catch-all') {
      return { status: 'risky', subStatus: 'catch-all' };
    } else if (data.status === 'spamtrap') {
      return { status: 'spam_trap' };
    } else if (data.status === 'abuse') {
      return { status: 'risky', subStatus: 'abuse' };
    } else if (data.status === 'do_not_mail') {
      return { status: 'risky', subStatus: data.sub_status };
    }
    
    return { status: 'unknown' };
  } catch (error) {
    console.error('ZeroBounce error:', error);
    return null;
  }
}

/**
 * Verifica un email con Hunter.io API
 */
async function verifyWithHunter(email: string): Promise<{
  status: EmailVerificationStatus;
  score?: number;
} | null> {
  if (!HUNTER_API_KEY) return null;
  
  try {
    const response = await fetch(
      `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}&api_key=${HUNTER_API_KEY}`
    );
    
    const data = await response.json();
    
    if (data.data) {
      const result = data.data;
      const score = result.score || 0;
      
      if (result.result === 'deliverable' && score >= 70) {
        return { status: 'valid', score };
      } else if (result.result === 'undeliverable') {
        return { status: 'invalid', score };
      } else if (result.result === 'risky') {
        return { status: 'risky', score };
      } else if (result.result === 'accept_all') {
        return { status: 'risky', score };
      }
    }
    
    return { status: 'unknown' };
  } catch (error) {
    console.error('Hunter.io error:', error);
    return null;
  }
}

/**
 * Verifica un email con NeverBounce API
 */
async function verifyWithNeverBounce(email: string): Promise<{
  status: EmailVerificationStatus;
} | null> {
  if (!NEVERBOUNCE_API_KEY) return null;
  
  try {
    const response = await fetch('https://api.neverbounce.com/v4/single/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: NEVERBOUNCE_API_KEY,
        email: email
      })
    });
    
    const data = await response.json();
    
    switch (data.result) {
      case 'valid':
        return { status: 'valid' };
      case 'invalid':
        return { status: 'invalid' };
      case 'disposable':
        return { status: 'disposable' };
      case 'catchall':
        return { status: 'risky' };
      default:
        return { status: 'unknown' };
    }
  } catch (error) {
    console.error('NeverBounce error:', error);
    return null;
  }
}

// === FUNCIONES PRINCIPALES ===

/**
 * Verifica un email individual
 */
export async function verifyEmail(
  email: string, 
  options: { 
    useExternalAPI?: boolean;
    checkMX?: boolean;
    strict?: boolean;
  } = {}
): Promise<EmailVerificationResult> {
  const { useExternalAPI = true, checkMX = true, strict = false } = options;
  
  // 1. Validar sintaxis
  const syntaxResult = validateSyntax(email);
  if (!syntaxResult.valid) {
    return {
      email,
      status: 'invalid',
      score: 0,
      isDeliverable: false,
      reason: 'Invalid email syntax',
      checks: {
        syntax: false,
        mxRecords: false,
        disposable: false,
        roleEmail: false,
        freeEmail: false,
        historicalBounce: false
      },
      processedAt: new Date()
    };
  }
  
  const normalizedEmail = syntaxResult.normalized;
  const domain = getDomain(normalizedEmail);
  
  // 2. Revisar historial de bounces
  if (bouncedEmails.has(normalizedEmail)) {
    return {
      email: normalizedEmail,
      status: 'bounced',
      score: 0,
      isDeliverable: false,
      reason: 'Email has bounced previously',
      checks: {
        syntax: true,
        mxRecords: false,
        disposable: false,
        roleEmail: false,
        freeEmail: false,
        historicalBounce: true
      },
      processedAt: new Date()
    };
  }
  
  // 3. Verificar si es disposable
  if (isDisposable(normalizedEmail)) {
    return {
      email: normalizedEmail,
      status: 'disposable',
      score: 0,
      isDeliverable: false,
      reason: `Disposable email domain: ${domain}`,
      checks: {
        syntax: true,
        mxRecords: false,
        disposable: true,
        roleEmail: false,
        freeEmail: false,
        historicalBounce: false
      },
      processedAt: new Date()
    };
  }
  
  // 4. Verificar MX records
  let mxValid = true;
  if (checkMX) {
    mxValid = await verifyMxRecords(domain);
    if (!mxValid) {
      return {
        email: normalizedEmail,
        status: 'mx_invalid',
        score: 0,
        isDeliverable: false,
        reason: `Domain ${domain} has no valid MX records`,
        checks: {
          syntax: true,
          mxRecords: false,
          disposable: false,
          roleEmail: false,
          freeEmail: false,
          historicalBounce: false
        },
        suggestedEmail: suggestCorrection(normalizedEmail),
        processedAt: new Date()
      };
    }
  }
  
  // 5. Verificar características del email
  const roleEmail = isRoleEmail(normalizedEmail);
  const freeEmail = isFreeEmail(normalizedEmail);
  
  // 6. Usar API externa si está disponible
  let externalResult: { status: EmailVerificationStatus; score?: number } | null = null;
  let provider: string | undefined;
  
  if (useExternalAPI) {
    // Intentar con ZeroBounce primero (más preciso)
    externalResult = await verifyWithZeroBounce(normalizedEmail);
    if (externalResult) {
      provider = 'ZeroBounce';
    } else {
      // Fallback a Hunter.io
      externalResult = await verifyWithHunter(normalizedEmail);
      if (externalResult) {
        provider = 'Hunter.io';
      } else {
        // Fallback a NeverBounce
        externalResult = await verifyWithNeverBounce(normalizedEmail);
        if (externalResult) {
          provider = 'NeverBounce';
        }
      }
    }
  }
  
  // 7. Calcular score y estado final
  let score = 70; // Base score si pasa todas las verificaciones básicas
  let status: EmailVerificationStatus = 'valid';
  let reason = 'Email passed all verification checks';
  
  // Ajustar según verificación externa
  if (externalResult) {
    if (externalResult.status === 'invalid' || externalResult.status === 'spam_trap') {
      status = externalResult.status;
      score = 0;
      reason = `External verification: ${externalResult.status}`;
    } else if (externalResult.status === 'risky') {
      status = strict ? 'invalid' : 'risky';
      score = 40;
      reason = 'Email marked as risky by external verification';
    } else if (externalResult.status === 'valid') {
      score = externalResult.score || 90;
      status = 'valid';
    }
  }
  
  // Penalizar role-based emails
  if (roleEmail && status === 'valid') {
    status = strict ? 'risky' : 'valid';
    score = Math.max(score - 20, 0);
    reason = `Role-based email detected (${normalizedEmail.split('@')[0]}@)`;
  }
  
  // Free emails son válidos pero con score ligeramente menor
  if (freeEmail) {
    score = Math.max(score - 5, 0);
  }
  
  return {
    email: normalizedEmail,
    status,
    score,
    isDeliverable: status === 'valid' || status === 'free_email',
    reason,
    checks: {
      syntax: true,
      mxRecords: mxValid,
      disposable: false,
      roleEmail,
      freeEmail,
      historicalBounce: false
    },
    provider,
    suggestedEmail: suggestCorrection(normalizedEmail),
    processedAt: new Date()
  };
}

/**
 * Verifica una lista de emails en bulk
 */
export async function verifyEmailList(
  emails: string[],
  options: {
    useExternalAPI?: boolean;
    checkMX?: boolean;
    strict?: boolean;
    removeInvalid?: boolean;
    removeRisky?: boolean;
    concurrency?: number;
  } = {}
): Promise<BulkVerificationResult> {
  const { 
    useExternalAPI = false, // Desactivado por defecto en bulk para ahorrar créditos
    checkMX = true,
    strict = false,
    removeInvalid = true,
    removeRisky = false,
    concurrency = 10 
  } = options;
  
  const validEmails: string[] = [];
  const invalidEmails: { email: string; reason: string }[] = [];
  const riskyEmails: { email: string; reason: string }[] = [];
  
  // Procesar en batches para controlar concurrencia
  const batches: string[][] = [];
  for (let i = 0; i < emails.length; i += concurrency) {
    batches.push(emails.slice(i, i + concurrency));
  }
  
  console.log(`📧 Verifying ${emails.length} emails in ${batches.length} batches...`);
  
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const results = await Promise.all(
      batch.map(email => verifyEmail(email, { useExternalAPI, checkMX, strict }))
    );
    
    for (const result of results) {
      if (result.status === 'valid' || result.status === 'free_email') {
        validEmails.push(result.email);
      } else if (result.status === 'risky') {
        if (removeRisky) {
          riskyEmails.push({ email: result.email, reason: result.reason });
        } else {
          validEmails.push(result.email);
          riskyEmails.push({ email: result.email, reason: result.reason });
        }
      } else {
        invalidEmails.push({ email: result.email, reason: result.reason });
      }
    }
    
    // Progress log cada 5 batches
    if ((i + 1) % 5 === 0) {
      console.log(`   Processed ${Math.min((i + 1) * concurrency, emails.length)}/${emails.length} emails...`);
    }
  }
  
  const removed = removeInvalid ? invalidEmails.length : 0;
  const totalRemoved = removed + (removeRisky ? riskyEmails.length : 0);
  
  console.log(`✅ Verification complete:`);
  console.log(`   Valid: ${validEmails.length}`);
  console.log(`   Invalid: ${invalidEmails.length}`);
  console.log(`   Risky: ${riskyEmails.length}`);
  console.log(`   Removed: ${totalRemoved}`);
  
  return {
    total: emails.length,
    valid: validEmails.length,
    invalid: invalidEmails.length,
    risky: riskyEmails.length,
    removed: totalRemoved,
    validEmails,
    invalidEmails,
    riskyEmails
  };
}

/**
 * Registra un bounce para futura referencia
 */
export function registerBounce(email: string): void {
  const normalized = email.toLowerCase().trim();
  bouncedEmails.add(normalized);
  console.log(`📛 Registered bounce: ${normalized}`);
}

/**
 * Registra múltiples bounces
 */
export function registerBounces(emails: string[]): void {
  for (const email of emails) {
    registerBounce(email);
  }
}

/**
 * Limpia la lista de bounces (para testing)
 */
export function clearBounces(): void {
  bouncedEmails.clear();
}

/**
 * Obtiene estadísticas del cache
 */
export function getVerificationStats(): {
  bouncedEmailsCount: number;
  mxCacheSize: number;
  disposableDomainsCount: number;
} {
  return {
    bouncedEmailsCount: bouncedEmails.size,
    mxCacheSize: mxCache.size,
    disposableDomainsCount: DISPOSABLE_DOMAINS.size
  };
}

/**
 * Verifica rápidamente si un email es válido (sin APIs externas)
 * Para uso en formularios de registro
 */
export async function quickVerify(email: string): Promise<{
  valid: boolean;
  reason?: string;
  suggestion?: string;
}> {
  const result = await verifyEmail(email, { 
    useExternalAPI: false, 
    checkMX: true,
    strict: false 
  });
  
  return {
    valid: result.isDeliverable,
    reason: result.isDeliverable ? undefined : result.reason,
    suggestion: result.suggestedEmail
  };
}

// === EXPORTACIONES ADICIONALES ===
export {
  DISPOSABLE_DOMAINS,
  FREE_EMAIL_PROVIDERS,
  ROLE_BASED_PREFIXES,
  DOMAIN_TYPO_CORRECTIONS
};
