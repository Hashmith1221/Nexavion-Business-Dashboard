export function isMissingDatabaseObject(error) {
  return ["PGRST202", "PGRST205", "42P01", "42883"].includes(error?.code);
}

export const coreSchemaSetupMessage = "The dashboard database schema is not installed or refreshed. Run supabase/schema.sql in the Supabase SQL editor, then retry.";
export const businessSchemaSetupMessage = "The business database schema is not installed or refreshed. Run supabase/schema.sql, then supabase/business-management.sql, in the Supabase SQL editor.";
