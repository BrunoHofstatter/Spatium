// Optional one-time provisioning helper. Secret values are read only from the
// secure input files passed to this command and are never printed or persisted.
import { readFile } from 'node:fs/promises';
const project = 'pfomcrdvmrrufutppuwl';
const host = `https://${project}.supabase.co`;
const args = process.argv.slice(2);
async function secret(flag) {
  const index = args.indexOf(flag);
  if (index < 0 || !args[index + 1]) throw new Error(`Missing ${flag}`);
  return (await readFile(args[index + 1], 'utf8')).trim();
}
async function request(url, options, label) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok)
    throw new Error(
      `${label} failed (HTTP ${response.status}). No credentials were logged.`,
    );
  return response.status === 204 ? null : response.json();
}
try {
  const accessToken = await secret('--token-file'),
    email = await secret('--email-file'),
    password = await secret('--password-file');
  if (!email.includes('@') || password.length < 12)
    throw new Error(
      'Use a valid login email and a password of at least 12 characters.',
    );
  const management = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
  const api = `https://api.supabase.com/v1/projects/${project}`;
  await request(
    `${api}/config/auth`,
    {
      method: 'PATCH',
      headers: management,
      body: JSON.stringify({
        disable_signup: true,
        external_email_enabled: true,
        external_anonymous_users_enabled: false,
        site_url: 'https://brunohofstatter.github.io/Spatium/',
      }),
    },
    'Authentication configuration',
  );
  const keys = await request(
    `${api}/api-keys?reveal=true`,
    { headers: management },
    'Project key lookup',
  );
  const service =
    keys.find((key) => key.name === 'service_role')?.api_key ??
    keys.find((key) => key.type === 'secret')?.api_key;
  if (!service)
    throw new Error(
      'The management token needs read access to API key secrets to create the app login.',
    );
  const admin = {
    apikey: service,
    Authorization: `Bearer ${service}`,
    'Content-Type': 'application/json',
  };
  const users = await request(
    `${host}/auth/v1/admin/users?page=1&per_page=100`,
    { headers: admin },
    'Account lookup',
  );
  const existing = users.users.find(
    (user) => user.email?.toLowerCase() === email.toLowerCase(),
  );
  if (!existing) {
    if (users.users.length)
      throw new Error(
        'This project already has other users. Choose the intended owner explicitly before automatic setup.',
      );
    await request(
      `${host}/auth/v1/admin/users`,
      {
        method: 'POST',
        headers: admin,
        body: JSON.stringify({ email, password, email_confirm: true }),
      },
      'App account creation',
    );
  }
  const sql = await readFile(
    new URL('../supabase/setup.sql', import.meta.url),
    'utf8',
  );
  await request(
    `${api}/database/query`,
    {
      method: 'POST',
      headers: management,
      body: JSON.stringify({ query: sql }),
    },
    'Database setup',
  );
  const publicKey = 'sb_publishable_nFMnetHp5Ple7CX65PCFWw_mCR1qhmJ';
  const session = await request(
    `${host}/auth/v1/token?grant_type=password`,
    {
      method: 'POST',
      headers: { apikey: publicKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    },
    'Login verification',
  );
  await request(
    `${host}/rest/v1/rpc/spatium_read`,
    {
      method: 'POST',
      headers: {
        apikey: publicKey,
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    },
    'Owner access verification',
  );
  const anonymous = await fetch(`${host}/rest/v1/rpc/spatium_read`, {
    method: 'POST',
    headers: { apikey: publicKey, 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (anonymous.ok)
    throw new Error(
      'Unexpected anonymous access. Inspect the project before enabling sync.',
    );
  await request(
    `${host}/auth/v1/logout?scope=local`,
    {
      method: 'POST',
      headers: {
        apikey: publicKey,
        Authorization: `Bearer ${session.access_token}`,
      },
    },
    'Test session cleanup',
  );
  process.stdout.write(
    'Supabase configured: public signup disabled, app login verified, private storage installed, owner access verified, anonymous access denied.\n',
  );
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : 'Provisioning failed.'}\n`,
  );
  process.exitCode = 1;
}
