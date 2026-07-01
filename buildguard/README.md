# BillGuard app

This folder contains the BillGuard application (frontend, `/api` proxy, and the Modal
`backend.py`).

- **Project overview, setup, and deploy steps:** see the [root README](../README.md).
- **Developer source-of-truth** (architecture, two-stage pipeline, endpoints, secrets, DB,
  run/deploy, gotchas): [CLAUDE.md](./CLAUDE.md).
- **Security model, endpoint contract, rate limits, data handling:** [SECURITY.md](./SECURITY.md).
- **Working checklist / phase log:** [PLAN.md](./PLAN.md).

Quick start (from this folder):

```bash
npm install
npm run dev     # frontend dev server
npm run build   # production build
npm run lint
```
