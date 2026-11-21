#!/bin/bash
# Downloads the Higgsfield sounds, checks them, trims leading silence, evens out loudness, writes out/sounds/*.mp3
set -e
B=https://d8j0ntlcm91z4.cloudfront.net/user_3MBpZ643qhHhGn8CmuuGhr7oLkU
declare -A S=(
 [draw]=hf_20261121_164726_09d66a07-8ce7-4c1b-8d4d-78cbb9fdd46e [play]=hf_20261121_164726_9e5fea56-fdaf-4c54-af19-d5cbb389fd75
 [cast]=hf_20261121_164726_9a07833d-1eb6-4ac5-a927-2c2021db18c0 [tap]=hf_20261121_164726_aa11d799-4ad2-490c-bab3-0bc369ec04cd
 [shuffle]=hf_20261121_164729_f04f8224-e11e-4799-a6fa-324deb8432ae [counter]=hf_20261121_164726_4f6c6b67-6551-41ea-acbb-adbee3d82a16
 [dice]=hf_20261121_164726_80fc6a4a-787f-4ff5-881b-5a52cfeb9120 [gain]=hf_20261121_164726_68f09157-26ef-495b-bb54-4bc70a1df885
 [attack]=hf_20261121_164747_2388a6bf-01af-463f-aaa8-f470ecb29fbe [turn]=hf_20261121_164746_cacb411f-1ad4-4445-89b1-08c901345a8a
 [hit]=hf_20261121_164746_01380ab8-dfd7-4172-82ee-df3b93ef62b9 [token]=hf_20261121_164746_c6302b59-5103-4f62-8acf-a0b32b6e1d93
 [win]=hf_20261121_164746_bc59914a-2a5d-4862-af12-6827c7727ae7 [lose]=hf_20261121_164746_be173fcd-6104-49d6-954a-0f7dea1bb7d7
 [music1]=hf_20261121_164746_214ae917-e116-4a62-bbad-b4d433ee7a85 [music2]=hf_20261121_164920_0273a92c-5112-44cf-b3a6-d7cabd2aa926 )
which ffmpeg || (sudo apt-get update -qq && sudo apt-get install -y -qq ffmpeg)
mkdir -p out/sounds /tmp/raw
for n in "${!S[@]}"; do
  curl -sSf -o /tmp/raw/$n.mp3 "$B/${S[$n]}.mp3"
  d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 /tmp/raw/$n.mp3)
  vol=$(ffmpeg -hide_banner -i /tmp/raw/$n.mp3 -af volumedetect -f null - 2>&1 | grep -E "mean_volume|max_volume" | sed 's/.*\] //' | tr '\n' ' ')
  echo "RAW $n: ${d}s $vol"
  if [[ "$n" == music* ]]; then
    ffmpeg -hide_banner -loglevel error -y -i /tmp/raw/$n.mp3 -af "loudnorm=I=-22:TP=-2:LRA=11,afade=t=in:d=2" -ac 2 -b:a 128k out/sounds/$n.mp3
  else
    ffmpeg -hide_banner -loglevel error -y -i /tmp/raw/$n.mp3 -af "silenceremove=start_periods=1:start_threshold=-50dB,loudnorm=I=-16:TP=-1.5:LRA=11,afade=t=out:st=$(python3 -c "print(max(0, $d - 0.15))"):d=0.15" -ac 1 -b:a 96k out/sounds/$n.mp3
  fi
  d2=$(ffprobe -v error -show_entries format=duration -of csv=p=0 out/sounds/$n.mp3)
  vol2=$(ffmpeg -hide_banner -i out/sounds/$n.mp3 -af volumedetect -f null - 2>&1 | grep -E "mean_volume|max_volume" | sed 's/.*\] //' | tr '\n' ' ')
  echo "OUT $n: ${d2}s $vol2 $(stat -c %s out/sounds/$n.mp3) bytes"
done
