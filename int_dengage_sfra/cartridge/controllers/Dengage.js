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
    var discountedPrice = productPrices.salePrice;
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

module.exports = server.exports();