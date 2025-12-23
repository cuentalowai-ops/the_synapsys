import { Request, Response, Router } from 'express';
import { logger } from '../config/logger';
import {
  getVPSessionByState,
  completeVPSession,
  updateSessionStatus,
} from '../services/sessionService';
import {
  validatePresentationSubmission,
  evaluatePresentationSubmission,
  type VerifiablePresentation,
} from '../lib/presentationDefinition';
import { decodeJWT } from '../lib/jwt';

/**
 * OpenID4VP Direct Post Endpoint
 * Receives VP tokens from wallets via direct_post response mode
 * https://openid.net/specs/openid-4-verifiable-presentations-1_0.html
 */

const router = Router();

/**
 * POST /direct_post
 * Receives VP token from wallet
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    logger.info('Direct post request received', {
      body: req.body,
      ip: req.ip,
    });

    const { vp_token, presentation_submission, state } = req.body;

    // Validate required parameters
    if (!vp_token) {
      res.status(400).json({
        error: 'invalid_request',
        error_description: 'Missing vp_token parameter',
      });
      return;
    }

    if (!state) {
      res.status(400).json({
        error: 'invalid_request',
        error_description: 'Missing state parameter',
      });
      return;
    }

    // Get session by state
    const session = await getVPSessionByState(state);

    if (!session) {
      res.status(400).json({
        error: 'invalid_request',
        error_description: 'Invalid or expired state parameter',
      });
      return;
    }

    if (session.status !== 'pending') {
      res.status(400).json({
        error: 'invalid_request',
        error_description: `Session is ${session.status}, expected pending`,
      });
      return;
    }

    // Decode and validate VP token (JWT format)
    let vpPayload: VerifiablePresentation;

    try {
      const decoded = decodeJWT(vp_token);

      if (!decoded.valid || !decoded.payload) {
        await updateSessionStatus(session.id, 'failed');
        res.status(400).json({
          error: 'invalid_vp_token',
          error_description: 'Failed to decode VP token',
        });
        return;
      }

      // Extract VP from JWT payload
      vpPayload = decoded.payload.vp
        ? (decoded.payload.vp as VerifiablePresentation)
        : (decoded.payload as unknown as VerifiablePresentation);
    } catch (error) {
      logger.error('Failed to decode VP token', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      await updateSessionStatus(session.id, 'failed');
      res.status(400).json({
        error: 'invalid_vp_token',
        error_description: 'Invalid VP token format',
      });
      return;
    }

    // Validate presentation submission
    let submissionData = presentation_submission;

    if (typeof submissionData === 'string') {
      try {
        submissionData = JSON.parse(submissionData);
      } catch (error) {
        await updateSessionStatus(session.id, 'failed');
        res.status(400).json({
          error: 'invalid_request',
          error_description: 'Invalid presentation_submission JSON',
        });
        return;
      }
    }

    // If no presentation_submission in request, check VP
    if (!submissionData && vpPayload.presentation_submission) {
      submissionData = vpPayload.presentation_submission;
    }

    if (!submissionData) {
      await updateSessionStatus(session.id, 'failed');
      res.status(400).json({
        error: 'invalid_request',
        error_description: 'Missing presentation_submission',
      });
      return;
    }

    const submissionValidation = validatePresentationSubmission(submissionData);

    if (!submissionValidation.valid) {
      await updateSessionStatus(session.id, 'failed');
      res.status(400).json({
        error: 'invalid_presentation_submission',
        error_description: `Invalid presentation_submission: ${submissionValidation.errors?.join(', ')}`,
      });
      return;
    }

    // Evaluate if VP matches presentation definition
    const evaluation = evaluatePresentationSubmission(vpPayload, session.presentation_definition);

    if (!evaluation.valid) {
      logger.warn('Presentation submission evaluation failed', {
        sessionId: session.id,
        errors: evaluation.errors,
      });
      await updateSessionStatus(session.id, 'failed');
      res.status(400).json({
        error: 'invalid_presentation',
        error_description: `Presentation does not match definition: ${evaluation.errors?.join(', ')}`,
      });
      return;
    }

    // Complete the session
    const completed = await completeVPSession(
      session.id,
      vp_token,
      submissionData as Record<string, unknown>
    );

    if (!completed) {
      res.status(500).json({
        error: 'server_error',
        error_description: 'Failed to complete session',
      });
      return;
    }

    logger.info('VP token received and validated successfully', {
      sessionId: session.id,
      matchedDescriptors: evaluation.matchedDescriptors,
    });

    // Return success with redirect URI if provided
    if (session.redirect_uri) {
      res.json({
        redirect_uri: `${session.redirect_uri}?state=${state}`,
      });
    } else {
      res.json({
        status: 'success',
        message: 'VP token received and validated successfully',
      });
    }
  } catch (error) {
    logger.error('Direct post request failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    res.status(500).json({
      error: 'server_error',
      error_description: 'Failed to process VP token',
    });
  }
});

export default router;
