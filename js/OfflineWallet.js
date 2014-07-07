/** @file OfflineWallet.js
 * 
 */

var bitcore = bitcore || require('bitcore');

var hex = function(hex) {return new bitcore.Buffer(hex, 'hex');};

const OFFLINE_WALLET_NETWORKS = {
	BTC: {
		name: 'livenet',
		magic: hex('f9beb4d9'),
		addressVersion: 0x00,
		privKeyVersion: 128,
		P2SHVersion: 5,
		hkeyPublicVersion: 0x0488b21e,
		hkeyPrivateVersion: 0x0488ade4,
		genesisBlock: {
			hash: hex('6FE28C0AB6F1B372C1A6A246AE63F74F931E8365E15A089C68D6190000000000'),
			merkle_root: hex('3BA3EDFD7A7B12B27AC72C3E67768F617FC81BC3888A51323A9FB8AA4B1E5E4A'),
			height: 0,
			nonce: 2083236893,
			version: 1,
			prev_hash: bitcore.buffertools.fill(new bitcore.Buffer(32), 0),
			timestamp: 1231006505,
			bits: 486604799,
		},
		dnsSeeds: [
			'seed.bitcoin.sipa.be',
			'dnsseed.bluematt.me',
			'dnsseed.bitcoin.dashjr.org',
			'seed.bitcoinstats.com',
			'seed.bitnodes.io',
			'bitseed.xf2.org'
		],
		defaultClientPort: 8333
	},
	MONA: {
		name: 'livenet',
		magic: hex('fbc0b6db'),  // Monacoin: increase each by adding 2 to bitcoin's value
		addressVersion: 50,  // Monacoin: address start with M
		privKeyVersion: 178,
		P2SHVersion: 5,  // Monacoin: XXX
		bip32publicVersion: 0x0488b21e,  // Monacoin: XXX
		bip32privateVersion: 0x0488ade4,  // Monacoin: XXX
		genesisBlock: {
			hash: hex('B68B8C410D2EA4AFD74FB56E370BFC1BEDF929E1453896C9E79DD116011C9FFF'),  // Monacoin: genesis hash
			merkle_root: hex('A64BAC07FE31877F31D03252953B3C32398933AF7A724119BC4D6FA4A805E435'),  // Monacoin: merkle root
			height: 0,
			nonce: 1234534,  // Monacoin: nonce
			version: 1,
			prev_hash: bitcore.buffertools.fill(new bitcore.Buffer(32), 0),
			timestamp: 1388479472,  // Monacoin: start at 2014/01/01
			bits: 504365040,  // Monacoin: difficulty bits
		},
		dnsSeeds: [
			'dnsseed.monacoin.org',
			'alice.monapool.net',
			'anipool.net',
			'www.cryptopoolmining.com',
			'fusa.gikopool.net',
			'gikopool.net',
			'mona.2chpool.com',
			'mona.xxpoolxx.net',
			'mona1.monapool.com',
			'mona2.monapool.com',
			'simplemona.com',
			'vippool.net',
			'hattenba.net'
		],
		defaultClientPort: 9401  // Monacoin: default port
	},
};

const OFFLINE_WALLET_INSIGHT_ENDPOINTS = {
	//BTC:  ['http://chain.localbitcoins.com', 'https://search.bitaccess.ca'],
	BTC:  ['https://search.bitaccess.ca'],
	MONA: ['http://abe.monash.pw:3000'],
};

const OFFLINE_WALLET_MAGIC = 'offlinewallet.info';
const OFFLINE_WALLET_MINCONF_DEFAULT = {
	BTC:  6,
	MONA: 6,
};
const OFFLINE_WALLET_FEE_SAT_DEFAULT = {
	BTC:  10000,
	MONA: 10000,
};

var BITCORE_LIVENET = null;

/**
 * Backend module for OfflineWallet.info.
 * 
 * @class OfflineWallet
 * @constructor
 * @param {String} secret Secret key.
 * @param {String} type Type of a secret key. 'passphrase', 'WIF', 'miniPrivKey' is supported currently.
 * @param {String} symbol Symbol such as 'BTC' or 'MONA'.
 */
