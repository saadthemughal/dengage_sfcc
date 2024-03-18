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
    var category = masterProduct.primaryCategory ? masterProduct.primaryCategory : '';
    if (!category)
      category = masterProduct.allCategories.length ? masterProduct.allCategories[0] : '';
    var categoryPath = '';
    if (category)
      categoryPath = dengageUtils.getCategoryPath(category);

    var productImageLink = dengageUtils.getProductImage(masterProduct);

    var productPrices = dengageUtils.getProductPrice(masterProduct);
    var productListPrice = productPrices.listPrice;
    var productSalePrice = productPrices.salePrice;
    var inventoryList = ProductInventoryMgr.getInventoryList();
    var stockCount = dengageUtils.getStock(inventoryList, product);
    var description = masterProduct.shortDescription ? masterProduct.shortDescription.markup : 'N/A';

    // Parse product information and place in product object
    dengageProduct.product_id = masterProductId;
    dengageProduct.title = masterProduct.name || 'Untitled';
    dengageProduct.price = productListPrice || 0.01;
    dengageProduct.discounted_price = productSalePrice || 0.01;
    dengageProduct.description = description || 'N/A';
    dengageProduct.category_path = categoryPath || 'N/A';
    dengageProduct.brand = masterProduct.brand || 'N/A';
    dengageProduct.image_link = productImageLink;
    dengageProduct.link = masterProduct.pageURL || URLUtils.https('Product-Show', 'pid', masterProductId).toString();
    dengageProduct.publish_date = dengageUtils.formatDate(masterProduct.getOnlineFrom()) || dengageUtils.formatDate(masterProduct.creationDate);
    dengageProduct.stock_count = stockCount;
    dengageProduct.is_active = masterProduct.online;
    dengageProduct.variants = [];

    var dengageVariants = [];
    var variants = masterProduct.getVariants().toArray();
    var variantImage = null;
    var variantListPrices = [];
    var variantSalePrices = [];
    // Iterate variants and add to product object
    variants.forEach(function (variant) {
      var dengageVariant = {};
      var variantId = variant.getID();
      var variantPrices = dengageUtils.getProductPrice(variant);
      var variantListPrice = variantPrices.listPrice;
      var variantSalePrice = variantPrices.salePrice;
      var variantImageLink = dengageUtils.getProductImage(variant);
      var variantStockCount = dengageUtils.getStock(inventoryList, variant);
      if (!variantImage && variantImageLink)
        variantImage = variantImageLink;

      dengageVariant.product_variant_id = variantId;
      dengageVariant.title = variant.name || 'Untitled';
      dengageVariant.price = variantListPrice || 0.01;
      dengageVariant.discounted_price = variantSalePrice || 0.01;
      dengageVariant.image_link = variantImageLink || 'N/A';
      dengageVariant.stock_count = variantStockCount;
      dengageVariant.size = dengageUtils.getVariantAttributeValue(variant, 'size');
      dengageVariant.color = dengageUtils.getVariantAttributeValue(variant, 'color');
      if (dengageVariant.discounted_price > dengageVariant.price)
        dengageVariant.price = dengageVariant.discounted_price;
      dengageVariants.push(dengageVariant);
      if (variantListPrice)
        variantListPrices.push(dengageVariant.price);
      if (variantSalePrice)
        variantSalePrices.push(dengageVariant.discounted_price);
    });
    dengageProduct.variants = dengageVariants;

    if (!dengageProduct.image_link)
      dengageProduct.image_link = variantImage || 'N/A';

    if (variantListPrices.length)
      dengageProduct.price = variantListPrices[0];
    if (variantSalePrices.length)
      dengageProduct.discounted_price = variantSalePrices[0];

    if (dengageProduct.discounted_price > dengageProduct.price)
      dengageProduct.price = dengageProduct.discounted_price;

    // Logger.info('Product data: ' + JSON.stringify(dengageProduct));

    return dengageProduct;
  };

  return Object.freeze(self);
};
