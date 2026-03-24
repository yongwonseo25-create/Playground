import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import {
  diffSummarySchema,
  feedbackArtifactSchema,
  scopeContextSchema,
  traitSignalSchema,
  type FeedbackArtifact,
  type ScopeContext,
  type SsceScopeType,
  type TraitSignal
} from '@adapter/validators/ssce-zod';

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'has',
  'have',
  'in',
  'into',
  'is',
  'it',
  'of',
  'on',
  'or',
  'that',
  'the',
  'their',
  'this',
  'to',
  'we',
  'with',
  'you',
  'your'
]);

const IMPERATIVE_STARTERS = new Set([
  'add',
  'align',
  'capture',
  'close',
  'cut',
  'define',
  'draft',
  'focus',
  'highlight',
  'keep',
  'lead',
  'list',
  'note',
  'outline',
  'share',
  'show',
  'state',
  'summarize',
  'tighten',
  'use'
]);

const ACTION_WORDS = new Set([
  'act',
  'add',
  'assign',
  'close',
  'commit',
  'deliver',
  'drive',
  'execute',
  'highlight',
  'lead',
  'list',
  'move',
  'own',
  'ship',
  'show',
  'tighten'
]);

const WARM_WORDS = new Set(['appreciate', 'glad', 'please', 'support', 'thanks', 'thank', 'welcome']);
const FORMAL_WORDS = new Set([
  'accordingly',
  'aligned',
  'ensure',
  'executive',
  'objective',
  'regarding',
  'summary',
  'therefore'
]);
const HEDGE_WORDS = new Set(['could', 'maybe', 'might', 'perhaps', 'possibly']);
const URGENT_WORDS = new Set(['asap', 'deadline', 'immediately', 'now', 'today', 'urgent']);
const ANALYTICAL_WORDS = new Set([
  'churn',
  'conversion',
  'delta',
  'forecast',
  'growth',
  'kpi',
  'metric',
  'roi',
  'trend'
]);
const CONTRACTION_PATTERN = /\b(?:can't|won't|don't|isn't|it's|we're|they're|you're|i'm|that's|there's)\b/gi;

const semanticToneProfileSchema = z
  .object({
    directness: z.number().min(0).max(1),
    concision: z.number().min(0).max(1),
    formality: z.number().min(0).max(1),
    warmth: z.number().min(0).max(1),
    urgency: z.number().min(0).max(1),
    analytical: z.number().min(0).max(1),
    structure: z.number().min(0).max(1)
  })
  .strict();

const lexicalChangesSchema = z
  .object({
    added_keywords: z.array(z.string()),
    removed_keywords: z.array(z.string()),
    reinforced_keywords: z.array(z.string()),
    lexical_shift_score: z.number().min(0).max(1),
    compression_delta: z.number(),
    sentence_delta: z.number().int()
  })
  .strict();

const structureChangesSchema = z
  .object({
    added_sections: z.array(z.string()),
    removed_sections: z.array(z.string()),
    reordered_sections: z.number().int().min(0),
    heading_delta: z.number().int(),
    list_delta: z.number().int(),
    structure_score: z.number().min(0).max(1)
  })
  .strict();

const toneDeltaSchema = z
  .object({
    before: semanticToneProfileSchema,
    after: semanticToneProfileSchema,
    primary_shift: z.string().min(1),
    secondary_shifts: z.array(z.string()),
    intensity_score: z.number().min(0).max(1),
    rationale: z.string().min(1)
  })
  .strict();

const scopeSemanticUpdateSchema = z
  .object({
    summary: z.string().min(1),
    trait_signals: z.array(traitSignalSchema),
    confidence_delta: z.number().min(0).max(0.25),
    signal_count_delta: z.number().int().min(0)
  })
  .strict();

const semanticDiffOracleInputSchema = z
  .object({
    context: scopeContextSchema,
    generated_draft: feedbackArtifactSchema,
    final_artifact: feedbackArtifactSchema,
    feedback_notes: z.string().trim().optional(),
    accepted_reference_artifact_ids: z.array(z.string().trim().min(1)).default([])
  })
  .strict();

const semanticDiffOracleResultSchema = z
  .object({
    provider: z.string().min(1),
    lexical_changes: lexicalChangesSchema,
    structure_changes: structureChangesSchema,
    tone_delta: toneDeltaSchema,
    diff_summary: diffSummarySchema,
    scope_updates: z
      .object({
        global: scopeSemanticUpdateSchema,
        destination: scopeSemanticUpdateSchema,
        recipient: scopeSemanticUpdateSchema,
        task: scopeSemanticUpdateSchema
      })
      .strict()
  })
  .strict();

type SemanticToneProfile = z.infer<typeof semanticToneProfileSchema>;
type LexicalChanges = z.infer<typeof lexicalChangesSchema>;
type StructureChanges = z.infer<typeof structureChangesSchema>;
type ToneDelta = z.infer<typeof toneDeltaSchema>;
type ScopeSemanticUpdate = z.infer<typeof scopeSemanticUpdateSchema>;

export type SemanticDiffOracleInput = z.infer<typeof semanticDiffOracleInputSchema>;
export type SemanticDiffOracleResult = z.infer<typeof semanticDiffOracleResultSchema>;

export interface SemanticDiffOracle {
  analyze(input: SemanticDiffOracleInput): Promise<SemanticDiffOracleResult>;
}

export interface SemanticDiffOracleModelAdapter {
  readonly modelName: string;
  analyze(prompt: string): Promise<unknown>;
}

type NoteAdjustment = {
  boosts: Partial<Record<keyof SemanticToneProfile, number>>;
  traitSignals: TraitSignal[];
  rationale: string[];
};

type StructureProfile = {
  sections: string[];
  headingCount: number;
  orderedListCount: number;
  bulletListCount: number;
};

const toneDimensions: Array<keyof SemanticToneProfile> = [
  'directness',
  'concision',
  'formality',
  'warmth',
  'urgency',
  'analytical',
  'structure'
];

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function splitSentences(content: string) {
  return content
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function normalizeSectionLabel(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(content: string) {
  return (content.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}-]*/gu) ?? []).filter((token) => {
    return token.length > 1 && !STOP_WORDS.has(token) && !/^\d+$/.test(token);
  });
}

