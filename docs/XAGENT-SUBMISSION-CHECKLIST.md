# X-Agent Submission Checklist — SignalForge

SignalForge targets the **Open Innovation** track. OlaXBT Nexus MCP is therefore not a hard requirement for this entry.

This file is a packaging checklist, not a submission receipt. Do not replace placeholders with fabricated evidence.

## 1. Freeze the review commit

- [ ] Merge the judge-ready branch only after backend + frontend quality gates pass.
- [ ] Record the exact 40-character commit that will be deployed.
- [ ] Keep `ALLOW_MOCK_FALLBACK=false`.
- [ ] Keep public alerts disabled unless ownership/persistence is completed.

## 2. Deploy the exact reviewed commit

Required evidence:

- [ ] Public API origin is reachable during the review window.
- [ ] Public web/judge origin is reachable.
- [ ] `GET /health` returns `status: ok` and the exact reviewed commit.
- [ ] `GET /.well-known/xagent-verification.json` returns `slug: signalforge` and the same commit.
- [ ] `/judge` loads the same-origin proof calls successfully.

Do not populate deployment URLs here until the actual deployment exists.

## 3. Verification calls

Run and save the exact responses:

```bash
curl https://YOUR_REAL_HOST/health
curl https://YOUR_REAL_HOST/.well-known/xagent-verification.json
curl https://YOUR_REAL_HOST/api/v1/decision/BTC
curl https://YOUR_REAL_HOST/api/v1/decision/BTC/delta
curl "https://YOUR_REAL_HOST/api/v1/validation/BTC?period_days=120&horizon_days=3"
```

- [ ] Save responses under the official submission package's `verification/` directory.
- [ ] Redact no evidence needed by the reviewer.
- [ ] Never commit secrets or private credentials.

## 4. Official archive package

The X-Agent submission repository requires one project directory containing:

```text
submissions/mcp-hackathon/<team>-signalforge/
├── SUBMISSION.md
├── submission.json
├── RIGHTS.md
├── source/
└── verification/
    └── README.md
```

Before opening the official PR:

- [ ] Copy the **complete reviewed source** into `source/`.
- [ ] Include lockfiles and dependency manifests.
- [ ] Include configuration examples with no secrets.
- [ ] Declare Binance as an external public-data dependency.
- [ ] Declare the exact public repository and review commit.
- [ ] Declare the actual API/health URLs only after deployment.
- [ ] Complete the rights/archive authorization truthfully.

An external repository link alone is not sufficient for the official archive.

## 5. Capability statement

Recommended concise framing:

> SignalForge is an evidence-bound crypto market decision layer for agents. It converts live public market data into confidence-gated Decision Packets with explicit provenance, supporting and contradicting evidence, invalidation conditions, material-change detection, and no autonomous execution authority.

Avoid claiming:

- five statistically independent signals
- guaranteed trading performance
- full five-signal historical validation
- autonomous execution authority
- synthetic data as live market evidence

## 6. Final judge gate

Do not mark the project submission-ready until all are true:

- [ ] backend lint
- [ ] backend format check
- [ ] backend tests
- [ ] frontend lint
- [ ] TypeScript check
- [ ] frontend production build
- [ ] public deployment reachable
- [ ] exact commit binding verified
- [ ] Decision Packet call verified
- [ ] Delta call verified
- [ ] Validation Lab call verified
- [ ] source archive complete
- [ ] rights declaration complete

Only then convert the project PR from draft to ready and package the official X-Agent submission.
