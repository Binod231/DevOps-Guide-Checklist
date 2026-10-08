# DevOps Operational Checklist

---

[Implementation Tracker](Implementation%20Tracker%203f1e3ade4b32805d868ed8dcec71f05b.csv)

# Suggested Implementation Order

## Phase 1 — Foundations: Infrastructure, Identity & Data Safety

- [ ]  Managed application platform provisioning
- [ ]  Infrastructure as Code (IaC) with remote state locking
- [ ]  Automated database backups & continuous Point-in-Time Recovery (PITR)
- [ ]  Centralized secret management (no plaintext `.env` files)
- [ ]  Organization-wide 2FA enforcement
- [ ]  Environment isolation (Staging and Production)

## Phase 2 — Quality & CI Pipeline Gating

- [ ]  Trunk branch protections & code review enforcement
- [ ]  Automated CI pipeline with sub-5-minute feedback loop
- [ ]  Automated secret scanning (pre-commit & push hooks)
- [ ]  Dependency lockfile pinning & vulnerability scans (SCA)
- [ ]  Automated core integration & API tests
- [ ]  Container image scanning & secure registry controls

## Phase 3 — Observability & SRE Mechanics

- [ ]  Centralized application exception tracking
- [ ]  Structured JSON logging with request correlation IDs
- [ ]  External uptime monitoring & basic health checks
- [ ]  Golden Signals, SLIs & SLO tracking (p95/p99 latency)
- [ ]  On-call rotation & paging escalation paths
- [ ]  Empirical database restore drill execution

## Phase 4 — Safe Release Engineering, Edge & Cost Controls

- [ ]  Backward-compatible database migrations (expand-and-contract)
- [ ]  Documented rollback procedure & one-click reverts
- [ ]  Progressive delivery (canary rollouts/feature flags)
- [ ]  Edge security, WAF & ingress rate limiting
- [ ]  Cloud FinOps spend ceilings & budget alerts

# Production Readiness Gate

Before calling the system **production-ready**, confirm:

- [ ]  Infrastructure is provisioned declaratively via IaC with remote state locking
- [ ]  Database Point-in-Time Recovery (PITR) is active, and an initial restore drill has passed
- [ ]  Secrets are centralized in a dedicated vault; zero plain-text production secrets in repos
- [ ]  2FA is enforced across cloud, repository, and SaaS tooling
- [ ]  Code cannot be pushed directly to production trunk branches
- [ ]  Pull requests have automated CI checks completing in under 5 minutes
- [ ]  Dependencies are pinned and scanned for known vulnerabilities
- [ ]  Critical business paths have automated integration/E2E coverage
- [ ]  Containers are built from minimal images and scanned for vulnerabilities
- [ ]  Application exceptions are monitored with real-time alerting
- [ ]  Structured logs are centralized and searchable via correlation IDs
- [ ]  Golden signal metrics (p95/p99 latency, error rates) and uptime probes are active
- [ ]  On-call escalation paths and runbooks are documented
- [ ]  Releases support backward-compatible migrations and fast one-click rollback
- [ ]  Public ingress endpoints are protected by rate limiting and WAF
- [ ]  Cloud billing budget alerts and auto-scaling limits are configured

# Notes & Decisions

## Architecture Notes

*Add infrastructure decisions, diagrams, constraints, and important assumptions here.*

## Security Notes

*Add security exceptions, access-control decisions, secret-rotation policies, and audit findings here.*

## Incident / Recovery Notes

*Record backup-restore tests, rollback tests, incidents, RCA links, and lessons learned here.*

## Open Issues

- [ ]  
- [ ]  
- [ ]  

## Useful Links

- Repository:
- CI/CD:
- Infrastructure repository:
- Monitoring:
- Logging:
- Error tracking:
- Backup/DR documentation:
- Incident runbook:
- Architecture diagram: