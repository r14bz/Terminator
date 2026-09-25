/**
 * IP Calculator and Subnetting utilities
 */

export function isValidIpv4(ip: string): boolean {
  if (!ip) return false;
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return false;
  return parts.every((p) => {
    if (!/^\d+$/.test(p)) return false;
    const num = parseInt(p, 10);
    return num >= 0 && num <= 255;
  });
}

export function ipToInt(ip: string): number {
  return ip
    .split('.')
    .reduce((acc, octet) => ((acc << 8) + parseInt(octet, 10)) >>> 0, 0);
}

export function intToIp(int: number): string {
  return [
    (int >>> 24) & 255,
    (int >>> 16) & 255,
    (int >>> 8) & 255,
    int & 255,
  ].join('.');
}

export function maskToCidr(mask: string): number {
  if (!isValidIpv4(mask)) return 24;
  const int = ipToInt(mask);
  let bits = 0;
  for (let i = 31; i >= 0; i--) {
    if ((int & (1 << i)) !== 0) {
      bits++;
    } else {
      break;
    }
  }
  return bits;
}

export function cidrToMask(cidr: number): string {
  const clamped = Math.max(0, Math.min(32, cidr));
  const mask = clamped === 0 ? 0 : (~0 << (32 - clamped)) >>> 0;
  return intToIp(mask);
}

export function getNetworkAddress(ip: string, mask: string): string {
  if (!isValidIpv4(ip) || !isValidIpv4(mask)) return ip;
  const ipInt = ipToInt(ip);
  const maskInt = ipToInt(mask);
  return intToIp((ipInt & maskInt) >>> 0);
}

export function getBroadcastAddress(ip: string, mask: string): string {
  if (!isValidIpv4(ip) || !isValidIpv4(mask)) return ip;
  const ipInt = ipToInt(ip);
  const maskInt = ipToInt(mask);
  const wildcard = (~maskInt) >>> 0;
  return intToIp((ipInt | wildcard) >>> 0);
}

export function areIpsInSameSubnet(ip1: string, ip2: string, mask: string): boolean {
  if (!isValidIpv4(ip1) || !isValidIpv4(ip2) || !isValidIpv4(mask)) return false;
  return getNetworkAddress(ip1, mask) === getNetworkAddress(ip2, mask);
}

export function isIpInRange(ip: string, startIp: string, endIp: string): boolean {
  const target = ipToInt(ip);
  const start = ipToInt(startIp);
  const end = ipToInt(endIp);
  return target >= start && target <= end;
}

export const COMMON_SUBNETS = [
  { cidr: 24, mask: '255.255.255.0', label: '/24 (254 host) - Standar LAN' },
  { cidr: 25, mask: '255.255.255.128', label: '/25 (126 host)' },
  { cidr: 26, mask: '255.255.255.192', label: '/26 (62 host)' },
  { cidr: 27, mask: '255.255.255.224', label: '/27 (30 host)' },
  { cidr: 28, mask: '255.255.255.240', label: '/28 (14 host)' },
  { cidr: 29, mask: '255.255.255.248', label: '/29 (6 host)' },
  { cidr: 30, mask: '255.255.255.252', label: '/30 (2 host) - Point to Point Router' },
  { cidr: 16, mask: '255.255.0.0', label: '/16 (65,534 host) - Corporate' },
  { cidr: 8, mask: '255.0.0.0', label: '/8 (16 Juta host)' },
];
