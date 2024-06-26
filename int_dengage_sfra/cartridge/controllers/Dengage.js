'use strict';

var server = require('server');
var dengageUtils = require('int_dengage_core/cartridge/scripts/dengage/utils');

server.get('Basket', function (req, res, next) {
    var BasketMgr = require('dw/order/BasketMgr');
    var CartModel = require('*/cartridge/models/cart');

    var currentBasket = BasketMgr.getCurrentBasket();
    var basketModel = new CartModel(currentBasket);

    res.json(basketModel);

    return next();
});

server.get('Product', function (req, res, next) {
    var ProductMgr = require('dw/catalog/ProductMgr');
    var productId = req.querystring.productId;

    var product = ProductMgr.getProduct(productId);
    var productId = product.ID;
    var productVariantId = '';
    var productPrices = dengageUtils.getProductPrice(product);
    var unitPrice = productPrices.listPrice;
    var discountedPrice = productPrices.salePrice || productPrices.listPrice;
    if (!product.master && 'masterProduct' in product) {
        productId = product.masterProduct.ID;
        productVariantId = product.ID;
    }
    var productJson = {
        product_id: productId,
        product_variant_id: productVariantId,
        unit_price: unitPrice,
        discounted_price: discountedPrice
    }

    res.json(productJson);

    return next();
});

server.post('Subscriber', function (req, res, next) {
    var email = req.querystring.email;
    var validEmail = dengageUtils.validateEmail(email);
    var response = {};
    if (validEmail) {
        var dengageCustomers = [];
        var dengageCustomer = {};
        var currentDate = dengageUtils.getDate();

        dengageCustomer.contact_key = email;
        dengageCustomer.name = '';
        dengageCustomer.surname = '';
        dengageCustomer.source = 'newsletter';
        dengageCustomer.contact_status = 'A';
        dengageCustomer.city = '';
        dengageCustomer.country = '';
        dengageCustomer.email = email;
        dengageCustomer.email_permission = true;
        dengageCustomer.gsm_permission = false;
        dengageCustomer.subscription_date = currentDate;
        dengageCustomer.gsm = 'N/A';
        dengageCustomer.gender = '';
        dengageCustomer.birth_date = '';

        dengageCustomers.push(dengageCustomer);

        var transactionResponse = dengageUtils.sendTransaction(dengageCustomers, 'customer', true, false, true);
        if (transactionResponse.updatedRecords && transactionResponse.updatedRecords.length) {
            response.message = 'You are already subscribed to the newsletter!';
            response.isExistingSubscriber = true;
        }
        else {
            response.message = 'You have been subscribed to the newsletter!';
            response.isExistingSubscriber = false;
        }

        response.success = true;
    } else {
        response.success = false;
        response.message = 'Please enter a valid email address';
        response.isExistingSubscriber = null;
    }

    res.json(response);

    return next();
});

module.exports = server.exports();