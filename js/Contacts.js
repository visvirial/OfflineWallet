/** @file Contacts.js
 * We store as
 *   localStorage['Contacts.'+address] = label.
 */

var Contacts = function(){
	// Do nothing.
}

Contacts.prefix = 'MONA.Contacts.';

Contacts.isSupported = function(){
	return (typeof localStorage !== 'undefined')
};

Contacts.findByAddress = function(addr){
	if(!this.isSupported()) return null;
	var label = localStorage.getItem(Contacts.prefix + addr);
	return label;
};

Contacts.list = function(){
	var list = [];
	var j = 0;
	for(var i=0; i<localStorage.length; i++){
		var key = localStorage.key(i);
		var searchLen = Contacts.prefix.length;
		if(key.substring(0, searchLen) != Contacts.prefix) continue;
		var addr = key.substring(searchLen);
		var label = localStorage.getItem(key);
		list[j++] = {
			address: addr,
			label: label,
		};
	}
	// Sort according to label.
	list.sort(function(a, b){
		return (a.label == b.label ? 0 : (a.label < b.label ? -1 : 1));
	});
	return list;
};

Contacts.insert = function(owallet, addr, label){
	// Check if address is valid
	if(!owallet.isValidAddress(addr)) return false;
	localStorage.setItem(Contacts.prefix + addr, label);
	return true;
};

Contacts.remove = function(addr){
	localStorage.removeItem(Contacts.prefix + addr);
}

Contacts.prototype = {
};

