'use strict';

/* API Includes */
var Logger = require('dw/system/Logger');
var ProductMgr = require('dw/catalog/ProductMgr');

/* Script Modules */
var dengageUtils = require('*/cartridge/scripts/dengage/utils');
var productHelper = require('*/cartridge/scripts/dengage/eventData/productHelper');

function parseLineItem(lineItem) {
    var dengageCartItem = {};
    var currentProductID = lineItem.productID;
    var basketProduct = ProductMgr.getProduct(currentProductID);
    if (!basketProduct)
        throw new Error('Product with ID [' + currentProductID + '] not found');

    if (currentProductID != null && !empty(basketProduct) && basketProduct.getPriceModel().getPrice().value > 0) {
        var priceData = dengageUtils.priceCheck(lineItem, basketProduct);
        dengageCartItem.product_id = currentProductID;
        dengageCartItem.product_variant_id = null;
        dengageCartItem.quantity = lineItem.quantity.value;
        dengageCartItem.unit_price = priceData.originalPriceValue;
        dengageCartItem.discounted_price = priceData.purchasePriceValue;

        if (!basketProduct.master && 'masterProduct' in basketProduct) {
            dengageCartItem.product_id = basketProduct.masterProduct.ID;
            dengageCartItem.product_variant_id = currentProductID;
        }

        // Get the product object
        dengageProduct = productHelper.parseProductData(basketProduct);
        dengageCartItem.dengageProduct = dengageProduct;
    }
    return dengageCartItem;
}

function parseCartItemData(basket, productId) {
    productId = productId || null;
    var dengageCartItem;
    var logger = Logger.getLogger('int_dengage', 'dengage');
    try {
        dengageCartItem = {};
        var basketItems = basket.getProductLineItems().toArray();
        if (productId) {
            // If product ID is there, fetch details for the product that was added to cart
            for (var idx = 0; idx < basketItems.length; idx++) {
                if (!basketItems[idx].bonusProductLineItem) {
                    var lineItem = basketItems[idx];
                    if (lineItem.productID == productId) {
                        dengageCartItem = parseLineItem(lineItem);
                        break;
                    }
                }
            }
        } else {
            // Get the last item added to the basket
            for (var idx = basketItems.length - 1; idx >= 0; idx--) {
                if (!basketItems[idx].bonusProductLineItem) {
                    var lineItem = basketItems[idx];
                    dengageCartItem = parseLineItem(lineItem);
                    break;
                }
            }
        }
    } catch (e) {
        logger.error('cartHelper.getData() failed: ' + e.message + ' ' + e.stack);
    }
    logger.info('Cart data: ' + JSON.stringify(dengageCartItem));
    return dengageCartItem;
}

module.exports = {
    parseCartItemData: parseCartItemData,
    parseLineItem: parseLineItem
};
