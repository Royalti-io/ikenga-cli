#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "Creating dummy webview package..."
mkdir -p dummy-webview
cat << 'EOF' > dummy-webview/manifest.json
{
  "id": "com.example.webview",
  "name": "Dummy Webview",
  "version": "1.0.0",
  "ikenga_api": "4",
  "kind": "embedded",
  "author": { "name": "Test" },
  "capabilities": {
    "webview": {
      "child_webviews": true,
      "partitions": ["default"],
      "allowed_origins": ["https://example.com", "https://*.example.com"]
    }
  },
  "ui": {
    "routes": [
      {
        "path": "/",
        "kind": "webview",
        "source": "https://example.com",
        "partition": "default"
      }
    ]
  }
}
EOF

cat << 'EOF' > dummy-webview/index.html
<!DOCTYPE html>
<html>
<body><h1>Hello Webview</h1></body>
</html>
EOF

echo "Creating tarball..."
mkdir -p package
cp dummy-webview/manifest.json dummy-webview/index.html package/
tar -czf tarballs/com.example.webview-1.0.0.tgz package/
rm -rf package

echo "Computing tarball integrity..."
HASH=$(shasum -a 512 -b tarballs/com.example.webview-1.0.0.tgz | awk '{print $1}' | xxd -r -p | base64 -w0)
INTEGRITY="sha512-${HASH}"

echo "Creating pkg detail..."
cat << EOF > pkgs/com.example.webview.json
{
  "\$schemaVersion": 1,
  "name": "com.example.webview",
  "updatedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "versions": [
    {
      "version": "1.0.0",
      "publishedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
      "tarball": "file://$(pwd)/tarballs/com.example.webview-1.0.0.tgz",
      "integrity": "${INTEGRITY}",
      "size": $(wc -c < tarballs/com.example.webview-1.0.0.tgz),
      "manifest": $(cat dummy-webview/manifest.json)
    }
  ]
}
EOF

echo "Creating index.json..."
cat << EOF > index.json
{
  "\$schemaVersion": 1,
  "updatedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "pkgs": [
    {
      "name": "com.example.webview",
      "latest": "1.0.0",
      "detail": "file://$(pwd)/pkgs/com.example.webview.json",
      "kind": "webview"
    }
  ]
}
EOF

echo "Generating minisign keys and signing index.json..."
# Generate signing material into a temp dir — never leave a secret key in the
# repo (G-33). Only the pubkey and the signature are kept.
KEYDIR="$(mktemp -d)"
trap 'rm -rf "$KEYDIR"' EXIT
minisign -G -p minising.pub -s "$KEYDIR/minising.key" -W
minisign -S -s "$KEYDIR/minising.key" -m index.json -x index.json.minisig


echo "Test registry created."
echo "Public key:"
cat minising.pub
