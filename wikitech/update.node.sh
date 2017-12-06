#!/bin/sh
# ~/bin/update.node.sh
# 2016/4/4 10:49:8

umask 0022

# ~/node
TARGET_DIR=/shared/node

# ~/tmp
TMP=/tmp

BIN_DIR=/shared/bin
NODE=$BIN_DIR/node

LASTEST=`curl https://nodejs.org/dist/latest/SHASUMS256.txt | grep "linux-x64.tar.xz" | awk '{print $2}'`
VERSION=`$NODE -v`

(echo $LASTEST|grep $VERSION) && echo `/bin/date "+%Y%m%d"` - We have the lastest node: $VERSION && exit

###########################################################
# update node.js.

cd $TMP

# extract program
/usr/bin/wget -O $LASTEST https://nodejs.org/dist/latest/$LASTEST
/bin/tar xvf $LASTEST
/bin/rm $LASTEST

# install
/bin/rm -rf $TARGET_DIR
/bin/mv node-v*-linux-x64 $TARGET_DIR

/bin/cp $TARGET_DIR/bin/* $BIN_DIR/
/bin/ln -f $TARGET_DIR/bin/node $NODE
$NODE -v
