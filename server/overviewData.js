import { coreSchemaSetupMessage, isMissingDatabaseObject } from "./databaseErrors.js";

function isMissingTable(error, table) {
  if (!error) return false;
  return isMissingDatabaseObject(error) && (
    !error.message
    || error.message.includes(`public.${table}`)
    || error.message.includes(`'${table}'`)
  );
}

async function getEvents(client, userId, startDate) {
  const { data, error } = await client
    .from("dashboard_usage")
    .select("id,user_name,user_email,dashboard_name,action,device,duration_seconds,created_at")
    .eq("user_id", userId)
    .gte("created_at", startDate)
    .order("created_at", { ascending: false })
    .limit(10000);
  if (isMissingTable(error, "dashboard_usage")) {
    return {
      events: [],
      missingTable: "dashboard_usage",
    };
  }
  if (error) throw new Error(`Supabase query failed: ${error.message}`);
  return { events: data || [], missingTable: "" };
}

async function getSalesData(client, userId) {
  const opportunitiesResult = await client
    .from("sales_opportunities")
    .select("id,company_name,stage,amount,profit_amount,loss_amount,owner_name,owner_email,created_at,closed_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(2000);
  if (isMissingTable(opportunitiesResult.error, "sales_opportunities")) {
    return {
      opportunities: [],
      missingTable: "sales_opportunities",
    };
  }
  if (opportunitiesResult.error) throw new Error(`Supabase sales pipeline query failed: ${opportunitiesResult.error.message}`);
  return {
    opportunities: opportunitiesResult.data || [],
    missingTable: "",
  };
}

export async function loadOverviewData(client, userId, startDate) {
  const [eventResult, sales] = await Promise.all([
    getEvents(client, userId, startDate),
    getSalesData(client, userId),
  ]);
  return {
    events: eventResult.events,
    sales,
    warnings: [eventResult.missingTable, sales.missingTable].filter(Boolean).length
      ? [`${coreSchemaSetupMessage} Missing tables: ${[eventResult.missingTable, sales.missingTable].filter(Boolean).join(", ")}.`]
      : [],
  };
}
