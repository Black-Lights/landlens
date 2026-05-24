# Security Policy

If you discover a security vulnerability in LandLens, please **do not** open a public issue. Instead, email security reports to:

**mohammadammar.mughees@mail.polimi.it**

We will respond within 48 hours and work with you on a coordinated disclosure timeline.

## What's in scope
- The LandLens website (`land.trenlens.com`) and its APIs
- The MCP server (`landlens-mcp` package)
- The companion `landlens-segmentation` service
- Documentation that could mislead users into unsafe practices

## What's not in scope
- Third-party services (Supabase, Vercel, Cloudflare, Google Earth Engine) — report directly to them
- Social engineering of the maintainers
- Denial-of-service attacks against the public site
- Findings against forks or unofficial deployments

## Responsible disclosure
- Give us 90 days to patch before public disclosure
- Don't access, modify, or delete data that isn't yours
- Don't degrade the service for other users

## Acknowledgments
We credit responsible reporters in the project changelog and `SECURITY-HALL-OF-FAME.md` once a vulnerability is resolved.
