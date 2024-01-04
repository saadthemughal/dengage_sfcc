/*
 * map Sfcc model product
 *
 */
'use strict';

var dengageUtils = require('int_dengage_core/cartridge/scripts/dengage/utils');
var ProductInventoryMgr = require('dw/catalog/ProductInventoryMgr');
var URLUtils = require('dw/web/URLUtils');
var Logger = require('dw/system/Logger');

module.exports = function () {
  var self = {};

  self.execute = function (product) {
    if (!product) {
      return;
    }

    var dengageProduct = {};
    var masterProduct = {};
    if (product.variant) { masterProduct = product.masterProduct; } else { masterProduct = product; }

    var masterProductId = masterProduct.getID();
    var category = masterProduct.primaryCategory ? masterProduct.primaryCategory.displayName : '';

    var productImageLink = dengageUtils.getProductImage(masterProduct);

    var productPrice = masterProduct.getPriceModel().getPrice().value;
    var inventoryList = ProductInventoryMgr.getInventoryList();
    var stockCount = dengageUtils.getStock(inventoryList, product);

    // Parse product information and place in product object
    dengageProduct.product_id = masterProductId;
    dengageProduct.title = masterProduct.name;
    dengageProduct.price = productPrice;
    dengageProduct.discounted_price = productPrice;
    dengageProduct.description = masterProduct.shortDescription;
    dengageProduct.category_path = category;
    dengageProduct.brand = masterProduct.brand;
    dengageProduct.image_link = productImageLink;
    dengageProduct.link = URLUtils.https('Product-Show', 'pid', masterProductId).toString();
    dengageProduct.publish_date = dengageUtils.formatDate(masterProduct.getOnlineFrom());
    dengageProduct.stock_count = stockCount;
    dengageProduct.is_active = masterProduct.online;
    dengageProduct.variants = [];

    var dengageVariants = [];
    var variants = masterProduct.getVariants().toArray();
    // Iterate variants and add to product object
    variants.forEach(function (variant) {
      var dengageVariant = {};
      var variantId = variant.getID();
      var variantPrice = variant.getPriceModel().getPrice().value;
      var variantImageLink = dengageUtils.getProductImage(variant);
      var variantStockCount = dengageUtils.getStock(inventoryList, variant);

      dengageVariant.product_variant_id = variantId;
      dengageVariant.title = variant.name;
      dengageVariant.price = variantPrice;
      dengageVariant.discounted_price = variantPrice;
      dengageVariant.image_link = variantImageLink;
      dengageVariant.stock_count = variantStockCount;
      dengageVariant.size = dengageUtils.getVariantAttributeValue(variant, 'size');
      dengageVariant.color = dengageUtils.getVariantAttributeValue(variant, 'color');
      dengageVariants.push(dengageVariant);
    });
    dengageProduct.variants = dengageVariants;

    // If product level price is not set then instead set it to the price of first variant
    if (!dengageProduct.price && dengageVariants.length) { dengageProduct.price = dengageVariants[0].price; }
    if (!dengageProduct.discounted_price && dengageVariants.length) { dengageProduct.discounted_price = dengageVariants[0].discounted_price; }

    Logger.info('Product data: ' + JSON.stringify(dengageProduct));

    return dengageProduct;
  };

  return Object.freeze(self);
};
