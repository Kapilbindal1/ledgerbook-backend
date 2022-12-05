const AWS = require('aws-sdk');
var md5 = require('md5');
const {getCustomersByUserId} = require('./customer.query');
const Papa = require('papaparse');
var fs = require('fs');

// ...

const {sendSuccessResponse, sendFailureResponse} = require('../utils');
const PDFDocument = require('pdfkit');
const {file} = require('pdfkit');
const {Console} = require('console');
const dynamoDb = new AWS.DynamoDB.DocumentClient();

const s3 = new AWS.S3({
  // apiVersion: '2006-03-01',
  // signatureVersion: 'v2',
  region: 'ap-south-1',
  accessKeyId: 'AKIAXKR26MDHMWBO2352',
  secretAccessKey: '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',
});
const updateCustomerBal = async (id, transId, amount, balance) => {
  const updateCustomerTableParams = {
    TableName: 'customers-table',
    Key: {
      id: id,
    },
    UpdateExpression: 'set balance = :balance, last_trans_amount = :last_trans_amount,last_trans_date = :last_trans_date, last_trans_id = :last_trans_id',
    ExpressionAttributeValues: {
      ':balance': balance,
      ':last_trans_amount': amount,
      ':last_trans_date': Date.now(),
      ':last_trans_id': transId,
    },
    ReturnValues: 'UPDATED_NEW',
  };
  try {
    let updatedCustomerData = await dynamoDb.update(updateCustomerTableParams).promise();
    if (updatedCustomerData) {
      console.log('updatedCustomerData', updatedCustomerData);
      const body = JSON.stringify({
        message: 'Added successfully',
        status: 200,
        transaction_id: transId,
      });

      return sendSuccessResponse(body);
    } else {
      const body = JSON.stringify({
        error: 'Unable to update customer balance',
        status: 400,
      });
      return sendFailureResponse(body);
    }
  } catch (error) {
    console.log(error);
    const body = JSON.stringify({
      error: 'Something went wrong',
      status: 400,
    });
    return sendFailureResponse(body);
  }
};

module.exports.createTransaction = async (event) => {
  const parametersReceived = JSON.parse(event.body);
  console.log('parametersReceived', parametersReceived);
  const {customerId, type, amount} = parametersReceived;
  const transId = md5(Date.now());
  parametersReceived.id = transId;
  parametersReceived.createdAt = Date.now();
  const customerParams = {
    TableName: 'customers-table',
    Key: {
      id: customerId,
    },
  };

  var response;
  const customerResult = await dynamoDb.get(customerParams).promise();
  console.log('customerResult', customerResult);
  if (customerResult && customerResult?.Item) {
    const {Item} = customerResult;
    console.log('ItemItem', Item);
    let updatedBal = Item?.balance || 0;
    if (type === 'CREDIT') {
      updatedBal = updatedBal + amount;
    } else {
      updatedBal = updatedBal - amount;
    }
    parametersReceived.updatedBal = updatedBal;
    console.log('parametersReceived11', updatedBal, parametersReceived);

    const params = {
      TableName: 'transactions-table',
      Item: parametersReceived,
    };
    const result = await dynamoDb.put(params).promise();

    if (result) {
      return updateCustomerBal(customerId, transId, amount, updatedBal);
    } else {
      callback(new Error("Couldn't add customer details."));
    }
  } else {
    const body = JSON.stringify({
      error: 'Customer does not exist',
      status: 400,
    });
    return sendFailureResponse(body);
  }
};

