#!/bin/bash

echo "Building Custom Mediators Image:"
docker build -t mamatoto-hie/mediators:local -f ./packages/mock-claims-post-office/Dockerfile ./packages/mock-claims-post-office --no-cache

echo "Building Custom Mediation Service Image:"
docker build -t mamatoto-hie/custom-mediation-service:local -f ../Dockerfile ../ --no-cache