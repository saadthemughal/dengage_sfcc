'use strict';

/* API Includes */
var Logger = require('dw/system/Logger');
var ProductMgr = require('dw/catalog/ProductMgr');

/* Script Modules */
var dengageUtils = require('*/cartridge/scripts/dengage/utils');

/**
 * Prepares the order in JSON format for email send.
 * @param order
 * @returns
 */
function parseOrderData(order) {
    var dengageOrder = {};
    var logger = Logger.getLogger('int_dengage', 'dengage');
    try {
        if (order.shipments.length > 0) {
            // Product Details
            productLineItems = order.shipments[0].productLineItems;
            var productLineItem = {};
            var productLineItemsArray = [];
            var items = [];
            var orderTotal = 0;
            var dengageProducts = [];
            var dengageCustomer = {};
            for (var j in productLineItems) {
                productLineItem = productLineItems[j];

                // Get the product secondary name
                var lineItemProduct = productLineItem.product;
                var productDetail = ProductMgr.getProduct(lineItemProduct.ID);
                if (!productDetail) {
                    throw new Error('Product with ID [' + lineItemProduct.ID + '] not found');
                }

                productId = productVariantId = productLineItem.productID;
                if (!productDetail.master && 'masterProduct' in productDetail) {
                    productId = productDetail.masterProduct.ID;
                    productVariantId = productLineItem.productID;
                }

                var priceData = dengageUtils.priceCheck(productLineItem, productDetail);
                currentLineItem.product_id = productId;
                currentLineItem.product_variant_id = productVariantId;
                currentLineItem.quantity = productLineItem.quantity.value;
                currentLineItem.unit_price = priceData.originalPriceValue.value;
                currentLineItem.discounted_price = priceData.purchasePriceValue.value;

                itemCount = productLineItem.quantity.value;

                productLineItemsArray.push(currentLineItem);

                orderTotal += priceData.purchasePriceValue.value * productLineItem.quantity.value;

                dengageProduct = productHelper.parseProductData(productDetail);
                dengageProducts.push(dengageProduct);
            }

            // Get the coupon attached to the order
            var discountCoupon = '';
            var shippingLineItems = order.shipments[0].shippingLineItems;
            if (shippingLineItems && shippingLineItems.length > 0) {
                if (shippingLineItems[0].lineItemCtnr) {
                    var couponLineItems = shippingLineItems[0].lineItemCtnr.couponLineItems;
                    if (couponLineItems && couponLineItems.length > 0) {
                        for (var q in couponLineItems) {
                            if (couponLineItems[q].statusCode == 'APPLIED') {
                                discountCoupon = couponLineItems[q].couponCode;
                                break;
                            }
                        }
                    }
                }
            } else {
                discountCoupon = '';
            }

            // Payment Details
            // Take the first payment method
            paymentInstruments = order.paymentInstruments;
            var paymentMethod = '';
            var paymentInstrumentItem = {};
            for (var k in paymentInstruments) {
                paymentInstrumentItem = paymentInstruments[k];
                paymentMethod = paymentInstrumentItem.paymentMethod.name.toLowerCase();
                break;
            }
        }

        var orderStatus = order.status;
        if (orderStatus == 6 || orderStatus == 8)
            dengageOrderStatus = 'refund';
        else
            dengageOrderStatus = 'success';

        var orderCreationDate = dw.util.StringUtils.formatCalendar(new dw.util.Calendar(new Date(order.creationDate)), 'yyyy-MM-dd');
        dengageOrder.contact_key = order.customerEmail;
        dengageOrder.order_id = order.orderNo;
        dengageOrder.order_date = orderCreationDate;
        dengageOrder.order_status = dengageOrderStatus;
        dengageOrder.referrer = order.channelType;
        dengageOrder.item_count = itemCount;
        dengageOrder.total_amount = orderTotal;
        dengageOrder.payment_method = paymentMethod;
        dengageOrder.coupon_code = discountCoupon;
        dengageOrder.items = productLineItemsArray;

        // Set the product items to be sent to Dengage with the order
        dengageOrder.dengageProducts = dengageProducts;

        // Set the customer to be sent to Dengage with the order
        dengageCustomer = customerHelper.parseCustomerData(order.customer, order = order);
        dengageOrder.dengageCustomer = dengageCustomer;
    } catch (e) {
        logger.error('orderHelper.parseOrderData() failed: ' + e.message + ' ' + e.stack);
    }
    logger.info('Order data: ' + JSON.stringify(dengageOrder));
    return dengageOrder;
}


module.exports = {
    parseOrderData: parseOrderData
};
