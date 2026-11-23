export async function parseJsonResponse(response, requestLabel = "The request") {
  const body = await response.text();
  if (!body.trim()) {
    throw new Error(`${requestLabel} returned an empty response (HTTP ${response.status}). Please try again.`);
  }

  let result;
  try {
    result = JSON.parse(body);
  } catch {
    const responseKind = response.ok ? "invalid JSON" : "a non-JSON response";
    throw new Error(`${requestLabel} returned ${responseKind} (HTTP ${response.status}). Please try again.`);
  }

  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw new Error(`${requestLabel} returned an unexpected response (HTTP ${response.status}). Please try again.`);
  }
  return result;
}