const getTransactionsByCustomerId = (customerId, type) => {
  console.log('customerId', customerId);

  let object = {
    KeyConditionExpression: '#customerIdIdx = :customerId',
    IndexName: 'customerIdIdx',
    ExpressionAttributeNames: {
      '#customerIdIdx': 'customerId',
    },
    ExpressionAttributeValues: {
      ':customerId': customerId,
    },
    TableName: 'transactions-table',
    // Limit: 1,
  };
  if (type) {
    object.ExpressionAttributeValues = {...object.ExpressionAttributeValues, ':type': type.toUpperCase()};
    object.ExpressionAttributeNames = {...object.ExpressionAttributeNames, '#type': 'type'};
    object.FilterExpression = '#type = :type';
  }
  console.log('objectobject', object);
  return object;
  // return {
  //   KeyConditionExpression: '#customerIdIdx = :customerId',
  //   IndexName: 'customerIdIdx',
  //   ExpressionAttributeNames: {
  //     '#customerIdIdx': 'customerId',
  //     '#type': 'type',
  //   },
  //   ExpressionAttributeValues: {
  //     ':customerId': customerId,
  //     ':type': type.toUpperCase(),
  //   },
  //   TableName: 'transactions-table',
  //   FilterExpression: '#type = :type',
  //   // Limit: 1,
  // };
};
module.exports.getTransactions = async (event, context, callback) => {
  try {
    console.log('event.pathParameters', event.pathParameters.customerId);
    const {customerId} = event.pathParameters;

    const params = getTransactionsByCustomerId(customerId, event.queryStringParameters?.type);
    console.log(params, 'fjdskfjd');
    const data = await dynamoDb.query(params).promise();
    console.log('datadata', data);
    let response = {};

    if (data && data?.Items.length) {
      const body = JSON.stringify({data: data.Items, status: 200, message: 'Transactions fetched successfully'});
      response = sendSuccessResponse(body);
    } else {
      const body = JSON.stringify({
        status: 200,
        error: 'No transactions found',
      });
      response = sendSuccessResponse(body);
    }

    callback(null, response);
  } catch (err) {
    const body = JSON.stringify({
      error: 'Something went wrong',
      status: 400,
    });
    return sendFailureResponse(body);
  }
};

function generateHeader(customerResult, doc) {
  const customer = customerResult.Item;
  console.log('customerResultcustomerResult', customer);
  doc.image('logo.png', 50, 45, {width: 50}).fillColor('#444444').fontSize(20).text('Ledgerbook Inc.', 110, 57).fontSize(10).text(`Name: ${customer.fullName}`, 200, 65, {align: 'right'}).text(`Address: ${customer.address}`, 200, 80, {align: 'right'}).moveDown().text(`Phone: ${customer.phone}`, 200, 100, {align: 'right'}).moveDown();
}

function generateFooter(doc) {
  doc.fontSize(10).text('Thank you for your business.', 50, 400, {align: 'center', width: 500});
}
function generateTableRow(doc, y, c1, c2, c3, c4, c5, c6) {
  doc.fontSize(10).text(c1, 50, y).text(c2, 150, y).text(c3, 210, y, {width: 90, align: 'right'}).text(c4, 270, y, {width: 90}).text(c5, 10, y, {align: 'right'});
}
function generateInvoiceTable(doc, invoice) {
  let i,
    invoiceTableTop = 150;
  generateTableRow(doc, invoiceTableTop, 'Amount', 'Created At', 'Type', 'Mode', 'Balance', 'Other Details');

  for (i = 0; i < invoice.length; i++) {
    const item = invoice[i];
    const position = invoiceTableTop + (i + 1) * 30;
    generateTableRow(doc, position, item.amount, new Date(item.createdAt).toLocaleString(), item.type, item.mode, item.updatedBal, item.other_details);
  }
}

const uploadToS3 = (type, doc, path) => {
  var s3params = {
    Bucket: 'ledgerbook-transaction-assets',
    Key: path,
    Body: doc,
    CacheControl: 'public, max-age=86400',
  };
  let response = new Promise((resolve, reject) => {
    let res = {};
    s3.upload(s3params, function (err, data) {
      if (err) {
        const body = JSON.stringify({
          status: 400,
          error: err,
        });
        res = sendFailureResponse(body);
      } else {
        const body = JSON.stringify({
          message: `${type} returned successfully`,
          status: 200,
          link: data.Location,
        });
        res = sendSuccessResponse(body);

        // next(null, filePath);
      }
      resolve(res);
    });
  });
  return response;
};
function createInvoice(type, customerResult, invoice, path) {
  let doc = new PDFDocument();
  generateHeader(customerResult, doc); // Invoke `generateHeader` function.

  generateInvoiceTable(doc, invoice);
  generateFooter(doc); // Invoke `generateFooter` function.

  doc.end();
  return uploadToS3(type, doc, path, invoice);
}