function buildFrequency(tokens: string[]) {
  const counts = new Map<string, number>();

  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  return counts;
}

function collectTermsByDelta(
  draftCounts: Map<string, number>,
  finalCounts: Map<string, number>,
  predicate: (draftCount: number, finalCount: number) => boolean
) {
  const scoredTerms = Array.from(new Set([...draftCounts.keys(), ...finalCounts.keys()]))
    .map((term) => {
      const draftCount = draftCounts.get(term) ?? 0;
      const finalCount = finalCounts.get(term) ?? 0;
      return {
        term,
        draftCount,
        finalCount,
        delta: finalCount - draftCount
      };
    })
    .filter(({ draftCount, finalCount }) => predicate(draftCount, finalCount))
    .sort((left, right) => {
      const deltaOrder = Math.abs(right.delta) - Math.abs(left.delta);
      if (deltaOrder !== 0) {
        return deltaOrder;
      }

      return right.finalCount - left.finalCount;
    });

  return scoredTerms.slice(0, 6).map(({ term }) => term);
}

function extractStructureProfile(artifact: FeedbackArtifact): StructureProfile {
  const headingMatches =
    artifact.content.match(/^\s{0,3}(?:#{1,6}\s+.+|[A-Z][^\n]{0,80}\n[-=]{2,})$/gm) ?? [];
  const orderedListMatches = artifact.content.match(/^\s*\d+\.\s+/gm) ?? [];
  const bulletListMatches = artifact.content.match(/^\s*[-*]\s+/gm) ?? [];
  const inlineSections = [
    ...artifact.structure_outline.map(normalizeSectionLabel),
    ...headingMatches.map(normalizeSectionLabel),
    ...(orderedListMatches.length > 0 ? ['ordered list'] : []),
    ...(bulletListMatches.length > 0 ? ['bullet list'] : [])
  ].filter(Boolean);

  return {
    sections: Array.from(new Set(inlineSections)),
    headingCount: headingMatches.length,
    orderedListCount: orderedListMatches.length,
    bulletListCount: bulletListMatches.length
  };
}

function countMatches(tokens: string[], vocabulary: Set<string>) {
  return tokens.reduce((count, token) => count + (vocabulary.has(token) ? 1 : 0), 0);
}

function buildToneProfile(artifact: FeedbackArtifact, noteAdjustment: NoteAdjustment): SemanticToneProfile {
  const sentences = splitSentences(artifact.content);
  const tokens = tokenize(artifact.content);
  const structureProfile = extractStructureProfile(artifact);
  const wordCount = Math.max(tokens.length, 1);
  const sentenceCount = Math.max(sentences.length, 1);
  const averageSentenceLength = tokens.length / sentenceCount;
  const imperativeStarts = sentences.reduce((count, sentence) => {
    const [firstWord = ''] = tokenize(sentence);
    return count + (IMPERATIVE_STARTERS.has(firstWord) ? 1 : 0);
  }, 0);
  const actionWordHits = countMatches(tokens, ACTION_WORDS);
  const warmHits = countMatches(tokens, WARM_WORDS);
  const formalHits = countMatches(tokens, FORMAL_WORDS);
  const hedgeHits = countMatches(tokens, HEDGE_WORDS);
  const urgentHits = countMatches(tokens, URGENT_WORDS);
  const analyticalHits = countMatches(tokens, ANALYTICAL_WORDS);
  const contractionHits = (artifact.content.match(CONTRACTION_PATTERN) ?? []).length;
  const numericHits = (artifact.content.match(/\b\d+(?:\.\d+)?%?\b/g) ?? []).length;

  return semanticToneProfileSchema.parse({
    directness: clamp(
      imperativeStarts / sentenceCount +
        actionWordHits / wordCount +
        structureProfile.orderedListCount / sentenceCount -
        hedgeHits / sentenceCount * 0.5 +
        (noteAdjustment.boosts.directness ?? 0)
    ),
    concision: clamp(
      0.8 -
        averageSentenceLength / 28 +
        imperativeStarts / sentenceCount * 0.2 -
        hedgeHits / sentenceCount * 0.1 +
        (noteAdjustment.boosts.concision ?? 0)
    ),
    formality: clamp(
      formalHits / wordCount * 4 +
        structureProfile.headingCount / sentenceCount * 0.15 -
        contractionHits / sentenceCount * 0.3 +
        (noteAdjustment.boosts.formality ?? 0)
    ),
    warmth: clamp(
      warmHits / wordCount * 6 -
        imperativeStarts / sentenceCount * 0.15 +
        (noteAdjustment.boosts.warmth ?? 0)
    ),
    urgency: clamp(
      urgentHits / wordCount * 8 +
        structureProfile.orderedListCount / sentenceCount * 0.1 +
        (noteAdjustment.boosts.urgency ?? 0)
    ),
    analytical: clamp(
      analyticalHits / wordCount * 8 +
        numericHits / wordCount * 2 +
        (noteAdjustment.boosts.analytical ?? 0)
    ),
    structure: clamp(
      (structureProfile.headingCount +
        structureProfile.orderedListCount +
        structureProfile.bulletListCount) /
        sentenceCount +
        artifact.structure_outline.length * 0.1 +
        (noteAdjustment.boosts.structure ?? 0)
    )
  });
}

function analyzeLexicalChanges(generatedDraft: FeedbackArtifact, finalArtifact: FeedbackArtifact): LexicalChanges {
  const draftTokens = tokenize(generatedDraft.content);
  const finalTokens = tokenize(finalArtifact.content);
  const draftCounts = buildFrequency(draftTokens);
  const finalCounts = buildFrequency(finalTokens);
  const addedKeywords = collectTermsByDelta(draftCounts, finalCounts, (draftCount, finalCount) => {
    return draftCount === 0 && finalCount > 0;
  });
  const removedKeywords = collectTermsByDelta(draftCounts, finalCounts, (draftCount, finalCount) => {
    return draftCount > 0 && finalCount === 0;
  });
  const reinforcedKeywords = collectTermsByDelta(draftCounts, finalCounts, (draftCount, finalCount) => {
    return draftCount > 0 && finalCount > draftCount;
  });
  const totalDelta =
    addedKeywords.length +
    removedKeywords.length +
    reinforcedKeywords.length;

  return lexicalChangesSchema.parse({
    added_keywords: addedKeywords,
    removed_keywords: removedKeywords,
    reinforced_keywords: reinforcedKeywords,
    lexical_shift_score: clamp(totalDelta / 10),
    compression_delta:
      finalTokens.length === 0 ? 0 : Number(((generatedDraft.content.length - finalArtifact.content.length) / Math.max(generatedDraft.content.length, 1)).toFixed(3)),
    sentence_delta: splitSentences(finalArtifact.content).length - splitSentences(generatedDraft.content).length
  });
}

function analyzeStructureChanges(generatedDraft: FeedbackArtifact, finalArtifact: FeedbackArtifact): StructureChanges {
  const draftStructure = extractStructureProfile(generatedDraft);
  const finalStructure = extractStructureProfile(finalArtifact);
  const addedSections = finalStructure.sections.filter((section) => !draftStructure.sections.includes(section));
  const removedSections = draftStructure.sections.filter((section) => !finalStructure.sections.includes(section));
  const reorderedSections = finalStructure.sections.reduce((count, section, index) => {
    const draftIndex = draftStructure.sections.indexOf(section);
    return count + (draftIndex !== -1 && draftIndex !== index ? 1 : 0);
  }, 0);

  return structureChangesSchema.parse({
    added_sections: addedSections,
    removed_sections: removedSections,
    reordered_sections: reorderedSections,
    heading_delta: finalStructure.headingCount - draftStructure.headingCount,
    list_delta:
      finalStructure.orderedListCount +
      finalStructure.bulletListCount -
      (draftStructure.orderedListCount + draftStructure.bulletListCount),
    structure_score: clamp(
      (addedSections.length +
        removedSections.length +
        reorderedSections +
        Math.abs(finalStructure.headingCount - draftStructure.headingCount) +
        Math.abs(
          finalStructure.orderedListCount +
            finalStructure.bulletListCount -
            (draftStructure.orderedListCount + draftStructure.bulletListCount)
        )) / 10
    )
  });
}

function extractFeedbackNoteAdjustments(notes?: string): NoteAdjustment {
  if (!notes) {
    return {
      boosts: {},
      traitSignals: [],
      rationale: []
    };
  }

  const normalizedNotes = notes.toLowerCase();
  const adjustment: NoteAdjustment = {
    boosts: {},
    traitSignals: [],
    rationale: []
  };

  if (/(tighten|trim|compress|concise|shorten)/i.test(normalizedNotes)) {
    adjustment.boosts.concision = 0.14;
    adjustment.boosts.directness = 0.08;
    adjustment.traitSignals.push({
      trait_key: 'tone.concise',
      evidence: 'Feedback notes explicitly asked for a tighter and more compressed delivery.',
      weight: 0.78
    });
    adjustment.rationale.push('feedback notes requested a tighter, more concise delivery');
  }

  if (/(owner|deadline|cta|action|follow-up)/i.test(normalizedNotes)) {
    adjustment.boosts.structure = 0.12;
    adjustment.boosts.directness = 0.06;
    adjustment.traitSignals.push({
      trait_key: 'structure.owner_deadline',
      evidence: 'Feedback notes emphasized explicit owners, deadlines, or CTA wording.',
      weight: 0.74
    });
    adjustment.rationale.push('feedback notes added owner/deadline or CTA specificity');
  }

  if (/(formal|executive|polish|leadership)/i.test(normalizedNotes)) {
    adjustment.boosts.formality = 0.12;
    adjustment.traitSignals.push({
      trait_key: 'tone.formal',
      evidence: 'Feedback notes pushed the draft toward a more executive register.',
      weight: 0.72
    });
    adjustment.rationale.push('feedback notes asked for a more executive tone');
  }

  if (/(warm|friendly|empathetic|supportive)/i.test(normalizedNotes)) {
    adjustment.boosts.warmth = 0.14;
    adjustment.traitSignals.push({
      trait_key: 'tone.warm',
      evidence: 'Feedback notes requested a more empathetic or friendly tone.',
      weight: 0.7
    });
    adjustment.rationale.push('feedback notes requested warmer delivery');
  }

  if (/(urgent|asap|immediately|today)/i.test(normalizedNotes)) {
    adjustment.boosts.urgency = 0.15;
    adjustment.traitSignals.push({
      trait_key: 'tone.urgent',
      evidence: 'Feedback notes called for urgency markers in the final artifact.',
      weight: 0.76
    });
    adjustment.rationale.push('feedback notes increased urgency');
  }

  return adjustment;
}

function labelToneShift(dimension: keyof SemanticToneProfile, delta: number) {
  const direction = delta >= 0 ? 'more' : 'less';
  return `${direction}_${dimension}`;
}

function analyzeToneDelta(
  generatedDraft: FeedbackArtifact,
  finalArtifact: FeedbackArtifact,
  noteAdjustment: NoteAdjustment,
  lexicalChanges: LexicalChanges,
  structureChanges: StructureChanges
): ToneDelta {
  const before = buildToneProfile(generatedDraft, { boosts: {}, traitSignals: [], rationale: [] });
  const after = buildToneProfile(finalArtifact, noteAdjustment);
  const rankedShifts = toneDimensions
    .map((dimension) => ({
      dimension,
      delta: after[dimension] - before[dimension]
    }))
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta));

  const primary = rankedShifts[0];
  const significantShifts = rankedShifts.filter(({ delta }) => Math.abs(delta) >= 0.08);
  const secondary = significantShifts.slice(1, 3).map(({ dimension, delta }) => labelToneShift(dimension, delta));
  const rationaleParts = [];

  if (lexicalChanges.added_keywords.length > 0) {
    rationaleParts.push(`new lexical emphasis on ${lexicalChanges.added_keywords.slice(0, 3).join(', ')}`);
  }

  if (structureChanges.added_sections.length > 0 || structureChanges.reordered_sections > 0) {
    rationaleParts.push('the editor changed the section plan');
  }

  rationaleParts.push(...noteAdjustment.rationale);

  return toneDeltaSchema.parse({
    before,
    after,
    primary_shift:
      primary && Math.abs(primary.delta) >= 0.08
        ? labelToneShift(primary.dimension, primary.delta)
        : 'stable',
    secondary_shifts: secondary,
    intensity_score: clamp(
      rankedShifts.reduce((sum, shift) => sum + Math.abs(shift.delta), 0) / toneDimensions.length * 1.8
    ),
    rationale:
      rationaleParts.length > 0
        ? `Oracle inferred the tone shift because ${rationaleParts.join(', ')}.`
        : 'Oracle found no durable tone shift between the draft and the final artifact.'
  });
}

