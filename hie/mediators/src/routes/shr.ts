// import express, { Request, response, Response } from "express";
// import { createClient, getOpenHIMToken, installChannels } from "../lib/utils";


// const router = express.Router();
// router.use(express.json());



// // Put
// router.put("/:id", async (req: Request, res: Response) => {
//     try {
        
//         let resource = req.body;
//         // let response = await getKeycloakUserToken(username, password);
//         // console.log(response);
//         res.statusCode = Object.keys(response).indexOf('error') < 0 ? 200 : 401 ;
//         res.json({ ...response, status: Object.keys(response).indexOf('error') < 0  ? "success" : "error"  , });
//         return;
//     }
//     catch (error) {
//         console.log(error);
//         res.statusCode = 401;
//         res.json({ error: "incorrect email or password", status: "error" });
//         return;
//     }
// });



// // Login
// router.post("/", async (req: Request, res: Response) => {
//     try {
//         let resource = req.body;
//         if (response === "Unauthorized" || response.indexOf("error") > -1) {
//             res.statusCode = 401;
//             res.json({ status: "error", error: response });
//             return;
//         }
//         res.statusCode = 201;
//         res.json({ status: "success", response });
//         return;
//     }
//     catch (error) {
//         console.log(error);
//         res.statusCode = 401;
//         res.json({ error: "incorrect email or password", status: "error" });
//         return;
//     }
// });

// export default router