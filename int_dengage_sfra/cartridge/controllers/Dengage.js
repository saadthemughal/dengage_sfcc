'use strict';

var server = require('server');

server.get('Basket', function (req, res, next) {
    var BasketMgr = require('dw/order/BasketMgr');
    var CartModel = require('*/cartridge/models/cart');

    var currentBasket = BasketMgr.getCurrentBasket();
    var basketModel = new CartModel(currentBasket);

    res.json(basketModel);

    return next();
});

module.exports = server.exports();