# KeyAuth API

## Public Validation Endpoint

`POST /functions/v1/validate-key`

### Request

```json
{
  "client_id": "YOUR_PRODUCT_ID",
  "license_key": "ABCDE-FGHIJ-KLMNO-PQRST",
  "hwid": "user-device-id",
  "user_label": "optional display name",
  "bind_on_first_use": true
}
```

### Responses

Valid and just bound:

```json
{
  "status": "valid",
  "message": "License valid and bound to this HWID",
  "bound_now": true,
  "key": {
    "license_key": "ABCDE-FGHIJ-KLMNO-PQRST",
    "status": "used"
  }
}
```

Valid on the same HWID:

```json
{
  "status": "valid",
  "message": "License valid for this HWID",
  "bound_now": false
}
```

Rejected:

```json
{ "status": "invalid", "message": "Invalid license key" }
{ "status": "invalid_product", "message": "Unknown or inactive product" }
{ "status": "banned", "message": "This key has been banned" }
{ "status": "expired", "message": "This key has expired" }
{ "status": "hwid_mismatch", "message": "Key is locked to another device" }
```

List products:

```json
{
  "action": "list_products"
}
```

Create or update a product:

```json
{
  "action": "create_product",
  "client_id": "BLACK_MACRO",
  "display_name": "BLACK_MACRO",
  "description": "Macro product",
  "is_active": true
}
```

## Admin Management Endpoint

`POST /functions/v1/manage-keys`

Allowed auth methods:

```http
x-admin-token: <KEYAUTH_ADMIN_TOKEN>
Authorization: Bearer <SUPABASE_USER_JWT>
```

For Lovable, use Supabase Auth and the `Authorization` header. The user email must be listed in `KEYAUTH_ADMIN_EMAILS`.

### Supported Actions

Create keys:

```json
{
  "action": "create_keys",
  "client_id": "YOUR_PRODUCT_ID",
  "quantity": 5,
  "duration_value": 30,
  "duration_unit": "days",
  "created_by": "YOUR_PRODUCT_ID",
  "note": "March batch",
  "actor": "owner"
}
```

Supported duration units:

- `"hours"`
- `"days"`
- `"weeks"`
- `"months"`
- `"years"`
- `"lifetime"` or `null`

Legacy compatibility:

- `duration_days` is still accepted and is treated as `duration_value + duration_unit = "days"`.
- Lifetime keys can omit all duration fields or send `duration_unit: "lifetime"`.

List keys:

```json
{
  "action": "list_keys",
  "client_id": "YOUR_PRODUCT_ID",
  "search": "part of key, note, hwid, or user label",
  "limit": 25,
  "offset": 0
}
```

Get one key with event history:

```json
{
  "action": "get_key",
  "client_id": "YOUR_PRODUCT_ID",
  "license_key": "ABCDE-FGHIJ-KLMNO-PQRST"
}
```

Ban a key:

```json
{
  "action": "ban_key",
  "client_id": "YOUR_PRODUCT_ID",
  "license_key": "ABCDE-FGHIJ-KLMNO-PQRST",
  "banned_reason": "chargeback",
  "actor": "owner"
}
```

Unban a key:

```json
{
  "action": "unban_key",
  "client_id": "YOUR_PRODUCT_ID",
  "license_key": "ABCDE-FGHIJ-KLMNO-PQRST",
  "actor": "owner"
}
```

Reset HWID:

```json
{
  "action": "reset_hwid",
  "client_id": "YOUR_PRODUCT_ID",
  "license_key": "ABCDE-FGHIJ-KLMNO-PQRST",
  "actor": "owner"
}
```

Update note:

```json
{
  "action": "update_note",
  "client_id": "YOUR_PRODUCT_ID",
  "license_key": "ABCDE-FGHIJ-KLMNO-PQRST",
  "note": "customer switched PCs",
  "actor": "owner"
}
```

Change duration:

```json
{
  "action": "set_duration",
  "client_id": "YOUR_PRODUCT_ID",
  "license_key": "ABCDE-FGHIJ-KLMNO-PQRST",
  "duration_value": 12,
  "duration_unit": "hours",
  "actor": "owner"
}
```

Delete a key:

```json
{
  "action": "delete_key",
  "client_id": "YOUR_PRODUCT_ID",
  "license_key": "ABCDE-FGHIJ-KLMNO-PQRST",
  "actor": "owner"
}
```
