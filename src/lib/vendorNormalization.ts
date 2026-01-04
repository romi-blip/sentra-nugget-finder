// Curated alias map for known vendors - maps lowercase raw names to canonical names
const VENDOR_ALIASES: Record<string, string> = {
  // Rubrik acquisitions (Laminar)
  'laminar': 'Rubrik',
  'laminar (rubrik)': 'Rubrik',
  'laminar (acquired by rubrik)': 'Rubrik',
  'rubrik (laminar)': 'Rubrik',
  'rubrik': 'Rubrik',
  
  // Palo Alto Networks acquisitions (Dig Security, Prisma Cloud)
  'dig security': 'Palo Alto Networks',
  'dig security (palo alto networks)': 'Palo Alto Networks',
  'dig security (now palo alto networks, dig dspm)': 'Palo Alto Networks',
  'palo alto (dig security)': 'Palo Alto Networks',
  'palo alto networks (dig security)': 'Palo Alto Networks',
  'palo alto networks (prisma cloud)': 'Palo Alto Networks',
  'palo alto networks prisma cloud': 'Palo Alto Networks',
  'palo alto networks (prisma cloud/dig)': 'Palo Alto Networks',
  'palo alto networks (prisma cloud & dig security)': 'Palo Alto Networks',
  'palo alto networks (prisma cloud / dig security)': 'Palo Alto Networks',
  'palo alto prisma cloud': 'Palo Alto Networks',
  'palo alto prisma cloud (incl. dig security)': 'Palo Alto Networks',
  'prisma cloud (palo alto networks)': 'Palo Alto Networks',
  'prisma cloud (palo alto networks / dig security)': 'Palo Alto Networks',
  'prisma cloud': 'Palo Alto Networks',
  'palo alto networks': 'Palo Alto Networks',
  'palo alto': 'Palo Alto Networks',
  
  // CrowdStrike acquisitions (Flow Security)
  'flow security': 'CrowdStrike',
  'crowdstrike (flow security)': 'CrowdStrike',
  'crowdstrike': 'CrowdStrike',
  
  // Securiti suffix normalization
  'securiti.ai': 'Securiti',
  'securiti': 'Securiti',
  
  // Symmetry Systems
  'symmetry systems (dataguard)': 'Symmetry Systems',
  'symmetry systems': 'Symmetry Systems',
  
  // Tenable acquisitions (Eureka)
  'tenable (eureka)': 'Tenable',
  'tenable': 'Tenable',
  'eureka security': 'Tenable',
  'eureka': 'Tenable',
  
  // Code42 / Incydr
  'incydr (code42)': 'Code42',
  'code42': 'Code42',
  'incydr': 'Code42',
  
  // Broadcom / Symantec
  'symantec (broadcom)': 'Broadcom',
  'symantec': 'Broadcom',
  'broadcom': 'Broadcom',
  
  // Common vendors - ensure consistent casing
  'wiz': 'Wiz',
  'cyera': 'Cyera',
  'sentra': 'Sentra',
  'varonis': 'Varonis',
  'bigid': 'BigID',
  'big id': 'BigID',
  'normalyze': 'Normalyze',
  'open raven': 'Open Raven',
  'openraven': 'Open Raven',
  'concentric ai': 'Concentric AI',
  'concentric.ai': 'Concentric AI',
  'concentric': 'Concentric AI',
  'bedrock security': 'Bedrock Security',
  'bedrock': 'Bedrock Security',
  'polar security': 'Polar Security',
  'polar': 'Polar Security',
  'metomic': 'Metomic',
  'orca security': 'Orca Security',
  'orca': 'Orca Security',
  'zscaler': 'Zscaler',
  'netskope': 'Netskope',
  'microsoft purview': 'Microsoft Purview',
  'purview': 'Microsoft Purview',
  'microsoft': 'Microsoft Purview',
  'ibm guardium': 'IBM Guardium',
  'guardium': 'IBM Guardium',
  'ibm': 'IBM Guardium',
  'imperva': 'Imperva',
  'forcepoint': 'Forcepoint',
  'proofpoint': 'Proofpoint',
  'digitalguardian': 'Digital Guardian',
  'digital guardian': 'Digital Guardian',
  'spirion': 'Spirion',
  'dasera': 'Dasera',
  'soveren': 'Soveren',
  'theom': 'Theom',
};

/**
 * Normalizes a vendor name to its canonical form.
 * Handles acquisitions, suffix variations (.ai, .io), and parenthetical notes.
 */
export function normalizeVendorName(raw: string | null | undefined): string {
  if (!raw) return 'Unknown';
  
  const lower = raw.toLowerCase().trim();
  
  // Check alias map first for exact matches
  if (VENDOR_ALIASES[lower]) {
    return VENDOR_ALIASES[lower];
  }
  
  // Smart normalization for unknown vendors:
  // 1. Strip common suffixes (.ai, .io, .com)
  // 2. Remove parentheticals
  // 3. Normalize whitespace
  // 4. Title case
  let normalized = lower
    .replace(/\.ai$/i, '')
    .replace(/\.io$/i, '')
    .replace(/\.com$/i, '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Check alias map again after stripping suffixes
  if (VENDOR_ALIASES[normalized]) {
    return VENDOR_ALIASES[normalized];
  }
  
  // Title case for unknown vendors
  normalized = normalized
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  
  return normalized || 'Unknown';
}