var OfflineWallet = function(secret, type, symbol){
	//
	// Set default settings.
	this.symbol = symbol || 'MONA';
	BITCORE_LIVENET = OFFLINE_WALLET_NETWORKS[this.symbol];
	this.minconf = OFFLINE_WALLET_MINCONF_DEFAULT[this.symbol];
	this._feeSat = OFFLINE_WALLET_FEE_SAT_DEFAULT[this.symbol];
	this.balance = {
		confirmed: 0,
		unconfirm: 0,
	};
	this.unspents = [];
	this.transactions = [];
	this._socket = null;
	this.initType = type;
	this.passphrase = null;
	this.miniPrivKey = null;
	this._wk = new bitcore.WalletKey({network:OFFLINE_WALLET_NETWORKS[this.symbol]});
	//
	// Initialize.
	switch(type){
		case 'passphrase':
			this.passphrase = secret;
			var privKey = bitcore.util.sha256(OFFLINE_WALLET_MAGIC + ':' + this.symbol + ':' + secret);
			this._wk.fromObj({priv:privKey.toString('hex')});
			break;
		case 'WIF':
			this._wk.fromObj({priv:secret});
			break;
		case 'miniPrivKey':
			this.miniPrivKey = secret;
			// Checks for validity.
			var validate = bitcore.util.sha256(secret + '?');
			if(validate[0] != 0) throw new Error(_('failed to validate given mini private key.'));
			var privKey = bitcore.util.sha256(secret);
			this._wk.fromObj({priv:privKey.toString('hex')});
			break;
		default:
			throw new Error(_('type parameter is wrong or not supported currently.'));
	}
	//
	// For debug.
	/*
	log('OfflineWallet: WalletKey obj:', this._wk);
	log('OfflineWallet: PrivKey:', this.getPrivKey().toString('hex'));
	log('OfflineWallet: PrivKey WIF:', this.getPrivKeyWIF());
	log('OfflineWallet: PubKey:', this.getPubKey());
	log('OfflineWallet: Address:', this.getAddress());
	*/
}

/**
 * Get supported currency list as symbol name.
 * 
 * @method getSupportedSymbols
 * @return {Array} The array of the symbols supported.
 */
OfflineWallet.getSupportedSymbols = function(){
	return ['BTC', 'MONA'];
}

/**
 * Get the currency name of a given symbol.
 * For example, OfflineWallet.getSymbolName('BTC') returns 'Bitcoin'.
 * 
 * @method getSymbolName
 * @param {String} symbol Symbol name.
 * @return {String} The currency name of a given symbol. Can depends on the locale.
 */
OfflineWallet.getSymbolName = function(symbol){
	switch(symbol){
		case 'BTC':
			return _('Bitcoin');
		case 'MONA':
			return _('Monacoin');
		default:
			return null;
	}
}

OfflineWallet.getSymbolLinkPrefix = function(symbol){
	switch(symbol){
		case 'BTC':
			return 'bitcoin';
		case 'MONA':
			return 'monacoin';
		default:
			return null;
	}
}

