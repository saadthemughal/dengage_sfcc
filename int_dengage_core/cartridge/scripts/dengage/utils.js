'use strict';

/* API Includes */
var Logger = require('dw/system/Logger');
var Site = require('dw/system/Site');
var Session = require('dw/system/Session');
var StringUtils = require('dw/util/StringUtils');
var System = require('dw/system/System');
var Calendar = require('dw/util/Calendar');
var Transaction = require('dw/system/Transaction');

/* Script Modules */
var dengageServices = require('int_dengage_core/cartridge/scripts/dengage/services.js');

function getCustomPreference(key, defaultVal) {
    try {
        return Site.getCurrent().getCustomPreferenceValue(key);
    } catch (e) {
        return defaultVal;
    }
}

var dengageEnabled = getCustomPreference('dengage_enabled', false);
var dnAccountId = getCustomPreference('dengage_account_id', null);
var dnAppGuid = getCustomPreference('dengage_app_guid', null);
var dnStagingEnabled = getCustomPreference('dengage_staging_enabled', false);
var dnSDK = getCustomPreference('dengage_sdk_snippet', '');
var dnServiceWorker = getCustomPreference('dengage_service_worker_snippet', '');
var dnRegion = getCustomPreference('dengage_region', 'Turkey');
var dnApiKey = getCustomPreference('dengage_api_key', null);
var dnApiPassword = getCustomPreference('dengage_api_password', null);

var dnTransactionUrls = {
    'order': '/rest/dataspace/ecomm/orders_detail/upsert',
    'product': '/rest/dataspace/ecomm/product/upsert',
    'category': '/rest/dataspace/sync/upsert',
    'customer': '/rest/bulk/contacts',
    'login': '/rest/login'
}
var dnContactColumns = ["contact_key", "name", "surname", "contact_status", "email", "email_permission", "gsm_permission", "birth_date", "subscription_date", "gsm", "gender"];
var dnCategoryColumns = ["category_id", "category_path"];
var dnBaseUrl = 'https://dev-api.dengage.com';
var dnEventUrl = 'https://dev-event.dengage.com/api/web/event';
if (!dnStagingEnabled) {
    if (dnRegion == 'Turkey') {
        dnBaseUrl = 'https://tr-api.dengage.com';
        dnEventUrl = 'https://tr-event.dengage.com/api/web/event';
    } else if (dnRegion == 'United States') {
        dnBaseUrl = 'https://us-api.dengage.com';
        dnEventUrl = 'https://us-event.dengage.com/api/web/event';
    } else if (dnRegion == 'Europe') {
        dnBaseUrl = 'https://eu-api.dengage.com';
        dnEventUrl = 'https://eu-event.dengage.com/api/web/event';
    } else if (dnRegion == 'Russia') {
        dnBaseUrl = 'https://ru-api.dengage.com';
        dnEventUrl = 'https://ru-event.dengage.com/api/web/event';
    } else if (dnRegion == 'South Asia') {
        dnBaseUrl = 'https://sa-api.dengage.com';
        dnEventUrl = 'https://sa-event.dengage.com/api/web/event';
    } else {
        dnBaseUrl = 'https://tr-api.dengage.com';
        dnEventUrl = 'https://tr-event.dengage.com/api/web/event';
    }
}

var logger = Logger.getLogger('dengage', 'dengage');

function log(message) {
    logger.error(message);
}

// gets SFCC profile info (if available) to use for customer identification
function getProfileInfo() {
    if (customer.authenticated && customer.profile) {
        var profileInfo = {
            $email: customer.profile.email,
            $first_name: customer.profile.firstName,
            $last_name: customer.profile.lastName
        };
        profileInfo = JSON.stringify(profileInfo);
        profileInfo = StringUtils.encodeBase64(profileInfo);
        return profileInfo;
    }
    return false;
}


// This takes data passed from the controller and encodes it so it can be used when Dengage's Debugger mode has been activated (ex: when including 'dndebug=true' as a URL query)
// Data from this is available in the following Events: 'Viewed Product', 'Viewed Category', 'Searched Site', 'Added to Cart' and 'Started Checkout'.
function prepareDebugData(obj) {
    var stringObj = JSON.stringify(obj);
    var encodedDataObj = StringUtils.encodeBase64(stringObj);
    return encodedDataObj;
}


// helper function used in .getData functions to dedupe values in arrays (particularly product category lists)
function dedupeArray(items) {
    var unique = {};
    items.forEach(function (i) {
        if (!unique[i]) {
            unique[i] = true;
        }
    });
    return Object.keys(unique);
}

