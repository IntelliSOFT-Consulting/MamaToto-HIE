import express from 'express';
import { fetchApprovedEndorsements, fetchVisits } from '../lib/carepay';

export const router = express.Router();

router.use(express.json());


router.get('/visits', async (req, res) => {
    try {
      fetchVisits();
      res.statusCode = 200;
      res.json({status: 'ok'});
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

router.get('/endorsments', async (req, res) => {
  try {
    fetchApprovedEndorsements();
    res.statusCode = 200;
    res.json({status: 'ok'});
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