# OIDC Authentication for NiPyAPI — How-To Guide

## Overview

Datenschleuder uses OIDC in two completely separate contexts:

| Context | Who logs in | OIDC Flow | Credentials |
|---|---|---|---|
| **User login** | Human user via browser | Authorization Code Flow | Username + password entered in Keycloak |
| **NiPyAPI backend** | Datenschleuder backend service | Client Credentials Flow | `client_id` + `client_secret` (no user) |

This guide covers the **NiPyAPI backend authentication** — the machine-to-machine flow that allows
the backend to call NiFi APIs on behalf of a service account.

---

## How the Client Credentials Flow Works

```
Datenschleuder Backend                    Keycloak                          NiFi
        │                                     │                               │
        │  POST /realms/{realm}/protocol/     │                               │
        │       openid-connect/token          │                               │
        │  grant_type=client_credentials      │                               │
        │  client_id=oidc                     │                               │
        │  client_secret=...                  │                               │
        │────────────────────────────────────>│                               │
        │                                     │                               │
        │  200 OK { "access_token": "eyJ..." }│                               │
        │<────────────────────────────────────│                               │
        │                                     │                               │
        │  GET /nifi-api/flow/...             │                               │
        │  Authorization: Bearer eyJ...       │                               │
        │────────────────────────────────────────────────────────────────────>│
        │                                     │                               │
        │                                     │  NiFi validates JWT,          │
        │                                     │  extracts identity claim,     │
        │                                     │  checks access policies       │
        │                                     │                               │
        │  200 OK (flow data)                 │                               │
        │<────────────────────────────────────────────────────────────────────│
```

**Key point:** No username or password is involved. Keycloak issues a JWT access token for
the service account associated with the client. NiFi trusts this token because it is signed
by the same Keycloak instance that NiFi is configured to use as its OIDC provider.

---

## The Identity NiFi Sees

NiFi extracts an identity string from the JWT claim and uses it to look up access policies.
Which claim NiFi reads is configured in `nifi.properties`:

```properties
# Default: uses preferred_username claim
nifi.security.user.oidc.claim.identifying.user=preferred_username
```

For a **Client Credentials flow**, Keycloak sets `preferred_username` on the service account
token to:

```
service-account-{client_id}
```

**Example:** With `client_id: "oidc"`, NiFi sees the identity: **`service-account-oidc`**

This is the string you must register in NiFi's user management.

---

## Step 1: Configure Keycloak

### 1.1 Create a Realm (if needed)

The `nifi_backend` provider in `config/oidc_providers.yaml` uses a dedicated realm (e.g. `oidc`).
You can reuse an existing realm or create a new one.

In Keycloak Admin Console:
- **Realm Settings** → name it (e.g. `oidc`)

### 1.2 Create the Client

1. Navigate to **Clients** → **Create client**
2. Set **Client ID** — this becomes the service account name (`service-account-{client_id}`)
   - Example: `oidc` → service account identity will be `service-account-oidc`
   - Use a descriptive name like `datenschleuder-nifi` for clarity
3. **Client authentication**: ON (makes it a confidential client)
4. **Access Settings**
   - Root URL: https://localhost:8443
   - Home URL: https://localhost:8443/
   - Valid Redirect URIs: https://localhost:8443/nifi-api/access/oidc/callback
   - Valid post logout redirect URIs: https://localhost:8443/nifi-api/access/oidc/logoutCallback
   - Web origins: https://localhost:8443/*
5. **Authentication flow**:
   - Disable **Standard flow** (no browser redirect needed)
   - Disable **Direct access grants**
   - Enable **Service accounts roles** (this is what enables Client Credentials)
6. Save the client

### 1.3 Copy the Client Secret

After saving:
- Go to the **Credentials** tab
- Copy the **Client secret** — paste it into `oidc_providers.yaml` as `client_secret`

### 1.4 Configure the Service Account User (the "username")

The service account is a real Keycloak user that you can view and edit:

1. Navigate to **Clients** → your client → **Service accounts roles** tab
2. Click the link **"Service account user"** (or go to **Users** and search for `service-account-{client_id}`)
3. Here you can:
   - Edit the **First name**, **Last name**, **Email** of the service account
   - These do NOT affect the identity NiFi sees (that comes from `preferred_username`)

### 1.5 Customize the Identity String (Optional)

If you want NiFi to see a different identity than `service-account-oidc`, add a
**Protocol Mapper** on the client to override `preferred_username`:

1. Go to **Clients** → your client → **Client scopes** tab
2. Click the dedicated scope link (e.g. `oidc-dedicated`)
3. **Add mapper** → **By configuration** → **User Attribute** or **Hardcoded claim**
4. To set a fixed identity string:
   - Mapper type: **Hardcoded claim**
   - Token claim name: `preferred_username`
   - Claim value: `nifi-datenschleuder` (or whatever you want NiFi to see)
   - Add to access token: ON
5. Save

**After this, NiFi will see `nifi-datenschleuder` as the identity** — register this string in NiFi.

Alternatively, use a **User Attribute** mapper to read the identity from the service account's
user profile attributes (set in step 1.4).

### 1.6 Verify the Token (Optional but Recommended)

Test the token endpoint directly to see exactly what NiFi will receive:

