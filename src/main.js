/**
 * main.js - DOM wiring and event handling
 */

import {
  parseInput,
  calculateSubnet,
  intToIp,
  toBinary,
  cidrToMask,
  maskToCidr,
  ipToInt,
  isInSubnet,
  splitSubnet,
} from './subnet.js';
import { t } from './i18n.js';

// ──────────────────────────────────────────
// State
// ──────────────────────────────────────────
let lang  = localStorage.getItem('ipv4-lang')  || 'ja';
let theme = localStorage.getItem('ipv4-theme') || 'dark';
let lastResult = null; // last calculateSubnet() result

// ──────────────────────────────────────────
// DOM helpers
// ──────────────────────────────────────────
const $ = id => document.getElementById(id);

function setText(id, text) {
  const el = $(id);
  if (el) el.textContent = text;
}

function setAttr(id, attr, val) {
  const el = $(id);
  if (el) el.setAttribute(attr, val);
}

// ──────────────────────────────────────────
// i18n
// ──────────────────────────────────────────
function applyLang() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(lang, el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(lang, el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(lang, el.dataset.i18nTitle);
  });
  $('langBtn').textContent = t(lang, 'lang');
  document.title = t(lang, 'title');
}

// ──────────────────────────────────────────
// Theme
// ──────────────────────────────────────────
function applyTheme() {
  document.documentElement.setAttribute('data-theme', theme);
}

// ──────────────────────────────────────────
// Copy-to-clipboard helper
// ──────────────────────────────────────────
function makeCopyable(el, getValue) {
  el.style.cursor = 'pointer';
  el.title = t(lang, 'copyHint');
  el.addEventListener('click', () => {
    const val = getValue ? getValue() : el.textContent;
    navigator.clipboard.writeText(val).then(() => {
      const orig = el.textContent;
      el.textContent = t(lang, 'copied');
      setTimeout(() => { el.textContent = orig; }, 1000);
    }).catch(() => {});
  });
}

// ──────────────────────────────────────────
// Binary visualization
// ──────────────────────────────────────────
function renderBinary(ip, cidr) {
  const container = $('binaryViz');
  if (!container) return;
  container.innerHTML = '';

  const bin = toBinary(ip).replace(/\./g, '');
  const labels = ['binaryVizLabel'];

  // Row 1: labels
  const labelRow = document.createElement('div');
  labelRow.className = 'binary-labels';
  const netLabel = document.createElement('span');
  netLabel.className = 'binary-net-label';
  netLabel.textContent = t(lang, 'networkBits') + ` (${cidr})`;
  const hostLabel = document.createElement('span');
  hostLabel.className = 'binary-host-label';
  hostLabel.textContent = t(lang, 'hostBits') + ` (${32 - cidr})`;
  labelRow.appendChild(netLabel);
  if (cidr < 32) labelRow.appendChild(hostLabel);
  container.appendChild(labelRow);

  // Row 2: bits
  const bitsRow = document.createElement('div');
  bitsRow.className = 'binary-bits';

  for (let i = 0; i < 32; i++) {
    if (i > 0 && i % 8 === 0) {
      const dot = document.createElement('span');
      dot.className = 'binary-dot';
      dot.textContent = '.';
      bitsRow.appendChild(dot);
    }
    const bit = document.createElement('span');
    bit.className = i < cidr ? 'bit bit-net' : 'bit bit-host';
    bit.textContent = bin[i];
    bitsRow.appendChild(bit);
  }
  container.appendChild(bitsRow);

  // Row 3: octet decimal values
  const octetsRow = document.createElement('div');
  octetsRow.className = 'binary-octets';
  const ipInt = ip;
  const octets = [
    (ipInt >>> 24) & 0xff,
    (ipInt >>> 16) & 0xff,
    (ipInt >>>  8) & 0xff,
     ipInt        & 0xff,
  ];
  octets.forEach((o, i) => {
    if (i > 0) {
      const dot = document.createElement('span');
      dot.className = 'binary-octet-dot';
      dot.textContent = '.';
      octetsRow.appendChild(dot);
    }
    const span = document.createElement('span');
    span.className = 'binary-octet';
    span.textContent = o;
    octetsRow.appendChild(span);
  });
  container.appendChild(octetsRow);
}

