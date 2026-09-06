# Security Policy

## Supported Versions

Security updates are only provided for the latest release of SignalForge.

| Version | Supported |
|---------|-----------|
| latest  | Yes       |
| < latest| No        |

## Reporting a Vulnerability

Please do **not** open a public GitHub issue for security vulnerabilities.
Instead, report them privately to the maintainer:

- **Maintainer:** Mobolaji Opeyemi Bolatito
- **Email:** opeblow2021@gmail.com

Please include:

- A description of the vulnerability and the affected version(s)
- A minimal reproduction or proof of concept
- The potential impact and any suggested remediation, if known

You will receive an acknowledgement within **48 hours** and a more detailed
response (with a fix timeline) as soon as the report is triaged.

## Disclosure

We ask that you allow us a reasonable window to patch and publish a fix before
disclosing the vulnerability publicly.

## Security Best Practices (for contributors)

- Never commit secrets, tokens, or API keys to the repository.
- The backend uses the keyless Binance public API; do not add keyed endpoints
  without explicit configuration + secret management via environment variables.
- Validate and sanitize all user input at the API boundary.
- Keep dependencies updated and monitor for known CVEs.
