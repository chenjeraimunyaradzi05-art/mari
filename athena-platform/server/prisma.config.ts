import 'dotenv/config';
import { defineConfig } from 'prisma/config';
import { applyDatabaseUrlDefaults } from './src/utils/database-url';

const fallbackDatabaseUrl = 'postgresql://postgres:postgres@localhost:5432/athena_dev';
const databaseUrls = applyDatabaseUrlDefaults();
const datasourceUrl = databaseUrls.directDatabaseUrl || databaseUrls.databaseUrl || fallbackDatabaseUrl;

process.env.DATABASE_URL ||= databaseUrls.databaseUrl || datasourceUrl;
process.env.DIRECT_DATABASE_URL ||= datasourceUrl;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: datasourceUrl,
  },
});
