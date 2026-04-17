# KeyAuth API

## Public Validation Endpoint

`POST /functions/v1/validate-key`

### Request

```json
{
  "client_id": "BLACK_TRIGGERBOT",
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
{ "status": "banned", "message": "This key has been banned" }
{ "status": "expired", "message": "This key has expired" }
{ "status": "hwid_mismatch", "message": "Key is locked to another device" }
```

## Admin Management Endpoint

`POST /functions/v1/manage-keys`

Required header:

```http
x-admin-token: <KEYAUTH_ADMIN_TOKEN>
```

### Supported Actions

Create keys:

```json
{
  "action": "create_keys",
  "client_id": "BLACK_TRIGGERBOT",
  "quantity": 5,
  "duration_days": 30,
  "created_by": "BLACK_TRIGGERBOT",
  "note": "March batch",
  "actor": "owner"
}
```

List keys:

```json
{
  "action": "list_keys",
  "client_id": "BLACK_TRIGGERBOT",
  "limit": 25,
  "offset": 0
}
```

Get one key with event history:

```json
{
  "action": "get_key",
  "client_id": "BLACK_TRIGGERBOT",
  "license_key": "ABCDE-FGHIJ-KLMNO-PQRST"
}
```

Ban a key:

```json
{
  "action": "ban_key",
  "client_id": "BLACK_TRIGGERBOT",
  "license_key": "ABCDE-FGHIJ-KLMNO-PQRST",
  "banned_reason": "chargeback",
  "actor": "owner"
}
```

Unban a key:

```json
{
  "action": "unban_key",
  "client_id": "BLACK_TRIGGERBOT",
  "license_key": "ABCDE-FGHIJ-KLMNO-PQRST",
  "actor": "owner"
}
```

Reset HWID:

```json
{
  "action": "reset_hwid",
  "client_id": "BLACK_TRIGGERBOT",
  "license_key": "ABCDE-FGHIJ-KLMNO-PQRST",
  "actor": "owner"
}
```

Update note:

```json
{
  "action": "update_note",
  "client_id": "BLACK_TRIGGERBOT",
  "license_key": "ABCDE-FGHIJ-KLMNO-PQRST",
  "note": "customer switched PCs",
  "actor": "owner"
}
```

Change duration:

```json
{
  "action": "set_duration",
  "client_id": "BLACK_TRIGGERBOT",
  "license_key": "ABCDE-FGHIJ-KLMNO-PQRST",
  "duration_days": 90,
  "actor": "owner"
}
```
