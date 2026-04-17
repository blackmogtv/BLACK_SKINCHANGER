# BLACK_SKINCHANGER KeyAuth Backend

This repo contains the `BLACK_SKINCHANGER` Supabase-backed key system with two edge functions:

- `validate-key`: public validation endpoint for your client
- `manage-keys`: admin endpoint for creating keys, banning them, resetting HWIDs, changing duration, and reading usage data

## Features

- Creates human-readable keys in the format `ABCDE-FGHIJ-KLMNO-PQRST`
- Tracks when a key was created
- Supports lifetime keys or duration-based expiry in days
- Binds a key to an HWID on first successful validation
- Lets you reset the bound HWID
- Lets you ban and unban keys
- Stores a custom note per key
- Tracks whether a key is currently used
- Tracks first use, last use, and last validation time
- Stores recent event history for admin review

## Files That Matter

- `supabase/migrations/20260417_create_licenses.sql`
- `supabase/functions/validate-key/index.ts`
- `supabase/functions/manage-keys/index.ts`
- `.env.example`

## Environment Variables

Copy `.env.example` to `.env` and fill in:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CLIENT_ID`
- `KEYAUTH_ADMIN_TOKEN`

Use a long random string for `KEYAUTH_ADMIN_TOKEN`. The `manage-keys` function requires it in the `x-admin-token` header.

## Local Commands

```powershell
npm run supabase:start
npm run supabase:db:push
npm run supabase:functions:serve
npm run supabase:functions:serve:admin
```

## Deploy

```powershell
npm run supabase:deploy:function
npm run supabase:deploy:function:admin
```

Both functions are configured for `--no-verify-jwt` in this repo. That means:

- `validate-key` is meant to be callable by your public client with the anon key.
- `manage-keys` must be protected by `KEYAUTH_ADMIN_TOKEN` and must never be called from a public client.

## Suggested Admin UI Card Fields

The `manage-keys` response includes a `card` object shaped for a UI like your screenshot:

- `title`
- `status_badge`
- `created`
- `duration`
- `generated_by`
- `used_by`
- `note`
- `used_on`
- `hwid`
