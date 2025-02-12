import requests
import json

MONGO_PROD_URL = "mongodb://openhim-comms.intellisoftkenya.com:27017/"

# PRODUCTION OPENHIM 
PROD_IOL_URL = "https://openhim-core.mamatoto.pharmaccess.io"
PROD_IOL_USERNAME = "fhir-subscription"
PROD_IOL_PASSWORD = "password55"

# DEV OPENHIM
DEV_IOL_URL = "https://openhim-core-mamatoto.intellisoftkenya.com"
DEV_IOL_USERNAME = "fhir-subscription"
DEV_IOL_PASSWORD = "password55"


CAREPAY_PROD_BASE_URL = ""
CAREPAY_DEV_BASE_URL = "https://api.ken-test.mtiba.dev/api/v3"



# 1. Replay all enrollment based on the new enhancements.
# 2. Pull, process and Resend all the Questionnaires from transaction information.
def fetch_openhim_transactions():
    from pymongo import MongoClient
    # Connect to the MongoDB server
    client = MongoClient("mongodb://localhost:27017/")  # Update with your MongoDB URI if needed
    
    # Select the database
    db = client["openhim"]

    # Select the collection
    collection = db["transactions"]
    
    # Fetch all documents
    documents = collection.find(limit=0)
    
    res = []
    # Print the documents
    for doc in documents:
        # print(doc['request'])
        request = doc['request']
        response = doc['response']
        res.append({"request": request, "response": response})
        
    return res


def get_qr_transactions():    
    tx = fetch_openhim_transactions()
    res = []
    for t in tx:
        if t['request']:
            _path = (t['request']['path'])
            if _path == '/custom/QuestionnaireResponse' or _path == '/custom/QuestionnaireResponse':
                res.append(t)
    
    return res


QUESTIONNAIRE_RESPONSE_TRANSACTIONS = get_qr_transactions()


def simulate_turn_transactions(patient, patientId):
    pass

def fetch_carepay_patient(phone_number):
    patient = requests.get("{}".format(CAREPAY_PROD_BASE_URL))
    pass

def post_to_iol(path, data, mode="DEV"):
    try:
        response = requests.post("{}{}".format(PROD_IOL_URL if mode == "PROD" else DEV_IOL_URL), path, json=data,
                    auth=(PROD_IOL_USERNAME if mode == "PROD" else DEV_IOL_USERNAME, 
                          PROD_IOL_PASSWORD if mode == "PROD" else DEV_IOL_PASSWORD))
        print(response)
    except Exception as e:
        print(str(e))
        return None

def put_to_shr(resource_type, data, mode="DEV"):
    try:
        response = requests.put("{}/fhir/{}/{}".format(PROD_IOL_URL if mode == "PROD" else DEV_IOL_URL, resource_type, data['id']), json=data,
                    auth=(PROD_IOL_USERNAME if mode == "PROD" else DEV_IOL_USERNAME, 
                          PROD_IOL_PASSWORD if mode == "PROD" else DEV_IOL_PASSWORD))
        print(response)
    except Exception as e:
        print(str(e))
        return None

def replay_failed_questionnaire_responses():
    
    failed_qrs = get_qr_transactions()
    for qr in failed_qrs:
        # print(qr['request']['body'])
        data = qr['request']['body']
        put_to_shr("QuestionnaireResponse", json.loads(data))
    pass

replay_failed_questionnaire_responses()