function buildDiffSummary(
  generatedDraft: FeedbackArtifact,
  finalArtifact: FeedbackArtifact,
  lexicalChanges: LexicalChanges,
  structureChanges: StructureChanges,
  toneDelta: ToneDelta
) {
  const draftSentences = new Set(splitSentences(generatedDraft.content));
  const finalSentences = new Set(splitSentences(finalArtifact.content));
  const addedSentences = Array.from(finalSentences).filter((sentence) => !draftSentences.has(sentence));
  const removedSentences = Array.from(draftSentences).filter((sentence) => !finalSentences.has(sentence));
  const positionalSectionChanges = Math.max(generatedDraft.structure_outline.length, finalArtifact.structure_outline.length) === 0
    ? 0
    : Array.from(
        {
          length: Math.max(generatedDraft.structure_outline.length, finalArtifact.structure_outline.length)
        },
        (_, index) => index
      ).reduce((count, index) => {
        return count +
          ((generatedDraft.structure_outline[index] ?? null) !== (finalArtifact.structure_outline[index] ?? null)
            ? 1
            : 0);
      }, 0);

  const changedStructureSections = Math.max(
    positionalSectionChanges,
    structureChanges.added_sections.length +
      structureChanges.removed_sections.length +
      structureChanges.reordered_sections
  );

  const summaryParts = [];
  if (toneDelta.primary_shift !== 'stable') {
    summaryParts.push(`tone shifted ${toneDelta.primary_shift.replace(/_/g, ' ')}`);
  }
  if (lexicalChanges.added_keywords.length > 0) {
    summaryParts.push(`lexical focus moved toward ${lexicalChanges.added_keywords.slice(0, 3).join(', ')}`);
  }
  if (changedStructureSections > 0) {
    summaryParts.push(`structure changed across ${changedStructureSections} sections`);
  }

  return diffSummarySchema.parse({
    added_sentences: addedSentences.length,
    removed_sentences: removedSentences.length,
    changed_structure_sections: changedStructureSections,
    summary:
      summaryParts.length > 0
        ? `Oracle detected ${summaryParts.join('; ')}.`
        : 'Oracle found no durable style delta between the generated draft and the final artifact.'
  });
}

