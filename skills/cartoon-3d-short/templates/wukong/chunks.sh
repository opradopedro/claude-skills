#!/bin/bash
cd /tmp/claude-0/wk
for r in 0-149 150-299 300-449 450-599 600-749 750-899 900-1049 1050-1145; do
  [ -s out/c_$r.mp4 ] && continue
  for try in 1 2; do
    node render.mjs out/c_$r.mp4 $r 4 1 > out/c_$r.log 2>&1 && break
    rm -rf /tmp/remotion-webpack-bundle-*
  done
  rm -rf /tmp/remotion-webpack-bundle-*
  echo "chunk $r $(ls -la out/c_$r.mp4 2>/dev/null | awk '{print $5}')"
done
echo ALLDONE
