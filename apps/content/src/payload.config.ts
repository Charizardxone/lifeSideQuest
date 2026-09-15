import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { postgresAdapter } from '@payloadcms/db-postgres';
import { buildConfig } from 'payload';
import { Admins } from './collections/Admins';
import { Quests, QuestVersions, AuditLog } from './collections/Quests';
import { DailyQuests, ContentSettings } from './collections/DailyQuests';
import { publicEndpoints } from './endpoints/public';
import { operationsEndpoints } from './endpoints/operations';
import { parseEnvironment } from './config/environment';

const env = parseEnvironment(process.env);
const sourceDirectory = path.dirname(fileURLToPath(import.meta.url));

export default buildConfig({
  secret: env.PAYLOAD_SECRET,
  serverURL: env.CONTENT_SERVER_URL,
  cors: [env.WEB_ORIGIN],
  csrf: [env.CONTENT_SERVER_URL],
  admin: {
    user: Admins.slug,
    importMap: {
      baseDir: sourceDirectory,
      importMapFile: path.resolve(sourceDirectory, 'app/(payload)/admin/importMap.ts'),
    },
    components: { beforeDashboard: ['/components/ContentTools#ContentTools'] },
  },
  collections: [Admins, Quests, QuestVersions, AuditLog, DailyQuests],
  globals: [ContentSettings],
  endpoints: [...publicEndpoints, ...operationsEndpoints],
  db: postgresAdapter({
    pool: { connectionString: env.DATABASE_URL },
    push: false,
    disableCreateDatabase: true,
    migrationDir: path.resolve(sourceDirectory, 'migrations'),
  }),
  graphQL: { disable: true },
  telemetry: false,
  typescript: { outputFile: path.resolve(sourceDirectory, 'payload-types.ts') },
});
