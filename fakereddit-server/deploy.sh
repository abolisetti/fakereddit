#!/bin/bash

echo What should the version be?
read VERSION
docker build -t abolisetti/fakereddit:$VERSION .
docker push abolisetti/fakereddit:$VERSION

ssh root@128.199.5.171 "docker pull abolisetti/fakereddit:$VERSION && docker tag abolisetti/fakereddit:$VERSION dokku/api:$VERSION && dokku tags:deploy api $VERSION"