function buildToneSignals(toneDelta: ToneDelta) {
  const signals: TraitSignal[] = [];

  if (toneDelta.primary_shift !== 'stable') {
    const traitKey = toneDelta.primary_shift.replace('more_', '').replace('less_', '');
    signals.push({
      trait_key: `tone.${traitKey}`,
      evidence: toneDelta.rationale,
      weight: clamp(0.55 + toneDelta.intensity_score * 0.3)
    });
  }

  for (const shift of toneDelta.secondary_shifts) {
    const traitKey = shift.replace('more_', '').replace('less_', '');
    signals.push({
      trait_key: `tone.${traitKey}`,
      evidence: `Secondary Oracle tone shift: ${shift.replace(/_/g, ' ')}.`,
      weight: clamp(0.42 + toneDelta.intensity_score * 0.2)
    });
  }

  return signals;
}

function buildScopeUpdates(
  context: ScopeContext,
  lexicalChanges: LexicalChanges,
  structureChanges: StructureChanges,
  toneDelta: ToneDelta,
  noteAdjustment: NoteAdjustment,
  acceptedReferenceArtifactIds: string[]
) {
  const globalSignals = [...buildToneSignals(toneDelta)];
  const destinationSignals: TraitSignal[] = [];
  const recipientSignals: TraitSignal[] = [];
  const taskSignals: TraitSignal[] = [];

  if (structureChanges.list_delta > 0) {
    destinationSignals.push({
      trait_key: 'format.list_heavy',
      evidence: 'Final artifact introduced more list structure than the draft.',
      weight: clamp(0.48 + structureChanges.structure_score * 0.25)
    });
  }

  if (structureChanges.heading_delta > 0 || structureChanges.added_sections.length > 0) {
    destinationSignals.push({
      trait_key: 'format.sectioned_outline',
      evidence: `Oracle detected new sections: ${structureChanges.added_sections.slice(0, 3).join(', ') || 'refined outline'}.`,
      weight: clamp(0.5 + structureChanges.structure_score * 0.25)
    });
  }

  if (context.recipient_key) {
    if (toneDelta.after.formality > toneDelta.before.formality + 0.08) {
      recipientSignals.push({
        trait_key: 'recipient.formal_delivery',
        evidence: 'Final artifact moved toward a more formal register for this recipient.',
        weight: clamp(0.5 + toneDelta.intensity_score * 0.25)
      });
    }

    if (toneDelta.after.warmth > toneDelta.before.warmth + 0.08) {
      recipientSignals.push({
        trait_key: 'recipient.warm_delivery',
        evidence: 'Final artifact added warmer phrasing for this recipient.',
        weight: clamp(0.48 + toneDelta.intensity_score * 0.25)
      });
    }
  }

  for (const keyword of [...lexicalChanges.added_keywords, ...lexicalChanges.reinforced_keywords].slice(0, 4)) {
    taskSignals.push({
      trait_key: `lexicon.${keyword.replace(/[^\p{L}\p{N}-]+/gu, '_')}`,
      evidence: `Oracle detected a task-level lexical emphasis on "${keyword}" in the final artifact.`,
      weight: clamp(0.44 + lexicalChanges.lexical_shift_score * 0.3)
    });
  }

  if (acceptedReferenceArtifactIds.length > 0) {
    taskSignals.push({
      trait_key: 'reference.accepted_pattern',
      evidence: `Feedback accepted ${acceptedReferenceArtifactIds.length} reference artifact patterns.`,
      weight: clamp(0.45 + acceptedReferenceArtifactIds.length * 0.08)
    });
  }

  if (noteAdjustment.traitSignals.length > 0) {
    globalSignals.push(...noteAdjustment.traitSignals);
  }

  const scopeUpdates: Record<SsceScopeType, ScopeSemanticUpdate> = {
    global: {
      summary:
        globalSignals.length > 0
          ? `Oracle lifted ${globalSignals.length} durable tone-level traits into the global signature.`
          : 'Oracle found no global tone delta worth compounding.',
      trait_signals: globalSignals,
      confidence_delta: globalSignals.length > 0 ? clamp(0.04 + toneDelta.intensity_score * 0.08, 0, 0.25) : 0.02,
      signal_count_delta: globalSignals.length
    },
    destination: {
      summary:
        destinationSignals.length > 0
          ? `Oracle inferred ${destinationSignals.length} destination-format adjustments from structure edits.`
          : 'Oracle found no destination-specific formatting delta worth compounding.',
      trait_signals: destinationSignals,
      confidence_delta:
        destinationSignals.length > 0 ? clamp(0.03 + structureChanges.structure_score * 0.1, 0, 0.25) : 0.02,
      signal_count_delta: destinationSignals.length
    },
    recipient: {
      summary:
        recipientSignals.length > 0
          ? `Oracle inferred ${recipientSignals.length} recipient-tone adjustments from the accepted edits.`
          : 'Oracle found no recipient-specific tone delta worth compounding.',
      trait_signals: recipientSignals,
      confidence_delta:
        recipientSignals.length > 0 ? clamp(0.03 + toneDelta.intensity_score * 0.09, 0, 0.25) : 0.02,
      signal_count_delta: recipientSignals.length
    },
    task: {
      summary:
        taskSignals.length > 0
          ? `Oracle promoted ${taskSignals.length} task-level lexical or structural cues into the task signature.`
          : 'Oracle found no task-specific content delta worth compounding.',
      trait_signals: taskSignals,
      confidence_delta:
        taskSignals.length > 0 ? clamp(0.03 + lexicalChanges.lexical_shift_score * 0.12, 0, 0.25) : 0.02,
      signal_count_delta: taskSignals.length
    }
  };

  return scopeUpdates;
}

