/** @file index.js
 * Scripts needed for index.html.
 */

const DONATION_ADDRESSES = {
	BTC:  '1GwRV1BqSc8tBfeFfwGyrRHQXyafujZSfW',
	MONA: 'MAuFbsULnchrHMqEzwoqvWrXuTxPQMPUrp',
};
const N_RECENT_TRANSACTIONS = 10;

const NDEBUG = false;

var owallet = null;
var recent_transactions = [];

var log = function(){
	if(!NDEBUG) console.log(arguments);
}

var escapeHTML = function(html){
	return jQuery('<div>').text(html).html();
}

var numberFormat = function(num){
	return num.toString().replace(/^\d+[^\.]/, function(t){return t.replace(/([\d]+?)(?=(?:\d{3})+$)/g, function(t){ return t + ','; });});
}

var dateFormat = function(t){
	var date = new Date(t);
	var html = date.getFullYear()+'/'+('00'+date.getMonth()).substr(-2)+'/'+('00'+date.getDate()).substr(-2)+' '+
		('00'+date.getHours()).substr(-2)+':'+('00'+date.getMinutes()).substr(-2)+':'+('00'+date.getSeconds()).substr(-2);
	return html;
}

var decorateAddress = function(addr, opts){
	var linkPrefix = (opts && opts.linkPrefix) ? opts.linkPrefix : (owallet ? OfflineWallet.getSymbolLinkPrefix(owallet.symbol) : 'monacoin');
	var html = '<a href="'+linkPrefix+':' + addr + '">'+linkPrefix+'</a>:' + addr;
	var appendLabel = opts && opts.appendLabel;
	if(appendLabel){
		var label = Contacts.findByAddress(addr);
		if(label != null) html+=' ['+escapeHTML(label)+']';
	}
	return html;
}

var hsv2rgb = function(hsv){
	var h = hsv.h;
	var s = hsv.s;
	var v = hsv.v;
	var r = v;
	var g = v;
	var b = v;
	if(s > 0.0){
		h *= 6.0;
		var i = Math.floor(h);
		var f = h - i;
		switch(i){
			default:
			case 0:
				g *= 1 - s * (1 - f);
				b *= 1 - s;
				break;
			case 1:
				r *= 1 - s * f;
				b *= 1 - s;
				break;
			case 2:
				r *= 1 - s;
				b *= 1 - s * (1 - f);
				break;
			case 3:
				r *= 1 - s;
				g *= 1 - s * f;
				break;
			case 4:
				r *= 1 - s * (1 - f);
				g *= 1 - s;
				break;
			case 5:
				g *= 1 - s;
				b *= 1 - s * f;
				break;
		}
	}
	return {
		r: r,
		g: g,
		b: b,
	};
}

var rgb2css = function(rgb){
	return 'rgb('+(100*rgb.r)+'%,'+(100*rgb.g)+'%,'+(100*rgb.b)+'%)';
}

var changeCurrency = function(symbol){
	localStorage.setItem('symbol', symbol);
	window.location.reload();
}

var getCurrency = function(){
	var symbol = localStorage.getItem('symbol');
	return symbol || 'MONA';
}

var updateRecipientLabel = function(i){
	var address = $('#recipient-addr-'+i).val();
	var label = Contacts.findByAddress(address);
	if(label !== null){
		$('#recipient-label-'+i).html(escapeHTML(label));
	}else{
		$('#recipient-label-'+i).html(+_('(Unknown label)'));
	}
}

