# DevOps Implementation Guide

## Objective

Use this checklist to establish a lean, reliable, secure, and production-ready DevOps foundation without over-engineering or unnecessary infrastructure complexity.

**Operating principles**

- **Speed & Developer Velocity:** Fast feedback loops that keep engineers shipping code safely.
- **Simplicity First:** Low operational overhead over complex toolchains.
- **Automated Quality Gates:** Catch errors in CI/CD rather than in production.
- **Security by Default:** Shift-left security without slowing down delivery.
- **Observable Systems:** High-visibility metrics, logs, and traces for rapid debugging.
- **Resilience & Recovery:** Reliable backups, safe rollbacks, and non-breaking migrations.

Use this checklist to establish a lean, reliable, secure, and production-ready DevOps foundation without unnecessary infrastructure complexity.

# 1. Source Code Management & CI/CD

## Branch Protections & Single PR Approvals

- [ ]  **Implementation complete**
- **Description:** Enforce branch protection on `main`/`master`. Prohibit direct pushes and require at least one peer code review before merging.
- **Why it matters:** Prevents broken builds or accidental code overwrites in production without slowing down developer flow.
- **Key concepts:**
    - GitHub/GitLab/Bitbucket branch protection
    - Single reviewer rule
    - Squash merging
- **Recommended tools:** GitHub / GitLab / Bitbucket
- **Verification gate:** Attempt a direct push to `main` using Git CLI. The push must be rejected.

## Automated CI Pipelines for Main & Pull Requests

- [ ]  **Implementation complete**
- **Description:** Run automated build, lint, and unit-test checks on every pull request and main-branch commit.
- **Why it matters:** Catches breaking changes before they reach staging or production.
- **Key concepts:**
    - GitHub Actions / CircleCI
    - Fast feedback loop — target under 5 minutes
    - Parallel testing
- **Recommended tools:** GitHub Actions / Vercel Builds / CircleCI
- **Verification gate:** Open a PR with a deliberately broken test. CI must fail and block merging.

## Automated Secret Scanning in CI & Pre-Commit Hooks

- [ ]  **Implementation complete**
- **Description:** Scan code for API keys, tokens, database credentials, certificates, and other secrets before pushing code.
- **Why it matters:** Prevents credentials from reaching repositories and reduces the risk of infrastructure compromise.
- **Key concepts:**
    - Gitleaks / TruffleHog
    - Pre-commit hooks
    - Repository push protection
- **Recommended tools:** Gitleaks / TruffleHog / GitGuardian
- **Verification gate:** Commit a dummy high-entropy secret-like value. The scanner must trigger an alert/block.

## Backward-Compatible Database Migrations (Expand and Contract)

- [ ]  Implementation complete
- **Description**: Enforce safe schema evolution where database changes are decoupled from code releases (e.g., adding a column before using it, never dropping columns/tables in the same release).
- **Why it matters:** Prevents application errors during rollbacks and ensures zero-downtime schema updates.
    - Key concepts: Expand-and-contract pattern
    - Non-breaking migrations
    - Decoupled deployments
- **Recommended tools:** Prisma Migrate / Alembic / Flyway / native ORM migration tools
- **Verification gate:** Simulate a rollback from Code Version N+1 to Version N while running the new schema. The older version must still function without errors.

## Progressive Delivery & Canary Deployments (Optional For Startup

- [ ]  **Implementation complete**
- **Description:** Implement progressive rollout mechanics (canary deployments, blue-green cutovers, or dynamic feature flags) rather than routing 100% of production traffic to new code immediately.
- **Why it matters:** Limits blast radius. If a regression escapes CI, only a small percentage of users are impacted while automated gates detect degradation and roll back safely.
- **Key concepts:**
    - Canary rollouts (e.g., 5% → 25% → 100%)
    - Feature flag decoupling
    - Automated metric-based rollbacks
- **Recommended tools:** LaunchDarkly / Unleash / Argo Rollouts / Flagger / Cloud platform traffic splitting
- **Verification gate:** Deploy a release configured to route 10% of traffic to a canary build; verify traffic splits accurately and automated rollback triggers if canary metrics fail.

