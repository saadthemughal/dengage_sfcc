/*
 * map Sfcc model product
 *
 */
'use strict';

var dengageUtils = require('int_dengage_core/cartridge/scripts/dengage/utils');
var Logger = require('dw/system/Logger');
var ProductMgr = require('dw/catalog/ProductMgr');

module.exports = function () {
    var self = {};

    self.execute = function (order) {
        if (!order) {
            return;
        }

        var dengageOrder = {};
        var logger = Logger.getLogger('int_dengage', 'dengage');
        try {
            if (order.shipments.length > 0) {
                // Product Details
                var productLineItems = order.shipments[0].productLineItems;
                var productLineItem = {};
                var productLineItemsArray = [];
                var itemCount = 0;
                for (var j in productLineItems) {
                    productLineItem = productLineItems[j];

                    // Get the product secondary name
                    var lineItemProduct = productLineItem.product;
                    var productDetail = ProductMgr.getProduct(lineItemProduct.ID);
                    if (!productDetail) {
                        throw new Error('Product with ID [' + lineItemProduct.ID + '] not found');
                    }

                    var productId = productLineItem.productID;
                    var productVariantId = '';
                    if (!productDetail.master && 'masterProduct' in productDetail) {
                        productId = productDetail.masterProduct.ID;
                        productVariantId = productLineItem.productID;
                    }

                    var priceData = dengageUtils.priceCheck(productLineItem, productDetail);
                    var currentLineItem = {};
                    var discountedPrice = 0;
                    if (priceData.purchasePriceValue > priceData.originalPriceValue)
                        discountedPrice = priceData.originalPriceValue;
                    else if (priceData.purchasePriceValue == 0)
                        discountedPrice = 0.01;
                    else
                        discountedPrice = priceData.purchasePriceValue
                    currentLineItem.product_id = productId;
                    currentLineItem.product_variant_id = productVariantId;
                    currentLineItem.quantity = productLineItem.quantity.value;
                    currentLineItem.unit_price = priceData.originalPriceValue;
                    currentLineItem.discounted_price = discountedPrice;

                    productLineItemsArray.push(currentLineItem);

                    itemCount += productLineItem.quantity.value;
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
                var paymentInstruments = order.paymentInstruments;
                var paymentMethod = '';
                var paymentInstrumentItem = {};
                for (var k in paymentInstruments) {
                    paymentInstrumentItem = paymentInstruments[k];
                    if (paymentInstrumentItem && paymentInstrumentItem.paymentMethod) {
                        paymentMethod = paymentInstrumentItem.paymentMethod.toLowerCase();
                        break;
                    }
                }
                var orderStatus = order.status;
                var dengageOrderStatus = '';
                if (orderStatus == 6 || orderStatus == 8)
                    dengageOrderStatus = 'refund';
                else
                    dengageOrderStatus = 'success';

                var validPaymentMethods = ['cash', 'bank_transfer', 'credit_card', 'debit_card', 'mobile_payment', 'check', 'prepaid_card', 'crypto', 'cod', 'online_payment'];
                var orderCreationDate = dw.util.StringUtils.formatCalendar(new dw.util.Calendar(new Date(order.creationDate)), 'yyyy-MM-dd');
                dengageOrder.contact_key = order.customerEmail;
                dengageOrder.order_id = order.orderNo;
                dengageOrder.order_date = orderCreationDate;
                dengageOrder.order_status = dengageOrderStatus;
                dengageOrder.referrer = order.channelType;
                dengageOrder.item_count = itemCount;
                dengageOrder.total_amount = order.totalGrossPrice.value;
                if (validPaymentMethods.includes(paymentMethod))
                    dengageOrder.payment_method = paymentMethod;
                dengageOrder.coupon_code = discountCoupon;
                dengageOrder.items = productLineItemsArray;

                if (!order.customer || !order.customer.registered) {
                    try {
                        var dengageCustomer = {};
                        dengageCustomer.contact_key = order.customerEmail;
                        dengageCustomer.name = order.customerName;
                        dengageCustomer.surname = order.billingAddress.secondName;
                        dengageCustomer.contact_status = 'A';
                        dengageCustomer.email = order.customerEmail;
                        dengageCustomer.email_permission = true;
                        dengageCustomer.gsm_permission = true;
                        dengageCustomer.subscription_date = orderCreationDate;
                        dengageCustomer.gsm = order.billingAddress.phone;
                        dengageCustomer.address1_addressid = 'N/A';
                        dengageCustomer.address1_city = order.billingAddress.city;
                        dengageCustomer.address1_country = order.billingAddress.countryCode.displayValue;
                        dengageCustomer.address1_line1 = order.billingAddress.address1;
                        dengageCustomer.address1_line2 = order.billingAddress.address2;
                        dengageCustomer.address1_line3 = '';
                        dengageCustomer.gender = '';
                        dengageCustomer.birth_date = '';
                        dengageOrder.dengageCustomer = dengageCustomer;
                    } catch (eIn) {
                        logger.error('orderHelper.parseOrderData() Customer Object Creation failed: ' + eIn.message + ' ' + eIn.stack);
                    }
                }
            }
        } catch (e) {
            logger.error('orderHelper.parseOrderData() failed: ' + e.message + ' ' + e.stack);
        }

        logger.info('Order data: ' + JSON.stringify(dengageOrder));

        return dengageOrder;
    };

    return Object.freeze(self);
};