var n_recipients = 0;
var addRecipient = function(){
	var html = '<tr id="recipient-'+n_recipients+'"><th>#'+(n_recipients+1)+'</th><td>';
	html += '\
		<div class="form-group">\
			<label class="control-label">'+_('Recipient address')+'</label>\
			<div class="input-group" style="max-width:700px;">\
				<span class="input-group-addon">'+OfflineWallet.getSymbolLinkPrefix(owallet.symbol)+':</span>\
				<input type="text" class="form-control" placeholder="'+DONATION_ADDRESSES[owallet.symbol]+'" id="recipient-addr-'+n_recipients+'" oninput="updateRecipientLabel('+n_recipients+');" list="datalist-recipients" />\
				<span class="input-group-addon" id="recipient-label-'+n_recipients+'" style="min-width:200px;">'+_('Unknown label')+'</span>\
			</div>\
		</div>\
	';
	//html += '<div class="form-group"><label class="control-label">ラベル</label><div class="input-group"><span class="input-group-addon">label:</span><input type="text" class="form-control" placeholder="送金後、ここで指定したラベルでアドレス帳に登録されます" id="recipient-label-' + n_recipients + '" /></div></div>';
	html += '\
		<div class="form-group">\
			<label class="control-label">'+_('Amount to send')+'</label>\
			<div class="input-group" style="max-width:300px;">\
				<input type="text" class="form-control" placeholder="1.234" id="recipient-amount-' + n_recipients + '" />\
				<span class="input-group-addon">'+owallet.symbol+'</span>\
			</div>\
		</div>\
	';
	html += '</td></tr>';
	$('#recipients').append(html);
	n_recipients++;
}

var removeRecipient = function(){
	if(n_recipients <= 0) return;
	n_recipients--;
	$('#recipient-'+n_recipients).remove();
}

var send = function(){
	var totalAmountSend = 0;
	var totalAmountUnspent = 0;
	var createOuts = function(){
		var outs = [];
		for(var i=0; i<n_recipients; i++){
			var address = $('#recipient-addr-'+i).val();
			//var label = $('#recipient-label-'+i).val();
			var amount = parseFloat($('#recipient-amount-'+i).val());
			totalAmountSend += amount;
			// Checks for address validity.
			if(!owallet.isValidAddress(address)){
				throw new Error(_('The address for receipient #%d is not valid').replace('%d', i+1));
			}
			// Checks for amount.
			if(amount < 1e-8 || !isFinite(amount)){
				throw new Error(_('The amount to send for receipient #%d is not valid').replace('%d', i+1));
			}
			outs[i] = {
				address: address,
				amount: amount,
			};
		}
		// Donation to the developer.
		var donation = parseFloat($('#donation-amount').val());
		if(donation > 0){
			outs[n_recipients] = {
				address: DONATION_ADDRESSES[owallet.symbol],
				amount: donation,
			};
		}
		return outs;
	}
	var createUnspents = function(){
		var unspents = [];
		owallet.unspents.forEach(function(tx){
			var checked = $('#check-coin-control-'+tx.txid+':checked').val();
			if(checked){
				totalAmountUnspent += tx.amount;
				unspents[unspents.length] = tx;
			}
		});
		if(unspents.length == 0) throw new Error(_('No unspent transaction is selected'));
		return unspents;
	}
	$('#loading-modal').modal('show');
	setTimeout(function(){
		try{
			// Set transaction fee.
			var fee = parseFloat($('#transaction-fee').val());
			if(isNaN(fee)) fee=1e-8*OFFLINE_WALLET_FEE_SAT_DEFAULT[owallet.symbol];
			if(fee < 0){
				throw new Error(_('Transaction fee is negative'));
			}
			log('send(): fee input:', fee);
			localStorage.setItem(owallet.symbol+'.fee', fee);
			owallet.setFee(fee);
			var outs = createOuts();
			var unspents = createUnspents();
			// Checks for totalAmount.
			if(totalAmountSend + owallet.getFee() > totalAmountUnspent){
				throw new Error(_('Insufficient funds'));
			}
			var tx = owallet.createTransaction(outs, {unspents:unspents});
			// Show confirmation dialog.
			var stdtx = tx.getStandardizedObject();
			log('send(): std tx:', stdtx);
			var rawtx = tx.serialize().toString('hex');
			// Calculate actual fee.
			var actualFee = 0;
			log('send(): unspents:', owallet.unspents);
			stdtx.in.forEach(function(txin){
				owallet.unspents.forEach(function(uns){
					if(uns.txid == txin.prev_out.hash && uns.vout == txin.prev_out.n){
						actualFee += Math.round(1e8 * uns.amount);
					}
				});
			});
			stdtx.out.forEach(function(txout){
				actualFee -= Math.round(1e8 * txout.value);
			});
			log('send(): actualFee:', actualFee);
			var body = '<p>'+_('Send a transaction as follows. Are you sure?')+'</p>';
			body += '<table class="table">';
			body += '<tr><th>'+_('TX ID')+'</th><td style="word-break:break-all;">' + stdtx.hash + '</td></tr>';
			body += '<tr><th>'+_('Receipient')+'</th><td><ul class="list-unstyled">';
			for(var i=0; i<outs.length; i++){
				body += '<li>' + decorateAddress(outs[i].address) + ' (' + numberFormat(outs[i].amount.toFixed(8)) + ' <span class="symbol">'+owallet.symbol+'</span>)</li>';
			}
			body += '</ul></td></tr>';
			body += '<tr><th>'+_('Fee')+'</th><td>' + (1e-8*actualFee).toFixed(8) + ' <span class="symbol">'+owallet.symbol+'</span></td></tr>';
			//body += '<tr><th>生トランザクション</th><td style="word-break:break-all;">' + rawtx + '</td></tr>';
			body += '</table>';
			$('#loading-modal').modal('hide');
			showConfirmModal(_('Confirm transfer'), body, function(){
				// Confirm button was clicked!
				$('#loading-modal').modal('show');
				setTimeout(function(){
					owallet.sendTransaction(tx, function(){
						// Reset send form.
						for(;n_recipients>0;) removeRecipient();
						addRecipient();
						refetch(function(){
							$('#loading-modal').modal('hide');
							showOkModal(_('Transaction sent successfully'), _('Your transaction has been successfully sent to the network'));
						});
					});
				}, 500);
			});
		}catch(e){
			log('send(): error:', e);
			$('#loading-modal').modal('hide');
			showOkModal(_('Transaction send error'), '<p>'+_('An error has occured during sending a transaction:')+'</p><p>'+e.toString()+'</p>');
		}
	}, 500);
	
	return true;
}

