#!/bin/bash
# Downloads the Higgsfield sounds, checks them, trims leading silence, evens out loudness, writes out/sounds/*.mp3
set -e
B=https://d8j0ntlcm91z4.cloudfront.net/user_3MBpZ643qhHhGn8CmuuGhr7oLkU
declare -A S=(
 [draw]=hf_20261121_164238_eeff02fc-6c30-4b66-b76e-04172c5e76a4 [play]=hf_20261121_164238_22331902-04c6-488b-8604-6b646e9d6693
 [cast]=hf_20261121_164238_dd59155b-968f-4697-9351-cd69234029ff [resolve]=hf_20261121_164238_3da41ce1-7493-400a-a8ff-041b8866b2bd
 [tap]=hf_20261121_164238_f6bd6b82-00ae-444d-9835-12a7332f1ff0 [attack]=hf_20261121_164238_d315479b-ec7e-45dd-81f0-55421db216c6
 [hit]=hf_20261121_164238_231632cb-ae82-4a27-b2b3-748e56591233 [gain]=hf_20261121_164238_045bb255-ae64-433e-8d66-3278dbfb71c9
 [turn]=hf_20261121_164238_a01dcc57-4691-461c-9a59-b90a2e18ec66 [shuffle]=hf_20261121_164238_0cc9c07c-7857-437d-9051-39c8bf1d30bb
 [win]=hf_20261121_164238_e2db0c99-074d-48d2-a0db-50508bf7310b [lose]=hf_20261121_164423_1df16972-9405-4d6b-94ed-a08fe701e0d8
 [music]=hf_20261121_164301_476223d3-1f3d-4636-9feb-2df20b8763fe )
which ffmpeg || (sudo apt-get update -qq && sudo apt-get install -y -qq ffmpeg)
mkdir -p out/sounds /tmp/raw
for n in "${!S[@]}"; do
  curl -sSf -o /tmp/raw/$n.mp3 "$B/${S[$n]}.mp3"
  d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 /tmp/raw/$n.mp3)
  vol=$(ffmpeg -hide_banner -i /tmp/raw/$n.mp3 -af volumedetect -f null - 2>&1 | grep -E "mean_volume|max_volume" | sed 's/.*\] //' | tr '\n' ' ')
  echo "RAW $n: ${d}s $vol"
  if [ "$n" = music ]; then
    ffmpeg -hide_banner -loglevel error -y -i /tmp/raw/$n.mp3 -af "loudnorm=I=-20:TP=-2:LRA=11,afade=t=in:d=1.5" -ac 2 -b:a 128k out/sounds/$n.mp3
  else
    ffmpeg -hide_banner -loglevel error -y -i /tmp/raw/$n.mp3 -af "silenceremove=start_periods=1:start_threshold=-50dB,loudnorm=I=-16:TP=-1.5:LRA=11,afade=t=out:st=$(python3 -c "print(max(0, $d - 0.15))"):d=0.15" -ac 1 -b:a 96k out/sounds/$n.mp3
  fi
  d2=$(ffprobe -v error -show_entries format=duration -of csv=p=0 out/sounds/$n.mp3)
  vol2=$(ffmpeg -hide_banner -i out/sounds/$n.mp3 -af volumedetect -f null - 2>&1 | grep -E "mean_volume|max_volume" | sed 's/.*\] //' | tr '\n' ' ')
  echo "OUT $n: ${d2}s $vol2 $(stat -c %s out/sounds/$n.mp3) bytes"
done
