# MamaToto HIE & Mediation services

This repository contains the logic for implementing the mediation service used within the MamaToto HIE stack for completing the relevant workflows.

## Standalone instance

To create a standalone instance of the service, you will need to run the below commands.

Note: This service has external dependecies which need to be up and running. 


Create the env file and populate the relevant variables

```
cp .env.example .env
```

Run the instance in development mode:

```
yarn dev
```

The service should now be accessible on http://localhost:3000

## Platform Instance

The Platform instance will scaffold a project architecture which contains a couple of dependant services which are required for the entire workflow to be tested.

### Prerequisites:

1. Docker
1. An Active Docker Swarm

### Getting Started:

1. Check that you have an active docker swarm running on the respective environment. `docker info | grep Swarm`
1. If no swarm is running, you can start a swarm with `docker swarm init`.
1. Run `./get-cli.sh` to download the latest release of the CLI. You can download only the specific CLI for your operating system by providing it as a parameter. (e.g. `./get-cli.sh linux`)
1. Create the env file and populate the relevant variables (e.g. `cp .env.example .env`)
1. NB! The custom images used within the project will need to be built before running the deployment to ensure the Docker images are available for use. Run the below command to build the custom images: `./build-custom-images.sh`
1. Run the relevant deploy script. (e.g. `./instant-linux package init -p local --concurrency=1`)

### Access the services

1. OpenHIM
    1. Console: [http://localhost:9000/](http://localhost:9000/)
        1. `root@openhim.org:instant101`
    1. Core API: https://localhost:8080
    1. Core Transaction: http://localhost:5001/ or https://localhost:5000/
        1. Request Header: `Authorization: Custom test`
1. Hapi FHIR
    1. http://localhost:3447/

#### Test Request

Send a test request to the OpenHIM to process the FHIR Bundle be executing the below cURL command

```
curl --location 'http://localhost:5001/fhir' \
--header 'Authorization: Custom test' \
--header 'Content-Type: application/json' \
--data @resources/SHR-Bundle-BMI-Observation.json
```
