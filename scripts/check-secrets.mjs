import { execFileSync } from 'node:child_process';

// Never print matching values: diagnostics must not leak the credentials they detect.
const patterns = [
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----/],
  ['Google OAuth client secret', /GOCSPX-[A-Za-z0-9_-]{20,}/],
  ['Google OAuth refresh token', /1\/\/[A-Za-z0-9_-]{40,}/],
  ['GitHub token', /(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})/],
  ['AWS access key', /(?:AKIA|ASIA)[A-Z0-9]{16}/],
  ['service account credential', /"type"\s*:\s*"service_account"/],
  ['Google API key', /AIza[0-9A-Za-z_-]{35}/],
  ['Slack token', /xox[baprs]-[A-Za-z0-9-]{20,}/],
];
const git = (...args) => execFileSync('git', args, { maxBuffer: 64 * 1024 * 1024 });
const staged = process.argv.includes('--staged');
const history = process.argv.includes('--history');
const refs = history ? git('rev-list', '--all').toString().trim().split('\n') : [staged ? ':' : 'HEAD'];
let failures = 0;
const seen = new Set();
for (const ref of refs) {
  const files = staged ? git('ls-files', '-z').toString().split('\0') : git('ls-tree', '-r', '--name-only', '-z', ref).toString().split('\0');
  for (const file of files.filter(Boolean)) {
    if (/\.(?:otf|ttf|png|jpg|jpeg|woff2?)$/.test(file)) continue;
    let bytes;
    try { bytes = git('show', `${staged ? ':' : ref + ':'}${file}`); } catch { continue; }
    const content = bytes.toString();
    // Firebase's browser config is public, not an authorization credential.
    // Allow only the apiKey property in this one JSON file; scan every other field.
    let scanContent = content;
    if (file === 'src/firebase-config.json') {
      try {
        const config = JSON.parse(content);
        if (config.projectId === 'daymark-dakotacsk') {
          delete config.apiKey;
          scanContent = JSON.stringify(config);
        }
      } catch { /* Invalid JSON receives no exemption. */ }
    }
    for (const [type, pattern] of patterns) {
      if (!pattern.test(scanContent)) continue;
      const id = `${file}:${type}`;
      if (seen.has(id)) continue;
      seen.add(id);
      console.error(`${file}: potential ${type}`);
      failures++;
    }
  }
}
if (failures) process.exitCode = 1;
else console.log('No matching credential patterns found.');