// ──────────────────────────────────────────
// Results rendering
// ──────────────────────────────────────────
function renderResults(res, inputIp) {
  lastResult = res;

  const rows = [
    ['networkAddress',  intToIp(res.network)],
    ['broadcastAddress',intToIp(res.broadcast)],
    ['firstHost',       intToIp(res.firstHost)],
    ['lastHost',        intToIp(res.lastHost)],
    ['totalHosts',      res.totalHosts.toLocaleString()],
    ['usableHosts',     res.usableHosts.toLocaleString()],
    ['subnetMask',      intToIp(res.mask)],
    ['wildcardMask',    intToIp(res.wildcard)],
    ['cidrPrefix',      `/${res.cidr}`],
    ['networkClass',    `Class ${res.class}`],
    ['privatePublic',   res.isPrivate
      ? t(lang, ((res.network >>> 24) & 0xff) === 127 ? 'loopback' : 'private')
      : t(lang, 'public')],
  ];

  const grid = $('resultsGrid');
  grid.innerHTML = '';

  rows.forEach(([key, value]) => {
    const card = document.createElement('div');
    card.className = 'result-card';

    const label = document.createElement('div');
    label.className = 'result-label';
    label.dataset.i18n = key;
    label.textContent = t(lang, key);

    const val = document.createElement('div');
    val.className = 'result-value';
    val.textContent = value;
    makeCopyable(val);

    card.appendChild(label);
    card.appendChild(val);
    grid.appendChild(card);
  });

  // Also show mask in binary
  const maskBinCard = document.createElement('div');
  maskBinCard.className = 'result-card result-card--wide';
  const maskBinLabel = document.createElement('div');
  maskBinLabel.className = 'result-label';
  maskBinLabel.textContent = t(lang, 'subnetMask') + ' (' + t(lang, 'binary') + ')';
  const maskBinVal = document.createElement('div');
  maskBinVal.className = 'result-value result-value--mono';
  maskBinVal.textContent = toBinary(res.mask);
  makeCopyable(maskBinVal);
  maskBinCard.appendChild(maskBinLabel);
  maskBinCard.appendChild(maskBinVal);
  grid.appendChild(maskBinCard);

  $('resultsSection').classList.remove('hidden');
  renderBinary(inputIp, res.cidr);

  // Set default split cidr
  const splitCidrEl = $('splitCidr');
  if (splitCidrEl) {
    splitCidrEl.value = Math.min(res.cidr + 1, 32);
    splitCidrEl.min   = res.cidr + 1;
    splitCidrEl.max   = 32;
  }

  // Set default range check IP
  const rangeIpEl = $('rangeIp');
  if (rangeIpEl && !rangeIpEl.value) {
    rangeIpEl.value = intToIp(inputIp);
  }

  clearMessage('splitResult');
  clearMessage('rangeResult');
}

// ──────────────────────────────────────────
// Error / message display
// ──────────────────────────────────────────
function showError(id, msg) {
  const el = $(id);
  if (!el) return;
  el.textContent = msg;
  el.className = 'msg msg--error';
}

function showInfo(id, msg, className = 'msg msg--info') {
  const el = $(id);
  if (!el) return;
  el.textContent = msg;
  el.className = className;
}

function clearMessage(id) {
  const el = $(id);
  if (el) { el.textContent = ''; el.className = ''; }
}

// ──────────────────────────────────────────
// Calculate handler
// ──────────────────────────────────────────
function handleCalculate() {
  clearMessage('inputError');
  const raw = $('ipInput').value.trim();
  if (!raw) return;

  try {
    const { ip, cidr } = parseInput(raw);
    const res = calculateSubnet(ip, cidr);
    renderResults(res, ip);
  } catch (e) {
    showError('inputError', e.message || t(lang, 'invalidInput'));
    $('resultsSection').classList.add('hidden');
  }
}

