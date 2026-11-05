# Phase 6 deferred items

## From 06-03 (out of scope, found during full API suite run)

- `apps/api/test/cross-tenant.test.ts` > "discovered :ws routes equal CROSS_TENANT_ROUTES keys" fails. The five admin Board routes added by 06-02 are not registered in `CROSS_TENANT_ROUTES`:
  - `POST /workspaces/:ws/products/:product/posts/:number/comments`
  - `PATCH` and `DELETE /workspaces/:ws/products/:product/comments/:id`
  - `PATCH` and `DELETE /workspaces/:ws/products/:product/posts/:number`

  Not caused by 06-03 (no admin route changed). Needs entries in the suite's route table; owner: next plan touching admin Board tests (06-09) or a quick fix.