// helper function to consider promos & set Price and Original Pride properties on a returned object.
// Used in order level events: 'Started Checkout' and 'Order Confirmation'.
function priceCheck(lineItemObj, basketProdObj) {
    var priceModel = basketProdObj ? basketProdObj.getPriceModel() : null;
    var priceBook = priceModel ? getRootPriceBook(priceModel.priceInfo.priceBook) : null;
    var priceBookPrice = priceBook && priceModel ? priceModel.getPriceBookPrice(priceBook.ID) : null;
    var priceData = {};

    var adjustedPromoPrice = lineItemObj && lineItemObj.adjustedPrice < priceBookPrice ? StringUtils.formatMoney(dw.value.Money(lineItemObj.adjustedPrice.value, session.getCurrency().getCurrencyCode())) : null;
    if (adjustedPromoPrice) {
        priceData.purchasePrice = StringUtils.formatMoney(dw.value.Money(lineItemObj.adjustedPrice.value, session.getCurrency().getCurrencyCode()));
        priceData.purchasePriceValue = lineItemObj.adjustedPrice.value;
        priceData.originalPrice = priceBookPrice ? StringUtils.formatMoney(dw.value.Money(priceBookPrice.value, session.getCurrency().getCurrencyCode())) : StringUtils.formatMoney(dw.value.Money(basketProdObj.getPriceModel().getPrice().value, session.getCurrency().getCurrencyCode()));
        priceData.originalPriceValue = priceBookPrice.value;
    } else {
        priceData.purchasePrice = lineItemObj ? StringUtils.formatMoney(dw.value.Money(lineItemObj.price.value, session.getCurrency().getCurrencyCode())) : null;
        priceData.purchasePriceValue = lineItemObj ? lineItemObj.price.value : null;
        priceData.originalPrice = basketProdObj ? StringUtils.formatMoney(dw.value.Money(basketProdObj.getPriceModel().getPrice().value, session.getCurrency().getCurrencyCode())) : null;
        priceData.originalPriceValue = basketProdObj.getPriceModel().getPrice().value;
    }

    return priceData;
}


/**
 * Return root price book for a given price book
 * @param {dw.catalog.PriceBook} priceBook - Provided price book
 * @returns {dw.catalog.PriceBook} root price book
 */
function getRootPriceBook(priceBook) {
    var rootPriceBook = priceBook;
    while (rootPriceBook.parentPriceBook) {
        rootPriceBook = rootPriceBook.parentPriceBook;
    }
    return rootPriceBook;
}

function getVariantAttributeValue(variant, attributeName) {
    var productAttributes = variant.variationModel.getProductVariationAttributes().toArray();
    var attributeValue = '';
    productAttributes.forEach(function (productAttribute) {
        if (productAttribute.displayName.toLowerCase() == attributeName.toLowerCase()) {
            attributeValue = variant.variationModel.getVariationValue(variant, productAttribute);
            if (attributeValue)
                attributeValue = attributeValue.getValue();
        }
    });
    return attributeValue;
}

function formatDate(date) {
    var formattedDate = ''
    try {
        formattedDate = date ? dw.util.StringUtils.formatCalendar(new dw.util.Calendar(new Date(date)), 'yyyy-MM-dd') : '';
    } catch (e) {
        formattedDate = '';
    }
    return formattedDate;
}

function trackEvent(data, event, customerEmail) {

    if (dengageServices.DengageEventService == null) {
        logger.error('trackEvent() failed - DengageEventService is null.');
        return;
    }

    if (!dnAccountId) {
        logger.error("Account ID is not configured therefore, cannot send event to Dengage");
        return;
    }

    var sessionId = Session.sessionID;
    var contactKey = '';
    if (!customerEmail) {
        contactKey = sessionId; // AV: Needs to be replaced with session ID or something
    } else {
        contactKey = customerEmail;
    }

    eventDetails.sessionId = sessionId;

    var eventData = {
        data: {
            accoundId: dnAccountId,
            eventTable: event,
            key: contactKey,
            eventDetails: data
        }
    };

    var result = dengageServices.DengageEventService.call({ url: dnEventUrl, data: eventData });

    if (result == null) {
        logger.error('dengageServices.DengageEventService call for ' + event + ' returned null result');
        return;
    } else if (result.error) {
        logger.error('dengageServices.DengageEventService call for ' + event + ' returned an error' + result.error)
        return { success: false, error: result.error };
    } else {
        return { success: true };
    }
}

