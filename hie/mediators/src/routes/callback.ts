import express from 'express';
import fetch from 'node-fetch';

let SURVEY_FOLLOW_UP = process.env['SURVEY_FOLLOW_UP_URL'] ?? '';
let ENROLMENT_CONFIRMATION = process.env['ENROLMENT_CONFIRMATION_URL'] ?? '';
let ENROLMENT_REJECTION = process.env['ENROLMENT_REJECTION_URL'] ?? '';

let TURN_IO_ACCESS_TOKEN = process.env['TURN_IO_ACCESS_TOKEN'] ?? '';

let urls: any = {
    SURVEY_FOLLOW_UP, ENROLMENT_CONFIRMATION, ENROLMENT_REJECTION
}

export const router = express.Router();

router.use(express.json());

/**
 * @openapi
 * /turn:
 *   post:
 *     summary: Turn.io Messaging Integration Endpoint
 *     description: >
 *       Handles sending messages via Turn.io WhatsApp integration with advanced error handling.
 *       Supports different message types and manages active session scenarios.
 *     tags:
 *       - Turn.io Integration
 * 
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - phone
 *             properties:
 *               type:
 *                 type: string
 *                 description: Type of message/action
 *                 enum: 
 *                   - SURVEY_FOLLOW_UP
 *                   - ENROLMENT_CONFIRMATION
 *                   - ENROLMENT_REJECTION
 *               phone:
 *                 type: string
 *                 description: Phone number in international format
 *                 example: "+1234567890"
 * 
 *     responses:
 *       200:
 *         description: Successful Turn.io message sending
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 * 
 *       400:
 *         description: Error in processing request
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                 details:
 *                   type: object
 * 
 *     security:
 *       - bearerAuth: []
 * 
 *     x-codeSamples:
 *       - lang: 'JavaScript'
 *         source: |
 *           fetch('/turn', {
 *             method: 'POST',
 *             headers: { 'Content-Type': 'application/json' },
 *             body: JSON.stringify({
 *               type: 'ENROLMENT_CONFIRMATION',
 *               phone: '+1234567890'
 *             })
 *           })
 * 
 *     x-scenarios:
 *       - name: Standard Message
 *         description: Send a standard enrolment confirmation message
 *       - name: Active Session Handling
 *         description: Automatically handles and resolves active session conflicts
 */

//process FHIR Beneficiary
router.post('/turn', async (req, res) => {
    try {
        let data = req.body;
        // console.log("CarePay Request Payload", data);

        // fetch patient & send payload to turn.io
        let turnResponse = (await (fetch(urls[data?.type], {
            method: "POST",
            body:JSON.stringify({"wa_id":`${data?.phone }`}),
            headers: {"Content-Type":"application/json", "Authorization":`Bearer ${TURN_IO_ACCESS_TOKEN}`}
        })))

        // console.log(`Res: ${JSON.stringify(turnResponse)}`)
        // res.statusCode =turnResponse.status;
        let turnResponseJson = await turnResponse.json();
        res.json(turnResponseJson);
        if(turnResponseJson?.errors?.[0]?.details.includes("active session")){
            let claim = await (await (fetch(`https://whatsapp.turn.io/v1/contacts/${(data.phone).replace(/^\+/, '')}/claim`, {
                method: "GET",
                headers: {"Accept":"application/vnd.v1+json", "Authorization":`Bearer ${TURN_IO_ACCESS_TOKEN}`}
            }))).json();
            console.log(claim);
            let deleteClaim = (await (fetch(`https://whatsapp.turn.io/v1/contacts/${(data.phone).replace(/^\+/, '')}/claim`, {
                method: "DELETE",
                body: JSON.stringify({claim_uuid: claim.uuid}),
                headers: {"Accept":"application/vnd.v1+json", "Authorization":`Bearer ${TURN_IO_ACCESS_TOKEN}`}
            })));
            console.log(deleteClaim);

            // try again 
            let turnResponse = (await (fetch(urls[data?.type], {
                method: "POST",
                body:JSON.stringify({"wa_id":`${data?.phone }`}),
                headers: {"Content-Type":"application/json", "Authorization":`Bearer ${TURN_IO_ACCESS_TOKEN}`}
            })));
            res.statusCode =turnResponse.status;
            let turnResponseJson = await turnResponse.json();
            console.log(turnResponseJson);
            res.json(turnResponseJson);
            return;
        }
        return;
    } catch (error) {
        console.error(error);
        res.statusCode = 400;
        res.json(error);
        return;
    }
});

/**
 * @openapi
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 * 
 *   schemas:
 *     TurnIoRequest:
 *       type: object
 *       required:
 *         - type
 *         - phone
 *       properties:
 *         type:
 *           type: string
 *           enum: 
 *             - SURVEY_FOLLOW_UP
 *             - ENROLMENT_CONFIRMATION
 *             - ENROLMENT_REJECTION
 *         phone:
 *           type: string
 *           description: Phone number with country code
 * 
 *     TurnIoResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         message:
 *           type: string
 *         errors:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               details:
 *                 type: string
 */

export default router;
