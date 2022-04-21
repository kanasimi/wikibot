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

LASTEST_VER=latest
# 2022/4/21 16:47:0	node-v18.0.0 will cause `node: /lib/x86_64-linux-gnu/libm.so.6: version `GLIBC_2.27' not found (required by node)` @ wmflabs.org
LASTEST_VER=latest-v17.x

LASTEST=`curl https://nodejs.org/dist/$LASTEST_VER/SHASUMS256.txt | grep "linux-x64.tar.xz" | awk '{print $2}'`
VERSION=`$NODE -v`

(echo $LASTEST|grep $VERSION) && echo `/bin/date "+%Y%m%d"` - We have the lastest node: $VERSION && exit

###########################################################
# update node.js.

cd $TMP

# extract program
/usr/bin/wget -O $LASTEST https://nodejs.org/dist/$LASTEST_VER/$LASTEST
/bin/tar xvf $LASTEST
/bin/rm $LASTEST

# install
/bin/rm -rf $TARGET_DIR
/bin/mv node-v*-linux-x64 $TARGET_DIR

/bin/cp $TARGET_DIR/bin/* $BIN_DIR/
/bin/ln -f $TARGET_DIR/bin/node $NODE
$NODE -v

#/mnt/nfs/labstore-secondary-tools-project/.shared/node/bin/npm update