// AV: Idea is to use this function to send data to create transactions in Dengage
function sendTransaction(data, transaction, forceToken, saveToken) {
    forceToken = forceToken === null ? false : forceToken;
    saveToken = saveToken === null ? true : saveToken;

    var service = dengageServices.sendTransaction();

    var dengageToken = getDengageToken(forceToken, saveToken);
    if (!dengageToken) {
        logger.error('Failed to fetch Dengage Token when trying to send transaction: ' + transaction);
        return false;
    }

    var transactionUrl = dnTransactionUrls[transaction] || '';
    if (!transactionUrl) {
        logger.error('Unknown transaction type: ' + transaction);
        return false;
    }

    var dengageUrl = dnBaseUrl + transactionUrl;

    var requestObj = {
        url: dengageUrl,
        token: dengageToken,
        data: {}
    };
    if (transaction == 'order') {
        requestObj.data = {
            orders: data
        }
    } else if (transaction == 'customer') {
        var contactColumns = data.length ? Object.keys(data[0]) : dnContactColumns;
        requestObj.data = {
            insertIfNotExists: true,
            throwExceptionIfInvalidRecord: true,
            columns: contactColumns,
            contactDatas: data
        }
    } else if (transaction == 'category') {
        requestObj.data = {
            tableName: 'category',
            columns: dnCategoryColumns,
            rows: data
        }
    } else if (transaction == 'product') {
        requestObj.data = {
            products: data
        }
    }

    logger.info(transaction + ' data being sent to Dengage : ' + JSON.stringify(requestObj.data));

    var result = service.call(requestObj);

    if (result.ok) {
        logger.info(transaction + ' data sent to Dengage successfully. Response : ' + JSON.stringify(result.object));
        return true;
    } else if (!result.ok && !forceToken && (result.error == 403 || result.error == 401)) {
        sendTransaction(data, transaction, true, saveToken);
    } else {
        logger.error('Failed to send ' + transaction + ' data to Dengage due to unknown error: ' + result.errorMessage + ' and additional info: ' + result.msg);
    }
    return false;
}

function getDengageToken(forceFetch, saveToken) {
    forceFetch = forceFetch === null ? false : forceFetch;
    saveToken = saveToken === null ? true : saveToken;

    var token = Site.getCurrent().getCustomPreferenceValue('dengage_token') || null;
    if (!token || forceFetch) {
        var service = dengageServices.getToken();
        var tokenData = {
            data: {
                userkey: dnApiKey,
                password: dnApiPassword,
            },
            url: dnBaseUrl + dnTransactionUrls.login
        }
        var result = service.call(tokenData);
        token = null;
        if (result.ok) {
            var response = result.object;
            if (response.access_token) {
                token = response.access_token;
                if (saveToken) {
                    Transaction.wrap(function () {
                        Site.getCurrent().setCustomPreferenceValue('dengage_token', token);
                    });
                }
                logger.error('Dengage token fetched successfully : ' + token);
            } else if (response == null) {
                logger.error('dengageServices.getDengageToken call returned null result');
            } else if (response.error) {
                logger.error('Failed to fetch Dengage Token: ' + response.error);
            }
        } else {
            logger.error('Failed to fetch Dengage Token due to unknown error: ' + JSON.stringify(result));
        }
    }
    return token;
}

function validateEmail(email) {
    var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailPattern.test(StringUtils.trim(email));
}

function getDate() {
    var tzString = System.getInstanceTimeZone();
    var calendar = new Calendar();
    calendar.setTimeZone(tzString);
    var formattedDate = StringUtils.formatCalendar(calendar, 'yyyy-MM-dd');
    return formattedDate;
}

function getTime() {
    var tzString = System.getInstanceTimeZone();
    var calendar = new Calendar();
    calendar.setTimeZone(tzString);
    return calendar.getTime();
}

function getTimestamp() {
    var tzString = System.getInstanceTimeZone();
    var calendar = new Calendar();

    calendar.setTimeZone(tzString);
    return calendar.get(6) + "_" + calendar.get(11) + "_" + calendar.get(12);
}

function getStock(inventoryList, variant) {
    var stockCount = 0;
    try {
        var inventoryRecord = inventoryList.getRecord(variant);
        if (inventoryRecord)
            stockCount = inventoryRecord.isPerpetual() ? 9999 : inventoryRecord.getAllocation().value;
    } catch (e) {
    }
    return stockCount;
}

function postProductsFile(url) {
    var service = dengageServices.postProductsFile();

    var params = {
        "importName": "ImportProducts",
        "siteName": Site.getCurrent().getID(),
        "url": 'https://' + Site.getCurrent().getHttpsHostName() + '/on/demandware.servlet/webdav/Sites' + url
    }

    var result = service.call(JSON.stringify(params));

    var logger = Logger.getLogger('Dengage', 'Dengage - Post Products File');
    logger.debug('Calling params ' + params);
    logger.debug('Service result ' + result);

    return result;
}

function postCustomersFile(url) {
    var service = dengageServices.postCustomersFile();

    var params = {
        "importName": "ImportCustomers",
        "siteName": Site.getCurrent().getID(),
        "url": 'https://' + Site.getCurrent().getHttpsHostName() + '/on/demandware.servlet/webdav/Sites' + url
    }

    var result = service.call(JSON.stringify(params));

    var logger = Logger.getLogger('Dengage', 'Dengage - Post Customers File');
    logger.debug('Calling params ' + params);
    logger.debug('Service result ' + result);

    return result;
}

