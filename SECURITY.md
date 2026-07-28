# Security policy

## Supported version

Security updates target the current `main` branch and the most recent release.

## Reporting a vulnerability

Use GitHub Private Vulnerability Reporting for this repository. If that feature
is unavailable, contact the maintainer through a private address listed on their
GitHub profile.

Do not open a public issue for authentication bypasses, cross-home access, file
disclosure, token leakage, injection, or remote code execution.

Include:

- the affected route or version;
- the expected and observed behavior;
- the security impact;
- a minimal reproduction using fictional data;
- a suggested remediation, if available.

Remove credentials, addresses, private files, personal information, session
cookies, and authentication tokens from the report. Please allow the maintainer
reasonable time to investigate and publish a fix before public disclosure.

## Security assumptions

Production operators must use HTTPS, strong unique secrets, restricted
PostgreSQL and S3 networks, a private bucket, encrypted backups, authenticated
SMTP where required, and a shared rate limiter when running multiple replicas.
Containers should run as non-root and dependencies should be kept patched.

The included upload scanner interface is not antivirus protection by itself.
Connect a fail-closed scanner before accepting uploads from untrusted public
users.
