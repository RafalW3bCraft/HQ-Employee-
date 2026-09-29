# Persistence Status Audit

This document provides a factual, code-verified audit of data persistence across all backend modules in HQ-Employee.

## Summary Table

| Module | Storage Mechanism | Read Path | Write Path | Postgres Table(s) | Persistence Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Leads** | In-Memory | In-memory array (`LeadsRepository.leads`) | In-memory array mutation | `leads`, `lead_memories` (defined in schema, unlinked) | Process memory only. Resets on restart. |
| **Meetings** | In-Memory with Optional Write Mirror | In-memory array (`MeetingsRepository.meetings`) | In-memory array + async non-blocking `INSERT`/`UPDATE` mirror | `meetings` | Authoritative in-memory. Mirror write to PG on change if DB reachable. Resets on restart. |
| **Calls & Transcripts** | In-Memory with Optional Write Mirror | In-memory array (`CallsRepository.sessions`) | In-memory array + async non-blocking `INSERT`/`UPDATE` mirror | `calls` | Transcripts and session state live in process memory. Mirror write to PG for metadata. Resets on restart. |
| **Audit Log** | In-Memory with Optional Write Mirror | In-memory append-only array (`AuditService.events`) | In-memory array + async non-blocking `INSERT` mirror | `audit_events` | Append-only in memory. Mirror write to PG if reachable. Query methods read from memory. |
| **Approvals** | In-Memory with Optional Write Mirror | In-memory array (`ApprovalsRepository.requests`) | In-memory array + async non-blocking `INSERT`/`UPDATE` mirror | `approvals` | Authoritative in-memory. Mirror write to PG if reachable. Resets on restart. |
| **Company & Interaction Memory** | In-Memory | In-memory maps & objects (`CompanyBrainService`, `InteractionMemoryRepository`) | In-memory mutations | `company_profiles`, `approved_services`, `company_policies` | Process memory only. Pre-seeded with HQ-Employee company profile and services. |
| **Billing & Credit Ledger** | In-Memory | In-memory `Map<string, CreditWallet>` & `Map<string, CreditTransaction>` | In-memory maps with idempotency index | `credit_wallets`, `credit_ledger_transactions` (defined in schema, unlinked) | Authoritative in-memory ledger. Pre-seeded with 1,000 credit welcome grant. Resets on restart. |
| **Proposals** | In-Memory with Optional Write Mirror | In-memory array (`ProposalRepository.proposals`) | In-memory array + async non-blocking `INSERT`/`UPDATE` mirror | `proposals` | Authoritative in-memory. Mirror write to PG if reachable. Resets on restart. |
| **Objectives** | In-Memory with Optional Write Mirror | In-memory array (`ObjectiveEngine.objectives`) | In-memory array + async non-blocking `INSERT`/`UPDATE` mirror | `objectives` | Authoritative in-memory priority queue. Mirror write to PG if reachable. Resets on restart. |
| **Scheduler** | In-Memory | Node.js process timer handles (`AutonomousJobScheduler`) | In-process timer scheduling & state | `autonomous_job_executions` (defined in schema, unlinked) | In-process timer execution. Jobs stop on process exit. |

## Architectural Consequences & Disclosures

1. **State Lifetime**: All authoritative reads and operational state are served from Node.js process memory. When the application container or server restarts, dynamic leads, newly booked meetings, conversation transcripts, and wallet adjustments reset to their initial seed state.
2. **PostgreSQL Role**: SQL migrations 001–006 define complete relational schemas. For modules with mirror writes (meetings, calls, audit, approvals, proposals, objectives), writes are executed via `try { await query(...) } catch {}` so that database disconnects do not crash calls or block real-time voice loops. Reads do not query PostgreSQL on boot.
3. **Cloud Run Constraint**: Because runtime state is process-bound, Cloud Run deployments **must** run as a single instance (`min=max=1`) with `--session-affinity` and `--no-cpu-throttling`. Multi-instance horizontal scaling without shared persistent read/write stores would cause split-brain state between replicas.
