#!/bin/bash

echo "Building Custom Mediators Image:"
docker build -t mamatoto-hie/mediators:local -f ./hie/mediators/Dockerfile ./hie/mediators --no-cache