# 2. Infrastructure

## Managed Application Platforms

- [ ]  **Implementation complete**
- **Description:** Prefer managed application platforms, managed containers, PaaS, or managed Kubernetes over manually maintaining raw virtual machines when practical.
- **Why it matters:** Reduces OS patching, load-balancer, hardware, and platform-maintenance overhead.
- **Key concepts:**
    - PaaS
    - Automated HTTPS
    - Managed containers
- **Recommended tools:** Vercel / Render / managed Kubernetes / equivalent platform
- **Verification gate:** Verify the application can scale according to platform capabilities and TLS certificates are renewed automatically.

## Infrastructure as Code

- [ ]  **Implementation complete**
- **Description:** Provision databases, object storage, DNS, networking, and other infrastructure using declarative IaC.
- **Why it matters:** Eliminates ClickOps errors and allows environments to be recreated consistently.
- **Key concepts:**
    - Terraform / CloudFormation
    - Remote state and locking
    - No ClickOps
- **Recommended tools:** Terraform / CloudFormation / Pulumi
- **Verification gate:** Run `terraform plan` and confirm production infrastructure is represented in code/state.

## Isolated Staging & Production Environments (Staging Env is Optional for the Startup or small company)

- [ ]  **Implementation complete**
- **Description:** Maintain isolated staging and production environments with separate databases, credentials, secrets, and configuration.
- **Why it matters:** Prevents testing, migrations, or experiments from corrupting real customer data.
- **Key concepts:**
    - Environment parity
    - Database isolation
    - Runtime environment variables
- **Recommended tools:** Separate cloud projects/accounts, isolated platform environments, separate database instances
- **Verification gate:** Verify that staging cannot connect to the production database.

## Edge Security, WAF & Ingress Rate Limiting (Optional For Startup)

- [ ]  **Implementation complete**
- **Description:** Enforce edge protection, Web Application Firewall (WAF) filtering, and API gateway rate limiting on all public ingress points.
- **Why it matters:** Prevents brute-force attacks, credential stuffing, distributed denial of service (DDoS), and aggressive web scrapers from exhausting backend compute.
- **Key concepts:**
    - Token-bucket / sliding-window rate limiting
    - Managed WAF rulesets (OWASP Top 10)
    - Automated DDoS protection
- **Recommended tools:** Cloudflare / AWS WAF / Fastly / Envoy Gateway
- **Verification gate:** Execute an automated script exceeding the allowed request threshold against an API endpoint; the gateway must return HTTP 429 Too Many Requests.

## Cloud FinOps Guardrails & Budget Ceilings

- [ ]  **Implementation complete**
- **Description:** Establish explicit cloud spending alerts, hard quota ceilings, and auto-scaling instance caps across all cloud accounts.
- **Why it matters:** Prevents accidental billing spikes caused by runaway cloud jobs, misconfigured auto-scaling policies, or denial-of-wallet incidents.
- **Key concepts:**
    - Tiered budget threshold alerts (50%, 75%, 90%, 100%)
    - Auto-scaling instance ceilings
    - Anomaly spend detection
- **Recommended tools:** AWS Budgets / GCP Cloud Billing Alerts / Infracost / Vantage
- **Verification gate:** Set a deliberate test billing notification threshold near current spend and verify automated notification arrives in the engineering alerting channel.

# 3.  Testing & Quality

## Automated Core Integration & API Tests

- [ ]  **Implementation complete**
- **Description:** Implement integration and end-to-end tests for critical business flows such as signup, authentication, checkout, and other revenue-generating paths.
- **Why it matters:** Protects critical functionality during frequent deployments.
- **Key concepts:**
    - End-to-end testing
    - API integration testing
    - Critical-path coverage
- **Recommended tools:** Playwright / Vitest / Postman CLI
- **Verification gate:** Run the E2E/integration suite against staging before promoting a production release.

## Pinned Dependencies & Automated Security Audits (Optional For Startup)