export function buildSemanticDiffOraclePrompt(input: SemanticDiffOracleInput) {
  return [
    'You are the SSCE Oracle. Compare the generated draft and the accepted final artifact.',
    'Return lexical changes, structure changes, tone delta, and scope-separated trait updates.',
    `Workspace: ${input.context.workspace_id}`,
    `Destination: ${input.context.destination_key ?? 'n/a'}`,
    `Recipient: ${input.context.recipient_key ?? 'n/a'}`,
    `Task: ${input.context.task_key ?? 'n/a'}`,
    '',
    '[Generated Draft]',
    input.generated_draft.content,
    '',
    '[Final Artifact]',
    input.final_artifact.content,
    '',
    '[Feedback Notes]',
    input.feedback_notes ?? 'n/a'
  ].join('\n');
}

const DEFAULT_GOOGLE_AI_STUDIO_MODEL = 'gemini-2.5-flash';
const DEFAULT_GOOGLE_AI_STUDIO_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const MAX_GEMINI_ORACLE_TEXT_LENGTH = 480;
const MAX_GEMINI_ORACLE_NOTE_LENGTH = 160;

type OracleRuntimeConfig = {
  apiKey: string | null;
  model: string;
  apiBaseUrl: string;
  requireLive: boolean;
  allowFallback: boolean;
};

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  promptFeedback?: {
    blockReason?: string;
  };
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  error?: {
    message?: string;
  };
};

const toneShiftOptions = [
  'stable',
  'more_directness',
  'less_directness',
  'more_concision',
  'less_concision',
  'more_formality',
  'less_formality',
  'more_warmth',
  'less_warmth',
  'more_urgency',
  'less_urgency',
  'more_analytical',
  'less_analytical',
  'more_structure',
  'less_structure'
] as const;

const secondaryToneShiftOptions = [
  'more_directness',
  'less_directness',
  'more_concision',
  'less_concision',
  'more_formality',
  'less_formality',
  'more_warmth',
  'less_warmth',
  'more_urgency',
  'less_urgency',
  'more_analytical',
  'less_analytical',
  'more_structure',
  'less_structure'
] as const;

