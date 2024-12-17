import requests

# PRODUCTION OPENHIM 
PROD_IOL_URL = "https://openhim-core.mamatoto.pharmaccess.io"
PROD_IOL_USERNAME = "fhir-subscription"
PROD_IOL_PASSWORD = "password55"

# DEV OPENHIM
PROD_IOL_URL = "https://openhim-comms.intellisoftkenya.com"
PROD_IOL_USERNAME = "fhir-subscription"
PROD_IOL_PASSWORD = "password55"


CAREPAY_PROD_BASE_URL = ""
CAREPAY_DEV_BASE_URL = "https://api.ken-test.mtiba.dev/api/v3"



# 1. Replay all enrollment based on the new enhancements.
# 2. Pull, process and Resend all the Questionnaires from transaction information.


def fetch_openhim_transactions():
    pass

def simulate_turn_transactions(patient, patientId):
    pass

def fetch_carepay_patient(phone_number):
    patient = requests.get("{}".format(CAREPAY_PROD_BASE_URL))
    pass

def post_to_iol(path, data, mode="dev"):
    pass

def replay_failed_transactions():
    pass