- [ ]  **Implementation complete**
- **Description:** Lock dependency versions and automate recurring dependency vulnerability scans.
- **Why it matters:** Prevents unexpected breakage from transitive dependency updates and identifies vulnerable packages.
- **Key concepts:**
    - Lockfiles
    - Dependabot / Renovate
    - Software Composition Analysis
- **Recommended tools:** GitHub Dependabot / Snyk / Trivy
- **Verification gate:** Confirm the appropriate lockfile exists and automated dependency security alerts are enabled.

# 4. Security

## Centralized Secret & Environment Variable Management (Implement in Startup, if they want more security)

- [ ]  **Implementation complete**
- **Description:** Store secrets in a centralized secret-management system rather than hardcoded `.env` files or source code.
- **Why it matters:** Enables secure access, controlled rotation, and prevents credentials from being shared in plain text.
- **Key concepts:**
    - Secret vault
    - Environment injection
    - Secret rotation
- **Recommended tools:** Doppler / Infisical / platform-native secret manager
- **Verification gate:** Confirm real production secrets are not committed to repositories or stored on developer machines unnecessarily.

## Enforced Two-Factor Authentication

- [ ]  **Implementation complete**
- **Description:** Mandate hardware-key or TOTP-based 2FA across source control, infrastructure, cloud, communication, and other critical SaaS tools.
- **Why it matters:** Reduces the risk of account takeover and phishing-based infrastructure compromise.
- **Key concepts:**
    - TOTP / security keys
    - Organization-wide 2FA enforcement
    - Least-privilege access
- **Recommended tools:** 1Password / Google Authenticator / Okta/hardware security keys
- **Verification gate:** Check administrative dashboards and confirm 2FA enforcement is active for all users where supported.

## Automated Container & Binary Vulnerability Scanning

- [ ]  **Implementation complete**
- **Description:** Scan container images for OS-package and dependency vulnerabilities before deployment.
- **Why it matters:** Identifies critical Linux and application vulnerabilities before they reach production.
- **Key concepts:**
    - Container scanning
    - CVE severity thresholds
    - Minimal/distroless images
- **Recommended tools:** Trivy / Docker Scout / equivalent registry scanner
- **Verification gate:** Build an image with a known outdated base package and verify that the scanner reports the vulnerability.

## Secure Container Registries & Access Control

- [ ]  Implementation complete
- **Description**: Secure your container registries with strict least-privilege access, short-lived tokens, and vulnerability gating before push/pull.
- **Why it matters**: Prevents unauthorized tampering with production images or malicious code injection into your deployment pipeline.
    - Key concepts: Private registry IAM
    - Short-lived registry credentials
    - Image signing/provenance
- **Recommended tools:** AWS ECR / GitHub Packages (GHCR) / Docker Hub private repositories
- **Verification gate:** Attempt to pull a production container image using an expired or unauthenticated token; the request must be denied.

# 5.  Observability (Optional For Startup)

## Centralized Application Exception Tracking

- [ ]  **Implementation complete**
- **Description:** Instrument backend and frontend applications with real-time exception tracking.
- **Why it matters:** Gives engineers stack traces, release context, and alerts when users encounter failures.
- **Key concepts:**
    - Exception monitoring
    - Stack-trace inspection
    - Release correlation
- **Recommended tools:** Sentry / Rollbar / Highlight.io
- **Verification gate:** Trigger a controlled unhandled error in staging and confirm the alert arrives in the configured notification channel.

## Structured Log Aggregation & Search

- [ ]  **Implementation complete**
- **Description:** Emit structured JSON logs and aggregate them in a centralized log platform.
- **Why it matters:** Enables fast troubleshooting without SSH access to individual servers or containers.
- **Key concepts:**
    - JSON logging
    - Correlation/request IDs
    - Centralized log search
- **Recommended tools:** Datadog / Better Stack / Logtail / Grafana Loki
- **Verification gate:** Query the logging platform for a specific `request_id` and confirm all related logs can be correlated.

