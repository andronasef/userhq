# Phase 6 deferred items

## Resolved during 06-04

- `apps/api/test/cross-tenant.test.ts` > "discovered :ws routes equal CROSS_TENANT_ROUTES keys" fails. The five admin Board routes added by 06-02 are not registered in `CROSS_TENANT_ROUTES`:
  - `POST /workspaces/:ws/products/:product/posts/:number/comments`
  - `PATCH` and `DELETE /workspaces/:ws/products/:product/comments/:id`
  - `PATCH` and `DELETE /workspaces/:ws/products/:product/posts/:number`

  Resolved: registered all five routes in the cross-tenant matrix; all 69 tests pass, including foreign-tenant 404 checks for the new endpoints.