const compactOracleArraySchema = z.array(z.string().trim().min(1)).max(4);

const geminiOracleWireSchema = z
  .object({
    a: compactOracleArraySchema
      .default([]),
    r: compactOracleArraySchema
      .default([]),
    f: compactOracleArraySchema
      .default([]),
    sa: compactOracleArraySchema
      .default([]),
    sr: compactOracleArraySchema
      .default([]),
    p: z.enum(toneShiftOptions).default('stable'),
    s: z
      .array(z.enum(secondaryToneShiftOptions))
      .max(2)
      .default([]),
  })
  .strict();

type GeminiOracleWire = z.infer<typeof geminiOracleWireSchema>;

const geminiOracleResponseJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['a', 'r', 'f', 'sa', 'sr', 'p', 's'],
  properties: {
    a: {
      type: 'array',
      description: 'Lowercase content terms that appear in the final artifact but not the generated draft.',
      items: {
        type: 'string'
      },
      maxItems: 4
    },
    r: {
      type: 'array',
      description: 'Lowercase content terms removed from the generated draft in the final artifact.',
      items: {
        type: 'string'
      },
      maxItems: 4
    },
    f: {
      type: 'array',
      description: 'Lowercase content terms that became more emphasized in the final artifact.',
      items: {
        type: 'string'
      },
      maxItems: 4
    },
    sa: {
      type: 'array',
      description: 'Short section labels added to the final artifact structure.',
      items: {
        type: 'string'
      },
      maxItems: 4
    },
    sr: {
      type: 'array',
      description: 'Short section labels removed from the final artifact structure.',
      items: {
        type: 'string'
      },
      maxItems: 4
    },
    p: {
      type: 'string',
      description: 'Primary durable tone shift label.',
      enum: toneShiftOptions
    },
    s: {
      type: 'array',
      description: 'Secondary durable tone shift labels.',
      items: {
        type: 'string',
        enum: secondaryToneShiftOptions
      },
      maxItems: 2
    }
  }
} as const;

function buildHeuristicSemanticDiffOracleResult(
  parsedInput: SemanticDiffOracleInput,
  provider = 'heuristic-oracle-v1'
) {
  const noteAdjustment = extractFeedbackNoteAdjustments(parsedInput.feedback_notes);
  const lexicalChanges = analyzeLexicalChanges(parsedInput.generated_draft, parsedInput.final_artifact);
  const structureChanges = analyzeStructureChanges(parsedInput.generated_draft, parsedInput.final_artifact);
  const toneDelta = analyzeToneDelta(
    parsedInput.generated_draft,
    parsedInput.final_artifact,
    noteAdjustment,
    lexicalChanges,
    structureChanges
  );
  const diffSummary = buildDiffSummary(
    parsedInput.generated_draft,
    parsedInput.final_artifact,
    lexicalChanges,
    structureChanges,
    toneDelta
  );
  const scopeUpdates = buildScopeUpdates(
    parsedInput.context,
    lexicalChanges,
    structureChanges,
    toneDelta,
    noteAdjustment,
    parsedInput.accepted_reference_artifact_ids
  );

  return semanticDiffOracleResultSchema.parse({
    provider,
    lexical_changes: lexicalChanges,
    structure_changes: structureChanges,
    tone_delta: toneDelta,
    diff_summary: diffSummary,
    scope_updates: scopeUpdates
  });
}

function parseEnvValue(rawValue: string) {
  let value = rawValue.trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return value.replace(/\\n/g, '\n');
}

let oracleEnvLoaded = false;

function hydrateEnvFile(filePath: string) {
  const file = readFileSync(filePath, 'utf8');

  for (const line of file.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;
    if (process.env[key] === undefined) {
      process.env[key] = parseEnvValue(rawValue);
    }
  }
}

function ensureOracleEnvLoaded(cwd = process.cwd()) {
  if (oracleEnvLoaded) {
    return;
  }

  oracleEnvLoaded = true;

  for (const candidate of [path.join(cwd, '.env.local'), path.join(cwd, '.env')]) {
    if (existsSync(candidate)) {
      hydrateEnvFile(candidate);
    }
  }
}

function readOracleRuntimeConfig(env = process.env): OracleRuntimeConfig {
  ensureOracleEnvLoaded();

  const apiKey = env.GOOGLE_AI_STUDIO_KEY?.trim() || env.GEMINI_API_KEY?.trim() || null;
  const model = env.GOOGLE_AI_STUDIO_MODEL?.trim() || DEFAULT_GOOGLE_AI_STUDIO_MODEL;
  const apiBaseUrl = env.GOOGLE_AI_STUDIO_API_BASE_URL?.trim() || DEFAULT_GOOGLE_AI_STUDIO_API_BASE_URL;
  const requireLive =
    env.SSCE_ORACLE_REQUIRE_LIVE === 'true' ||
    env.NODE_ENV === 'production' ||
    apiKey !== null;

  return {
    apiKey,
    model,
    apiBaseUrl,
    requireLive,
    allowFallback: !requireLive
  };
}