var refetch = function(callback){
	// Fetch unspent transactions for user.
	owallet.fetchUnspents(function(data){
		refreshBalance();
		// Fetch transactions.
		owallet.fetchTransactions(function(data){
			refreshTransactions();
			refreshCoinControl();
			if(typeof callback === 'function'){
				callback();
			}
		});
	});
}

/**
 * Set current account balance.
 */
var refreshBalance = function(){
	$('#balance-header').html(numberFormat(owallet.balance.confirmed.toFixed(4)));
	$('#balance-confirmed').html(numberFormat(owallet.balance.confirmed.toFixed(8)));
	$('#balance-unconfirm').html(numberFormat(owallet.balance.unconfirm.toFixed(8)));
}

var refreshTransactions = function(){
	// Clear.
	$('#tbody-history').empty();
	$('#tbody-recent-transactions').empty();
	// Handle for each.
	for(var i=0; i<owallet.transactions.txs.length; i++){
		var tx = owallet.transactions.txs[i];
		var issend = false;
		var amount = 0;
		tx.vin.forEach(function(vin){
			if(vin.addr == owallet.getAddress()){
				issend = true;
				amount -= parseFloat(vin.value);
			}
		});
		tx.vout.forEach(function(vout){
			vout.scriptPubKey.addresses.forEach(function(addr){
				if(addr == owallet.getAddress()){
					amount += parseFloat(vout.value);
				}
			});
		});
		//
		// For #tbody-history tab.
		(function(){
			var html = '<tr>';
			// Confirmations
			html += '<td>' + (tx.confirmations || _('unconfirmed')) + '</td>';
			// Date
			html += '<td>' + dateFormat(1000 * (tx.time || tx.firstSeenTs)) + '</td>';
			// Type
			html += '<td>' + (issend ? '<span class="send">'+_('Send')+'</span>' : '<span class="recv">'+_('Receive')+'</span>') + '</td>';
			// Address
			html += '<td><ul class="list">';
			var createAddressRecord = function(addr, amount){
				if(typeof amount == 'string'){
					amount = parseFloat(amount);
				}
				return '<li><div>' + decorateAddress(addr) + '</div><div style="margin-left:10px;">' + numberFormat(amount.toFixed(8)) + ' <span class="symbol">'+owallet.symbol+'</span></div></li>';
			};
			if(issend){
				tx.vout.forEach(function(vout){
					vout.scriptPubKey.addresses.forEach(function(addr){
						if(addr != owallet.getAddress()){
							html += createAddressRecord(addr, vout.value);
						}
					});
				});
			}else{
				tx.vin.forEach(function(vin){
					if(vin.addr != owallet.getAddress()){
						html += createAddressRecord(vin.addr, vin.value);
					}
				});
			}
			html += '</ul></td>';
			// Amount
			html += '<td><span class="' + (issend ? 'send' : 'recv') + '">'
				+ numberFormat(amount.toFixed(4)) + ' <span class="symbol">'+owallet.symbol+'</span></span></td>';
			// Transaction id.
			html += '<td style="width:200px;word-break:break-all;"><a href="' + owallet.getInsightEndpoint() + '/tx/' + tx.txid + '" target="_blank"><span class="glyphicon glyphicon-new-window"></span> ' + tx.txid + '</a></td>';
			html += '</tr>';
			$('#tbody-history').append(html);
		})();
		//
		// For #tbody-recent-transactions.
		if(i < N_RECENT_TRANSACTIONS) (function(){
			var html = '<tr>';
			// Date
			html += '<td>' + dateFormat(1000 * (tx.time || tx.firstSeenTs)) + '</td>';
			// Type
			html += '<td>' + (issend ? '<span class="send">'+_('Send')+'</span>' : '<span class="recv">'+_('Receive')+'</span>') + '</td>';
			// Amount
			html += '<td><span class="' + (issend ? 'send' : 'recv') + '">'
				+ numberFormat(amount.toFixed(4)) + ' <span class="symbol">'+owallet.symbol+'</span></span></td>';
			html += '</tr>';
			$('#tbody-recent-transactions').append(html);
		})();
	}
}