OfflineWallet.prototype = {
	
	/**
	 * Get private key (secret exponent).
	 * @return string private key.
	 */
	getPrivKey: function(){
		return this._wk.privKey.private.toString('hex');
	},
	
	/**
	 * Get private key in Wallet Import Format (WIF).
	 * @return string WIF private key.
	 */
	getPrivKeyWIF: function(){
		return this._wk.storeObj().priv;
	},
	
	/**
	 * Get public key.
	 * @return string public key.
	 */
	getPubKey: function(){
		return this._wk.storeObj().pub;
	},
	
	/**
	 * Get address.
	 * @return string Monacoin address.
	 */
	getAddress: function(){
		if(this._address == undefined){
			this._address = this._wk.storeObj().addr;
		}
		return this._address;
	},
	
	isValidAddress: function(addr){
		var pubKey = new bitcore.EncodedData(addr);
		if(!pubKey.isValid()) return false;
		// Checks for version byte.
		var versionByte = pubKey.as('binary')[0];
		if(versionByte != OFFLINE_WALLET_NETWORKS[this.symbol].addressVersion) return false;
		return true;
	},
	
	getInsightEndpoint: function(){
		// Randomly choose endpoint.
		var n = OFFLINE_WALLET_INSIGHT_ENDPOINTS[this.symbol].length;
		var i = Math.floor(Math.random() * n);
		return OFFLINE_WALLET_INSIGHT_ENDPOINTS[this.symbol][i];
	},
	getInsightApiEndpoint: function(){
		return this.getInsightEndpoint() + '/api';
	},
	getInsightWebSocketEndpoint: function(){
		return this.getInsightEndpoint();
	},
	
	setFeeSat: function(feeSat){
		this._feeSat = feeSat;
	},
	setFee: function(fee){
		this._feeSat = 1e8 * fee;
	},
	getFeeSat: function(){
		return this._feeSat;
	},
	getFee: function(){
		return (1e-8 * this._feeSat);
	},
	
	/**
	 * Get color theme (hue) for the user.
	 * @return float hue in range [0,1).
	 */
	getHue: function(){
		var seed = parseInt(bitcore.util.sha256(this.getPubKey()).toString('hex').substr(-8), 16);
		var hue = seed / 0xffffffff;
		return hue;
	},
	
	/**
	 * Fetch unspent transactions from remote API.
	 * 
	 */
	fetchUnspents: function(callback){
		var me = this;
		$.getJSON(this.getInsightApiEndpoint()+'/addr/'+this.getAddress()+'/utxo?callback=?', function(data){
			log('OfflineWallet: fetchUnspents: received data:', data);
			// Store in memory.
			me.unspents = data;
			// Update balances.
			me.balance.confirmed = 0;
			me.balance.unconfirm = 0;
			data.forEach(function(utxo){
				if(utxo.confirmations < me.minconf){
					me.balance.unconfirm += utxo.amount;
				}else{
					me.balance.confirmed += utxo.amount;
				}
			});
			// Call callback function.
			if(typeof callback === 'function'){
				callback(data);
			}
		}).fail(function(){
			me.fetchUnspents(callback);
		});
	},
	
	fetchTransactions: function(callback){
		var me = this;
		$.getJSON(this.getInsightApiEndpoint()+'/txs/?address='+this.getAddress()+'&callback=?', function(data){
			log('OfflineWallet: fetchTransactions: received data:', data);
			me.transactions = data;
			if(typeof callback === 'function'){
				callback(data);
			}
		}).fail(function(){
			me.fetchTransactions(callback);
		});
	},
	
	/**
	 * Create a new standard pay-to-pubkey-hash transaction.
	 * @param array outs outs = [ {address: '???', amount: 1.23}, ... ].
	 * @return Transaction created transaction.
	 */
	createTransaction: function(outs, extra){
		var opts = {network: OFFLINE_WALLET_NETWORKS[this.symbol], feeSat: this._feeSat};
		var unspents = this.unspents;
		var keys = [this.getPrivKeyWIF()];
		if(extra && extra.opts) opts=extra.opts;
		if(extra && extra.unspents) unspents=extra.unspents;
		if(extra && extra.keys) keys=extra.keys;
		var tx = new bitcore.TransactionBuilder(opts)
			.setUnspent(unspents)
			.setOutputs(outs)
			.sign(keys)
			.build();
		return tx;
	},
	
	sendTransaction: function(tx, callback){
		$.post(this.getInsightApiEndpoint()+'/tx/send', {rawtx: tx.serialize().toString('hex')}, function(data, textStatus, jqXHR){
			if(typeof callback === 'function'){
				callback(data, textStatus, jqXHR);
			}
		});
	},
	
	connectWebSocket: function(callbacks){
		if(!io) return false;
		var socket = this._socket = io.connect(this.getInsightWebSocketEndpoint());
		var me = this;
		socket.on('connect', function(){
			socket.emit('subscribe', 'inv');
			//socket.emit('subscribe', me.getAddress());
			socket.on('tx', function(tx){
				log('OfflineWallet: connectWebSocket: receive tx:', tx);
				if(typeof callbacks.tx === 'function'){
					callbacks.tx(tx);
				}
			});
			socket.on('block', function(block){
				log('OfflineWallet: connectWebSocket: receive block:', block);
				if(typeof callbacks.block === 'function'){
					callbacks.block(block);
				}
			});
		});
		socket.on('error', function(){
			log('OfflineWallet: connectWebSocket: error');
			me.connectWebSocket(callbacks);
		});
		return true;
	},
	
};

