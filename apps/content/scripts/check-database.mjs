import process from 'node:process';
import { Console } from 'node:console';
import pg from 'pg';
import { parseEnvironment } from '../src/config/environment.ts';

const output = new Console(process.stdout, process.stderr);
let client;
try {
  const environment = parseEnvironment(process.env);
  client = new pg.Client({
    connectionString: environment.DATABASE_URL,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 5_000,
    application_name: 'sidequest-connection-check',
  });
  await client.connect();
  await client.query('BEGIN READ ONLY');
  const { rows } = await client.query(
    "SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public' ORDER BY tablename",
  );
  await client.query('COMMIT');
  output.log('PostgreSQL connection: OK (read-only check).');
  output.log('Public tables:', rows.map((row) => row.tablename).join(', ') || '(empty)');
} catch (error) {
  if (error instanceof Error && error.message.startsWith('Invalid content environment:')) {
    output.error(error.message);
  }
  // Do not print connection strings, credentials, or raw driver errors.
  const code =
    error && typeof error === 'object' && 'code' in error ? error.code : 'CONFIG_OR_CONNECTION';
  output.error('PostgreSQL check failed. Error code:', code);
  process.exitCode = 1;
} finally {
  await client?.end();
}
