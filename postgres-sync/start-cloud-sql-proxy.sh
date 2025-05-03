#!/bin/bash
# This script starts the Cloud SQL Proxy for PostgreSQL and connects to a local PostgreSQL instance.
sudo docker run -d -p 127.0.0.1:5432:5432 gcr.io/cloud-sql-connectors/cloud-sql-proxy:2.15.2 --address 0.0.0.0 --port 5432 mamatoto-instance