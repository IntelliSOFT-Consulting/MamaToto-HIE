cd fhir-data-pipes
docker network create cloudbuild
DWH_ROOT="$(pwd)/my-amazing-data" docker compose -f docker/compose-controller-spark-sql-single.yaml up -d --force-recreate