function postOrdersFile(url) {
    var service = dengageServices.postOrdersFile();

    var params = {
        "importName": "ImportOrders",
        "siteName": Site.getCurrent().getID(),
        "url": 'https://' + Site.getCurrent().getHttpsHostName() + '/on/demandware.servlet/webdav/Sites' + url
    }

    var result = service.call(JSON.stringify(params));

    var logger = Logger.getLogger('Dengage', 'Dengage - Post Orders File');
    logger.debug('Calling params ' + params);
    logger.debug('Service result ' + result);

    return result;
}

function getProductImage(product) {
    var productImageLink = null;
    var viewTypes = ['large', 'medium', 'small', 'hi-res'];
    viewTypes.some(function (viewType) {
        if (product.getImage(viewType)) {
            productImageLink = product.getImage(viewType).getImageURL({}).toString();
            if (productImageLink)
                productImageLink = productImageLink.replace('http://production-eu01-khaadi.demandware.net/', 'https://edge.disstg.commercecloud.salesforce.com/dw/image/v2/BJTG_PRD/');
            return true;
        }
    });
    return productImageLink;
}

function getProductPrice(product) {
    var currentSite = Site.getCurrent();
    var salePrice = '';
    var listPrice = '';
    var productPriceModel = product.getPriceModel();
    listPrice = productPriceModel.maxPrice.value;
    salePrice = productPriceModel.price.value;
    if (salePrice == listPrice) {
        var listPricebookID = currentSite.getCustomPreferenceValue('listPriceDefault');
        listPrice = product.priceModel.getPriceBookPrice(listPricebookID).getValue();
    }
    return { salePrice: salePrice, listPrice: listPrice };
}

function getOrderTotals(order) {
    var totalExcludingShippingDiscount = order.shippingTotalPrice;
    var totalExcludingOrderDiscount = order.getAdjustedMerchandizeTotalPrice(false);
    var totalIncludingShippingDiscount = order.adjustedShippingTotalPrice;
    var totalIncludingOrderDiscount = order.getAdjustedMerchandizeTotalPrice(true);
    var fbrChargesIndex = order.priceAdjustments.toArray().map(a => a.promotionID).indexOf('FBRCharges');
    var orderDiscount = totalExcludingOrderDiscount.subtract(totalIncludingOrderDiscount)
    if (fbrChargesIndex >= 0)
        orderDiscount = orderDiscount.add(order.priceAdjustments[fbrChargesIndex].grossPrice);
    var shippingDiscount = totalExcludingShippingDiscount.subtract(totalIncludingShippingDiscount);
    var totalBeforeDiscount = order.totalGrossPrice.add(orderDiscount).add(shippingDiscount);
    return { totalBeforeDiscount: Math.round(totalBeforeDiscount.value), totalAfterDiscount: Math.round(order.totalGrossPrice.value) }
}

function getCategoryPath(category) {
    try {
        var categories = [];
        var currentCategory = category;
        do {
            if (currentCategory.displayName)
                categories.push(currentCategory.displayName);
            currentCategory = currentCategory.parent;
        } while (currentCategory);
        categories = categories.reverse();
        var categoryPath = categories.join(" > ");
        return categoryPath;
    } catch (e) {
        return '';
    }
}

module.exports = {
    dengageEnabled: dengageEnabled,
    dnAccountId: dnAccountId,
    dnAppGuid: dnAppGuid,
    dnTransactionUrls: dnTransactionUrls,
    dnContactColumns: dnContactColumns,
    dnCategoryColumns: dnCategoryColumns,
    dnStagingEnabled: dnStagingEnabled,
    dnSDK: dnSDK,
    dnRegion: dnRegion,
    dnServiceWorker: dnServiceWorker,
    dnBaseUrl: dnBaseUrl,
    dnEventUrl: dnEventUrl,
    log: log,
    getProfileInfo: getProfileInfo,
    prepareDebugData: prepareDebugData,
    dedupeArray: dedupeArray,
    priceCheck: priceCheck,
    getRootPriceBook: getRootPriceBook,
    getVariantAttributeValue: getVariantAttributeValue,
    formatDate: formatDate,
    trackEvent: trackEvent,
    sendTransaction: sendTransaction,
    getDengageToken: getDengageToken,
    validateEmail: validateEmail,
    getDate: getDate,
    getTime: getTime,
    getTimestamp: getTimestamp,
    getStock: getStock,
    postProductsFile: postProductsFile,
    postCustomersFile: postCustomersFile,
    postOrdersFile: postOrdersFile,
    getProductImage: getProductImage,
    getProductPrice: getProductPrice,
    getOrderTotals: getOrderTotals,
    getCategoryPath: getCategoryPath
};