const getReportsByDateRange = (customerId, fromDate, toDate) => {
  let object = {
    KeyConditionExpression: '#customerIdIdx = :customerId AND createdAt BETWEEN :from_time and :to_time',
    IndexName: 'customerIdIdx',
    ExpressionAttributeNames: {
      '#customerIdIdx': 'customerId',
    },
    ExpressionAttributeValues: {
      ':customerId': customerId,
      ':from_time': parseInt(fromDate),
      ':to_time': parseInt(toDate),
    },
    TableName: 'transactions-table',
    // Limit: 1,
  };
  console.log('kkkkk', object);
  return object;
};
module.exports.getTransactionsReport = async (event, context, callback) => {
  console.log('event.queryStringParameter', event.queryStringParameters);

  if (!event.queryStringParameters?.customerId) {
    const body = JSON.stringify({
      message: 'customer id not found',
      status: 400,
    });
    return sendFailureResponse(body);
  }
  const {customerId, type} = event.queryStringParameters;

  const customerParams = {
    TableName: 'customers-table',
    Key: {
      id: customerId,
    },
  };
  try {
    var response;
    const customerResult = await dynamoDb.get(customerParams).promise();
    let params = getTransactionsByCustomerId(customerId);

    if (event.queryStringParameters.fromDate && event.queryStringParameters.toDate) {
      const {toDate, fromDate} = event.queryStringParameters;
      params = getReportsByDateRange(customerId, fromDate, toDate);
    }
    console.log('paramspgetReportsByDateRangearams', params);
    const transData = await dynamoDb.query(params).promise();
    if (transData && transData?.Items?.length) {
      if (type === 'csv') {
        let path = `${Date.now()}.csv`;

        var csvFileContent = Papa.unparse(transData.Items);
        var bufferObject = new Buffer.from(JSON.stringify(csvFileContent));
        return uploadToS3(type, bufferObject, path);
      } else {
        let path = `${Date.now()}.pdf`;

        return createInvoice(type, customerResult, transData.Items, path);
      }
    } else {
      const body = JSON.stringify({
        message: 'Transactions not found',
        status: 400,
      });
      return sendFailureResponse(body);
    }
  } catch (err) {
    console.log('errerr', err);
    const body = JSON.stringify({
      status: 400,
      error: err,
    });
    return sendFailureResponse(body);
  }
};

module.exports.getPreSignedUrl = async () => {
  const fileName = Date.now().toString();
  const s3Params = {
    Bucket: 'ledgerbook-transaction-assets',
    Key: fileName,
    Expires: 60 * 60,
    ContentType: 'application/octet-stream',
  };
  // const url = await getPresignUrlPromiseFunction(s3, s3Params);
  // function getPresignUrlPromiseFunction(s3, s3Params): Promise<string>{
  try {
    const url = await new Promise((resolve, reject) => {
      s3.getSignedUrl('putObject', s3Params, (err, url) => {
        err ? reject(err) : resolve(url);
      });
    });
    const body = JSON.stringify({
      message: 'Presigned url fetched successfully',
      status: 200,
      url: url,
      fileUrl: `https://ledgerbook-transaction-assets.s3.ap-south-1.amazonaws.com/${fileName}`,
    });

    return sendSuccessResponse(body);
  } catch (err) {
    if (err) {
      const body = JSON.stringify({
        error: 'Error in fetching presigned url',
        status: 400,
      });
      return sendFailureResponse(body);
    }
  }
};
