/**
 * IPv4 subnet calculator - core math
 * All IPs are represented as 32-bit unsigned integers.
 */

/**
 * Convert dotted-decimal IP string to 32-bit unsigned integer.
 * @param {string} ip
 * @returns {number}
 */
export function ipToInt(ip) {
  const parts = ip.trim().split('.');
  if (parts.length !== 4) throw new Error(`Invalid IP: ${ip}`);
  let n = 0;
  for (const p of parts) {
    const byte = parseInt(p, 10);
    if (isNaN(byte) || byte < 0 || byte > 255) throw new Error(`Invalid octet: ${p}`);
    n = (n << 8) | byte;
  }
  return n >>> 0;
}

/**
 * Convert 32-bit unsigned integer to dotted-decimal string.
 * @param {number} n
 * @returns {string}
 */
export function intToIp(n) {
  n = n >>> 0;
  return [
    (n >>> 24) & 0xff,
    (n >>> 16) & 0xff,
    (n >>>  8) & 0xff,
     n        & 0xff,
  ].join('.');
}

/**
 * Convert CIDR prefix length to subnet mask integer.
 * @param {number} cidr  0-32
 * @returns {number}
 */
export function cidrToMask(cidr) {
  if (cidr < 0 || cidr > 32) throw new Error(`Invalid CIDR: ${cidr}`);
  if (cidr === 0) return 0;
  return (0xffffffff << (32 - cidr)) >>> 0;
}

/**
 * Convert subnet mask integer to CIDR prefix length.
 * Returns null if the mask is not contiguous.
 * @param {number} mask
 * @returns {number|null}
 */
export function maskToCidr(mask) {
  mask = mask >>> 0;
  // Verify contiguous (all 1s then all 0s)
  let cidr = 0;
  let seenZero = false;
  for (let i = 31; i >= 0; i--) {
    const bit = (mask >>> i) & 1;
    if (bit === 1) {
      if (seenZero) return null; // non-contiguous
      cidr++;
    } else {
      seenZero = true;
    }
  }
  return cidr;
}

/**
 * Parse "192.168.1.1/24" or "192.168.1.1 255.255.255.0" into { ip, cidr }.
 * @param {string} str
 * @returns {{ ip: number, cidr: number }}
 */
export function parseInput(str) {
  str = str.trim();

  // CIDR notation: x.x.x.x/n
  const slashIdx = str.indexOf('/');
  if (slashIdx !== -1) {
    const ipStr = str.slice(0, slashIdx).trim();
    const cidr = parseInt(str.slice(slashIdx + 1).trim(), 10);
    if (isNaN(cidr) || cidr < 0 || cidr > 32) throw new Error(`Invalid CIDR prefix: ${str.slice(slashIdx + 1)}`);
    return { ip: ipToInt(ipStr), cidr };
  }

  // IP + mask: x.x.x.x y.y.y.y (space or comma separated)
  const parts = str.split(/[\s,]+/);
  if (parts.length === 2) {
    const ip = ipToInt(parts[0]);
    const mask = ipToInt(parts[1]);
    const cidr = maskToCidr(mask);
    if (cidr === null) throw new Error(`Invalid subnet mask: ${parts[1]}`);
    return { ip, cidr };
  }

  throw new Error(`Cannot parse input: "${str}"`);
}

/**
 * Core subnet calculation.
 * @param {number} ip    host IP as integer
 * @param {number} cidr  prefix length 0-32
 * @returns {object}
 */
export function calculateSubnet(ip, cidr) {
  const mask     = cidrToMask(cidr);
  const wildcard = (~mask) >>> 0;
  const network  = (ip & mask) >>> 0;
  const broadcast = (network | wildcard) >>> 0;

  const totalHosts = Math.pow(2, 32 - cidr);

  let firstHost, lastHost, usableHosts;
  if (cidr === 32) {
    // Host route
    firstHost   = network;
    lastHost    = network;
    usableHosts = 1;
  } else if (cidr === 31) {
    // Point-to-point (RFC 3021) - both addresses usable
    firstHost   = network;
    lastHost    = broadcast;
    usableHosts = 2;
  } else {
    firstHost   = (network + 1) >>> 0;
    lastHost    = (broadcast - 1) >>> 0;
    usableHosts = totalHosts - 2;
  }

  return {
    network,
    broadcast,
    firstHost,
    lastHost,
    totalHosts,
    usableHosts,
    mask,
    wildcard,
    cidr,
    class: getNetworkClass(network),
    isPrivate: isPrivate(network),
  };
}

/**
 * Determine network class based on the first octet of the network address.
 * @param {number} ip
 * @returns {'A'|'B'|'C'|'D'|'E'}
 */
export function getNetworkClass(ip) {
  const first = (ip >>> 24) & 0xff;
  if (first < 128)  return 'A';
  if (first < 192)  return 'B';
  if (first < 224)  return 'C';
  if (first < 240)  return 'D';
  return 'E';
}

/**
 * Check if IP is in a private RFC 1918 range.
 * 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
 * Also includes loopback 127.0.0.0/8.
 * @param {number} ip
 * @returns {boolean}
 */
export function isPrivate(ip) {
  ip = ip >>> 0;
  const first  = (ip >>> 24) & 0xff;
  const second = (ip >>> 16) & 0xff;

  if (first === 10) return true;                                  // 10.0.0.0/8
  if (first === 127) return true;                                 // 127.0.0.0/8 loopback
  if (first === 172 && second >= 16 && second <= 31) return true; // 172.16.0.0/12
  if (first === 192 && second === 168) return true;               // 192.168.0.0/16
  return false;
}

/**
 * Check if a given IP integer is within a network.
 * @param {number} ip
 * @param {number} network  network address integer
 * @param {number} cidr
 * @returns {boolean}
 */
export function isInSubnet(ip, network, cidr) {
  const mask = cidrToMask(cidr);
  return ((ip & mask) >>> 0) === ((network & mask) >>> 0);
}

/**
 * Split a network (network + cidr) into subnets of newCidr size.
 * @param {number} network  network address integer
 * @param {number} cidr     original CIDR
 * @param {number} newCidr  new (larger) CIDR (smaller subnets)
 * @returns {Array<{network: number, broadcast: number, cidr: number}>}
 */
export function splitSubnet(network, cidr, newCidr) {
  if (newCidr <= cidr) throw new Error('New CIDR must be larger than original CIDR');
  if (newCidr > 32)    throw new Error('New CIDR cannot exceed 32');

  const count = Math.pow(2, newCidr - cidr);
  const subnetSize = Math.pow(2, 32 - newCidr);
  const result = [];

  for (let i = 0; i < count; i++) {
    const net  = (network + i * subnetSize) >>> 0;
    const wild = cidrToMask(newCidr);
    const bcast = (net | (~wild >>> 0)) >>> 0;
    result.push({ network: net, broadcast: bcast, cidr: newCidr });
  }

  return result;
}

/**
 * Convert a 32-bit integer to a 32-character binary string with octets separated by dots.
 * @param {number} n
 * @returns {string}  e.g. "11000000.10101000.00000001.00000000"
 */
export function toBinary(n) {
  n = n >>> 0;
  const bytes = [
    (n >>> 24) & 0xff,
    (n >>> 16) & 0xff,
    (n >>>  8) & 0xff,
     n        & 0xff,
  ];
  return bytes.map(b => b.toString(2).padStart(8, '0')).join('.');
}
