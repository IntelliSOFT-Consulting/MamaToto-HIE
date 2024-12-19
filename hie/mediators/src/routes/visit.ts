import express from 'express';
import { FhirApi, sendTurnNotification } from '../lib/utils';
import fetch from 'node-fetch';

export const router = express.Router();

router.use(express.json());

/**
 * @openapi
 * /notifications/Encounter/{id}:
 *   put:
 *     summary: Process FHIR Encounter Notification
 *     description: >
 *       Handles notification processing for a completed Encounter:
 *       - Checks Encounter status
 *       - Verifies status change
 *       - Sends follow-up survey notification via Turn.io
 *     tags:
 *       - FHIR Notifications
 *       - Encounters
 * 
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: FHIR Encounter resource ID
 * 
 *     responses:
 *       200:
 *         description: Successful Encounter processing
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: '#/components/schemas/Encounter'
 *                 - $ref: '#/components/schemas/TurnNotificationResponse'
 *       400:
 *         description: Error in processing Encounter
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OperationOutcome'
 * 
 *     x-workflow:
 *       steps:
 *         - Retrieve Encounter by ID
 *         - Validate Encounter status
 *         - Check previous Encounter version
 *         - Retrieve associated Patient
 *         - Send Turn.io notification
 * 
 *     x-error-handling:
 *       - Checks for completed Encounter
 *       - Validates status change
 *       - Handles notification send failures
 */

/**
 * @openapi
 * components:
 *   schemas:
 *     Encounter:
 *       type: object
 *       properties:
 *         resourceType:
 *           type: string
 *           enum: ['Encounter']
 *         status:
 *           type: string
 *           enum: ['planned', 'in-progress', 'finished', 'cancelled']
 *         subject:
 *           type: object
 *           properties:
 *             reference:
 *               type: string
 *               description: Reference to Patient resource
 *         meta:
 *           type: object
 *           properties:
 *             versionId:
 *               type: string
 *             tag:
 *               type: array
 *               items:
 *                 type: object
 * 
 *     TurnNotificationResponse:
 *       type: object
 *       properties:
 *         code:
 *           type: number
 *         message:
 *           type: string
 *         data:
 *           type: object
 * 
 *     OperationOutcome:
 *       type: object
 *       properties:
 *         resourceType:
 *           type: string
 *           enum: ['OperationOutcome']
 *         id:
 *           type: string
 *         issue:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               severity:
 *                 type: string
 *                 enum: ['error']
 *               code:
 *                 type: string
 *                 enum: ['exception']
 *               details:
 *                 type: object
 *                 properties:
 *                   text:
 *                     type: string
 */

//process FHIR Subscriptions for Encounters
router.put('/notifications/Encounter/:id', async (req, res) => {
  try {
    let { id } = req.params;
    let data = await (await FhirApi({ url: `/Encounter/${id}` })).data;
    let tag = data.meta?.tag ?? null;
    console.log(data.status);

    // console.log(tag, identifiers);
    if (data.status !== "finished") {
      res.statusCode = 200;
      // console.log("found: ", tag, identifiers);
      res.json(data);
      return;
    }

    let previousVersion = await (await FhirApi({ url: `/Encounter/${id}/_history/${parseInt(data?.meta?.versionId) - 1}` })).data;
    if (previousVersion.status === data.status) {
      // visit status hasn't changed
      res.statusCode = 200;
      res.json(data);
      return;
    }

    let patient = await (await FhirApi({ url: `/${data?.subject?.reference}` })).data;

    let response = await sendTurnNotification(patient, "SURVEY_FOLLOW_UP")
    if (response.code >= 400) {
      res.statusCode = response.code;
      res.json({
        "resourceType": "OperationOutcome",
        "id": "exception",
        "issue": [{
          "severity": "error",
          "code": "exception",
          "details": {
            "text": `Failed to post beneficiary- ${JSON.stringify(response)}`
          }
        }]
      });
      return;
    }
    res.statusCode = 200;
    res.json(response);
    return;
  } catch (error) {
    console.error(error);
    res.statusCode = 400;
    res.json({
      "resourceType": "OperationOutcome",
      "id": "exception",
      "issue": [{
        "severity": "error",
        "code": "exception",
        "details": {
          "text": `Failed to post beneficiary- ${JSON.stringify(error)}`
        }
      }]
    });
    return;
  }
});

export default router;