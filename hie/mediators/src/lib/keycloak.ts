import fetch from "cross-fetch";


let KC_BASE_URL = String(process.env.KC_BASE_URL);
let KC_REALM = String(process.env.KC_REALM);
let KC_CLIENT_ID = String(process.env.KC_CLIENT_ID);
let KC_CLIENT_SECRET = String(process.env.KC_CLIENT_SECRET);


export const getKeycloakAdminToken = async () => {
  try {
      const tokenResponse = await fetch(`${KC_BASE_URL}/realms/${KC_REALM}/protocol/openid-connect/token`, {
          method: 'POST',
          headers: {'Content-Type': 'application/x-www-form-urlencoded',},
          body: new URLSearchParams({
            grant_type: 'client_credentials', client_id: KC_CLIENT_ID, client_secret: KC_CLIENT_SECRET, }),
        });
      const tokenData: any = await tokenResponse.json();
      // console.log(tokenData)
      return tokenData
  } catch (error) {
      return null;
  }
}



export const getKeycloakUserToken = async (idNumber: string, password: string) => {
    try {
        const tokenResponse = await fetch(`${KC_BASE_URL}/realms/${KC_REALM}/protocol/openid-connect/token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              grant_type: 'client_credentials',
              client_id: KC_CLIENT_ID,
              client_secret: KC_CLIENT_SECRET,
              username: idNumber,
              password,
            }),
          });
        const tokenData = await tokenResponse.json();
        console.log(tokenData);
        return tokenData;
    } catch (error) {
        console.log(error);
        return null;
    }
}

