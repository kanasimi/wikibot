#!/bin/sh

cd ~/tmp
wget -O node-latest-linux-x64.tar.xz https://nodejs.org/dist/latest/node-v5.10.0-linux-x64.tar.xz
tar xvf node-latest-linux-x64.tar.xz
rm -rf ~/node
mv node-latest-linux-x64 ~/node
rm node-latest-linux-x64.tar.xz
~/node/bin/node -v
