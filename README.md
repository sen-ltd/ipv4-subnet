# IPv4 Subnet Calculator

**Live demo**: https://sen.ltd/portfolio/ipv4-subnet/

IPv4 subnet calculator with binary visualization, host ranges, and subnet splitting. Zero dependencies, no build step. Japanese / English UI.

## Features

- **Subnet info** — network address, broadcast, first/last host, total/usable hosts
- **Masks** — subnet mask (dotted & binary), wildcard mask, CIDR prefix
- **Classification** — network class (A/B/C/D/E), private/public (RFC 1918)
- **Binary visualization** — network vs host bits color-coded, per-octet decimal
- **IP range check** — test whether a given IP falls within the subnet
- **Subnet split** — divide a network into smaller subnets (/24 → /26 etc.)
- **CIDR reference table** — all /0–/32 with mask, usable hosts, subnets-per-/24
- **Input formats** — `192.168.1.1/24` or `192.168.1.1 255.255.255.0`
- **Dark / light theme**, Japanese / English UI, persistent via localStorage

## Usage

Open `index.html` in a browser, or:

```sh
npm run serve   # python3 -m http.server 8080
```

Then navigate to http://localhost:8080.

## Tests

```sh
npm test
```

Runs 63 tests with Node's built-in test runner (`node --test`). No extra packages needed.

## Project structure

```
index.html        # single-page app
style.css         # all styles, dark/light CSS variables
src/
  subnet.js       # subnet math (pure functions, bitwise ops)
  i18n.js         # ja/en translations
  main.js         # DOM wiring and event handling
tests/
  subnet.test.js  # 63 unit tests
```

## License

MIT — Copyright (c) 2026 SEN LLC (SEN 合同会社)

<!-- sen-publish:links -->
## Links

- 🌐 Demo: https://sen.ltd/portfolio/ipv4-subnet/
- 📝 dev.to: https://dev.to/sendotltd/an-ipv4-subnet-calculator-with-binary-visualization-and-31-handling-13jn
<!-- /sen-publish:links -->
