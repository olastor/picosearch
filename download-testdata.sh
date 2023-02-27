#!/bin/bash

set -e
set -o pipefail

corpora="scifact nfcorpus scidocs"
for c in $corpora; do
  echo "Downloading $c"
  mkdir -p "test/testdata/benchmark/$c"
  wget "https://public.ukp.informatik.tu-darmstadt.de/thakur/BEIR/datasets/$c.zip"
  unzip "$c.zip" -d "test/testdata/benchmark/"
  rm "$c.zip"
done