// ──────────────────────────────────────────
// IP range check
// ──────────────────────────────────────────
function handleRangeCheck() {
  if (!lastResult) return;
  clearMessage('rangeResult');

  const raw = $('rangeIp').value.trim();
  if (!raw) return;

  try {
    const ip = ipToInt(raw);
    const inRange = isInSubnet(ip, lastResult.network, lastResult.cidr);
    const cls = inRange ? 'msg msg--success' : 'msg msg--warning';
    showInfo('rangeResult', t(lang, inRange ? 'inRange' : 'outOfRange'), cls);
  } catch (e) {
    showError('rangeResult', e.message);
  }
}

// ──────────────────────────────────────────
// Subnet split
// ──────────────────────────────────────────
function handleSplit() {
  if (!lastResult) return;
  clearMessage('splitResult');
  $('splitList').innerHTML = '';

  const newCidr = parseInt($('splitCidr').value, 10);
  if (isNaN(newCidr) || newCidr <= lastResult.cidr || newCidr > 32) {
    showError('splitResult', t(lang, 'splitError'));
    return;
  }

  try {
    const subnets = splitSubnet(lastResult.network, lastResult.cidr, newCidr);
    const MAX = 1024;
    const limited = subnets.length > MAX;
    const display = limited ? subnets.slice(0, MAX) : subnets;

    const list = $('splitList');
    display.forEach((s, idx) => {
      const li = document.createElement('li');
      li.className = 'split-item';
      const netIp = intToIp(s.network);
      const bcastIp = intToIp(s.broadcast);
      li.innerHTML = `<span class="split-idx">${idx + 1}</span><span class="split-net">${netIp}/${newCidr}</span><span class="split-range">${netIp} – ${bcastIp}</span>`;
      list.appendChild(li);
    });

    if (limited) {
      showInfo('splitResult', t(lang, 'splitLimit'));
    }
  } catch (e) {
    showError('splitResult', e.message);
  }
}

// ──────────────────────────────────────────
// CIDR reference table
// ──────────────────────────────────────────
function buildCidrTable() {
  const tbody = $('cidrTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  for (let cidr = 0; cidr <= 32; cidr++) {
    const mask   = cidrToMask(cidr);
    const total  = Math.pow(2, 32 - cidr);
    const usable = cidr >= 31 ? (cidr === 32 ? 1 : 2) : total - 2;
    const per24  = cidr <= 24 ? 1 : Math.pow(2, cidr - 24);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>/${cidr}</td>
      <td>${intToIp(mask)}</td>
      <td>${usable.toLocaleString()}</td>
      <td>${per24 > 1 ? per24.toLocaleString() : '—'}</td>
    `;
    tbody.appendChild(tr);
  }
}

// ──────────────────────────────────────────
// Init
// ──────────────────────────────────────────
function init() {
  applyTheme();
  applyLang();
  buildCidrTable();

  // Calculate button
  $('calcBtn').addEventListener('click', handleCalculate);

  // Enter key in input
  $('ipInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleCalculate();
  });

  // Clear button
  $('clearBtn').addEventListener('click', () => {
    $('ipInput').value = '';
    $('resultsSection').classList.add('hidden');
    clearMessage('inputError');
    lastResult = null;
  });

  // Language toggle
  $('langBtn').addEventListener('click', () => {
    lang = lang === 'ja' ? 'en' : 'ja';
    localStorage.setItem('ipv4-lang', lang);
    applyLang();
    if (lastResult) {
      // Re-render results with new lang
      const raw = $('ipInput').value.trim();
      if (raw) {
        try {
          const { ip } = parseInput(raw);
          renderResults(lastResult, ip);
        } catch (_) {}
      }
    }
    buildCidrTable();
  });

  // Theme toggle
  $('themeBtn').addEventListener('click', () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('ipv4-theme', theme);
    applyTheme();
  });

  // Range check
  $('rangeCheckBtn').addEventListener('click', handleRangeCheck);
  $('rangeIp').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleRangeCheck();
  });

  // Split subnet
  $('splitBtn').addEventListener('click', handleSplit);

  // Example quick-fills
  document.querySelectorAll('.example-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $('ipInput').value = btn.dataset.value;
      handleCalculate();
    });
  });
}

document.addEventListener('DOMContentLoaded', init);
