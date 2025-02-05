import express, { Request, response, Response } from "express";
import { createClient, getOpenHIMToken, installChannels } from "../lib/utils";
import { getKeycloakAdminToken, getKeycloakUserToken } from "../lib/keycloak";


const router = express.Router();
router.use(express.json());

// Login
router.post("/token", async (req: Request, res: Response) => {
    try {
        
        let { username, password } = req.body;
        // let response = await getKeycloakUserToken(username, password);
        let response = await getKeycloakAdminToken()
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



// Login
router.post("/client", async (req: Request, res: Response) => {
    try {
        await getOpenHIMToken();
        let { name, password } = req.body;
        let response = await createClient(name, password);
        if (response === "Unauthorized" || response.indexOf("error") > -1) {
            res.statusCode = 401;
            res.json({ status: "error", error: response });
            return;
        }
        res.statusCode = 201;
        res.json({ status: "success", response });
        return;
    }
    catch (error) {
        console.log(error);
        res.statusCode = 401;
        res.json({ error: "incorrect email or password", status: "error" });
        return;
    }
});

export default router;