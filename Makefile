
.PHONY: all pot locale-js yuidoc
.SUFFIXES: .po .json .js

POT_SOURCES = js/Contacts.js js/OfflineWallet.js js/index.js
LOCALE_JSON_FILES = locale/ja.js

all:
	@echo "Available targets are:"
	@echo "\tpot        update translation template (locate in \"locale/template.pot\")"
	@echo "\tlocale-js  update translation JSON file from *.po file"
	@echo "\tyuidoc     make documentation"

# pot
pot: locale/template.pot
locale/template.pot: $(POT_SOURCES)
	xgettext --from-code=UTF-8 $(POT_SOURCES) -o$@

# locale-js
locale-js: $(LOCALE_JSON_FILES)
.json.js:
	echo -n "i18n_translations['$(shell basename $< .json)']=" >$@
	cat $< >>$@
	echo -n ";" >>$@
node_modules/po2json/bin/po2json:
	npm install po2json
.po.json:
	$(MAKE) node_modules/po2json/bin/po2json
	node_modules/po2json/bin/po2json $< $@

# yuidoc
yuidoc:
	yuidoc -o doc .

