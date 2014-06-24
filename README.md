OfflineWallet.info
==================

A brainwallet with a *Bitcoin Core*-compatible UI.

OfflineWallet.info supports multiple currencies and multiple languages.

Introduction
------------

Bitcoins can be spent if one know the private key for a bitcoin address.
If one memorizes the private key in his mind,
it can be said that "Bitcoins are stored in his brain."
This concept is sometimes refered as a **brainwallet**.
Please refer [Bitcoin wiki's article](https://en.bitcoin.it/wiki/Brainwallet) for details.

OfflineWallet.info provides a brainwallet with a nice UI.
It also supports altcoins and multiple languages.
OfflineWallet.info does not use external databases,
you can download it to your local machine to increase security.

Why Brainwallet?
----------------

All transactions are signed client side using JavaScript,
no secret key information is passed to external servers.

Many web wallet stores Bitcoins in their server,
there is a risk that the servers are cracked and all the funds stolen.
However this wallet does not send any secret key information to external servers.
So you can safely store your bitcoins as long as you choose a safe passphrase.

Get Started
-----------

Just visit [OfflineWallet.info](https://offlinewallet.info/).

Choosing a Passphrase
---------------------

Passphrase is directly connected to your secret key,
so choosing a good passphrase is essential.

Please be sure the following points:

 * Must be longer than 20 letters. 30+ letters are recommended.
 * Choose a longer passphrase rather than including a special letters or numbers.
 * Include personal information in order to prevent dictionary attack.

Example passphrase:

 * `Man made it to the moon,, and decided it stinked like yellow cheeeese.`
 * `0uen shiteru watashi ango-tsuka w0` [include Japanese word, change *o* to *0*]
 * `@satoshi cant understood Nihon-go (>.<)` [include personal info, wrong grammer, include special letters]