function compactGeminiOracleText(content: string, maxLength: number) {
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1)}…`;
}

function mergeGeminiJudgmentWithBaseline(
  judgment: GeminiOracleWire,
  fallback: SemanticDiffOracleResult,
  model: string
): SemanticDiffOracleResult {
  const rationaleParts = [];

  if (judgment.a.length > 0) {
    rationaleParts.push(`Gemini confirmed lexical additions around ${judgment.a.slice(0, 2).join(', ')}`);
  }

  if (judgment.f.length > 0) {
    rationaleParts.push(`Gemini confirmed stronger emphasis on ${judgment.f.slice(0, 2).join(', ')}`);
  }

  if (judgment.sa.length > 0 || judgment.sr.length > 0) {
    rationaleParts.push(
      `Gemini confirmed structure edits across ${[...judgment.sa, ...judgment.sr].slice(0, 2).join(', ')}`
    );
  }

  if (judgment.p !== 'stable') {
    rationaleParts.push(`Gemini classified the primary tone shift as ${judgment.p.replace(/_/g, ' ')}`);
  }

  const diffSummaryParts = [];
  if (judgment.a.length > 0) {
    diffSummaryParts.push(`lexical additions ${judgment.a.slice(0, 2).join(', ')}`);
  }
  if (judgment.sa.length > 0) {
    diffSummaryParts.push(`new sections ${judgment.sa.slice(0, 2).join(', ')}`);
  }
  if (judgment.p !== 'stable') {
    diffSummaryParts.push(`tone ${judgment.p.replace(/_/g, ' ')}`);
  }

  const globalSignals =
    judgment.p !== 'stable'
      ? [
          {
            trait_key: `tone.${judgment.p.replace('more_', '').replace('less_', '')}`,
            evidence:
              rationaleParts[0] ??
              'Gemini confirmed a durable tone shift from the accepted user edits.',
            weight: clamp(0.58 + fallback.tone_delta.intensity_score * 0.2)
          },
          ...fallback.scope_updates.global.trait_signals
        ].slice(0, 6)
      : fallback.scope_updates.global.trait_signals;
  const destinationSignals =
    judgment.sa.length > 0
      ? [
          {
            trait_key: 'format.semantic_sectioning',
            evidence: `Gemini highlighted new sections: ${judgment.sa.slice(0, 3).join(', ')}.`,
            weight: clamp(0.5 + fallback.structure_changes.structure_score * 0.2)
          },
          ...fallback.scope_updates.destination.trait_signals
        ].slice(0, 6)
      : fallback.scope_updates.destination.trait_signals;
  const taskSignals =
    judgment.a.length > 0
      ? [
          ...judgment.a.slice(0, 2).map((keyword) => ({
            trait_key: `lexicon.${keyword.replace(/[^\p{L}\p{N}-]+/gu, '_')}`,
            evidence: `Gemini marked "${keyword}" as a reinforced task lexicon choice.`,
            weight: clamp(0.46 + fallback.lexical_changes.lexical_shift_score * 0.2)
          })),
          ...fallback.scope_updates.task.trait_signals
        ].slice(0, 6)
      : fallback.scope_updates.task.trait_signals;

  return semanticDiffOracleResultSchema.parse({
    provider: `google-ai-studio-gemini:${model}`,
    lexical_changes: {
      added_keywords: judgment.a.length > 0 ? judgment.a : fallback.lexical_changes.added_keywords,
      removed_keywords: judgment.r.length > 0 ? judgment.r : fallback.lexical_changes.removed_keywords,
      reinforced_keywords: judgment.f.length > 0 ? judgment.f : fallback.lexical_changes.reinforced_keywords,
      lexical_shift_score: clamp(
        Math.max(
          fallback.lexical_changes.lexical_shift_score,
          (judgment.a.length +
            judgment.r.length +
            judgment.f.length) /
            10
        )
      ),
      compression_delta: fallback.lexical_changes.compression_delta,
      sentence_delta: fallback.lexical_changes.sentence_delta
    },
    structure_changes: {
      added_sections: judgment.sa.length > 0 ? judgment.sa : fallback.structure_changes.added_sections,
      removed_sections: judgment.sr.length > 0 ? judgment.sr : fallback.structure_changes.removed_sections,
      reordered_sections: fallback.structure_changes.reordered_sections,
      heading_delta: fallback.structure_changes.heading_delta,
      list_delta: fallback.structure_changes.list_delta,
      structure_score: clamp(
        Math.max(
          fallback.structure_changes.structure_score,
          (judgment.sa.length + judgment.sr.length) / 10
        )
      )
    },
    tone_delta: {
      before: fallback.tone_delta.before,
      after: fallback.tone_delta.after,
      primary_shift: judgment.p,
      secondary_shifts: judgment.s,
      intensity_score: clamp(
        Math.max(
          fallback.tone_delta.intensity_score,
          0.15 +
            judgment.s.length * 0.08 +
            (judgment.p !== 'stable' ? 0.12 : 0)
        )
      ),
      rationale:
        rationaleParts.length > 0
          ? `${rationaleParts.join('; ')}.`
          : fallback.tone_delta.rationale
    },
    diff_summary: {
      added_sentences: fallback.diff_summary.added_sentences,
      removed_sentences: fallback.diff_summary.removed_sentences,
      changed_structure_sections: Math.max(
        fallback.diff_summary.changed_structure_sections,
        judgment.sa.length + judgment.sr.length
      ),
      summary:
        diffSummaryParts.length > 0
          ? `Gemini confirmed ${diffSummaryParts.join(', ')}.`
          : fallback.diff_summary.summary
    },
    scope_updates: {
      global: {
        ...fallback.scope_updates.global,
        summary:
          judgment.p !== 'stable'
            ? `Gemini confirmed a global tone shift: ${judgment.p.replace(/_/g, ' ')}.`
            : fallback.scope_updates.global.summary,
        trait_signals: globalSignals,
        signal_count_delta: globalSignals.length
      },
      destination: {
        ...fallback.scope_updates.destination,
        summary:
          judgment.sa.length > 0
            ? `Gemini confirmed destination structure edits around ${judgment.sa.slice(0, 3).join(', ')}.`
            : fallback.scope_updates.destination.summary,
        trait_signals: destinationSignals,
        signal_count_delta: destinationSignals.length
      },
      recipient: fallback.scope_updates.recipient,
      task: {
        ...fallback.scope_updates.task,
        summary:
          judgment.a.length > 0
            ? `Gemini confirmed task-level lexical emphasis on ${judgment.a.slice(0, 3).join(', ')}.`
            : fallback.scope_updates.task.summary,
        trait_signals: taskSignals,
        signal_count_delta: taskSignals.length
      }
    }
  });
}

function extractGeminiText(payload: GeminiGenerateContentResponse) {
  const candidateText = payload.candidates
    ?.flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => part.text ?? '')
    .join('')
    .trim();

  if (candidateText) {
    return candidateText;
  }

  if (payload.promptFeedback?.blockReason) {
    throw new Error(`Gemini request was blocked: ${payload.promptFeedback.blockReason}`);
  }

  throw new Error(payload.error?.message ?? 'Gemini returned no content.');
}

function buildGeminiOraclePrompt(
  input: SemanticDiffOracleInput,
  baseline: SemanticDiffOracleResult
) {
  return JSON.stringify({
    task: 'Classify only durable style edits from the accepted final artifact. Return schema keys exactly.',
    keys: {
      a: 'added lexical terms',
      r: 'removed lexical terms',
      f: 'reinforced lexical terms',
      sa: 'added structure labels',
      sr: 'removed structure labels',
      p: 'primary tone shift',
      s: 'secondary tone shifts'
    },
    input: {
      w: input.context.workspace_id,
      d: input.context.destination_key ?? 'n/a',
      r: input.context.recipient_key ?? 'n/a',
      t: input.context.task_key ?? 'n/a',
      n: compactGeminiOracleText(input.feedback_notes ?? 'none', MAX_GEMINI_ORACLE_NOTE_LENGTH),
      refs: input.accepted_reference_artifact_ids.slice(0, 4),
      draft: compactGeminiOracleText(input.generated_draft.content, MAX_GEMINI_ORACLE_TEXT_LENGTH),
      final: compactGeminiOracleText(input.final_artifact.content, MAX_GEMINI_ORACLE_TEXT_LENGTH),
      draft_outline: input.generated_draft.structure_outline.slice(0, 4),
      final_outline: input.final_artifact.structure_outline.slice(0, 4),
      base: {
        a: baseline.lexical_changes.added_keywords.slice(0, 2),
        r: baseline.lexical_changes.removed_keywords.slice(0, 2),
        f: baseline.lexical_changes.reinforced_keywords.slice(0, 2),
        sa: baseline.structure_changes.added_sections.slice(0, 2),
        sr: baseline.structure_changes.removed_sections.slice(0, 2),
        p: baseline.tone_delta.primary_shift
      }
    }
  });
}

export class HeuristicSemanticDiffOracle implements SemanticDiffOracle {
  async analyze(input: SemanticDiffOracleInput): Promise<SemanticDiffOracleResult> {
    const parsedInput = semanticDiffOracleInputSchema.parse(input);
    return buildHeuristicSemanticDiffOracleResult(parsedInput);
  }
}

export class GoogleAiStudioSemanticDiffOracle implements SemanticDiffOracle {
  constructor(
    private readonly config: OracleRuntimeConfig,
    private readonly fallbackOracle: HeuristicSemanticDiffOracle = new HeuristicSemanticDiffOracle()
  ) {}

  async analyze(input: SemanticDiffOracleInput): Promise<SemanticDiffOracleResult> {
    const parsedInput = semanticDiffOracleInputSchema.parse(input);
    const baseline = buildHeuristicSemanticDiffOracleResult(parsedInput);

    if (!this.config.apiKey) {
      if (this.config.allowFallback) {
        return this.fallbackOracle.analyze(parsedInput);
      }

      throw new Error('GOOGLE_AI_STUDIO_KEY is required for live Oracle analysis.');
    }

    const response = await fetch(`${this.config.apiBaseUrl}/models/${this.config.model}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.config.apiKey
      },
      body: JSON.stringify({
        systemInstruction: {
          role: 'system',
          parts: [
            {
              text:
                'You are the Voxera SSCE Oracle. Return one JSON object that matches the schema exactly. No markdown, no prose, no code fences.'
            }
          ]
        },
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: buildGeminiOraclePrompt(parsedInput, baseline)
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0,
          topP: 0.1,
          topK: 1,
          candidateCount: 1,
          seed: 7,
          maxOutputTokens: 180,
          responseMimeType: 'application/json',
          responseJsonSchema: geminiOracleResponseJsonSchema,
          thinkingConfig: {
            thinkingBudget: 0
          }
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Google AI Studio request failed (${response.status} ${response.statusText}): ${errorText}`
      );
    }

    const payload = (await response.json()) as GeminiGenerateContentResponse;
    const text = extractGeminiText(payload);
    const rawCandidate = JSON.parse(text) as unknown;
    const judgment = geminiOracleWireSchema.parse(rawCandidate);
    const result = mergeGeminiJudgmentWithBaseline(judgment, baseline, this.config.model);

    console.info(
      `[ssce-oracle] provider=${result.provider} promptTokens=${payload.usageMetadata?.promptTokenCount ?? 0} totalTokens=${payload.usageMetadata?.totalTokenCount ?? 0} primaryShift=${result.tone_delta.primary_shift}`
    );

    return result;
  }
}

let defaultSemanticDiffOracle: SemanticDiffOracle | undefined;

export function getSemanticDiffOracle() {
  if (!defaultSemanticDiffOracle) {
    const config = readOracleRuntimeConfig();

    if (config.apiKey) {
      defaultSemanticDiffOracle = new GoogleAiStudioSemanticDiffOracle(config);
    } else if (config.allowFallback) {
      defaultSemanticDiffOracle = new HeuristicSemanticDiffOracle();
    } else {
      throw new Error('GOOGLE_AI_STUDIO_KEY is required for live Oracle analysis.');
    }
  }

  return defaultSemanticDiffOracle;
}
