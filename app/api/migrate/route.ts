import { NextRequest } from 'next/server';
import { parseHubSpotWorkflow } from '@/lib/hubspot/parser';
import { buildZohoWorkflow } from '@/lib/zoho/builder';

export async function GET(req: NextRequest) {
  const workflowId = req.nextUrl.searchParams.get('workflowId');

  if (!workflowId) {
    return Response.json({ error: 'workflowId query param is required' }, { status: 400 });
  }

  const hubspotRes = await fetch(
    `https://api.hubapi.com/automation/v3/workflows/${workflowId}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
      },
    }
  );

  if (!hubspotRes.ok) {
    const error = await hubspotRes.text();
    return Response.json(
      { error: `HubSpot API error: ${hubspotRes.status}`, detail: error },
      { status: hubspotRes.status }
    );
  }

  const rawWorkflow = await hubspotRes.json();
  const intermediate = parseHubSpotWorkflow(rawWorkflow);
  const migrationResult = buildZohoWorkflow(intermediate);

  return Response.json({
    hubspot: { id: rawWorkflow.id, name: rawWorkflow.name },
    intermediate,
    zohoPayload: migrationResult.zohoPayload,
    manualSteps: migrationResult.manualSteps,
    summary: migrationResult.summary,
  });
}
