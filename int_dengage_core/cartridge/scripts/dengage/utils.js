'use strict';

/* API Includes */
var Logger = require('dw/system/Logger');
var Site = require('dw/system/Site');
var Session = require('dw/system/Session');
var StringUtils = require('dw/util/StringUtils');
var System = require('dw/system/System');
var Calendar = require('dw/util/Calendar');

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
    'customer': '/rest/bulk/contacts'
}
var dnContactColumns = ["contact_key", "name", "surname", "contact_status", "email", "email_permission", "gsm_permission", "birth_date", "subscription_date", "gsm", "address1_addressid", "address1_city", "address1_country", "address1_line1", "address1_line2", "address1_line3", "gender"];
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
function sendTransaction(data, transaction) {
    var dnTokenResponse = getDengageToken();
    if (!dnTokenResponse.token) {
        logger.error('Failed to fetch Dengage Token when trying to send transaction: ' + transaction);
        return { success: false };
    }
    var dengageToken = dnTokenResponse.token;

    var transactionUrl = dnTransactionUrls[transaction] || '';
    if (!transactionUrl) {
        logger.error('Unknown transaction type: ' + transaction);
        return { success: false };
    }

    var dengageUrl = dnBaseUrl + transactionUrl;

    var tranasctionData = {};
    if (transaction == 'order') {
        tranasctionData = {
            data: {
                orders: [data]
            }
        }
    } else if (tranasction == 'customer') {
        tranasctionData = {
            data: {
                insertIfNotExists: true,
                throwExceptionIfInvalidRecord: true,
                columns: dnContactColumns,
                contactDatas: [data]
            }
        }
    } else if (transaction == 'category') {
        tranasctionData = {
            data: {
                tableName: 'category',
                columns: dnCategoryColumns,
                rows: [data],
            }
        }
    } else if (transaction == 'product') {
        transactionData = {
            data: {
                products: [data]
            }
        }
    }

    var result = dengageServices.DengageTransactionService.call({ url: dengageUrl, data: transactionData, token: dengageToken });

    if (result == null) {
        logger.error('dengageServices.DengageTransactionService call for ' + event + ' returned null result');
        return;
    } else if (result.error) {
        logger.error('dengageServices.DengageTransactionService call for ' + event + ' returned an error' + result.error)
        return { success: false, error: result.error };
    } else {
        return { success: true };
    }
}

function getDengageToken(forceFetch) {
    var forceFetch = forceFetch || false;
    var token = Site.getCurrent().getCustomPreferenceValue('dengage_token');
    if (!token || forceFetch) {
        var service = dengageServices.getToken();
        var tokenData = {
            userkey: dnApiKey,
            password: dnApiPassword,
            // url: dnBaseUrl + '/rest/login'
        }
        var result = service.call(JSON.stringify(tokenData));   
        token = null;
        if (result.ok) {
            var response = result.object;
            if (response.access_token) {
                token = response.access_token;
                Site.getCurrent().setCustomPreferenceValue('dengage_token', token);
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
    getTime: getTime,
    getTimestamp: getTimestamp,
    getStock: getStock,
    postProductsFile: postProductsFile,
    postCustomersFile: postCustomersFile,
    postOrdersFile: postOrdersFile,
    getProductImage: getProductImage
};
