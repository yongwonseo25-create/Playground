import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { POST as feedbackPost } from '../app/api/v1/ssce/feedback/route';
import { POST as generatePost } from '../app/api/v1/ssce/generate/route';
import { POST as harvestPost } from '../app/api/v1/ssce/harvest/route';
import { getSscePrismaClient, resetSsceDatabase } from '../db/ssce-prisma';

const prisma = getSscePrismaClient();

function buildHarvestPayload() {
  return {
    workspace_id: 'workspace-alpha',
    destination_key: 'gmail',
    recipient_key: 'ceo@voxera.ai',
    task_key: 'weekly-brief',
    source_artifact: {
      external_id: 'artifact-ref-1',
      title: 'Approved email',
      content: 'Keep the executive summary short and lead with the KPI delta.',
      content_format: 'markdown' as const,
      artifact_kind: 'reference' as const,
      structure_outline: ['subject', 'summary', 'next steps'],
      metadata: {
        language: 'en'
      }
    },
    related_artifacts: [
      {
        external_id: 'artifact-ref-2',
        title: 'Previous weekly brief',
        content: 'Use numbered actions and close with owner + deadline.',
        content_format: 'markdown' as const,
        artifact_kind: 'reference' as const,
        structure_outline: ['summary', 'actions'],
        metadata: {}
      }
    ],
    content_signals: [
      {
        trait_key: 'tone.executive',
        evidence: 'Direct and compressed.',
        weight: 0.9
      },
      {
        trait_key: 'format.numbered_actions',
        evidence: 'Actions appear as an ordered list.',
        weight: 0.7
      }
    ],
    reference_links: [
      {
        target_artifact_external_id: 'artifact-ref-2',
        edge_type: 'references' as const,
        weight: 0.8,
        rationale: 'Primary precedent'
      }
    ]
  };
}

