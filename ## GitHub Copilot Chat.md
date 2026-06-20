## GitHub Copilot Chat

- Extension: 0.39.1 (prod)
- VS Code: 1.111.0 (ce099c1ed25d9eb3076c11e4a280f3eb52b4fbeb)
- OS: win32 10.0.26200 x64
- GitHub Account: convoycubano1-glitch

## Network

User Settings:
```json
  "http.systemCertificatesNode": true,
  "github.copilot.advanced.debug.useElectronFetcher": true,
  "github.copilot.advanced.debug.useNodeFetcher": false,
  "github.copilot.advanced.debug.useNodeFetchFetcher": true
```

Connecting to https://api.github.com:
- DNS ipv4 Lookup: 140.82.114.6 (16 ms)
- DNS ipv6 Lookup: Error (14 ms): getaddrinfo ENOTFOUND api.github.com
- Proxy URL: None (0 ms)
- Electron fetch (configured): HTTP 200 (39 ms)
- Node.js https: HTTP 200 (163 ms)
- Node.js fetch: HTTP 200 (43 ms)

Connecting to https://api.githubcopilot.com/_ping:
- DNS ipv4 Lookup: 140.82.114.21 (80 ms)
- DNS ipv6 Lookup: Error (20 ms): getaddrinfo ENOTFOUND api.githubcopilot.com
- Proxy URL: None (9 ms)
- Electron fetch (configured): HTTP 200 (154 ms)
- Node.js https: HTTP 200 (164 ms)
- Node.js fetch: HTTP 200 (153 ms)

Connecting to https://copilot-proxy.githubusercontent.com/_ping:
- DNS ipv4 Lookup: 4.249.131.160 (20 ms)
- DNS ipv6 Lookup: Error (17 ms): getaddrinfo ENOTFOUND copilot-proxy.githubusercontent.com
- Proxy URL: None (10 ms)
- Electron fetch (configured): HTTP 200 (222 ms)
- Node.js https: HTTP 200 (227 ms)
- Node.js fetch: HTTP 200 (205 ms)

Connecting to https://mobile.events.data.microsoft.com: HTTP 404 (75 ms)
Connecting to https://dc.services.visualstudio.com: HTTP 404 (242 ms)
Connecting to https://copilot-telemetry.githubusercontent.com/_ping: HTTP 200 (163 ms)
Connecting to https://copilot-telemetry.githubusercontent.com/_ping: HTTP 200 (148 ms)
Connecting to https://default.exp-tas.com: HTTP 400 (96 ms)

Number of system certificates: 111

## Documentation

In corporate networks: [Troubleshooting firewall settings for GitHub Copilot](https://docs.github.com/en/copilot/troubleshooting-github-copilot/troubleshooting-firewall-settings-for-github-copilot).