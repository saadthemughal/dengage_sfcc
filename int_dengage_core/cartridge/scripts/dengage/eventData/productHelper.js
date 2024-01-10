'use strict';

/* API Includes */
var Logger = require('dw/system/Logger');
var ProductMgr = require('dw/catalog/ProductMgr');

/* Script Modules */
var dengageUtils = require('*/cartridge/scripts/dengage/utils');

function parseProductData(product, productId) {
    product = product || null;
    productId = productId || 0;
    var dengageProduct = {};
    var logger = Logger.getLogger('int_dengage', 'dengage');
    try {
        if (!product)
            product = ProductMgr.getProduct(productId);

        if (product) {
            var masterProduct, masterProductId;
            if (product.variant)
                masterProduct = product.masterProduct;
            else
                masterProduct = product;

            var masterProductId = masterProduct.getID();
            var category = masterProduct.primaryCategory ? masterProduct.primaryCategory.displayName : '';

            var productImageLink = null;
            if (masterProduct.getImage('large'))
                productImageLink = masterProduct.getImage('large').getAbsURL().toString();

            var productPrice = masterProduct.getPriceModel().getPrice().value;

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
            dengageProduct.stock_count = masterProduct.availabilityModel.availability;
            dengageProduct.is_active = masterProduct.online;
            dengageProduct.variants = [];

            dengageVariants = [];
            variants = masterProduct.variants;
            // Iterate variants and add to product object
            for (var idx = 0; idx < variants.length; idx++) {
                var variant = variants[idx];
                var variantId = variant.getID();
                var variantPrice = variant.getPriceModel().getPrice().value;
                var variantImageLink = null;

                if (variant.getImage('large'))
                    variantImageLink = variant.getImage('large').getAbsURL().toString();
                else
                    variantImageLink = productImageLink;

                dengageVariant.product_variant_id = variantId;
                dengageVariant.title = variant.name;
                dengageVariant.price = variantPrice;
                dengageVariant.discounted_price = variantPrice;
                dengageVariant.image_link = variantImageLink;
                dengageVariant.stock_count = variant.availabilityModel.availability;
                dengageVariant.size = dengageUtils.getVariantAttributeValue(variant, 'size');
                dengageVariant.color = dengageUtils.getVariantAttributeValue(variant, 'color');

                dengageVariants.push(dengageVariant);
            }
            dengageProduct.variants = dengageVariants;

            // If product level price is not set then instead set it to the price of first variant
            if (!dengageProduct.price && dengageVariants.length)
                dengageProduct.price = dengageVariants[0].price;
            if (!dengageProduct.discounted_price && dengageVariants.length)
                dengageProduct.discounted_price = dengageVariants[0].discounted_price;
        }
    } catch (e) {
        logger.error('productHelper.parseProductData() failed: ' + e.message + ' ' + e.stack);

    }
    logger.info('Product data: ' + JSON.stringify(dengageProduct));
    return dengageProduct;
}

module.exports = {
    parseProductData: parseProductData
};
