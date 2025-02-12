import os

from scripts.rebuild import replay_failed_questionnaire_responses

ENV = os.getenv("ENV", "DEV")

replay_failed_questionnaire_responses(ENV)