## Uptime Monitoring & Basic Paging Alerts

- [ ]  **Implementation complete**
- **Description:** Configure external uptime checks for primary application endpoints with immediate notifications for outages.
- **Why it matters:** Helps the team detect incidents before customers report them.
- **Key concepts:**
    - Synthetic HTTP health checks
    - Incident escalation
    - Status page
- **Recommended tools:** UptimeRobot / Better Stack / Pingdom
- **Verification gate:** Simulate a `503` response from the health endpoint and confirm the configured on-call notification is triggered.

## Golden Signals, SLIs & SLO Tracking

- [ ]  **Implementation complete**
- **Description:** Define and monitor Service Level Indicators (SLIs) and Service Level Objectives (SLOs) around the Four Golden Signals: Latency (p50, p95, p99), Traffic, Errors, and Saturation.
- **Why it matters:** Simple HTTP pingers miss silent degradations where endpoints respond with 200 OK but suffer severe 10-second latency or partial transaction failure.
- **Key concepts:**
    - Four Golden Signals (Latency, Traffic, Errors, Saturation)
    - Percentile tracking (p95 / p99)
    - Error budget burn alerts
- **Recommended tools:** Prometheus & Grafana / Datadog / OpenTelemetry / CloudWatch
- **Verification gate:** Simulate artificial database latency on an endpoint; verify p99 latency alerts trigger even while basic uptime checks pass.

## Distributed APM & OpenTelemetry Tracing

- [ ]  **Implementation complete**
- **Description:** Instrument microservices, asynchronous workers, and database calls with distributed tracing using standard context propagation headers.
- **Why it matters:** Allows engineers to pinpoint exact cross-service latency bottlenecks and database query stalls during production incidents.
- **Key concepts:**
    - Distributed tracing
    - Context propagation (W3C `traceparent`)
    - Span analysis
- **Recommended tools:** OpenTelemetry / Honeycomb / Datadog APM / Grafana Tempo
- **Verification gate:** Make a request touching multiple backend components and locate its complete end-to-end trace waterfall in the tracing dashboard.

## **On-Call Rotation and Incident Routing (Optional for Startups)**

- [ ]  Implementation complete
- **Description**: Establish clear on-call schedules, escalation paths, and notification routing so production alerts reach the appropriate engineer promptly.
- **Why it matters:** Ensures monitoring alerts aren't lost in silent Slack channels or missed after hours.
    - Key concepts: On-call schedules
    - Escalation policies
    - Alert severity levels
- **Recommended tools:** PagerDuty / Opsgenie / Better Stack incident routing / Slack-Pager integration
- **Verification gate:** Trigger a critical alert in staging and confirm that it pages or notifies the designated on-call engineer within the target SLA.

# 6.  Disaster Recovery(Optional For Startup)

## Automated Database Backups & Point-in-Time Recovery

- [ ]  **Implementation complete**
- **Description:** Configure automated database backups and, where supported, continuous WAL/log archiving for point-in-time recovery.
- **Why it matters:** Enables recovery from data corruption, accidental deletion, and operational mistakes with controlled data loss.
- **Key concepts:**
    - PITR — Point-in-Time Recovery
    - Automated snapshots
    - Offsite backup storage
    - Defined RPO/RTO
- **Recommended tools:** Managed PostgreSQL/MySQL backup systems or equivalent database backup tooling
- **Verification gate:** Perform a restore drill into a test database and verify data integrity.

## Documented Rollback Procedure & One-Click Reverts

- [ ]  **Implementation complete**
- **Description:** Ensure every production deployment can be rolled back safely to the previous stable release artifact.
- **Why it matters:** Fast rollback is one of the most important safeguards for high-velocity deployments.
- **Key concepts:**
    - Immutable artifacts
    - Tagged container images / commit SHAs
    - Fast revert
    - Backward-compatible database migrations
- **Recommended tools:** Deployment-platform rollback / Argo CD / equivalent release tooling
- **Verification gate:** Trigger a rollback in staging and confirm the application returns to the previous stable release within the defined target.