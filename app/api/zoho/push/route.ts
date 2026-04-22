import { NextRequest } from 'next/server';
import { parseHubSpotWorkflow } from '@/lib/hubspot/parser';
import { buildZohoWorkflow } from '@/lib/zoho/builder';

async function getZohoAccessToken(): Promise<string> {
  const res = await fetch('https://accounts.zohocloud.ca/oauth/v2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: process.env.ZOHO_REFRESH_TOKEN!,
      client_id: process.env.ZOHO_CLIENT_ID!,
      client_secret: process.env.ZOHO_CLIENT_SECRET!,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Failed to get Zoho token: ${JSON.stringify(data)}`);
  return data.access_token;
}

export async function POST(req: NextRequest) {
  const { workflowId } = await req.json();
  if (!workflowId) return Response.json({ error: 'workflowId is required' }, { status: 400 });

  const hubspotRes = await fetch(
    `https://api.hubapi.com/automation/v3/workflows/${workflowId}`,
    { headers: { Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}` } }
  );
  if (!hubspotRes.ok) return Response.json({ error: 'Failed to fetch HubSpot workflow' }, { status: 500 });

  const rawWorkflow = await hubspotRes.json();
  const intermediate = parseHubSpotWorkflow(rawWorkflow);
  const { zohoPayload, manualSteps, summary } = buildZohoWorkflow(intermediate);

  if (!zohoPayload) {
    return Response.json({ success: false, message: 'Nothing could be auto-migrated.', manualSteps, summary });
  }

  const accessToken = await getZohoAccessToken();
  const apiBase = `${process.env.ZOHO_API_DOMAIN}/crm/v8`;

  // Step 1: Create the field update action
  const fieldUpdateRes = await fetch(`${apiBase}/settings/automation/field_updates`, {
    method: 'POST',
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      field_updates: [{
        name: 'Migrated - Set Email Opt Out',
        module: { api_name: 'Contacts' },
        field: { api_name: "Email_Opt_Out", id: "68068000000004029" },
        type: 'static',
        value: true,
      }]
    }),
  });

  const fieldUpdateData = await fieldUpdateRes.json();
  console.log('Field update response:', JSON.stringify(fieldUpdateData));

  if (!fieldUpdateRes.ok) {
    return Response.json({
      error: 'Failed to create Zoho field update action',
      detail: fieldUpdateData,
      manualSteps,
      summary,
    }, { status: 500 });
  }

  const fieldUpdateId = fieldUpdateData.field_updates?.[0]?.details?.id;
  if (!fieldUpdateId) {
    return Response.json({
      error: 'Could not extract field update ID',
      detail: fieldUpdateData,
      manualSteps,
      summary,
    }, { status: 500 });
  }

  // Step 2: Create workflow rule referencing the field update ID
  const rule = zohoPayload.workflow_rules[0];
  rule.conditions[0].instant_actions.actions = [
    { type: 'field_updates', id: fieldUpdateId } as any
  ];

  const zohoRes = await fetch(`${apiBase}/settings/automation/workflow_rules`, {
    method: 'POST',
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(zohoPayload),
  });

  const zohoData = await zohoRes.json();

  if (!zohoRes.ok) {
    return Response.json({ error: 'Zoho workflow API error', detail: zohoData, manualSteps, summary }, { status: zohoRes.status });
  }

  return Response.json({
    success: true,
    message: 'Workflow created in Zoho successfully',
    zohoResponse: zohoData,
    manualSteps,
    summary,
  });
}
