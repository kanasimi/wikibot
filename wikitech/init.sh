#!/bin/sh

# 本檔案原初版本放置於 program/wiki/init.sh
# TODO: use webhooks: https://wikitech.wikimedia.org/wiki/Help:Toolforge/Auto-update_a_tool_from_GitHub/GitLab


fetch_file="/usr/bin/curl --silent --show-error --location --output"


echo "Initialize wiki bot works environment..."


SP="\n-----------------------------------------------------------"


cd ~

[ -d "bin" ] || md bin

[ -d "wikibot" ] || md wikibot

[ -d "node_modules" ] || md node_modules

#printf "$SP\nnpm update...\n"

#/mnt/nfs/labstore-secondary-tools-project/.shared/node/bin/npm install mysql
#/mnt/nfs/labstore-secondary-tools-project/.shared/node/bin/npm install opencc
#/mnt/nfs/labstore-secondary-tools-project/.shared/node/bin/npm install irc

# ---------------------------------------------------------

printf "$SP\nClone CeJS...\n"

# 若有更新，得自己刪除 ~/CeJS。
#rm -rf ~/CeJS
#/usr/bin/git clone https://github.com/kanasimi/CeJS.git

# update CeJS
cd node_modules

# method 1:
#rm -rf cejs
#/usr/bin/git clone https://github.com/kanasimi/CeJS.git cejs

# method 2:
# /usr/bin/unzip -UU : 以 jsub @crontab 執行的時候會出現亂碼
# sh has no `time`, so we can not use `time /usr/bin/unzip` @ Debian Stretch 2019/3/15
# bash hash `time`

# [[User:BDavis (WMF)|bd808]]:
# `toolforge jobs images` or `webservice --help` to see available images
# node18 starts from our bookworm base and then adds nodejs and a fewmore bits.
# everything has `curl`. Apparently we have `unzip` in bookworm based images. That should include the "node18" image.
# use `webservice node18 shell` to get an interactive shell inside a 'node18' container

$fetch_file CeJS.zip https://github.com/kanasimi/CeJS/archive/master.zip && [ -d cejs ] && /usr/bin/diff CeJS.zip CeJS.zip.old && mv -f CeJS.zip CeJS.zip.old && echo "CeJS: No news." || ( echo "Extracting CeJS..." && /usr/bin/unzip CeJS.zip > /dev/null && mv -f CeJS.zip CeJS.zip.old && rm -rf cejs && mv CeJS-master cejs && (cp -f "cejs/_for include/_CeL.loader.nodejs.js" ~/wikibot) && ( [ -d opencc/data/dictionary ] && cp -f opencc/data/dictionary/* cejs/extension/zh_conversion/OpenCC/ || echo "No OpenCC!" ) || echo "Failed to get CeJS!" )


# ---------------------------------------------------------
# 2019/9/12 18:25:17

printf "$SP\nUpdate wikiapi...\n"

$fetch_file wikiapi.zip https://github.com/kanasimi/wikiapi/archive/master.zip && [ -d wikiapi ] && /usr/bin/diff wikiapi.zip wikiapi.zip.old && mv -f wikiapi.zip wikiapi.zip.old && echo "wikiapi: No news." || ( echo "Extracting wikiapi..." && /usr/bin/unzip wikiapi.zip > /dev/null && mv -f wikiapi.zip wikiapi.zip.old && rm -rf wikiapi && mv wikiapi-master wikiapi || echo "Failed to get CeJS" )

# ---------------------------------------------------------

printf "$SP\nCopy task programs...\n"

#cd $HOME
cd ~

#if [ -d "wikibot" ]; then
 # extract all files, but don't touch files that are not in the branch.
 # Do not clean. 不清理。

 # method 1:
 #cd wikibot
 #rm -rf .git
 #/usr/bin/git clone --bare https://github.com/kanasimi/wikibot.git .git
 #/usr/bin/git init
 #/usr/bin/git checkout -f master

#else
 # rebuild a new one.
 #/usr/bin/git clone https://github.com/kanasimi/wikibot.git wikibot
 #cd wikibot
#fi

# method 2:
# /usr/bin/unzip -UU

$fetch_file wikibot.zip https://github.com/kanasimi/wikibot/archive/master.zip && [ -d wikibot ] && /usr/bin/diff wikibot.zip wikibot.zip.old && mv -f wikibot.zip wikibot.zip.old && echo "wikibot: No news." || ( echo "Extracting wikibot..." && /usr/bin/unzip wikibot.zip > /dev/null && mv -f wikibot.zip wikibot.zip.old && rsync -a --remove-source-files wikibot-master/ wikibot && rm -rf wikibot-master || echo "Failed to get wikibot" )

[ -e wikibot/*#U* ] && /bin/rm wikibot/*#U*

# ---------------------------------------------------------

printf "$SP\nCreate links...\n"

#cd ~

[ -e ~/bin/node ] || [ ! -e /shared/bin/node ] || ln -s /shared/bin/node ~/bin/

#cd ${HOME}/wikibot
cd ~/wikibot

[ -e "js.js" ] || ln -s ../node_modules/cejs/application/net/wiki.js js.js

#[ -s "20150503.js" ] || ln -s 20150503.提報關注度不足過期提醒.js 20150503.js

# ---------------------------------------------------------

printf "$SP\nCopy configurations...\n"

#cd ~/wikibot

# As kanashimi:
# cd ~ && cat > "wiki configuration.js"
# chmod o+x . && chmod o+r "wiki configuration.js"
# After:
# chmod o-x . && rm "wiki configuration.js"

if [ -r "/home/kanashimi/wiki configuration.js" ]; then
 [ -f "wiki configuration.js" ] && /bin/mv -f "wiki configuration.js" "archive/"
 # copy contents only.
 /bin/cp "/home/kanashimi/wiki configuration.js" "wiki configuration.js"
fi

# ---------------------------------------------------------

#cd ~/wikibot

[ -f "wikitech/init.sh" ] && /bin/cp -f "wikitech/init.sh" .
/bin/chmod u+x init.sh

[ -f README.md ] && /bin/rm README.md

#chmod 700 *.sh

#ls -alFi

/bin/date "+%Y/%m/%d %H:%M:%S"
