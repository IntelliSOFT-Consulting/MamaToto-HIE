import express, { Request, response, Response } from "express";

const router = express.Router();
router.use(express.json());



router.put("/:structureMap", async (req: Request, res: Response) => {
    try {
        
        const { structureMap } = req.params;
        const resource = req.body;
        // const patientId = req.body

        // let response = await getKeycloakUserToken(username, password);
        // console.log(response);
        res.statusCode = Object.keys(response).indexOf('error') < 0 ? 200 : 401 ;
        res.json({ ...response, status: Object.keys(response).indexOf('error') < 0  ? "success" : "error"  , });
        return;
    }
    catch (error) {
        console.log(error);
        res.statusCode = 401;
        res.json({ error: "incorrect email or password", status: "error" });
        return;
    }
});


export default router