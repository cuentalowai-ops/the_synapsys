import { logger } from '../config/logger';

/**
 * Presentation Definition Parser
 * DIF Presentation Exchange v2.0.0 compliant
 * https://identity.foundation/presentation-exchange/spec/v2.0.0/
 */

export interface InputDescriptor {
  id: string;
  name?: string;
  purpose?: string;
  format?: Record<string, unknown>;
  constraints: {
    fields?: Array<{
      path: string[];
      filter?: Record<string, unknown>;
      purpose?: string;
      predicate?: string;
      optional?: boolean;
    }>;
    limit_disclosure?: string;
  };
}

export interface PresentationDefinition {
  id: string;
  name?: string;
  purpose?: string;
  format?: Record<string, unknown>;
  input_descriptors: InputDescriptor[];
  submission_requirements?: Array<{
    name?: string;
    purpose?: string;
    rule: 'all' | 'pick';
    count?: number;
    min?: number;
    max?: number;
    from?: string;
    from_nested?: Array<unknown>;
  }>;
}

export interface PresentationSubmission {
  id: string;
  definition_id: string;
  descriptor_map: Array<{
    id: string;
    format: string;
    path: string;
    path_nested?: {
      id: string;
      format: string;
      path: string;
    };
  }>;
}

export interface VerifiableCredential {
  '@context': string | string[];
  type: string | string[];
  issuer: string | { id: string; [key: string]: unknown };
  issuanceDate: string;
  credentialSubject: Record<string, unknown>;
  proof?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface VerifiablePresentation {
  '@context': string | string[];
  type: string | string[];
  verifiable_credential?: VerifiableCredential[];
  verifiableCredential?: VerifiableCredential[];
  holder?: string;
  proof?: Record<string, unknown>;
  presentation_submission?: PresentationSubmission;
  [key: string]: unknown;
}

/**
 * Validate Presentation Definition schema
 */
export function validatePresentationDefinition(pd: unknown): { valid: boolean; errors?: string[] } {
  if (!pd || typeof pd !== 'object') {
    return { valid: false, errors: ['Presentation definition must be an object'] };
  }

  const definition = pd as Partial<PresentationDefinition>;

  const errors: string[] = [];

  // Required fields
  if (!definition.id) {
    errors.push('Missing required field: id');
  }
  if (!definition.input_descriptors || !Array.isArray(definition.input_descriptors)) {
    errors.push('Missing or invalid required field: input_descriptors');
  }

  // Validate input descriptors
  if (definition.input_descriptors) {
    definition.input_descriptors.forEach((descriptor, index) => {
      if (!descriptor.id) {
        errors.push(`Input descriptor ${index}: missing required field 'id'`);
      }
      if (!descriptor.constraints) {
        errors.push(`Input descriptor ${index}: missing required field 'constraints'`);
      }
    });
  }

  if (errors.length > 0) {
    logger.warn('Presentation definition validation failed', { errors });
    return { valid: false, errors };
  }

  logger.info('Presentation definition validated successfully', { id: definition.id });
  return { valid: true };
}

/**
 * Validate Presentation Submission schema
 */
export function validatePresentationSubmission(ps: unknown): { valid: boolean; errors?: string[] } {
  if (!ps || typeof ps !== 'object') {
    return { valid: false, errors: ['Presentation submission must be an object'] };
  }

  const submission = ps as Partial<PresentationSubmission>;

  const errors: string[] = [];

  if (!submission.id) {
    errors.push('Missing required field: id');
  }
  if (!submission.definition_id) {
    errors.push('Missing required field: definition_id');
  }
  if (!submission.descriptor_map || !Array.isArray(submission.descriptor_map)) {
    errors.push('Missing or invalid required field: descriptor_map');
  }

  if (submission.descriptor_map) {
    submission.descriptor_map.forEach((descriptor, index) => {
      if (!descriptor.id) {
        errors.push(`Descriptor map ${index}: missing required field 'id'`);
      }
      if (!descriptor.format) {
        errors.push(`Descriptor map ${index}: missing required field 'format'`);
      }
      if (!descriptor.path) {
        errors.push(`Descriptor map ${index}: missing required field 'path'`);
      }
    });
  }

  if (errors.length > 0) {
    logger.warn('Presentation submission validation failed', { errors });
    return { valid: false, errors };
  }

  logger.info('Presentation submission validated successfully', { id: submission.id });
  return { valid: true };
}

/**
 * Extract array index from JSONPath expression
 * Example: "$.verifiableCredential[0]" => 0
 */
function extractIndexFromPath(path: string): number {
  const match = path.match(/\[(\d+)\]/);
  return match ? parseInt(match[1], 10) : -1;
}

/**
 * Evaluate if a Verifiable Presentation matches the Presentation Definition
 */
export function evaluatePresentationSubmission(
  vp: VerifiablePresentation,
  pd: PresentationDefinition
): { valid: boolean; errors?: string[]; matchedDescriptors?: string[] } {
  const errors: string[] = [];
  const matchedDescriptors: string[] = [];

  // Validate presentation submission exists
  const submission = vp.presentation_submission;
  if (!submission) {
    return { valid: false, errors: ['Missing presentation_submission in VP'] };
  }

  // Validate submission matches definition
  if (submission.definition_id !== pd.id) {
    errors.push(`Definition ID mismatch: expected ${pd.id}, got ${submission.definition_id}`);
    return { valid: false, errors };
  }

  // Get credentials from VP (handle both field names)
  const credentials = vp.verifiable_credential || vp.verifiableCredential || [];

  // Validate each input descriptor is satisfied
  for (const descriptor of pd.input_descriptors) {
    const mapping = submission.descriptor_map.find((m) => m.id === descriptor.id);

    if (!mapping) {
      if (!descriptor.constraints.fields?.some((f) => f.optional)) {
        errors.push(`No mapping found for required descriptor: ${descriptor.id}`);
      }
      continue;
    }

    // Check if credential exists at path
    try {
      const credentialIndex = extractIndexFromPath(mapping.path);
      if (credentialIndex === -1 || !credentials[credentialIndex]) {
        errors.push(`Credential not found at path ${mapping.path} for descriptor ${descriptor.id}`);
        continue;
      }

      matchedDescriptors.push(descriptor.id);
    } catch (error) {
      errors.push(
        `Error evaluating path ${mapping.path}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // Check if all required descriptors are matched
  const requiredDescriptors = pd.input_descriptors.filter(
    (d) => !d.constraints.fields?.every((f) => f.optional)
  );

  const allRequiredMatched = requiredDescriptors.every((d) => matchedDescriptors.includes(d.id));

  if (!allRequiredMatched) {
    errors.push('Not all required descriptors are satisfied');
  }

  if (errors.length > 0) {
    logger.warn('Presentation submission evaluation failed', {
      errors,
      matchedDescriptors,
    });
    return { valid: false, errors, matchedDescriptors };
  }

  logger.info('Presentation submission evaluation successful', {
    definitionId: pd.id,
    matchedDescriptors,
  });

  return { valid: true, matchedDescriptors };
}

/**
 * Create a basic Presentation Definition
 */
export function createPresentationDefinition(
  id: string,
  descriptors: Array<{
    id: string;
    name?: string;
    purpose?: string;
    credentialType: string;
    fields?: Array<{ path: string[]; purpose?: string; optional?: boolean }>;
  }>
): PresentationDefinition {
  const inputDescriptors: InputDescriptor[] = descriptors.map((desc) => ({
    id: desc.id,
    name: desc.name,
    purpose: desc.purpose,
    constraints: {
      fields: [
        {
          path: ['$.type'],
          filter: {
            type: 'array',
            contains: { const: desc.credentialType },
          },
        },
        ...(desc.fields || []).map((field) => ({
          path: field.path,
          purpose: field.purpose,
          optional: field.optional,
        })),
      ],
    },
  }));

  return {
    id,
    input_descriptors: inputDescriptors,
  };
}