var refreshCoinControl = function(){
	log('refreshCoinControl(): unspents:', owallet.unspents);
	$('#tbody-coin-control').empty();
	var uns = [].concat(owallet.unspents);
	uns.sort(function(a, b){
		// Sort according to coin age (ca).
		var a_ca = a.amount * a.confirmations;
		var b_ca = b.amount * b.confirmations;
		return a_ca == b_ca ? 0 : (a_ca > b_ca ? -1 : 1);
	});
	log('refreshCoinControl(): unspents (sorted):', uns);
	uns.forEach(function(tx){
		// Find transaction data.
		var tx2 = null;
		owallet.transactions.txs.forEach(function(t){
			if(t.txid == tx.txid){
				tx2 = t;
			}
		});
		var html = '<tr>';
		html += '<td><input type="checkbox" id="check-coin-control-'+tx.txid+'" checked="checked" /></td>';
		html += '<td>'+tx.amount.toFixed(8)+' <span class="symbol">'+owallet.symbol+'</span></td>';
		html += '<td>';
		var tmp = [];
		tmp['count'] = 0;
		tx2.vin.forEach(function(tt){
			if(tt.addr != owallet.getAddress()){
				if(tmp[tt.addr]) return;
				tmp[tt.addr] = true;
				tmp['count']++;
				html += '<div>'+decorateAddress(tt.addr)+'</div>';
			}
		});
		if(tmp['count'] == 0){
			html += '<div>('+_('Unknown sender')+')</div>';
		}
		html += '</td>';
		html += '<td>'+dateFormat(1000*tx.ts)+'</td>';
		html += '<td>'+tx.confirmations+'</td>';
		html += '</tr>';
		$('#tbody-coin-control').append(html);
	});
	
	
}

var addContacts = function(){
	var addr = $('#add-contacts-address').val();
	var label = $('#add-contacts-label').val();
	if(Contacts.insert(owallet, addr, label)){
		var html = '<p>'+_('Registered the following address:')+'</p><table><tr><th>'+_('Label')+'</th><td>'+escapeHTML(label)+'</td></tr><tr><th>'+_('Address')+'</th><td>'+decorateAddress(addr, {appendLabel:false})+'</td></tr></table>';
		showOkModal(_('Contact successfully registered'), html);
		refreshContacts();
	}else{
		showOkModal(_('Failed to register a contact'), '<p>'+_('An error has occured during registering a contact. Please check the address again.')+'</p>');
	}
}