```bash
curl -k -X POST \
  https://keycloak:7443/realms/oidc/protocol/openid-connect/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -d "client_id=oidc" \
  -d "client_secret=YOUR_SECRET"
```

Decode the `access_token` at [jwt.io](https://jwt.io) and check:
- `preferred_username` — this is what NiFi will use as the identity (with default config)
- `sub` — the internal UUID, also usable as identity

---

## Step 2: Configure NiFi

### 2.1 Enable OIDC in nifi.properties

NiFi must be pointed at the same Keycloak realm:

```properties
nifi.security.user.oidc.discovery.url=https://keycloak:7443/realms/oidc/.well-known/openid-configuration
nifi.security.user.oidc.client.id=nifi          # NiFi's own client (for browser login)
nifi.security.user.oidc.client.secret=...
nifi.security.user.oidc.claim.identifying.user=preferred_username
```

Note: `nifi.security.user.oidc.client.id` is NiFi's own OAuth client (for the NiFi UI browser login),
which is **different** from the Datenschleuder client used for backend API calls.

### 2.2 Register the Service Account Identity in NiFi

NiFi's policy engine requires the identity to be pre-registered. Two ways:

**Option A: NiFi UI (recommended for initial setup)**

1. Log into NiFi as admin
2. Top-right hamburger menu → **Users**
3. Click the **+** button → **Add User**
4. Enter the identity exactly: `service-account-oidc` (or your custom value from step 1.5)
5. Save

**Option B: NiPyAPI (automated)**

```python
import nipyapi
from nipyapi import security

# After configuring nipyapi with admin credentials...
security.create_service_user(identity="service-account-oidc", service="nifi")
```

### 2.3 Assign Access Policies

After creating the user, assign the required policies in NiFi:

1. In NiFi UI → **Policies** (lock icon on the canvas)
2. For each required resource/action:
   - Select the policy (e.g. **read** on **process groups**)
   - Add the user `service-account-oidc`

Or use `nipyapi.security.bootstrap_security_policies()` to grant standard policies automatically.

---

## Step 3: Configure Datenschleuder

### 3.1 oidc_providers.yaml

Add or edit the `nifi_backend` provider entry:

```yaml
providers:
  nifi_backend:
    enabled: true
    backend: true                  # Hides this provider from the user login page

    discovery_url: "https://keycloak:7443/realms/oidc/.well-known/openid-configuration"
    client_id: "oidc"              # Must match the Keycloak client ID from step 1.2
    client_secret: "YOUR_SECRET"   # From step 1.3

    redirect_uri: ""               # Not used for Client Credentials flow

    name: "NiFi Backend Service"
    scopes:
      - openid

    # If Keycloak uses a self-signed certificate:
    ca_cert_path: "config/certs/nifi-ca.cert.pem"
```

### 3.2 Assign Provider to NiFi Instance

In the Datenschleuder UI → **Settings** → **NiFi Instances** → edit an instance:
- Set **OIDC Provider** to `nifi_backend`
- Leave username/password empty

---

## Troubleshooting

### Find the Exact Identity NiFi Sees

Check the NiFi application log:

```bash
tail -f /opt/nifi/logs/nifi-app.log | grep -i "identity\|authorized\|denied"
```

When a request comes in with an unknown identity, NiFi logs something like:
```
Unknown user with identity [service-account-oidc]
```

This tells you the exact string to register.

### Token Request Fails (401 / 400)

- Verify `client_id` and `client_secret` match exactly what's in Keycloak
- Confirm **Service accounts roles** is enabled on the Keycloak client
- Check that the realm in `discovery_url` is correct
- If using self-signed certs, ensure `ca_cert_path` points to the correct CA bundle

### Token Issued but NiFi Returns 403

- The identity was found in NiFi but lacks the required policy
- Go to NiFi UI → check the user's assigned policies
- Run `bootstrap_security_policies()` via NiPyAPI to auto-create standard policies

### Token Issued but NiFi Returns 401 / "Unknown user"

- The identity extracted from the JWT does not exist in NiFi's user list
- Decode the JWT and check `preferred_username`
- Register that exact string as a user in NiFi (step 2.2)

### SSL Certificate Errors

```
SSLError: certificate verify failed
```

- Obtain the Keycloak CA certificate in PEM format
- Place it in `config/certs/` (use `config/certs/convert-cert.sh` if needed)
- Set `ca_cert_path: "config/certs/your-ca.cert.pem"` in `oidc_providers.yaml`
- Or set `verify_ssl: false` on the NiFi instance (development only)

---

## Summary: Identity Ownership

| What | Who controls it |
|---|---|
| `service-account-{client_id}` default identity | Keycloak — derived from `client_id` |
| Custom identity string | You — via Protocol Mapper on the Keycloak client |
| Which JWT claim NiFi reads | NiFi — `nifi.security.user.oidc.claim.identifying.user` |
| Whether that identity is authorized | NiFi — user must exist and have policies assigned |

The recommended workflow is:
1. Decide on a descriptive `client_id` in Keycloak (e.g. `datenschleuder-nifi`)
2. The identity becomes `service-account-datenschleuder-nifi`
3. Register exactly that string in NiFi
4. Assign the required access policies to that user
