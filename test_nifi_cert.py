"""
Quick diagnostic script to test NiFi certificate authentication independently.
Usage:
    python test_nifi_cert.py
Edit the variables in the CONFIG section below as needed.
"""

import ssl
import subprocess
import sys
from pathlib import Path

# ── CONFIG ────────────────────────────────────────────────────────────────────
NIFI_URL   = "https://localhost:8443/nifi-api"
CERT_DIR   = Path("certs")
CA_CERT    = CERT_DIR / "ca_cert.pem"
CLIENT_CERT = CERT_DIR / "client_cert.pem"
CLIENT_KEY  = CERT_DIR / "client_key.pem"
KEY_PASSWORD = None   # Set to a string if the key is password-protected
VERIFY_SSL  = False    # Set False to skip server cert verification
# ─────────────────────────────────────────────────────────────────────────────


def section(title: str):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print('='*60)


def run_openssl(args: list[str], label: str):
    try:
        r = subprocess.run(["openssl"] + args, capture_output=True, text=True, timeout=5)
        output = r.stdout.strip() or r.stderr.strip()
        print(f"  {label}:\n    {output.replace(chr(10), chr(10)+'    ')}")
    except FileNotFoundError:
        print("  openssl not found in PATH — skipping")
    except Exception as e:
        print(f"  openssl error: {e}")


# ── 1. File existence ─────────────────────────────────────────────────────────
section("1. Certificate file existence")
for label, path in [("CA cert", CA_CERT), ("Client cert", CLIENT_CERT), ("Client key", CLIENT_KEY)]:
    exists = path.exists()
    size   = path.stat().st_size if exists else 0
    print(f"  {'✓' if exists else '✗'} {label}: {path}  ({size} bytes)")
    if not exists:
        print(f"    ERROR: file not found!")

# ── 2. Certificate details via openssl ────────────────────────────────────────
section("2. Certificate details (openssl)")
run_openssl(["x509", "-noout", "-subject", "-issuer", "-dates", "-in", str(CLIENT_CERT)], "Client cert")
run_openssl(["x509", "-noout", "-subject", "-dates", "-in", str(CA_CERT)], "CA cert")

# Check that client cert is signed by the CA
section("3. Verify client cert is signed by CA")
run_openssl(["verify", "-CAfile", str(CA_CERT), str(CLIENT_CERT)], "Verification result")

# ── 4. Test with requests ─────────────────────────────────────────────────────
section("4. requests library test")
try:
    import requests
    from requests.packages.urllib3.exceptions import InsecureRequestWarning
    if not VERIFY_SSL:
        requests.packages.urllib3.disable_warnings(InsecureRequestWarning)

    url = f"{NIFI_URL}/flow/status"
    print(f"  GET {url}")
    resp = requests.get(
        url,
        cert=(str(CLIENT_CERT), str(CLIENT_KEY)),
        verify=str(CA_CERT) if VERIFY_SSL else False,
        timeout=10,
    )
    print(f"  HTTP {resp.status_code}")
    if resp.status_code == 200:
        print("  ✓ Connection successful!")
    else:
        print(f"  Response: {resp.text[:300]}")
except requests.exceptions.SSLError as e:
    print(f"  ✗ SSL Error: {e}")
    print("  → NiFi rejected the client cert. Likely cause:")
    print("    - Your CA cert is not in NiFi's truststore (nifi.security.truststorePasswd / truststore.jks)")
    print("    - Or the client cert CN/SAN doesn't match what NiFi expects")
except Exception as e:
    print(f"  ✗ Error: {type(e).__name__}: {e}")

# ── 5. curl command for manual testing ───────────────────────────────────────
section("5. Equivalent curl command (run manually)")
curl_verify = f"--cacert {CA_CERT}" if VERIFY_SSL else "--insecure"
print(f"""  curl -v \\
    --cert {CLIENT_CERT} \\
    --key {CLIENT_KEY} \\
    {curl_verify} \\
    {NIFI_URL}/flow/status""")

# ── 6. nipyapi config attribute inspection ───────────────────────────────────
section("6. nipyapi nifi_config attribute inspection")
try:
    from nipyapi import config
    nifi_cfg = config.nifi_config
    attrs = {a: getattr(nifi_cfg, a, "N/A") for a in dir(nifi_cfg)
             if not a.startswith("_") and ("ssl" in a.lower() or "cert" in a.lower() or "key" in a.lower())}
    for k, v in attrs.items():
        print(f"  {k} = {v!r}")
except ImportError:
    print("  nipyapi not installed in current environment")

print()
