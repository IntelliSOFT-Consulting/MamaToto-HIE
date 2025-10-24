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
        request = doc['request']
        # print(request)
        # response = doc.get('response', doc.get('error'))
        res.append({"request": request})
        
    return res


def get_qr_transactions():    
    tx = fetch_openhim_transactions()
    res = []
    for t in tx:
        if t['request']:
            _path = (t['request']['path'])
            print(_path)
            if _path == '/custom/QuestionnaireResponse' or _path == '/fhir/QuestionnaireResponse':
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
        data['id'] = data['subject']['reference'].replace('/', '-')
        data = json.loads(json.dumps(data).replace('valuecoding', 'valueCoding').replace('valuedate', 'valueDate').replace('valuestring', 'valueString'))
        response = requests.put("{}/fhir/{}/{}".format(PROD_IOL_URL if mode == "PROD" else DEV_IOL_URL, resource_type, data['id']), json=data,
                    auth=(PROD_IOL_USERNAME if mode == "PROD" else DEV_IOL_USERNAME, 
                          PROD_IOL_PASSWORD if mode == "PROD" else DEV_IOL_PASSWORD))
        print(response.json())
    except Exception as e:
        print(str(e))
        return None
    
def post_to_shr(resource_type, data, mode="DEV"):
    try:
        data['id'] = data['subject']['reference'].replace('/', '-')
        response = requests.post("{}/fhir/{}/{}".format(PROD_IOL_URL if mode == "PROD" else DEV_IOL_URL, resource_type, data['id']), json=data,
                    auth=(PROD_IOL_USERNAME if mode == "PROD" else DEV_IOL_USERNAME, 
                          PROD_IOL_PASSWORD if mode == "PROD" else DEV_IOL_PASSWORD))
        print(response)
    except Exception as e:
        print(str(e))
        return None

def replay_failed_questionnaire_responses(mode):
    
    failed_qrs = get_qr_transactions()
    for qr in failed_qrs:
        # print(qr['request']['body'])
        data = qr['request']['body']
        print(data)
        try:
            put_to_shr("QuestionnaireResponse", json.loads(data), mode)
        except Exception as e:
            print(e)
    pass