var refreshContacts = function(){
	// Render contact list.
	var list = Contacts.list();
	$('#contacts-table').html('<tr><th>'+_('Label')+'</th><th>'+_('Address')+'</th><th>'+_('Action')+'</th></tr>');
	list.forEach(function(l){
		var html = '<tr>';
		html += '<td>' + escapeHTML(l.label) + '</td>';
		html += '<td>' + decorateAddress(l.address, {appendLabel:false}) + '</td>';
		html += '<td><div class="btn-toolbar">';
		html += '<div class="btn-group"><button class="btn btn-primary" onclick="$(\'#add-contacts-label\').val(\''+l.label+'\');$(\'#add-contacts-address\').val(\''+l.address+'\');"><span class="glyphicon glyphicon-pencil"></span> '+_('Edit')+'</button></div>';
		html += '<div class="btn-group"><button class="btn btn-danger" onclick="Contacts.remove(\''+l.address+'\');refreshContacts();"><span class="glyphicon glyphicon-remove-sign"></span> '+_('Delete')+'</button></div>';
		html += '</div></td>';
		html += '</tr>';
		$('#contacts-table').append(html);
	});
	// Set datalist.
	$('#datalist-recipients').empty();
	list.forEach(function(l){
		var html = '<option value="'+l.address+'">'+escapeHTML(l.label)+'</option>';
		$('#datalist-recipients').append(html);
	});
}

var showConfirmModal = function(title, content, callback){
	$('#confirm-modal .modal-title').html(title);
	$('#confirm-modal .modal-body').html(content);
	$('#confirm-modal .btn-primary').unbind();
	$('#confirm-modal .btn-primary').click(function(e){
		$(e.target).parent();
		if(typeof callback === 'function'){
			callback(e);
		}
		$('#confirm-modal').modal('hide');
	});
	$('#confirm-modal').modal('show');
}

var showOkModal = function(title, content){
	$('#ok-modal .modal-title').html(title);
	$('#ok-modal .modal-body').html(content);
	$('#ok-modal').modal('show');
}

var n_notifications = 0;
var original_title;
$(function(){
	original_title = $('title').text();
});
var showNotification = function(title, content){
	var updateTitle = function(){
		if(n_notifications < 1){
			$('title').text(original_title);
		}else{
			$('title').text('('+n_notifications+') ' + original_title);
		}
	}
	var html = '<div class="notif-item">';
	html += '<div class="notif-title"><span class="glyphicon glyphicon-remove"></span> '+title+'</div>';
	html += '<div class="notif-body">'+content+'</div>';
	html += '</div>';
	var elem = $(html);
	elem.click(function(e){
		$(e.currentTarget).fadeOut('slow');
		n_notifications--;
		updateTitle();
	});
	$('#notif-area-left').append(elem);
	n_notifications++;
	updateTitle();
}

var showNetworkNotification = function(title, content){
	var html = '<div class="notif-item">';
	html += '<div class="notif-title"><span class="glyphicon glyphicon-remove"></span> '+title+'</div>';
	html += '<div class="notif-body">'+content+'</div>';
	html += '</div>';
	var elem = $(html);
	setTimeout(function(){
		elem.fadeOut('slow');
	}, 3000);
	$('#notif-area-right').append(elem);
}

var getSavedPassphrase = function(symbol, storage){
	var str = storage.getItem(symbol+'.passphrase');
	if(str == null) return [];
	return JSON.parse(str);
}

var addSavedPassphrase = function(symbol, storage, p){
	var saved = getSavedPassphrase(symbol, storage);
	// Checks if already registered.
	if($.inArray(p, saved) >= 0) return;
	saved[saved.length] = p;
	storage.setItem(symbol+'.passphrase', JSON.stringify(saved));
}

var removeSavedPassphrase = function(symbol, storage, p){
	var saved = getSavedPassphrase(symbol, storage);
	var index = $.inArray(p, saved);
	if(index < 0) return;
	saved.splice(index, 1);
	storage.setItem(symbol+'.passphrase', JSON.stringify(saved));
}

/****************************************************************************************************
 * Initialization routines.
 ****************************************************************************************************/

