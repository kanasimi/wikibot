#!/bin/sh
# 本檔案原初版本放置於 program/wiki/init.sh

echo "Initialize wiki bot works environment..."


SP="\n-----------------------------------------------------------"


cd ~

echo "$SP\nClone CeJS..."

# 若有更新，得自己刪除 ~/CeJS。
#rm -rf ~/CeJS
#/usr/bin/git clone https://github.com/kanasimi/CeJS.git

# update CeJS
[ -d "node_modules" ] || md node_modules
cd node_modules


# method 1:
#rm -rf cejs
#/usr/bin/git clone https://github.com/kanasimi/CeJS.git cejs

# method 2:
# /usr/bin/unzip -UU : 以 jsub @crontab 執行的時候會出現亂碼
# sh has no `time`, so we can not use `time /usr/bin/unzip` @ Debian Stretch 2019/3/15
# bash hash `time`
/usr/bin/wget -O CeJS.zip https://github.com/kanasimi/CeJS/archive/master.zip && [ -d cejs ] && /usr/bin/diff CeJS.zip CeJS.zip.old && mv -f CeJS.zip CeJS.zip.old && echo "CeJS: No news." || ( echo "Extracting CeJS..." && /usr/bin/unzip CeJS.zip > /dev/null && mv -f CeJS.zip CeJS.zip.old && rm -rf cejs && mv CeJS-master cejs && (cp -f "cejs/_for include/_CeL.loader.nodejs.js" ~/wikibot) && ( [ -d OpenCC ] && cp OpenCC/* cejs/extension/zh_conversion/OpenCC/ || echo "No OpenCC." ) || echo "Failed to get CeJS" )

# ---------------------------------------------------------
# 2019/9/12 18:25:17

echo "$SP\nUpdate wikiapi..."

/usr/bin/wget -O wikiapi.zip https://github.com/kanasimi/wikiapi/archive/master.zip && [ -d wikiapi ] && /usr/bin/diff wikiapi.zip wikiapi.zip.old && mv -f wikiapi.zip wikiapi.zip.old && echo "wikiapi: No news." || ( echo "Extracting wikiapi..." && /usr/bin/unzip wikiapi.zip > /dev/null && mv -f wikiapi.zip wikiapi.zip.old && rm -rf wikiapi && mv wikiapi-master wikiapi || echo "Failed to get CeJS" )

# ---------------------------------------------------------

echo "$SP\nCopy task programs..."

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
/usr/bin/wget -O wikibot.zip https://github.com/kanasimi/wikibot/archive/master.zip && [ -d wikibot ] && /usr/bin/diff wikibot.zip wikibot.zip.old && mv -f wikibot.zip wikibot.zip.old && echo "wikibot: No news." || ( echo "Extracting wikibot..." && /usr/bin/unzip wikibot.zip > /dev/null && mv -f wikibot.zip wikibot.zip.old && rsync -a --remove-source-files wikibot-master/ wikibot && rm -rf wikibot-master || echo "Failed to get wikibot" )
/bin/rm wikibot/*#U*

# ---------------------------------------------------------

#echo "$SP\n作必要的 link..."

#cd ~/wikibot

#[ -s "20150503.js" ] || ln -s 20150503.提報關注度不足過期提醒.js 20150503.js

# ---------------------------------------------------------

echo "$SP\nCopy config data..."

cd ~/wikibot

# upload data
# cd /home/kanashimi/www/cgi-bin/program && cp "wiki/wiki loader.js" . && chmod o+r "wiki loader.js"

# 不再用此招
#	mv -f "wiki loader.js" "wiki loader.js.old"
#	#/usr/bin/curl -o "wiki loader.js" http://lyrics.meicho.com.tw/program/wiki%20loader.js
#	/usr/bin/wget http://lyrics.meicho.com.tw/program/wiki%20loader.js || mv "wiki loader.js.old" "wiki loader.js" && echo "Please copy 'wiki loader.js' yourself."
echo pass

# ---------------------------------------------------------

#cd ~/wikibot

#ln -s ../node_modules/cejs/application/net/wiki.js js.js

# /bin/rm "wiki loader.js" archive

[ -f README.md ] && /bin/rm README.md

#chmod 700 *.sh

#ls -alFi

/bin/date "+%Y/%m/%d %H:%M:%S"
