/**
 * Tests for subnet.js — uses Node built-in test runner (node --test)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  ipToInt,
  intToIp,
  cidrToMask,
  maskToCidr,
  parseInput,
  calculateSubnet,
  isPrivate,
  getNetworkClass,
  isInSubnet,
  splitSubnet,
  toBinary,
} from '../src/subnet.js';

// ──────────────────────────────────────────
// ipToInt / intToIp
// ──────────────────────────────────────────
describe('ipToInt', () => {
  it('converts 0.0.0.0 to 0', () => {
    assert.equal(ipToInt('0.0.0.0'), 0);
  });

  it('converts 255.255.255.255 to 0xffffffff', () => {
    assert.equal(ipToInt('255.255.255.255'), 0xffffffff);
  });

  it('converts 192.168.1.1', () => {
    assert.equal(ipToInt('192.168.1.1'), (192 << 24 | 168 << 16 | 1 << 8 | 1) >>> 0);
  });

  it('converts 10.0.0.1', () => {
    assert.equal(ipToInt('10.0.0.1'), (10 << 24 | 1) >>> 0);
  });

  it('throws on invalid octet', () => {
    assert.throws(() => ipToInt('256.0.0.0'), /Invalid/);
  });

  it('throws on too few octets', () => {
    assert.throws(() => ipToInt('192.168.1'), /Invalid/);
  });
});

describe('intToIp', () => {
  it('converts 0 to 0.0.0.0', () => {
    assert.equal(intToIp(0), '0.0.0.0');
  });

  it('converts 0xffffffff to 255.255.255.255', () => {
    assert.equal(intToIp(0xffffffff), '255.255.255.255');
  });

  it('round-trips 192.168.1.100', () => {
    const ip = '192.168.1.100';
    assert.equal(intToIp(ipToInt(ip)), ip);
  });

  it('round-trips 172.16.0.1', () => {
    const ip = '172.16.0.1';
    assert.equal(intToIp(ipToInt(ip)), ip);
  });
});

// ──────────────────────────────────────────
// cidrToMask
// ──────────────────────────────────────────
describe('cidrToMask', () => {
  it('/0 gives 0.0.0.0', () => {
    assert.equal(intToIp(cidrToMask(0)), '0.0.0.0');
  });

  it('/8 gives 255.0.0.0', () => {
    assert.equal(intToIp(cidrToMask(8)), '255.0.0.0');
  });

  it('/16 gives 255.255.0.0', () => {
    assert.equal(intToIp(cidrToMask(16)), '255.255.0.0');
  });

  it('/24 gives 255.255.255.0', () => {
    assert.equal(intToIp(cidrToMask(24)), '255.255.255.0');
  });

  it('/32 gives 255.255.255.255', () => {
    assert.equal(intToIp(cidrToMask(32)), '255.255.255.255');
  });

  it('/20 gives 255.255.240.0', () => {
    assert.equal(intToIp(cidrToMask(20)), '255.255.240.0');
  });
});

// ──────────────────────────────────────────
// maskToCidr
// ──────────────────────────────────────────
describe('maskToCidr', () => {
  it('255.255.255.0 -> 24', () => {
    assert.equal(maskToCidr(ipToInt('255.255.255.0')), 24);
  });

  it('255.0.0.0 -> 8', () => {
    assert.equal(maskToCidr(ipToInt('255.0.0.0')), 8);
  });

  it('0.0.0.0 -> 0', () => {
    assert.equal(maskToCidr(0), 0);
  });

  it('255.255.255.255 -> 32', () => {
    assert.equal(maskToCidr(ipToInt('255.255.255.255')), 32);
  });

  it('invalid non-contiguous mask returns null', () => {
    // 255.0.255.0 is not contiguous
    assert.equal(maskToCidr(ipToInt('255.0.255.0')), null);
  });
});

// ──────────────────────────────────────────
// parseInput
// ──────────────────────────────────────────
describe('parseInput', () => {
  it('parses CIDR notation', () => {
    const { ip, cidr } = parseInput('192.168.1.1/24');
    assert.equal(intToIp(ip), '192.168.1.1');
    assert.equal(cidr, 24);
  });

  it('parses IP + mask notation', () => {
    const { ip, cidr } = parseInput('10.0.0.1 255.0.0.0');
    assert.equal(intToIp(ip), '10.0.0.1');
    assert.equal(cidr, 8);
  });

  it('parses /0', () => {
    const { cidr } = parseInput('0.0.0.0/0');
    assert.equal(cidr, 0);
  });

  it('throws on invalid format', () => {
    assert.throws(() => parseInput('not-an-ip'), /Cannot parse/);
  });
});

// ──────────────────────────────────────────
// calculateSubnet
// ──────────────────────────────────────────
describe('calculateSubnet', () => {
  it('192.168.1.100/24 basic', () => {
    const r = calculateSubnet(ipToInt('192.168.1.100'), 24);
    assert.equal(intToIp(r.network),   '192.168.1.0');
    assert.equal(intToIp(r.broadcast), '192.168.1.255');
    assert.equal(intToIp(r.firstHost), '192.168.1.1');
    assert.equal(intToIp(r.lastHost),  '192.168.1.254');
    assert.equal(r.totalHosts,  256);
    assert.equal(r.usableHosts, 254);
  });

  it('10.0.0.0/8', () => {
    const r = calculateSubnet(ipToInt('10.0.0.0'), 8);
    assert.equal(intToIp(r.network),   '10.0.0.0');
    assert.equal(intToIp(r.broadcast), '10.255.255.255');
    assert.equal(r.totalHosts, 16777216);
    assert.equal(r.usableHosts, 16777214);
  });

  it('172.16.0.0/12', () => {
    const r = calculateSubnet(ipToInt('172.16.0.0'), 12);
    assert.equal(intToIp(r.network),   '172.16.0.0');
    assert.equal(intToIp(r.broadcast), '172.31.255.255');
  });

  it('/30 has 2 usable hosts', () => {
    const r = calculateSubnet(ipToInt('192.168.1.0'), 30);
    assert.equal(r.usableHosts, 2);
    assert.equal(r.totalHosts, 4);
  });

  it('/31 point-to-point: both addresses usable', () => {
    const r = calculateSubnet(ipToInt('10.0.0.0'), 31);
    assert.equal(r.usableHosts, 2);
    assert.equal(intToIp(r.firstHost), '10.0.0.0');
    assert.equal(intToIp(r.lastHost),  '10.0.0.1');
  });

  it('/32 host route: 1 host', () => {
    const r = calculateSubnet(ipToInt('192.168.1.50'), 32);
    assert.equal(r.usableHosts, 1);
    assert.equal(r.totalHosts, 1);
    assert.equal(intToIp(r.network), '192.168.1.50');
    assert.equal(intToIp(r.broadcast), '192.168.1.50');
  });

  it('mask and wildcard are complementary', () => {
    const r = calculateSubnet(ipToInt('192.168.1.0'), 24);
    assert.equal((r.mask | r.wildcard) >>> 0, 0xffffffff);
    assert.equal((r.mask & r.wildcard) >>> 0, 0);
  });

  it('network is correctly masked (host bits stripped)', () => {
    // 192.168.1.100/24 → network should be 192.168.1.0 not .100
    const r = calculateSubnet(ipToInt('192.168.1.100'), 24);
    assert.equal(intToIp(r.network), '192.168.1.0');
  });
});

// ──────────────────────────────────────────
// isPrivate
// ──────────────────────────────────────────
describe('isPrivate', () => {
  it('10.0.0.1 is private', () => {
    assert.equal(isPrivate(ipToInt('10.0.0.1')), true);
  });

  it('10.255.255.255 is private', () => {
    assert.equal(isPrivate(ipToInt('10.255.255.255')), true);
  });

  it('172.16.0.0 is private', () => {
    assert.equal(isPrivate(ipToInt('172.16.0.0')), true);
  });

  it('172.31.255.255 is private', () => {
    assert.equal(isPrivate(ipToInt('172.31.255.255')), true);
  });

  it('172.32.0.0 is NOT private', () => {
    assert.equal(isPrivate(ipToInt('172.32.0.0')), false);
  });

  it('192.168.0.0 is private', () => {
    assert.equal(isPrivate(ipToInt('192.168.0.0')), true);
  });

  it('192.168.255.255 is private', () => {
    assert.equal(isPrivate(ipToInt('192.168.255.255')), true);
  });

  it('8.8.8.8 is NOT private', () => {
    assert.equal(isPrivate(ipToInt('8.8.8.8')), false);
  });

  it('127.0.0.1 is private (loopback)', () => {
    assert.equal(isPrivate(ipToInt('127.0.0.1')), true);
  });
});

// ──────────────────────────────────────────
// getNetworkClass
// ──────────────────────────────────────────
describe('getNetworkClass', () => {
  it('1.0.0.0 is Class A', () => {
    assert.equal(getNetworkClass(ipToInt('1.0.0.0')), 'A');
  });

  it('127.0.0.0 is Class A', () => {
    assert.equal(getNetworkClass(ipToInt('127.0.0.0')), 'A');
  });

  it('128.0.0.0 is Class B', () => {
    assert.equal(getNetworkClass(ipToInt('128.0.0.0')), 'B');
  });

  it('191.255.0.0 is Class B', () => {
    assert.equal(getNetworkClass(ipToInt('191.255.0.0')), 'B');
  });

  it('192.0.0.0 is Class C', () => {
    assert.equal(getNetworkClass(ipToInt('192.0.0.0')), 'C');
  });

  it('223.255.255.0 is Class C', () => {
    assert.equal(getNetworkClass(ipToInt('223.255.255.0')), 'C');
  });

  it('224.0.0.0 is Class D', () => {
    assert.equal(getNetworkClass(ipToInt('224.0.0.0')), 'D');
  });

  it('240.0.0.0 is Class E', () => {
    assert.equal(getNetworkClass(ipToInt('240.0.0.0')), 'E');
  });
});

// ──────────────────────────────────────────
// isInSubnet
// ──────────────────────────────────────────
describe('isInSubnet', () => {
  it('192.168.1.50 is in 192.168.1.0/24', () => {
    assert.equal(isInSubnet(ipToInt('192.168.1.50'), ipToInt('192.168.1.0'), 24), true);
  });

  it('192.168.2.1 is NOT in 192.168.1.0/24', () => {
    assert.equal(isInSubnet(ipToInt('192.168.2.1'), ipToInt('192.168.1.0'), 24), false);
  });

  it('10.0.0.128 is in 10.0.0.0/8', () => {
    assert.equal(isInSubnet(ipToInt('10.0.0.128'), ipToInt('10.0.0.0'), 8), true);
  });

  it('11.0.0.1 is NOT in 10.0.0.0/8', () => {
    assert.equal(isInSubnet(ipToInt('11.0.0.1'), ipToInt('10.0.0.0'), 8), false);
  });
});

// ──────────────────────────────────────────
// splitSubnet
// ──────────────────────────────────────────
describe('splitSubnet', () => {
  it('splits /24 into two /25', () => {
    const subs = splitSubnet(ipToInt('192.168.1.0'), 24, 25);
    assert.equal(subs.length, 2);
    assert.equal(intToIp(subs[0].network), '192.168.1.0');
    assert.equal(intToIp(subs[1].network), '192.168.1.128');
  });

  it('splits /24 into four /26', () => {
    const subs = splitSubnet(ipToInt('192.168.1.0'), 24, 26);
    assert.equal(subs.length, 4);
    assert.equal(intToIp(subs[3].network), '192.168.1.192');
  });

  it('splits /16 into 256 /24s', () => {
    const subs = splitSubnet(ipToInt('10.0.0.0'), 16, 24);
    assert.equal(subs.length, 256);
    assert.equal(intToIp(subs[0].network),   '10.0.0.0');
    assert.equal(intToIp(subs[255].network), '10.0.255.0');
  });

  it('throws when newCidr <= originalCidr', () => {
    assert.throws(() => splitSubnet(ipToInt('192.168.1.0'), 24, 24), /larger/);
    assert.throws(() => splitSubnet(ipToInt('192.168.1.0'), 24, 20), /larger/);
  });

  it('broadcast of last split subnet is correct', () => {
    const subs = splitSubnet(ipToInt('192.168.1.0'), 24, 25);
    assert.equal(intToIp(subs[1].broadcast), '192.168.1.255');
  });
});

// ──────────────────────────────────────────
// toBinary
// ──────────────────────────────────────────
describe('toBinary', () => {
  it('0.0.0.0 -> all zeros', () => {
    assert.equal(toBinary(0), '00000000.00000000.00000000.00000000');
  });

  it('255.255.255.255 -> all ones', () => {
    assert.equal(toBinary(0xffffffff), '11111111.11111111.11111111.11111111');
  });

  it('192.168.1.0 correct binary', () => {
    const result = toBinary(ipToInt('192.168.1.0'));
    assert.equal(result, '11000000.10101000.00000001.00000000');
  });

  it('length is 35 chars (32 bits + 3 dots)', () => {
    assert.equal(toBinary(ipToInt('10.20.30.40')).length, 35);
  });
});
