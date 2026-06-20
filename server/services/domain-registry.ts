/**
 * Domain Registry Service
 *
 * Internal service for domain registration, DNS management, and billing.
 * All external provider communication is abstracted here.
 */

import axios from 'axios';

const API_BASE = 'https://developers.hostinger.com';
const API_KEY = process.env.HOSTINGER_API_KEY ?? '';

const client = axios.create({
  baseURL: API_BASE,
  headers: {
    Authorization: `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 15_000,
});

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DomainAvailability {
  domain: string;
  tld: string;
  isAvailable: boolean;
  isAlternative: boolean;
  pricePerYear: number; // cents
  itemId: string;
}

export interface DomainDetails {
  domain: string;
  status: string;
  isPrivacyProtected: boolean;
  isLocked: boolean;
  nameServers: { ns1: string; ns2: string };
  expiresAt: string | null;
  registeredAt: string | null;
}

export interface DnsRecord {
  name: string;
  type: string;
  ttl: number;
  records: { content: string }[];
}

export interface CatalogItem {
  id: string;
  name: string;
  pricePerYear: number; // cents
  firstPeriodPrice: number;
  currency: string;
}

// ─── Catalog / Pricing ────────────────────────────────────────────────────────

export async function getDomainCatalog(): Promise<CatalogItem[]> {
  try {
    const res = await client.get('/api/billing/v1/catalog', {
      params: { category: 'DOMAIN' },
    });
    const items = res.data?.data ?? res.data ?? [];
    return (Array.isArray(items) ? items : []).map((item: any) => {
      const yearPrice = item.prices?.find((p: any) => p.period_unit === 'year') ?? item.prices?.[0];
      return {
        id: item.id,
        name: item.name,
        pricePerYear: yearPrice?.price ?? 0,
        firstPeriodPrice: yearPrice?.first_period_price ?? yearPrice?.price ?? 0,
        currency: yearPrice?.currency ?? 'USD',
      };
    });
  } catch (err: any) {
    console.error('[DomainRegistry] getDomainCatalog error:', err?.response?.data ?? err.message);
    return [];
  }
}

// ─── Availability Check ───────────────────────────────────────────────────────

export async function checkDomainAvailability(
  name: string,
  tlds: string[] = ['com', 'net', 'org', 'io', 'music']
): Promise<DomainAvailability[]> {
  const res = await client.post('/api/domains/v1/availability', {
    domain: name,
    tlds,
    with_alternatives: false,
  });

  const catalog = await getDomainCatalog();
  const catalogMap = new Map(catalog.map((c) => [c.id, c]));

  return (res.data ?? []).map((item: any) => {
    const tld = item.domain?.split('.').slice(1).join('.');
    const matchKey = `hostingercom-domain-${tld}-usd-1y`;
    const catalogEntry = catalogMap.get(matchKey);
    return {
      domain: item.domain ?? `${name}.${tld}`,
      tld: tld ?? '',
      isAvailable: item.is_available ?? false,
      isAlternative: item.is_alternative ?? false,
      pricePerYear: catalogEntry?.firstPeriodPrice ?? catalogEntry?.pricePerYear ?? 0,
      itemId: catalogEntry?.id ?? matchKey,
    };
  });
}

// ─── Purchase ─────────────────────────────────────────────────────────────────

export async function purchaseDomain(domain: string, itemId: string): Promise<{
  success: boolean;
  orderId?: number;
  subscriptionId?: string;
  error?: string;
}> {
  try {
    const res = await client.post('/api/domains/v1/portfolio', {
      domain,
      item_id: itemId,
    });
    return {
      success: true,
      orderId: res.data?.id,
      subscriptionId: res.data?.subscription_id,
    };
  } catch (err: any) {
    const msg = err?.response?.data?.message ?? err.message;
    console.error('[DomainRegistry] purchaseDomain error:', msg);
    return { success: false, error: msg };
  }
}

// ─── Domain Details ───────────────────────────────────────────────────────────

export async function getDomainDetails(domain: string): Promise<DomainDetails | null> {
  try {
    const res = await client.get(`/api/domains/v1/portfolio/${domain}`);
    const d = res.data;
    return {
      domain: d.domain,
      status: d.status,
      isPrivacyProtected: d.is_privacy_protected ?? false,
      isLocked: d.is_locked ?? false,
      nameServers: d.name_servers ?? {},
      expiresAt: d.expires_at ?? null,
      registeredAt: d.registered_at ?? null,
    };
  } catch {
    return null;
  }
}

// ─── DNS Records ──────────────────────────────────────────────────────────────

export async function getDNSRecords(domain: string): Promise<DnsRecord[]> {
  try {
    const res = await client.get(`/api/dns/v1/zones/${domain}`);
    return res.data ?? [];
  } catch {
    return [];
  }
}

export async function updateDNSRecords(domain: string, zone: DnsRecord[], overwrite = false): Promise<boolean> {
  try {
    await client.put(`/api/dns/v1/zones/${domain}`, { zone, overwrite });
    return true;
  } catch (err: any) {
    console.error('[DomainRegistry] updateDNSRecords error:', err?.response?.data ?? err.message);
    return false;
  }
}

export async function deleteDNSRecord(domain: string, name: string, type: string): Promise<boolean> {
  try {
    await client.delete(`/api/dns/v1/zones/${domain}`, {
      data: { filters: [{ name, type }] },
    });
    return true;
  } catch {
    return false;
  }
}

// ─── Privacy & Lock ───────────────────────────────────────────────────────────

export async function setPrivacyProtection(domain: string, enabled: boolean): Promise<boolean> {
  try {
    if (enabled) {
      await client.put(`/api/domains/v1/portfolio/${domain}/privacy-protection`);
    } else {
      await client.delete(`/api/domains/v1/portfolio/${domain}/privacy-protection`);
    }
    return true;
  } catch {
    return false;
  }
}

export async function setDomainLock(domain: string, locked: boolean): Promise<boolean> {
  try {
    if (locked) {
      await client.put(`/api/domains/v1/portfolio/${domain}/domain-lock`);
    } else {
      await client.delete(`/api/domains/v1/portfolio/${domain}/domain-lock`);
    }
    return true;
  } catch {
    return false;
  }
}

// ─── Forwarding ───────────────────────────────────────────────────────────────

export async function setForwarding(domain: string, redirectUrl: string, type: '301' | '302' = '301'): Promise<boolean> {
  try {
    await client.post('/api/domains/v1/forwarding', {
      domain,
      redirect_type: type,
      redirect_url: redirectUrl,
    });
    return true;
  } catch (err: any) {
    console.error('[DomainRegistry] setForwarding error:', err?.response?.data ?? err.message);
    return false;
  }
}

export async function deleteForwarding(domain: string): Promise<boolean> {
  try {
    await client.delete(`/api/domains/v1/forwarding/${domain}`);
    return true;
  } catch {
    return false;
  }
}

// ─── List account domains ─────────────────────────────────────────────────────

export async function listAccountDomains(): Promise<{ domain: string; status: string; expiresAt: string | null }[]> {
  try {
    const res = await client.get('/api/domains/v1/portfolio');
    return (res.data ?? []).map((d: any) => ({
      domain: d.domain,
      status: d.status,
      expiresAt: d.expires_at ?? null,
    }));
  } catch {
    return [];
  }
}
