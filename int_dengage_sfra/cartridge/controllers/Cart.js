'use strict';

var server = require('server');
server.extend(module.superModule);

/* API Includes */
var BasketMgr = require('dw/order/BasketMgr');

/* Script Modules */
var dengageUtils = require('*/cartridge/scripts/dengage/utils');
var cartHelper = require('*/cartridge/scripts/dengage/eventData/cartHelper');


server.append('Show', function (req, res, next) {
    dengageUtils.log('Cart seen by customer');
    next();
});

server.append('AddProduct', function (req, res, next) {
    if (dengageUtils.dengageEnabled) {
        var dataObj;
        var serviceCallResult;
        var currentBasket;
        var customerEmail;

        currentBasket = BasketMgr.getCurrentBasket();

        if (currentBasket && currentBasket.getProductLineItems().toArray().length) {
            dataObj = cartHelper.parseCartItemData(currentBasket);
            dataObj.event_type = 'add_to_cart';
            customerEmail = currentBasket.customerEmail || false;
            // Send the product to Dengage
            if (dataObj.dengageProduct) {
                dengageUtils.sendTransaction(dataObj.dengageProduct, 'product');
                delete dataObj.dengageProduct;
            }
            // Send the shopping cart event to Dengage
            dengageUtils.trackEvent(dataObj, 'shopping_cart_events', customerEmail);
        }
    }

    next();
});

server.append('UpdateQuantity', function (req, res, next) {
    if (dengageUtils.dengageEnabled) {
        var dataObj;
        var serviceCallResult;
        var currentBasket;
        var customerEmail;
        var productId = req.querystring.pid;

        currentBasket = BasketMgr.getCurrentBasket();

        if (currentBasket && currentBasket.getProductLineItems().toArray().length) {
            dataObj = cartHelper.parseCartItemData(currentBasket, productId);
            dataObj.event_type = 'add_to_cart';
            // Send the product to Dengage
            if (dataObj.dengageProduct) {
                dengageUtils.sendTransaction(dataObj.dengageProduct, 'product');
                delete dataObj.dengageProduct;
            }
            // Send the shopping cart event to Dengage
            dengageUtils.trackEvent(dataObj, 'shopping_cart_events', customerEmail);
        }
    }

    next();
});

server.append('RemoveProductLineItem', function (req, res, next) {
    if (dengageUtils.dengageEnabled) {
        var dataObj;
        var serviceCallResult;
        var currentBasket;
        var customerEmail;
        var productId = req.querystring.pid;

        currentBasket = BasketMgr.getCurrentBasket();

        if (currentBasket && currentBasket.getProductLineItems().toArray().length) {
            dataObj = cartHelper.parseCartItemData(currentBasket, productId);
            dataObj.event_type = 'remove_from_cart';
            customerEmail = currentBasket.customerEmail || false;
            // Send the product to Dengage
            if (dataObj.dengageProduct) {
                dengageUtils.sendTransaction(dataObj.dengageProduct, 'product');
                delete dataObj.dengageProduct;
            }
            // Send the shopping cart event to Dengage
            dengageUtils.trackEvent(dataObj, 'shopping_cart_events', customerEmail);
        }
    }

    next();
});

module.exports = server.exports();