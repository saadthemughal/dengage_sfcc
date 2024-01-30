'use strict';

var ProductMgr = require('dw/catalog/ProductMgr');

var Site = require('dw/system/Site');
var Transaction = require('dw/system/Transaction');
var Logger = require('dw/system/Logger');
var dengageUtils = require('int_dengage_core/cartridge/scripts/dengage/utils');
var ProductMapping = require('int_dengage_core/cartridge/scripts/dengage/productMapping');

/**
 *
 * This function export products files
 */
function exportProductsFile(options) {
  var searchProducts;
  var newDengageProductsDateUpdate = dengageUtils.getTime();
  var dengageProductsDateUpdate = Site.getCurrent().getCustomPreferenceValue('dengage_products_date_update');
  var firstSync = false;

  if (!dengageProductsDateUpdate) {
    dengageProductsDateUpdate = newDengageProductsDateUpdate;
    firstSync = true;
  }

  Transaction.wrap(function () {
    Site.getCurrent().setCustomPreferenceValue('dengage_products_date_update',
      newDengageProductsDateUpdate);
  });

  searchProducts = ProductMgr.queryAllSiteProductsSorted();

  if (searchProducts.hasNext()) {
    var counter = 0;
    var dengageProducts = [];
    var productIdsAdded = [];
    while (searchProducts.hasNext()) {
      var product = searchProducts.next();
      var productId = product.variant ? product.masterProduct.getID() : product.getID();
      var syncProduct = false;
      if (firstSync) {
        syncProduct = product.creationDate <= dengageProductsDateUpdate;
      } else {
        syncProduct = product.lastModified >= dengageProductsDateUpdate;
      }
      if (syncProduct && !productIdsAdded.includes(productId)) {
        var productMapping = new ProductMapping();
        var dengageProduct = productMapping.execute(product);
        if (dengageProduct) {
          dengageProducts.push(dengageProduct);
          productIdsAdded.push(dengageProduct.product_id)
        }

        if (counter % 150 === 0) {
          dengageUtils.sendTransaction(dengageProducts, 'product');
          Logger.info(['exportProductsFile-progress', counter + ' out of ' + searchProducts.getCount() + ' customers processed']);
          dengageProducts = [];
        }
        counter++;
        // Logger.info(['call-exportProductsFile-finished', counter]);
      }
    }
    if (dengageProducts.length)
      dengageUtils.sendTransaction(dengageProducts, 'product');
    Logger.info(['call-exportProductsFile-finished', counter]);
  }
}

module.exports = {
  exportProductsFile: exportProductsFile
};
