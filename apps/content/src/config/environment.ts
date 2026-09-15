import { z } from 'zod';

const originSchema = z.url().refine((value) => {
  if (!URL.canParse(value)) return false;
  const url = new URL(value);
  return ['http:', 'https:'].includes(url.protocol) && url.origin === value;
}, 'Must be an HTTP(S) origin without path or trailing slash');

const environmentSchema = z.object({
  DATABASE_URL: z
    .url()
    .refine(
      (value) =>
        URL.canParse(value) && ['postgres:', 'postgresql:'].includes(new URL(value).protocol),
    ),
  PAYLOAD_SECRET: z
    .string()
    .min(32)
    .refine((value) => !value.startsWith('REPLACE_')),
  CONTENT_SERVER_URL: originSchema,
  WEB_ORIGIN: originSchema,
});

export function parseEnvironment(input: Record<string, string | undefined>) {
  const result = environmentSchema.safeParse(input);
  if (!result.success) {
    const fields = [...new Set(result.error.issues.map((issue) => issue.path.join('.')))];
    // Report field names only. URLs may contain database credentials.
    throw new Error(
      `Invalid content environment: ${fields.join(', ')}. See apps/content/.env.example.`,
    );
  }
  return result.data;
}
