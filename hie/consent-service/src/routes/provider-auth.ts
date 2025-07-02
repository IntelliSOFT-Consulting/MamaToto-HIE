import express, { Request, Response } from "express";
import { deleteResetCode, findKeycloakUser, getCurrentUserInfo, getKeycloakUserToken, getKeycloakUsers, registerKeycloakUser, updateUserPassword, updateUserProfile, validateResetCode, refreshToken } from '../lib/keycloak'
import { v4 } from "uuid";
import { sendPasswordResetEmail, sendRegistrationConfirmationEmail } from "../lib/email";

const router = express.Router();
router.use(express.json());


const generatePassword = (length: number) =>
    Array.from({ length }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+~`|}{[]:;?><,./-='.charAt(Math.floor(Math.random() * 94))).join('');

router.post("/register", async (req: Request, res: Response) => {
    try {
        // get id number and unique code
        let { name, idNumber, password, email, phone, facility } = req.body;
        if (!password) {
            password = generatePassword(12);
        }

        idNumber = String("POC-" + v4().replace(/-/g, '')).toUpperCase();
        password = v4().replace(/-/g, '');

        console.log(req.body);
        if (!facility || !name || !email) {
            return res.status(400).json({ status: "error", error: "facility, name, email and role are required" });
        }
        
        let keycloakUser = await registerKeycloakUser(idNumber, email, phone, name, facility, password, null, null, null);
        if (!keycloakUser) {
            res.statusCode = 400;
            res.json({ status: "error", error: "Failed to register client system" });
            return;
        }
        if (Object.keys(keycloakUser).indexOf('error') > -1) {
            res.statusCode = 400;
            res.json({ ...keycloakUser, status: "error" });
            return;
        }
        // sendRegistrationConfirmationEmail(email, password, idNumber);
        res.statusCode = 201;
        res.json({ response: keycloakUser.success, status: "success", data: {clientId: idNumber, clientSecret: password } });
        return;
    }
    catch (error) {
        console.log(error);
        res.statusCode = 401;
        res.json({ error: "incorrect email or password", status: "error" });
        return;
    }
});

router.post("/login", async (req: Request, res: Response) => {
    try {
        let { clientId, clientSecret } = req.body;
        let token = await getKeycloakUserToken(clientId, clientSecret);
        if (!token) {
            res.statusCode = 401;
            res.json({ status: "error", error: "Incorrect Client ID & Secret provided" });
            return;
        }
        if (Object.keys(token).indexOf('error') > -1) {
            res.statusCode = 401;
            res.json({ status: "error", error: `${token.error} - ${token.error_description}` })
            return;
        }
        

        let userInfo = await findKeycloakUser(clientId);
        if (!userInfo) {
            res.statusCode = 401;
            res.json({ status: "error", error: "Client not found" });
            return;
        }

        res.statusCode = 200;
        res.json({ ...token, status: "success" });
        return;
    }
    catch (error) {
        console.log(error);
        res.statusCode = 401;
        res.json({ error: "incorrect email or password", status: "error" });
        return;
    }
});

router.post("/refresh_token", async (req: Request, res: Response) => {
    try {
        let { refresh_token } = req.body;
        let token = await refreshToken(refresh_token);
        if (!token) {
            res.statusCode = 401;
            res.json({ status: "error", error: "Invalid refresh token provided" });
            return;
        }
        res.statusCode = 200;
        res.json({ ...token, status: "success" });
        return;
    }
    catch (error) {
        console.log(error);
        res.statusCode = 401;
        res.json({ error: "Invalid refresh token provided", status: "error" });
        return;
    }
});

router.post('/reset-password', async (req: Request, res: Response) => {
    try {
        let { idNumber, password, resetCode } = req.body;
        let resetResp = await validateResetCode(idNumber, resetCode)
        if (!resetResp) {
            res.statusCode = 401;
            res.json({ error: "Failed to update new password. Try again", status: "error" });
            return;
        }
        let resp = updateUserPassword(idNumber, password);
        deleteResetCode(idNumber);
        if (!resp) {
            res.statusCode = 401;
            res.json({ error: "Failed to update new password. Try again", status: "error" });
            return;
        }
        res.statusCode = 200;
        res.json({ response: "Password updated successfully", status: "success" });
        return;
    } catch (error) {
        console.error(error);
        res.statusCode = 401;
        res.json({ error: "Invalid Bearer token provided", status: "error" });
        return;
    }
});


router.get('/reset-password', async (req: Request, res: Response) => {
    try {
        let { idNumber, email } = req.query;
        // console.log(encodeURIComponent(String(email)))
        let userInfo = await findKeycloakUser(String(idNumber));
        console.log(userInfo);
        if (userInfo.email.toLowerCase() !== String(email).toLowerCase()) {
            res.statusCode = 400;
            res.json({ status: "error", error: "Failed to initiate password reset. Invalid account details." })
            return;
        }
        idNumber = String(idNumber);
        let resp = await sendPasswordResetEmail(idNumber);
        if (!resp) {
            res.statusCode = 400;
            res.json({ status: "error", error: "Failed to initiate password reset. Try again." })
            return;
        }
        res.statusCode = 200;
        res.json({ status: "success", response: "Check your email for the password reset code sent." })
        return;
    } catch (error) {
        console.error(error);
        res.statusCode = 401;
        res.json({ error: "Failed to initiate password reset", status: "error" });
        return;
    }
});


export default router