var togglePanel = function(me){
	$(me).parent().parent().children('.panel-body').slideToggle();
	$(me).children('.glyphicon').toggleClass('glyphicon-expand');
	$(me).children('.glyphicon').toggleClass('glyphicon-collapse-down');
}

$(function(){
	
	//
	// Initialize.
	$('.N_RECENT_TRANSACTIONS').html(N_RECENT_TRANSACTIONS);
	$("[data-toggle='tooltip']").tooltip({delay:{show:100,hide:300}});
	$('a[class=link-new-window]').attr('target', '_blank');
	$('a[class=link-new-window]').prepend('<span class="glyphicon glyphicon-new-window"></span> ');
	$('.panel .panel-heading').prepend('<span class="glyphicon glyphicon-collapse-down"></span> ').wrapInner('<a href="#" onclick="togglePanel(this);"></a>');
	$('.panel-inactive .panel-heading a').click();
	// Get symbol.
	var symbol = getCurrency();
	var symbolName = OfflineWallet.getSymbolName(symbol);
	if(!symbolName){
		if(getLang() == 'ja') symbol = 'MONA';
		else symbol = 'BTC';
		symbolName = OfflineWallet.getSymbolName(symbol);
	}
	Contacts.prefix = symbol + '.Contacts.';
	$('.text-symbol').html(symbol);
	$('.text-symbol-name').html(symbolName);
	//
	// Show saved passphrase list.
	var insertPassphraseCandidate = function(p, type){
		var ow = new OfflineWallet(p, 'passphrase', symbol);
		var addr = ow.getAddress();
		var hue = ow.getHue();
		var rgb = hsv2rgb({
			h: hue,
			s: 0.8,
			v: 1.0,
		});
		var html = '<div class="btn-group">';
		html += '<button type="button" class="btn btn-default" style="cursor:pointer;" onclick="removeSavedPassphrase(\''+symbol+'\','+type+'Storage,\''+p+'\');window.location.reload();"><span class="glyphicon glyphicon-remove"></span></button>';
		html += '<button type="button" class="btn btn-default" style="color:white;background-color:'+rgb2css(rgb)+';" onclick="$(\'#passphrase\').val(\''+p+'\');$(\'#login-form\').submit();">' + addr + '</button>';
		html += '</div>';
		$('#savedPassphraseList').append(html);
	}
	getSavedPassphrase(symbol, sessionStorage).forEach(function(p){insertPassphraseCandidate(p,'session')});
	getSavedPassphrase(symbol, localStorage  ).forEach(function(p){insertPassphraseCandidate(p,'local')});
	
	//
	// Set forcus to the passphrase input area.
	$('#passphrase').focus();
	
	//
	// Register login button callback.
	$('#login-form').submit(function(e){
		$('#loading-modal').modal('show');
		setTimeout(function(){
			// Fetch passphrase.
			var passphrase = $('#passphrase').val();
			// Check if passphrase has sufficient length.
			if(passphrase.length < 20){
				$('#loading-modal').modal('hide');
				showOkModal(_('Passphrase too short'), '<p>'+_('Passphrase must be longer than 20 letters.')+'</p>');
				return;
			}
			// Fetch passphrase save preference.
			var save = $('input[name="savePassphrase"]:checked').val();
			switch(save){
				case 'local':
					addSavedPassphrase(symbol, localStorage, passphrase);
					break;
				case 'session':
					addSavedPassphrase(symbol, sessionStorage, passphrase);
					break;
				default:
			}
			// Create OfflineWallet instance.
			owallet = new OfflineWallet(passphrase, 'passphrase', symbol);
			addRecipient();
			$('.input-address').attr({placeholder:DONATION_ADDRESSES[owallet.symbol]});
			// Set show secret button trigger.
			$('.btn-show-secrets').click(function(){
				showConfirmModal(
					_('Are you sure to display your secret keys?'),
					'<p>'+_('We will show your secret keys. Please check the following points.')+'</p><ul class="list"><li>'+_('No one stands behaind you')+'</li><li>'+_('No screen capture software is launched')+'</li></ul>',
					function(){
						var html = '<p>'+_('Your secret key information is shown below.')+'</p><table class="table table-striped">';
						html += '<tr><td style="min-width:100px;">'+_('Passphrase')+'</td><td>'+escapeHTML(owallet.passphrase)+'</td></tr>';
						html += '<tr><td>'+_('Secret key')+'</td><td style="word-break:break-all;">'+owallet.getPrivKey()+'</td></tr>';
						html += '<tr><td>'+_('Secret key')+'<br />(<a href="https://en.bitcoin.it/wiki/Wallet_import_format" target="_blank"><span class="glyphicon glyphicon-new-window"></span> WIF</a>)</td><td style="word-break:break-all;">'+owallet.getPrivKeyWIF()+'</td></tr>';
						html += '<tr><td>'+_('Public key')+'</td><td style="word-break:break-all;">'+owallet.getPubKey()+'</td></tr>';
						html += '<tr><td>'+_('Wallet address')+'</td><td>'+owallet.getAddress()+'</td></tr>';
						html += '</table>';
						showOkModal(_('Secret key information'), html);
					});
			});
			// Get fee preference.
			var fee = parseFloat(localStorage.getItem(owallet.symbol+'.fee'));
			if(!isNaN(fee)){
				owallet.setFee(fee);
			}else{
				fee = owallet.getFee();
			}
			log('init: localStorage[fee]:', fee);
			$('#transaction-fee').val(fee.toFixed(8));
			// Set color theme.
			var hue = owallet.getHue();
			log('init: hue for this user:', hue);
			var rgb = hsv2rgb({
				h: hue,
				s: 0.05,
				v: 1.00,
			});
			$('body').css('backgroundColor', rgb2css(rgb));
			$('.only-after-login').css('display', 'inline');
			owallet.connectWebSocket({
				block: function(block){
					// Always refetch because #confirmations will be updated.
					refetch();
				},
				tx: function(tx){
					// Fetch transaction information.
					$.getJSON(owallet.getInsightApiEndpoint()+'/tx/'+tx.txid+'?callback=?', function(data){
						// Check if the transaction includes my address.
						var shouldRefresh = false;
						var issend = false;
						var amount = 0;
						data.vin.forEach(function(vin){
							if(vin.addr == owallet.getAddress()){
								shouldRefresh = true;
								issend = true;
								amount -= vin.value;
							}
						});
						data.vout.forEach(function(vout){
							vout.scriptPubKey.addresses.forEach(function(addr){
								if(addr == owallet.getAddress()){
									shouldRefresh = true;
									amount += vout.value;
								}
							});
						});
						if(shouldRefresh){
							if(!issend){
								var html = '<p>'+_('Received the following deposit transaction.')+'</p>';
								html += '<table>';
								html += '<tr><th>'+_('Date and time')+':</th><td>' + dateFormat(1000 * (data.time || data.firstSeenTs)) + '</td></tr>';
								html += '<tr><th>'+_('Amount to deposit')+':</th><td>'+amount.toFixed(8)+'</td></tr>';
								html += '</table>';
								showNotification(_('Deposit notification'), html);
							}
							refetch();
						}
						//var html = '<p>'+_('Size')+': '+data.size+', '+_('Tx ID')+': '+data.txid+', '+_('Value out')+': '+data.valueOut+'</p>';
						//showNetworkNotification(_('Tx received'), html);
					});
				},
			});
			Contacts.insert(owallet, DONATION_ADDRESSES[owallet.symbol], _('Developer donation address'));
			if(Contacts.findByAddress(owallet.getAddress()) == null){
				Contacts.insert(owallet, owallet.getAddress(), _('My address'));
			}
			refreshContacts();
			// Show/hide modals.
			$('#loading-modal').modal('hide');
			showOkModal(_('Logged in'), '<div class="text-center">'+_('Log in successfully!')+'</div>');
			setTimeout(function(){
				$('#ok-modal').modal('hide');
			}, 2000);
			// Switch tabs.
			$('#login-tab').hide();
			$('#control-tab').fadeIn();
			//
			//Refresh data.
			$('#myaddr').html(decorateAddress(owallet.getAddress(), {appendLabel:false}));
			// Refetch user data.
			refetch();
		}, 500);
		return false;
	});
	
	// Register send button callback.
	$('#send-form').submit(function(e){
		send();
		return false;
	});
	
});