function jsonRequest(url: string, payload: unknown) {
  return new Request(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
}

async function readJson(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

describe('SSCE HTTP routes', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    await resetSsceDatabase(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('harvest happy-path compounds four scope signatures', async () => {
    const response = await harvestPost(jsonRequest('http://localhost/api/v1/ssce/harvest', buildHarvestPayload()));
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect((body.harvested_signatures as unknown[]).length).toBe(4);
    expect(body.linked_reference_edges).toBe(1);
    expect(await prisma.artifact.count()).toBe(2);
    expect(await prisma.styleSignature.count()).toBe(4);
  });

  it('harvest validation failure returns explicit Zod issues', async () => {
    const payload = {
      ...buildHarvestPayload(),
      workspace_id: '   ',
      content_signals: []
    };
    const response = await harvestPost(jsonRequest('http://localhost/api/v1/ssce/harvest', payload));
    const body = await readJson(response);

    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
    expect((body.error as { code: string }).code).toBe('SSCE_HARVEST_INVALID');
  });

  it('harvest edge-case rejects missing reference targets', async () => {
    const payload = buildHarvestPayload();
    payload.reference_links[0] = {
      ...payload.reference_links[0],
      target_artifact_external_id: 'missing-ref'
    };

    const response = await harvestPost(jsonRequest('http://localhost/api/v1/ssce/harvest', payload));
    const body = await readJson(response);

    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
  });

  it('generate happy-path returns a generated draft with applied signatures', async () => {
    await harvestPost(jsonRequest('http://localhost/api/v1/ssce/harvest', buildHarvestPayload()));

    const response = await generatePost(
      jsonRequest('http://localhost/api/v1/ssce/generate', {
        workspace_id: 'workspace-alpha',
        destination_key: 'gmail',
        recipient_key: 'ceo@voxera.ai',
        task_key: 'weekly-brief',
        prompt: 'Draft the next weekly brief.',
        artifact_title: 'Weekly brief draft',
        desired_format: 'markdown'
      })
    );
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect((body.generated_draft as { artifact_kind: string }).artifact_kind).toBe('generated_draft');
    expect((body.applied_signatures as unknown[]).length).toBeGreaterThanOrEqual(1);
    expect(await prisma.artifact.count({ where: { artifactKind: 'generated_draft' } })).toBe(1);
  });

  it('generate validation failure rejects empty prompts', async () => {
    const response = await generatePost(
      jsonRequest('http://localhost/api/v1/ssce/generate', {
        workspace_id: 'workspace-alpha',
        prompt: '   '
      })
    );
    const body = await readJson(response);

    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
  });

  it('generate edge-case allows empty signature history and falls back to prompt-only mode', async () => {
    const response = await generatePost(
      jsonRequest('http://localhost/api/v1/ssce/generate', {
        workspace_id: 'workspace-empty',
        destination_key: 'slack',
        prompt: 'Draft a prompt-only artifact.'
      })
    );
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect((body.applied_signatures as unknown[]).length).toBe(0);
    expect((body.compound_summary as string[])[0]).toMatch(/prompt-only/i);
  });

  it('feedback happy-path creates diff summary and updates signatures', async () => {
    await harvestPost(jsonRequest('http://localhost/api/v1/ssce/harvest', buildHarvestPayload()));
    const generateResponse = await generatePost(
      jsonRequest('http://localhost/api/v1/ssce/generate', {
        workspace_id: 'workspace-alpha',
        destination_key: 'gmail',
        recipient_key: 'ceo@voxera.ai',
        task_key: 'weekly-brief',
        prompt: 'Draft the next weekly brief.',
        artifact_title: 'Weekly brief draft',
        desired_format: 'markdown'
      })
    );
    const generatedBody = await readJson(generateResponse);

    const response = await feedbackPost(
      jsonRequest('http://localhost/api/v1/ssce/feedback', {
        workspace_id: 'workspace-alpha',
        destination_key: 'gmail',
        recipient_key: 'ceo@voxera.ai',
        task_key: 'weekly-brief',
        generated_draft: {
          artifact_id: (generatedBody.generated_draft as { id: string }).id,
          title: (generatedBody.generated_draft as { title: string }).title,
          content: (generatedBody.generated_draft as { content: string }).content,
          content_format: (generatedBody.generated_draft as { content_format: string }).content_format,
          structure_outline: (generatedBody.generated_draft as { structure_outline: string[] }).structure_outline,
          metadata: (generatedBody.generated_draft as { metadata: Record<string, unknown> }).metadata
        },
        final_artifact: {
          title: 'Weekly brief final',
          content:
            'Prompt: Draft the next weekly brief. Lead with KPI delta. Use numbered actions. Close with owners and deadlines.',
          content_format: 'markdown',
          structure_outline: ['opening', 'kpi delta', 'actions', 'owners'],
          metadata: {}
        },
        feedback_notes: 'Human editor tightened the CTA and added explicit owners.',
        accepted_reference_artifact_ids: []
      })
    );
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect((body.updated_signature_ids as unknown[]).length).toBeGreaterThanOrEqual(1);
    expect((body.diff_summary as { changed_structure_sections: number }).changed_structure_sections).toBeGreaterThanOrEqual(1);
    expect(await prisma.artifact.count({ where: { artifactKind: 'final_artifact' } })).toBe(1);

    const feedbackEvent = await prisma.styleEvent.findFirst({
      where: { eventType: 'feedback' },
      orderBy: { createdAt: 'desc' }
    });
    const feedbackSnapshot = JSON.parse(feedbackEvent?.payloadSnapshot ?? '{}') as {
      oracle_analysis?: {
        provider?: string;
        lexical_changes?: { added_keywords?: string[] };
        tone_delta?: { primary_shift?: string };
      };
    };
    const oracleProvider = feedbackSnapshot.oracle_analysis?.provider ?? 'missing';

    console.info(
      `[ssce-oracle-test] provider=${oracleProvider} primaryShift=${feedbackSnapshot.oracle_analysis?.tone_delta?.primary_shift ?? 'missing'} addedKeywords=${feedbackSnapshot.oracle_analysis?.lexical_changes?.added_keywords?.join('|') ?? 'none'}`
    );

    if (process.env.GOOGLE_AI_STUDIO_KEY || process.env.GEMINI_API_KEY) {
      expect(oracleProvider).toMatch(/^google-ai-studio-gemini:/);
    } else {
      expect(oracleProvider).toBe('heuristic-oracle-v1');
    }
  }, 30000);

  it('feedback validation failure rejects empty final artifacts', async () => {
    const response = await feedbackPost(
      jsonRequest('http://localhost/api/v1/ssce/feedback', {
        workspace_id: 'workspace-alpha',
        generated_draft: {
          content: 'draft',
          content_format: 'markdown'
        },
        final_artifact: {
          content: '   ',
          content_format: 'markdown'
        }
      })
    );
    const body = await readJson(response);

    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
  });

  it('feedback edge-case handles identical draft/final content with zero diff', async () => {
    const generateResponse = await generatePost(
      jsonRequest('http://localhost/api/v1/ssce/generate', {
        workspace_id: 'workspace-alpha',
        prompt: 'Draft without prior signatures.'
      })
    );
    const generatedBody = await readJson(generateResponse);

    const response = await feedbackPost(
      jsonRequest('http://localhost/api/v1/ssce/feedback', {
        workspace_id: 'workspace-alpha',
        generated_draft: {
          artifact_id: (generatedBody.generated_draft as { id: string }).id,
          title: (generatedBody.generated_draft as { title: string | null }).title,
          content: (generatedBody.generated_draft as { content: string }).content,
          content_format: (generatedBody.generated_draft as { content_format: string }).content_format,
          structure_outline: (generatedBody.generated_draft as { structure_outline: string[] }).structure_outline,
          metadata: (generatedBody.generated_draft as { metadata: Record<string, unknown> }).metadata
        },
        final_artifact: {
          title: (generatedBody.generated_draft as { title: string | null }).title,
          content: (generatedBody.generated_draft as { content: string }).content,
          content_format: (generatedBody.generated_draft as { content_format: string }).content_format,
          structure_outline: (generatedBody.generated_draft as { structure_outline: string[] }).structure_outline,
          metadata: (generatedBody.generated_draft as { metadata: Record<string, unknown> }).metadata
        },
        accepted_reference_artifact_ids: []
      })
    );
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect((body.diff_summary as { added_sentences: number }).added_sentences).toBe(0);
    expect((body.diff_summary as { removed_sentences: number }).removed_sentences).toBe(0);
    expect((body.diff_summary as { changed_structure_sections: number }).changed_structure_sections).toBe(0);
  }, 30000);
});
